"use client"

import type { RiversData } from "@/utils/water-data"
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
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
import { isAdminMode } from "@/utils/admin-mode"

interface RiverDataDisplayProps {
  data: RiversData
}

export function RiverDataDisplay({ data }: RiverDataDisplayProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlUpdateTimeoutRef = useRef<NodeJS.Timeout>()

  // Client-side admin mode state
  const [adminMode, setAdminMode] = useState(false)

  // Check admin mode on mount and listen for changes
  useEffect(() => {
    setAdminMode(isAdminMode())

    // Listen for admin mode changes
    const handleAdminModeChange = (event: CustomEvent) => {
      setAdminMode(event.detail.adminMode)
    }

    window.addEventListener("adminModeChanged", handleAdminModeChange as EventListener)

    return () => {
      window.removeEventListener("adminModeChanged", handleAdminModeChange as EventListener)
    }
  }, [])

  // Memoize filtered rivers to prevent unnecessary recalculations
  const filteredRivers = useMemo(() => {
    return adminMode ? data.rivers : data.rivers.filter((river) => river.name !== "Söllbach")
  }, [adminMode, data.rivers])

  // Memoize rivers with IDs to prevent unnecessary recalculations
  const riversWithIds = useMemo(() => {
    return filteredRivers.map((river) => ({
      ...river,
      id: extractRiverId(river.urls.level),
    }))
  }, [filteredRivers])

  // Get initial state from URL parameters or use defaults
  const initialRiverId = searchParams.get("id") || extractRiverId(filteredRivers[0]?.urls.level || "")
  const initialDataType = (searchParams.get("pane") || "flow") as DataType
  const initialTimeRange = (searchParams.get("interval") || "24h") as TimeRangeOption

  // State for UI controls
  const [timeRange, setTimeRange] = useState<TimeRangeOption>(initialTimeRange)
  const [activeDataType, setActiveDataType] = useState<DataType>(initialDataType)
  const [activeRiverId, setActiveRiverId] = useState<string>(initialRiverId)
  const [isMobile, setIsMobile] = useState(false)

  // Memoize valid river IDs to prevent unnecessary recalculations
  const validRiverIds = useMemo(() => {
    return riversWithIds.map((r) => extractRiverId(r.urls.level))
  }, [riversWithIds])

  // Update active river ID if it becomes invalid after filtering - with better guards
  useEffect(() => {
    if (activeRiverId && !validRiverIds.includes(activeRiverId) && validRiverIds.length > 0) {
      // Only update if we actually have a different valid ID to switch to
      const newRiverId = validRiverIds[0]
      if (newRiverId !== activeRiverId) {
        setActiveRiverId(newRiverId)
      }
    }
  }, [validRiverIds, activeRiverId]) // Removed riversWithIds dependency to prevent loops

  // Find the active river object based on the ID - memoized
  const activeRiver = useMemo(() => {
    return riversWithIds.find((r) => extractRiverId(r.urls.level) === activeRiverId) || riversWithIds[0]
  }, [riversWithIds, activeRiverId])

  // Debounced URL update to prevent infinite loops
  const updateURL = useCallback(
    (riverId: string, dataType: DataType, timeRangeValue: TimeRangeOption) => {
      // Clear any existing timeout
      if (urlUpdateTimeoutRef.current) {
        clearTimeout(urlUpdateTimeoutRef.current)
      }

      // Debounce URL updates to prevent rapid changes
      urlUpdateTimeoutRef.current = setTimeout(() => {
        const params = new URLSearchParams()
        params.set("id", riverId)
        params.set("pane", dataType)
        params.set("interval", timeRangeValue)

        const newURL = `?${params.toString()}`
        const currentURL = `?${searchParams.toString()}`

        if (newURL !== currentURL) {
          router.replace(newURL, { scroll: false })
        }
      }, 300) // Increased debounce time to 300ms
    },
    [router, searchParams],
  )

  // Update URL when state changes - with better guards to prevent loops
  useEffect(() => {
    // Only update URL if we have valid values
    if (activeRiverId && activeDataType && timeRange) {
      updateURL(activeRiverId, activeDataType, timeRange)
    }

    // Cleanup timeout on unmount
    return () => {
      if (urlUpdateTimeoutRef.current) {
        clearTimeout(urlUpdateTimeoutRef.current)
      }
    }
  }, [activeRiverId, activeDataType, timeRange, updateURL])

  // Detect if we're on mobile - with cleanup
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

  // Stable handlers to prevent unnecessary re-renders
  const handleRiverChange = useCallback((value: string) => {
    setActiveRiverId(value)
  }, [])

  const handleTimeRangeChange = useCallback((value: TimeRangeOption) => {
    setTimeRange(value)
  }, [])

  const handleDataTypeChange = useCallback((dataType: DataType) => {
    setActiveDataType(dataType)
  }, [])

  if (!filteredRivers || filteredRivers.length === 0) {
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
            value={activeRiverId}
            onValueChange={handleRiverChange}
            showColors={adminMode}
          />
        </div>
        <div className="col-span-5 sm:col-span-6">
          <TimeRangeSelect value={timeRange} onValueChange={handleTimeRangeChange} />
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
              onClick={() => handleDataTypeChange("flow")}
              timeRange={timeRange}
              showColors={adminMode}
            />
            <LevelCard
              river={activeRiver}
              isActive={activeDataType === "level"}
              onClick={() => handleDataTypeChange("level")}
              timeRange={timeRange}
            />
            <TemperatureCard
              river={activeRiver}
              isActive={activeDataType === "temperature"}
              onClick={() => handleDataTypeChange("temperature")}
              timeRange={timeRange}
            />
          </div>

          {/* Mobile layout: Only Flow card above the chart */}
          <div className="md:hidden">
            <FlowCard
              river={activeRiver}
              isActive={activeDataType === "flow"}
              onClick={() => handleDataTypeChange("flow")}
              timeRange={timeRange}
              showColors={adminMode}
            />
          </div>

          {/* Chart area (always visible) */}
          <RiverChart
            river={activeRiver}
            dataType={activeDataType}
            timeRange={timeRange}
            isMobile={isMobile}
            isAdminMode={adminMode}
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
              onClick={() => handleDataTypeChange("level")}
              isMobile={true}
              timeRange={timeRange}
            />
            <TemperatureCard
              river={activeRiver}
              isActive={activeDataType === "temperature"}
              onClick={() => handleDataTypeChange("temperature")}
              isMobile={true}
              timeRange={timeRange}
            />
          </div>
        </div>
      </div>

      <DataSourcesFooter river={activeRiver} />
    </div>
  )
}
