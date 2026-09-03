import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { loadDashboardData, startDashboardServer } from "./dashboard.ts"

const roots: string[] = []

const createUsageRoot = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "llm-usage-dashboard-test-"))
  roots.push(root)
  return path.join(root, "observe", "llm-usage")
}

const writeAggregate = async (usageRoot: string, machineId: string, month: string): Promise<void> => {
  const [year, monthNumber] = month.split("-")
  const target = path.join(usageRoot, "aggregate", machineId, year ?? "", `${monthNumber ?? ""}.json`)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify({
    schemaVersion: 1,
    machineId,
    month,
    days: {
      [`${month}-02`]: {
        quota: {
          observationCount: 1,
          windows: [{
            provider: "opencode-go",
            accountAlias: "default",
            kind: "monthly",
            resetAt: "2026-09-01T00:00:00.000Z",
            firstUsedPercent: 10,
            lastUsedPercent: 25,
            minUsedPercent: 10,
            maxUsedPercent: 25,
          }],
        },
        usage: {
          requestCount: 2,
          pricedRequestCount: 2,
          tokens: { input: 100, output: 20, cacheRead: 300, cacheWrite: 0 },
          pricedRetailCostUsd: 1.25,
          pricedQuotaEquivalentCostUsd: 2.5,
          retailCostUsd: 1.25,
          quotaEquivalentCostUsd: 2.5,
          models: [{
            modelIdentifier: "opencode-go/deepseek-v4-flash",
            requestCount: 2,
            pricedRequestCount: 2,
            tokens: { input: 100, output: 20, cacheRead: 300, cacheWrite: 0 },
            pricedRetailCostUsd: 1.25,
            pricedQuotaEquivalentCostUsd: 2.5,
            retailCostUsd: 1.25,
            quotaEquivalentCostUsd: 2.5,
            pricingApplyFrom: ["2026-08-18"],
          }],
          unpricedModelIdentifiers: [],
        },
      },
    },
  }, null, 2))
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("loadDashboardData", () => {
  it("loads committed aggregates across machines in chronological order", async () => {
    const usageRoot = await createUsageRoot()
    await writeAggregate(usageRoot, "machine-b", "2026-08")
    await writeAggregate(usageRoot, "machine-a", "2026-07")

    await expect(loadDashboardData(usageRoot)).resolves.toMatchObject({
      machines: ["machine-a", "machine-b"],
      months: ["2026-07", "2026-08"],
      days: [
        { machineId: "machine-a", date: "2026-07-02", usage: { pricedQuotaEquivalentCostUsd: 2.5 } },
        { machineId: "machine-b", date: "2026-08-02", usage: { pricedQuotaEquivalentCostUsd: 2.5 } },
      ],
    })
  })
})

describe("subscription model and quota resolution", () => {
  it("prefers a recent 20%+ quota delta and computes model-only token capacity from observed usage", async () => {
    const usageRoot = await createUsageRoot()
    await writeAggregate(usageRoot, "machine-a", "2026-08")
    await mkdir(path.join(usageRoot, "master"), { recursive: true })
    await writeFile(path.join(usageRoot, "master", "subscriptions.json"), JSON.stringify({
      schemaVersion: 2,
      currency: "USD",
      subscriptions: [{
        provider: "opencode-go",
        planName: "OpenCode Go",
        active: true,
        applyFrom: "2026-08-01",
        monthlyPriceUsd: 10,
        quotaMeasurement: { provider: "opencode-go", kind: "monthly", monthlyFactor: 1 },
        monthlyQuotaUsd: null,
        monthlyQuotaBasis: "observed",
        compressionRatio: null,
        models: [{ modelIdentifier: "opencode-go/deepseek-v4-flash", availableTokensPerMonth: null, tokenBasis: "not fixed" }],
      }],
    }, null, 2))
    await writeFile(path.join(usageRoot, "aggregate", "machine-a", "quota-estimates.json"), JSON.stringify({
      schemaVersion: 1,
      machineId: "machine-a",
      estimates: [
        {
          provider: "opencode-go", accountAlias: "default", kind: "monthly", resetAt: "2026-08-31T00:00:00.000Z",
          estimationMethod: "usage-percentage-delta", usageStartAt: "2026-08-10T00:00:00.000Z", usageEndAt: "2026-08-20T00:00:00.000Z",
          firstObservedAt: "2026-08-10T00:00:00.000Z", lastObservedAt: "2026-08-20T00:00:00.000Z", firstUsedPercent: 20, lastUsedPercent: 40, usedPercentDelta: 20,
          usage: { requestCount: 1, pricedRequestCount: 1, pricedQuotaEquivalentCostUsd: 10, quotaEquivalentCostUsd: 10 }, estimatedQuotaBudgetUsd: 50, intervals: [],
        },
        {
          provider: "opencode-go", accountAlias: "default", kind: "monthly", resetAt: "2026-08-31T00:00:00.000Z",
          estimationMethod: "usage-percentage-delta", usageStartAt: "2026-08-20T00:00:00.000Z", usageEndAt: "2026-08-29T00:00:00.000Z",
          firstObservedAt: "2026-08-20T00:00:00.000Z", lastObservedAt: "2026-08-29T00:00:00.000Z", firstUsedPercent: 0, lastUsedPercent: 10, usedPercentDelta: 10,
          usage: { requestCount: 1, pricedRequestCount: 1, pricedQuotaEquivalentCostUsd: 100, quotaEquivalentCostUsd: 100 }, estimatedQuotaBudgetUsd: 1000, intervals: [],
        },
      ],
    }, null, 2))

    const data = await loadDashboardData(usageRoot)
    const subscription = data.subscriptions[0]
    expect(subscription?.computedMonthlyQuotaUsd).toBe(50)
    expect(subscription?.computedQuotaBasis).toContain("20.0% → 40.0%")
    expect(subscription?.models[0]?.computedTokensPerMonth).toEqual({ min: 8400, max: 8400 })
  })
})

describe("startDashboardServer", () => {
  it("serves the dashboard and its JSON only on a loopback ephemeral port", async () => {
    const usageRoot = await createUsageRoot()
    await writeAggregate(usageRoot, "machine-a", "2026-08")
    const dashboard = await startDashboardServer({ usageRoot, port: 0 })

    try {
      const [page, response] = await Promise.all([
        fetch(dashboard.url),
        fetch(`${dashboard.url}/api/dashboard`),
      ])
      expect(page.headers.get("content-type")).toContain("text/html")
      await expect(page.text()).resolves.toContain("LLM Usage Ledger")
      expect(response.headers.get("content-type")).toContain("application/json")
      await expect(response.text()).resolves.toContain('"machineId":"machine-a"')
    } finally {
      await dashboard.close()
    }
  })
})
