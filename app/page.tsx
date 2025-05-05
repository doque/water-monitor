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
  // Fetch river data
  const riversData = await fetchRiversData()
  return <RiverDataDisplay data={riversData} />
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
