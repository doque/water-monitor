"use client"

import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts"
import type { RiverData, AlertLevel } from "@/utils/water-data"
import type { TimeRangeOption } from "@/components/river-data/time-range-select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatTrendForTimeRange } from "@/utils/formatters"
import { useState, useEffect, useMemo, useCallback } from "react"

export type DataType = "level" | "temperature" | "flow"

interface RiverChartProps {
  river: RiverData
  dataType: DataType
  timeRange: TimeRangeOption
  isMobile: boolean
  isAdminMode?: boolean
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label, dataType }) => {
  if (active && payload && payload.length) {
    // Get the appropriate unit based on data type
    let unit = ""
    let valueFormatted = ""

    switch (dataType) {
      case "level":
        unit = "cm"
        valueFormatted = payload[0].value
        break
      case "temperature":
        unit = "°C"
        valueFormatted = Number.parseFloat(payload[0].value).toFixed(1)
        break
      case "flow":
        unit = "m³/s"
        valueFormatted = Number.parseFloat(payload[0].value).toFixed(2)
        break
    }

    // Format the date from the fullDate property (which is in format "DD.MM.YYYY HH:MM")
    const fullDate = payload[0].payload.fullDate || ""
    let formattedDate = ""

    if (fullDate) {
      const dateParts = fullDate.split(" ")
      if (dateParts.length >= 2) {
        // Extract DD.MM. from the date part
        const dateComponent = dateParts[0].split(".").slice(0, 2).join(".")
        const timeComponent = dateParts[1].substring(0, 5) // Get HH:MM
        formattedDate = `${dateComponent} ${timeComponent}`
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

// Custom tick component for X-axis to handle line breaks
const CustomXAxisTick = (props) => {
  const { x, y, payload, isLongTimeRange } = props

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

export function RiverChart({ river, dataType, timeRange, isMobile, isAdminMode = false }: RiverChartProps) {
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Memoize the trend display for the chart header
  const chartTrendDisplay = useMemo(() => {
    try {
      return formatTrendForTimeRange(river, dataType, timeRange)
    } catch (error) {
      console.error("Error calculating chart trend:", error)
      return null
    }
  }, [river, dataType, timeRange])

  // Check if this is Spitzingsee for debug display
  const isSpitzingsee = river?.name === "Spitzingsee"

  // Check for dark mode on mount and when theme changes - with proper cleanup
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(
        typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches,
      )
    }

    checkDarkMode()

    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      mediaQuery.addEventListener("change", checkDarkMode)

      return () => {
        mediaQuery.removeEventListener("change", checkDarkMode)
      }
    }
  }, [])

  // Helper function to get data points for time range - memoized
  const getDataPointsForTimeRange = useCallback(
    (timeRange: TimeRangeOption): number => {
      // Check if this is a lake (Spitzingsee) which has daily data instead of 15-minute intervals
      const isLake = river?.name === "Spitzingsee"

      if (isLake) {
        // For lakes with daily data, use different calculations
        // Fixed: Use the actual timeRange values instead of German labels
        const lakeDataPoints = {
          "1w": 7, // 7 days
          "2w": 14, // 14 days
          "4w": 28, // 28 days
          "3m": 90, // ~3 months
          "6m": 180, // ~6 months
        }
        return lakeDataPoints[timeRange] || 14 // Default to 2 weeks
      }

      // For rivers with 15-minute interval data
      const dataPoints = {
        "1h": 4,
        "2h": 8,
        "6h": 24,
        "12h": 48,
        "24h": 96,
        "48h": 192,
        "1w": 672,
      }
      return dataPoints[timeRange]
    },
    [river?.name],
  )

  // Calculate Y-axis domain based on data range - with stable dependencies
  const yAxisDomain = useMemo(() => {
    let data = []

    // Get the appropriate data array based on data type and time range
    if (dataType === "level") {
      data = river.history.levels.slice(0, getDataPointsForTimeRange(timeRange)).map((point) => point.level)
    } else if (dataType === "temperature") {
      data = river.history.temperatures.slice(0, getDataPointsForTimeRange(timeRange)).map((point) => point.temperature)
    } else if (dataType === "flow") {
      data = river.history.flows.slice(0, getDataPointsForTimeRange(timeRange)).map((point) => point.flow)
    }

    if (data.length === 0) return ["auto", "auto"]

    const min = Math.min(...data)
    const max = Math.max(...data)

    // If the range is very small, expand it to make changes more visible
    if (max - min < 5) {
      // For very small ranges, create a more visible scale
      const padding = Math.max(5, min * 0.05) // At least 5 units or 5% of the min value
      const newMin = Math.max(0, Math.floor(min - padding))
      const newMax = Math.ceil(max + padding)
      return [newMin, newMax]
    }

    // For normal ranges, add some padding
    const padding = (max - min) * 0.1 // 10% padding
    const newMin = Math.max(0, Math.floor(min - padding))
    const newMax = Math.ceil(max + padding)

    return [newMin, newMax]
  }, [river.history, dataType, timeRange, getDataPointsForTimeRange])

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

  // Prepare chart data for the given time range - memoized function
  const prepareChartData = useCallback(
    (rawData: any[], timeRange: TimeRangeOption, mapper: (point: any) => any) => {
      const isLake = river?.name === "Spitzingsee"
      const isLongTimeRange = timeRange === "1w" || (isLake && (timeRange === "3m" || timeRange === "6m"))

      // Get the number of data points to show based on time range
      const maxDataPoints = getDataPointsForTimeRange(timeRange)

      // For lakes (Spitzingsee), take the most recent X points
      // Data is already in reverse chronological order (newest first)
      let filteredData = rawData.slice(0, maxDataPoints)

      // For longer time ranges: reduce data points to improve display (but not for lakes since they're already daily)
      if (!isLake && timeRange === "1w" && filteredData.length > 100) {
        const step = Math.ceil(filteredData.length / 100)
        filteredData = filteredData.filter((_, index) => index % step === 0)
      }

      // Reverse to show oldest to newest (for chart display)
      return filteredData.reverse().map((point) => {
        // Check if this is daily data (Spitzingsee) by looking at the time component
        const dateParts = point.date.split(" ")
        const timePart = dateParts[1] ? dateParts[1].substring(0, 5) : "12:00" // Extract HH:MM or default
        const datePart = dateParts[0].substring(0, 5) // Extract DD.MM.

        // For daily data (like Spitzingsee), show only date without time
        const isDailyData = timePart === "12:00" // Daily data typically has noon timestamp

        // For longer time ranges we show date and time, for daily data we show only date
        const label = isLongTimeRange
          ? isDailyData
            ? datePart // Only date for daily data
            : `${datePart} ${timePart}` // Date and time for hourly data
          : timePart // Only "HH:MM" for shorter time ranges

        return {
          ...mapper(point),
          time: isDailyData ? datePart : timePart, // Use date for daily data, time for hourly
          label: label,
          fullDate: point.date, // Full date for tooltip
        }
      })
    },
    [river?.name, getDataPointsForTimeRange],
  )

  // Prepare chart data based on data type - with stable dependencies
  const chartData = useMemo(() => {
    let data: any[] = []

    if (dataType === "level" && river.history.levels.length > 0) {
      data = prepareChartData(river.history.levels, timeRange, (point) => ({
        ...point,
        value: point.level,
        unit: "cm",
        type: "Level",
      }))
    } else if (dataType === "temperature" && river.history.temperatures.length > 0) {
      data = prepareChartData(river.history.temperatures, timeRange, (point) => ({
        ...point,
        value: point.temperature,
        unit: "°C",
        type: "Temperature",
      }))
    } else if (dataType === "flow" && river.history.flows.length > 0) {
      data = prepareChartData(river.history.flows, timeRange, (point) => ({
        ...point,
        value: point.flow,
        unit: "m³/s",
        type: "Flow",
      }))
    }

    return data
  }, [river.history, dataType, timeRange, prepareChartData])

  // Calculate the interval for the X-axis based on time range and device type
  const xAxisInterval = useMemo(() => {
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
  }, [timeRange, chartData.length, isMobile])

  // Get chart configuration - with stable dependencies
  const chartConfig = useMemo(() => {
    let stroke, fill

    if (isAdminMode) {
      // Admin mode: Use flow-based alert level colors
      const alertLevel: AlertLevel = river.alertLevel || "normal"

      switch (alertLevel) {
        case "alert":
          stroke = "#dc2626" // Red-600
          fill = isDarkMode ? "rgba(220, 38, 38, 0.2)" : "#fee2e2" // Red-100 for light mode
          break
        case "warning":
          stroke = "#d97706" // Amber-600
          fill = isDarkMode ? "rgba(217, 119, 6, 0.2)" : "#fef3c7" // Amber-100 for light mode
          break
        case "normal":
        default:
          stroke = "#16a34a" // Green-600
          fill = isDarkMode ? "rgba(22, 163, 74, 0.2)" : "#dcfce7" // Green-100 for light mode
      }
    } else {
      // Standard mode: Always use blue
      stroke = "#2563eb" // Blue-600
      fill = isDarkMode ? "rgba(37, 99, 235, 0.2)" : "#dbeafe" // Blue-100 for light mode
    }

    return {
      stroke,
      fill,
      dataKey: "value",
    }
  }, [river.alertLevel, isDarkMode, isAdminMode])

  const isLongTimeRange = timeRange === "1w"

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2 p-3 sm:p-6">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base sm:text-lg">Entwicklung</CardTitle>
            {chartTrendDisplay && <span className="text-sm font-normal">{chartTrendDisplay}</span>}
          </div>
        </CardHeader>
        <CardContent className="p-3 flex items-center justify-center h-[300px]">
          <div className="text-muted-foreground">Keine Daten für den ausgewählten Typ verfügbar</div>
        </CardContent>
      </Card>
    )
  }

  // Show normal chart for all rivers including Spitzingsee
  return (
    <Card>
      <CardHeader className="pb-2 p-3 sm:p-6">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base sm:text-lg">Entwicklung</CardTitle>
          {chartTrendDisplay && <span className="text-sm font-normal">{chartTrendDisplay}</span>}
        </div>
      </CardHeader>
      <CardContent className="p-1 sm:p-3">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(158, 158, 158, 0.2)" />
              <XAxis
                dataKey={isLongTimeRange ? "label" : "time"}
                tick={(props) => <CustomXAxisTick {...props} isLongTimeRange={isLongTimeRange} />}
                interval={xAxisInterval}
                height={isLongTimeRange ? 50 : 30} // Increased height for line breaks
                stroke="currentColor"
              />
              <YAxis
                domain={yAxisDomain}
                tickCount={optimalTickCount}
                tickFormatter={formatYAxisTick}
                tick={{ fontSize: 10 }}
                width={30}
                stroke="currentColor"
                allowDecimals={false}
              />
              {!isMobile && (
                <Tooltip
                  content={(props) => <CustomTooltip {...props} dataType={dataType} />}
                  cursor={{ stroke: "rgba(0, 0, 0, 0.2)", strokeWidth: 1, strokeDasharray: "3 3" }}
                  wrapperStyle={{ zIndex: 100 }}
                />
              )}
              <Area
                type="monotone"
                dataKey={chartConfig.dataKey}
                stroke={chartConfig.stroke}
                fill={chartConfig.fill}
                strokeWidth={2}
                activeDot={{ r: 4, stroke: chartConfig.stroke, strokeWidth: 1, fill: "#fff" }}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
