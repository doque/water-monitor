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
import type { JSX } from "react/jsx-runtime"

type RiverDataDisplayProps = {}

export function RiverDataDisplay(): JSX.Element {
  const { data, isLoading, error, refetch } = useRiverData()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Client-side admin mode state
  const [adminMode, setAdminMode] = useState(false)

  // Core state - these are the single source of truth
  const [activeRiverId, setActiveRiverId] = useState<string>("")
  const [activeDataType, setActiveDataType] = useState<DataType>("flow")
  const [timeRange, setTimeRange] = useState<TimeRangeOption>("24h")
  const [isMobile, setIsMobile] = useState(false)

  // Refs to prevent infinite loops and track initialization
  const isInitializedRef = useRef(false)
  const urlUpdateInProgressRef = useRef(false)

  // Check admin mode on mount and listen for changes
  useEffect(() => {
    setAdminMode(isAdminMode())

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

  // Memoize rivers with IDs to prevent unnecessary recalculations
  const riversWithIds = useMemo(() => {
    return filteredRivers?.map((river) => ({
      ...river,
      id: getRiverOrLakeId(river),
    }))
  }, [filteredRivers])

  // Memoize valid river IDs to prevent unnecessary recalculations
  const validRiverIds = useMemo(() => {
    return riversWithIds?.map((r) => getRiverOrLakeId(r)) || []
  }, [riversWithIds])

  // Find the active river object based on the ID
  const activeRiver = useMemo(() => {
    return riversWithIds?.find((r) => getRiverOrLakeId(r) === activeRiverId) || riversWithIds?.[0]
  }, [riversWithIds, activeRiverId])

  // Helper function to generate consistent IDs for both rivers and lakes
  function getRiverOrLakeId(river: any): string {
    if (!river) return "unknown"

    if (river.isLake) {
      const name = river.name ? river.name.toLowerCase().replace(/\s+/g, "-") : "unknown-lake"
      return `lake-${name}`
    }

    if (river.urls?.level) {
      const extractedId = extractRiverId(river.urls.level)
      if (extractedId && extractedId !== "unknown") {
        return extractedId
      }
    }

    const name = river.name ? river.name.toLowerCase().replace(/\s+/g, "-") : "unknown-river"
    const location = river.location ? river.location.toLowerCase().replace(/\s+/g, "-") : "unknown-location"
    return `river-${name}-${location}`
  }

  // Helper function to get default values based on river type
  function getDefaultsForRiver(river: any): { dataType: DataType; timeRange: TimeRangeOption } {
    if (river?.isLake) {
      return { dataType: "temperature", timeRange: "2w" }
    }
    return { dataType: "flow", timeRange: "24h" }
  }

  // Helper function to validate URL parameters
  function validateUrlParams(
    urlRiverId: string,
    urlDataType: string,
    urlTimeRange: string,
    availableRiverIds: string[],
  ) {
    const validDataTypes = ["flow", "level", "temperature"]
    const validTimeRanges = ["1h", "2h", "6h", "12h", "24h", "48h", "1w", "2w", "1m", "2m", "6m"]

    // Validate river ID - if URL has a valid ID, use it, otherwise use first available
    const validatedRiverId = availableRiverIds.includes(urlRiverId) ? urlRiverId : availableRiverIds[0] || ""

    // Find the river for this ID to get appropriate defaults
    const targetRiver = riversWithIds?.find((r) => getRiverOrLakeId(r) === validatedRiverId)
    const defaults = getDefaultsForRiver(targetRiver)

    // Validate data type - use URL param if valid, otherwise use defaults for river type
    const validatedDataType = validDataTypes.includes(urlDataType) ? (urlDataType as DataType) : defaults.dataType

    // Validate time range - use URL param if valid, otherwise use defaults for river type
    const validatedTimeRange = validTimeRanges.includes(urlTimeRange)
      ? (urlTimeRange as TimeRangeOption)
      : defaults.timeRange

    return {
      riverId: validatedRiverId,
      dataType: validatedDataType,
      timeRange: validatedTimeRange,
    }
  }

  // Enhanced initialization effect with better error handling
  useEffect(() => {
    // Only initialize once when we have data and haven't initialized yet
    if (isLoading || !riversWithIds || riversWithIds.length === 0 || isInitializedRef.current) {
      return
    }

    try {
      // Read URL parameters
      const urlRiverId = searchParams.get("id") || ""
      const urlDataType = searchParams.get("pane") || ""
      const urlTimeRange = searchParams.get("interval") || ""

      // Get available river IDs
      const availableRiverIds = riversWithIds.map((r) => getRiverOrLakeId(r))

      // Validate and get final values
      const validated = validateUrlParams(urlRiverId, urlDataType, urlTimeRange, availableRiverIds)

      // Ensure we have a valid river ID
      if (validated.riverId) {
        // Set state with validated values
        setActiveRiverId(validated.riverId)
        setActiveDataType(validated.dataType)
        setTimeRange(validated.timeRange)

        // Mark as initialized
        isInitializedRef.current = true
      }
    } catch (error) {
      console.error("Error during initialization:", error)
      // Fallback to first river if initialization fails
      if (riversWithIds.length > 0) {
        const firstRiver = riversWithIds[0]
        const firstRiverId = getRiverOrLakeId(firstRiver)
        const defaults = getDefaultsForRiver(firstRiver)

        setActiveRiverId(firstRiverId)
        setActiveDataType(defaults.dataType)
        setTimeRange(defaults.timeRange)
        isInitializedRef.current = true
      }
    }
  }, [isLoading, riversWithIds, searchParams])

  // URL update effect - only updates URL when state changes and component is initialized
  useEffect(() => {
    if (!isInitializedRef.current || urlUpdateInProgressRef.current) return
    if (!activeRiverId || !activeDataType || !timeRange) return

    urlUpdateInProgressRef.current = true

    const params = new URLSearchParams()
    params.set("id", activeRiverId)
    params.set("pane", activeDataType)
    params.set("interval", timeRange)

    router.replace(`?${params.toString()}`, { scroll: false })

    // Reset flag after URL update
    setTimeout(() => {
      urlUpdateInProgressRef.current = false
    }, 0)
  }, [activeRiverId, activeDataType, timeRange, router])

  // Detect if we're on mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkIfMobile()
    window.addEventListener("resize", checkIfMobile)
    return () => window.removeEventListener("resize", checkIfMobile)
  }, [])

  // Stable handlers that immediately update state (and thus URL)
  const handleRiverChange = useCallback(
    (value: string) => {
      const newRiver = riversWithIds?.find((r) => getRiverOrLakeId(r) === value)
      if (newRiver) {
        const defaults = getDefaultsForRiver(newRiver)
        setActiveRiverId(value)
        setActiveDataType(defaults.dataType)
        setTimeRange(defaults.timeRange)
      }
    },
    [riversWithIds],
  )

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

  // Handle loading state
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

  // Show skeleton while initializing or if no active river yet
  if (!isInitializedRef.current || !activeRiverId) {
    return <RiverDataSkeleton />
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-12 gap-4">
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
              <TimeRangeSelect
                value={timeRange}
                onValueChange={handleTimeRangeChange}
                isLake={true}
                lakeName={activeRiver.name}
              />
            </div>
          </>
        ) : (
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

      <div className="space-y-4 sm:space-y-6">
        <div className="grid gap-4">
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

          <RiverChart
            river={activeRiver}
            dataType={activeDataType}
            timeRange={timeRange}
            isMobile={isMobile}
            isAdminMode={adminMode}
          />

          {activeRiver?.webcamUrl && (
            <WebcamCard
              webcamUrl={activeRiver.webcamUrl}
              webcamClickUrl={activeRiver.webcamClickUrl}
              riverName={activeRiver.name}
              location={activeRiver.location}
            />
          )}

          <div className="md:hidden grid grid-cols-2 gap-4">
            {activeRiver?.isLake ? (
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
