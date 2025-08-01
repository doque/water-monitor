"use client"

import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts"
import type { RiverData, AlertLevel } from "@/utils/water-data"
import type { TimeRangeOption } from "@/components/river-data/time-range-select"
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
const CustomTooltip = ({ active, payload, label, dataType, isLake }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    // Get the appropriate unit based on data type
    let unit = ""
    let valueFormatted = ""

    switch (dataType) {
      case "level":
        unit = "cm"
        valueFormatted = payload[0].value.toString()
        break
      case "temperature":
        unit = "°C"
        valueFormatted = Number.parseFloat(payload[0].value.toString()).toFixed(1)
        break
      case "flow":
        unit = "m³/s"
        valueFormatted = Number.parseFloat(payload[0].value.toString()).toFixed(2)
        break
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
const formatYAxisTick = (value) => {
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

export function RiverChart({ river, dataType, timeRange, isMobile, isAdminMode = false }: RiverChartProps) {
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

  // Helper function to get data points for time range - updated for lakes
  const getDataPointsForTimeRange = useCallback(
    (timeRange: TimeRangeOption): number => {
      // For lakes, calculate based on time range
      if (isLake) {
        const lakeDataPoints = {
          "1w": 7, // 1 week = 7 days
          "2w": 14, // 2 weeks = 14 days
          "1m": 30, // 1 month = 30 days
          "2m": 60, // 2 months = 60 days
          "6m": 180, // 6 months = 180 days (Spitzingsee only)
        }
        return lakeDataPoints[timeRange] || 30 // Default to 30 days
      }

      // For rivers, use original logic
      const riverDataPoints = {
        "1h": 4,
        "2h": 8,
        "6h": 24,
        "12h": 48,
        "24h": 96,
        "48h": 192,
        "1w": 672,
      }
      return riverDataPoints[timeRange] || 96
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
      const dataPoints = {
        "1h": 4, // 1 hour × 4 data points per hour (15-minute intervals)
        "2h": 8, // 2 hours × 4 data points per hour
        "6h": 24, // 6 hours × 4 data points per hour
        "12h": 48, // 12 hours × 4 data points per hour
        "24h": 96, // 24 hours × 4 data points per hour
        "48h": 192, // 48 hours × 4 data points per hour
        "1w": 672, // 7 days × 24 hours × 4 data points per hour
      }

      filteredData = filteredData.slice(0, dataPoints[timeRange])

      // For longer time ranges: reduce data points to improve display
      if (timeRange === "1w" && filteredData.length > 100) {
        const step = Math.ceil(filteredData.length / 100)
        filteredData = filteredData.filter((_, index) => index % step === 0)
      }

      // Reverse to show oldest to newest
      return filteredData.reverse().map((point) => {
        // For longer time ranges (> 48h) we show date and time
        const dateParts = point.date ? point.date.split(" ") : ["", ""]
        const timePart = dateParts.length > 1 ? dateParts[1].substring(0, 5) : "" // Extract HH:MM
        const datePart = dateParts[0].substring(0, 5) // Extract DD.MM.

        // For longer time ranges we keep date and time separate for the custom tick component
        const label = isLongTimeRange
          ? `${datePart} ${timePart}` // Keep date and time separate for custom tick
          : timePart // Only "HH:MM" for shorter time ranges

        return {
          ...mapper(point),
          time: timePart,
          label: label,
          fullDate: point.date, // Full date for tooltip
        }
      })
    },
    [isLake, getDataPointsForTimeRange],
  )

  // Memoize the trend display for the chart header
  const chartTrendDisplay = useMemo(() => {
    try {
      if (!river) return null
      return formatTrendForTimeRange(river, dataType, timeRange)
    } catch (error) {
      console.error("Error calculating chart trend:", error)
      return null
    }
  }, [river, dataType, timeRange])

  // Calculate Y-axis domain with baseline at 0 - with proper null checks
  const yAxisDomain = useMemo(() => {
    let data: number[] = []

    if (!river || !river.history) {
      return [0, 10] // Default domain for empty data
    }

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

    if (data.length === 0) return [0, 10] // Default domain for empty data

    const min = Math.min(...data)
    const max = Math.max(...data)

    // Always baseline to 0 for the minimum
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
  }, [river, dataType, timeRange, getDataPointsForTimeRange, isLake])

  // Calculate the optimal number of ticks for the Y-axis
  const optimalTickCount = useMemo(() => {
    if (yAxisDomain[0] === "auto" || yAxisDomain[1] === "auto") return 5

    const min = yAxisDomain[0] as number
    const max = yAxisDomain[1] as number
    const range = max - min

    // For small ranges, use fewer ticks to avoid duplicates
    if (range <= 10) return 5
    if (range <= 20) return 6

    // For larger ranges, use more ticks
    return 7
  }, [yAxisDomain])

  // Prepare chart data based on data type - with stable dependencies
  const chartData = useMemo(() => {
    // Safety check for river data
    if (!river || !river.history) {
      return createPlaceholderData(dataType)
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
  }, [river, dataType, timeRange, prepareChartData])

  // Calculate the interval for the X-axis based on time range and device type - updated for new lake time ranges
  const xAxisInterval = useMemo(() => {
    if (isLake) {
      const dataLength = chartData.length

      // Adjust intervals based on time range for lakes
      if (timeRange === "6m") {
        // 6 months: show fewer labels
        return isMobile ? Math.max(1, Math.floor(dataLength / 6)) : Math.max(1, Math.floor(dataLength / 12))
      } else if (timeRange === "2m") {
        // 2 months: moderate number of labels
        return isMobile ? Math.max(1, Math.floor(dataLength / 8)) : Math.max(1, Math.floor(dataLength / 10))
      } else if (timeRange === "1m") {
        // 1 month: more labels
        return isMobile ? Math.max(1, Math.floor(dataLength / 6)) : Math.max(1, Math.floor(dataLength / 8))
      } else {
        // 1-2 weeks: show most labels
        return isMobile ? Math.max(1, Math.floor(dataLength / 4)) : Math.max(1, Math.floor(dataLength / 6))
      }
    }

    // Original logic for rivers
    const isLongTimeRange = timeRange === "1w"
    const dataLength = chartData.length

    if (isMobile) {
      switch (timeRange) {
        case "1h":
          return 0 // Mobile: Every 15 minutes (show all)
        case "2h":
          return 1 // Mobile: Every 30 minutes
        case "6h":
          return 5 // Mobile: Every 1.5 hours (show more)
        case "12h":
          return 11 // Mobile: Every 3 hours (show more)
        case "24h":
          return 23 // Mobile: Every 6 hours (show more)
        case "48h":
          return 47 // Mobile: Every 12 hours (show more)
        default:
          return isLongTimeRange
            ? Math.floor(dataLength / 6) // Mobile: More labels for longer time ranges
            : Math.floor(dataLength / 7)
      }
    } else {
      switch (timeRange) {
        case "1h":
          return 0 // Desktop: Every 15 minutes
        case "2h":
          return 1 // Desktop: Every 30 minutes
        case "6h":
          return 3 // Desktop: Every 1 hour
        case "12h":
          return 7 // Desktop: Every 2 hours
        case "24h":
          return 11 // Desktop: Every 3 hours
        case "48h":
          return 23 // Desktop: Every 6 hours
        default:
          return isLongTimeRange
            ? Math.floor(dataLength / 8) // Desktop: Fewer labels for longer time ranges
            : Math.floor(dataLength / 10)
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
        <div className="h-[300px] w-full" ref={chartContainerRef}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
              width={chartWidth > 0 ? chartWidth : undefined}
              height={chartHeight > 0 ? chartHeight : undefined}
            >
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartConfig.stroke} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={chartConfig.stroke} stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(158, 158, 158, 0.2)" />
              <XAxis
                dataKey={isLake ? "time" : isLongTimeRange ? "label" : "time"}
                tick={(props) => <CustomXAxisTick {...props} isLongTimeRange={isLongTimeRange && !isLake} />}
                interval={xAxisInterval}
                height={isLongTimeRange && !isLake ? 50 : 30} // Normal height for lakes
                stroke="currentColor"
                allowDataOverflow={false}
              />
              <YAxis
                domain={yAxisDomain}
                tickCount={optimalTickCount}
                tickFormatter={formatYAxisTick}
                tick={{ fontSize: 10 }}
                width={30}
                stroke="currentColor"
                allowDecimals={false}
                allowDataOverflow={false}
              />
              {!isMobile && (
                <Tooltip
                  content={(props) => <CustomTooltip {...props} dataType={dataType} isLake={isLake} />}
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
                activeDot={{ r: 4, stroke: chartConfig.stroke, strokeWidth: 1, fill: "#fff" }}
                dot={false}
                // Re-enabled smooth animations for chart transitions
                isAnimationActive={true}
                animationDuration={800}
                animationEasing="ease-in-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
