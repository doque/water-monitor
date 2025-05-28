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
        valueFormatted = Number.parseFloat(payload[0].value).toFixed(1)
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

export function RiverChart({ river, dataType, timeRange, isMobile }: RiverChartProps) {
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
  const getDataPointsForTimeRange = useCallback((timeRange: TimeRangeOption): number => {
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
  }, [])

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
  const prepareChartData = useCallback((rawData: any[], timeRange: TimeRangeOption, mapper: (point: any) => any) => {
    let filteredData = [...rawData]
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
      const dateParts = point.date.split(" ")
      const timePart = dateParts[1].substring(0, 5) // Extract HH:MM
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
  }, [])

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

  // Get chart configuration - ALWAYS based on flow alert level - with stable dependencies
  const chartConfig = useMemo(() => {
    // Always use the flow-based alert level for chart colors, regardless of current data type
    const alertLevel: AlertLevel = river.alertLevel || "normal"

    // Define colors based on flow alert level
    let stroke, fill

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

    return {
      stroke,
      fill,
      dataKey: "value",
      alertLevel,
    }
  }, [river.alertLevel, isDarkMode])

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
