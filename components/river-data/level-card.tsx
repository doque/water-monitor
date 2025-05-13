"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RiverData } from "@/utils/water-data"

interface LevelCardProps {
  river: RiverData
  isActive: boolean
  onClick: () => void
  isMobile?: boolean
}

export function LevelCard({ river, isActive, onClick, isMobile = false }: LevelCardProps) {
  // Use the same color as the flow card based on alert level
  const getTextColorClass = () => {
    if (!river.current.level) return "text-foreground"

    const alertLevel = river.alertLevel || "normal"

    switch (alertLevel) {
      case "alert":
        return "text-red-600 dark:text-red-400"
      case "warning":
        return "text-amber-600 dark:text-amber-400"
      default:
        return "text-green-600 dark:text-green-400"
    }
  }

  // Get emoji based on alert level
  const getAlertEmoji = () => {
    if (!river.current.level) return ""

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

  return (
    <Card className={`cursor-pointer transition-all ${isActive ? "bg-muted" : "hover:bg-muted/50"}`} onClick={onClick}>
      <CardHeader className="pb-2 p-3 sm:p-6">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base sm:text-lg">Pegel</CardTitle>
          {!isMobile && (
            <span className="text-sm font-normal">
              {getAlertEmoji()}{" "}
              {river.changes.levelPercentage !== undefined && (
                <span className="ml-1">
                  {river.changes.levelPercentage > 0 ? "+" : ""}
                  {Math.round(river.changes.levelPercentage)}%
                </span>
              )}
            </span>
          )}
          {isMobile && river.changes.levelPercentage !== undefined && (
            <div className="text-sm font-normal mt-1">
              {getAlertEmoji()} {river.changes.levelPercentage > 0 ? "+" : ""}
              {Math.round(river.changes.levelPercentage)}%
            </div>
          )}
        </div>
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
