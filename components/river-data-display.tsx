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

  // Helper function to check if data is available for a specific data type
  function hasDataForType(river: any, dataType: DataType): boolean {
    if (!river) return false

    switch (dataType) {
      case "flow":
        // Check if river has flow URL and is not a lake
        return !river.isLake && !!river.urls?.flow
      case "level":
        // Check if river has level URL
        return !!river.urls?.level
      case "temperature":
        // Check if river has temperature URL
        return !!river.urls?.temperature
      default:
        return false
    }
  }

  function hasActualDataForType(river: any, dataType: DataType): boolean {
    if (!river || !river.history) return false

    // First check if URLs exist (basic availability)
    if (!hasDataForType(river, dataType)) return false

    // Now check if actual data exists in the history
    switch (dataType) {
      case "flow":
        return river.history.flows && river.history.flows.length > 0
      case "level":
        return river.history.levels && river.history.levels.length > 0
      case "temperature":
        return river.history.temperatures && river.history.temperatures.length > 0
      default:
        return false
    }
  }

  // Helper function to get available data types for a river
  function getAvailableDataTypes(river: any): DataType[] {
    if (!river) return []

    const available: DataType[] = []
    if (hasActualDataForType(river, "flow")) available.push("flow")
    if (hasActualDataForType(river, "level")) available.push("level")
    if (hasActualDataForType(river, "temperature")) available.push("temperature")

    return available
  }

  function getDefaultsForRiver(river: any): { dataType: DataType; timeRange: TimeRangeOption } {
    console.log("[v0] Getting defaults for river:", river?.name)

    if (river?.isLake) {
      return { dataType: "temperature", timeRange: "2w" }
    }

    let defaultDataType: DataType = "flow"

    if (hasActualDataForType(river, "flow")) {
      defaultDataType = "flow"
      console.log("[v0] Using flow as default")
    } else if (hasActualDataForType(river, "level")) {
      defaultDataType = "level"
      console.log("[v0] Falling back to level")
    } else if (hasActualDataForType(river, "temperature")) {
      defaultDataType = "temperature"
      console.log("[v0] Falling back to temperature")
    }

    console.log("[v0] Final default dataType:", defaultDataType)
    return { dataType: defaultDataType, timeRange: "24h" }
  }

  // Helper function to validate URL parameters
  function validateUrlParams(urlRiverId: string, urlDataType: string, urlTimeRange: string, river: any) {
    const validRiverIds = riversWithIds?.map((r) => getRiverOrLakeId(r)) || []
    const validDataTypes = ["flow", "level", "temperature"]
    const validTimeRanges = ["1h", "2h", "6h", "12h", "24h", "48h", "1w", "2w", "1m", "2m", "6m"]

    // Validate river ID
    const validatedRiverId = validRiverIds.includes(urlRiverId) ? urlRiverId : validRiverIds[0] || ""

    // Find the river for this ID
    const targetRiver = riversWithIds?.find((r) => getRiverOrLakeId(r) === validatedRiverId)
    const defaults = getDefaultsForRiver(targetRiver)

    let validatedDataType: DataType = defaults.dataType

    // If URL has a specific pane requested, check if it has data
    if (validDataTypes.includes(urlDataType)) {
      const requestedDataType = urlDataType as DataType
      if (hasActualDataForType(targetRiver, requestedDataType)) {
        validatedDataType = requestedDataType
      }
      // If requested pane has no data, fall back to defaults (which already implements smart fallback)
    }

    // Validate time range
    const validatedTimeRange = validTimeRanges.includes(urlTimeRange)
      ? (urlTimeRange as TimeRangeOption)
      : defaults.timeRange

    return {
      riverId: validatedRiverId,
      dataType: validatedDataType,
      timeRange: validatedTimeRange,
    }
  }

  // Single initialization effect - runs once when data is loaded
  useEffect(() => {
    if (!isLoading && riversWithIds && riversWithIds.length > 0 && !isInitializedRef.current) {
      // Read URL parameters
      const urlRiverId = searchParams.get("id") || ""
      const urlDataType = searchParams.get("pane") || ""
      const urlTimeRange = searchParams.get("interval") || ""

      // If no URL params at all, use first river defaults
      if (!urlRiverId && !urlDataType && !urlTimeRange) {
        const firstRiver = riversWithIds[0]
        const defaults = getDefaultsForRiver(firstRiver)

        setActiveRiverId(getRiverOrLakeId(firstRiver))
        setActiveDataType(defaults.dataType)
        setTimeRange(defaults.timeRange)
      } else {
        // Validate URL params and apply smart fallback
        const validated = validateUrlParams(urlRiverId, urlDataType, urlTimeRange, null)

        setActiveRiverId(validated.riverId)
        setActiveDataType(validated.dataType)
        setTimeRange(validated.timeRange)
      }

      // Mark as initialized
      isInitializedRef.current = true
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

  useEffect(() => {
    if (!isInitializedRef.current || !activeRiver || !data) return

    console.log("[v0] Checking data availability for", activeRiver.name, "dataType:", activeDataType)

    // Check if current data type actually has data
    if (!hasActualDataForType(activeRiver, activeDataType)) {
      console.log("[v0] No data for current type", activeDataType, "attempting fallback")

      // Try fallback in priority order: flow -> level -> temperature
      const fallbackOrder: DataType[] = ["flow", "level", "temperature"]
      let foundFallback = false

      for (const fallbackType of fallbackOrder) {
        if (hasActualDataForType(activeRiver, fallbackType)) {
          console.log("[v0] Falling back to", fallbackType)
          setActiveDataType(fallbackType)
          foundFallback = true
          break
        }
      }

      if (!foundFallback) {
        console.log("[v0] No data available for any type")
      }
    }
  }, [activeRiver, activeDataType, data])

  // Stable handlers that immediately update state (and thus URL)
  const handleRiverChange = useCallback(
    (value: string) => {
      const newRiver = riversWithIds?.find((r) => getRiverOrLakeId(r) === value)
      if (newRiver) {
        // Keep current timeRange, but get smart default for dataType
        const defaults = getDefaultsForRiver(newRiver)

        setActiveRiverId(value)
        setActiveDataType(defaults.dataType)
        // Keep existing timeRange unless it's incompatible with lake/river type
        if (newRiver.isLake && timeRange !== "2w") {
          setTimeRange("2w")
        } else if (!newRiver.isLake && timeRange === "2w") {
          setTimeRange("24h")
        }
        // Otherwise keep current timeRange
      }
    },
    [riversWithIds, timeRange],
  )

  const handleTimeRangeChange = useCallback((value: TimeRangeOption) => {
    setTimeRange(value)
  }, [])

  const handleDataTypeChange = useCallback(
    (dataType: DataType) => {
      if (!hasActualDataForType(activeRiver, dataType)) {
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

  // Only render the main UI if we have a valid activeRiverId
  if (!activeRiverId && validRiverIds.length > 0) {
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
                  isMobile={true}
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
