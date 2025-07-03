"use client"

import { CardHeader, CardDescription, CardTitle } from "@/components/ui/card"
import { useState, useEffect } from "react"
import Image from "next/image"
import { isAdminMode, toggleAdminMode } from "@/utils/admin-mode"

// Removed SPECIAL_IMAGE_SHOWN_KEY as it's no longer needed for "only once"

export function AdminModeHeader() {
  const [clickCount, setClickCount] = useState(0)
  const [adminMode, setAdminMode] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showSpecialImage, setShowSpecialImage] = useState(false) // New state for special image
  const [sparkles, setSparkles] = useState([]) // New state for sparkles

  // Check admin mode on mount
  useEffect(() => {
    setAdminMode(isAdminMode())
  }, [])

  // Reset clicks after 3 seconds of inactivity if not exactly 5 or 10
  useEffect(() => {
    if (clickCount > 0 && clickCount !== 5 && clickCount !== 10) {
      const timer = setTimeout(() => setClickCount(0), 3000)
      return () => clearTimeout(timer)
    }
  }, [clickCount])

  const handleLogoClick = () => {
    const newCount = clickCount + 1
    setClickCount(newCount)

    // Admin mode logic (at 5 clicks)
    if (newCount === 5) {
      const newAdmin = toggleAdminMode()
      setAdminMode(newAdmin)
      // Do NOT reset clickCount here. Allow it to continue for 10 clicks.

      setIsAnimating(true)
      setTimeout(() => setIsAnimating(false), 1000)

      window.dispatchEvent(new CustomEvent("adminModeChanged", { detail: { adminMode: newAdmin } }))
    }
    // Special image logic (at 10 clicks)
    else if (newCount === 10) {
      setShowSpecialImage(true)

      // Generate random sparkles
      const newSparkles = Array.from({ length: 60 }).map((_, i) => ({
        // Increased to 60 sparkles
        id: i,
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 0.8}s`, // Staggered delays
      }))
      setSparkles(newSparkles)

      setTimeout(() => {
        setShowSpecialImage(false)
        setSparkles([]) // Clear sparkles after animation
      }, 5000) // Hide after 5 seconds (matching new animation duration)

      setClickCount(0) // Reset after special image trigger to allow re-triggering
    }
  }

  return (
    <CardHeader className="bg-blue-50 dark:bg-blue-950 flex flex-row items-center gap-2 p-3 sm:p-6 relative">
      <div
        className={`w-[50px] h-[50px] sm:w-[80px] sm:h-[80px] relative flex-shrink-0 cursor-pointer transition-transform duration-300 ${
          isAnimating ? "animate-bounce" : ""
        } ${adminMode ? "ring-2 ring-green-400 rounded-full" : ""}`}
        onClick={handleLogoClick}
        title={adminMode ? "Admin Mode Active" : ""}
      >
        <Image
          src="/images/mbteg-logo.png"
          alt="BFV Miesbach-Tegernsee Logo"
          fill
          className="object-contain"
          priority
        />
        {adminMode && <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />}
      </div>
      <div>
        <CardTitle className="text-blue-800 dark:text-blue-300 text-sm sm:text-xl">
          BFV Miesbach-Tegernsee Monitor
          {adminMode && (
            <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
              Admin
            </span>
          )}
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">Wasserstände, Temperaturen und Abflussraten</CardDescription>
      </div>

      {showSpecialImage && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999] bg-black bg-opacity-50">
          {sparkles.map((s) => (
            <div key={s.id} className="sparkle" style={{ top: s.top, left: s.left, animationDelay: s.delay }} />
          ))}
          <Image
            src="/images/special-image.png"
            alt="Special image"
            width={300}
            height={300}
            className="rounded-lg shadow-lg animate-pop-and-fade"
            priority
          />
        </div>
      )}
    </CardHeader>
  )
}
