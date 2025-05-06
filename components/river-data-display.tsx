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

  const [timeRange, setTimeRange] = useState<TimeRangeOption>(initialTimeRange)
  const [activeDataType, setActiveDataType] = useState<DataType>(initialDataType)
  const [activeRiver, setActiveRiver] = useState(
    riversWithIds.find((r) => extractRiverId(r.urls.level) === initialRiverId) || riversWithIds[0],
  )
  const [isMobile, setIsMobile] = useState(false)

  // Update URL when state changes
  useEffect(() => {
    if (!activeRiver) return

    const params = new URLSearchParams()
    params.set("id", extractRiverId(activeRiver.urls.level))
    params.set("pane", activeDataType)
    params.set("interval", timeRange)

    // Update URL without causing a page reload
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [activeRiver, activeDataType, timeRange, router])

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
          <RiverSelect
            rivers={riversWithIds}
            defaultValue={extractRiverId(activeRiver.urls.level)}
            onValueChange={(value) => {
              // Find the selected river by ID
              const selectedRiver = riversWithIds.find((r) => extractRiverId(r.urls.level) === value)
              if (selectedRiver) {
                // Set active river
                setActiveRiver(selectedRiver)
              }
            }}
          />
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
          <RiverChart river={activeRiver} dataType={activeDataType} timeRange={timeRange} isMobile={isMobile} />

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
