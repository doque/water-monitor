"use client"

import { CardHeader, CardDescription, CardTitle } from "@/components/ui/card"
import { useState, useEffect } from "react"
import Image from "next/image"
import { isAdminMode, toggleAdminMode } from "@/utils/admin-mode"
import { ThemeToggle } from "@/components/theme-toggle"

export function AdminModeHeader() {
  const [clickCount, setClickCount] = useState(0)
  const [adminMode, setAdminMode] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

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
  }

  return (
    <CardHeader className="bg-primary/5 flex flex-row items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex-1 flex flex-row items-center gap-3">
        <div
          className={`size-10 sm:size-12 relative flex-shrink-0 cursor-pointer transition-transform duration-300 ${
            isAnimating ? "animate-bounce" : ""
          } ${adminMode ? "ring-2 ring-green-400 rounded-full" : ""}`}
          onClick={handleLogoClick}
          title={adminMode ? "Admin Mode Active" : ""}
          data-testid="logo"
        >
          <Image
            src="/images/mbteg-logo.png"
            alt="BFV Miesbach-Tegernsee Logo"
            fill
            className="object-contain"
            priority
          />
          {adminMode && <div className="absolute -top-0.5 -right-0.5 size-2.5 bg-green-400 rounded-full animate-pulse" />}
        </div>
        <div className="min-w-0">
          <CardTitle className="text-primary text-sm sm:text-base font-semibold flex items-center gap-1.5 flex-wrap">
            <span className="truncate">BFV Miesbach-Tegernsee</span>
            {adminMode && (
              <span className="text-[11px] bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-1.5 py-0.5 rounded flex-shrink-0">
                Admin
              </span>
            )}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm truncate">Wasserstände, Temperaturen und Abflussraten</CardDescription>
        </div>
      </div>
      <ThemeToggle />
    </CardHeader>
  )
}
