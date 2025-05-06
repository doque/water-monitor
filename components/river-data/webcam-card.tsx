"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

interface WebcamCardProps {
  webcamUrl: string
  riverName: string
  location: string
}

export function WebcamCard({ webcamUrl, riverName, location }: WebcamCardProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [timestamp] = useState(new Date().getTime())

  // Generate a unique URL with a timestamp to prevent caching
  const imageUrl = `${webcamUrl}?t=${timestamp}`

  return (
    <Card>
      <CardHeader
        className="pb-2 p-3 sm:p-6 flex flex-row justify-between items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="text-base sm:text-lg">Webcam {location}</CardTitle>
        <div className="flex items-center gap-1">
          <span>📷</span>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-0 overflow-hidden">
          <div className="p-3 sm:p-6 pt-0">
            <a
              href={webcamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block relative rounded-md overflow-hidden"
              title={`Aktuelle Webcam-Ansicht von ${riverName} bei ${location} - Klicken zum Vergrößern`}
            >
              {isLoading && (
                <div className="w-full h-[200px] sm:h-[300px] flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-md">
                  <div className="animate-pulse text-gray-500 dark:text-gray-400">Bild wird geladen...</div>
                </div>
              )}

              {hasError && (
                <div className="w-full h-[200px] sm:h-[300px] flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-md">
                  <div className="text-gray-500 dark:text-gray-400">Webcam-Bild nicht verfügbar</div>
                </div>
              )}

              <div className={`${isLoading ? "hidden" : "block"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl || "/placeholder.svg"}
                  alt={`Aktuelle Webcam-Ansicht von ${riverName} bei ${location}`}
                  className="w-full h-auto object-cover rounded-md"
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                    setIsLoading(false)
                    setHasError(true)
                  }}
                />
              </div>

              <div className="absolute bottom-0 right-0 bg-black bg-opacity-50 text-white text-xs px-2 py-1 m-2 rounded">
                Zum Vergrößern klicken
              </div>
            </a>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
