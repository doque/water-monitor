"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { RiverData } from "@/utils/water-data"

interface RiverSelectProps {
  rivers: RiverData[]
  defaultValue: string
  onValueChange: (value: string) => void
}

export function RiverSelect({ rivers, defaultValue, onValueChange }: RiverSelectProps) {
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

  return (
    <Select defaultValue={defaultValue} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder="Gewässer auswählen" />
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
