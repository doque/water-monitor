import type { RiverData } from "@/utils/water-data"
import { extractStationName, formatStationName } from "@/utils/water-data"

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
  // Lakes with gkdLevelSlug get level data from GKD
  const hasGkdLevel = river.isLake && river.gkdLevelSlug
  const hasTemperature = river.current.temperature && river.urls.temperature && !river.urls.temperature?.startsWith("ext:")

  // Each metric is attributed to its own gauge — they are not always the same station
  const sources: { key: string; href: string; label: string; station: string | null; detail: string }[] = []

  if (hasFlow) {
    sources.push({
      key: "flow",
      href: river.urls.flow!,
      label: "Abfluss",
      station: extractStationName(river.urls.flow),
      detail: safeExtractTime(river.current.flow!.date),
    })
  }

  if (hasLevel) {
    sources.push({
      key: "level",
      href: river.urls.level,
      label: "Pegel",
      station: extractStationName(river.urls.level),
      detail: safeExtractTime(river.current.level!.date),
    })
  } else if (hasGkdLevel) {
    sources.push({
      key: "level",
      href: `https://www.gkd.bayern.de/de/seen/wasserstand/bayern/${river.gkdLevelSlug}/messwerte`,
      label: "Pegel",
      station: formatStationName(river.gkdLevelSlug),
      detail: "GKD",
    })
  }

  if (hasTemperature) {
    sources.push({
      key: "temperature",
      href: river.urls.temperature!,
      label: "Temperatur",
      station: extractStationName(river.urls.temperature),
      detail: safeExtractTime(river.current.temperature!.date, river.isLake),
    })
  }

  // Don't render anything if there are no data sources (e.g., Spitzingsee)
  if (sources.length === 0) {
    return null
  }

  return (
    <div className="text-xs text-muted-foreground flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
      <span>Datenquellen:</span>
      {sources.map((source, index) => (
        <span key={source.key} className="flex items-center gap-x-2">
          <a
            href={source.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          >
            {source.label}
            {source.station ? `: ${source.station}` : ""} ({source.detail})
          </a>
          {index < sources.length - 1 && <span aria-hidden="true">|</span>}
        </span>
      ))}
    </div>
  )
}
