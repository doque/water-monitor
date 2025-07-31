"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RiverData } from "@/utils/water-data"
import { formatTrendForTimeRange } from "@/utils/formatters"
import type { TimeRangeOption } from "@/components/river-data/time-range-select"
import { useMemo } from "react"

interface TemperatureCardProps {
  river: RiverData
  isActive: boolean
  onClick: () => void
  isMobile?: boolean
  timeRange: TimeRangeOption
}

export function TemperatureCard({ river, isActive, onClick, isMobile = false, timeRange }: TemperatureCardProps) {
  // Check if this is a lake for showing trend display
  const isLake = river?.isLake

  // Memoize the trend display to ensure it updates when timeRange changes
  const trendDisplay = useMemo(() => {
    try {
      return formatTrendForTimeRange(river, "temperature", timeRange)
    } catch (error) {
      console.error("Error calculating temperature trend:", error)
      return null
    }
  }, [river, timeRange])

  return (
    <Card
      className={`cursor-pointer transition-all ${isActive ? "bg-muted" : "hover:bg-muted/50"}`}
      onClick={() => (river.urls.temperature ? onClick() : null)}
    >
      <CardHeader className="pb-2 p-3 sm:p-6">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base sm:text-lg">Temperatur</CardTitle>
          {/* Show trend display for lakes, or for rivers on desktop */}
          {(isLake || !isMobile) && trendDisplay && <span className="text-sm font-normal">{trendDisplay}</span>}
        </div>
        {/* Show trend display for rivers on mobile */}
        {!isLake && isMobile && trendDisplay && <div className="text-sm font-normal mt-1">{trendDisplay}</div>}
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0">
        {river.current.temperature ? (
          <div className="text-4xl font-bold">
            {river.current.temperature.temperature.toFixed(1)} <span className="font-bold">°C</span>
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">Keine Temperaturdaten verfügbar</div>
        )}
      </CardContent>
    </Card>
  )
}
