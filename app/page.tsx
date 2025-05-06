import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchRiversData } from "@/utils/water-data"
import { RiverDataDisplay } from "@/components/river-data-display"
import { RiverDataSkeleton } from "@/components/river-data-skeleton"
import { Suspense } from "react"
import Image from "next/image"

// Update the Header component with better dark mode support
function Header() {
  return (
    <CardHeader className="bg-blue-50 dark:bg-blue-950 flex flex-row items-center gap-2 p-3 sm:p-6">
      <div className="w-[50px] h-[50px] sm:w-[80px] sm:h-[80px] relative flex-shrink-0">
        <Image
          src="/images/mbteg-logo.png"
          alt="BFV Miesbach-Tegernsee Logo"
          fill
          className="object-contain"
          priority
        />
      </div>
      <div>
        <CardTitle className="text-blue-800 dark:text-blue-300 text-sm sm:text-xl">
          BFV Miesbach-Tegernsee Monitor
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">Wasserstände, Temperaturen und Abflussraten</CardDescription>
      </div>
    </CardHeader>
  )
}

// Async component to fetch and display river data
async function RiverDataContainer() {
  try {
    // Fetch river data
    const riversData = await fetchRiversData()

    // Check if we have any rivers data
    if (!riversData.rivers || riversData.rivers.length === 0) {
      return (
        <div className="p-6 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <p className="text-yellow-800 dark:text-yellow-300 font-medium">
            Keine Flussdaten verfügbar. Bitte versuchen Sie es später erneut.
          </p>
          {riversData.error && (
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-2">Fehler: {riversData.error}</p>
          )}
        </div>
      )
    }

    return <RiverDataDisplay data={riversData} />
  } catch (error) {
    console.error("Error in RiverDataContainer:", error)
    return (
      <div className="p-6 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <p className="text-yellow-800 dark:text-yellow-300 font-medium">Fehler beim Laden der Flussdaten.</p>
        <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-2">
          {error instanceof Error ? error.message : "Unbekannter Fehler"}
        </p>
        <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-2">
          Bitte versuchen Sie es später erneut oder kontaktieren Sie den Support.
        </p>
      </div>
    )
  }
}

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-2 sm:p-6 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-6xl space-y-4 sm:space-y-6">
        <Card className="border-gray-200 dark:border-gray-800">
          <Header />
          <CardContent className="pt-3 sm:pt-6 px-3 sm:px-6">
            <Suspense fallback={<RiverDataSkeleton />}>
              <RiverDataContainer />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
