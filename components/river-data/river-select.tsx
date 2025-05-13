"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { RiverData } from "@/utils/water-data"
import { useEffect, useState } from "react"
import { extractRiverId } from "@/utils/water-data"

interface RiverSelectProps {
  rivers: RiverData[]
  value: string
  onValueChange: (value: string) => void
}

export function RiverSelect({ rivers, value, onValueChange }: RiverSelectProps) {
  const [isMobile, setIsMobile] = useState(false)

  // Detect if we're on mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }

    // Initial check
    checkIfMobile()

    // Add event listener
    window.addEventListener("resize", checkIfMobile)

    // Cleanup
    return () => window.removeEventListener("resize", checkIfMobile)
  }, [])

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
      <SelectTrigger className="px-2 h-10 flex items-center justify-between">
        <SelectValue>
          <div className="flex items-center truncate mr-1">
            <span className="mr-1">{emoji}</span>
            <span className="truncate">
              {selectedRiver?.name}
              {/* Only show location on desktop */}
              {!isMobile && selectedRiver && ` (${selectedRiver.location})`}
            </span>
          </div>
        </SelectValue>
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
