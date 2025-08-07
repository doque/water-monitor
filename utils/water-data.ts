import * as cheerio from "cheerio"
import riverSources from "@/data/river-sources.json"

const currentYear = 2025 // Declare the currentYear variable

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
  situation?: string // Add optional situation field for Bayern.de lakes
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

  // Bayern.de parsing logic for Schliersee and Tegernsee - enhanced with Situation column
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
    const $ = cheerio.load(html)

    // Initialize data
    let current: WaterTemperatureDataPoint = null
    const history: WaterTemperatureDataPoint[] = []

    // Use standard Bayern.de table parsing - try multiple selectors for robustness
    let tableRows = $("table.tblsort tbody tr")
    if (tableRows.length === 0) {
      tableRows = $("table tbody tr")
    }
    if (tableRows.length === 0) {
      tableRows = $("table tr").not(":first") // Skip header row
    }

    // Process table rows to extract data including Situation column
    tableRows.each((index, element) => {
      const $row = $(element)
      const cells = $row.find("td")

      if (cells.length < 2) return // Skip rows with insufficient cells

      // Only use first two cells for date and temperature parsing
      const dateText = cells.eq(0).text().trim()
      const tempText = cells.eq(1).text().trim()

      // Extract Situation column (third column) for Schliersee and Tegernsee
      let situation = ""
      if (cells.length >= 3) {
        situation = cells.eq(2).text().trim()
      }

      // Extract temperature value
      const tempMatch = tempText.match(/(\d+[.,]\d*)/)
      if (!tempMatch) return

      const temperature = Number.parseFloat(tempMatch[1].replace(",", "."))
      if (isNaN(temperature)) return

      const timestamp = parseGermanDate(dateText)

      const dataPoint: WaterTemperatureDataPoint = {
        date: dateText,
        temperature,
        timestamp,
        situation: situation || undefined, // Only include situation if it exists
      }

      history.push(dataPoint)

      // Set current data point (first row)
      if (index === 0) {
        current = dataPoint
      }
    })

    // Check if we got any data
    if (history.length === 0) {
      console.warn(
        `No temperature data found for URL: ${url}. Response status: ${response.status}, Content length: ${html.length}. Table rows found: ${tableRows.length}.`,
      )
      return {
        current: null,
        history: [],
        changeStatus: "stable",
      }
    }

    // Find previous day data
    let previousDay: WaterTemperatureDataPoint = null
    let change: number = null
    let changeStatus: ChangeStatus = "stable"

    if (current) {
      const currentHour = current.timestamp.getHours()
      previousDay = history.find((point) => {
        const hourDiff = Math.abs(point.timestamp.getHours() - currentHour)
        const timeDiff = current.timestamp.getTime() - point.timestamp.getTime()
        return hourDiff <= 1 && timeDiff >= 23 * 60 * 60 * 1000 && timeDiff <= 25 * 60 * 60 * 1000
      })

      if (previousDay) {
        change = current.temperature - previousDay.temperature
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
    console.error(`Error fetching temperature data for ${url}:`, error)
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

    // Parse current temperature from curinfo div first
    const currentTemp = parseSpitzingseeCurinfo(html)

    // Parse data from both JavaScript arrays and HTML table
    const jsData = parseSpitzingseeJavaScriptData(html, url)
    const tableData = parseSpitzingseeTableData(html, url)

    // Merge the data without duplicates
    const mergedData = mergeSpitzingseeData(jsData, tableData)

    // Override current date's datapoint with curinfo temperature if available
    if (currentTemp !== null && mergedData.length > 0) {
      const today = new Date()
      const todayString = `${today.getDate().toString().padStart(2, "0")}.${(today.getMonth() + 1).toString().padStart(2, "0")}.${today.getFullYear()}`

      // Find and update today's datapoint or create a new one
      const todayIndex = mergedData.findIndex((point) => point.date.startsWith(todayString))

      const currentDataPoint: WaterTemperatureDataPoint = {
        date: `${todayString} ${today.getHours().toString().padStart(2, "0")}:${today.getMinutes().toString().padStart(2, "0")}`,
        temperature: currentTemp,
        timestamp: new Date(today),
      }

      if (todayIndex >= 0) {
        // Replace existing today's datapoint
        mergedData[todayIndex] = currentDataPoint
      } else {
        // Add new current datapoint at the beginning
        mergedData.unshift(currentDataPoint)
      }

      // Re-sort to ensure most recent first
      mergedData.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

      console.log(`Updated current Spitzingsee temperature to ${currentTemp}°C from curinfo div`)
    }

    return processSpitzingseeDataPoints(mergedData, url)
  } catch (error) {
    console.error(`Error fetching Spitzingsee temperature data for ${url}:`, error)
    return {
      current: null,
      history: [],
      changeStatus: "stable",
    }
  }
}

// New function to parse current temperature from curinfo div
function parseSpitzingseeCurinfo(html: string): number | null {
  try {
    const $ = cheerio.load(html)
    const curinfoDiv = $("#curinfo")

    if (curinfoDiv.length === 0) {
      console.warn("No curinfo div found for Spitzingsee")
      return null
    }

    const curinfoText = curinfoDiv.text()
    console.log(`Curinfo text: ${curinfoText}`)

    // Extract temperature from "Der aktuelle Wert beträgt 14.4 Grad"
    const tempMatch = curinfoText.match(/Der aktuelle Wert beträgt\s+(\d+[.,]\d*)\s+Grad/i)

    if (!tempMatch) {
      console.warn(`Could not extract temperature from curinfo: ${curinfoText}`)
      return null
    }

    const temperature = Number.parseFloat(tempMatch[1].replace(",", "."))

    if (isNaN(temperature)) {
      console.warn(`Invalid temperature value: ${tempMatch[1]}`)
      return null
    }

    console.log(`Extracted current temperature from curinfo: ${temperature}°C`)
    return temperature
  } catch (error) {
    console.error("Error parsing curinfo div:", error)
    return null
  }
}

// Parse JavaScript data from the chart
function parseSpitzingseeJavaScriptData(html: string, url: string): WaterTemperatureDataPoint[] {
  const dataPoints: WaterTemperatureDataPoint[] = []

  // More robust regex to extract the JavaScript data array
  const dataMatch = html.match(/arrayToDataTable$$\[\s*\['Days',\s*'[^']+'\],\s*((?:\[[-\d]+,[\d.]+\],?\s*)+)\s*\]$$/)

  if (!dataMatch) {
    // Try alternative pattern in case the format is slightly different
    const altMatch = html.match(/\[[-\d]+,[\d.]+\](?:\s*,\s*\[[-\d]+,[\d.]+\])*/g)
    if (altMatch) {
      console.log(`Found alternative JS data pattern for Spitzingsee: ${altMatch[0].substring(0, 100)}...`)
      const dataString = altMatch.join(",")
      return parseJavaScriptDataString(dataString)
    }

    console.warn(`No JavaScript temperature data found for Spitzingsee URL: ${url}`)
    return []
  }

  return parseJavaScriptDataString(dataMatch[1])
}

// Parse the JavaScript data string into data points
function parseJavaScriptDataString(dataString: string): WaterTemperatureDataPoint[] {
  const dataPoints: WaterTemperatureDataPoint[] = []

  // Extract individual data points [day, temperature]
  const pointMatches = dataString.match(/\[(-?\d+),(\d+(?:\.\d+)?)\]/g)

  if (!pointMatches) {
    console.warn(`Could not parse JS data points: ${dataString.substring(0, 200)}...`)
    return []
  }

  console.log(`Found ${pointMatches.length} JS data points for Spitzingsee`)

  pointMatches.forEach((match) => {
    const pointMatch = match.match(/\[(-?\d+),(\d+(?:\.\d+)?)\]/)
    if (pointMatch) {
      const dayOfYear = Number.parseInt(pointMatch[1], 10)
      const temperature = Number.parseFloat(pointMatch[2])

      // Convert day of year to actual date
      const date = new Date(currentYear, 0, 1)
      date.setDate(date.getDate() + dayOfYear)

      const dateString = `${date.getDate().toString().padStart(2, "0")}.${(date.getMonth() + 1).toString().padStart(2, "0")}.${date.getFullYear()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`

      const dataPoint: WaterTemperatureDataPoint = {
        date: dateString,
        temperature,
        timestamp: date,
      }

      dataPoints.push(dataPoint)
    }
  })

  return dataPoints
}

// Parse HTML table data
function parseSpitzingseeTableData(html: string, url: string): WaterTemperatureDataPoint[] {
  const dataPoints: WaterTemperatureDataPoint[] = []
  const $ = cheerio.load(html)

  // Look for the table with header "Tabelle der Wassertemperaturwerte nach Tagen"
  const tableHeader = $('h3:contains("Tabelle der Wassertemperaturwerte nach Tagen")')
  if (tableHeader.length === 0) {
    console.warn(`No temperature table found for Spitzingsee URL: ${url}`)
    return []
  }

  // Find the table after this header
  const table = tableHeader.next(".table-container").find("table")
  if (table.length === 0) {
    console.warn(`No table found after temperature header for Spitzingsee URL: ${url}`)
    return []
  }

  let tableRowCount = 0

  // Parse table rows
  table.find("tbody tr").each((index, element) => {
    const dateText = $(element).find("td").eq(0).text().trim()

    // Find temperature cell - try center-aligned first, then pattern matching
    let tempText = ""
    const centerCell = $(element).find("td.center")
    if (centerCell.length > 0) {
      tempText = centerCell.first().text().trim()
    } else {
      // Look for cell containing temperature pattern
      $(element)
        .find("td")
        .each((i, cell) => {
          const cellText = $(cell).text().trim()
          if (cellText.match(/\d+[.,]\d*\s*°?C?/) && !tempText) {
            tempText = cellText
          }
        })
      // Fallback to second cell
      if (!tempText && $(element).find("td").length >= 2) {
        tempText = $(element).find("td").eq(1).text().trim()
      }
    }

    if (index < 5) {
      console.log(`Row ${index}: date="${dateText}", temp="${tempText}"`)
    }

    // Extract temperature value
    const tempMatch = tempText.match(/(\d+[.,]\d*)/)
    if (!tempMatch) return

    const temperature = Number.parseFloat(tempMatch[1].replace(",", "."))
    if (isNaN(temperature)) return

    // Parse date (format: "Jul 30")
    const dateMatch = dateText.match(/(\w{3})\s+(\d+)/)
    if (!dateMatch) return

    const monthName = dateMatch[1]
    const day = Number.parseInt(dateMatch[2], 10)

    // Convert month name to number
    const monthMap = {
      Jan: 0,
      Feb: 1,
      Mar: 2,
      Apr: 3,
      May: 4,
      Jun: 5,
      Jul: 6,
      Aug: 7,
      Sep: 8,
      Oct: 9,
      Nov: 10,
      Dec: 11,
    }

    const month = monthMap[monthName]
    if (month === undefined) return

    const date = new Date(currentYear, month, day, 12, 0) // Set to noon for consistency
    const dateString = `${date.getDate().toString().padStart(2, "0")}.${(date.getMonth() + 1).toString().padStart(2, "0")}.${date.getFullYear()} 12:00`

    const dataPoint: WaterTemperatureDataPoint = {
      date: dateString,
      temperature,
      timestamp: date,
    }

    dataPoints.push(dataPoint)
    tableRowCount++
  })

  console.log(`Found ${tableRowCount} table data points for Spitzingsee`)
  return dataPoints
}

// Merge JavaScript and table data, avoiding duplicates
function mergeSpitzingseeData(
  jsData: WaterTemperatureDataPoint[],
  tableData: WaterTemperatureDataPoint[],
): WaterTemperatureDataPoint[] {
  const mergedData: WaterTemperatureDataPoint[] = []
  const dateMap = new Map<string, WaterTemperatureDataPoint>()
  const today = new Date()
  today.setHours(23, 59, 59, 999) // Set to end of today to include today's data

  // Add JavaScript data first, filtering out future dates
  jsData.forEach((point) => {
    if (point.timestamp <= today) {
      // Only include dates up to today
      const dateKey = point.timestamp.toDateString()
      dateMap.set(dateKey, point)
    }
  })

  // Add table data, preferring table data for dates that exist in both, filtering out future dates
  tableData.forEach((point) => {
    if (point.timestamp <= today) {
      // Only include dates up to today
      const dateKey = point.timestamp.toDateString()
      dateMap.set(dateKey, point) // This will overwrite JS data if same date
    }
  })

  // Convert map back to array and sort by date descending (most recent first)
  const allData = Array.from(dateMap.values())
  allData.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  console.log(
    `Merged data (excluding future dates): ${jsData.length} JS points + ${tableData.length} table points = ${allData.length} total points`,
  )

  return allData
}

// Process the merged data points
function processSpitzingseeDataPoints(
  dataPoints: WaterTemperatureDataPoint[],
  url: string,
): {
  current: WaterTemperatureDataPoint
  history: WaterTemperatureDataPoint[]
  previousDay?: WaterTemperatureDataPoint
  change?: number
  changeStatus: ChangeStatus
} {
  if (dataPoints.length === 0) {
    console.warn(`No temperature data found for Spitzingsee`)
    return {
      current: null,
      history: [],
      changeStatus: "stable",
    }
  }

  // Data is already sorted descending by timestamp (most recent first)
  const current = dataPoints[0] // Most recent data point

  // Keep all data for history (already sorted descending - most recent first)
  const history = dataPoints

  // Find previous day data (approximately 24 hours ago)
  let previousDay: WaterTemperatureDataPoint = null
  let change: number = null
  let changeStatus: ChangeStatus = "stable"

  if (current) {
    // Find the closest data point to 24 hours ago
    previousDay = dataPoints.find((point) => {
      const timeDiff = Math.abs(current.timestamp.getTime() - point.timestamp.getTime())
      return timeDiff >= 20 * 60 * 60 * 1000 && timeDiff <= 28 * 60 * 60 * 1000 // Between 20-28 hours
    })

    if (previousDay) {
      change = current.temperature - previousDay.temperature
      const percentChange = (change / previousDay.temperature) * 100
      changeStatus = getChangeStatus(percentChange)
    }
  }

  console.log(
    `Successfully processed ${history.length} Spitzingsee temperature data points, current: ${current?.temperature}°C on ${current?.date}`,
  )

  return {
    current,
    history,
    previousDay,
    change,
    changeStatus,
  }
}

// Helper function to process the extracted data string (legacy function, now calls parseJavaScriptDataString)
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
  const jsData = parseJavaScriptDataString(dataString)
  return processSpitzingseeDataPoints(jsData, url)
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
