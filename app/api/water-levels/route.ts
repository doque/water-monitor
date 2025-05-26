import { NextResponse } from "next/server"
import { fetchRiversData } from "@/utils/water-data"

// Force dynamic rendering for this API route
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const data = await fetchRiversData()
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    })
  } catch (error) {
    console.error("Fehler beim Abrufen der Flussdaten:", error)
    return NextResponse.json(
      { error: "Fehler beim Abrufen der Flussdaten" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    )
  }
}
