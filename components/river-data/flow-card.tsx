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
          <div
            className={`text-4xl font-bold ${
              river.changes.flowStatus === "large-increase" || river.changes.flowStatus === "large-decrease"
                ? "text-red-600 dark:text-red-400"
                : "text-foreground"
            }`}
          >
            {river.current.flow.flow.toFixed(1)} m³/s
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">Keine Daten verfügbar</div>
        )}
      </CardContent>
    </Card>
  )
}
