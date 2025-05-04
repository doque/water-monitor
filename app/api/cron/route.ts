import { NextResponse } from "next/server"
import * as cheerio from "cheerio"
// Fix the import path to point to the correct location
import { createAsciiChart } from "@/utils/chart"

export async function GET() {
  try {
    // Fetch water level data
    const waterLevelData = await fetchWaterLevelData()

    // Format the message
    const message = formatWaterLevelMessage(waterLevelData)

    return NextResponse.json({
      success: true,
      message: "Water level report generated successfully",
      data: message,
    })
  } catch (error) {
    console.error("Error in cron job:", error)
    return NextResponse.json({ success: false, error: "Failed to generate water level report" }, { status: 500 })
  }
}

// Update the fetchWaterLevelData function to better match the HTML structure

async function fetchWaterLevelData() {
  const url = "https://www.hnd.bayern.de/pegel/inn/feldolling-18204006/tabelle?methode=wasserstand&"

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch water level data: ${response.status}`)
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  // Extract the latest water level data
  const waterLevelData = {
    location: "Feldolling (Inn)",
    date: "",
    level: "",
    trend: "",
    history: [],
  }

  // Process the table rows to extract data
  $("table.tblsort tbody tr").each((index, element) => {
    if (index < 24) {
      // Get last 24 hours of data for trend analysis
      const date = $(element).find("td").eq(0).text().trim()
      const level = $(element).find("td.center").text().trim()

      if (index === 0) {
        // Set the current data (first row)
        waterLevelData.date = date
        waterLevelData.level = level
      }

      // Add to history for trend analysis
      waterLevelData.history.push({
        date,
        level: Number.parseInt(level, 10),
      })
    }
  })

  // Calculate trend based on the last 24 hours
  if (waterLevelData.history.length > 0) {
    const currentLevel = waterLevelData.history[0].level

    // Check last 6 hours for short-term trend
    const sixHoursAgo = waterLevelData.history.length >= 6 ? waterLevelData.history[5].level : currentLevel

    // Check 24 hours ago for daily trend
    const dayAgo = waterLevelData.history.length >= 24 ? waterLevelData.history[23].level : currentLevel

    // Determine short-term trend
    if (currentLevel > sixHoursAgo) {
      waterLevelData.trend = "↗️ Rising"
    } else if (currentLevel < sixHoursAgo) {
      waterLevelData.trend = "↘️ Falling"
    } else {
      waterLevelData.trend = "→ Stable"
    }

    // Add daily change information
    const dailyChange = currentLevel - dayAgo
    waterLevelData.dailyChange = dailyChange
  }

  return waterLevelData
}

// Update the formatWaterLevelMessage function to include more detailed information

function formatWaterLevelMessage(data) {
  const currentDate = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  // Format the daily change with a sign and appropriate emoji
  let dailyChangeText = ""
  if (data.dailyChange !== undefined) {
    const sign = data.dailyChange > 0 ? "+" : ""
    const emoji = data.dailyChange > 0 ? "↗️" : data.dailyChange < 0 ? "↘️" : "→"
    dailyChangeText = `\n📊 *24h Change:* ${emoji} ${sign}${data.dailyChange} cm`
  }

  // No alert level information for now
  const alertMessage = ""

  // Create ASCII chart if we have history data
  let chartText = ""
  if (data.history && data.history.length > 0) {
    chartText = `\n\n\`\`\`\n${createAsciiChart(data.history)}\n\`\`\``
  }

  return (
    `*Water Level Report - ${currentDate}*\n\n` +
    `📍 *Location:* ${data.location}\n` +
    `🕒 *Last Measurement:* ${data.date}\n` +
    `💧 *Current Level:* ${data.level} cm\n` +
    `📈 *Trend (6h):* ${data.trend}${dailyChangeText}${alertMessage}${chartText}\n\n` +
    `🔍 *Reference:* Level is measured above Pegelnullpunkt (742.72 m NHN)\n\n` +
    `Stay safe and have a great day!`
  )
}
