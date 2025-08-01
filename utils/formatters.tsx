import type { RiverData } from "@/utils/water-data"
import type { TimeRangeOption } from "@/components/river-data/time-range-select"

type DataType = "level" | "temperature" | "flow"

// Format absolute change with appropriate emoji
export function getChangeIndicator(absoluteChange: number, status: string, unit: string, compact = false) {
  if (absoluteChange === undefined || absoluteChange === null) return "Keine Daten"

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

// Calculate the absolute change for the selected time range
export function calculateTimeRangeChange(river: RiverData, dataType: DataType, timeRange: TimeRangeOption) {
  // Determine the data source based on the type
  let data: any[] = []
  if (dataType === "level") {
    data = [...river.history.levels]
  } else if (dataType === "temperature") {
    data = [...river.history.temperatures]
  } else if (dataType === "flow") {
    data = [...river.history.flows]
  }

  if (data.length === 0) return { absoluteChange: null, status: "stable", timeSpan: timeRange }

  // Current values (newest data point)
  const current = data[0]

  // Add null/undefined checks for current data point
  if (!current) {
    return { absoluteChange: null, status: "stable", timeSpan: timeRange }
  }

  // Special handling for lake-specific time ranges (1w, 2w, 1m, 2m, 6m)
  const isLake = river?.isLake
  if (isLake && ["1w", "2w", "1m", "2m", "6m"].includes(timeRange)) {
    // For lakes, we compare the first and last data points in the selected time range
    const lakeDataPoints = {
      "1w": 7, // 1 week = 7 days
      "2w": 14, // 2 weeks = 14 days
      "1m": 30, // 1 month = 30 days
      "2m": 60, // 2 months = 60 days
      "6m": 180, // 6 months = 180 days
    }

    const maxDataPoints = lakeDataPoints[timeRange] || 30

    // Make sure we don't try to access beyond the available data
    const compareIndex = Math.min(maxDataPoints - 1, data.length - 1)
    if (compareIndex <= 0) {
      return { absoluteChange: null, status: "stable", timeSpan: timeRange }
    }

    const compareValue = data[compareIndex]

    // Add null/undefined checks for comparison data point
    if (!compareValue) {
      return { absoluteChange: null, status: "stable", timeSpan: timeRange }
    }

    // Calculate the absolute change with proper null checks
    let absoluteChange = 0

    if (dataType === "level") {
      // Check if both values have the level property and are numbers
      if (typeof current.level !== "number" || typeof compareValue.level !== "number") {
        return { absoluteChange: null, status: "stable", timeSpan: timeRange }
      }
      absoluteChange = current.level - compareValue.level
    } else if (dataType === "temperature") {
      // Check if both values have the temperature property and are numbers
      if (typeof current.temperature !== "number" || typeof compareValue.temperature !== "number") {
        return { absoluteChange: null, status: "stable", timeSpan: timeRange }
      }
      absoluteChange = current.temperature - compareValue.temperature
    } else if (dataType === "flow") {
      // Check if both values have the flow property and are numbers
      if (typeof current.flow !== "number" || typeof compareValue.flow !== "number") {
        return { absoluteChange: null, status: "stable", timeSpan: timeRange }
      }
      absoluteChange = current.flow - compareValue.flow
    }

    // Determine the status based on the absolute change
    const status = getChangeStatus(absoluteChange, dataType)

    return {
      absoluteChange,
      status,
      timeSpan: timeRange,
    }
  }

  // Original logic for rivers with 15-minute intervals
  const idealDataPointsBack = {
    "1h": 4, // 1 hour = 4 × 15-minute intervals
    "2h": 8, // 2 hours = 8 × 15-minute intervals
    "6h": 24, // 6 hours = 24 × 15-minute intervals
    "12h": 48, // 12 hours = 48 × 15-minute intervals
    "24h": 96, // 24 hours = 96 × 15-minute intervals
    "48h": 192, // 48 hours = 192 × 15-minute intervals
    "1w": 672, // 1 week = 672 × 15-minute intervals (7 days × 24 hours × 4)
  }

  const idealTargetIndex = idealDataPointsBack[timeRange]

  // Minimum data requirements for reasonable extrapolation
  const minDataPointsForTimeRange = {
    "1h": 2, // At least 30 minutes
    "2h": 4, // At least 1 hour
    "6h": 8, // At least 2 hours
    "12h": 24, // At least 6 hours
    "24h": 48, // At least 12 hours
    "48h": 96, // At least 24 hours
    "1w": 192, // At least 48 hours for 1 week extrapolation
  }

  const minRequired = minDataPointsForTimeRange[timeRange]

  if (data.length < minRequired) {
    // Not enough data for reasonable extrapolation
    return { absoluteChange: null, status: "stable", timeSpan: timeRange }
  }

  // Use the ideal index if we have enough data, otherwise use the oldest available data point
  const actualTargetIndex = Math.min(idealTargetIndex, data.length - 1)

  // Get the comparison value
  const compareValue = data[actualTargetIndex]

  // Add null/undefined checks for comparison data point
  if (!compareValue) {
    return { absoluteChange: null, status: "stable", timeSpan: timeRange }
  }

  // Calculate the absolute change with proper null checks
  let absoluteChange = 0

  if (dataType === "level") {
    // Check if both values have the level property and are numbers
    if (typeof current.level !== "number" || typeof compareValue.level !== "number") {
      return { absoluteChange: null, status: "stable", timeSpan: timeRange }
    }
    absoluteChange = current.level - compareValue.level
  } else if (dataType === "temperature") {
    // Check if both values have the temperature property and are numbers
    if (typeof current.temperature !== "number" || typeof compareValue.temperature !== "number") {
      return { absoluteChange: null, status: "stable", timeSpan: timeRange }
    }
    absoluteChange = current.temperature - compareValue.temperature
  } else if (dataType === "flow") {
    // Check if both values have the flow property and are numbers
    if (typeof current.flow !== "number" || typeof compareValue.flow !== "number") {
      return { absoluteChange: null, status: "stable", timeSpan: timeRange }
    }
    absoluteChange = current.flow - compareValue.flow
  }

  // If we don't have the full time range, extrapolate the change
  if (actualTargetIndex < idealTargetIndex) {
    // Calculate the extrapolation factor
    const actualTimePoints = actualTargetIndex
    const idealTimePoints = idealTargetIndex
    const extrapolationFactor = idealTimePoints / actualTimePoints

    // Extrapolate the change to the full requested time range
    absoluteChange = absoluteChange * extrapolationFactor
  }

  // Determine the status based on the absolute change
  const status = getChangeStatus(absoluteChange, dataType)

  return {
    absoluteChange,
    status,
    timeSpan: timeRange, // Always return the requested time span
  }
}

// Format the trend for the selected time range
export function formatTrendForTimeRange(river: RiverData, dataType: DataType, timeRange: TimeRangeOption) {
  const change = calculateTimeRangeChange(river, dataType, timeRange)
  if (change.absoluteChange === null) return null

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
      case "1h":
        return "1h"
      case "2h":
        return "2h"
      case "6h":
        return "6h"
      case "12h":
        return "12h"
      case "24h":
        return "24h"
      case "48h":
        return "48h"
      case "1w":
        return "7d" // Changed from "1w" to "7d"
      case "2w":
        return "14d" // Changed from "2w" to "14d"
      case "1m":
        return "30d" // Changed from "1m" to "30d"
      case "2m":
        return "60d" // Changed from "2m" to "60d"
      case "6m":
        return "180d" // Changed from "6m" to "180d"
      default:
        return timeSpan
    }
  }

  // Format the absolute change: For flow use 2 decimal places, for others use existing logic
  let formattedChange = ""
  if (dataType === "flow") {
    formattedChange = Math.abs(change.absoluteChange).toFixed(2)
  } else {
    formattedChange =
      Math.abs(change.absoluteChange) >= 10
        ? Math.abs(change.absoluteChange).toFixed(0)
        : Math.abs(change.absoluteChange).toFixed(1)
  }

  // Get the appropriate emoji
  let emoji = "➡️"
  if (change.status !== "stable") {
    emoji = change.absoluteChange > 0 ? "↗️" : "↘️"
  }

  // Format the sign and value properly
  const sign = change.absoluteChange > 0 ? "+" : "-"
  const displayValue = formattedChange

  // Always show the requested time range
  const timeRangeDisplay = getTimeRangeText(change.timeSpan)

  return (
    <span>
      {emoji} {sign}
      {displayValue}
      {unit} in {timeRangeDisplay}
    </span>
  )
}
