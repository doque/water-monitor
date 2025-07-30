"use client"

import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts"
import type { RiverData, AlertLevel } from "@/utils/water-data"
import type { TimeRangeOption } from "@/components/river-data/time-range-select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatTrendForTimeRange } from "@/utils/formatters"
import { useState, useMemo, useCallback } from "react"

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
      } else {
        // For Spitzingsee with only date part
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

  // Check if this is Spitzingsee specifically for special handling
  const isSpitzingsee = river?.name === "Spitzingsee"
  // Check if this is Schliersee or Tegernsee for 2-week filtering
  const isSchlierseeOrTegernsee = river?.name === "Schliersee" || river?.name === "Tegernsee"

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

    // For Spitzingsee, use all data points regardless of time range
    if (isSpitzingsee) {
      if (dataType === "temperature") {
        data = river.history.temperatures.map((point) => point.temperature)
      }
    } else if (isSchlierseeOrTegernsee) {
      // For Schliersee and Tegernsee, use all data points regardless of time range
      if (dataType === "temperature") {
        data = river.history.temperatures.map((point) => point.temperature)
      }
    } else {
      // Get the appropriate data array based on data type and time range for rivers
      if (dataType === "level") {
        data = river.history.levels.slice(0, getDataPointsForTimeRange(timeRange)).map((point) => point.level)
      } else if (dataType === "temperature") {
        data = river.history.temperatures
          .slice(0, getDataPointsForTimeRange(timeRange))
          .map((point) => point.temperature)
      } else if (dataType === "flow") {
        data = river.history.flows.slice(0, getDataPointsForTimeRange(timeRange)).map((point) => point.flow)
      }
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
  }, [river.history, dataType, timeRange, getDataPointsForTimeRange, isSpitzingsee, isSchlierseeOrTegernsee])

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

  // Prepare chart data for the given time range - modified for lakes
  const prepareChartData = useCallback(
    (rawData: any[], timeRange: TimeRangeOption, mapper: (point: any) => any) => {
      let filteredData = [...rawData]

      // For Spitzingsee, show only the freshest 30 data points (most recent 30 days)
      if (isSpitzingsee) {
        // Data is already sorted newest first, so take first 30 elements for freshest data
        filteredData = filteredData.slice(0, 30)

        // Reverse to show oldest to newest chronologically in chart
        return filteredData.reverse().map((point) => {
          // For Spitzingsee, format dates as day labels (no hours)
          const dateParts = point.date.split(" ")
          const datePart = dateParts[0] // Get DD.MM.YYYY or DD.MM

          // Extract just DD.MM for display
          const dayMonth = datePart.includes(".") ? datePart.split(".").slice(0, 2).join(".") : datePart

          return {
            ...mapper(point),
            time: dayMonth, // Use day.month format for Spitzingsee
            label: dayMonth, // Same for both short and long display
            fullDate: point.date, // Full date for tooltip
          }
        })
      }

      // For Schliersee and Tegernsee, show actual 2 weeks worth of data (not just 14 data points)
      if (isSchlierseeOrTegernsee) {
        // Calculate 2 weeks ago from now (14 days)
        const now = new Date()
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) // 14 days in milliseconds

        console.log(`Filtering ${river?.name} data:`)
        console.log(`Current time: ${now.toISOString()}`)
        console.log(`Two weeks ago: ${twoWeeksAgo.toISOString()}`)
        console.log(`Total data points before filtering: ${filteredData.length}`)

        // Filter data to only include points from 2 weeks ago onwards
        filteredData = filteredData.filter((point) => {
          // Parse the date from the data point timestamp
          const pointDate = new Date(point.timestamp)
          const isWithinRange = pointDate >= twoWeeksAgo

          if (!isWithinRange) {
            console.log(`Excluding point: ${point.timestamp} (${pointDate.toISOString()})`)
          }

          return isWithinRange
        })

        console.log(`Data points after 2-week filtering: ${filteredData.length}`)
        if (filteredData.length > 0) {
          console.log(`Oldest point: ${filteredData[filteredData.length - 1].timestamp}`)
          console.log(`Newest point: ${filteredData[0].timestamp}`)
        }

        // Reverse to show oldest to newest chronologically in chart
        return filteredData.reverse().map((point) => {
          // Format dates as day labels (no hours)
          const dateParts = point.date.split(" ")
          const datePart = dateParts[0] // Get DD.MM.YYYY or DD.MM

          // Extract just DD.MM for display
          const dayMonth = datePart.includes(".") ? datePart.split(".").slice(0, 2).join(".") : datePart

          return {
            ...mapper(point),
            time: dayMonth, // Use day.month format
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
    },
    [isSpitzingsee, isSchlierseeOrTegernsee],
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

  // Calculate the interval for the X-axis based on time range and device type - modified for lakes
  const xAxisInterval = useMemo(() => {
    // For Spitzingsee, show fewer labels since we have many daily data points
    if (isSpitzingsee) {
      const dataLength = chartData.length
      if (isMobile) {
        // Mobile: Show every 7th day approximately
        return Math.max(1, Math.floor(dataLength / 8))
      } else {
        // Desktop: Show every 5th day approximately
        return Math.max(1, Math.floor(dataLength / 12))
      }
    }

    // For Schliersee and Tegernsee, show fewer labels for 2-week data
    if (isSchlierseeOrTegernsee) {
      const dataLength = chartData.length
      if (isMobile) {
        // Mobile: Show every 3rd day approximately
        return Math.max(1, Math.floor(dataLength / 4))
      } else {
        // Desktop: Show every 2nd day approximately
        return Math.max(1, Math.floor(dataLength / 7))
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
  }, [timeRange, chartData.length, isMobile, isSpitzingsee, isSchlierseeOrTegernsee])

  // Get chart configuration - with stable dependencies
  const chartConfig = useMemo(() => {
    let stroke, fill

    if (isAdminMode) {
      // Admin mode: Use flow-based alert level colors
      const alertLevel: AlertLevel = river.alertLevel || "normal"

      switch (alertLevel) {
        case "alert":
          stroke = "#dc2626" // Red-600
          fill = isDarkMode ? "rgba(220, 38, 38, 0.4)" : "#fca5a5" // Red-300 for more vibrant fill
          break
        case "warning":
          stroke = "#d97706" // Amber-600
          fill = isDarkMode ? "rgba(217, 119, 6, 0.4)" : "#fcd34d" // Amber-300 for more vibrant fill
          break
        case "normal":
        default:
          stroke = "#16a34a" // Green-600
          fill = isDarkMode ? "rgba(22, 163, 74, 0.4)" : "#86efac" // Green-300 for more vibrant fill
      }
    } else {
      // Standard mode: Always use blue with lighter colorful fill (100-level)
      stroke = "#2563eb" // Blue-600
      fill = isDarkMode ? "rgba(37, 99, 235, 0.3)" : "#dbeafe" // Blue-100 for lighter fill
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

  // Render the actual chart for all data including Spitzingsee and lakes
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
                dataKey={isSpitzingsee || isSchlierseeOrTegernsee ? "time" : isLongTimeRange ? "label" : "time"}
                tick={(props) => (
                  <CustomXAxisTick
                    {...props}
                    isLongTimeRange={isLongTimeRange && !isSpitzingsee && !isSchlierseeOrTegernsee}
                  />
                )}
                interval={xAxisInterval}
                height={isLongTimeRange && !isSpitzingsee && !isSchlierseeOrTegernsee ? 50 : 30} // Normal height for lakes
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
