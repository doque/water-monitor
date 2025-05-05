import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchRiversData } from "@/utils/water-data"
import { RiverDataDisplay } from "@/components/river-data-display"
import { RiverDataSkeleton } from "@/components/river-data-skeleton"
import { Suspense } from "react"
import Image from "next/image"

// Update the Header component to ensure the logo displays correctly
function Header() {
  return (
    <CardHeader className="bg-blue-50 flex flex-col sm:flex-row items-center gap-4">
      <div className="w-[100px] h-[100px] relative">
        <Image
          src="/images/mbteg-logo.png"
          alt="BFV Miesbach-Tegernsee Logo"
          fill
          className="object-contain"
          priority
        />
      </div>
      <div>
        <CardTitle className="text-blue-800 text-center sm:text-left">BFV Miesbach-Tegernsee Monitor</CardTitle>
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
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-6xl space-y-6">
        <Card>
          <Header />
          <CardContent className="pt-6">
            <Suspense fallback={<RiverDataSkeleton />}>
              <RiverDataContainer />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
