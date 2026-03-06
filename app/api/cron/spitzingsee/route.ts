import { NextResponse } from "next/server"
import { fetchSpitzingseeTemperature } from "@/utils/water-data"

// Vercel Cron job to update Spitzingsee temperature cache daily
// This ensures the blob cache stays fresh even without user visits

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron (in production)
  const authHeader = request.headers.get("authorization")
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const url = ["https://", "wasser", "temperatur", ".site/seen/", "water-temp-in-", "spitzingsee"].join("")

    console.log("Cron: Fetching Spitzingsee temperature data...")
    const result = await fetchSpitzingseeTemperature(url)

    if (result.current) {
      console.log(`Cron: Spitzingsee updated - ${result.history.length} data points, current: ${result.current.temperature}°C`)
      return NextResponse.json({
        success: true,
        dataPoints: result.history.length,
        currentTemp: result.current.temperature,
        latestDate: result.current.date,
      })
    } else {
      console.warn("Cron: Spitzingsee fetch returned no data")
      return NextResponse.json({ success: false, error: "No data returned" }, { status: 500 })
    }
  } catch (error) {
    console.error("Cron: Spitzingsee fetch failed:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
