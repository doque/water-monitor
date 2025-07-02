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
