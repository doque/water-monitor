"use client"

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import type { RiverData } from "@/utils/water-data"
import { extractRiverId } from "@/utils/water-data"

interface RiverSelectProps {
  rivers: RiverData[]
  value: string
  onValueChange: (value: string) => void
}

export function RiverSelect({ rivers, value, onValueChange }: RiverSelectProps) {
  // Get emoji based on alert level
  const getRiverStatusEmoji = (river: RiverData): string => {
    if (!river.current.flow) return "🟢" // Default to green if no flow data

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

  // Find the selected river to display its name
  const selectedRiver = rivers.find((river) => extractRiverId(river.urls.level) === value)
  const emoji = selectedRiver ? getRiverStatusEmoji(selectedRiver) : "🟢"

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
          <span className="mr-1">{emoji}</span>
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
          const riverId = extractRiverId(river.urls.level)
          return (
            <SelectItem key={riverId} value={riverId}>
              <span className="flex items-center">
                <span className="mr-1">{emoji}</span>
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
