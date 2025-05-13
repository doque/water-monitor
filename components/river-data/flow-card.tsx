"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RiverData } from "@/utils/water-data"

interface FlowCardProps {
  river: RiverData
  isActive: boolean
  onClick: () => void
}

export function FlowCard({ river, isActive, onClick }: FlowCardProps) {
  // Determine the text color based on alert level
  const getTextColorClass = () => {
    if (!river.current.flow) return "text-foreground"

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
    if (!river.current.flow) return ""

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
          <CardTitle className="text-base sm:text-lg">Abfluss</CardTitle>
          <span className="text-sm font-normal">
            {getAlertEmoji()}{" "}
            {river.changes.flowPercentage !== undefined && (
              <span className="ml-1">
                {river.changes.flowPercentage > 0 ? "+" : ""}
                {Math.round(river.changes.flowPercentage)}%
              </span>
            )}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0">
        {river.current.flow ? (
          <div className={`text-4xl font-bold ${getTextColorClass()}`}>
            {river.current.flow.flow.toFixed(1)} <span className="font-bold">m³/s</span>
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">Keine Daten verfügbar</div>
        )}
      </CardContent>
    </Card>
  )
}
