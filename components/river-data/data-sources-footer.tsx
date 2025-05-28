import type { RiverData } from "@/utils/water-data"

interface DataSourcesFooterProps {
  river: RiverData
}

export function DataSourcesFooter({ river }: DataSourcesFooterProps) {
  return (
    <div className="text-xs text-muted-foreground text-center space-x-2">
      <span>Datenquellen:</span>
      {river.current.flow && (
        <a
          href={river.urls.flow}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
        >
          Abfluss ({river.current.flow.date.split(" ")[1].substring(0, 5)})
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
          Pegel ({river.current.level.date.split(" ")[1].substring(0, 5)})
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
          Temperatur ({river.current.temperature.date.split(" ")[1].substring(0, 5)})
        </a>
      )}
    </div>
  )
}
