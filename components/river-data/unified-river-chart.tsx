"use client"

import { useMemo, useCallback, useEffect, useState, useRef } from "react"
import { XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, ReferenceLine } from "recharts"
import type { RiverData, AlertLevel } from "@/utils/water-data"
import type { TimeRangeOption } from "@/components/river-data/time-range-select"
import { GKD_RANGES, timeRangeDurationDays } from "@/components/river-data/time-range-select"
import type { GkdHistory } from "@/hooks/use-gkd-data"
import type { GkdDataPoint } from "@/app/api/gkd/route"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { formatTrendForTimeRange } from "@/utils/formatters"

export type DataType = "level" | "temperature" | "flow"

interface UnifiedRiverChartProps {
  river: RiverData
  dataType: DataType
  timeRange: TimeRangeOption
  isMobile: boolean
  isAdminMode?: boolean
  extendedHistory?: GkdHistory | null
  isGkdLoading?: boolean
  isTransitioning?: boolean
  onDataTypeChange: (dataType: DataType) => void
}

// --- GKD helpers ---

function smoothGkdPoints(points: GkdDataPoint[], timeRange: TimeRangeOption): GkdDataPoint[] {
  const targetPoints: Partial<Record<TimeRangeOption, number>> = {
    "2w":  50,
    "1m":  60,
    "3m":  70,
    "6m":  70,
    "12m": 60,
    "24m": 50,
  }
  const target = targetPoints[timeRange]
  if (!target || points.length <= target) return points
  const stride = Math.max(1, Math.floor(points.length / target))
  const win = Math.max(1, stride)
  const result: GkdDataPoint[] = []
  for (let i = 0; i < points.length; i += stride) {
    const half = Math.floor(win / 2)
    const start = Math.max(0, i - half)
    const end = Math.min(points.length, start + win)
    const slice = points.slice(start, end)
    const avg = slice.reduce((s, p) => s + p.value, 0) / slice.length
    result.push({ ...points[i], value: avg })
  }
  return result
}

const GKD_MONTH_ABBR = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"]

function formatGkdLabel(date: string, timeRange: TimeRangeOption): string {
  const parts = date.split(" ")[0].split(".")
  if (parts.length < 3) return date
  const [dd, mm, yyyy] = parts
  if (timeRange === "12m" || timeRange === "24m") {
    return `${GKD_MONTH_ABBR[+mm - 1]} '${yyyy.slice(2)}`
  }
  return `${dd}.${mm}`
}

function filterGkdByTimeRange(points: GkdDataPoint[], timeRange: TimeRangeOption): GkdDataPoint[] {
  if (points.length === 0) return points
  const days = timeRangeDurationDays[timeRange]
  let latestTimestamp = 0
  for (const p of points) {
    if (p.timestamp > latestTimestamp) latestTimestamp = p.timestamp
  }
  const cutoff = latestTimestamp - days * 24 * 60 * 60 * 1000
  const filtered = points.filter(p => p.timestamp >= cutoff)
  filtered.sort((a, b) => a.timestamp - b.timestamp)
  return filtered
}

function prepareGkdData(points: GkdDataPoint[], timeRange: TimeRangeOption, lakeLevelAverage?: number) {
  const filtered = filterGkdByTimeRange(points, timeRange)
  const smoothed = smoothGkdPoints(filtered, timeRange)
  return smoothed.map(p => {
    const label = formatGkdLabel(p.date, timeRange)
    const value = lakeLevelAverage
      ? Math.round((p.value - lakeLevelAverage) * 100)
      : p.value
    return { value, absoluteValue: p.value, time: label, label, fullDate: p.date }
  })
}

// Custom tooltip component
interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    value: number
    payload: {
      fullDate?: string
    }
  }>
  label?: string
  dataType: DataType
  isLake?: boolean
  lakeLevelAverage?: number
  [key: string]: unknown
}

const CustomTooltip = ({ active, payload, label, dataType, isLake, lakeLevelAverage }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    let unit = ""
    let valueFormatted = ""

    switch (dataType) {
      case "level":
        if (isLake && lakeLevelAverage) {
          const deviationCm = Math.round(payload[0].value)
          const sign = deviationCm >= 0 ? "+" : ""
          unit = "cm"
          valueFormatted = `${sign}${deviationCm}`
        } else {
          unit = "cm"
          valueFormatted = Number.parseFloat(payload[0].value.toString()).toFixed(0)
        }
        break
      case "temperature":
        unit = "°C"
        valueFormatted = Number.parseFloat(payload[0].value.toString()).toFixed(1)
        break
      case "flow": {
        unit = "m³/s"
        const v = payload[0].value
        valueFormatted = v % 1 === 0 ? v.toString() : Number.parseFloat(v.toString()).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
        break
      }
    }

    const fullDate = payload[0].payload.fullDate || ""
    let formattedDate = ""

    if (fullDate) {
      const dateParts = fullDate.split(" ")
      if (isLake || dateParts.length === 1) {
        formattedDate = dateParts[0]
      } else if (dateParts.length >= 2) {
        const dateComponent = dateParts[0].split(".").slice(0, 2).join(".")
        const timeComponent = dateParts[1].substring(0, 5)
        formattedDate = `${dateComponent} ${timeComponent}`
      } else {
        formattedDate = dateParts[0]
      }
    }

    return (
      <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
        <p className="text-muted-foreground">{formattedDate}</p>
        <p className="font-medium text-foreground">
          {valueFormatted} {unit}
        </p>
      </div>
    )
  }

  return null
}

// Custom Y-axis tick for lake levels
interface CustomYAxisTickProps {
  x?: number
  y?: number
  payload?: { value: number }
  lakeLevelAverage?: number
}

const CustomLakeLevelYAxisTick = ({ x, y, payload, lakeLevelAverage }: CustomYAxisTickProps) => {
  if (!payload || lakeLevelAverage === undefined || lakeLevelAverage === null) return null

  const value = Math.round(payload.value)

  if (value !== 0 && Math.abs(value) <= 8) {
    return null
  }

  if (value === 0) {
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={-5} y={-6} textAnchor="end" className="fill-orange-500" fontSize={9} fontWeight={500}>
          24M Mittel
        </text>
        <text x={-5} y={6} textAnchor="end" className="fill-orange-500" fontSize={9}>
          {lakeLevelAverage.toFixed(2)}m
        </text>
      </g>
    )
  }

  const label = value > 0 ? `+${value}` : `${value}`
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={-5} y={4} textAnchor="end" className="fill-current" fontSize={10}>
        {label}
      </text>
    </g>
  )
}

// Custom tick component for X-axis
interface CustomXAxisTickProps {
  x?: number
  y?: number
  payload?: {
    value: string
  }
  isLongTimeRange?: boolean
}

const CustomXAxisTick = ({ x, y, payload, isLongTimeRange }: CustomXAxisTickProps) => {
  if (!payload?.value) return null

  if (isLongTimeRange) {
    const parts = payload.value.split(" ")
    if (parts.length === 2) {
      const date = parts[0]
      const time = parts[1]

      return (
        <g transform={`translate(${x},${y})`}>
          <text x={0} y={0} dy={16} textAnchor="middle" className="fill-current" fontSize={10}>
            {date}
          </text>
          <text x={0} y={0} dy={30} textAnchor="middle" className="fill-current" fontSize={10}>
            {time}
          </text>
        </g>
      )
    }
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="middle" className="fill-current" fontSize={10}>
        {payload.value}
      </text>
    </g>
  )
}

// Create placeholder data for empty charts
const createPlaceholderData = (dataType: DataType) => {
  const now = new Date()
  const data = []

  for (let i = 0; i < 5; i++) {
    const date = new Date(now)
    date.setHours(now.getHours() - i)

    const formattedDate = `${date.getDate().toString().padStart(2, "0")}.${(date.getMonth() + 1).toString().padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`

    let value = 0
    switch (dataType) {
      case "flow":
        value = 10 - i * 0.5
        break
      case "level":
        value = 100 - i * 5
        break
      case "temperature":
        value = 15 - i * 0.2
        break
    }

    data.push({
      time: formattedDate.split(" ")[1],
      label: formattedDate,
      fullDate: formattedDate,
      value,
    })
  }

  return data
}

// Data type pane configuration
interface PaneConfig {
  key: DataType
  label: string
  getValue: (river: RiverData, extendedHistory?: GkdHistory | null) => { value: string; unit: string; subtext?: string } | null
  isDisabled: (river: RiverData) => boolean
}

const getPaneConfigs = (river: RiverData, extendedHistory?: GkdHistory | null): PaneConfig[] => {
  const isLake = river?.isLake === true
  const pegelnullpunkt = river?.pegelnullpunkt
  const isLakeLevelWithRef = isLake && pegelnullpunkt

  return [
    {
      key: "flow",
      label: "Abfluss",
      getValue: (river) => {
        // Show current flow value if available
        if (river.current?.flow?.flow != null) {
          return {
            value: river.current.flow.flow.toFixed(2),
            unit: "m³/s"
          }
        }
        // Fall back to latest history point if current is not available
        if (river.history?.flows?.length) {
          const latest = river.history.flows[0]
          return {
            value: latest.flow.toFixed(2),
            unit: "m³/s"
          }
        }
        return null
      },
      isDisabled: (river) => river.isLake === true || (!river.current?.flow && !river.history?.flows?.length)
    },
    {
      key: "level",
      label: "Pegel",
      getValue: (river, extHistory) => {
        // Lake with reference level (deviation display)
        if (isLakeLevelWithRef && extHistory?.levels?.length) {
          const levels = extHistory.levels
          const latestPoint = levels[levels.length - 1]
          const sum = levels.reduce((acc, p) => acc + p.value, 0)
          const average = sum / levels.length
          const deviationCm = Math.round((latestPoint.value - average) * 100)
          const sign = deviationCm >= 0 ? "+" : ""
          return {
            value: `${sign}${deviationCm}`,
            unit: "cm",
            subtext: `Mittel: ${average.toFixed(2)}m`
          }
        }
        // Show current level value if available
        if (river.current?.level?.level != null) {
          return {
            value: river.current.level.level.toString(),
            unit: "cm"
          }
        }
        // Fall back to latest history point
        if (river.history?.levels?.length) {
          const latest = river.history.levels[0]
          return {
            value: latest.level.toString(),
            unit: "cm"
          }
        }
        return null
      },
      isDisabled: (river) => {
        if (isLakeLevelWithRef) return !extendedHistory?.levels?.length
        return !river.current?.level && !river.history?.levels?.length
      }
    },
    {
      key: "temperature",
      label: "Temperatur",
      getValue: (river) => {
        // Show current temperature if available
        if (river.current?.temperature?.temperature != null) {
          return {
            value: river.current.temperature.temperature.toFixed(1),
            unit: "°C"
          }
        }
        // Fall back to latest history point
        if (river.history?.temperatures?.length) {
          const latest = river.history.temperatures[0]
          return {
            value: latest.temperature.toFixed(1),
            unit: "°C"
          }
        }
        return null
      },
      isDisabled: (river) => {
        return river.current?.temperature == null && !river.history?.temperatures?.length
      }
    }
  ]
}

export function UnifiedRiverChart({ 
  river, 
  dataType, 
  timeRange, 
  isMobile, 
  isAdminMode = false, 
  extendedHistory, 
  isGkdLoading = false,
  isTransitioning = false,
  onDataTypeChange 
}: UnifiedRiverChartProps) {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const chartContainerRef = useRef<HTMLDivElement>(null)

  const isLake = river?.isLake || false
  const isSpitzingsee = river?.name === "Spitzingsee"
  const isSchliersee = river?.name === "Schliersee"
  const isTegernsee = river?.name === "Tegernsee"

  // Detect dark mode
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark")
    setIsDarkMode(isDark)

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          const isDarkNow = document.documentElement.classList.contains("dark")
          setIsDarkMode(isDarkNow)
        }
      })
    })

    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [])

  // Helper function to get data points for time range
  const getDataPointsForTimeRange = useCallback(
    (timeRange: TimeRangeOption): number => {
      if (isLake) {
        const lakeDataPoints: Partial<Record<TimeRangeOption, number>> = {
          "1w":  7,
          "2w":  14,
          "1m":  30,
          "3m":  90,
          "6m":  180,
          "12m": 365,
          "24m": 730,
        }
        return lakeDataPoints[timeRange] ?? 30
      }

      const riverDataPoints: Partial<Record<TimeRangeOption, number>> = {
        "1h":  4,
        "6h":  24,
        "12h": 48,
        "24h": 96,
        "2d":  192,
        "1w":  672,
      }
      return riverDataPoints[timeRange] ?? 96
    },
    [isLake],
  )

  // Prepare chart data
  const prepareChartData = useCallback(
    (rawData: any[], timeRange: TimeRangeOption, mapper: (point: any) => any) => {
      if (!rawData || rawData.length === 0) {
        return []
      }

      let filteredData = [...rawData]

      if (isLake) {
        const maxDataPoints = getDataPointsForTimeRange(timeRange)
        filteredData = filteredData.slice(0, maxDataPoints)

        return filteredData.reverse().map((point) => {
          const dateParts = point.date ? point.date.split(" ") : [""]
          const datePart = dateParts[0]
          const dayMonth = datePart.includes(".") ? datePart.split(".").slice(0, 2).join(".") : datePart

          return {
            ...mapper(point),
            time: dayMonth,
            label: dayMonth,
            fullDate: point.date,
          }
        })
      }

      const isLongTimeRange = timeRange === "1w"

      const dataPoints: Partial<Record<TimeRangeOption, number>> = {
        "1h":  4,
        "6h":  24,
        "12h": 48,
        "24h": 96,
        "2d":  192,
        "1w":  672,
      }

      filteredData = filteredData.slice(0, dataPoints[timeRange] ?? 96)

      if (timeRange === "1w" && filteredData.length > 100) {
        const step = Math.ceil(filteredData.length / 100)
        filteredData = filteredData.filter((_, index) => index % step === 0)
      }

      return filteredData.reverse().map((point) => {
        const dateParts = point.date ? point.date.split(" ") : ["", ""]
        const timePart = dateParts.length > 1 ? dateParts[1].substring(0, 5) : ""
        const datePart = dateParts[0].substring(0, 5)

        const label = isLongTimeRange
          ? `${datePart} ${timePart}`
          : timePart

        return {
          ...mapper(point),
          time: timePart,
          label: label,
          fullDate: point.date,
        }
      })
    },
    [isLake, getDataPointsForTimeRange],
  )

  // Chart trend display
  const chartTrendDisplay = useMemo(() => {
    try {
      if (!river || GKD_RANGES.has(timeRange)) return null
      return formatTrendForTimeRange(river, dataType, timeRange)
    } catch {
      return null
    }
  }, [river, dataType, timeRange])

  // Calculate Y-axis domain
  const yAxisDomain = useMemo(() => {
    let data: number[] = []
    const pegelnullpunkt = river?.pegelnullpunkt
    const isLakeLevelWithRef = isLake && dataType === "level" && pegelnullpunkt
    const useLakeLevelFromGkd = isLake && dataType === "level" && river?.gkdLevelSlug

    if (!river || !river.history) {
      return [0, 10]
    }

    if (extendedHistory && (GKD_RANGES.has(timeRange) || useLakeLevelFromGkd)) {
      const gkdPoints =
        dataType === "temperature" ? extendedHistory.temperatures :
        dataType === "level"       ? extendedHistory.levels :
        dataType === "flow"        ? extendedHistory.flows : undefined
      if (gkdPoints && gkdPoints.length > 0) {
        const filtered = filterGkdByTimeRange(gkdPoints, timeRange)
        data = smoothGkdPoints(filtered, timeRange).map(p => p.value).filter(v => !isNaN(v))
      }
    }

    if (data.length === 0) {
      if (isLake) {
        if (dataType === "temperature" && river.history.temperatures?.length > 0) {
          const maxDataPoints = getDataPointsForTimeRange(timeRange)
          data = river.history.temperatures
            .slice(0, maxDataPoints)
            .map((point) => point.temperature)
            .filter((value) => typeof value === "number")
        }
      } else {
        if (dataType === "level" && river.history.levels?.length > 0) {
          data = river.history.levels
            .slice(0, getDataPointsForTimeRange(timeRange))
            .map((point) => point.level)
            .filter((value) => typeof value === "number")
        } else if (dataType === "temperature" && river.history.temperatures?.length > 0) {
          data = river.history.temperatures
            .slice(0, getDataPointsForTimeRange(timeRange))
            .map((point) => point.temperature)
            .filter((value) => typeof value === "number")
        } else if (dataType === "flow" && river.history.flows?.length > 0) {
          data = river.history.flows
            .slice(0, getDataPointsForTimeRange(timeRange))
            .map((point) => point.flow)
            .filter((value) => typeof value === "number")
        }
      }
    }

    if (data.length === 0) return [0, 10]

    const min = Math.min(...data)
    const max = Math.max(...data)

    if (isLakeLevelWithRef && extendedHistory?.levels && extendedHistory.levels.length > 0) {
      const avgSum = extendedHistory.levels.reduce((acc, p) => acc + p.value, 0)
      const avgLevel = avgSum / extendedHistory.levels.length
      const filtered = filterGkdByTimeRange(extendedHistory.levels, timeRange)
      const deviations = filtered.map(p => Math.round((p.value - avgLevel) * 100))
      const minDev = Math.min(...deviations)
      const maxDev = Math.max(...deviations)
      const range = maxDev - minDev
      const padding = Math.max(10, range * 0.2)
      let domainMin = Math.floor((minDev - padding) / 10) * 10
      let domainMax = Math.ceil((maxDev + padding) / 10) * 10
      if (domainMin > 0) domainMin = -10
      if (domainMax < 0) domainMax = 10
      return [domainMin, domainMax]
    }

    const baselineMin = 0

    let padding: number
    if (max < 10) {
      padding = 2
    } else if (max <= 30) {
      padding = Math.max(2, max * 0.15)
    } else {
      padding = Math.max(5, max * 0.1)
    }

    const newMax = Math.ceil(max + padding)

    return [baselineMin, newMax]
  }, [river, dataType, timeRange, getDataPointsForTimeRange, isLake, extendedHistory])

  const isLakeLevelWithRef = isLake && dataType === "level" && river?.pegelnullpunkt

  // Calculate 24-month average for lake levels
  const lakeLevelAverage = useMemo(() => {
    if (isLakeLevelWithRef && extendedHistory?.levels && extendedHistory.levels.length > 0) {
      const sum = extendedHistory.levels.reduce((acc, p) => acc + p.value, 0)
      return sum / extendedHistory.levels.length
    }
    return null
  }, [isLakeLevelWithRef, extendedHistory?.levels])

  // Calculate optimal tick count
  const optimalTickCount = useMemo(() => {
    const min = yAxisDomain[0] as number
    const max = yAxisDomain[1] as number
    const range = max - min

    if (isLakeLevelWithRef) return 5

    if (range <= 10) return 5
    if (range <= 20) return 6

    return 7
  }, [yAxisDomain, isLakeLevelWithRef])

  // Generate explicit tick values for lake levels
  const lakeLevelTicks = useMemo(() => {
    if (!isLakeLevelWithRef) return undefined
    const min = yAxisDomain[0] as number
    const max = yAxisDomain[1] as number
    const range = max - min
    const step = range <= 40 ? 10 : range <= 80 ? 20 : range <= 150 ? 30 : 50
    const ticks: number[] = []
    for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
      ticks.push(v)
    }
    if (!ticks.includes(0)) {
      ticks.push(0)
      ticks.sort((a, b) => a - b)
    }
    return ticks
  }, [isLakeLevelWithRef, yAxisDomain])

  // Y-axis tick formatter
  const yAxisTickFormatter = useCallback((value: number) => {
    if (isLakeLevelWithRef && lakeLevelAverage) {
      const rounded = Math.round(value)
      if (rounded !== 0 && Math.abs(rounded) <= 10) {
        return ""
      }
      if (rounded === 0) {
        return `Mittel\n${lakeLevelAverage.toFixed(2)}m`
      }
      return rounded > 0 ? `+${rounded}` : `${rounded}`
    }
    return Math.round(value).toString()
  }, [isLakeLevelWithRef, lakeLevelAverage])

  // Prepare chart data based on data type
  const chartData = useMemo(() => {
    if (!river || !river.history) {
      return createPlaceholderData(dataType)
    }

    const pegelnullpunkt = river.pegelnullpunkt
    const isLakeLevelWithRef = isLake && dataType === "level" && pegelnullpunkt
    const useLakeLevelFromGkd = isLake && dataType === "level" && river.gkdLevelSlug

    if (extendedHistory && (GKD_RANGES.has(timeRange) || useLakeLevelFromGkd)) {
      const gkdPoints =
        dataType === "temperature" ? extendedHistory.temperatures :
        dataType === "level"       ? extendedHistory.levels :
        dataType === "flow"        ? extendedHistory.flows : undefined
      if (gkdPoints && gkdPoints.length > 0) {
        const prepared = prepareGkdData(gkdPoints, timeRange, isLakeLevelWithRef ? (lakeLevelAverage ?? undefined) : undefined)
        if (prepared.length > 0) return prepared
      }
    }

    let data: any[] = []

    if (dataType === "level" && river.history.levels?.length > 0) {
      data = prepareChartData(river.history.levels, timeRange, (point) => ({
        ...point,
        value: point.level,
        unit: "cm",
        type: "Level",
      }))
    } else if (dataType === "temperature" && river.history.temperatures?.length > 0) {
      data = prepareChartData(river.history.temperatures, timeRange, (point) => ({
        ...point,
        value: point.temperature,
        rawValue: point.rawTemperature,
        unit: "°C",
        type: "Temperature",
      }))
    } else if (dataType === "flow" && river.history.flows?.length > 0) {
      data = prepareChartData(river.history.flows, timeRange, (point) => ({
        ...point,
        value: point.flow,
        unit: "m³/s",
        type: "Flow",
      }))
    }

    if (data.length === 0) {
      return createPlaceholderData(dataType)
    }

    return data
  }, [river, dataType, timeRange, prepareChartData, extendedHistory, isLake, lakeLevelAverage])

  // Calculate X-axis interval
  const xAxisInterval = useMemo(() => {
    const dataLength = chartData.length

    if (GKD_RANGES.has(timeRange)) {
      const target = isMobile ? 4 : 7
      return Math.max(1, Math.floor(dataLength / target) - 1)
    }

    if (isLake) {
      return isMobile ? Math.max(1, Math.floor(dataLength / 4)) : Math.max(1, Math.floor(dataLength / 6))
    }

    if (isMobile) {
      switch (timeRange) {
        case "1h":  return 0
        case "6h":  return 5
        case "12h": return 11
        case "24h": return 23
        case "2d":  return 47
        default:    return Math.floor(dataLength / 6)
      }
    } else {
      switch (timeRange) {
        case "1h":  return 0
        case "6h":  return 3
        case "12h": return 7
        case "24h": return 11
        case "2d":  return 23
        default:    return Math.floor(dataLength / 8)
      }
    }
  }, [timeRange, chartData.length, isMobile, isLake])

  // Get chart configuration
  const chartConfig = useMemo(() => {
    let stroke, fill

    if (isAdminMode) {
      if ((isSchliersee || isTegernsee) && dataType === "temperature") {
        const latestTempData = river?.history?.temperatures?.[0]
        const situation = latestTempData?.situation?.toLowerCase() || ""

        if (situation.includes("neuer höchstwert")) {
          stroke = "#dc2626"
          fill = isDarkMode ? "rgba(220, 38, 38, 0.4)" : "#fca5a5"
        } else if (situation.includes("hoch")) {
          stroke = "#d97706"
          fill = isDarkMode ? "rgba(217, 119, 6, 0.4)" : "#fcd34d"
        } else {
          stroke = "#2563eb"
          fill = isDarkMode ? "rgba(37, 99, 235, 0.3)" : "#dbeafe"
        }
      } else if (isSpitzingsee) {
        stroke = "#2563eb"
        fill = isDarkMode ? "rgba(37, 99, 235, 0.3)" : "#dbeafe"
      } else {
        const alertLevel: AlertLevel = river?.alertLevel || "normal"

        switch (alertLevel) {
          case "alert":
            stroke = "#dc2626"
            fill = isDarkMode ? "rgba(220, 38, 38, 0.4)" : "#fca5a5"
            break
          case "warning":
            stroke = "#d97706"
            fill = isDarkMode ? "rgba(217, 119, 6, 0.4)" : "#fcd34d"
            break
          case "normal":
          default:
            stroke = "#2563eb"
            fill = isDarkMode ? "rgba(37, 99, 235, 0.3)" : "#dbeafe"
        }
      }
    } else {
      stroke = "#2563eb"
      fill = isDarkMode ? "rgba(37, 99, 235, 0.3)" : "#dbeafe"
    }

    return {
      stroke,
      fill,
      dataKey: "value",
    }
  }, [
    river?.alertLevel,
    river?.history?.temperatures,
    isDarkMode,
    isAdminMode,
    isSchliersee,
    isTegernsee,
    isSpitzingsee,
    dataType,
  ])

  const isLongTimeRange = timeRange === "1w"
  const isGkdRange = GKD_RANGES.has(timeRange)

  const hasAnyDataForCurrentType = useMemo(() => {
    if (!river || !river.history) return false

    switch (dataType) {
      case "flow":
        return river.history.flows && river.history.flows.length > 0
      case "level":
        if (isLake && river.gkdLevelSlug) {
          return extendedHistory?.levels && extendedHistory.levels.length > 0
        }
        return river.history.levels && river.history.levels.length > 0
      case "temperature":
        return river.history.temperatures && river.history.temperatures.length > 0
      default:
        return false
    }
  }, [river, dataType, isLake, extendedHistory])

  // Get pane configurations
  const paneConfigs = useMemo(() => getPaneConfigs(river, extendedHistory), [river, extendedHistory])

  // shadcn chart config
  const shadcnChartConfig = {
    value: {
      label: dataType === "flow" ? "Abfluss" : dataType === "level" ? "Pegel" : "Temperatur",
      color: chartConfig.stroke,
    },
  } satisfies ChartConfig

  // Loading state only for GKD
  const hasServerData = (() => {
    if (!river?.history) return false
    switch (dataType) {
      case "flow": return (river.history.flows?.length ?? 0) > 0
      case "level": return (river.history.levels?.length ?? 0) > 0
      case "temperature": return (river.history.temperatures?.length ?? 0) > 0
      default: return false
    }
  })()
const showGkdLoading = isGkdLoading && isGkdRange && !hasServerData
  const showLoading = showGkdLoading || isTransitioning
  
  if (!hasAnyDataForCurrentType) {
    return (
      <Card>
        <CardHeader className="border-b p-0">
          <div className="grid grid-cols-3">
            {paneConfigs.map((pane) => {
              const valueData = pane.getValue(river, extendedHistory)
              const isDisabled = pane.isDisabled(river)
              const isActive = dataType === pane.key

              return (
                <button
                  key={pane.key}
                  data-active={isActive}
                  disabled={isDisabled}
                  className="relative flex flex-col justify-center gap-0.5 px-3 py-3 text-left border-r last:border-r-0 data-[active=true]:bg-muted/50 sm:px-4 sm:py-4 disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover:bg-muted/30 data-[active=true]:hover:bg-muted/50"
                  onClick={() => !isDisabled && onDataTypeChange(pane.key)}
                >
                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                    {pane.label}
                  </span>
                  {valueData ? (
                    <span className="text-sm sm:text-lg font-bold leading-none tabular-nums">
                      {valueData.value}
                      <span className="text-[10px] sm:text-xs font-medium ml-0.5">{valueData.unit}</span>
                    </span>
                  ) : (
                    <span className="text-xs sm:text-sm text-muted-foreground">--</span>
                  )}
                </button>
              )
            })}
          </div>
        </CardHeader>
        <CardContent className="px-2 py-4 sm:p-6">
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            <div className="text-center">
              <p className="text-sm">Keine Daten verfügbar</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="border-b p-0">
        <div className="grid grid-cols-3">
          {paneConfigs.map((pane) => {
            const valueData = pane.getValue(river, extendedHistory)
            const isDisabled = pane.isDisabled(river)
            const isActive = dataType === pane.key

            return (
              <button
                key={pane.key}
                data-active={isActive}
                disabled={isDisabled}
                className="relative flex flex-col justify-center gap-0.5 px-3 py-3 text-left border-r last:border-r-0 data-[active=true]:bg-muted/50 sm:px-4 sm:py-4 disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover:bg-muted/30 data-[active=true]:hover:bg-muted/50"
                onClick={() => !isDisabled && onDataTypeChange(pane.key)}
              >
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  {pane.label}
                </span>
                {valueData ? (
                  <>
                    <span className="text-sm sm:text-lg font-bold leading-none tabular-nums">
                      {valueData.value}
                      <span className="text-[10px] sm:text-xs font-medium ml-0.5">{valueData.unit}</span>
                    </span>
                    {valueData.subtext && (
                      <span className="text-[9px] text-muted-foreground mt-0.5 hidden sm:block truncate">
                        {valueData.subtext}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs sm:text-sm text-muted-foreground">--</span>
                )}
              </button>
            )
          })}
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-2 pb-4 sm:px-6 sm:pt-3 sm:pb-6">
        {chartTrendDisplay && (
          <div className="flex justify-end mb-1">
            <span className="text-[10px] sm:text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
              {chartTrendDisplay}
            </span>
          </div>
        )}
        <div className="h-[240px] sm:h-[280px] w-full relative" ref={chartContainerRef}>
          {showLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/50">
              <div className="text-sm text-muted-foreground animate-pulse">Daten werden geladen...</div>
            </div>
          )}
          <div className={`transition-opacity duration-300 ease-in-out h-full ${showLoading ? "opacity-30" : "opacity-100"}`}>
            <ChartContainer config={shadcnChartConfig} className="h-full w-full">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 8, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartConfig.stroke} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={chartConfig.stroke} stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey={isGkdRange || isLake ? "label" : isLongTimeRange ? "label" : "time"}
                  tick={(props) => <CustomXAxisTick {...props} isLongTimeRange={isLongTimeRange && !isLake && !isGkdRange} />}
                  interval={xAxisInterval}
                  height={isLongTimeRange && !isLake && !isGkdRange ? 50 : 30}
                  stroke="currentColor"
                  allowDataOverflow={false}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={yAxisDomain}
                  ticks={lakeLevelTicks}
                  tickCount={isLakeLevelWithRef ? undefined : optimalTickCount}
                  tickFormatter={isLakeLevelWithRef ? undefined : yAxisTickFormatter}
                  tick={isLakeLevelWithRef
                    ? (props: any) => <CustomLakeLevelYAxisTick {...props} lakeLevelAverage={lakeLevelAverage} />
                    : { fontSize: 10 }
                  }
                  width={isLakeLevelWithRef ? 60 : 30}
                  stroke="currentColor"
                  allowDecimals={false}
                  allowDataOverflow={false}
                  tickLine={false}
                  axisLine={false}
                />
                {!isMobile && (
                  <Tooltip
                    content={(props) => <CustomTooltip {...props} dataType={dataType} isLake={isLake} lakeLevelAverage={lakeLevelAverage ?? undefined} />}
                    cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "3 3" }}
                    wrapperStyle={{ zIndex: 100 }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey={chartConfig.dataKey}
                  stroke={chartConfig.stroke}
                  fill="url(#colorValue)"
                  fillOpacity={1}
                  strokeWidth={2}
                  activeDot={false}
                  dot={false}
                  isAnimationActive={true}
                  animationDuration={GKD_RANGES.has(timeRange) ? 1500 : 1200}
                  animationEasing="ease-in-out"
                />
                {isLakeLevelWithRef && lakeLevelAverage && (
                  <ReferenceLine
                    y={0}
                    stroke="#f97316"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                )}
                {isAdminMode && dataType === "temperature" && chartData.some((d) => d.rawValue != null) && (
                  <Area
                    type="monotone"
                    dataKey="rawValue"
                    stroke="#f97316"
                    fill="none"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                    legendType="none"
                  />
                )}
              </AreaChart>
            </ChartContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
