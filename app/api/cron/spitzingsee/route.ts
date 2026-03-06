import { NextResponse } from "next/server"
import { fetchSpitzingseeTemperature } from "@/utils/water-data"
import { withEvlog, useLogger } from "@/lib/evlog"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export const GET = withEvlog(async (request: Request) => {
  const log = useLogger()
  log.set({ cron: "spitzingsee" })

  const authHeader = request.headers.get("authorization")
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const url = ["https://", "wasser", "temperatur", ".site/seen/", "water-temp-in-", "spitzingsee"].join("")
    const result = await fetchSpitzingseeTemperature(url)

    if (result.current) {
      log.set({ spitzingsee: { points: result.history.length, temp: result.current.temperature } })
      return NextResponse.json({
        success: true,
        dataPoints: result.history.length,
        currentTemp: result.current.temperature,
        latestDate: result.current.date,
      })
    } else {
      log.set({ spitzingsee: { error: "no_data" } })
      return NextResponse.json({ success: false, error: "No data returned" }, { status: 500 })
    }
  } catch (error) {
    log.error(error as Error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
})
