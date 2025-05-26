"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RiverData } from "@/utils/water-data"
import { formatTrendForTimeRange } from "@/utils/formatters"
import type { TimeRangeOption } from "@/components/river-data/time-range-select"
import { useMemo } from "react"

interface LevelCardProps {
  river: RiverData
  isActive: boolean
  onClick: () => void
  isMobile?: boolean
  timeRange: TimeRangeOption
}

export function LevelCard({ river, isActive, onClick, isMobile = false, timeRange }: LevelCardProps) {
  // Memoize the trend display to ensure it updates when timeRange changes
  const trendDisplay = useMemo(() => {
    try {
      return formatTrendForTimeRange(river, "level", timeRange)
    } catch (error) {
      console.error("Error calculating level trend:", error)
      return null
    }
  }, [river, timeRange])

  return (
    <Card className={`cursor-pointer transition-all ${isActive ? "bg-muted" : "hover:bg-muted/50"}`} onClick={onClick}>
      <CardHeader className="pb-2 p-3 sm:p-6">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base sm:text-lg">Pegel</CardTitle>
          {!isMobile && trendDisplay && <span className="text-sm font-normal">{trendDisplay}</span>}
        </div>
        {isMobile && trendDisplay && <div className="text-sm font-normal mt-1">{trendDisplay}</div>}
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0">
        {river.current.level ? (
          <div className="text-4xl font-bold">
            {river.current.level.level} <span className="font-bold">cm</span>
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">Keine Daten verfügbar</div>
        )}
      </CardContent>
    </Card>
  )
}
