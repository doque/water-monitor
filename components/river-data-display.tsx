"use client"

import type { RiversData } from "@/utils/water-data"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { RiverSelect } from "@/components/river-data/river-select"
import { TimeRangeSelect, type TimeRangeOption } from "@/components/river-data/time-range-select"
import { FlowCard } from "@/components/river-data/flow-card"
import { LevelCard } from "@/components/river-data/level-card"
import { TemperatureCard } from "@/components/river-data/temperature-card"
import { RiverChart, type DataType } from "@/components/river-data/river-chart"
import { WebcamCard } from "@/components/river-data/webcam-card"
import { DataSourcesFooter } from "@/components/river-data/data-sources-footer"
import { extractRiverId } from "@/utils/water-data"

interface RiverDataDisplayProps {
  data: RiversData
}

export function RiverDataDisplay({ data }: RiverDataDisplayProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Extract river IDs for each river
  const riversWithIds = data.rivers.map((river) => ({
    ...river,
    id: extractRiverId(river.urls.level),
  }))

  // Get initial state from URL parameters or use defaults
  const initialRiverId = searchParams.get("id") || extractRiverId(data.rivers[0].urls.level)
  const initialDataType = (searchParams.get("pane") || "flow") as DataType
  const initialTimeRange = (searchParams.get("interval") || "24h") as TimeRangeOption

  // State for UI controls
  const [timeRange, setTimeRange] = useState<TimeRangeOption>(initialTimeRange)
  const [activeDataType, setActiveDataType] = useState<DataType>(initialDataType)
  const [activeRiverId, setActiveRiverId] = useState<string>(initialRiverId)
  const [isMobile, setIsMobile] = useState(false)

  // Find the active river object based on the ID
  const activeRiver = riversWithIds.find((r) => extractRiverId(r.urls.level) === activeRiverId) || riversWithIds[0]

  // Update URL when state changes - but only once on mount and when values actually change
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())

    // Only update params that have changed
    if (params.get("id") !== activeRiverId) {
      params.set("id", activeRiverId)
    }

    if (params.get("pane") !== activeDataType) {
      params.set("pane", activeDataType)
    }

    if (params.get("interval") !== timeRange) {
      params.set("interval", timeRange)
    }

    // Only update URL if params have changed
    const newParamsString = params.toString()
    const currentParamsString = searchParams.toString()

    if (newParamsString !== currentParamsString) {
      router.replace(`?${newParamsString}`, { scroll: false })
    }
  }, [activeRiverId, activeDataType, timeRange, router, searchParams])

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
      <div className="p-6 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <p className="text-yellow-800 dark:text-yellow-300 font-medium">Flussdaten konnten nicht geladen werden.</p>
        {data?.error && <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-2">Fehler: {data.error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-7 sm:col-span-6">
          <RiverSelect rivers={riversWithIds} value={activeRiverId} onValueChange={setActiveRiverId} />
        </div>
        <div className="col-span-5 sm:col-span-6">
          <TimeRangeSelect value={timeRange} onValueChange={setTimeRange} />
        </div>
      </div>

      {/* Display the active river data */}
      <div className="space-y-4 sm:space-y-6">
        <div className="grid gap-4">
          {/* Desktop layout: Flow, Level, and Temperature in a row above the chart */}
          <div className="hidden md:grid md:grid-cols-3 gap-4">
            <FlowCard
              river={activeRiver}
              isActive={activeDataType === "flow"}
              onClick={() => setActiveDataType("flow")}
            />
            <LevelCard
              river={activeRiver}
              isActive={activeDataType === "level"}
              onClick={() => setActiveDataType("level")}
            />
            <TemperatureCard
              river={activeRiver}
              isActive={activeDataType === "temperature"}
              onClick={() => setActiveDataType("temperature")}
            />
          </div>

          {/* Mobile layout: Only Flow card above the chart */}
          <div className="md:hidden">
            <FlowCard
              river={activeRiver}
              isActive={activeDataType === "flow"}
              onClick={() => setActiveDataType("flow")}
            />
          </div>

          {/* Chart area (always visible) */}
          <RiverChart
            key={`${activeRiverId}-${activeDataType}-${timeRange}`}
            river={activeRiver}
            dataType={activeDataType}
            timeRange={timeRange}
            isMobile={isMobile}
          />

          {/* Webcam image (if available) */}
          {activeRiver.webcamUrl && (
            <WebcamCard
              webcamUrl={activeRiver.webcamUrl}
              riverName={activeRiver.name}
              location={activeRiver.location}
            />
          )}

          {/* Mobile layout: Level and Temperature cards below the chart */}
          <div className="md:hidden grid grid-cols-2 gap-4">
            <LevelCard
              river={activeRiver}
              isActive={activeDataType === "level"}
              onClick={() => setActiveDataType("level")}
              isMobile={true}
            />
            <TemperatureCard
              river={activeRiver}
              isActive={activeDataType === "temperature"}
              onClick={() => setActiveDataType("temperature")}
              isMobile={true}
            />
          </div>
        </div>
      </div>

      <DataSourcesFooter river={activeRiver} />
    </div>
  )
}
