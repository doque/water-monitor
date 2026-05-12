import type { RiverData } from "@/utils/water-data"
import type { TimeRangeOption } from "@/components/river-data/time-range-select"

type DataType = "level" | "temperature" | "flow"

// Format absolute change with appropriate emoji
export function getChangeIndicator(absoluteChange: number, status: string, unit: string, compact = false) {
  if (absoluteChange === undefined || absoluteChange === null) return "Keine Daten verfügbar"

  // Format the change: For values over 10 no decimal places, otherwise one
  const formattedChange =
    Math.abs(absoluteChange) >= 10 ? Math.round(absoluteChange).toString() : Math.abs(absoluteChange).toFixed(1)

  let emoji = "➡️"

  switch (status) {
    case "large-increase":
      emoji = "↗️"
      break
    case "large-decrease":
      emoji = "↘️"
      break
    case "medium-increase":
      emoji = "↗️"
      break
    case "medium-decrease":
      emoji = "↘️"
      break
    case "small-increase":
      emoji = "↗️"
      break
    case "small-decrease":
      emoji = "↘️"
      break
    default:
      emoji = "➡️"
  }

  if (compact) {
    return (
      <span>
        {emoji} {absoluteChange > 0 ? "+" : ""}
        {absoluteChange > 0 ? formattedChange : `-${formattedChange}`}
        {unit}
      </span>
    )
  }

  return (
    <span>
      {emoji} {absoluteChange > 0 ? "+" : ""}
      {absoluteChange > 0 ? formattedChange : `-${formattedChange}`}
      {unit}
    </span>
  )
}

// Helper function to determine change status based on absolute change and data type
export function getChangeStatus(change: number, dataType: DataType) {
  if (change === undefined || change === null || change === 0) return "stable"

  // Different thresholds for different data types
  let largeThreshold, mediumThreshold, smallThreshold

  switch (dataType) {
    case "flow":
      largeThreshold = 1.0 // m³/s
      mediumThreshold = 0.5
      smallThreshold = 0.1
      break
    case "level":
      largeThreshold = 50 // cm
      mediumThreshold = 20
      smallThreshold = 5
      break
    case "temperature":
      largeThreshold = 5 // °C
      mediumThreshold = 2
      smallThreshold = 0.5
      break
    default:
      largeThreshold = 10
      mediumThreshold = 5
      smallThreshold = 1
  }

  const absChange = Math.abs(change)

  if (absChange >= largeThreshold) {
    return change > 0 ? "large-increase" : "large-decrease"
  }
  if (absChange >= mediumThreshold) {
    return change > 0 ? "medium-increase" : "medium-decrease"
  }
  if (absChange >= smallThreshold) {
    return change > 0 ? "small-increase" : "small-decrease"
  }
  return "stable"
}

// Get average from chart data - returns formatted string or null
export function getAverageFromChartData(
  chartData: { value?: number }[],
  dataType: DataType
): string | null {
  if (!chartData || chartData.length < 2) return null
  
  const values = chartData.map(d => d.value).filter((v): v is number => typeof v === "number")
  if (values.length < 2) return null
  
  const average = values.reduce((sum, v) => sum + v, 0) / values.length
  
  let unit = ""
  if (dataType === "flow") unit = "m³/s"
  else if (dataType === "level") unit = "cm"
  else if (dataType === "temperature") unit = "°C"
  
  let formatted = ""
  if (dataType === "flow") {
    formatted = average.toFixed(2)
  } else {
    formatted = average >= 10 ? average.toFixed(0) : average.toFixed(1)
  }
  
  return `Ø ${formatted}${unit}`
}

// Calculate trend from chart data array
// chartData should be in display order (oldest first, newest last)
export function calculateTrendFromChartData(
  chartData: { value?: number }[],
  dataType: DataType,
  timeRange: TimeRangeOption
) {
  if (!chartData || chartData.length < 2) {
    return { absoluteChange: 0, deltaFromAvg: 0, average: 0, current: 0, status: "stable" as const, timeSpan: timeRange }
  }

  // chartData is in display order: oldest first, newest last
  const values = chartData.map(d => d.value).filter((v): v is number => typeof v === "number")
  
  if (values.length < 2) {
    return { absoluteChange: 0, deltaFromAvg: 0, average: 0, current: 0, status: "stable" as const, timeSpan: timeRange }
  }

  const oldestValue = values[0]
  const newestValue = values[values.length - 1]
  const average = values.reduce((sum, v) => sum + v, 0) / values.length
  const deltaFromAvg = newestValue - average

  const absoluteChange = newestValue - oldestValue
  const status = getChangeStatus(absoluteChange, dataType)

  return { absoluteChange, deltaFromAvg, average, current: newestValue, status, timeSpan: timeRange }
}

// Format the trend from chart data
// Always returns a string - never null
export function formatTrendFromChartData(
  chartData: { value?: number }[],
  dataType: DataType,
  timeRange: TimeRangeOption
): string {
  const change = calculateTrendFromChartData(chartData, dataType, timeRange)

  // Get unit based on data type
  let unit = ""
  switch (dataType) {
    case "level":
      unit = " cm"
      break
    case "temperature":
      unit = "°C"
      break
    case "flow":
      unit = " m³/s"
      break
  }

  // Time range text for display - updated to use days instead of months
  const getTimeRangeText = (timeSpan: TimeRangeOption) => {
    switch (timeSpan) {
      case "1h":  return "1h"
      case "6h":  return "6h"
      case "12h": return "12h"
      case "24h": return "24h"
      case "2d":  return "2d"
      case "1w":  return "7d"
      case "2w":  return "14d"
      case "1m":  return "30d"
      case "3m":  return "3M"
      case "6m":  return "6M"
      case "12m": return "12M"
      case "24m": return "24M"
      default:    return timeSpan
    }
  }

  // Format the absolute change (newest - oldest): For flow use 2 decimal places, for others use existing logic
  let changeFormatted = ""
  if (dataType === "flow") {
    changeFormatted = Math.abs(change.absoluteChange).toFixed(2)
  } else {
    changeFormatted =
      Math.abs(change.absoluteChange) >= 10
        ? Math.abs(change.absoluteChange).toFixed(0)
        : Math.abs(change.absoluteChange).toFixed(1)
  }

  // Get trend arrow based on absolute change
  let arrow = "→"
  if (change.absoluteChange > 0.01) {
    arrow = "↗"
  } else if (change.absoluteChange < -0.01) {
    arrow = "↘"
  }

  const sign = change.absoluteChange >= 0 ? "+" : ""
  const timeRangeDisplay = getTimeRangeText(change.timeSpan)

  return `${arrow} ${sign}${changeFormatted}${unit} in ${timeRangeDisplay}`
}
