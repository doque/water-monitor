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
import { UnifiedRiverChart, type DataType } from "@/components/river-data/unified-river-chart"
import { WebcamCard } from "@/components/river-data/webcam-card"
import { DataSourcesFooter } from "@/components/river-data/data-sources-footer"
import { extractRiverId, getHistorySpanDays } from "@/utils/water-data"
import { isAdminMode, getAdminSelections, setAdminSelections } from "@/utils/admin-mode"
import { useRiverData } from "@/contexts/river-data-context"
import { RiverDataSkeleton } from "@/components/river-data-skeleton"
import { Button } from "@/components/ui/button"
import type { JSX } from "react/jsx-runtime"

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
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Refs to prevent infinite loops and track initialization
  const isInitializedRef = useRef(false)
  const urlUpdateInProgressRef = useRef(false)

  // Check admin mode on mount and listen for changes
  useEffect(() => {
    setAdminMode(isAdminMode())

    const handleAdminModeChange = (event: CustomEvent) => {
      const newAdminMode = event.detail.adminMode
      setAdminMode(newAdminMode)

      // When entering admin mode, apply stored selections if available
      if (newAdminMode) {
        const stored = getAdminSelections()
        if (stored) {
          if (stored.riverId) setActiveRiverId(stored.riverId)
          if (stored.pane) setActiveDataType(stored.pane as DataType)
          if (stored.interval) setTimeRange(stored.interval as TimeRangeOption)
        }
      }
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
  const availableOptions = useMemo(() => {
    if (isLoading || !activeRiver || !activeRiver.isLake) return undefined
    if (activeRiver.name !== "Spitzingsee") return undefined
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
        return !river.isLake && !!river.urls?.flow
      case "level":
        return !!river.urls?.level || (river.isLake && !!river.gkdLevelSlug)
      case "temperature":
        return !!river.urls?.temperature
      default:
        return false
    }
  }

  function hasActualDataForType(river: any, dataType: DataType): boolean {
    if (!river || !river.history) return false

    if (!hasDataForType(river, dataType)) return false

    switch (dataType) {
      case "flow":
        return river.history.flows && river.history.flows.length > 0
      case "level":
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

  // Helper function to check if time range is valid for water body
  function isTimeRangeValidForWaterBody(timeRange: TimeRangeOption, isLake: boolean): boolean {
    return getValidTimeRanges(isLake).includes(timeRange)
  }

  // Single initialization effect
  useEffect(() => {
    if (isLoading || !riversWithIds || riversWithIds.length === 0 || isInitializedRef.current) return

    isInitializedRef.current = true

    if (!activeRiverId) {
      if (isAdminMode()) {
        const stored = getAdminSelections()
        if (stored?.riverId && riversWithIds.some((r) => getRiverOrLakeId(r) === stored.riverId)) {
          setActiveRiverId(stored.riverId)
          if (stored.pane) setActiveDataType(stored.pane as DataType)
          if (stored.interval) setTimeRange(stored.interval as TimeRangeOption)
          return
        }
      }

      const firstRiver = riversWithIds[0]
      const defaults = getDefaultsForRiver(firstRiver)
      setActiveRiverId(getRiverOrLakeId(firstRiver))
      setActiveDataType(defaults.dataType)
      setTimeRange(defaults.timeRange)
      return
    }

    const targetRiver = riversWithIds.find((r) => getRiverOrLakeId(r) === activeRiverId)
    if (!targetRiver) {
      const firstRiver = riversWithIds[0]
      const defaults = getDefaultsForRiver(firstRiver)
      setActiveRiverId(getRiverOrLakeId(firstRiver))
      setActiveDataType(defaults.dataType)
      setTimeRange(defaults.timeRange)
      return
    }

    if (!hasActualDataForType(targetRiver, activeDataType)) {
      setActiveDataType(getDefaultsForRiver(targetRiver).dataType)
    }

    if (!isTimeRangeValidForWaterBody(timeRange, !!targetRiver.isLake)) {
      setTimeRange(getDefaultsForRiver(targetRiver).timeRange)
    }
  }, [isLoading, riversWithIds])

  // URL update effect
  useEffect(() => {
    if (!isInitializedRef.current || urlUpdateInProgressRef.current) return
    if (!activeRiverId || !activeDataType || !timeRange) return

    const newSearch = `?id=${activeRiverId}&pane=${activeDataType}&interval=${timeRange}`

    if (typeof window !== "undefined" && window.location.search === newSearch) return

    urlUpdateInProgressRef.current = true
    router.replace(newSearch, { scroll: false })
    setTimeout(() => {
      urlUpdateInProgressRef.current = false
    }, 0)
  }, [activeRiverId, activeDataType, timeRange, router])

  // Persist selections to localStorage when admin mode is active
  useEffect(() => {
    if (!isInitializedRef.current) return
    if (!adminMode) return
    if (!activeRiverId || !activeDataType || !timeRange) return

    setAdminSelections({
      riverId: activeRiverId,
      pane: activeDataType,
      interval: timeRange,
    })
  }, [adminMode, activeRiverId, activeDataType, timeRange])

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
        // Start transition animation
        setIsTransitioning(true)
        setActiveRiverId(value)
        
        // End transition after a short delay to allow chart to update
        setTimeout(() => setIsTransitioning(false), 500)

        if (!hasActualDataForType(newRiver, activeDataType)) {
          const defaults = getDefaultsForRiver(newRiver)
          setActiveDataType(defaults.dataType)
        }

        if (!isTimeRangeValidForWaterBody(timeRange, !!newRiver.isLake)) {
          if (newRiver.isLake) {
            if (newRiver.name === "Spitzingsee") {
              const targetSpanDays = getHistorySpanDays(newRiver.history?.temperatures ?? [])
              const targetFilteredOptions = filterTimeRangeOptions(
                lakeTimeRangeOptions as readonly { value: TimeRangeOption; label: string }[],
                targetSpanDays,
              )
              setTimeRange(targetFilteredOptions[targetFilteredOptions.length - 1].value)
            } else {
              setTimeRange("2w")
            }
          } else {
            setTimeRange("24h")
          }
        }
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
      <div className="p-6 bg-destructive/10 rounded-lg border border-destructive/20">
        <p className="text-destructive font-medium">Fehler beim Laden der Flussdaten.</p>
        <p className="text-sm text-destructive/80 mt-2">{error}</p>
        <Button
          onClick={refetch}
          variant="destructive"
          className="mt-3"
        >
          Erneut versuchen
        </Button>
      </div>
    )
  }

  // Handle no data
  if (!data || !data.rivers || data.rivers.length === 0) {
    return (
      <div className="p-6 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
        <p className="text-yellow-700 dark:text-yellow-300 font-medium">Flussdaten konnten nicht geladen werden.</p>
        {data?.error && <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">Fehler: {data.error}</p>}
        <Button
          onClick={refetch}
          variant="outline"
          className="mt-3"
        >
          Erneut versuchen
        </Button>
      </div>
    )
  }

  // Only render the main UI if we have a valid activeRiverId
  if (!activeRiverId && validRiverIds.length > 0) {
    return <RiverDataSkeleton />
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Selectors row */}
      <div className="grid grid-cols-12 gap-3 sm:gap-4">
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
            isLake={activeRiver?.isLake}
            lakeName={activeRiver?.name}
            filteredOptions={availableOptions}
          />
        </div>
      </div>

      {/* Unified Chart with integrated panes */}
      <UnifiedRiverChart
        river={activeRiver}
        dataType={activeDataType}
        timeRange={timeRange}
        isMobile={isMobile}
        isAdminMode={adminMode}
        extendedHistory={gkdHistory}
        isGkdLoading={isGkdLoading}
        isTransitioning={isTransitioning}
        onDataTypeChange={handleDataTypeChange}
      />

      {/* Webcam card if available */}
      {activeRiver?.webcamUrl && (
        <WebcamCard
          webcamUrl={activeRiver.webcamUrl}
          webcamClickUrl={activeRiver.webcamClickUrl}
          riverName={activeRiver.name}
          location={activeRiver.location}
        />
      )}

      {/* Data sources footer */}
      <DataSourcesFooter river={activeRiver} />
    </div>
  )
}
