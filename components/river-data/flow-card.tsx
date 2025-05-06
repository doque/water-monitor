"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RiverData } from "@/utils/water-data"
import { getChangeIndicator } from "@/utils/formatters"

interface FlowCardProps {
  river: RiverData
  isActive: boolean
  onClick: () => void
}

export function FlowCard({ river, isActive, onClick }: FlowCardProps) {
  // Determine the text color based on flow status
  const getTextColorClass = () => {
    // Get the weekly change percentage
    const weeklyChange =
      river.history.flows.length > 0
        ? (((river.current.flow?.flow || 0) - (river.history.flows[river.history.flows.length - 1]?.flow || 0)) /
            (river.history.flows[river.history.flows.length - 1]?.flow || 1)) *
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
          <CardTitle className="text-base sm:text-lg">Abfluss</CardTitle>
          {river.changes.flowPercentage !== undefined && (
            <span className="text-sm font-normal">
              {getChangeIndicator(river.changes.flowPercentage, river.changes.flowStatus, true)}
            </span>
          )}
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
