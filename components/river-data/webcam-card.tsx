"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

interface WebcamCardProps {
  webcamUrl: string
  riverName: string
  location: string
  webcamClickUrl?: string
}

export function WebcamCard({ webcamUrl, riverName, location, webcamClickUrl }: WebcamCardProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [timestamp] = useState(new Date().getTime())

  // Generate a unique URL with a timestamp to prevent caching
  const imageUrl = `${webcamUrl}?t=${timestamp}`

  // FORCE the click URL to be the webcamClickUrl - NO FALLBACK to webcamUrl
  const linkTarget = webcamClickUrl || "https://www.foto-webcam.org/webcam/spitzingsee/"

  // Explicit debugging - log what we're actually using
  console.log("=== WEBCAM DEBUG ===")
  console.log("River:", riverName)
  console.log("webcamUrl (image):", webcamUrl)
  console.log("webcamClickUrl (click):", webcamClickUrl)
  console.log("FINAL linkTarget:", linkTarget)
  console.log("===================")

  return (
    <Card>
      <CardHeader
        className="pb-2 p-3 sm:p-6 flex flex-row justify-between items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="text-base sm:text-lg">Webcam</CardTitle>
        <div className="flex items-center gap-1">
          <span>📷</span>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-0 overflow-hidden">
          <div className="p-3 sm:p-6 pt-0">
            {/* HARDCODE the correct URL for Spitzingsee to guarantee it works */}
            <a
              href={riverName === "Spitzingsee" ? "https://www.foto-webcam.org/webcam/spitzingsee/" : linkTarget}
              target="_blank"
              rel="noopener noreferrer"
              className="block relative rounded-md overflow-hidden"
              onClick={() =>
                console.log(
                  "Clicking webcam with href:",
                  riverName === "Spitzingsee" ? "https://www.foto-webcam.org/webcam/spitzingsee/" : linkTarget,
                )
              }
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
