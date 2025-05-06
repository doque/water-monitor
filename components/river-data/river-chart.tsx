"use client"

import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts"
import type { RiverData } from "@/utils/water-data"
import type { TimeRangeOption } from "@/components/river-data/time-range-select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatTrendForTimeRange } from "@/utils/formatters"
import { useState, useEffect } from "react"

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

export function RiverChart({ river, dataType, timeRange, isMobile }: RiverChartProps) {
  const [forceUpdate, setForceUpdate] = useState(false)

  // Determine alert level based on data type and current value
  const getAlertLevel = () => {
    // Default to normal if no data
    if (!river.current) return "normal"

    // For flow data
    if (dataType === "flow" && river.current.flow) {
      const flowValue = river.current.flow.flow
      const flowChange = river.changes.flowPercentage || 0

      // High alert for large increases or very high flow
      if (flowChange > 50 || flowValue > 100) return "alert"
      // Warning for moderate increases
      if (flowChange > 15 || flowValue > 50) return "warning"
      return "normal"
    }

    // For level data
    if (dataType === "level" && river.current.level) {
      const levelValue = river.current.level.level
      const levelChange = river.changes.levelPercentage || 0

      // High alert for large increases or very high levels
      if (levelChange > 50 || levelValue > 200) return "alert"
      // Warning for moderate increases
      if (levelChange > 15 || levelValue > 160) return "warning"
      return "normal"
    }

    // For temperature data
    if (dataType === "temperature" && river.current.temperature) {
      const tempValue = river.current.temperature.temperature
      const tempChange = river.changes.temperatureChange || 0

      // High alert for large increases or very high temperature
      if (Math.abs(tempChange) > 5 || tempValue > 25) return "alert"
      // Warning for moderate increases
      if (Math.abs(tempChange) > 2 || tempValue > 20) return "warning"
      return "normal"
    }

    return "normal"
  }

  // Prepare chart data based on data type
  const getChartData = () => {
    const isLongTimeRange = timeRange === "1w"
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
  }

  // Prepare chart data for the given time range
  const prepareChartData = (rawData: any[], timeRange: TimeRangeOption, mapper: (point: any) => any) => {
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

      // For longer time ranges we show the date in the format "DD.MM. HH:MM"
      const label = isLongTimeRange
        ? `${dateParts[0].substring(0, 5)} ${timePart}` // "DD.MM. HH:MM"
        : timePart // Only "HH:MM" for shorter time ranges

      return {
        ...mapper(point),
        time: timePart,
        label: label,
        fullDate: point.date, // Full date for tooltip
      }
    })
  }

  // Calculate the interval for the X-axis based on time range and device type
  const getXAxisInterval = (dataLength: number) => {
    const isLongTimeRange = timeRange === "1w"

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
  }

  // Update chart colors when theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const handleChange = () => {
      // Force re-render to update chart colors
      setForceUpdate((prev) => !prev)
    }

    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  const getChartConfig = () => {
    const isDarkMode =
      typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches

    // Get alert level to determine colors
    const alertLevel = getAlertLevel()

    // Define colors based on alert level
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
        stroke = "#2563eb" // Blue-600
        fill = isDarkMode ? "rgba(37, 99, 235, 0.2)" : "#dbeafe" // Blue-100 for light mode
    }

    // Get data type specific information
    let unit, name
    switch (dataType) {
      case "level":
        unit = "cm"
        name = "Pegel"
        break
      case "temperature":
        unit = "°C"
        name = "Temperatur"
        break
      case "flow":
        unit = "m³/s"
        name = "Abfluss"
        break
      default:
        unit = ""
        name = "Wert"
    }

    return {
      stroke,
      fill,
      dataKey: "value",
      unit,
      name,
      alertLevel,
    }
  }

  const chartData = getChartData()
  const chartConfig = getChartConfig()
  const isLongTimeRange = timeRange === "1w"

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2 p-3 sm:p-6">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base sm:text-lg">Entwicklung</CardTitle>
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
          <span className="text-sm font-normal">{formatTrendForTimeRange(river, dataType, timeRange)}</span>
        </div>
      </CardHeader>
      <CardContent className="p-1 sm:p-3">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(158, 158, 158, 0.2)" />
              <XAxis
                dataKey={isLongTimeRange ? "label" : "time"}
                tick={{ fontSize: 10 }}
                interval={getXAxisInterval(chartData.length)}
                angle={isLongTimeRange ? -45 : 0}
                textAnchor={isLongTimeRange ? "end" : "middle"}
                height={isLongTimeRange ? 60 : 30}
                stroke="currentColor"
              />
              <YAxis
                domain={["auto", "auto"]}
                tickCount={6}
                tickFormatter={(value) => Math.round(value).toString()}
                tick={{ fontSize: 10 }}
                width={30}
                stroke="currentColor"
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
