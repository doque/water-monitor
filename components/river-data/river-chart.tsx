"use client"

import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine } from "recharts"
import type { RiverData, AlertLevel } from "@/utils/water-data"
import type { TimeRangeOption } from "@/components/river-data/time-range-select"
import { GKD_RANGES, timeRangeDurationDays } from "@/components/river-data/time-range-select"
import type { GkdHistory } from "@/hooks/use-gkd-data"
import type { GkdDataPoint } from "@/app/api/gkd/route"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatTrendForTimeRange } from "@/utils/formatters"
import { useState, useMemo, useCallback, useEffect, useRef } from "react"

export type DataType = "level" | "temperature" | "flow"

interface RiverChartProps {
  river: RiverData
  dataType: DataType
  timeRange: TimeRangeOption
  isMobile: boolean
  isAdminMode?: boolean
  extendedHistory?: GkdHistory | null
  isGkdLoading?: boolean
}

// --- GKD helpers ---

function smoothGkdPoints(points: GkdDataPoint[], timeRange: TimeRangeOption): GkdDataPoint[] {
  // Target ~50-80 chart points regardless of input density
  // GKD data can be daily (rivers) or 15-min (lakes), so compute stride dynamically
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
  const win = Math.max(1, stride) // window = stride for balanced smoothing
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
  // date is "DD.MM.YYYY 00:00" or "DD.MM.YYYY"
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
  // Find actual latest timestamp — don't assume sort order
  let latestTimestamp = 0
  for (const p of points) {
    if (p.timestamp > latestTimestamp) latestTimestamp = p.timestamp
  }
  const cutoff = latestTimestamp - days * 24 * 60 * 60 * 1000
  const filtered = points.filter(p => p.timestamp >= cutoff)
  // Ensure oldest-first for chart rendering
  filtered.sort((a, b) => a.timestamp - b.timestamp)
  return filtered
}

function prepareGkdData(points: GkdDataPoint[], timeRange: TimeRangeOption, lakeLevelAverage?: number) {
  const filtered = filterGkdByTimeRange(points, timeRange)
  const smoothed = smoothGkdPoints(filtered, timeRange)
  return smoothed.map(p => {
    const label = formatGkdLabel(p.date, timeRange)
    // For lake levels, convert to cm deviation from average
    const value = lakeLevelAverage
      ? Math.round((p.value - lakeLevelAverage) * 100)  // cm from average
      : p.value
    return { value, absoluteValue: p.value, time: label, label, fullDate: p.date }
  })
}

// Add proper TypeScript interfaces for tooltip and tick components
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
  lakeLevelAverage?: number // 24-month average for lake levels
  // Allow additional props from Recharts
  [key: string]: unknown
}

interface CustomXAxisTickProps {
  x?: number
  y?: number
  payload?: {
    value: string
  }
  isLongTimeRange?: boolean
}

// Custom tooltip component with proper typing
const CustomTooltip = ({ active, payload, label, dataType, isLake, lakeLevelAverage }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    // Get the appropriate unit based on data type
    let unit = ""
    let valueFormatted = ""

    switch (dataType) {
      case "level":
        if (isLake && lakeLevelAverage) {
          // Lake levels are already in cm deviation from average
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
        // Max 2 decimal places, but drop trailing zeros
        valueFormatted = v % 1 === 0 ? v.toString() : Number.parseFloat(v.toString()).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
        break
      }
    }

    // Format the date from the fullDate property
    const fullDate = payload[0].payload.fullDate || ""
    let formattedDate = ""

    if (fullDate) {
      const dateParts = fullDate.split(" ")
      if (isLake || dateParts.length === 1) {
        // For lakes (daily data), show only the date without time
        formattedDate = dateParts[0]
      } else if (dateParts.length >= 2) {
        // For rivers (hourly data), show date and time
        const dateComponent = dateParts[0].split(".").slice(0, 2).join(".")
        const timeComponent = dateParts[1].substring(0, 5) // Get HH:MM
        formattedDate = `${dateComponent} ${timeComponent}`
      } else {
        formattedDate = dateParts[0]
      }
    }

    return (
      <div className="bg-white dark:bg-gray-800 px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded shadow-md">
        <p className="text-gray-600 dark:text-gray-300">{formattedDate}</p>
        <p className="font-medium text-gray-800 dark:text-gray-200">
          {valueFormatted} {unit}
        </p>
      </div>
    )
  }

  return null
}

// Custom Y-axis tick for lake levels - shows "Mittel" with value at 0, cm deviations elsewhere
interface CustomYAxisTickProps {
  x?: number
  y?: number
  payload?: { value: number }
  lakeLevelAverage?: number
}

const CustomLakeLevelYAxisTick = ({ x, y, payload, lakeLevelAverage }: CustomYAxisTickProps) => {
  if (!payload || lakeLevelAverage === undefined || lakeLevelAverage === null) return null

  const value = Math.round(payload.value)

  // Skip ticks too close to 0 (within ±8cm) to avoid overlap with the Mittel label
  if (value !== 0 && Math.abs(value) <= 8) {
    return null
  }

  if (value === 0) {
    // Show "24M Mittel" with value on two lines
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={-5} y={-6} textAnchor="end" fill="#f97316" fontSize={9} fontWeight={500}>
          24M Mittel
        </text>
        <text x={-5} y={6} textAnchor="end" fill="#f97316" fontSize={9}>
          {lakeLevelAverage.toFixed(2)}m
        </text>
      </g>
    )
  }

  // Show +X or -X for other ticks
  const label = value > 0 ? `+${value}` : `${value}`
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={-5} y={4} textAnchor="end" fill="currentColor" fontSize={10}>
        {label}
      </text>
    </g>
  )
}

// Custom tick component for X-axis with proper typing
const CustomXAxisTick = ({ x, y, payload, isLongTimeRange }: CustomXAxisTickProps) => {
  if (!payload?.value) return null

  if (isLongTimeRange) {
    // For long time ranges, split the label into date and time
    const parts = payload.value.split(" ")
    if (parts.length === 2) {
      const date = parts[0]
      const time = parts[1]

      return (
        <g transform={`translate(${x},${y})`}>
          <text x={0} y={0} dy={16} textAnchor="middle" fill="currentColor" fontSize={10}>
            {date}
          </text>
          <text x={0} y={0} dy={30} textAnchor="middle" fill="currentColor" fontSize={10}>
            {time}
          </text>
        </g>
      )
    }
  }

  // For short time ranges or fallback
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="middle" fill="currentColor" fontSize={10}>
        {payload.value}
      </text>
    </g>
  )
}

// Custom Y-axis tick formatter to avoid duplicates and ensure integer values
const formatYAxisTick = (value: number) => {
  return Math.round(value).toString()
}

// Get unit label for Y-axis based on data type
const getYAxisUnit = (dataType: DataType): string => {
  switch (dataType) {
    case "level":
      return "cm"
    case "temperature":
      return "°C"
    case "flow":
      return "m³/s"
    default:
      return ""
  }
}

// Create a placeholder data generator for empty charts
const createPlaceholderData = (dataType: DataType) => {
  const now = new Date()
  const data = []

  // Create 5 placeholder points
  for (let i = 0; i < 5; i++) {
    const date = new Date(now)
    date.setHours(now.getHours() - i)

    const formattedDate = `${date.getDate().toString().padStart(2, "0")}.${(date.getMonth() + 1).toString().padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`

    // Default values based on data type
    let value = 0
    switch (dataType) {
      case "flow":
        value = 10 - i * 0.5 // Decreasing flow values
        break
      case "level":
        value = 100 - i * 5 // Decreasing level values
        break
      case "temperature":
        value = 15 - i * 0.2 // Decreasing temperature values
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

export function RiverChart({ river, dataType, timeRange, isMobile, isAdminMode = false, extendedHistory, isGkdLoading = false }: RiverChartProps) {
  // All hooks must be called at the top level, before any conditional returns
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [chartHeight, setChartHeight] = useState(300)
  const [chartWidth, setChartWidth] = useState(0)
  const chartContainerRef = useRef<HTMLDivElement>(null)

  // Check if this is a lake for special handling
  const isLake = river?.isLake || false
  const isSpitzingsee = river?.name === "Spitzingsee"
  const isSchliersee = river?.name === "Schliersee"
  const isTegernsee = river?.name === "Tegernsee"

  // Effect to detect dark mode
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark")
    setIsDarkMode(isDark)

    // Optional: Listen for theme changes
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

  // Effect to measure container dimensions
  useEffect(() => {
    if (!chartContainerRef.current) return

    const updateDimensions = () => {
      if (chartContainerRef.current) {
        setChartWidth(chartContainerRef.current.clientWidth)
        setChartHeight(chartContainerRef.current.clientHeight)
      }
    }

    // Initial measurement
    updateDimensions()

    // Set up resize observer
    const resizeObserver = new ResizeObserver(updateDimensions)
    resizeObserver.observe(chartContainerRef.current)

    return () => {
      if (chartContainerRef.current) {
        resizeObserver.unobserve(chartContainerRef.current)
      }
    }
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

  // Prepare chart data for the given time range - updated for new lake time ranges
  const prepareChartData = useCallback(
    (rawData: any[], timeRange: TimeRangeOption, mapper: (point: any) => any) => {
      // Safety check for empty data
      if (!rawData || rawData.length === 0) {
        return []
      }

      let filteredData = [...rawData]

      if (isLake) {
        // For lakes, filter based on the selected time range
        const maxDataPoints = getDataPointsForTimeRange(timeRange)

        // Take the most recent data points (first X elements since data is sorted newest first)
        filteredData = filteredData.slice(0, maxDataPoints)

        // Reverse to show oldest to newest chronologically in chart
        return filteredData.reverse().map((point) => {
          // For lakes, format dates as day labels (no hours)
          const dateParts = point.date ? point.date.split(" ") : [""]
          const datePart = dateParts[0] // Get DD.MM.YYYY or DD.MM

          // Extract just DD.MM for display
          const dayMonth = datePart.includes(".") ? datePart.split(".").slice(0, 2).join(".") : datePart

          return {
            ...mapper(point),
            time: dayMonth, // Use day.month format for lakes
            label: dayMonth, // Same for both short and long display
            fullDate: point.date, // Full date for tooltip
          }
        })
      }

      // Original logic for rivers
      const isLongTimeRange = timeRange === "1w"

      // Filter based on selected time range
      const dataPoints: Partial<Record<TimeRangeOption, number>> = {
        "1h":  4,
        "6h":  24,
        "12h": 48,
        "24h": 96,
        "2d":  192,
        "1w":  672,
      }

      filteredData = filteredData.slice(0, dataPoints[timeRange] ?? 96)

      // For longer time ranges: reduce data points to improve display
      if (timeRange === "1w" && filteredData.length > 100) {
        const step = Math.ceil(filteredData.length / 100)
        filteredData = filteredData.filter((_, index) => index % step === 0)
      }

      // Reverse to show oldest to newest
      return filteredData.reverse().map((point) => {
        const dateParts = point.date ? point.date.split(" ") : ["", ""]
        const timePart = dateParts.length > 1 ? dateParts[1].substring(0, 5) : ""
        const datePart = dateParts[0].substring(0, 5) // "DD.MM"

        // For GKD ranges show date label; for 1w show date+time; otherwise HH:MM
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

  // Memoize the trend display for the chart header
  // Hide trend for GKD ranges — server data doesn't span far enough for a meaningful comparison
  const chartTrendDisplay = useMemo(() => {
    try {
      if (!river || GKD_RANGES.has(timeRange)) return null
      return formatTrendForTimeRange(river, dataType, timeRange)
    } catch (error) {
      console.error("Error calculating chart trend:", error)
      return null
    }
  }, [river, dataType, timeRange])

  // Calculate Y-axis domain with baseline at 0 - with proper null checks
  const yAxisDomain = useMemo(() => {
    let data: number[] = []
    const pegelnullpunkt = river?.pegelnullpunkt
    const isLakeLevelWithRef = isLake && dataType === "level" && pegelnullpunkt
    // For lakes with gkdLevelSlug, level data comes from GKD for ALL time ranges
    const useLakeLevelFromGkd = isLake && dataType === "level" && river?.gkdLevelSlug

    if (!river || !river.history) {
      return [0, 10] // Default domain for empty data
    }

    // Use GKD extended history for long ranges, or for lake levels (all ranges)
    if (extendedHistory && (GKD_RANGES.has(timeRange) || useLakeLevelFromGkd)) {
      const gkdPoints =
        dataType === "temperature" ? extendedHistory.temperatures :
        dataType === "level"       ? extendedHistory.levels :
        dataType === "flow"        ? extendedHistory.flows : undefined
      if (gkdPoints && gkdPoints.length > 0) {
        const filtered = filterGkdByTimeRange(gkdPoints, timeRange)
        // Lake level data from GKD is already in m NHN, no conversion needed
        data = smoothGkdPoints(filtered, timeRange).map(p => p.value).filter(v => !isNaN(v))
      }
    }

    if (data.length === 0) {
      if (isLake) {
        // For lakes, use filtered data based on time range
        if (dataType === "temperature" && river.history.temperatures?.length > 0) {
          const maxDataPoints = getDataPointsForTimeRange(timeRange)
          data = river.history.temperatures
            .slice(0, maxDataPoints)
            .map((point) => point.temperature)
            .filter((value) => typeof value === "number")
        }
      } else {
        // Get the appropriate data array based on data type and time range for rivers
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

    if (data.length === 0) return [0, 10] // Default domain for empty data

    const min = Math.min(...data)
    const max = Math.max(...data)

    // For lake levels, data is now in cm deviation from average
    // Y-axis based on actual data range with some padding, always including 0 (the average)
    if (isLakeLevelWithRef && extendedHistory?.levels && extendedHistory.levels.length > 0) {
      const avgSum = extendedHistory.levels.reduce((acc, p) => acc + p.value, 0)
      const avgLevel = avgSum / extendedHistory.levels.length
      // Filter by time range first, then convert to cm deviations
      const filtered = filterGkdByTimeRange(extendedHistory.levels, timeRange)
      const deviations = filtered.map(p => Math.round((p.value - avgLevel) * 100))
      const minDev = Math.min(...deviations)
      const maxDev = Math.max(...deviations)
      // Add 20% padding, round to nearest 10cm
      const range = maxDev - minDev
      const padding = Math.max(10, range * 0.2)
      let domainMin = Math.floor((minDev - padding) / 10) * 10
      let domainMax = Math.ceil((maxDev + padding) / 10) * 10
      // Ensure 0 (the average) is included in the domain
      if (domainMin > 0) domainMin = -10
      if (domainMax < 0) domainMax = 10
      return [domainMin, domainMax]
    }

    // Always baseline to 0 for the minimum (rivers, temperatures)
    const baselineMin = 0

    // Use relative padding based on max value instead of flat 5
    let padding: number
    if (max < 10) {
      padding = 2
    } else if (max <= 30) {
      padding = Math.max(2, max * 0.15) // 15% for values 10-30
    } else {
      padding = Math.max(5, max * 0.1) // 10% for larger values, minimum 5
    }

    const newMax = Math.ceil(max + padding)

    return [baselineMin, newMax]
  }, [river, dataType, timeRange, getDataPointsForTimeRange, isLake, extendedHistory])

  // Check if showing lake level in m NHN
  const isLakeLevelWithRef = isLake && dataType === "level" && river?.pegelnullpunkt

  // Calculate 24-month average for lake levels (used as reference line)
  const lakeLevelAverage = useMemo(() => {
    if (isLakeLevelWithRef && extendedHistory?.levels && extendedHistory.levels.length > 0) {
      const sum = extendedHistory.levels.reduce((acc, p) => acc + p.value, 0)
      return sum / extendedHistory.levels.length
    }
    return null
  }, [isLakeLevelWithRef, extendedHistory?.levels])

  // Calculate the optimal number of ticks for the Y-axis
  const optimalTickCount = useMemo(() => {
    const min = yAxisDomain[0] as number
    const max = yAxisDomain[1] as number
    const range = max - min

    // For lake levels in m NHN (small range like 0.5-1.5m), use fewer ticks
    if (isLakeLevelWithRef) return 5

    // For small ranges, use fewer ticks to avoid duplicates
    if (range <= 10) return 5
    if (range <= 20) return 6

    // For larger ranges, use more ticks
    return 7
  }, [yAxisDomain, isLakeLevelWithRef])

  // Generate explicit tick values for lake levels (always includes 0 for the Mittel label)
  const lakeLevelTicks = useMemo(() => {
    if (!isLakeLevelWithRef) return undefined
    const min = yAxisDomain[0] as number
    const max = yAxisDomain[1] as number
    const range = max - min
    // Choose step size based on range
    const step = range <= 40 ? 10 : range <= 80 ? 20 : range <= 150 ? 30 : 50
    const ticks: number[] = []
    // Add ticks from min to max, ensuring 0 is included
    for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
      ticks.push(v)
    }
    // Ensure 0 is in the ticks
    if (!ticks.includes(0)) {
      ticks.push(0)
      ticks.sort((a, b) => a - b)
    }
    return ticks
  }, [isLakeLevelWithRef, yAxisDomain])

  // Y-axis tick formatter - shows cm deviation for lake levels, with average value at 0
  const yAxisTickFormatter = useCallback((value: number) => {
    if (isLakeLevelWithRef && lakeLevelAverage) {
      const rounded = Math.round(value)
      // Skip ticks too close to 0 (within ±10cm) to avoid overlap with Mittel label
      if (rounded !== 0 && Math.abs(rounded) <= 10) {
        return ""
      }
      if (rounded === 0) {
        // Show "Mittel" with value - use newline for multiline
        return `Mittel\n${lakeLevelAverage.toFixed(2)}m`
      }
      // Show as +X or -X for other ticks
      return rounded > 0 ? `+${rounded}` : `${rounded}`
    }
    return Math.round(value).toString()
  }, [isLakeLevelWithRef, lakeLevelAverage])

  // Prepare chart data based on data type - with stable dependencies
  const chartData = useMemo(() => {
    // Safety check for river data
    if (!river || !river.history) {
      return createPlaceholderData(dataType)
    }

    const pegelnullpunkt = river.pegelnullpunkt
    const isLakeLevelWithRef = isLake && dataType === "level" && pegelnullpunkt
    // For lakes with gkdLevelSlug, level data comes from GKD for ALL time ranges
    const useLakeLevelFromGkd = isLake && dataType === "level" && river.gkdLevelSlug

    // GKD extended history takes priority for long time ranges, or for lake levels (all ranges)
    if (extendedHistory && (GKD_RANGES.has(timeRange) || useLakeLevelFromGkd)) {
      const gkdPoints =
        dataType === "temperature" ? extendedHistory.temperatures :
        dataType === "level"       ? extendedHistory.levels :
        dataType === "flow"        ? extendedHistory.flows : undefined
      if (gkdPoints && gkdPoints.length > 0) {
        // For lake levels, pass average to convert to cm deviation
        const prepared = prepareGkdData(gkdPoints, timeRange, isLakeLevelWithRef ? (lakeLevelAverage ?? undefined) : undefined)
        if (prepared.length > 0) return prepared
        // If filtering emptied the data, fall through to server data
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

    // If we still have no data, use placeholder data
    if (data.length === 0) {
      return createPlaceholderData(dataType)
    }

    return data
  }, [river, dataType, timeRange, prepareChartData, extendedHistory, isLake, lakeLevelAverage])

  // Calculate the interval for the X-axis based on time range and device type
  const xAxisInterval = useMemo(() => {
    const dataLength = chartData.length

    // GKD daily data ranges — target ~5 labels on mobile, ~8 on desktop
    if (GKD_RANGES.has(timeRange)) {
      const target = isMobile ? 4 : 7
      return Math.max(1, Math.floor(dataLength / target) - 1)
    }

    if (isLake) {
      // Short lake ranges (server data, daily points)
      return isMobile ? Math.max(1, Math.floor(dataLength / 4)) : Math.max(1, Math.floor(dataLength / 6))
    }

    // Rivers — 15-min interval data
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

  // Get chart configuration - enhanced with situation-based colors for Bayern.de lakes
  const chartConfig = useMemo(() => {
    let stroke, fill

    if (isAdminMode) {
      // Special handling for Schliersee and Tegernsee in admin mode
      if ((isSchliersee || isTegernsee) && dataType === "temperature") {
        // Get the most recent temperature data point to check situation - with null check
        const latestTempData = river?.history?.temperatures?.[0]
        const situation = latestTempData?.situation?.toLowerCase() || ""

        if (situation.includes("neuer höchstwert")) {
          // Red for "neuer Höchstwert" (new maximum value)
          stroke = "#dc2626" // Red-600
          fill = isDarkMode ? "rgba(220, 38, 38, 0.4)" : "#fca5a5" // Red-300
        } else if (situation.includes("hoch")) {
          // Yellow/Amber for "hoch" (high)
          stroke = "#d97706" // Amber-600
          fill = isDarkMode ? "rgba(217, 119, 6, 0.4)" : "#fcd34d" // Amber-300
        } else {
          // Normal blue color for other situations
          stroke = "#2563eb" // Blue-600
          fill = isDarkMode ? "rgba(37, 99, 235, 0.3)" : "#dbeafe" // Blue-100
        }
      } else if (isSpitzingsee) {
        // Spitzingsee always uses blue color, even in admin mode
        stroke = "#2563eb" // Blue-600
        fill = isDarkMode ? "rgba(37, 99, 235, 0.3)" : "#dbeafe" // Blue-100
      } else {
        // Admin mode for rivers: Use flow-based alert level colors
        const alertLevel: AlertLevel = river?.alertLevel || "normal"

        switch (alertLevel) {
          case "alert":
            stroke = "#dc2626" // Red-600
            fill = isDarkMode ? "rgba(220, 38, 38, 0.4)" : "#fca5a5" // Red-300
            break
          case "warning":
            stroke = "#d97706" // Amber-600
            fill = isDarkMode ? "rgba(217, 119, 6, 0.4)" : "#fcd34d" // Amber-300
            break
          case "normal":
          default:
            stroke = "#2563eb" // Blue-600
            fill = isDarkMode ? "rgba(37, 99, 235, 0.3)" : "#dbeafe" // Blue-100
        }
      }
    } else {
      // Standard mode: Always use blue with lighter colorful fill (100-level)
      stroke = "#2563eb" // Blue-600
      fill = isDarkMode ? "rgba(37, 99, 235, 0.3)" : "#dbeafe" // Blue-100
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
        // For lakes with gkdLevelSlug, level data comes from GKD (extendedHistory)
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

  if (!hasAnyDataForCurrentType) {
    return (
      <Card>
        <CardHeader className="pb-2 p-3 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Entwicklung</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            <div className="text-center">
              <p className="text-sm">Keine Daten verfügbar</p>
              <p className="text-xs mt-1">
                Für {dataType === "flow" ? "Abfluss" : dataType === "level" ? "Pegel" : "Temperatur"} sind derzeit
                keine Messwerte vorhanden.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Only show loading text if GKD is loading AND we have no server data to display as fallback
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

  // Render the chart with guaranteed rendering
  return (
    <Card>
      <CardHeader className="pb-2 p-3 sm:p-6">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base sm:text-lg">Entwicklung</CardTitle>
          {/* Show trend indicator for both rivers and lakes */}
          {chartTrendDisplay && <span className="text-sm font-normal">{chartTrendDisplay}</span>}
        </div>
      </CardHeader>
      <CardContent className="p-1 sm:p-3">
        <div className="h-[300px] w-full relative" ref={chartContainerRef}>
          {showGkdLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-sm text-muted-foreground animate-pulse">Daten werden geladen…</div>
            </div>
          )}
          <div className={`transition-opacity duration-700 ease-in-out h-full ${showGkdLoading ? "opacity-0" : "opacity-100"}`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
              width={chartWidth > 0 ? chartWidth : undefined}
              height={chartHeight > 0 ? chartHeight : undefined}
            >
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  {/* setting uniform 0.2 opacity across entire chart fill */}
                  <stop offset="5%" stopColor={chartConfig.stroke} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={chartConfig.stroke} stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(158, 158, 158, 0.2)" />
              <XAxis
                dataKey={isGkdRange || isLake ? "label" : isLongTimeRange ? "label" : "time"}
                tick={(props) => <CustomXAxisTick {...props} isLongTimeRange={isLongTimeRange && !isLake && !isGkdRange} />}
                interval={xAxisInterval}
                height={isLongTimeRange && !isLake && !isGkdRange ? 50 : 30}
                stroke="currentColor"
                allowDataOverflow={false}
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
              />
              {!isMobile && (
                <Tooltip
                  content={(props) => <CustomTooltip {...props} dataType={dataType} isLake={isLake} lakeLevelAverage={lakeLevelAverage ?? undefined} />}
                  cursor={{ stroke: "rgba(0, 0, 0, 0.2)", strokeWidth: 1, strokeDasharray: "3 3" }}
                  wrapperStyle={{ zIndex: 100 }}
                />
              )}
              <Area
                type="monotone"
                dataKey={chartConfig.dataKey}
                stroke={chartConfig.stroke}
                // Use gradient fill instead of solid color to prevent white-ish appearance on first render
                fill="url(#colorValue)"
                fillOpacity={1}
                strokeWidth={2}
                activeDot={false}
                dot={false}
                isAnimationActive={true}
                animationDuration={GKD_RANGES.has(timeRange) ? 1500 : 1200}
                animationEasing="ease-in-out"
              />
              {/* 24-month average reference line for lake levels (at 0 since data is deviation) */}
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
          </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
