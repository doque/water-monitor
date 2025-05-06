import type { RiverData } from "@/utils/water-data"
import type { TimeRangeOption } from "@/components/river-data/time-range-select"

type DataType = "level" | "temperature" | "flow"

// Format percentage change with appropriate emoji
export function getChangeIndicator(percentage: number, status: string, compact = false) {
  if (percentage === undefined || percentage === null) return "Keine Daten"

  // Format the change: For values over 10% no decimal places, otherwise one
  const formattedChange = Math.abs(percentage) >= 10 ? Math.round(percentage).toString() : percentage.toFixed(1)

  let emoji = "→"
  let colorClass = "text-gray-700 dark:text-gray-300"

  switch (status) {
    case "large-increase":
      emoji = "🔴 ↗️"
      colorClass = "text-red-600 dark:text-red-400 font-bold"
      break
    case "large-decrease":
      emoji = "🔴 ↘️"
      colorClass = "text-red-600 dark:text-red-400 font-bold"
      break
    case "medium-increase":
      emoji = "🟡 ↗️"
      colorClass = "text-amber-600 dark:text-amber-400 font-bold"
      break
    case "medium-decrease":
      emoji = "🟡 ↘️"
      colorClass = "text-amber-600 dark:text-amber-400 font-bold"
      break
    case "small-increase":
      emoji = "↗️"
      colorClass = "text-gray-700 dark:text-gray-300 font-bold" // Changed from blue to default
      break
    case "small-decrease":
      emoji = "↘️"
      colorClass = "text-gray-700 dark:text-gray-300 font-bold" // Changed from blue to default
      break
    default:
      emoji = "→"
      colorClass = "text-gray-700 dark:text-gray-300"
  }

  if (compact) {
    return (
      <span className={colorClass}>
        {emoji} {percentage > 0 ? "+" : ""}
        {formattedChange}% in 24h
      </span>
    )
  }

  return (
    <span className={colorClass}>
      {emoji} {percentage > 0 ? "+" : ""}
      {formattedChange}%
    </span>
  )
}

// Format temperature change with appropriate emoji
export function getTemperatureChangeIndicator(change: number, status: string, compact = false) {
  if (change === undefined || change === null) return "Keine Daten"

  // Format the change: For values over 10°C no decimal places, otherwise one
  const formattedChange = Math.abs(change) >= 10 ? Math.round(change).toString() : change.toFixed(1)

  let emoji = "→"
  let colorClass = "text-gray-700 dark:text-gray-300"

  switch (status) {
    case "large-increase":
      emoji = "🔴 ↗️"
      colorClass = "text-red-600 dark:text-red-400 font-bold"
      break
    case "large-decrease":
      emoji = "🔴 ↘️"
      colorClass = "text-red-600 dark:text-red-400 font-bold"
      break
    case "medium-increase":
      emoji = "🟡 ↗️"
      colorClass = "text-amber-600 dark:text-amber-400 font-bold"
      break
    case "medium-decrease":
      emoji = "🟡 ↘️"
      colorClass = "text-amber-600 dark:text-amber-400 font-bold"
      break
    case "small-increase":
      emoji = "↗️"
      colorClass = "text-gray-700 dark:text-gray-300 font-bold" // Changed from blue to default
      break
    case "small-decrease":
      emoji = "↘️"
      colorClass = "text-gray-700 dark:text-gray-300 font-bold" // Changed from blue to default
      break
    default:
      emoji = "→"
      colorClass = "text-gray-700 dark:text-gray-300"
  }

  if (compact) {
    return (
      <span className={colorClass}>
        {emoji} {change > 0 ? "+" : ""}
        {formattedChange}°C in 24h
      </span>
    )
  }

  return (
    <span className={colorClass}>
      {emoji} {change > 0 ? "+" : ""}
      {formattedChange}°C
    </span>
  )
}

// Calculate the percentage change for the selected time range
export function calculateTimeRangeChange(river: RiverData, dataType: DataType, timeRange: TimeRangeOption) {
  // If the time range is 24h and we already have the 24h change from the API data,
  // use it for consistency
  if (timeRange === "24h") {
    if (dataType === "level" && river.changes.levelPercentage !== undefined) {
      return {
        percentChange: river.changes.levelPercentage,
        absoluteChange: river.current.level.level - (river.previousDay?.level?.level || river.current.level.level),
        status: river.changes.levelStatus,
        timeSpan: timeRange,
      }
    } else if (dataType === "temperature" && river.changes.temperatureChange !== undefined) {
      return {
        percentChange: (river.changes.temperatureChange / river.previousDay?.temperature?.temperature) * 100 || 0,
        absoluteChange: river.changes.temperatureChange,
        status: river.changes.temperatureStatus,
        timeSpan: timeRange,
      }
    } else if (dataType === "flow" && river.changes.flowPercentage !== undefined) {
      return {
        percentChange: river.changes.flowPercentage,
        absoluteChange: river.current.flow.flow - (river.previousDay?.flow?.flow || river.current.flow.flow),
        status: river.changes.flowStatus,
        timeSpan: timeRange,
      }
    }
  }

  // Determine the data source based on the type
  let data: any[] = []
  if (dataType === "level") {
    data = [...river.history.levels]
  } else if (dataType === "temperature") {
    data = [...river.history.temperatures]
  } else if (dataType === "flow") {
    data = [...river.history.flows]
  }

  if (data.length === 0) return { percentChange: null, absoluteChange: null, status: "stable", timeSpan: timeRange }

  // Current values (newest data point)
  const current = data[0]

  // Determine the comparison time point based on the selected time range
  // Each data point is in 15-minute intervals
  const dataPoints = {
    "1h": 4, // 1 hour × 4 data points per hour (15-minute intervals)
    "2h": 8, // 2 hours × 4 data points per hour
    "6h": 24, // 6 hours × 4 data points per hour
    "12h": 48, // 12 hours × 4 data points per hour
    "24h": 96, // 24 hours × 4 data points per hour
    "48h": 192, // 48 hours × 4 data points per hour
    "1w": 672, // 7 days × 24 hours × 4 data points per hour
  }

  // Find the oldest available data point within the selected time range
  const compareIndex = Math.min(dataPoints[timeRange], data.length - 1)

  // If no comparison value is available, return no change
  if (compareIndex >= data.length)
    return { percentChange: null, absoluteChange: null, status: "stable", timeSpan: timeRange }

  const compareValue = data[compareIndex]

  // Calculate the percentage change
  let percentChange = 0
  let absoluteChange = 0

  if (dataType === "level") {
    if (compareValue.level > 0) {
      // Calculate the percentage change correctly
      percentChange = ((current.level - compareValue.level) / compareValue.level) * 100
    }
    absoluteChange = current.level - compareValue.level
  } else if (dataType === "temperature") {
    if (compareValue.temperature > 0) {
      percentChange = ((current.temperature - compareValue.temperature) / compareValue.temperature) * 100
    }
    absoluteChange = current.temperature - compareValue.temperature
  } else if (dataType === "flow") {
    if (compareValue.flow > 0) {
      percentChange = ((current.flow - compareValue.flow) / compareValue.flow) * 100
    }
    absoluteChange = current.flow - compareValue.flow
  }

  // Determine the status based on the percentage change
  // Adjusted thresholds for consistent status classifications
  const getChangeStatus = (percentage: number) => {
    if (percentage === undefined || percentage === null) return "stable"

    if (percentage > 50) return "large-increase"
    if (percentage < -50) return "large-decrease"
    if (percentage > 15) return "large-increase"
    if (percentage < -15) return "large-decrease"
    if (percentage > 5) return "medium-increase"
    if (percentage < -5) return "medium-decrease"
    if (percentage > 0) return "small-increase"
    if (percentage < 0) return "small-decrease"
    return "stable"
  }

  const status = getChangeStatus(percentChange)

  return {
    percentChange,
    absoluteChange,
    status,
    timeSpan: timeRange,
  }
}

// Format the trend for the selected time range
export function formatTrendForTimeRange(river: RiverData, dataType: DataType, timeRange: TimeRangeOption) {
  const change = calculateTimeRangeChange(river, dataType, timeRange)
  if (change.percentChange === null) return null

  let colorClass = "text-gray-700 dark:text-gray-300"

  switch (change.status) {
    case "large-increase":
      colorClass = "text-red-600 dark:text-red-400 font-bold"
      break
    case "large-decrease":
      colorClass = "text-red-600 dark:text-red-400 font-bold"
      break
    case "medium-increase":
      colorClass = "text-amber-600 dark:text-amber-400 font-bold"
      break
    case "medium-decrease":
      colorClass = "text-amber-600 dark:text-amber-400 font-bold"
      break
    case "small-increase":
      colorClass = "text-gray-700 dark:text-gray-300 font-bold" // Changed from blue to default
      break
    case "small-decrease":
      colorClass = "text-gray-700 dark:text-gray-300 font-bold" // Changed from blue to default
      break
    default:
      colorClass = "text-gray-700 dark:text-gray-300"
  }

  const emoji =
    change.status === "large-increase"
      ? "🔴 ↗️"
      : change.status === "large-decrease"
        ? "🔴 ↘️"
        : change.status === "medium-increase"
          ? "🟡 ↗️"
          : change.status === "medium-decrease"
            ? "🟡 ↘️"
            : change.status === "small-increase"
              ? "↗️"
              : change.status === "small-decrease"
                ? "↘️"
                : "→"

  // Time range text for display
  const getTimeRangeText = () => {
    // Use abbreviated form for all time ranges
    return timeRange
  }

  if (dataType === "temperature") {
    // Format the temperature change: For values over 10°C no decimal places, otherwise one
    const formattedChange =
      Math.abs(change.absoluteChange) >= 10
        ? Math.round(change.absoluteChange).toString()
        : change.absoluteChange.toFixed(1)

    return (
      <span className={colorClass}>
        {emoji} {change.absoluteChange > 0 ? "+" : ""}
        {formattedChange}°C in {getTimeRangeText().toLowerCase()}
      </span>
    )
  } else {
    // Format the percentage change: For values over 10% no decimal places, otherwise one
    const formattedChange =
      Math.abs(change.percentChange) >= 10
        ? Math.round(change.percentChange).toString()
        : change.percentChange.toFixed(1)

    return (
      <span className={colorClass}>
        {emoji} {change.percentChange > 0 ? "+" : ""}
        {formattedChange}% in {getTimeRangeText().toLowerCase()}
      </span>
    )
  }
}
