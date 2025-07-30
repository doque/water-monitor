"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { RiversData } from "@/utils/water-data"

interface RiverDataContextType {
  data: RiversData | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const RiverDataContext = createContext<RiverDataContextType | undefined>(undefined)

interface RiverDataProviderProps {
  children: ReactNode
  initialData?: RiversData
}

export function RiverDataProvider({ children, initialData }: RiverDataProviderProps) {
  const [data, setData] = useState<RiversData | null>(initialData || null)
  const [isLoading, setIsLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch from our API route instead of directly calling fetchRiversData
      // to avoid making multiple concurrent requests to external sites
      const response = await fetch("/api/water-levels", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`)
      }

      const riversData = await response.json()
      setData(riversData)
    } catch (err) {
      console.error("Error fetching river data:", err)
      setError(err instanceof Error ? err.message : "Unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const refetch = async () => {
    await fetchData()
  }

  // Only fetch data if we don't have initial data
  useEffect(() => {
    if (!initialData) {
      fetchData()
    }
  }, [initialData])

  const contextValue: RiverDataContextType = {
    data,
    isLoading,
    error,
    refetch,
  }

  return <RiverDataContext.Provider value={contextValue}>{children}</RiverDataContext.Provider>
}

export function useRiverData(): RiverDataContextType {
  const context = useContext(RiverDataContext)
  if (context === undefined) {
    throw new Error("useRiverData must be used within a RiverDataProvider")
  }
  return context
}
