import { NextResponse } from "next/server"
import { fetchRiversData } from "@/utils/water-data"

export async function GET() {
  try {
    const data = await fetchRiversData()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Fehler beim Abrufen der Flussdaten:", error)
    return NextResponse.json({ error: "Fehler beim Abrufen der Flussdaten" }, { status: 500 })
  }
}
