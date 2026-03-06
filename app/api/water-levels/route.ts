import { NextResponse } from "next/server"
import { fetchRiversData } from "@/utils/water-data"
import { withEvlog, useLogger } from "@/lib/evlog"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const GET = withEvlog(async () => {
  const log = useLogger()
  try {
    const data = await fetchRiversData()
    log.set({ rivers: data.rivers.length })
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    })
  } catch (error) {
    log.error(error as Error)
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
})
