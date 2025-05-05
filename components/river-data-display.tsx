"use client"

import type { RiverData, RiversData } from "@/utils/water-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts"
import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface RiverDataDisplayProps {
  data: RiversData
}

type TimeRangeOption = "1h" | "2h" | "6h" | "12h" | "24h" | "48h" | "1w"
type DataType = "level" | "temperature" | "flow"

export function RiverDataDisplay({ data }: RiverDataDisplayProps) {
  const [timeRange, setTimeRange] = useState<TimeRangeOption>("12h")
  const [activeDataType, setActiveDataType] = useState<DataType>("flow")
  const [activeRiver, setActiveRiver] = useState<RiverData>(data.rivers[0])
  const [isMobile, setIsMobile] = useState(false)

  // Detect if we're on mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    // Initial check
    checkIfMobile()

    // Add event listener
    window.addEventListener("resize", checkIfMobile)

    // Cleanup
    return () => window.removeEventListener("resize", checkIfMobile)
  }, [])

  if (!data || !data.rivers || data.rivers.length === 0) {
    return (
      <div className="p-6 bg-yellow-50 rounded-lg border border-yellow-200">
        <p className="text-yellow-800 font-medium">Flussdaten konnten nicht geladen werden.</p>
        {data?.error && <p className="text-sm text-yellow-700 mt-2">Fehler: {data.error}</p>}
      </div>
    )
  }

  // Prozentuale Änderung mit entsprechendem Emoji formatieren
  const getChangeIndicator = (percentage: number, status: string, compact = false) => {
    if (percentage === undefined || percentage === null) return "Keine Daten"

    // Formatiere die Änderung: Bei Werten über 10% keine Dezimalstellen, sonst eine
    const formattedChange = Math.abs(percentage) >= 10 ? Math.round(percentage).toString() : percentage.toFixed(1)

    let emoji = "→"
    let colorClass = "text-gray-700"

    switch (status) {
      case "large-increase":
        emoji = "🔴 ↑↑"
        colorClass = "text-red-600 font-bold"
        break
      case "large-decrease":
        emoji = "🔴 ↓↓"
        colorClass = "text-red-600 font-bold"
        break
      case "medium-increase":
        emoji = "🟡 ↑"
        colorClass = "text-amber-600 font-bold"
        break
      case "medium-decrease":
        emoji = "🟡 ↓"
        colorClass = "text-amber-600 font-bold"
        break
      case "small-increase":
        emoji = "↗️"
        colorClass = "text-blue-600"
        break
      case "small-decrease":
        emoji = "↘️"
        colorClass = "text-blue-600"
        break
      default:
        emoji = "→"
        colorClass = "text-gray-700"
    }

    if (compact) {
      return (
        <span className={colorClass}>
          {emoji} {percentage > 0 ? "+" : ""}
          {formattedChange}% in 24h
        </span>
      )
    }

    return (
      <span className={colorClass}>
        {emoji} {percentage > 0 ? "+" : ""}
        {formattedChange}%
      </span>
    )
  }

  // Temperaturänderung mit entsprechendem Emoji formatieren
  const getTemperatureChangeIndicator = (change: number, status: string, compact = false) => {
    if (change === undefined || change === null) return "Keine Daten"

    // Formatiere die Änderung: Bei Werten über 10°C keine Dezimalstellen, sonst eine
    const formattedChange = Math.abs(change) >= 10 ? Math.round(change).toString() : change.toFixed(1)

    let emoji = "→"
    let colorClass = "text-gray-700"

    switch (status) {
      case "large-increase":
        emoji = "🔴 ↑↑"
        colorClass = "text-red-600 font-bold"
        break
      case "large-decrease":
        emoji = "🔴 ↓↓"
        colorClass = "text-red-600 font-bold"
        break
      case "medium-increase":
        emoji = "🟡 ↑"
        colorClass = "text-amber-600 font-bold"
        break
      case "medium-decrease":
        emoji = "🟡 ↓"
        colorClass = "text-amber-600 font-bold"
        break
      case "small-increase":
        emoji = "↗️"
        colorClass = "text-blue-600"
        break
      case "small-decrease":
        emoji = "↘️"
        colorClass = "text-blue-600"
        break
      default:
        emoji = "→"
        colorClass = "text-gray-700"
    }

    if (compact) {
      return (
        <span className={colorClass}>
          {emoji} {change > 0 ? "+" : ""}
          {formattedChange}°C in 24h
        </span>
      )
    }

    return (
      <span className={colorClass}>
        {emoji} {change > 0 ? "+" : ""}
        {formattedChange}°C
      </span>
    )
  }

  // Diagrammdaten für Wasserstände vorbereiten
  const getLevelChartData = (river: RiverData) => {
    let filteredData = [...river.history.levels]

    // Nach ausgewähltem Zeitbereich filtern
    if (timeRange === "1h") {
      filteredData = filteredData.slice(0, 4) // 1 Stunde × 4 Datenpunkte pro Stunde (15-Minuten-Intervalle)
    } else if (timeRange === "2h") {
      filteredData = filteredData.slice(0, 8) // 2 Stunden × 4 Datenpunkte pro Stunde
    } else if (timeRange === "6h") {
      filteredData = filteredData.slice(0, 24) // 6 Stunden × 4 Datenpunkte pro Stunde
    } else if (timeRange === "12h") {
      filteredData = filteredData.slice(0, 48) // 12 Stunden × 4 Datenpunkte pro Stunde
    } else if (timeRange === "24h") {
      filteredData = filteredData.slice(0, 96) // 24 Stunden × 4 Datenpunkte pro Stunde
    } else if (timeRange === "48h") {
      filteredData = filteredData.slice(0, 192) // 48 Stunden × 4 Datenpunkte pro Stunde
    } else if (timeRange === "1w") {
      filteredData = filteredData.slice(0, 672) // 7 Tage × 24 Stunden × 4 Datenpunkte pro Stunde
    }

    // Für längere Zeiträume: Datenpunkte reduzieren, um die Anzeige zu verbessern
    if (timeRange === "1w" && filteredData.length > 100) {
      const step = Math.ceil(filteredData.length / 100)
      filteredData = filteredData.filter((_, index) => index % step === 0)
    }

    // Umkehren, um älteste bis neueste anzuzeigen
    return filteredData.reverse().map((point) => {
      // Für längere Zeiträume (> 48h) zeigen wir Datum und Uhrzeit an
      const isLongTimeRange = timeRange === "1w"
      const dateParts = point.date.split(" ")
      const timePart = dateParts[1].substring(0, 5) // HH:MM extrahieren

      // Bei längeren Zeiträumen zeigen wir das Datum im Format "DD.MM. HH:MM" an
      const label = isLongTimeRange
        ? `${dateParts[0].substring(0, 5)} ${timePart}` // "DD.MM. HH:MM"
        : timePart // Nur "HH:MM" für kürzere Zeiträume

      return {
        time: timePart,
        label: label,
        level: point.level,
        fullDate: point.date, // Vollständiges Datum für Tooltip
      }
    })
  }

  // Diagrammdaten für Wassertemperaturen vorbereiten
  const getTemperatureChartData = (river: RiverData) => {
    let filteredData = [...river.history.temperatures]

    // Nach ausgewähltem Zeitbereich filtern
    if (timeRange === "1h") {
      filteredData = filteredData.slice(0, 4) // 1 Stunde × 4 Datenpunkte pro Stunde
    } else if (timeRange === "2h") {
      filteredData = filteredData.slice(0, 8) // 2 Stunden × 4 Datenpunkte pro Stunde
    } else if (timeRange === "6h") {
      filteredData = filteredData.slice(0, 24) // 6 Stunden × 4 Datenpunkte pro Stunde
    } else if (timeRange === "12h") {
      filteredData = filteredData.slice(0, 48) // 12 Stunden × 4 Datenpunkte pro Stunde
    } else if (timeRange === "24h") {
      filteredData = filteredData.slice(0, 96) // 24 Stunden × 4 Datenpunkte pro Stunde
    } else if (timeRange === "48h") {
      filteredData = filteredData.slice(0, 192) // 48 Stunden × 4 Datenpunkte pro Stunde
    } else if (timeRange === "1w") {
      filteredData = filteredData.slice(0, 672) // 7 Tage × 24 Stunden × 4 Datenpunkte pro Stunde
    }

    // Für längere Zeiträume: Datenpunkte reduzieren, um die Anzeige zu verbessern
    if (timeRange === "1w" && filteredData.length > 100) {
      const step = Math.ceil(filteredData.length / 100)
      filteredData = filteredData.filter((_, index) => index % step === 0)
    }

    // Umkehren, um älteste bis neueste anzuzeigen
    return filteredData.reverse().map((point) => {
      // Für längere Zeiträume (> 48h) zeigen wir Datum und Uhrzeit an
      const isLongTimeRange = timeRange === "1w"
      const dateParts = point.date.split(" ")
      const timePart = dateParts[1].substring(0, 5) // HH:MM extrahieren

      // Bei längeren Zeiträumen zeigen wir das Datum im Format "DD.MM. HH:MM" an
      const label = isLongTimeRange
        ? `${dateParts[0].substring(0, 5)} ${timePart}` // "DD.MM. HH:MM"
        : timePart // Nur "HH:MM" für kürzere Zeiträume

      return {
        time: timePart,
        label: label,
        temperature: point.temperature,
        fullDate: point.date, // Vollständiges Datum für Tooltip
      }
    })
  }

  // Diagrammdaten für Abflüsse vorbereiten
  const getFlowChartData = (river: RiverData) => {
    let filteredData = [...river.history.flows]

    // Nach ausgewähltem Zeitbereich filtern
    if (timeRange === "1h") {
      filteredData = filteredData.slice(0, 4) // 1 Stunde × 4 Datenpunkte pro Stunde
    } else if (timeRange === "2h") {
      filteredData = filteredData.slice(0, 8) // 2 Stunden × 4 Datenpunkte pro Stunde
    } else if (timeRange === "6h") {
      filteredData = filteredData.slice(0, 24) // 6 Stunden × 4 Datenpunkte pro Stunde
    } else if (timeRange === "12h") {
      filteredData = filteredData.slice(0, 48) // 12 Stunden × 4 Datenpunkte pro Stunde
    } else if (timeRange === "24h") {
      filteredData = filteredData.slice(0, 96) // 24 Stunden × 4 Datenpunkte pro Stunde
    } else if (timeRange === "48h") {
      filteredData = filteredData.slice(0, 192) // 48 Stunden × 4 Datenpunkte pro Stunde
    } else if (timeRange === "1w") {
      filteredData = filteredData.slice(0, 672) // 7 Tage × 24 Stunden × 4 Datenpunkte pro Stunde
    }

    // Für längere Zeiträume: Datenpunkte reduzieren, um die Anzeige zu verbessern
    if (timeRange === "1w" && filteredData.length > 100) {
      const step = Math.ceil(filteredData.length / 100)
      filteredData = filteredData.filter((_, index) => index % step === 0)
    }

    // Umkehren, um älteste bis neueste anzuzeigen
    return filteredData.reverse().map((point) => {
      // Für längere Zeiträume (> 48h) zeigen wir Datum und Uhrzeit an
      const isLongTimeRange = timeRange === "1w"
      const dateParts = point.date.split(" ")
      const timePart = dateParts[1].substring(0, 5) // HH:MM extrahieren

      // Bei längeren Zeiträumen zeigen wir das Datum im Format "DD.MM. HH:MM" an
      const label = isLongTimeRange
        ? `${dateParts[0].substring(0, 5)} ${timePart}` // "DD.MM. HH:MM"
        : timePart // Nur "HH:MM" für kürzere Zeiträume

      return {
        time: timePart,
        label: label,
        flow: point.flow,
        fullDate: point.date, // Vollständiges Datum für Tooltip
      }
    })
  }

  // Bestimmt den Gesamtstatus eines Flusses basierend auf dem 24h Abfluss-Trend
  const getRiverStatusForLastSixHours = (river: RiverData): { emoji: string; direction: string } => {
    // Standardwerte
    let emoji = "🟢"
    let direction = ""

    // Verwende die 24h Abfluss-Änderung aus den API-Daten
    if (river.changes.flowPercentage !== undefined && river.changes.flowStatus) {
      const flowPercentage = river.changes.flowPercentage

      // Status basierend auf der Änderung bestimmen
      if (Math.abs(flowPercentage) > 15) {
        emoji = "🔴" // Große Änderung (>15%)
      } else if (Math.abs(flowPercentage) > 5) {
        emoji = "🟡" // Mittlere Änderung (5-15%)
      }

      // Richtung bestimmen
      direction = flowPercentage > 0 ? "↑" : flowPercentage < 0 ? "↓" : ""

      return { emoji, direction }
    }

    // Fallback: Wenn keine Abflussdaten vorhanden sind, prüfe Pegel
    if (river.changes.levelPercentage !== undefined) {
      const levelPercentage = river.changes.levelPercentage

      // Status basierend auf der Änderung bestimmen
      if (Math.abs(levelPercentage) > 15) {
        emoji = "🔴" // Große Änderung (>15%)
      } else if (Math.abs(levelPercentage) > 5) {
        emoji = "🟡" // Mittlere Änderung (5-15%)
      }

      // Richtung bestimmen
      direction = levelPercentage > 0 ? "↑" : levelPercentage < 0 ? "↓" : ""
    }

    return { emoji, direction }
  }

  // Berechnet die prozentuale Änderung für den ausgewählten Zeitraum
  const calculateTimeRangeChange = (river: RiverData, dataType: DataType) => {
    // Wenn der Zeitraum 24h ist und wir bereits die 24h-Änderung aus den API-Daten haben,
    // verwenden wir diese für Konsistenz
    if (timeRange === "24h") {
      if (dataType === "level" && river.changes.levelPercentage !== undefined) {
        return {
          percentChange: river.changes.levelPercentage,
          absoluteChange: river.current.level.level - (river.previousDay?.level?.level || river.current.level.level),
          status: river.changes.levelStatus,
          timeSpan: timeRange,
        }
      } else if (dataType === "temperature" && river.changes.temperatureChange !== undefined) {
        return {
          percentChange: (river.changes.temperatureChange / river.previousDay?.temperature?.temperature) * 100 || 0,
          absoluteChange: river.changes.temperatureChange,
          status: river.changes.temperatureStatus,
          timeSpan: timeRange,
        }
      } else if (dataType === "flow" && river.changes.flowPercentage !== undefined) {
        return {
          percentChange: river.changes.flowPercentage,
          absoluteChange: river.current.flow.flow - (river.previousDay?.flow?.flow || river.current.flow.flow),
          status: river.changes.flowStatus,
          timeSpan: timeRange,
        }
      }
    }

    // Bestimme die Datenquelle basierend auf dem Typ
    let data: any[] = []
    if (dataType === "level") {
      data = [...river.history.levels]
    } else if (dataType === "temperature") {
      data = [...river.history.temperatures]
    } else if (dataType === "flow") {
      data = [...river.history.flows]
    }

    if (data.length === 0) return { change: null, status: "stable" }

    // Aktuelle Werte (neuester Datenpunkt)
    const current = data[0]

    // Bestimme den Vergleichszeitpunkt basierend auf dem ausgewählten Zeitraum
    // Jeder Datenpunkt ist in 15-Minuten-Intervallen
    let compareIndex = 0
    if (timeRange === "1h" && data.length > 4) {
      compareIndex = 4 // 1 Stunde = 4 Datenpunkte (15-Minuten-Intervalle)
    } else if (timeRange === "2h" && data.length > 8) {
      compareIndex = 8 // 2 Stunden = 8 Datenpunkte
    } else if (timeRange === "6h" && data.length > 24) {
      compareIndex = 24 // 6 Stunden = 24 Datenpunkte
    } else if (timeRange === "12h" && data.length > 48) {
      compareIndex = 48 // 12 Stunden = 48 Datenpunkte
    } else if (timeRange === "24h" && data.length > 96) {
      compareIndex = 96 // 24 Stunden = 96 Datenpunkte
    } else if (timeRange === "48h" && data.length > 192) {
      compareIndex = 192 // 48 Stunden = 192 Datenpunkte
    } else if (timeRange === "1w" && data.length > 672) {
      compareIndex = 672 // 1 Woche = 672 Datenpunkte
    } else if (data.length > 1) {
      // Wenn nicht genügend Daten vorhanden sind, verwende den ältesten verfügbaren Datenpunkt
      compareIndex = data.length - 1
    }

    // Wenn kein Vergleichswert verfügbar ist, keine Änderung zurückgeben
    if (compareIndex >= data.length) return { change: null, status: "stable" }

    const compareValue = data[compareIndex]

    // Berechne die prozentuale Änderung
    let percentChange = 0
    let absoluteChange = 0

    if (dataType === "level") {
      if (compareValue.level > 0) {
        percentChange = ((current.level - compareValue.level) / compareValue.level) * 100
      }
      absoluteChange = current.level - compareValue.level
    } else if (dataType === "temperature") {
      if (compareValue.temperature > 0) {
        percentChange = ((current.temperature - compareValue.temperature) / compareValue.temperature) * 100
      }
      absoluteChange = current.temperature - compareValue.temperature
    } else if (dataType === "flow") {
      if (compareValue.flow > 0) {
        percentChange = ((current.flow - compareValue.flow) / compareValue.flow) * 100
      }
      absoluteChange = current.flow - compareValue.flow
    }

    // Bestimme den Status basierend auf der prozentualen Änderung
    // Angepasste Schwellenwerte für konsistente Statuseinstufungen
    const getChangeStatus = (percentage: number) => {
      if (percentage === undefined || percentage === null) return "stable"

      if (percentage > 50) return "large-increase"
      if (percentage < -50) return "large-decrease"
      if (percentage > 15) return "large-increase"
      if (percentage < -15) return "large-decrease"
      if (percentage > 5) return "medium-increase"
      if (percentage < -5) return "medium-decrease"
      if (percentage > 0) return "small-increase"
      if (percentage < 0) return "small-decrease"
      return "stable"
    }

    const status = getChangeStatus(percentChange)

    return {
      percentChange,
      absoluteChange,
      status,
      timeSpan: timeRange,
    }
  }

  // Formatiert den Trend für den ausgewählten Zeitraum
  const formatTrendForTimeRange = (river: RiverData, dataType: DataType) => {
    const change = calculateTimeRangeChange(river, dataType)
    if (change.percentChange === null) return null

    let colorClass = "text-gray-700"

    switch (change.status) {
      case "large-increase":
        colorClass = "text-red-600 font-bold"
        break
      case "large-decrease":
        colorClass = "text-red-600 font-bold"
        break
      case "medium-increase":
        colorClass = "text-amber-600 font-bold"
        break
      case "medium-decrease":
        colorClass = "text-amber-600 font-bold"
        break
      case "small-increase":
        colorClass = "text-blue-600"
        break
      case "small-decrease":
        colorClass = "text-blue-600"
        break
      default:
        colorClass = "text-gray-700"
    }

    const emoji =
      change.status === "large-increase"
        ? "🔴 ↑↑"
        : change.status === "large-decrease"
          ? "🔴 ↓↓"
          : change.status === "medium-increase"
            ? "🟡 ↑"
            : change.status === "medium-decrease"
              ? "🟡 ↓"
              : change.status === "small-increase"
                ? "↗️"
                : change.status === "small-decrease"
                  ? "↘️"
                  : "→"

    // Zeitbereichstext für die Anzeige
    const getTimeRangeText = () => {
      const option = timeRangeOptions.find((opt) => opt.value === timeRange)
      return option ? option.label : "Zeitraum"
    }

    if (dataType === "temperature") {
      // Formatiere die Temperaturänderung: Bei Werten über 10°C keine Dezimalstellen, sonst eine
      const formattedChange =
        Math.abs(change.absoluteChange) >= 10
          ? Math.round(change.absoluteChange).toString()
          : change.absoluteChange.toFixed(1)

      return (
        <span className={colorClass}>
          {emoji} {change.absoluteChange > 0 ? "+" : ""}
          {formattedChange}°C in {getTimeRangeText().toLowerCase()}
        </span>
      )
    } else {
      // Formatiere die prozentuale Änderung: Bei Werten über 10% keine Dezimalstellen, sonst eine
      const formattedChange =
        Math.abs(change.percentChange) >= 10
          ? Math.round(change.percentChange).toString()
          : change.percentChange.toFixed(1)

      return (
        <span className={colorClass}>
          {emoji} {change.percentChange > 0 ? "+" : ""}
          {formattedChange}% in {getTimeRangeText().toLowerCase()}
        </span>
      )
    }
  }

  // Zeitbereichsoptionen für das Dropdown-Menü
  const timeRangeOptions = [
    { value: "1h", label: "1 Stunde" },
    { value: "2h", label: "2 Stunden" },
    { value: "6h", label: "6 Stunden" },
    { value: "12h", label: "12 Stunden" },
    { value: "24h", label: "24 Stunden" },
    { value: "48h", label: "48 Stunden" },
    { value: "1w", label: "1 Woche" },
  ]

  // Hilfsfunktion zum Rendern des aktuellen Diagramms basierend auf dem aktiven Datentyp
  const renderActiveChart = (river: RiverData) => {
    if (activeDataType === "level" && river.history.levels.length > 0) {
      const chartData = getLevelChartData(river)
      const isLongTimeRange = timeRange === "1w"

      return (
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey={isLongTimeRange ? "label" : "time"}
                tick={{ fontSize: 10 }}
                interval={
                  isMobile
                    ? timeRange === "1h"
                      ? 1 // Mobile: Alle 30 Minuten
                      : timeRange === "2h"
                        ? 3 // Mobile: Alle 1 Stunde
                        : timeRange === "6h"
                          ? 11 // Mobile: Alle 3 Stunden
                          : timeRange === "12h"
                            ? 23 // Mobile: Alle 6 Stunden
                            : timeRange === "24h"
                              ? 47 // Mobile: Alle 12 Stunden
                              : timeRange === "48h"
                                ? 95 // Mobile: Alle 24 Stunden
                                : isLongTimeRange
                                  ? Math.floor(chartData.length / 4) // Mobile: Für längere Zeiträume weniger Beschriftungen
                                  : Math.floor(chartData.length / 5)
                    : timeRange === "1h"
                      ? 0 // Desktop: Alle 15 Minuten
                      : timeRange === "2h"
                        ? 1 // Desktop: Alle 30 Minuten
                        : timeRange === "6h"
                          ? 3 // Desktop: Alle 1 Stunde
                          : timeRange === "12h"
                            ? 7 // Desktop: Alle 2 Stunden
                            : timeRange === "24h"
                              ? 11 // Desktop: Alle 3 Stunden
                              : timeRange === "48h"
                                ? 23 // Desktop: Alle 6 Stunden
                                : isLongTimeRange
                                  ? Math.floor(chartData.length / 8) // Desktop: Für längere Zeiträume weniger Beschriftungen
                                  : Math.floor(chartData.length / 10)
                }
                angle={isLongTimeRange ? -45 : 0}
                textAnchor={isLongTimeRange ? "end" : "middle"}
                height={isLongTimeRange ? 60 : 30}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickCount={6}
                tickFormatter={(value) => Math.round(value).toString()}
                tick={{ fontSize: 10 }}
                width={30}
              />
              {!isMobile && (
                <Tooltip
                  formatter={(value) => [`${value} cm`, "Pegel"]}
                  labelFormatter={(_, data) => {
                    if (!data || !data[0] || !data[0].payload) return "Zeit: Unbekannt"
                    return `Zeit: ${data[0].payload.fullDate}`
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="level"
                stroke="#2563eb"
                fill="#dbeafe"
                strokeWidth={2}
                dot={!isMobile ? { r: 2 } : false}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )
    } else if (activeDataType === "temperature" && river.history.temperatures.length > 0) {
      const chartData = getTemperatureChartData(river)
      const isLongTimeRange = timeRange === "1w"

      return (
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey={isLongTimeRange ? "label" : "time"}
                tick={{ fontSize: 10 }}
                interval={
                  isMobile
                    ? timeRange === "1h"
                      ? 1 // Mobile: Alle 30 Minuten
                      : timeRange === "2h"
                        ? 3 // Mobile: Alle 1 Stunde
                        : timeRange === "6h"
                          ? 11 // Mobile: Alle 3 Stunden
                          : timeRange === "12h"
                            ? 23 // Mobile: Alle 6 Stunden
                            : timeRange === "24h"
                              ? 47 // Mobile: Alle 12 Stunden
                              : timeRange === "48h"
                                ? 95 // Mobile: Alle 24 Stunden
                                : isLongTimeRange
                                  ? Math.floor(chartData.length / 4) // Mobile: Für längere Zeiträume weniger Beschriftungen
                                  : Math.floor(chartData.length / 5)
                    : timeRange === "1h"
                      ? 0 // Desktop: Alle 15 Minuten
                      : timeRange === "2h"
                        ? 1 // Desktop: Alle 30 Minuten
                        : timeRange === "6h"
                          ? 3 // Desktop: Alle 1 Stunde
                          : timeRange === "12h"
                            ? 7 // Desktop: Alle 2 Stunden
                            : timeRange === "24h"
                              ? 11 // Desktop: Alle 3 Stunden
                              : timeRange === "48h"
                                ? 23 // Desktop: Alle 6 Stunden
                                : isLongTimeRange
                                  ? Math.floor(chartData.length / 8) // Desktop: Für längere Zeiträume weniger Beschriftungen
                                  : Math.floor(chartData.length / 10)
                }
                angle={isLongTimeRange ? -45 : 0}
                textAnchor={isLongTimeRange ? "end" : "middle"}
                height={isLongTimeRange ? 60 : 30}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickCount={6}
                tickFormatter={(value) => Math.round(value).toString()}
                tick={{ fontSize: 10 }}
                width={30}
              />
              {!isMobile && (
                <Tooltip
                  formatter={(value) => [`${value}°C`, "Temperatur"]}
                  labelFormatter={(_, data) => {
                    if (!data || !data[0] || !data[0].payload) return "Zeit: Unbekannt"
                    return `Zeit: ${data[0].payload.fullDate}`
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="temperature"
                stroke="#ea580c"
                fill="#ffedd5"
                strokeWidth={2}
                dot={!isMobile ? { r: 2 } : false}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )
    } else if (activeDataType === "flow" && river.history.flows.length > 0) {
      const chartData = getFlowChartData(river)
      const isLongTimeRange = timeRange === "1w"

      return (
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey={isLongTimeRange ? "label" : "time"}
                tick={{ fontSize: 10 }}
                interval={
                  isMobile
                    ? timeRange === "1h"
                      ? 1 // Mobile: Alle 30 Minuten
                      : timeRange === "2h"
                        ? 3 // Mobile: Alle 1 Stunde
                        : timeRange === "6h"
                          ? 11 // Mobile: Alle 3 Stunden
                          : timeRange === "12h"
                            ? 23 // Mobile: Alle 6 Stunden
                            : timeRange === "24h"
                              ? 47 // Mobile: Alle 12 Stunden
                              : timeRange === "48h"
                                ? 95 // Mobile: Alle 24 Stunden
                                : isLongTimeRange
                                  ? Math.floor(chartData.length / 4) // Mobile: Für längere Zeiträume weniger Beschriftungen
                                  : Math.floor(chartData.length / 5)
                    : timeRange === "1h"
                      ? 0 // Desktop: Alle 15 Minuten
                      : timeRange === "2h"
                        ? 1 // Desktop: Alle 30 Minuten
                        : timeRange === "6h"
                          ? 3 // Desktop: Alle 1 Stunde
                          : timeRange === "12h"
                            ? 7 // Desktop: Alle 2 Stunden
                            : timeRange === "24h"
                              ? 11 // Desktop: Alle 3 Stunden
                              : timeRange === "48h"
                                ? 23 // Desktop: Alle 6 Stunden
                                : isLongTimeRange
                                  ? Math.floor(chartData.length / 8) // Desktop: Für längere Zeiträume weniger Beschriftungen
                                  : Math.floor(chartData.length / 10)
                }
                angle={isLongTimeRange ? -45 : 0}
                textAnchor={isLongTimeRange ? "end" : "middle"}
                height={isLongTimeRange ? 60 : 30}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickCount={6}
                tickFormatter={(value) => Math.round(value).toString()}
                tick={{ fontSize: 10 }}
                width={30}
              />
              {!isMobile && (
                <Tooltip
                  formatter={(value) => [`${value} m³/s`, "Abfluss"]}
                  labelFormatter={(_, data) => {
                    if (!data || !data[0] || !data[0].payload) return "Zeit: Unbekannt"
                    return `Zeit: ${data[0].payload.fullDate}`
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="flow"
                stroke="#16a34a"
                fill="#dcfce7"
                strokeWidth={2}
                dot={!isMobile ? { r: 2 } : false}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )
    } else {
      return (
        <div className="h-[300px] flex items-center justify-center text-gray-500">
          Keine Daten verfügbar für den ausgewählten Typ
        </div>
      )
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex mb-2 sm:mb-4">
        <div className="w-[68%] pr-[0.2rem]">
          <Select
            defaultValue={data.rivers[0].name.toLowerCase()}
            onValueChange={(value) => {
              // Find the selected river
              const selectedRiver = data.rivers.find((r) => r.name.toLowerCase() === value)
              if (selectedRiver) {
                // Set active river
                setActiveRiver(selectedRiver)
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Gewässer auswählen" />
            </SelectTrigger>
            <SelectContent>
              {data.rivers.map((river) => {
                const { emoji, direction } = getRiverStatusForLastSixHours(river)
                return (
                  <SelectItem key={river.name} value={river.name.toLowerCase()}>
                    {emoji} {direction} {river.name} ({river.location})
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[32%] pl-0">
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRangeOption)}>
            <SelectTrigger className="pl-2">
              <SelectValue placeholder="Zeitraum wählen" />
            </SelectTrigger>
            <SelectContent>
              {timeRangeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Display the active river data */}
      <div className="space-y-4 sm:space-y-6">
        <div className="grid gap-4">
          {/* Desktop layout: Abfluss, Pegel, and Temperatur in a row above the chart */}
          <div className="hidden md:grid md:grid-cols-3 gap-4">
            {/* Abfluss-Karte */}
            <Card
              className={`cursor-pointer transition-all ${activeDataType === "flow" ? "bg-gray-50" : "hover:bg-gray-50"}`}
              onClick={() => setActiveDataType("flow")}
            >
              <CardHeader className="pb-2 p-3 sm:p-6">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base sm:text-lg">Abfluss</CardTitle>
                  {activeRiver.changes.flowPercentage !== undefined && (
                    <span className="text-sm font-normal">
                      {getChangeIndicator(activeRiver.changes.flowPercentage, activeRiver.changes.flowStatus, true)}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                {activeRiver.current.flow ? (
                  <div
                    className={`text-3xl font-bold ${
                      activeRiver.changes.flowStatus === "large-increase" ||
                      activeRiver.changes.flowStatus === "large-decrease"
                        ? "text-red-600"
                        : "text-black"
                    }`}
                  >
                    {activeRiver.current.flow.flow.toFixed(1)} m³/s
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">Keine Daten verfügbar</div>
                )}
              </CardContent>
            </Card>

            {/* Pegel-Karte */}
            <Card
              className={`cursor-pointer transition-all ${activeDataType === "level" ? "bg-gray-50" : "hover:bg-gray-50"}`}
              onClick={() => setActiveDataType("level")}
            >
              <CardHeader className="pb-2 p-3 sm:p-6">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base sm:text-lg">Pegel</CardTitle>
                  {activeRiver.changes.levelPercentage !== undefined && (
                    <span className="text-sm font-normal">
                      {getChangeIndicator(activeRiver.changes.levelPercentage, activeRiver.changes.levelStatus, true)}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                {activeRiver.current.level ? (
                  <div
                    className={`text-3xl font-bold ${
                      activeRiver.changes.levelStatus === "large-increase" ||
                      activeRiver.changes.levelStatus === "large-decrease"
                        ? "text-red-600"
                        : "text-black"
                    }`}
                  >
                    {activeRiver.current.level.level} cm
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">Keine Daten verfügbar</div>
                )}
              </CardContent>
            </Card>

            {/* Temperatur-Karte */}
            <Card
              className={`cursor-pointer transition-all ${activeDataType === "temperature" ? "bg-gray-50" : "hover:bg-gray-50"}`}
              onClick={() => (activeRiver.urls.temperature ? setActiveDataType("temperature") : null)}
            >
              <CardHeader className="pb-2 p-3 sm:p-6">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base sm:text-lg">Temperatur</CardTitle>
                  {activeRiver.changes.temperatureChange !== undefined && (
                    <span className="text-sm font-normal">
                      {getTemperatureChangeIndicator(
                        activeRiver.changes.temperatureChange,
                        activeRiver.changes.temperatureStatus,
                        true,
                      )}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                {activeRiver.current.temperature ? (
                  <div
                    className={`text-3xl font-bold ${
                      activeRiver.changes.temperatureStatus === "large-increase" ||
                      activeRiver.changes.temperatureStatus === "large-decrease"
                        ? "text-red-600"
                        : "text-black"
                    }`}
                  >
                    {activeRiver.current.temperature.temperature.toFixed(1)}°C
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">Keine Temperaturdaten verfügbar</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Mobile layout: Only Abfluss card above the chart */}
          <div className="md:hidden">
            <Card
              className={`cursor-pointer transition-all ${activeDataType === "flow" ? "bg-gray-50" : "hover:bg-gray-50"}`}
              onClick={() => setActiveDataType("flow")}
            >
              <CardHeader className="pb-2 p-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base sm:text-lg">Abfluss</CardTitle>
                  {activeRiver.changes.flowPercentage !== undefined && (
                    <span className="text-sm font-normal">
                      {getChangeIndicator(activeRiver.changes.flowPercentage, activeRiver.changes.flowStatus, true)}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {activeRiver.current.flow ? (
                  <div
                    className={`text-3xl font-bold ${
                      activeRiver.changes.flowStatus === "large-increase" ||
                      activeRiver.changes.flowStatus === "large-decrease"
                        ? "text-red-600"
                        : "text-black"
                    }`}
                  >
                    {activeRiver.current.flow.flow.toFixed(1)} m³/s
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">Keine Daten verfügbar</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Diagramm-Bereich (always visible) */}
          <Card>
            <CardHeader className="pb-2 p-3 sm:p-6">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base sm:text-lg">Entwicklung</CardTitle>
                <span className="text-sm font-normal">{formatTrendForTimeRange(activeRiver, activeDataType)}</span>
              </div>
            </CardHeader>
            <CardContent className="p-1 sm:p-3">{renderActiveChart(activeRiver)}</CardContent>
          </Card>

          {/* Mobile layout: Pegel and Temperatur cards below the chart */}
          <div className="md:hidden grid grid-cols-2 gap-4">
            {/* Pegel-Karte */}
            <Card
              className={`cursor-pointer transition-all ${activeDataType === "level" ? "bg-gray-50" : "hover:bg-gray-50"}`}
              onClick={() => setActiveDataType("level")}
            >
              <CardHeader className="pb-2 p-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base sm:text-lg">Pegel</CardTitle>
                </div>
                {activeRiver.changes.levelPercentage !== undefined && (
                  <div className="text-sm font-normal mt-1">
                    {getChangeIndicator(activeRiver.changes.levelPercentage, activeRiver.changes.levelStatus, true)}
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {activeRiver.current.level ? (
                  <div
                    className={`text-3xl font-bold ${
                      activeRiver.changes.levelStatus === "large-increase" ||
                      activeRiver.changes.levelStatus === "large-decrease"
                        ? "text-red-600"
                        : "text-black"
                    }`}
                  >
                    {activeRiver.current.level.level} cm
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">Keine Daten verfügbar</div>
                )}
              </CardContent>
            </Card>

            {/* Temperatur-Karte */}
            <Card
              className={`cursor-pointer transition-all ${activeDataType === "temperature" ? "bg-gray-50" : "hover:bg-gray-50"}`}
              onClick={() => (activeRiver.urls.temperature ? setActiveDataType("temperature") : null)}
            >
              <CardHeader className="pb-2 p-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base sm:text-lg">Temperatur</CardTitle>
                </div>
                {activeRiver.changes.temperatureChange !== undefined && (
                  <div className="text-sm font-normal mt-1">
                    {getTemperatureChangeIndicator(
                      activeRiver.changes.temperatureChange,
                      activeRiver.changes.temperatureStatus,
                      true,
                    )}
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {activeRiver.current.temperature ? (
                  <div
                    className={`text-3xl font-bold ${
                      activeRiver.changes.temperatureStatus === "large-increase" ||
                      activeRiver.changes.temperatureStatus === "large-decrease"
                        ? "text-red-600"
                        : "text-black"
                    }`}
                  >
                    {activeRiver.current.temperature.temperature.toFixed(1)}°C
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">Keine Temperaturdaten verfügbar</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-500 text-center space-x-2">
        <span>Datenquellen:</span>
        {activeRiver.current.flow && (
          <a
            href={activeRiver.urls.flow}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-green-600"
          >
            Abfluss ({activeRiver.current.flow.date.split(" ")[1].substring(0, 5)})
          </a>
        )}
        {activeRiver.current.flow && activeRiver.current.level && <span>|</span>}
        {activeRiver.current.level && (
          <a
            href={activeRiver.urls.level}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-blue-600"
          >
            Pegel ({activeRiver.current.level.date.split(" ")[1].substring(0, 5)})
          </a>
        )}
        {activeRiver.current.level && activeRiver.current.temperature && <span>|</span>}
        {activeRiver.current.temperature && (
          <a
            href={activeRiver.urls.temperature}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-orange-600"
          >
            Temperatur ({activeRiver.current.temperature.date.split(" ")[1].substring(0, 5)})
          </a>
        )}
      </div>
    </div>
  )
}
