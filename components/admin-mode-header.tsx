"use client"

import { CardHeader, CardDescription, CardTitle } from "@/components/ui/card"
import { useState, useEffect } from "react"
import Image from "next/image"
import { isAdminMode, toggleAdminMode } from "@/utils/admin-mode"

export function AdminModeHeader() {
  const [clickCount, setClickCount] = useState(0)
  const [superSecretClickCount, setSuperSecretClickCount] = useState(0) // New state for secret clicks
  const [adminMode, setAdminMode] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showSuperSecretAnimation, setShowSuperSecretAnimation] = useState(false) // New state for animation visibility
  const [animationPlayed, setAnimationPlayed] = useState(false) // New state to play animation only once

  // Check admin mode on mount
  useEffect(() => {
    setAdminMode(isAdminMode())
  }, [])

  // Reset click count after 3 seconds of inactivity for admin mode
  useEffect(() => {
    if (clickCount > 0 && clickCount < 5) {
      const timer = setTimeout(() => {
        setClickCount(0)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [clickCount])

  // Reset super secret click count after 3 seconds of inactivity
  useEffect(() => {
    if (superSecretClickCount > 0 && superSecretClickCount < 10) {
      const timer = setTimeout(() => {
        setSuperSecretClickCount(0)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [superSecretClickCount])

  const handleLogoClick = () => {
    // Handle admin mode clicks
    const newClickCount = clickCount + 1
    setClickCount(newClickCount)

    if (newClickCount === 5) {
      const newAdminMode = toggleAdminMode()
      setAdminMode(newAdminMode)
      setClickCount(0) // Reset admin click count after toggling

      // Trigger animation for admin mode toggle
      setIsAnimating(true)
      setTimeout(() => setIsAnimating(false), 1000)

      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent("adminModeChanged", { detail: { adminMode: newAdminMode } }))
    }

    // Handle super secret clicks for the animation
    if (!animationPlayed) {
      // Only track if animation hasn't played yet
      const newSuperSecretClickCount = superSecretClickCount + 1
      setSuperSecretClickCount(newSuperSecretClickCount)

      if (newSuperSecretClickCount === 10) {
        setShowSuperSecretAnimation(true)
        setAnimationPlayed(true) // Mark animation as played
        setSuperSecretClickCount(0) // Reset secret click count

        // Hide animation after 3 seconds
        setTimeout(() => {
          setShowSuperSecretAnimation(false)
        }, 3000)
      }
    }
  }

  return (
    <CardHeader className="bg-blue-50 dark:bg-blue-950 flex flex-row items-center gap-2 p-3 sm:p-6">
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

      {showSuperSecretAnimation && (
        <div className="fixed inset-0 bg-gray-200/70 flex items-center justify-center z-[100]">
          <div className="relative w-48 h-48 animate-flashy-fireworks rounded-full">
            {" "}
            {/* Added flashy-fireworks animation */}
            <Image
              src="/images/thumbs-up-man.png"
              alt="Thumbs up man"
              fill
              className="object-contain animate-spin-slow" // Changed to spin-slow
            />
          </div>
        </div>
      )}
    </CardHeader>
  )
}
