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
  // Get emoji based on alert level
  const getRiverStatusEmoji = (river: RiverData): string => {
    if (!showColors || !river.current.flow) return "" // No emoji in normal mode

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

  // Generate a unique ID for each river - simplified and more robust
  const getRiverId = (river: RiverData): string => {
    // For lakes, create a simple unique identifier based on name and location
    if (river.isLake) {
      return `lake-${river.name.toLowerCase().replace(/\s+/g, "-")}-${river.location.toLowerCase().replace(/\s+/g, "-")}`
    }

    // For rivers, try to extract ID from level URL, but fallback to name-based ID if URL is missing
    if (river.urls?.level) {
      const extractedId = extractRiverId(river.urls.level)
      if (extractedId && extractedId !== "unknown") {
        return extractedId
      }
    }

    // Fallback: create ID from name and location
    return `river-${river.name.toLowerCase().replace(/\s+/g, "-")}-${river.location.toLowerCase().replace(/\s+/g, "-")}`
  }

  // Find the selected river to display its name
  const selectedRiver = rivers.find((river) => getRiverId(river) === value)
  const emoji = selectedRiver ? getRiverStatusEmoji(selectedRiver) : ""

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className="px-2 h-10"
        style={{
          textOverflow: "unset",
          overflow: "visible",
          whiteSpace: "nowrap",
        }}
      >
        <div
          className="flex items-center w-full"
          style={{
            textOverflow: "unset",
            overflow: "visible",
            whiteSpace: "nowrap",
            textDecoration: "none",
            wordBreak: "keep-all",
            hyphens: "none",
          }}
        >
          {emoji && <span className="mr-1">{emoji}</span>}
          <span
            style={{
              textOverflow: "unset",
              overflow: "visible",
              whiteSpace: "nowrap",
              textDecoration: "none",
              wordBreak: "keep-all",
              hyphens: "none",
            }}
          >
            {selectedRiver?.name || "Gewässer auswählen"}
          </span>
        </div>
      </SelectTrigger>
      <SelectContent>
        {rivers.map((river) => {
          const emoji = getRiverStatusEmoji(river)
          const riverId = getRiverId(river)
          return (
            <SelectItem key={riverId} value={riverId}>
              <span className="flex items-center">
                {emoji && <span className="mr-1">{emoji}</span>}
                <span>
                  {river.name} ({river.location})
                </span>
              </span>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
