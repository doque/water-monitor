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
  isLake?: boolean
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
      // Log response content for small responses to help debug
      const shouldLogContent = html.length < 500 // Log content for responses smaller than 500 chars
      console.warn(
        `No water level data found for URL: ${url}. Response status: ${response.status}, Content length: ${html.length}. Table rows found: ${$("table.tblsort tbody tr").length}. Possible parsing issue or empty data table.${shouldLogContent ? ` Response content: ${html}` : ""}`,
      )
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
  // Check if this is a Spitzingsee URL (wassertemperatur.site)
  if (url.includes("wassertemperatur.site")) {
    return fetchSpitzingseeTemperature(url)
  }

  // Original Bavarian government site parsing logic
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
      // Log response content for small responses to help debug
      const shouldLogContent = html.length < 500 // Log content for responses smaller than 500 chars
      console.warn(
        `No temperature data found for URL: ${url}. Response status: ${response.status}, Content length: ${html.length}. Table rows found: ${$("table.tblsort tbody tr").length}. Possible parsing issue or empty data table.${shouldLogContent ? ` Response content: ${html}` : ""}`,
      )
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
      // Log response content for small responses to help debug
      const shouldLogContent = html.length < 500 // Log content for responses smaller than 500 chars
      console.warn(
        `No flow data found for URL: ${url}. Response status: ${response.status}, Content length: ${html.length}. Table rows found: ${$("table.tblsort tbody tr").length}. Possible parsing issue or empty data table.${shouldLogContent ? ` Response content: ${html}` : ""}`,
      )
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

// New function to parse Spitzingsee temperature data from JavaScript
async function fetchSpitzingseeTemperature(url: string): Promise<{
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
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`)
    }

    const html = await response.text()

    // More robust regex to extract the JavaScript data array
    // Look for arrayToDataTable followed by the data array, handling multiline and various whitespace
    const dataMatch = html.match(/arrayToDataTable$$\[\s*\['Days',\s*'[^']+'\],\s*((?:\[[-\d]+,[\d.]+\],?\s*)+)\s*\]$$/)

    if (!dataMatch) {
      // Try alternative pattern in case the format is slightly different
      const altMatch = html.match(/\[[-\d]+,[\d.]+\](?:\s*,\s*\[[-\d]+,[\d.]+\])*/g)
      if (altMatch) {
        console.log(`Found alternative data pattern for Spitzingsee: ${altMatch[0].substring(0, 100)}...`)
        // Process the alternative match
        const dataString = altMatch.join(",")
        return processSpitzingseeData(dataString, url)
      }

      console.warn(`No JavaScript temperature data found for Spitzingsee URL: ${url}`)
      console.log(`HTML sample: ${html.substring(0, 1000)}...`) // Log first 1000 chars for debugging
      return {
        current: null,
        history: [],
        changeStatus: "stable",
      }
    }

    return processSpitzingseeData(dataMatch[1], url)
  } catch (error) {
    console.error(`Error fetching Spitzingsee temperature data for ${url}:`, error)
    return {
      current: null,
      history: [],
      changeStatus: "stable",
    }
  }
}

// Helper function to process the extracted data string
function processSpitzingseeData(
  dataString: string,
  url: string,
): {
  current: WaterTemperatureDataPoint
  history: WaterTemperatureDataPoint[]
  previousDay?: WaterTemperatureDataPoint
  change?: number
  changeStatus: ChangeStatus
} {
  const dataPoints: WaterTemperatureDataPoint[] = []

  // Extract individual data points [day, temperature] - more flexible regex
  const pointMatches = dataString.match(/\[(-?\d+),(\d+(?:\.\d+)?)\]/g)

  if (!pointMatches) {
    console.warn(`Could not parse data points from Spitzingsee data: ${dataString.substring(0, 200)}...`)
    return {
      current: null,
      history: [],
      changeStatus: "stable",
    }
  }

  console.log(`Found ${pointMatches.length} data points for Spitzingsee`)

  // Convert day-of-year to actual dates and create data points
  const currentYear = 2025
  pointMatches.forEach((match) => {
    const pointMatch = match.match(/\[(-?\d+),(\d+(?:\.\d+)?)\]/)
    if (pointMatch) {
      const dayOfYear = Number.parseInt(pointMatch[1], 10)
      const temperature = Number.parseFloat(pointMatch[2])

      // Convert day of year to actual date
      // Day 0 = January 1, 2025
      const date = new Date(currentYear, 0, 1) // Start with Jan 1
      date.setDate(date.getDate() + dayOfYear) // Add the day offset

      // Format date as German format for consistency
      const dateString = `${date.getDate().toString().padStart(2, "0")}.${(date.getMonth() + 1).toString().padStart(2, "0")}.${date.getFullYear()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`

      const dataPoint: WaterTemperatureDataPoint = {
        date: dateString,
        temperature,
        timestamp: date,
      }

      dataPoints.push(dataPoint)
    }
  })

  // Sort by timestamp (most recent first)
  dataPoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  // Filter to last 7 days for consistency with other data sources
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recentHistory = dataPoints.filter((point) => point.timestamp >= sevenDaysAgo)

  if (recentHistory.length === 0) {
    console.warn(`No recent temperature data found for Spitzingsee (last 7 days)`)
    return {
      current: null,
      history: [],
      changeStatus: "stable",
    }
  }

  const current = recentHistory[0] // Most recent data point

  // Find previous day data (approximately 24 hours ago)
  let previousDay: WaterTemperatureDataPoint = null
  let change: number = null
  let changeStatus: ChangeStatus = "stable"

  if (current) {
    // Find the closest data point to 24 hours ago
    previousDay = recentHistory.find((point) => {
      const timeDiff = Math.abs(current.timestamp.getTime() - point.timestamp.getTime())
      return timeDiff >= 20 * 60 * 60 * 1000 && timeDiff <= 28 * 60 * 60 * 1000 // Between 20-28 hours
    })

    if (previousDay) {
      change = current.temperature - previousDay.temperature
      const percentChange = (change / previousDay.temperature) * 100
      changeStatus = getChangeStatus(percentChange)
    }
  }

  console.log(`Successfully parsed ${recentHistory.length} Spitzingsee temperature data points`)

  return {
    current,
    history: recentHistory,
    previousDay,
    change,
    changeStatus,
  }
}

// Alle Daten für einen Fluss parallel abrufen
async function fetchRiverData(config): Promise<RiverData> {
  try {
    // Check if this is a lake (only has temperature data)
    const isLake = config.isLake === true

    // Prepare requests based on available data sources
    const requests = []
    const requestTypes = []

    // Only add level and flow requests if this is not a lake
    if (!isLake) {
      if (config.levelUrl) {
        requests.push(fetchWaterLevel(config.levelUrl))
        requestTypes.push("level")
      } else {
        requests.push(Promise.resolve({ current: null, history: [], changeStatus: "stable" }))
        requestTypes.push("level")
      }
      if (config.flowUrl) {
        requests.push(fetchWaterFlow(config.flowUrl))
        requestTypes.push("flow")
      } else {
        requests.push(Promise.resolve({ current: null, history: [], changeStatus: "stable" }))
        requestTypes.push("flow")
      }
    } else {
      // For lakes, add empty level data
      requests.push(Promise.resolve({ current: null, history: [], changeStatus: "stable" }))
      requestTypes.push("level")
      // For lakes, add empty flow data
      requests.push(Promise.resolve({ current: null, history: [], changeStatus: "stable" }))
      requestTypes.push("flow")
    }

    // Add temperature request if URL is available
    if (config.temperatureUrl) {
      requests.push(fetchWaterTemperature(config.temperatureUrl))
      requestTypes.push("temperature")
    } else {
      requests.push(Promise.resolve({ current: null, history: [], changeStatus: "stable" }))
      requestTypes.push("temperature")
    }

    // Execute all requests in parallel
    const results = await Promise.all(requests)

    // Map results to their respective data types
    const dataMap = {}
    requestTypes.forEach((type, index) => {
      dataMap[type] = results[index]
    })

    // Calculate alert level based on flow thresholds if available
    let alertLevel: AlertLevel = "normal"
    if (config.flowThresholds && dataMap.flow.current) {
      alertLevel = getAlertLevelFromFlow(dataMap.flow.current.flow, config.flowThresholds)
    }

    // Flussdatenobjekt erstellen
    const riverData: RiverData = {
      name: config.name,
      location: config.location,
      current: {
        level: dataMap.level.current,
        temperature: dataMap.temperature.current,
        flow: dataMap.flow.current,
      },
      history: {
        levels: dataMap.level.history,
        temperatures: dataMap.temperature.history,
        flows: dataMap.flow.history,
      },
      previousDay: {
        level: dataMap.level.previousDay,
        temperature: dataMap.temperature.previousDay,
        flow: dataMap.flow.previousDay,
      },
      changes: {
        levelPercentage: dataMap.level.percentageChange,
        levelStatus: dataMap.level.changeStatus,
        temperatureChange: dataMap.temperature.change,
        temperatureStatus: dataMap.temperature.changeStatus,
        flowPercentage: dataMap.flow.percentageChange,
        flowStatus: dataMap.flow.changeStatus,
      },
      urls: {
        level: config.levelUrl,
        temperature: config.temperatureUrl,
        flow: config.flowUrl,
      },
      webcamUrl: config.webcamUrl,
      flowThresholds: config.flowThresholds,
      alertLevel: alertLevel,
      isLake: config.isLake === true,
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
      isLake: config.isLake === true,
    }
  }
}

// Hauptfunktion zum Abrufen aller Flussdaten - NO CACHING
export async function fetchRiversData(includeAllRivers = false): Promise<RiversData> {
  try {
    console.log("Fetching fresh river data (no cache)")

    // Filter rivers based on admin mode - exclude Söllbach in normal mode
    const riversToFetch = includeAllRivers
      ? riverSources.rivers
      : riverSources.rivers.filter((river) => river.name !== "Söllbach")

    // Alle Flüsse parallel abrufen - NO CACHING
    const riversPromises = riversToFetch.map((config) => fetchRiverData(config))
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
  // Handle undefined URLs
  if (!url) {
    console.warn("URL is undefined in extractRiverId")
    return "unknown"
  }

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
