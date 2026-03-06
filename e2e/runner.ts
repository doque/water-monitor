/**
 * E2E Test Runner for Water Monitor
 * Uses agent-browser for browser automation
 *
 * Usage:
 *   pnpm test                    # Spawns dev server, runs tests
 *   pnpm test --production       # Tests production deployment
 *   pnpm test https://custom.url # Tests custom URL
 */

import { execSync, spawn, ChildProcess } from "child_process"
import { createServer } from "net"

const PRODUCTION_URL = "https://monitor.bfv-mbteg.de"
const LOCAL_PORT = 3000

// Test fixtures - abstract water body references
const FIXTURES = {
  river: "valley-18203003",
  river2: "stauden-18242005",
  lake: "lake-tegernsee",
  lake2: "lake-schliersee",
  lakeWithWebcam: "lake-spitzingsee",
}

// Parse args
let BASE_URL = `http://localhost:${LOCAL_PORT}`
let spawnServer = true
let serverProcess: ChildProcess | null = null

for (const arg of process.argv.slice(2)) {
  if (arg === "--production" || arg === "-p") {
    BASE_URL = PRODUCTION_URL
    spawnServer = false
  } else if (arg.startsWith("http")) {
    BASE_URL = arg
    spawnServer = false
  }
}

async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.once("error", () => resolve(true))
    server.once("listening", () => {
      server.close()
      resolve(false)
    })
    server.listen(port)
  })
}

async function ensureServer(): Promise<void> {
  if (!spawnServer) return

  const portInUse = await isPortInUse(LOCAL_PORT)
  if (portInUse) {
    console.log(`\x1b[2mDev server already running on port ${LOCAL_PORT}\x1b[0m\n`)
    return
  }

  process.stdout.write(`\x1b[2mStarting dev server...\x1b[0m`)
  serverProcess = spawn("pnpm", ["dev"], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  })

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server startup timeout")), 30000)
    const checkReady = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:${LOCAL_PORT}`, { method: "HEAD" })
        if (res.ok) {
          clearInterval(checkReady)
          clearTimeout(timeout)
          resolve()
        }
      } catch {}
    }, 500)
  })
  console.log(` ready\x1b[0m\n`)
}

function browser(cmd: string): string {
  try {
    return execSync(`npx agent-browser ${cmd}`, { encoding: "utf-8", timeout: 30000 })
  } catch (e: any) {
    return e.stdout || e.message
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// Test state
let passed = 0
let failed = 0
let currentSuite = ""

function expect(actual: string) {
  return {
    toContain(expected: string) {
      if (!actual.includes(expected)) throw new Error(`Expected "${expected}"`)
    },
    toMatch(regex: RegExp) {
      if (!regex.test(actual)) throw new Error(`Expected ${regex}`)
    },
  }
}

function describe(name: string) {
  currentSuite = name
  console.log(`\n\x1b[1m${name}\x1b[0m`)
}

async function test(name: string, fn: () => Promise<void>) {
  process.stdout.write(`  ○ ${name}`)
  try {
    await fn()
    passed++
    console.log(` \x1b[32m✓\x1b[0m`)
  } catch (e: any) {
    failed++
    console.log(` \x1b[31m✗\x1b[0m ${e.message}`)
  }
}

function snap(): string {
  return browser("snapshot")
}

// ============================================
// TESTS
// ============================================

async function runTests() {
  console.log(`\x1b[1m🌊 Water Monitor E2E Tests\x1b[0m`)
  console.log(`Target: ${BASE_URL}`)

  await ensureServer()

  process.on("SIGINT", cleanup)
  process.on("SIGTERM", cleanup)

  const startTime = Date.now()

  // Setup browser
  browser(`open ${BASE_URL}`)
  await sleep(2000)

  // ==========================================
  describe("Page Load")

  await test("Shows water body selector", async () => {
    expect(snap()).toContain("combobox")
  })

  await test("Shows default pane (Abfluss)", async () => {
    expect(snap()).toContain("Abfluss")
  })

  await test("Shows chart title", async () => {
    expect(snap()).toContain("Entwicklung")
  })

  // ==========================================
  describe("URL Params")

  await test("id param selects river", async () => {
    browser(`open ${BASE_URL}?id=${FIXTURES.river2}`)
    await sleep(2000)
    expect(snap()).toContain("Leitzach")
  })

  await test("id param selects lake", async () => {
    browser(`open ${BASE_URL}?id=${FIXTURES.lake}`)
    await sleep(2000)
    expect(snap()).toContain("Tegernsee")
  })

  await test("pane param activates pane", async () => {
    browser(`open ${BASE_URL}?id=${FIXTURES.river}&pane=level`)
    await sleep(2000)
    expect(snap()).toMatch(/cm/)
  })

  await test("interval param sets time range", async () => {
    browser(`open ${BASE_URL}?id=${FIXTURES.lake2}&interval=2w`)
    await sleep(2000)
    expect(snap()).toMatch(/2 Wochen/)
  })

  // ==========================================
  describe("Rivers")

  await test("Flow chart shows m³/s", async () => {
    browser(`open ${BASE_URL}?id=${FIXTURES.river}&pane=flow`)
    await sleep(2000)
    expect(snap()).toMatch(/m³\/s/)
  })

  await test("Level chart shows cm", async () => {
    browser(`open ${BASE_URL}?id=${FIXTURES.river}&pane=level`)
    await sleep(2000)
    expect(snap()).toMatch(/cm/)
  })

  await test("Shows hourly time ranges", async () => {
    browser(`open ${BASE_URL}?id=${FIXTURES.river}`)
    await sleep(1500)
    expect(snap()).toMatch(/Stunden?/)
  })

  await test("Shows data sources footer", async () => {
    expect(snap()).toContain("Datenquellen")
  })

  // ==========================================
  describe("Lakes")

  await test("Defaults to level pane (no flow)", async () => {
    browser(`open ${BASE_URL}?id=${FIXTURES.lake}`)
    await sleep(2000)
    expect(snap()).toContain("Pegel")
  })

  await test("Shows weekly time ranges", async () => {
    expect(snap()).toMatch(/Wochen/)
  })

  await test("Shows 24M Mittel reference", async () => {
    browser(`open ${BASE_URL}?id=${FIXTURES.lake2}&pane=level`)
    await sleep(3000)
    expect(snap()).toMatch(/Mittel/)
  })

  await test("Shows GKD data source", async () => {
    expect(snap()).toMatch(/GKD|Pegel/)
  })

  await test("Shows webcam", async () => {
    browser(`open ${BASE_URL}?id=${FIXTURES.lakeWithWebcam}`)
    await sleep(2000)
    expect(snap()).toMatch(/Webcam|img/i)
  })

  // ==========================================
  describe("Navigation")

  await test("Pane persists when switching waters", async () => {
    browser(`open ${BASE_URL}?id=${FIXTURES.river}&pane=level`)
    await sleep(2000)
    browser(`open ${BASE_URL}?id=${FIXTURES.river2}&pane=level`)
    await sleep(2000)
    expect(snap()).toMatch(/cm/)
  })

  await test("Mobile viewport renders", async () => {
    browser("set viewport 375 667")
    browser(`open ${BASE_URL}`)
    await sleep(2000)
    expect(snap()).toContain("Entwicklung")
    browser("set viewport 1280 800")
  })

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n${"─".repeat(40)}`)
  console.log(`\x1b[1mResults:\x1b[0m ${passed} passed, ${failed} failed (${elapsed}s)`)

  cleanup()
  process.exit(failed > 0 ? 1 : 0)
}

function cleanup() {
  if (serverProcess) serverProcess.kill()
  browser("close")
}

runTests().catch((e) => {
  console.error("Test runner error:", e)
  cleanup()
  process.exit(1)
})
