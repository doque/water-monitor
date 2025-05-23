import { NextResponse } from "next/server"
import { fetchRiversData } from "@/utils/water-data"

// Cache control headers
const cacheHeaders = {
  "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800", // 15 minutes cache, 30 minutes stale
}

export async function GET() {
  try {
    const data = await fetchRiversData()
    return NextResponse.json(data, {
      headers: cacheHeaders,
    })
  } catch (error) {
    console.error("Fehler beim Abrufen der Flussdaten:", error)
    return NextResponse.json(
      { error: "Fehler beim Abrufen der Flussdaten" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
    )
  }
}
