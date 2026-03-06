"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RiverData } from "@/utils/water-data"
import { formatTrendForTimeRange } from "@/utils/formatters"
import type { TimeRangeOption } from "@/components/river-data/time-range-select"
import { useMemo } from "react"
import { GKD_RANGES } from "@/components/river-data/time-range-select"
import type { GkdHistory } from "@/hooks/use-gkd-data"

interface LevelCardProps {
  river: RiverData
  isActive: boolean
  onClick: () => void
  isMobile?: boolean
  timeRange: TimeRangeOption
  extendedHistory?: GkdHistory | null
  isAdminMode?: boolean
}

export function LevelCard({ river, isActive, onClick, isMobile = false, timeRange, extendedHistory, isAdminMode = false }: LevelCardProps) {
  // Memoize the trend display to ensure it updates when timeRange changes
  const trendDisplay = useMemo(() => {
    // For rivers, hide trend for GKD ranges
    if (!river.isLake && GKD_RANGES.has(timeRange)) return null
    try {
      return formatTrendForTimeRange(river, "level", timeRange)
    } catch {
      return null
    }
  }, [river, timeRange])

  // Check if this is a lake with pegelnullpunkt (lake level in m NHN)
  const isLake = river.isLake === true
  const pegelnullpunkt = river.pegelnullpunkt
  const isLakeLevelWithRef = isLake && pegelnullpunkt

  // Get the current level and average from GKD data
  const levelData = useMemo(() => {
    if (isLakeLevelWithRef && extendedHistory?.levels && extendedHistory.levels.length > 0) {
      const levels = extendedHistory.levels
      const latestPoint = levels[levels.length - 1]
      // Calculate average from all data points (24 months)
      const sum = levels.reduce((acc, p) => acc + p.value, 0)
      const average = sum / levels.length
      return {
        current: latestPoint.value,
        average,
        isFromGkd: true
      }
    }
    if (river.current.level) {
      return { current: river.current.level.level, average: null, isFromGkd: false }
    }
    return null
  }, [isLakeLevelWithRef, extendedHistory?.levels, river.current.level])

  // For lakes, check if we have GKD level data
  const hasLevelData = isLakeLevelWithRef
    ? (extendedHistory?.levels && extendedHistory.levels.length > 0)
    : (river.history?.levels && river.history.levels.length > 0)
  const isDisabled = !hasLevelData && !isLakeLevelWithRef

  // Calculate deviation in cm for admin mode coloring
  const deviationCm = useMemo(() => {
    if (levelData?.isFromGkd && levelData.average) {
      return Math.round((levelData.current - levelData.average) * 100)
    }
    return null
  }, [levelData])

  // Admin mode alert level based on deviation from average
  const alertLevel = useMemo(() => {
    if (!isAdminMode || deviationCm === null) return "normal"
    const absDeviation = Math.abs(deviationCm)
    if (absDeviation >= 50) return "alert"
    if (absDeviation >= 10) return "warning"
    return "normal"
  }, [isAdminMode, deviationCm])

  // Get alert emoji for admin mode
  const alertEmoji = useMemo(() => {
    if (!isAdminMode || !isLakeLevelWithRef || !levelData?.isFromGkd) return ""
    switch (alertLevel) {
      case "alert": return "🔴"
      case "warning": return "🟡"
      default: return "🟢"
    }
  }, [isAdminMode, isLakeLevelWithRef, levelData?.isFromGkd, alertLevel])

  // Calculate trend from GKD level data for lakes
  const lakeLevelTrend = useMemo(() => {
    if (!isLakeLevelWithRef || !extendedHistory?.levels || extendedHistory.levels.length < 2) return null

    const levels = extendedHistory.levels
    const latest = levels[levels.length - 1].value

    // Compare based on time range
    const days = timeRange === "1w" ? 7 : timeRange === "2w" ? 14 : timeRange === "1m" ? 30 :
                 timeRange === "6m" ? 180 : timeRange === "12m" ? 365 : 730

    // Find a point approximately 'days' ago
    const targetTimestamp = levels[levels.length - 1].timestamp - (days * 24 * 60 * 60 * 1000)
    let comparePoint = levels[0]
    for (const p of levels) {
      if (p.timestamp <= targetTimestamp) {
        comparePoint = p
        break
      }
    }

    const changeCm = Math.round((latest - comparePoint.value) * 100)
    if (Math.abs(changeCm) < 1) return null

    const sign = changeCm >= 0 ? "+" : ""
    return `${sign}${changeCm} cm`
  }, [isLakeLevelWithRef, extendedHistory?.levels, timeRange])

  // Use lake level trend if available, otherwise use river trend
  const displayTrend = isLakeLevelWithRef ? lakeLevelTrend : trendDisplay

  return (
    <Card
      className={`transition-all ${isActive ? "bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-500" : isDisabled ? "opacity-50" : "hover:bg-muted/50"} ${!isDisabled ? "cursor-pointer" : "cursor-not-allowed"}`}
      onClick={() => !isDisabled && onClick()}
    >
      <CardHeader className="pb-2 p-3 sm:p-6">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base sm:text-lg">Pegel</CardTitle>
          <div className="flex items-center gap-2">
            {alertEmoji && <span>{alertEmoji}</span>}
            {!isMobile && displayTrend && <span className="text-sm font-normal">{displayTrend}</span>}
          </div>
        </div>
        {isMobile && displayTrend && <div className="text-sm font-normal mt-1">{displayTrend}</div>}
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0">
        {isLakeLevelWithRef && levelData?.isFromGkd ? (
          <div>
            <div className="text-4xl font-bold">
              {/* Show deviation from 24-month average in cm */}
              {(() => {
                if (levelData.average) {
                  const deviationCm = Math.round((levelData.current - levelData.average) * 100)
                  const sign = deviationCm >= 0 ? "+" : ""
                  return <>{sign}{deviationCm} <span className="font-bold">cm</span></>
                }
                // Fallback to absolute value
                return <>{levelData.current.toFixed(2)} <span className="font-bold text-2xl">m ü. NN</span></>
              })()}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              24M Mittel: {levelData.average?.toFixed(2)} m ü. NN
            </div>
          </div>
        ) : river.current.level && hasLevelData ? (
          <div className="text-4xl font-bold">
            {river.current.level.level} <span className="font-bold">cm</span>
          </div>
        ) : isLakeLevelWithRef ? (
          <div className="text-muted-foreground text-sm">Lade Pegeldaten...</div>
        ) : (
          <div className="text-muted-foreground text-sm">Keine Daten verfügbar</div>
        )}
      </CardContent>
    </Card>
  )
}
