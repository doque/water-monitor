"use client"

const ADMIN_MODE_COOKIE = "water_monitor_admin_mode"

export function isAdminMode(): boolean {
  if (typeof window === "undefined") return false

  const cookies = document.cookie.split(";")
  const adminCookie = cookies.find((cookie) => cookie.trim().startsWith(`${ADMIN_MODE_COOKIE}=`))

  return adminCookie?.split("=")[1] === "true"
}

export function setAdminMode(enabled: boolean): void {
  if (typeof window === "undefined") return

  const expires = new Date()
  expires.setFullYear(expires.getFullYear() + 1) // 1 year expiry

  document.cookie = `${ADMIN_MODE_COOKIE}=${enabled}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`
}

export function toggleAdminMode(): boolean {
  const currentMode = isAdminMode()
  const newMode = !currentMode
  setAdminMode(newMode)
  return newMode
}

// Admin selection persistence (localStorage)
const ADMIN_SELECTIONS_KEY = "water_monitor_admin_selections"

export type AdminSelections = {
  riverId: string
  pane: string
  interval: string
}

export function getAdminSelections(): AdminSelections | null {
  if (typeof window === "undefined") return null
  // Only return stored selections if admin mode is active
  if (!isAdminMode()) return null

  try {
    const stored = localStorage.getItem(ADMIN_SELECTIONS_KEY)
    if (!stored) return null
    return JSON.parse(stored) as AdminSelections
  } catch {
    return null
  }
}

export function setAdminSelections(selections: AdminSelections): void {
  if (typeof window === "undefined") return
  // Only persist if admin mode is active
  if (!isAdminMode()) return

  try {
    localStorage.setItem(ADMIN_SELECTIONS_KEY, JSON.stringify(selections))
  } catch {
    // localStorage might be full or disabled
  }
}
