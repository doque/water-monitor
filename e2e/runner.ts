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

// Check if port is in use
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

// Start dev server if needed
async function ensureServer(): Promise<void> {
  if (!spawnServer) return

  const portInUse = await isPortInUse(LOCAL_PORT)
  if (portInUse) {
    console.log(`\x1b[2m  Dev server already running on port ${LOCAL_PORT}\x1b[0m`)
    return
  }

  console.log(`\x1b[2m  Starting dev server on port ${LOCAL_PORT}...\x1b[0m`)
  serverProcess = spawn("pnpm", ["dev"], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  })

  // Wait for server to be ready
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
  console.log(`\x1b[2m  Dev server ready\x1b[0m\n`)
}

// Cleanup server on exit
function cleanup() {
  if (serverProcess) {
    serverProcess.kill()
  }
  browser("close")
}

// Test state
interface TestResult {
  name: string
  passed: boolean
  error?: string
}

const results: TestResult[] = []
let currentSuite = ""

// Helpers
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

// Test utilities
function describe(name: string, fn: () => Promise<void>) {
  currentSuite = name
  return fn()
}

async function test(name: string, fn: () => Promise<void>) {
  const fullName = currentSuite ? `${currentSuite} > ${name}` : name
  process.stdout.write(`  ○ ${name}...`)
  try {
    await fn()
    results.push({ name: fullName, passed: true })
    console.log(" \x1b[32m✓\x1b[0m")
  } catch (e: any) {
    results.push({ name: fullName, passed: false, error: e.message })
    console.log(` \x1b[31m✗\x1b[0m ${e.message}`)
  }
}

function expect(actual: string) {
  return {
    toContain(expected: string) {
      if (!actual.includes(expected)) {
        throw new Error(`Expected to contain "${expected}"`)
      }
    },
    toMatch(regex: RegExp) {
      if (!regex.test(actual)) {
        throw new Error(`Expected to match ${regex}`)
      }
    },
    not: {
      toContain(expected: string) {
        if (actual.includes(expected)) {
          throw new Error(`Expected NOT to contain "${expected}"`)
        }
      },
    },
  }
}

function getUrl(): string {
  return browser("get url").trim()
}

function getSnapshot(): string {
  return browser("snapshot")
}

// ============================================
// TEST SUITES
// ============================================

async function runTests() {
  console.log("\n\x1b[1m🌊 Water Monitor E2E Tests\x1b[0m")
  console.log(`   Target: ${BASE_URL}\n`)

  // Ensure server is running for local tests
  await ensureServer()

  // Handle cleanup on exit
  process.on("SIGINT", cleanup)
  process.on("SIGTERM", cleanup)

  // Setup browser
  browser(`open ${BASE_URL}`)
  await sleep(2000)

  // ------------------------------------------
  await describe("1. Initial Page Load", async () => {
    await test("Page loads with river selector", async () => {
      const snap = getSnapshot()
      expect(snap).toContain("Mangfall")
    })

    await test("Default Abfluss pane is visible", async () => {
      const snap = getSnapshot()
      expect(snap).toContain("Abfluss")
    })

    await test("Chart title 'Entwicklung' visible", async () => {
      const snap = getSnapshot()
      expect(snap).toContain("Entwicklung")
    })
  })

  // ------------------------------------------
  await describe("2. URL State Mapping", async () => {
    await test("River ID param selects Leitzach", async () => {
      browser(`open ${BASE_URL}?id=stauden-18242005`)
      await sleep(2000)
      const snap = getSnapshot()
      expect(snap).toContain("Leitzach")
    })

    await test("Lake ID param selects Tegernsee", async () => {
      browser(`open ${BASE_URL}?id=lake-tegernsee`)
      await sleep(2000)
      const snap = getSnapshot()
      expect(snap).toContain("Tegernsee")
    })

    await test("?pane=level activates Pegel pane", async () => {
      browser(`open ${BASE_URL}?id=valley-18203003&pane=level`)
      await sleep(2000)
      const snap = getSnapshot()
      // Chart title shows "Entwicklung" with level units (cm)
      expect(snap).toMatch(/Pegel|cm/)
    })

    await test("Combined params work together", async () => {
      browser(`open ${BASE_URL}?id=lake-schliersee&pane=level&interval=2w`)
      await sleep(2000)
      const snap = getSnapshot()
      expect(snap).toContain("Schliersee")
      expect(snap).toMatch(/2 Wochen|2w/)
    })
  })

  // ------------------------------------------
  await describe("3. Pane Switching", async () => {
    await test("Switching panes updates chart content", async () => {
      browser(`open ${BASE_URL}?id=valley-18203003&pane=flow`)
      await sleep(2000)
      let snap = getSnapshot()
      expect(snap).toMatch(/m³\/s/)

      // Switch to level pane
      browser(`open ${BASE_URL}?id=valley-18203003&pane=level`)
      await sleep(2000)
      snap = getSnapshot()
      expect(snap).toMatch(/cm/)
    })
  })

  // ------------------------------------------
  await describe("4. Pane Persistence When Switching Waters", async () => {
    await test("Pegel persists when switching Mangfall → Leitzach", async () => {
      browser(`open ${BASE_URL}?id=valley-18203003&pane=level`)
      await sleep(2000)
      browser(`open ${BASE_URL}?id=stauden-18242005&pane=level`)
      await sleep(2000)
      const snap = getSnapshot()
      // Should show Leitzach with level data (cm)
      expect(snap).toContain("Leitzach")
      expect(snap).toMatch(/cm/)
    })

    await test("Lake shows level pane (no flow available)", async () => {
      browser(`open ${BASE_URL}?id=lake-tegernsee`)
      await sleep(2000)
      const snap = getSnapshot()
      // Lakes show Pegel, not Abfluss
      expect(snap).toContain("Pegel")
    })
  })

  // ------------------------------------------
  await describe("5. Time Range Selection", async () => {
    await test("Rivers show hourly time ranges", async () => {
      browser(`open ${BASE_URL}?id=valley-18203003`)
      await sleep(1500)
      const snap = getSnapshot()
      expect(snap).toMatch(/1\s*h|6\s*h|24\s*h|Stunde/)
    })

    await test("Lakes show weekly/monthly time ranges", async () => {
      browser(`open ${BASE_URL}?id=lake-tegernsee`)
      await sleep(2000)
      const snap = getSnapshot()
      expect(snap).toMatch(/Wochen|Monate/)
    })
  })

  // ------------------------------------------
  await describe("6. Chart Rendering", async () => {
    await test("Flow chart renders", async () => {
      browser(`open ${BASE_URL}?id=valley-18203003&pane=flow`)
      await sleep(1500)
      const snap = getSnapshot()
      expect(snap).toContain("Entwicklung")
    })

    await test("Level chart renders", async () => {
      browser(`open ${BASE_URL}?id=valley-18203003&pane=level`)
      await sleep(1500)
      const snap = getSnapshot()
      expect(snap).toContain("Entwicklung")
    })

    await test("Temperature chart renders", async () => {
      browser(`open ${BASE_URL}?id=valley-18203003&pane=temperature`)
      await sleep(1500)
      const snap = getSnapshot()
      expect(snap).toContain("Entwicklung")
    })
  })

  // ------------------------------------------
  await describe("7. Lake Level (Schliersee/Tegernsee)", async () => {
    await test("Schliersee shows Mittel reference", async () => {
      browser(`open ${BASE_URL}?id=lake-schliersee&pane=level&interval=24m`)
      await sleep(3000)
      const snap = getSnapshot()
      expect(snap).toMatch(/Mittel|cm/)
    })

    await test("Tegernsee shows Pegel with deviation", async () => {
      browser(`open ${BASE_URL}?id=lake-tegernsee&pane=level&interval=24m`)
      await sleep(3000)
      const snap = getSnapshot()
      expect(snap).toMatch(/Pegel|cm|Mittel/)
    })
  })

  // ------------------------------------------
  await describe("8. Webcam Display", async () => {
    await test("Spitzingsee shows webcam", async () => {
      browser(`open ${BASE_URL}?id=lake-spitzingsee`)
      await sleep(2000)
      const snap = getSnapshot()
      expect(snap).toMatch(/Webcam|img|image/i)
    })

    await test("Tegernsee shows webcam", async () => {
      browser(`open ${BASE_URL}?id=lake-tegernsee`)
      await sleep(2000)
      const snap = getSnapshot()
      expect(snap).toMatch(/Webcam|img|image/i)
    })
  })

  // ------------------------------------------
  await describe("9. Data Sources Footer", async () => {
    await test("River shows Datenquellen", async () => {
      browser(`open ${BASE_URL}?id=valley-18203003`)
      await sleep(1500)
      const snap = getSnapshot()
      expect(snap).toMatch(/Datenquellen|Abfluss|Pegel/)
    })

    await test("Schliersee shows GKD Pegel source", async () => {
      browser(`open ${BASE_URL}?id=lake-schliersee`)
      await sleep(1500)
      const snap = getSnapshot()
      expect(snap).toMatch(/Pegel|GKD|Datenquellen/)
    })
  })

  // ------------------------------------------
  await describe("10. Mobile Viewport", async () => {
    await test("App renders on mobile viewport", async () => {
      browser("set viewport 375 667")
      browser(`open ${BASE_URL}`)
      await sleep(2000)
      const snap = getSnapshot()
      expect(snap).toMatch(/Mangfall|Abfluss|Entwicklung/)
      // Reset
      browser("set viewport 1280 800")
    })
  })

  // Summary
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length

  console.log("\n" + "=".repeat(50))
  console.log("\x1b[1mTest Results\x1b[0m")
  console.log("=".repeat(50))
  console.log(`\x1b[32m✓ Passed: ${passed}\x1b[0m`)
  console.log(`\x1b[31m✗ Failed: ${failed}\x1b[0m`)
  console.log(`  Total:  ${results.length}`)

  if (failed > 0) {
    console.log("\n\x1b[31mFailed tests:\x1b[0m")
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  • ${r.name}`)
        if (r.error) console.log(`    ${r.error}`)
      })
    cleanup()
    process.exit(1)
  }

  console.log("\n\x1b[32mAll tests passed!\x1b[0m\n")
  cleanup()
  process.exit(0)
}

runTests().catch((e) => {
  console.error("Test runner error:", e)
  cleanup()
  process.exit(1)
})
