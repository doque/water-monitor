"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RiverData } from "@/utils/water-data"
import { getChangeIndicator } from "@/utils/formatters"

interface LevelCardProps {
  river: RiverData
  isActive: boolean
  onClick: () => void
  isMobile?: boolean
}

export function LevelCard({ river, isActive, onClick, isMobile = false }: LevelCardProps) {
  // Update the getTextColorClass function to use weekly data and remove blue for small changes
  const getTextColorClass = () => {
    // Get the weekly change percentage
    const weeklyChange =
      river.history.levels.length > 0
        ? (((river.current.level?.level || 0) - (river.history.levels[river.history.levels.length - 1]?.level || 0)) /
            (river.history.levels[river.history.levels.length - 1]?.level || 1)) *
          100
        : 0

    // Use significant thresholds for color coding
    if (Math.abs(weeklyChange) > 15) {
      return "text-red-600 dark:text-red-400"
    } else if (Math.abs(weeklyChange) > 5) {
      return "text-amber-600 dark:text-amber-400"
    }
    // For small or no changes, use default text color
    return "text-foreground"
  }

  return (
    <Card className={`cursor-pointer transition-all ${isActive ? "bg-muted" : "hover:bg-muted/50"}`} onClick={onClick}>
      <CardHeader className="pb-2 p-3 sm:p-6">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base sm:text-lg">Pegel</CardTitle>
          {!isMobile && river.changes.levelPercentage !== undefined && (
            <span className="text-sm font-normal">
              {getChangeIndicator(river.changes.levelPercentage, river.changes.levelStatus, true)}
            </span>
          )}
        </div>
        {isMobile && river.changes.levelPercentage !== undefined && (
          <div className="text-sm font-normal mt-1">
            {getChangeIndicator(river.changes.levelPercentage, river.changes.levelStatus, true)}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0">
        {river.current.level ? (
          <div className={`text-4xl font-bold ${getTextColorClass()}`}>
            {river.current.level.level} <span className="font-bold">cm</span>
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">Keine Daten verfügbar</div>
        )}
      </CardContent>
    </Card>
  )
}
