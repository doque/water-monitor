import type { RiverData } from "@/utils/water-data"

interface DataSourcesFooterProps {
  river: RiverData
}

// Helper function to safely extract time from date string or use date for lakes
function safeExtractTime(dateString: string, isLake?: boolean): string {
  try {
    const parts = dateString.split(" ")

    // For lakes, if no time part exists, use the date part
    if (isLake && (parts.length === 1 || !parts[1] || parts[1].length < 5)) {
      // Return just the date part for lakes
      return parts[0] || "N/A"
    }

    // For rivers or when time exists, extract time
    if (parts.length > 1 && parts[1].length >= 5) {
      return parts[1].substring(0, 5)
    }
    return "N/A"
  } catch {
    return "N/A"
  }
}

export function DataSourcesFooter({ river }: DataSourcesFooterProps) {
  // Check if there are any data sources to display
  const hasFlow = river.current.flow && river.urls.flow
  const hasLevel = river.current.level && river.urls.level
  const hasTemperature = river.current.temperature && river.urls.temperature && !river.urls.temperature?.startsWith("ext:")

  // Don't render anything if there are no data sources (e.g., Spitzingsee)
  if (!hasFlow && !hasLevel && !hasTemperature) {
    return null
  }

  return (
    <div className="text-xs text-muted-foreground text-center space-x-2">
      <span>Datenquellen:</span>
      {hasFlow && (
        <a
          href={river.urls.flow}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
        >
          Abfluss ({safeExtractTime(river.current.flow.date)})
        </a>
      )}
      {hasFlow && hasLevel && <span>|</span>}
      {hasLevel && (
        <a
          href={river.urls.level}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
        >
          Pegel ({safeExtractTime(river.current.level.date)})
        </a>
      )}
      {hasLevel && hasTemperature && <span>|</span>}
      {!hasLevel && hasFlow && hasTemperature && <span>|</span>}
      {hasTemperature && (
        <a
          href={river.urls.temperature}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
        >
          Temperatur ({safeExtractTime(river.current.temperature.date, river.isLake)})
        </a>
      )}
    </div>
  )
}
