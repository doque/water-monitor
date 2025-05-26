import * as cheerio from "cheerio"
import riverSources from "@/data/river-sources.json"

export interface WaterLevelDataPoint {
  date: string
  level: number
  timestamp: Date
  hour: number
}

export interface WaterTemperatureDataPoint {
  date: string
  temperature: number
  timestamp: Date
}

export interface WaterFlowDataPoint {
  date: string
  flow: number // in m³/s
  timestamp: Date
}

export type ThresholdRange = [number | null, number | null]
export type ThresholdRanges = ThresholdRange | ThresholdRange[]

export interface Thresholds {
  green: ThresholdRanges
  yellow: ThresholdRanges
  red: ThresholdRanges
}

export type AlertLevel = "normal" | "warning" | "alert"

export interface RiverData {
  name: string
  location: string
  current: {
    level?: WaterLevelDataPoint
    temperature?: WaterTemperatureDataPoint
    flow?: WaterFlowDataPoint
  }
  history: {
    levels: WaterLevelDataPoint[]
    temperatures: WaterTemperatureDataPoint[]
    flows: WaterFlowDataPoint[]
  }
  previousDay?: {
    level?: WaterLevelDataPoint
    temperature?: WaterTemperatureDataPoint
    flow?: WaterFlowDataPoint
  }
  changes: {
    levelPercentage?: number
    levelStatus?: ChangeStatus
    temperatureChange?: number
    temperatureStatus?: ChangeStatus
    flowPercentage?: number
    flowStatus?: ChangeStatus
  }
  urls: {
    level: string
    temperature?: string
    flow?: string
  }
  webcamUrl?: string
  flowThresholds?: Thresholds
  alertLevel?: AlertLevel
}

export type ChangeStatus =
  | "stable"
  | "small-increase"
  | "small-decrease"
  | "medium-increase"
  | "medium-decrease"
  | "large-increase"
  | "large-decrease"

export interface RiversData {
  rivers: RiverData[]
  lastUpdated: Date
  error?: string
}

// Helper function to check if a value is within a threshold range
export function isWithinRange(value: number, range: ThresholdRanges): boolean {
  if (Array.isArray(range[0])) {
    // Multiple ranges
    return (range as ThresholdRange[]).some((r) => isWithinSingleRange(value, r))
  } else {
    // Single range
    return isWithinSingleRange(value, range as ThresholdRange)
  }
}

function isWithinSingleRange(value: number, range: ThresholdRange): boolean {
  const [min, max] = range
  if (min === null && max === null) return true
  if (min === null) return value <= max
  if (max === null) return value >= min
  return value >= min && value <= max
}

// Determine alert level based on flow thresholds
export function getAlertLevelFromFlow(flow: number, thresholds: Thresholds): AlertLevel {
  if (isWithinRange(flow, thresholds.red)) return "alert"
  if (isWithinRange(flow, thresholds.yellow)) return "warning"
  if (isWithinRange(flow, thresholds.green)) return "normal"
  return "normal" // Default
}

// Hilfsfunktion zur Bestimmung des Änderungsstatus basierend auf dem Prozentsatz
function getChangeStatus(percentageChange: number): ChangeStatus {
  if (percentageChange > 50) {
    return "large-increase"
  } else if (percentageChange < -50) {
    return "large-decrease"
  } else if (percentageChange > 15) {
    return "large-increase"
  } else if (percentageChange < -15) {
    return "large-decrease"
  } else if (percentageChange > 5) {
    return "medium-increase"
  } else if (percentageChange < -5) {
    return "medium-decrease"
  } else if (percentageChange > 0) {
    return "small-increase"
  } else if (percentageChange < 0) {
    return "small-decrease"
  } else {
    return "stable"
  }
}

// Hilfsfunktion zum Parsen des deutschen Datumsformats (DD.MM.YYYY HH:MM)
function parseGermanDate(dateString: string): Date {
  const [datePart, timePart] = dateString.split(" ")
  const [day, month, year] = datePart.split(".").map(Number)
  const [hour, minute] = timePart ? timePart.split(":").map(Number) : [0, 0]

  return new Date(year, month - 1, day, hour, minute)
}

// Wasserstandsdaten abrufen
async function fetchWaterLevel(url: string): Promise<{
  current: WaterLevelDataPoint
  history: WaterLevelDataPoint[]
  previousDay?: WaterLevelDataPoint
  percentageChange?: number
  changeStatus: ChangeStatus
}> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
      cache: "no-store", // Completely disable caching
    })

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Daten initialisieren
    let current: WaterLevelDataPoint = null
    const history: WaterLevelDataPoint[] = []

    // Tabellenzeilen verarbeiten, um Daten zu extrahieren
    $("table.tblsort tbody tr").each((index, element) => {
      const dateText = $(element).find("td").eq(0).text().trim()
      const levelText = $(element).find("td.center").text().trim()
      const level = Number.parseInt(levelText, 10)

      if (isNaN(level)) return // Überspringen, wenn der Pegel keine Zahl ist

      const timestamp = parseGermanDate(dateText)

      const dataPoint: WaterLevelDataPoint = {
        date: dateText,
        level,
        timestamp,
        hour: timestamp.getHours(),
      }

      // Zur Historie hinzufügen
      history.push(dataPoint)

      // Aktuellen Datenpunkt setzen (erste Zeile)
      if (index === 0) {
        current = dataPoint
      }
    })

    // Check if we actually got any data
    if (history.length === 0) {
      console.warn(`No water level data found for URL: ${url}`)
      return {
        current: null,
        history: [],
        changeStatus: "stable",
      }
    }

    // Daten vom Vortag zur gleichen Stunde finden
    let previousDay: WaterLevelDataPoint = null
    let percentageChange: number = null
    let changeStatus: ChangeStatus = "stable"

    if (current) {
      const currentHour = current.hour
      previousDay = history.find((point) => {
        const hourDiff = Math.abs(point.hour - currentHour)
        const timeDiff = current.timestamp.getTime() - point.timestamp.getTime()
        // Nach Datenpunkten suchen, die ungefähr 24 Stunden zurückliegen (zwischen 23-25 Stunden)
        return hourDiff <= 1 && timeDiff >= 23 * 60 * 60 * 1000 && timeDiff <= 25 * 60 * 60 * 1000
      })

      if (previousDay && previousDay.level > 0) {
        percentageChange = ((current.level - previousDay.level) / previousDay.level) * 100
        changeStatus = getChangeStatus(percentageChange)
      }
    }

    return {
      current,
      history,
      previousDay,
      percentageChange,
      changeStatus,
    }
  } catch (error) {
    console.error(`Fehler beim Abrufen der Wasserstandsdaten für ${url}:`, error)
    return {
      current: null,
      history: [],
      changeStatus: "stable",
    }
  }
}

// Wassertemperaturdaten abrufen
async function fetchWaterTemperature(url: string): Promise<{
  current: WaterTemperatureDataPoint
  history: WaterTemperatureDataPoint[]
  previousDay?: WaterTemperatureDataPoint
  change?: number
  changeStatus: ChangeStatus
}> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
      cache: "no-store", // Completely disable caching
    })

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Daten initialisieren
    let current: WaterTemperatureDataPoint = null
    const history: WaterTemperatureDataPoint[] = []

    // Tabellenzeilen verarbeiten, um Daten zu extrahieren
    $("table.tblsort tbody tr").each((index, element) => {
      const dateText = $(element).find("td").eq(0).text().trim()
      const tempText = $(element).find("td.center").text().trim()
      const temperature = Number.parseFloat(tempText.replace(",", ".")) // Deutsches Dezimalformat verarbeiten

      if (isNaN(temperature)) return // Überspringen, wenn die Temperatur keine Zahl ist

      const timestamp = parseGermanDate(dateText)

      const dataPoint: WaterTemperatureDataPoint = {
        date: dateText,
        temperature,
        timestamp,
      }

      // Zur Historie hinzufügen
      history.push(dataPoint)

      // Aktuellen Datenpunkt setzen (erste Zeile)
      if (index === 0) {
        current = dataPoint
      }
    })

    // Check if we actually got any data
    if (history.length === 0) {
      console.warn(`No temperature data found for URL: ${url}`)
      return {
        current: null,
        history: [],
        changeStatus: "stable",
      }
    }

    // Daten vom Vortag zur ungefähr gleichen Zeit finden
    let previousDay: WaterTemperatureDataPoint = null
    let change: number = null
    let changeStatus: ChangeStatus = "stable"

    if (current) {
      const currentHour = current.timestamp.getHours()
      previousDay = history.find((point) => {
        const hourDiff = Math.abs(point.timestamp.getHours() - currentHour)
        const timeDiff = current.timestamp.getTime() - point.timestamp.getTime()
        // Nach Datenpunkten suchen, die ungefähr 24 Stunden zurückliegen (zwischen 23-25 Stunden)
        return hourDiff <= 1 && timeDiff >= 23 * 60 * 60 * 1000 && timeDiff <= 25 * 60 * 60 * 1000
      })

      if (previousDay) {
        change = current.temperature - previousDay.temperature
        // Für die Temperatur verwenden wir die absolute Änderung anstelle des Prozentsatzes
        const percentChange = (change / previousDay.temperature) * 100
        changeStatus = getChangeStatus(percentChange)
      }
    }

    return {
      current,
      history,
      previousDay,
      change,
      changeStatus,
    }
  } catch (error) {
    console.error(`Fehler beim Abrufen der Wassertemperaturdaten für ${url}:`, error)
    return {
      current: null,
      history: [],
      changeStatus: "stable",
    }
  }
}

// Abflussdaten abrufen
async function fetchWaterFlow(url: string): Promise<{
  current: WaterFlowDataPoint
  history: WaterFlowDataPoint[]
  previousDay?: WaterFlowDataPoint
  percentageChange?: number
  changeStatus: ChangeStatus
}> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
      cache: "no-store", // Completely disable caching
    })

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Daten initialisieren
    let current: WaterFlowDataPoint = null
    const history: WaterFlowDataPoint[] = []

    // Tabellenzeilen verarbeiten, um Daten zu extrahieren
    $("table.tblsort tbody tr").each((index, element) => {
      const dateText = $(element).find("td").eq(0).text().trim()
      const flowText = $(element).find("td.center").text().trim()
      const flow = Number.parseFloat(flowText.replace(",", ".")) // Deutsches Dezimalformat verarbeiten

      if (isNaN(flow)) return // Überspringen, wenn der Abfluss keine Zahl ist

      const timestamp = parseGermanDate(dateText)

      const dataPoint: WaterFlowDataPoint = {
        date: dateText,
        flow,
        timestamp,
      }

      // Zur Historie hinzufügen
      history.push(dataPoint)

      // Aktuellen Datenpunkt setzen (erste Zeile)
      if (index === 0) {
        current = dataPoint
      }
    })

    // Check if we actually got any data
    if (history.length === 0) {
      console.warn(`No flow data found for URL: ${url}`)
      return {
        current: null,
        history: [],
        changeStatus: "stable",
      }
    }

    // Daten vom Vortag zur ungefähr gleichen Zeit finden
    let previousDay: WaterFlowDataPoint = null
    let percentageChange: number = null
    let changeStatus: ChangeStatus = "stable"

    if (current) {
      const currentHour = current.timestamp.getHours()
      previousDay = history.find((point) => {
        const hourDiff = Math.abs(point.timestamp.getHours() - currentHour)
        const timeDiff = current.timestamp.getTime() - point.timestamp.getTime()
        // Nach Datenpunkten suchen, die ungefähr 24 Stunden zurückliegen (zwischen 23-25 Stunden)
        return hourDiff <= 1 && timeDiff >= 23 * 60 * 60 * 1000 && timeDiff <= 25 * 60 * 60 * 1000
      })

      if (previousDay && previousDay.flow > 0) {
        percentageChange = ((current.flow - previousDay.flow) / previousDay.flow) * 100
        changeStatus = getChangeStatus(percentageChange)
      }
    }

    return {
      current,
      history,
      previousDay,
      percentageChange,
      changeStatus,
    }
  } catch (error) {
    console.error(`Fehler beim Abrufen der Abflussdaten für ${url}:`, error)
    return {
      current: null,
      history: [],
      changeStatus: "stable",
    }
  }
}

// Alle Daten für einen Fluss parallel abrufen
async function fetchRiverData(config): Promise<RiverData> {
  try {
    // Alle Anfragen parallel ausführen
    const [levelData, temperatureData, flowData] = await Promise.all([
      fetchWaterLevel(config.levelUrl),
      config.temperatureUrl
        ? fetchWaterTemperature(config.temperatureUrl)
        : Promise.resolve({ current: null, history: [], changeStatus: "stable" }),
      config.flowUrl
        ? fetchWaterFlow(config.flowUrl)
        : Promise.resolve({ current: null, history: [], changeStatus: "stable" }),
    ])

    // Calculate alert level based on flow thresholds if available
    let alertLevel: AlertLevel = "normal"
    if (config.flowThresholds && flowData.current) {
      alertLevel = getAlertLevelFromFlow(flowData.current.flow, config.flowThresholds)
    }

    // Flussdatenobjekt erstellen
    const riverData: RiverData = {
      name: config.name,
      location: config.location,
      current: {
        level: levelData.current,
        temperature: temperatureData.current,
        flow: flowData.current,
      },
      history: {
        levels: levelData.history,
        temperatures: temperatureData.history,
        flows: flowData.history,
      },
      previousDay: {
        level: levelData.previousDay,
        temperature: temperatureData.previousDay,
        flow: flowData.previousDay,
      },
      changes: {
        levelPercentage: levelData.percentageChange,
        levelStatus: levelData.changeStatus,
        temperatureChange: temperatureData.change,
        temperatureStatus: temperatureData.changeStatus,
        flowPercentage: flowData.percentageChange,
        flowStatus: flowData.changeStatus,
      },
      urls: {
        level: config.levelUrl,
        temperature: config.temperatureUrl,
        flow: config.flowUrl,
      },
      webcamUrl: config.webcamUrl,
      flowThresholds: config.flowThresholds,
      alertLevel: alertLevel,
    }

    return riverData
  } catch (error) {
    console.error(`Fehler beim Abrufen der Daten für ${config.name}:`, error)
    // Leeres Flussdatenobjekt zurückgeben
    return {
      name: config.name,
      location: config.location,
      current: {},
      history: {
        levels: [],
        temperatures: [],
        flows: [],
      },
      changes: {},
      urls: {
        level: config.levelUrl,
        temperature: config.temperatureUrl,
        flow: config.flowUrl,
      },
      webcamUrl: config.webcamUrl,
      flowThresholds: config.flowThresholds,
      alertLevel: "normal",
    }
  }
}

// Hauptfunktion zum Abrufen aller Flussdaten - NO CACHING
export async function fetchRiversData(): Promise<RiversData> {
  try {
    console.log("Fetching fresh river data (no cache)")

    // Alle Flüsse parallel abrufen - NO CACHING
    const riversPromises = riverSources.rivers.map((config) => fetchRiverData(config))
    const rivers = await Promise.all(riversPromises)

    return {
      rivers,
      lastUpdated: new Date(),
    }
  } catch (error) {
    console.error("Fehler beim Abrufen der Flussdaten:", error)
    return {
      rivers: [],
      lastUpdated: new Date(),
      error: error.message,
    }
  }
}

// Add a helper function to extract river ID from URL
export function extractRiverId(url: string): string {
  // URLs look like: https://www.hnd.bayern.de/pegel/inn/schmerold-18202000/tabelle?methode=wasserstand&setdiskr=15
  // We want to extract the "schmerold-18202000" part

  try {
    const urlParts = url.split("/")
    // The ID is typically the second-to-last part before "tabelle"
    const idIndex = urlParts.findIndex((part) => part === "tabelle") - 1
    if (idIndex > 0) {
      return urlParts[idIndex]
    }
    // Fallback: try to find the ID pattern directly
    for (const part of urlParts) {
      // IDs typically have a pattern like "name-number"
      if (part.includes("-") && /\d+$/.test(part)) {
        return part
      }
    }
  } catch (error) {
    console.error("Error extracting river ID:", error)
  }

  // If we can't extract the ID, return a fallback
  return "unknown"
}

export type WaterLevelData = RiverData
