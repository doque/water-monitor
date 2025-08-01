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

function getDataSource(url: string): string {
  if (url.includes("hnd.bayern.de")) {
    return "Hochwasserdienst Bayern"
  } else if (url.includes("nid.bayern.de")) {
    return "Niedrigwasserdienst Bayern"
  } else if (url.includes("wassertemperatur.site")) {
    return "wassertemperatur.site"
  }
  return "Unbekannte Quelle"
}

export function DataSourcesFooter({ river }: DataSourcesFooterProps) {
  // Collect unique sources to display after the data sources
  const uniqueSources = new Set<string>()
  if (river.current.flow) uniqueSources.add(getDataSource(river.urls.flow))
  if (river.current.level) uniqueSources.add(getDataSource(river.urls.level))
  if (river.current.temperature) uniqueSources.add(getDataSource(river.urls.temperature))

  return (
    <div className="text-xs text-muted-foreground text-center">
      <div className="space-x-2">
        <span>Datenquellen:</span>
        {river.current.flow && (
          <a
            href={river.urls.flow}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          >
            Abfluss ({safeExtractTime(river.current.flow.date)})
          </a>
        )}
        {river.current.flow && river.current.level && <span>|</span>}
        {river.current.level && (
          <a
            href={river.urls.level}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          >
            Pegel ({safeExtractTime(river.current.level.date)})
          </a>
        )}
        {river.current.level && river.current.temperature && <span>|</span>}
        {river.current.temperature && (
          <a
            href={river.urls.temperature}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          >
            Temperatur ({safeExtractTime(river.current.temperature.date, river.isLake)})
          </a>
        )}
        {/* Add source attribution inline after data sources */}
        {uniqueSources.size > 0 && (
          <>
            <span> - </span>
            <span>{Array.from(uniqueSources).join(", ")}</span>
          </>
        )}
      </div>
    </div>
  )
}
