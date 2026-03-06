import { NextResponse } from "next/server"
import * as cheerio from "cheerio"

export const dynamic = "force-dynamic"
export const revalidate = 0

export interface GkdDataPoint {
  date: string      // "DD.MM.YYYY 00:00"
  value: number
  timestamp: number // ms since epoch
}

type DataKind = "lake" | "river"
type DataType = "temperature" | "level" | "flow"

function buildGkdUrl(kind: DataKind, type: DataType, slug: string, beginn: string, ende: string): string {
  const base = "https://www.gkd.bayern.de/de"
  if (kind === "lake") {
    if (type === "level") {
      // Lake water level (Pegel)
      return `${base}/seen/wasserstand/bayern/${slug}/messwerte/tabelle?beginn=${beginn}&ende=${ende}&addhr=hr_w_hw`
    }
    // Lake temperature
    return `${base}/seen/wassertemperatur/bayern/${slug}/gesamtzeitraum/tabelle?start=${ende}&beginn=${beginn}&ende=${ende}&dir=none`
  }
  const pathMap: Record<DataType, string> = {
    temperature: "fluesse/wassertemperatur",
    level: "fluesse/wasserstand",
    flow: "fluesse/abfluss",
  }
  const extraMap: Record<DataType, string> = {
    temperature: "",
    level: "&addhr=hr_w_hw",
    flow: "&addhr=hr_hw",
  }
  return `${base}/${pathMap[type]}/bayern/${slug}/gesamtzeitraum/tabelle?beginn=${beginn}&ende=${ende}${extraMap[type]}`
}

function toDateString(d: Date): string {
  const dd = d.getDate().toString().padStart(2, "0")
  const mm = (d.getMonth() + 1).toString().padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy} 00:00`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const kind = searchParams.get("kind") as DataKind
  const type = searchParams.get("type") as DataType
  const slug = searchParams.get("slug")
  const beginn = searchParams.get("beginn")
  const ende = searchParams.get("ende")

  if (!kind || !type || !slug || !beginn || !ende) {
    return NextResponse.json({ error: "Missing params: kind, type, slug, beginn, ende required" }, { status: 400 })
  }

  const url = buildGkdUrl(kind, type, slug, beginn, ende)

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Googlebot" },
      next: { revalidate: 3600 }, // Cache GKD HTML for 1 hour
    })
    if (!res.ok) {
      return NextResponse.json({ error: `GKD returned ${res.status}` }, { status: 502 })
    }

    const html = await res.text()
    const $ = cheerio.load(html)
    const data: GkdDataPoint[] = []

    $("table.tblsort tbody tr").each((_, row) => {
      const cells = $(row).find("td")
      const dateStr = cells.eq(0).text().trim()        // "DD.MM.YYYY" or "DD.MM.YYYY HH:MM"
      const valueStr = cells.eq(1).text().trim().replace(",", ".")  // Mittelwert

      if (!dateStr || !valueStr || valueStr === "-") return

      // Split off time portion first ("DD.MM.YYYY HH:MM" → "DD.MM.YYYY" + "HH:MM")
      const [datePart, timePart] = dateStr.split(" ")
      const [d, m, y] = datePart.split(".")
      if (!d || !m || !y) return

      let timestamp: number
      if (timePart) {
        const [hh, mm] = timePart.split(":")
        timestamp = new Date(+y, +m - 1, +d, +(hh || 0), +(mm || 0)).getTime()
      } else {
        timestamp = new Date(+y, +m - 1, +d).getTime()
      }
      if (isNaN(timestamp)) return

      const value = parseFloat(valueStr)
      if (isNaN(value)) return

      data.push({ date: dateStr, value, timestamp })
    })

    // Return oldest-first (GKD gives newest-first)
    data.reverse()

    return NextResponse.json({ data }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800" },
    })
  } catch (err) {
    console.error("GKD fetch error:", err)
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 })
  }
}
