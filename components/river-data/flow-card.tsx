"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RiverData } from "@/utils/water-data"
import { formatTrendForTimeRange } from "@/utils/formatters"
import type { TimeRangeOption } from "@/components/river-data/time-range-select"
import { useMemo } from "react" // Removed useState and useEffect
// Removed Image import

interface FlowCardProps {
  river: RiverData
  isActive: boolean
  onClick: () => void
  timeRange: TimeRangeOption
  showColors?: boolean
}

// Removed SPECIAL_IMAGE_SHOWN_KEY

export function FlowCard({ river, isActive, onClick, timeRange, showColors = false }: FlowCardProps) {
  // Removed clickCount state
  // Removed specialImageAlreadyShown state

  // Removed useEffect for localStorage check
  // Removed useEffect for clickCount reset

  // Get emoji based on alert level - memoized
  const alertEmoji = useMemo(() => {
    if (!showColors || !river.current.flow) return ""

    const alertLevel = river.alertLevel || "normal"

    switch (alertLevel) {
      case "alert":
        return "🔴"
      case "warning":
        return "🟡"
      default:
        return "🟢"
    }
  }, [river.current.flow, river.alertLevel, showColors])

  // Memoize the trend display to ensure it updates when timeRange changes
  const trendDisplay = useMemo(() => {
    try {
      return formatTrendForTimeRange(river, "flow", timeRange)
    } catch (error) {
      console.error("Error calculating flow trend:", error)
      return null
    }
  }, [river, timeRange])

  const handleFlowCardClick = () => {
    onClick() // Call original onClick handler

    // Removed all special image trigger logic
  }

  return (
    <Card
      className={`cursor-pointer transition-all ${isActive ? "bg-muted" : "hover:bg-muted/50"} relative overflow-hidden`}
      onClick={handleFlowCardClick}
    >
      <CardHeader className="pb-2 p-3 sm:p-6">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base sm:text-lg">Abfluss</CardTitle>
          <div className="flex items-center gap-2">
            {alertEmoji && <span>{alertEmoji}</span>}
            {trendDisplay && <span className="text-sm font-normal">{trendDisplay}</span>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0">
        {river.current.flow ? (
          <div className="text-4xl font-bold">
            {river.current.flow.flow.toFixed(2)} <span className="font-bold">m³/s</span>
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">Keine Daten verfügbar</div>
        )}
      </CardContent>

      {/* Removed special image rendering from here */}
    </Card>
  )
}
