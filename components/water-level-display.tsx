"use client"

import type { WaterLevelData } from "@/utils/water-data"
import { Card, CardContent } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useState } from "react"

interface WaterLevelDisplayProps {
  data: WaterLevelData
}

export function WaterLevelDisplay({ data }: WaterLevelDisplayProps) {
  const [timeRange, setTimeRange] = useState<"24h" | "48h" | "week">("24h")

  if (!data || !data.current) {
    return (
      <div className="p-6 bg-yellow-50 rounded-lg border border-yellow-200">
        <p className="text-yellow-800 font-medium">Unable to load water level data.</p>
        {data?.error && <p className="text-sm text-yellow-700 mt-2">Error: {data.error}</p>}
      </div>
    )
  }

  // Format the percentage change with appropriate emoji
  const getChangeIndicator = () => {
    if (data.percentageChange === undefined) return null

    const change = data.percentageChange
    const formattedChange = change.toFixed(1)

    let emoji = "→"
    let colorClass = "text-gray-700"

    switch (data.changeStatus) {
      case "large-increase":
        emoji = "🔴 ↑↑"
        colorClass = "text-red-600 font-bold"
        break
      case "large-decrease":
        emoji = "🔴 ↓↓"
        colorClass = "text-red-600 font-bold"
        break
      case "medium-increase":
        emoji = "🟡 ↑"
        colorClass = "text-amber-600 font-bold"
        break
      case "medium-decrease":
        emoji = "🟡 ↓"
        colorClass = "text-amber-600 font-bold"
        break
      case "small-increase":
        emoji = "↗️"
        colorClass = "text-blue-600"
        break
      case "small-decrease":
        emoji = "↘️"
        colorClass = "text-blue-600"
        break
      default:
        emoji = "→"
        colorClass = "text-gray-700"
    }

    return (
      <span className={colorClass}>
        {emoji} {change > 0 ? "+" : ""}
        {formattedChange}%
      </span>
    )
  }

  // Prepare chart data
  const getChartData = () => {
    let filteredData = [...data.history]

    // Filter based on selected time range
    if (timeRange === "24h") {
      filteredData = filteredData.slice(0, 24)
    } else if (timeRange === "48h") {
      filteredData = filteredData.slice(0, 48)
    }

    // Reverse to show oldest to newest
    return filteredData.reverse().map((point) => ({
      time: point.date.split(" ")[1].substring(0, 5), // Extract HH:MM
      level: point.level,
    }))
  }

  const chartData = getChartData()

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Current Water Level</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Location</p>
                <p className="font-medium">{data.location}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Last Updated</p>
                <p className="font-medium">{data.current.date}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Water Level</p>
                <p className="text-3xl font-bold text-blue-700">{data.current.level} cm</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">24h Change</p>
                <p className="text-xl font-medium">{getChangeIndicator() || "No previous data"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-2">Reference Information</h3>
            <p className="text-sm text-gray-600 mb-4">
              Water level is measured in centimeters above Pegelnullpunkt (742.72 m NHN).
            </p>

            <h4 className="font-medium text-gray-700 mb-1">Alert Levels:</h4>
            <ul className="text-sm space-y-1">
              <li className="flex items-center">
                <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2"></span>
                <span>Normal: &lt;160 cm</span>
              </li>
              <li className="flex items-center">
                <span className="inline-block w-3 h-3 rounded-full bg-yellow-500 mr-2"></span>
                <span>Watch: 160-180 cm</span>
              </li>
              <li className="flex items-center">
                <span className="inline-block w-3 h-3 rounded-full bg-orange-500 mr-2"></span>
                <span>Warning: 180-200 cm</span>
              </li>
              <li className="flex items-center">
                <span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-2"></span>
                <span>Danger: &gt;200 cm</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Water Level Trend</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => setTimeRange("24h")}
                className={`px-3 py-1 text-sm rounded ${timeRange === "24h" ? "bg-blue-100 text-blue-800" : "bg-gray-100"}`}
              >
                24h
              </button>
              <button
                onClick={() => setTimeRange("48h")}
                className={`px-3 py-1 text-sm rounded ${timeRange === "48h" ? "bg-blue-100 text-blue-800" : "bg-gray-100"}`}
              >
                48h
              </button>
              <button
                onClick={() => setTimeRange("week")}
                className={`px-3 py-1 text-sm rounded ${timeRange === "week" ? "bg-blue-100 text-blue-800" : "bg-gray-100"}`}
              >
                All
              </button>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 12 }}
                  interval={timeRange === "24h" ? 2 : timeRange === "48h" ? 5 : 10}
                />
                <YAxis
                  domain={["dataMin - 5", "dataMax + 5"]}
                  label={{ value: "Water Level (cm)", angle: -90, position: "insideLeft" }}
                />
                <Tooltip
                  formatter={(value) => [`${value} cm`, "Water Level"]}
                  labelFormatter={(label) => `Time: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="level"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-gray-500 text-center">
        Data source: Hochwassernachrichtendienst Bayern • Last updated: {new Date().toLocaleString()}
      </div>
    </div>
  )
}
