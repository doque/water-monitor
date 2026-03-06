/**
 * One-time migration: Convert Spitzingsee blob cache keys from German to ISO format
 *
 * Run with: npx tsx scripts/migrate-blob-timestamps.ts
 */

import { config } from "dotenv"
config({ path: ".env.local" })

import { list, put } from "@vercel/blob"

const BLOB_FILE = "spitzingsee-temps.json"

interface SpitzingseeCacheEntry {
  raw: number
  jittered: number
}

interface SpitzingseeCache {
  lastUpdated: string
  temps: Record<string, SpitzingseeCacheEntry>
}

function toFullISO(dateKey: string): string {
  // Already full ISO?
  if (dateKey.includes("T")) return dateKey

  // Short ISO: "2026-03-06" -> "2026-03-06T00:00:00.000Z"
  if (dateKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return new Date(dateKey).toISOString()
  }

  // German: "06.03.2026 00:00" -> "2026-03-06T00:00:00.000Z"
  const [datePart] = dateKey.split(" ")
  const [d, m, y] = datePart.split(".")
  return new Date(+y, +m - 1, +d).toISOString()
}

async function migrate() {
  console.log("Reading existing blob...")

  const { blobs } = await list({ prefix: BLOB_FILE })
  console.log(`Found ${blobs.length} blobs:`, blobs.map(b => b.pathname))
  if (blobs.length === 0) {
    console.log("No blob found, nothing to migrate")
    return
  }

  console.log(`Reading from: ${blobs[0].url}`)
  const res = await fetch(blobs[0].url, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    cache: "no-store",
  })

  if (!res.ok) {
    console.error("Failed to read blob:", res.status)
    return
  }

  const cache: SpitzingseeCache = await res.json()
  const keys = Object.keys(cache.temps)
  console.log(`Found ${keys.length} entries`)
  console.log(`Sample key: ${keys[0]}`)

  // Check if already fully migrated (all keys have T)
  const needsMigration = keys.some(k => !k.includes("T"))
  if (!needsMigration) {
    console.log("Already using full ISO format, nothing to do")
    return
  }

  // Convert all keys to full ISO
  const migratedTemps: Record<string, SpitzingseeCacheEntry> = {}
  let converted = 0

  for (const [key, value] of Object.entries(cache.temps)) {
    try {
      const isoKey = toFullISO(key)
      migratedTemps[isoKey] = value
      converted++
    } catch (e) {
      console.warn(`Skipping invalid key: ${key}`, e)
    }
  }

  console.log(`Converted ${converted} keys to full ISO`)

  // Write back
  const newCache: SpitzingseeCache = {
    lastUpdated: new Date().toISOString(),
    temps: migratedTemps,
  }

  const result = await put(BLOB_FILE, JSON.stringify(newCache), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
  })

  console.log(`Written to: ${result.url}`)
  console.log("Migration complete!")
}

migrate().catch(console.error)
