import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { fetchRiversData } from "@/utils/water-data"
import { RiverDataDisplay } from "@/components/river-data-display"
import { RiverDataSkeleton } from "@/components/river-data-skeleton"
import { Suspense } from "react"
import Image from "next/image"

// Static header component to prevent layout shift
function Header() {
  return (
    <CardHeader className="bg-blue-50 flex flex-col sm:flex-row items-center gap-2 py-2">
      <Image
        src="/images/mbteg-logo.png"
        alt="BFV Miesbach-Tegernsee Logo"
        width={60}
        height={60}
        className="rounded-full"
      />
      <div>
        <CardDescription className="text-center sm:text-left">
          Aktuelle Wasserstände, Temperaturen und Abflussraten
        </CardDescription>
      </div>
    </CardHeader>
  )
}

// Async component to fetch and display river data
async function RiverDataContainer() {
  // Flussdaten abrufen
  const riversData = await fetchRiversData()
  return <RiverDataDisplay data={riversData} />
}

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-2 sm:p-6 bg-gray-50">
      <div className="w-full max-w-6xl space-y-4">
        <Card>
          <Header />
          <CardContent className="pt-4">
            <Suspense fallback={<RiverDataSkeleton />}>
              <RiverDataContainer />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
