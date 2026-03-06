"use client"

import { useState, useEffect, useRef } from "react"
import type { GkdDataPoint } from "@/app/api/gkd/route"
import type { TimeRangeOption } from "@/components/river-data/time-range-select"
import { GKD_RANGES, timeRangeDurationDays } from "@/components/river-data/time-range-select"
import type { DataType } from "@/components/river-data/river-chart"
import type { RiverData } from "@/utils/water-data"

export interface GkdHistory {
  levels?: GkdDataPoint[]
  temperatures?: GkdDataPoint[]
  flows?: GkdDataPoint[]
}

function formatDate(d: Date): string {
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear()}`
}

function buildDateRange(): { beginn: string; ende: string } {
  const ende = new Date()
  const beginn = new Date()
  beginn.setDate(beginn.getDate() - Math.ceil(timeRangeDurationDays["24m"]))
  return { beginn: formatDate(beginn), ende: formatDate(ende) }
}

export function useGkdData(
  river: RiverData | null,
  dataType: DataType,
  timeRange: TimeRangeOption
): { history: GkdHistory | null; isLoading: boolean } {
  const [history, setHistory] = useState<GkdHistory | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  // Cache by slug — ALL data types stored together per water body
  const cacheRef = useRef<Record<string, GkdHistory>>({})

  const gkdSlug = river?.gkdSlug
  const gkdLevelSlug = river?.gkdLevelSlug
  const isLake = !!river?.isLake
  const isGkdRange = GKD_RANGES.has(timeRange)
  const cacheKey = gkdSlug || ""
  // Lakes with gkdLevelSlug need GKD data for all time ranges (level data only comes from GKD)
  const needsGkdForLevel = isLake && !!gkdLevelSlug

  useEffect(() => {
    if (!gkdSlug || !river) {
      setHistory(null)
      return
    }

    // Cache hit — all data types already fetched for this water body
    if (cacheRef.current[cacheKey]) {
      setHistory(cacheRef.current[cacheKey])
      setIsLoading(false)
      return
    }

    // Trigger fetch when user enters a GKD range, or immediately for lakes that need level data
    if (!isGkdRange && !needsGkdForLevel) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsLoading(true)

    const { beginn, ende } = buildDateRange()
    const kind = isLake ? "lake" : "river"

    const doFetch = async () => {
      try {
        const result: GkdHistory = {}

        if (isLake) {
          // Lakes: fetch temperature, and level if gkdLevelSlug is available
          const fetches: Promise<void>[] = []

          // Temperature fetch (uses gkdSlug)
          if (gkdSlug) {
            fetches.push((async () => {
              try {
                const params = new URLSearchParams({ kind, type: "temperature", slug: gkdSlug, beginn, ende })
                const res = await fetch(`/api/gkd?${params}`, { signal: controller.signal })
                if (res.ok && !controller.signal.aborted) {
                  const json = await res.json()
                  result.temperatures = json.data
                }
              } catch {
                // Individual type fetch failure is non-fatal
              }
            })())
          }

          // Level fetch (uses gkdLevelSlug if available)
          if (gkdLevelSlug) {
            fetches.push((async () => {
              try {
                const params = new URLSearchParams({ kind, type: "level", slug: gkdLevelSlug, beginn, ende })
                const res = await fetch(`/api/gkd?${params}`, { signal: controller.signal })
                if (res.ok && !controller.signal.aborted) {
                  const json = await res.json()
                  result.levels = json.data
                }
              } catch {
                // Individual type fetch failure is non-fatal
              }
            })())
          }

          await Promise.all(fetches)
        } else {
          // Rivers: fetch ALL data types in parallel — no refetch when switching panes
          const types: DataType[] = ["temperature", "level", "flow"]
          await Promise.all(types.map(async (type) => {
            try {
              const params = new URLSearchParams({ kind, type, slug: gkdSlug, beginn, ende })
              const res = await fetch(`/api/gkd?${params}`, { signal: controller.signal })
              if (!res.ok || controller.signal.aborted) return
              const json = await res.json()
              if (type === "temperature") result.temperatures = json.data
              else if (type === "level") result.levels = json.data
              else if (type === "flow") result.flows = json.data
            } catch {
              // Individual type fetch failure is non-fatal
            }
          }))
        }

        cacheRef.current[cacheKey] = result
        if (!controller.signal.aborted) {
          setHistory(result)
          setIsLoading(false)
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setIsLoading(false)
        }
      }
    }

    doFetch()
    return () => controller.abort()
    // dataType intentionally excluded — we fetch all types at once
  }, [gkdSlug, gkdLevelSlug, cacheKey, isGkdRange, needsGkdForLevel, river?.name, isLake])

  // For lakes, return GKD data for all lake time ranges (including "1w")
  // since lakes don't have server-side level data
  const shouldReturnHistory = isGkdRange || (isLake && !!history)

  return {
    history: shouldReturnHistory ? history : null,
    isLoading: shouldReturnHistory ? isLoading : false,
  }
}
