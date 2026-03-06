"use client"
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { RiverSelect } from "@/components/river-data/river-select"
import {
  TimeRangeSelect,
  type TimeRangeOption,
  filterTimeRangeOptions,
  riverTimeRangeOptions,
  lakeTimeRangeOptions,
} from "@/components/river-data/time-range-select"
import { useGkdData } from "@/hooks/use-gkd-data"
import { FlowCard } from "@/components/river-data/flow-card"
import { LevelCard } from "@/components/river-data/level-card"
import { TemperatureCard } from "@/components/river-data/temperature-card"
import { RiverChart, type DataType } from "@/components/river-data/river-chart"
import { WebcamCard } from "@/components/river-data/webcam-card"
import { DataSourcesFooter } from "@/components/river-data/data-sources-footer"
import { extractRiverId, getHistorySpanDays } from "@/utils/water-data"
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

  // Core state - initialized directly from URL params to avoid double-render on load
  const [activeRiverId, setActiveRiverId] = useState<string>(() => searchParams.get("id") || "")
  const [activeDataType, setActiveDataType] = useState<DataType>(() => {
    const pane = searchParams.get("pane")
    return ["flow", "level", "temperature"].includes(pane || "") ? (pane as DataType) : "flow"
  })
  const [timeRange, setTimeRange] = useState<TimeRangeOption>(() => {
    const interval = searchParams.get("interval")
    const valid = ["1h", "6h", "12h", "24h", "2d", "1w", "2w", "1m", "6m", "12m", "24m"]
    return valid.includes(interval || "") ? (interval as TimeRangeOption) : "24h"
  })
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

  // Compute the span of the active history array in days
  const spanDays = useMemo(() => {
    if (!activeRiver) return 0
    switch (activeDataType) {
      case "temperature":
        return getHistorySpanDays(activeRiver.history?.temperatures ?? [])
      case "level":
        return getHistorySpanDays(activeRiver.history?.levels ?? [])
      case "flow":
        return getHistorySpanDays(activeRiver.history?.flows ?? [])
      default:
        return 0
    }
  }, [activeRiver, activeDataType])

  // Determine the base option set for the active water body
  const baseTimeRangeOptions = useMemo(() => {
    if (!activeRiver) return riverTimeRangeOptions
    return activeRiver.isLake ? lakeTimeRangeOptions : riverTimeRangeOptions
  }, [activeRiver])

  // Filter options based on available data span.
  // Rivers and GKD lakes (Schliersee/Tegernsee) show full option set.
  // Spitzingsee filters by blob data span.
  const availableOptions = useMemo(() => {
    if (isLoading || !activeRiver || !activeRiver.isLake) return undefined
    if (activeRiver.name !== "Spitzingsee") return undefined // GKD lakes always have 2y of data
    return filterTimeRangeOptions(
      lakeTimeRangeOptions as readonly { value: TimeRangeOption; label: string }[],
      spanDays
    )
  }, [isLoading, activeRiver, spanDays])

  // GKD historical data for long time ranges
  const { history: gkdHistory, isLoading: isGkdLoading } = useGkdData(activeRiver ?? null, activeDataType, timeRange)

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
        // Check if river has level URL or lake has gkdLevelSlug
        return !!river.urls?.level || (river.isLake && !!river.gkdLevelSlug)
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
        // For lakes with gkdLevelSlug, data comes from GKD (fetched on demand)
        if (river.isLake && river.gkdLevelSlug) return true
        return river.history.levels && river.history.levels.length > 0
      case "temperature":
        return (
          (river.history.temperatures && river.history.temperatures.length > 0) ||
          river.current?.temperature !== null && river.current?.temperature !== undefined
        )
      default:
        return false
    }
  }

  function getDefaultsForRiver(river: any): { dataType: DataType; timeRange: TimeRangeOption } {
    if (river?.isLake) {
      return { dataType: "temperature", timeRange: "2w" }
    }

    let defaultDataType: DataType = "flow"

    if (hasActualDataForType(river, "flow")) {
      defaultDataType = "flow"
    } else if (hasActualDataForType(river, "level")) {
      defaultDataType = "level"
    } else if (hasActualDataForType(river, "temperature")) {
      defaultDataType = "temperature"
    }

    return { dataType: defaultDataType, timeRange: "24h" }
  }

  // Helper function to get valid time ranges for water body type
  function getValidTimeRanges(isLake: boolean): TimeRangeOption[] {
    if (isLake) {
      return ["1w", "2w", "1m", "6m", "12m", "24m"]
    } else {
      return ["1h", "6h", "12h", "24h", "2d", "1w", "2w", "1m", "6m", "12m", "24m"]
    }
  }

  // Helper function to get largest available time range
  function getLargestAvailableTimeRange(isLake: boolean): TimeRangeOption {
    const validRanges = getValidTimeRanges(isLake)
    return validRanges[validRanges.length - 1]
  }

  // Helper function to check if time range is valid for water body
  function isTimeRangeValidForWaterBody(timeRange: TimeRangeOption, isLake: boolean): boolean {
    return getValidTimeRanges(isLake).includes(timeRange)
  }

  // Single initialization effect - runs once when data is loaded, validates/corrects state
  // Does NOT depend on searchParams — state is already initialized from URL in useState above
  useEffect(() => {
    if (isLoading || !riversWithIds || riversWithIds.length === 0 || isInitializedRef.current) return

    isInitializedRef.current = true

    if (!activeRiverId) {
      // No river in URL — fall back to first river defaults
      const firstRiver = riversWithIds[0]
      const defaults = getDefaultsForRiver(firstRiver)
      setActiveRiverId(getRiverOrLakeId(firstRiver))
      setActiveDataType(defaults.dataType)
      setTimeRange(defaults.timeRange)
      return
    }

    const targetRiver = riversWithIds.find((r) => getRiverOrLakeId(r) === activeRiverId)
    if (!targetRiver) {
      // River ID from URL not found — fall back to first river
      const firstRiver = riversWithIds[0]
      const defaults = getDefaultsForRiver(firstRiver)
      setActiveRiverId(getRiverOrLakeId(firstRiver))
      setActiveDataType(defaults.dataType)
      setTimeRange(defaults.timeRange)
      return
    }

    // Validate data type for this river (e.g. "flow" for a lake)
    if (!hasActualDataForType(targetRiver, activeDataType)) {
      setActiveDataType(getDefaultsForRiver(targetRiver).dataType)
    }

    // Validate time range for this water body type (e.g. "1h" for a lake)
    if (!isTimeRangeValidForWaterBody(timeRange, !!targetRiver.isLake)) {
      setTimeRange(getDefaultsForRiver(targetRiver).timeRange)
    }
  }, [isLoading, riversWithIds])

  // URL update effect - only updates URL when state changes and component is initialized
  useEffect(() => {
    if (!isInitializedRef.current || urlUpdateInProgressRef.current) return
    if (!activeRiverId || !activeDataType || !timeRange) return

    const newSearch = `?id=${activeRiverId}&pane=${activeDataType}&interval=${timeRange}`

    // Skip router.replace if URL already matches — avoids searchParams update → re-render cycle
    if (typeof window !== "undefined" && window.location.search === newSearch) return

    urlUpdateInProgressRef.current = true
    router.replace(newSearch, { scroll: false })
    setTimeout(() => {
      urlUpdateInProgressRef.current = false
    }, 0)
  }, [activeRiverId, activeDataType, timeRange, router])

  // Guard: if selected timeRange is not in availableOptions, fall back to largest available
  useEffect(() => {
    if (!isInitializedRef.current) return
    if (!availableOptions) return
    const isValid = availableOptions.some(o => o.value === timeRange)
    if (!isValid) {
      const largest = availableOptions[availableOptions.length - 1].value
      setTimeRange(largest)
    }
  }, [availableOptions, timeRange])

  // Detect if we're on mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkIfMobile()
    window.addEventListener("resize", checkIfMobile)
    return () => window.removeEventListener("resize", checkIfMobile)
  }, [])

  const handleRiverChange = useCallback(
    (value: string) => {
      const newRiver = riversWithIds?.find((r) => getRiverOrLakeId(r) === value)
      if (newRiver) {
        setActiveRiverId(value)

        // Keep current pane if it's available for the new water body, otherwise fall back to first available
        if (!hasActualDataForType(newRiver, activeDataType)) {
          const defaults = getDefaultsForRiver(newRiver)
          setActiveDataType(defaults.dataType)
        }

        if (!isTimeRangeValidForWaterBody(timeRange, !!newRiver.isLake)) {
          // Current time range is not valid for new water body, use a sensible default
          if (newRiver.isLake) {
            if (newRiver.name === "Spitzingsee") {
              // Filter by blob data span
              const targetSpanDays = getHistorySpanDays(newRiver.history?.temperatures ?? [])
              const targetFilteredOptions = filterTimeRangeOptions(
                lakeTimeRangeOptions as readonly { value: TimeRangeOption; label: string }[],
                targetSpanDays,
              )
              setTimeRange(targetFilteredOptions[targetFilteredOptions.length - 1].value)
            } else {
              setTimeRange("2w") // Default for GKD lakes
            }
          } else {
            setTimeRange("24h") // Default for rivers
          }
        }
        // Otherwise keep current timeRange if it's valid
      }
    },
    [riversWithIds, timeRange, activeDataType],
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
                filteredOptions={availableOptions}
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
              <TimeRangeSelect value={timeRange} onValueChange={handleTimeRangeChange} filteredOptions={availableOptions} />
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
              extendedHistory={gkdHistory}
              isAdminMode={adminMode}
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
            extendedHistory={gkdHistory}
            isGkdLoading={isGkdLoading}
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
                  extendedHistory={gkdHistory}
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
                  extendedHistory={gkdHistory}
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
