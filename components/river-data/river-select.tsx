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
    if (!showColors) return ""

    if (river.isLake) {
      if (river.name === "Spitzingsee") {
        return "🔵"
      }

      const situation = river.current.temperature?.situation?.toLowerCase()
      if (situation === "neuer höchstwert") {
        return "🔴"
      } else if (situation === "hoch") {
        return "🟡"
      } else {
        return "🟢"
      }
    }

    if (!river.current.flow) return ""

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

  // Get current flow or temperature value for display - only in admin mode
  const getCurrentValue = (river: RiverData): string => {
    if (!showColors) return "" // Only show values in admin mode

    if (river.isLake && river.current.temperature) {
      return `${river.current.temperature.temperature.toFixed(1)} °C`
    } else if (!river.isLake && river.current.flow) {
      return `${river.current.flow.flow.toFixed(2)} m³/s`
    }
    return ""
  }

  // Generate unique ID for each river
  const getRiverId = (river: RiverData): string => {
    if (!river) return "unknown-river"

    const name = river.name ? river.name.toLowerCase().replace(/\s+/g, "-") : "unknown"

    if (river.isLake) {
      return `lake-${name}`
    }

    if (river.urls?.level) {
      const extractedId = extractRiverId(river.urls.level)
      if (extractedId && extractedId !== "unknown") {
        return extractedId
      }
    }

    const location = river.location ? river.location.toLowerCase().replace(/\s+/g, "-") : "unknown-location"
    return `river-${name}-${location}`
  }

  const selectedRiver = rivers.find((river) => getRiverId(river) === value)
  const selectedEmoji = selectedRiver ? getRiverStatusEmoji(selectedRiver) : ""
  const selectedValue = selectedRiver ? getCurrentValue(selectedRiver) : ""

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="px-2 h-10">
        {/* Trigger content with working flex layout */}
        <div className="flex items-center w-full">
          <div className="flex items-center flex-1 min-w-0">
            {selectedEmoji && <span className="mr-1">{selectedEmoji}</span>}
            <span className="truncate">{selectedRiver?.name || "Gewässer auswählen"}</span>
          </div>
          {selectedValue && <span className="ml-1 text-sm text-muted-foreground shrink-0">{selectedValue}</span>}
        </div>
      </SelectTrigger>

      <SelectContent>
        {rivers.map((river) => {
          const emoji = getRiverStatusEmoji(river)
          const riverId = getRiverId(river)
          const currentValue = getCurrentValue(river)

          return (
            <SelectItem key={riverId} value={riverId} className="p-0">
              {/* Using exact same flex structure as trigger */}
              <div className="flex items-center w-full pl-6 pr-2 py-1.5 min-h-[36px]">
                <div className="flex items-center flex-1 min-w-0">
                  {emoji && <span className="mr-1">{emoji}</span>}
                  <span className="truncate">
                    {river.name} {river.location ? `(${river.location})` : ""}
                  </span>
                </div>
                {currentValue && <span className="ml-1 text-sm text-muted-foreground shrink-0">{currentValue}</span>}
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
