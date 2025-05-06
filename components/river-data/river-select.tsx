"use client"

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import type { RiverData } from "@/utils/water-data"
import { useEffect, useState } from "react"

interface RiverSelectProps {
  rivers: RiverData[]
  defaultValue: string
  onValueChange: (value: string) => void
}

export function RiverSelect({ rivers, defaultValue, onValueChange }: RiverSelectProps) {
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

  // Determine the status of a river based on its 24h flow trend
  const getRiverStatusIndicator = (river: RiverData): { emoji: string; direction: string } => {
    // Default values
    let emoji = "🟢"
    let direction = ""

    // Use the 24h flow change from the API data
    if (river.changes.flowPercentage !== undefined && river.changes.flowStatus) {
      const flowPercentage = river.changes.flowPercentage

      // Determine status based on the change
      if (Math.abs(flowPercentage) > 15) {
        emoji = "🔴" // Major change (>15%)
      } else if (Math.abs(flowPercentage) > 5) {
        emoji = "🟡" // Moderate change (5-15%)
      }

      // Determine direction
      direction = flowPercentage > 0 ? "↗️" : flowPercentage < 0 ? "↘️" : ""

      return { emoji, direction }
    }

    // Fallback: If no flow data is available, check level
    if (river.changes.levelPercentage !== undefined) {
      const levelPercentage = river.changes.levelPercentage

      // Determine status based on the change
      if (Math.abs(levelPercentage) > 15) {
        emoji = "🔴" // Major change (>15%)
      } else if (Math.abs(levelPercentage) > 5) {
        emoji = "🟡" // Moderate change (5-15%)
      }

      // Determine direction
      direction = levelPercentage > 0 ? "↗️" : levelPercentage < 0 ? "↘️" : ""
    }

    return { emoji, direction }
  }

  // Find the selected river to display its name
  const selectedRiver = rivers.find((river) => river.name.toLowerCase() === defaultValue)
  const { emoji, direction } = selectedRiver ? getRiverStatusIndicator(selectedRiver) : { emoji: "🟢", direction: "" }

  return (
    <Select defaultValue={defaultValue} onValueChange={onValueChange}>
      <SelectTrigger className="px-2 h-10 flex items-center justify-between">
        <div className="flex items-center truncate mr-1">
          <span className="mr-1">
            {emoji} {direction}
          </span>
          <span className="truncate">
            {selectedRiver?.name}
            {/* Only show location on desktop */}
            {!isMobile && selectedRiver && ` (${selectedRiver.location})`}
          </span>
        </div>
      </SelectTrigger>
      <SelectContent>
        {rivers.map((river) => {
          const { emoji, direction } = getRiverStatusIndicator(river)
          return (
            <SelectItem key={river.name} value={river.name.toLowerCase()}>
              {emoji} {direction} {river.name} ({river.location})
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
