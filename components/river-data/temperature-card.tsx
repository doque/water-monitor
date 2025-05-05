"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RiverData } from "@/utils/water-data"
import { getTemperatureChangeIndicator } from "@/utils/formatters"

interface TemperatureCardProps {
  river: RiverData
  isActive: boolean
  onClick: () => void
  isMobile?: boolean
}

export function TemperatureCard({ river, isActive, onClick, isMobile = false }: TemperatureCardProps) {
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
              {getTemperatureChangeIndicator(river.changes.temperatureChange, river.changes.temperatureStatus, true)}
            </span>
          )}
        </div>
        {isMobile && river.changes.temperatureChange !== undefined && (
          <div className="text-sm font-normal mt-1">
            {getTemperatureChangeIndicator(river.changes.temperatureChange, river.changes.temperatureStatus, true)}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0">
        {river.current.temperature ? (
          <div
            className={`text-4xl font-bold ${
              river.changes.temperatureStatus === "large-increase" ||
              river.changes.temperatureStatus === "large-decrease"
                ? "text-red-600 dark:text-red-400"
                : "text-foreground"
            }`}
          >
            {river.current.temperature.temperature.toFixed(1)}°C
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">Keine Temperaturdaten verfügbar</div>
        )}
      </CardContent>
    </Card>
  )
}
