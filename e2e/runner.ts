/**
 * E2E Test Runner for Water Monitor
 * Uses agent-browser with parallel sessions for faster execution
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
  river: "valley-18203003", // Any river with flow/level/temp
  river2: "stauden-18242005", // Another river for switching tests
  lake: "lake-tegernsee", // Any lake with level data
  lake2: "lake-schliersee", // Another lake
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

// Browser helpers with session support
function browser(cmd: string, session?: string): string {
  const sessionFlag = session ? `--session ${session}` : ""
  try {
    return execSync(`npx agent-browser ${sessionFlag} ${cmd}`, {
      encoding: "utf-8",
      timeout: 30000,
    })
  } catch (e: any) {
    return e.stdout || e.message
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// Test framework
interface TestResult {
  suite: string
  name: string
  passed: boolean
  error?: string
}

function expect(actual: string) {
  return {
    toContain(expected: string) {
      if (!actual.includes(expected)) {
        throw new Error(`Expected "${expected}"`)
      }
    },
    toMatch(regex: RegExp) {
      if (!regex.test(actual)) {
        throw new Error(`Expected ${regex}`)
      }
    },
  }
}

// Test suite runner (silent execution, returns results)
async function runSuite(
  session: string,
  suiteName: string,
  tests: Array<{ name: string; fn: (s: string) => Promise<void> }>,
): Promise<TestResult[]> {
  const results: TestResult[] = []

  // Initialize session
  browser(`open ${BASE_URL}`, session)
  await sleep(2000)

  for (const t of tests) {
    try {
      await t.fn(session)
      results.push({ suite: suiteName, name: t.name, passed: true })
    } catch (e: any) {
      results.push({ suite: suiteName, name: t.name, passed: false, error: e.message })
    }
  }

  browser("close", session)
  return results
}

// ============================================
// TEST DEFINITIONS
// ============================================

const riverTests = [
  {
    name: "Default page loads with selector and chart",
    fn: async (s: string) => {
      const snap = browser("snapshot", s)
      expect(snap).toContain("Abfluss")
      expect(snap).toContain("Entwicklung")
    },
  },
  {
    name: "URL id param selects water body",
    fn: async (s: string) => {
      browser(`open ${BASE_URL}?id=${FIXTURES.river2}`, s)
      await sleep(2000)
      const snap = browser("snapshot", s)
      expect(snap).toContain("Leitzach")
    },
  },
  {
    name: "Pane param activates correct pane",
    fn: async (s: string) => {
      browser(`open ${BASE_URL}?id=${FIXTURES.river}&pane=level`, s)
      await sleep(2000)
      const snap = browser("snapshot", s)
      expect(snap).toMatch(/cm/)
    },
  },
  {
    name: "Flow chart shows m³/s units",
    fn: async (s: string) => {
      browser(`open ${BASE_URL}?id=${FIXTURES.river}&pane=flow`, s)
      await sleep(2000)
      const snap = browser("snapshot", s)
      expect(snap).toMatch(/m³\/s/)
    },
  },
  {
    name: "Level chart shows cm units",
    fn: async (s: string) => {
      browser(`open ${BASE_URL}?id=${FIXTURES.river}&pane=level`, s)
      await sleep(2000)
      const snap = browser("snapshot", s)
      expect(snap).toMatch(/cm/)
    },
  },
  {
    name: "Rivers show hourly time range options",
    fn: async (s: string) => {
      browser(`open ${BASE_URL}?id=${FIXTURES.river}`, s)
      await sleep(1500)
      const snap = browser("snapshot", s)
      expect(snap).toMatch(/Stunden?/)
    },
  },
  {
    name: "Data sources footer shows links",
    fn: async (s: string) => {
      browser(`open ${BASE_URL}?id=${FIXTURES.river}`, s)
      await sleep(1500)
      const snap = browser("snapshot", s)
      expect(snap).toContain("Datenquellen")
    },
  },
]

const lakeTests = [
  {
    name: "Lake ID param selects lake",
    fn: async (s: string) => {
      browser(`open ${BASE_URL}?id=${FIXTURES.lake}`, s)
      await sleep(2000)
      const snap = browser("snapshot", s)
      expect(snap).toContain("Tegernsee")
    },
  },
  {
    name: "Lakes default to level pane (no flow)",
    fn: async (s: string) => {
      browser(`open ${BASE_URL}?id=${FIXTURES.lake}`, s)
      await sleep(2000)
      const snap = browser("snapshot", s)
      expect(snap).toContain("Pegel")
    },
  },
  {
    name: "Lakes show weekly/monthly time ranges",
    fn: async (s: string) => {
      browser(`open ${BASE_URL}?id=${FIXTURES.lake}`, s)
      await sleep(2000)
      const snap = browser("snapshot", s)
      expect(snap).toMatch(/Wochen/)
    },
  },
  {
    name: "Lake level shows 24M Mittel reference",
    fn: async (s: string) => {
      browser(`open ${BASE_URL}?id=${FIXTURES.lake2}&pane=level&interval=2w`, s)
      await sleep(3000)
      const snap = browser("snapshot", s)
      expect(snap).toMatch(/Mittel/)
    },
  },
  {
    name: "Lake with webcam displays image",
    fn: async (s: string) => {
      browser(`open ${BASE_URL}?id=${FIXTURES.lakeWithWebcam}`, s)
      await sleep(2000)
      const snap = browser("snapshot", s)
      expect(snap).toMatch(/Webcam|img/i)
    },
  },
  {
    name: "Lake shows GKD data source",
    fn: async (s: string) => {
      browser(`open ${BASE_URL}?id=${FIXTURES.lake2}`, s)
      await sleep(1500)
      const snap = browser("snapshot", s)
      expect(snap).toMatch(/GKD|Pegel/)
    },
  },
]

const navigationTests = [
  {
    name: "Combined URL params work together",
    fn: async (s: string) => {
      browser(`open ${BASE_URL}?id=${FIXTURES.lake2}&pane=level&interval=2w`, s)
      await sleep(2000)
      const snap = browser("snapshot", s)
      expect(snap).toContain("Schliersee")
      expect(snap).toMatch(/2 Wochen/)
    },
  },
  {
    name: "Pane persists when switching water bodies",
    fn: async (s: string) => {
      browser(`open ${BASE_URL}?id=${FIXTURES.river}&pane=level`, s)
      await sleep(2000)
      browser(`open ${BASE_URL}?id=${FIXTURES.river2}&pane=level`, s)
      await sleep(2000)
      const snap = browser("snapshot", s)
      expect(snap).toMatch(/cm/)
    },
  },
  {
    name: "Mobile viewport renders correctly",
    fn: async (s: string) => {
      browser("set viewport 375 667", s)
      browser(`open ${BASE_URL}`, s)
      await sleep(2000)
      const snap = browser("snapshot", s)
      expect(snap).toContain("Entwicklung")
      browser("set viewport 1280 800", s)
    },
  },
]

// ============================================
// MAIN
// ============================================

async function runTests() {
  console.log("\n\x1b[1m🌊 Water Monitor E2E Tests\x1b[0m")
  console.log(`   Target: ${BASE_URL}\n`)

  await ensureServer()

  process.on("SIGINT", cleanup)
  process.on("SIGTERM", cleanup)

  // Run test suites in parallel using different sessions
  console.log("\x1b[2m  Running 3 test suites in parallel...\x1b[0m\n")

  const startTime = Date.now()
  const [riverResults, lakeResults, navResults] = await Promise.all([
    runSuite("rivers", "Rivers", riverTests),
    runSuite("lakes", "Lakes", lakeTests),
    runSuite("nav", "Navigation", navigationTests),
  ])
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  const results = [...riverResults, ...lakeResults, ...navResults]

  // Print results by suite
  for (const suite of ["Rivers", "Lakes", "Navigation"]) {
    const suiteResults = results.filter((r) => r.suite === suite)
    console.log(`\x1b[1m${suite}\x1b[0m`)
    for (const r of suiteResults) {
      const icon = r.passed ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"
      console.log(`  ${icon} ${r.name}${r.error ? ` - ${r.error}` : ""}`)
    }
    console.log()
  }

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length

  console.log("=".repeat(50))
  console.log(`\x1b[1mResults\x1b[0m  ${passed} passed, ${failed} failed (${elapsed}s)`)

  cleanup()
  process.exit(failed > 0 ? 1 : 0)
}

function cleanup() {
  if (serverProcess) serverProcess.kill()
  browser("close", "rivers")
  browser("close", "lakes")
  browser("close", "nav")
}

runTests().catch((e) => {
  console.error("Test runner error:", e)
  cleanup()
  process.exit(1)
})
