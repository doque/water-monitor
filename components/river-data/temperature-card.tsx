"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RiverData } from "@/utils/water-data"

interface TemperatureCardProps {
  river: RiverData
  isActive: boolean
  onClick: () => void
  isMobile?: boolean
}

export function TemperatureCard({ river, isActive, onClick, isMobile = false }: TemperatureCardProps) {
  // Use the same color as the flow card based on alert level
  const getTextColorClass = () => {
    if (!river.current.temperature) return "text-foreground"

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
    if (!river.current.temperature) return ""

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
    <Card
      className={`cursor-pointer transition-all ${isActive ? "bg-muted" : "hover:bg-muted/50"}`}
      onClick={() => (river.urls.temperature ? onClick() : null)}
    >
      <CardHeader className="pb-2 p-3 sm:p-6">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base sm:text-lg">Temperatur</CardTitle>
          {!isMobile && river.changes.temperatureChange !== undefined && (
            <span className="text-sm font-normal">
              {getAlertEmoji()} {river.changes.temperatureChange > 0 ? "+" : ""}
              {river.changes.temperatureChange.toFixed(1)}°C
            </span>
          )}
        </div>
        {isMobile && river.changes.temperatureChange !== undefined && (
          <div className="text-sm font-normal mt-1">
            {getAlertEmoji()} {river.changes.temperatureChange > 0 ? "+" : ""}
            {river.changes.temperatureChange.toFixed(1)}°C
          </div>
        )}
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0">
        {river.current.temperature ? (
          <div className={`text-4xl font-bold ${getTextColorClass()}`}>
            {river.current.temperature.temperature.toFixed(1)} <span className="font-bold">°C</span>
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">Keine Temperaturdaten verfügbar</div>
        )}
      </CardContent>
    </Card>
  )
}
