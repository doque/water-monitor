"use client"
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
import { useRiverData } from "@/contexts/river-data-context"
import { RiverDataSkeleton } from "@/components/river-data-skeleton"
import type { JSX } from "react/jsx-runtime" // Import JSX to fix the undeclared variable error

// Remove the data prop interface since we'll get data from context
type RiverDataDisplayProps = {}

export function RiverDataDisplay(): JSX.Element {
  // Get data from context instead of props
  const { data, isLoading, error, refetch } = useRiverData()
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlUpdateTimeoutRef = useRef<NodeJS.Timeout>()

  // Add ref to track previous river for auto-selection logic
  const previousRiverRef = useRef<any>(null)

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
    return adminMode ? data?.rivers : data?.rivers?.filter((river) => river.name !== "Söllbach")
  }, [adminMode, data?.rivers])

  // Memoize rivers with IDs to prevent unnecessary recalculations - updated to handle lakes
  const riversWithIds = useMemo(() => {
    return filteredRivers?.map((river) => ({
      ...river,
      id: getRiverOrLakeId(river),
    }))
  }, [filteredRivers])

  // Get initial state from URL parameters or use defaults - updated to handle lakes
  const initialRiverId = searchParams.get("id") || getRiverOrLakeId(filteredRivers?.[0] || {})
  const initialDataType = (searchParams.get("pane") || "flow") as DataType
  const initialTimeRange = (searchParams.get("interval") || "24h") as TimeRangeOption

  // State for UI controls
  const [timeRange, setTimeRange] = useState<TimeRangeOption>(initialTimeRange)
  const [activeDataType, setActiveDataType] = useState<DataType>(initialDataType)
  const [activeRiverId, setActiveRiverId] = useState<string>(initialRiverId)
  const [isMobile, setIsMobile] = useState(false)

  // Memoize valid river IDs to prevent unnecessary recalculations - updated to handle lakes
  const validRiverIds = useMemo(() => {
    return riversWithIds?.map((r) => getRiverOrLakeId(r))
  }, [riversWithIds])

  // Update active river ID if it becomes invalid after filtering - with better guards
  useEffect(() => {
    if (activeRiverId && !validRiverIds?.includes(activeRiverId) && validRiverIds?.length > 0) {
      // Only update if we actually have a different valid ID to switch to
      const newRiverId = validRiverIds[0]
      if (newRiverId !== activeRiverId) {
        setActiveRiverId(newRiverId)
      }
    }
  }, [validRiverIds, activeRiverId]) // Removed riversWithIds dependency to prevent loops

  // Find the active river object based on the ID - memoized and updated to handle lakes
  const activeRiver = useMemo(() => {
    return riversWithIds?.find((r) => getRiverOrLakeId(r) === activeRiverId) || riversWithIds?.[0]
  }, [riversWithIds, activeRiverId])

  // Auto-select appropriate tab based on water source type - only when river changes
  useEffect(() => {
    if (activeRiver && activeRiver !== previousRiverRef.current) {
      // River has changed, auto-select appropriate tab
      if (activeRiver.isLake) {
        // For lakes, always select temperature tab
        setActiveDataType("temperature")
      } else {
        // For rivers, always select flow tab
        setActiveDataType("flow")
      }

      // Update the ref to track current river
      previousRiverRef.current = activeRiver
    }
  }, [activeRiver]) // Removed activeDataType from dependencies to prevent override of manual selections

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

  const handleDataTypeChange = useCallback(
    (dataType: DataType) => {
      // Only allow changing to flow or level if not a lake
      if (activeRiver && activeRiver.isLake && dataType !== "temperature") {
        return
      }
      setActiveDataType(dataType)
    },
    [activeRiver],
  )

  // Helper function to generate consistent IDs for both rivers and lakes
  function getRiverOrLakeId(river: any): string {
    // Guard against undefined river object
    if (!river) return "unknown"

    // For lakes, create a simple unique identifier based on name
    if (river.isLake) {
      // Guard against undefined name
      const name = river.name ? river.name.toLowerCase().replace(/\s+/g, "-") : "unknown-lake"
      return `lake-${name}`
    }

    // For rivers, try to extract ID from level URL, but fallback to name-based ID if URL is missing
    if (river.urls?.level) {
      const extractedId = extractRiverId(river.urls.level)
      if (extractedId && extractedId !== "unknown") {
        return extractedId
      }
    }

    // Fallback: create ID from name and location with guards against undefined values
    const name = river.name ? river.name.toLowerCase().replace(/\s+/g, "-") : "unknown-river"
    const location = river.location ? river.location.toLowerCase().replace(/\s+/g, "-") : "unknown-location"
    return `river-${name}-${location}`
  }

  // Handle loading state - use the enhanced skeleton
  if (isLoading) {
    return <RiverDataSkeleton />
  }

  // Handle error state with retry option
  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
        <p className="text-red-800 dark:text-red-300 font-medium">Fehler beim Laden der Flussdaten.</p>
        <p className="text-sm text-red-700 dark:text-red-400 mt-2">{error}</p>
        <button
          onClick={refetch}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
        >
          Erneut versuchen
        </button>
      </div>
    )
  }

  // Handle no data
  if (!data || !data.rivers || data.rivers.length === 0) {
    return (
      <div className="p-6 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <p className="text-yellow-800 dark:text-yellow-300 font-medium">Flussdaten konnten nicht geladen werden.</p>
        {data?.error && <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-2">Fehler: {data.error}</p>}
        <button
          onClick={refetch}
          className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors text-sm"
        >
          Erneut versuchen
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-12 gap-4">
        {/* Modified: Show disabled time range selector for Spitzingsee with "30 Tage" */}
        {activeRiver?.name === "Spitzingsee" ? (
          <>
            <div className="col-span-7 sm:col-span-6">
              <RiverSelect
                rivers={riversWithIds || []}
                value={activeRiverId}
                onValueChange={handleRiverChange}
                showColors={adminMode}
              />
            </div>
            <div className="col-span-5 sm:col-span-6">
              {/* Disabled dropdown showing "30 Tage" for Spitzingsee */}
              <div className="px-2 h-10 flex items-center justify-between bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md opacity-75">
                <div className="truncate text-gray-600 dark:text-gray-400">30 Tage</div>
              </div>
            </div>
          </>
        ) : (
          // For all other waters, show normal dropdown
          <>
            <div className="col-span-7 sm:col-span-6">
              <RiverSelect
                rivers={riversWithIds || []}
                value={activeRiverId}
                onValueChange={handleRiverChange}
                showColors={adminMode}
              />
            </div>
            <div className="col-span-5 sm:col-span-6">
              <TimeRangeSelect value={timeRange} onValueChange={handleTimeRangeChange} />
            </div>
          </>
        )}
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
          {activeRiver?.webcamUrl && (
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
