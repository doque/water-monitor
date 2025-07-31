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

  // Add ref to track if component is mounted
  const isMountedRef = useRef(false)

  // Add ref to track previous river for auto-selection logic
  const previousRiverRef = useRef<any>(null)

  // Add refs to track previous values and prevent unnecessary updates
  const previousUrlParamsRef = useRef<string>("")
  const isInitializedRef = useRef(false)

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

  // Memoize valid river IDs to prevent unnecessary recalculations - updated to handle lakes
  const validRiverIds = useMemo(() => {
    return riversWithIds?.map((r) => getRiverOrLakeId(r)) || []
  }, [riversWithIds])

  // Get initial state from URL parameters or use defaults - updated to handle lakes
  // Moved inside useEffect to ensure it runs after data is loaded
  const [activeRiverId, setActiveRiverId] = useState<string>("")
  const [activeDataType, setActiveDataType] = useState<DataType>("flow")
  const [timeRange, setTimeRange] = useState<TimeRangeOption>("24h")
  const [isMobile, setIsMobile] = useState(false)

  // Simplified initialization - only run once when data loads
  useEffect(() => {
    if (!isLoading && filteredRivers && filteredRivers.length > 0 && !isInitializedRef.current) {
      // Get URL parameters with proper fallbacks
      const urlRiverId = searchParams.get("id") || ""
      const urlDataType = (searchParams.get("pane") || "") as DataType
      const urlTimeRange = (searchParams.get("interval") as TimeRangeOption) || ""

      // Validate river ID from URL
      const validRiverId = validRiverIds.includes(urlRiverId) ? urlRiverId : getRiverOrLakeId(filteredRivers[0])

      // Set active river ID
      setActiveRiverId(validRiverId)

      // Find the active river object
      const activeRiver = riversWithIds?.find((r) => getRiverOrLakeId(r) === validRiverId)

      // Set data type based on URL or defaults
      const validDataType = ["flow", "level", "temperature"].includes(urlDataType)
        ? (urlDataType as DataType)
        : activeRiver?.isLake
          ? "temperature"
          : "flow"

      setActiveDataType(validDataType)

      // Set time range based on URL or defaults
      const validTimeRanges = ["1h", "2h", "6h", "12h", "24h", "48h", "1w", "2w", "1m", "2m", "6m"]
      const defaultTimeRange = activeRiver?.isLake ? "2w" : "24h"
      const validTimeRange = validTimeRanges.includes(urlTimeRange)
        ? (urlTimeRange as TimeRangeOption)
        : defaultTimeRange

      setTimeRange(validTimeRange)

      // Mark component as initialized and mounted
      isInitializedRef.current = true
      isMountedRef.current = true
    }
  }, [isLoading, filteredRivers]) // Removed circular dependencies

  // Separate effect for handling invalid river IDs - with better guards
  useEffect(() => {
    if (
      isInitializedRef.current &&
      activeRiverId &&
      !validRiverIds?.includes(activeRiverId) &&
      validRiverIds?.length > 0
    ) {
      const newRiverId = validRiverIds[0]
      if (newRiverId !== activeRiverId) {
        setActiveRiverId(newRiverId)
      }
    }
  }, [validRiverIds, activeRiverId])

  // Find the active river object based on the ID - memoized and updated to handle lakes
  const activeRiver = useMemo(() => {
    return riversWithIds?.find((r) => getRiverOrLakeId(r) === activeRiverId) || riversWithIds?.[0]
  }, [riversWithIds, activeRiverId])

  // Auto-select appropriate tab and time range based on water source type
  useEffect(() => {
    if (isInitializedRef.current && activeRiver && activeRiver !== previousRiverRef.current) {
      // Only auto-select if this is a user-initiated river change, not initial load
      if (previousRiverRef.current !== null) {
        if (activeRiver.isLake) {
          setActiveDataType("temperature")
          setTimeRange("2w")
        } else {
          setActiveDataType("flow")
          setTimeRange("24h")
        }
      }
      previousRiverRef.current = activeRiver
    }
  }, [activeRiver])

  // Immediate URL update - removed debouncing for instant updates
  const updateURL = useCallback(
    (riverId: string, dataType: DataType, timeRangeValue: TimeRangeOption) => {
      // Only update URL if component is mounted and we have valid values
      if (!isInitializedRef.current || !riverId || !dataType || !timeRangeValue) return

      const params = new URLSearchParams()
      params.set("id", riverId)
      params.set("pane", dataType)
      params.set("interval", timeRangeValue)

      const newURL = params.toString()

      // Only update if URL actually changed
      if (newURL !== previousUrlParamsRef.current) {
        previousUrlParamsRef.current = newURL
        router.replace(`?${newURL}`, { scroll: false })
      }
    },
    [router],
  )

  // Update URL when state changes - now happens instantly
  useEffect(() => {
    // Only update URL if we have valid values and component is mounted
    if (isInitializedRef.current && activeRiverId && activeDataType && timeRange) {
      updateURL(activeRiverId, activeDataType, timeRange)
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

  // Only render the main UI if we have a valid activeRiverId
  if (!activeRiverId && validRiverIds.length > 0) {
    // If activeRiverId is not set but we have valid rivers, set it to the first one
    setActiveRiverId(validRiverIds[0])
    return <RiverDataSkeleton />
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-12 gap-4">
        {/* Updated: Show proper time range selectors for lakes */}
        {activeRiver?.isLake ? (
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
              {/* Show functional time range selector for lakes */}
              <TimeRangeSelect
                value={timeRange}
                onValueChange={handleTimeRangeChange}
                isLake={true}
                lakeName={activeRiver.name}
              />
            </div>
          </>
        ) : (
          // For rivers, show normal dropdown with 24h default
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

          {/* Mobile layout: Show temperature first for lakes, flow first for rivers */}
          <div className="md:hidden">
            {activeRiver?.isLake ? (
              <TemperatureCard
                river={activeRiver}
                isActive={activeDataType === "temperature"}
                onClick={() => handleDataTypeChange("temperature")}
                isMobile={true}
                timeRange={timeRange}
              />
            ) : (
              <FlowCard
                river={activeRiver}
                isActive={activeDataType === "flow"}
                onClick={() => handleDataTypeChange("flow")}
                timeRange={timeRange}
                showColors={adminMode}
              />
            )}
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
              webcamClickUrl={activeRiver.webcamClickUrl}
              riverName={activeRiver.name}
              location={activeRiver.location}
            />
          )}

          {/* Mobile layout: Show remaining cards below chart based on water body type */}
          <div className="md:hidden grid grid-cols-2 gap-4">
            {activeRiver?.isLake ? (
              // For lakes: Show Level and Flow below (Temperature is already above)
              <>
                <LevelCard
                  river={activeRiver}
                  isActive={activeDataType === "level"}
                  onClick={() => handleDataTypeChange("level")}
                  isMobile={true}
                  timeRange={timeRange}
                />
                <FlowCard
                  river={activeRiver}
                  isActive={activeDataType === "flow"}
                  onClick={() => handleDataTypeChange("flow")}
                  timeRange={timeRange}
                  showColors={adminMode}
                />
              </>
            ) : (
              // For rivers: Show Level and Temperature below (Flow is already above)
              <>
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
              </>
            )}
          </div>
        </div>
      </div>

      <DataSourcesFooter river={activeRiver} />
    </div>
  )
}
