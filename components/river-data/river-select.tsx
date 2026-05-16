"use client"

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import type { RiverData } from "@/utils/water-data"
import { extractRiverId } from "@/utils/water-data"

interface RiverSelectProps {
  rivers: RiverData[]
  value: string
  onValueChange: (value: string) => void
  showColors?: boolean
}

export function RiverSelect({ rivers, value, onValueChange, showColors = false }: RiverSelectProps) {
  // Get emoji based on alert level for rivers or situation for lakes
  const getRiverStatusEmoji = (river: RiverData): string => {
    if (!showColors) return "" // No emoji in normal mode

    // For lakes, use situation-based colors (except Spitzingsee which stays blue)
    if (river.isLake) {
      if (river.name === "Spitzingsee") {
        return "🔵" // Always blue for Spitzingsee
      }

      // For Schliersee and Tegernsee, use situation from current temperature data
      const situation = river.current.temperature?.situation?.toLowerCase()
      if (situation === "neuer höchstwert") {
        return "🔴" // Red for new high value
      } else if (situation === "hoch") {
        return "🟡" // Yellow for high
      } else {
        return "🟢" // Green for normal/other
      }
    }

    // For rivers, use existing flow-based alert level
    if (!river.current.flow) return "" // No emoji if no flow data

    const alertLevel = river.alertLevel || "normal"

    switch (alertLevel) {
      case "alert":
        return "🔴"
      case "warning":
        return "🟡"
      default:
        return "🟢"
    }
  }

  // Get current flow or temperature value for display
  const getCurrentValue = (river: RiverData): string => {
    // Only show values in admin mode
    if (!showColors) return ""

    if (river.isLake && river.current.temperature) {
      return `${river.current.temperature.temperature.toFixed(1)} °C`
    } else if (!river.isLake && river.current.flow) {
      return `${river.current.flow.flow.toFixed(2)} m³/s`
    }
    return ""
  }

  // Generate a unique ID for each river - simplified and more robust
  const getRiverId = (river: RiverData): string => {
    if (!river) return "unknown-river"

    const name = river.name ? river.name.toLowerCase().replace(/\s+/g, "-") : "unknown"

    // For lakes, create a simple unique identifier based on name only
    if (river.isLake) {
      return `lake-${name}`
    }

    // For rivers, try to extract ID from level URL, but fallback to name-based ID if URL is missing
    if (river.urls?.level) {
      const extractedId = extractRiverId(river.urls.level)
      if (extractedId && extractedId !== "unknown") {
        return extractedId
      }
    }

    // Fallback: create ID from name and location (if available)
    const location = river.location ? river.location.toLowerCase().replace(/\s+/g, "-") : "unknown-location"
    return `river-${name}-${location}`
  }

  // Find the selected river to display its name
  const selectedRiver = rivers.find((river) => getRiverId(river) === value)
  const emoji = selectedRiver ? getRiverStatusEmoji(selectedRiver) : ""
  const currentValue = selectedRiver ? getCurrentValue(selectedRiver) : ""

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="px-2 h-10 text-sm min-w-0 overflow-hidden">
        <div className="flex items-center min-w-0 overflow-hidden">
          {emoji && <span className="mr-1 flex-shrink-0">{emoji}</span>}
          <span className="font-medium truncate">
            {selectedRiver?.name || "Gewässer auswählen"}
          </span>
          {currentValue && <span className="ml-1 text-xs text-muted-foreground flex-shrink-0">{currentValue}</span>}
        </div>
      </SelectTrigger>
      <SelectContent>
        {rivers.map((river) => {
          const emoji = getRiverStatusEmoji(river)
          const riverId = getRiverId(river)
          const currentValue = getCurrentValue(river)

          return (
            <SelectItem key={riverId} value={riverId} className="text-sm py-2">
              <div className="flex items-center w-full">
                {emoji && <span className="mr-1">{emoji}</span>}
                <span>
                  {river.name} {river.location ? `(${river.location})` : ""}
                </span>
                {currentValue && <span className="ml-2 text-xs text-muted-foreground">{currentValue}</span>}
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
