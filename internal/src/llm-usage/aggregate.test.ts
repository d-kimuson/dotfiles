import { describe, expect, it } from "vitest"
import { appendFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { aggregateLlmUsage } from "./aggregate.ts"

const testRootPrefix = path.join(tmpdir(), "llm-usage-test-")

const readJson = async (filePath: string): Promise<unknown> =>
  JSON.parse(await readFile(filePath, "utf-8"))

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf-8")
}

const writeJsonl = async (filePath: string, values: readonly unknown[]): Promise<void> => {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, values.map((value) => JSON.stringify(value)).join("\n") + "\n", "utf-8")
}

describe("aggregateLlmUsage", () => {
  it("uses the price revision effective on each usage date and deduplicates cloned Pi entries", async () => {
    const root = await mkdtemp(testRootPrefix)
    const usageRoot = path.join(root, "observe", "llm-usage")
    const sessionsRoot = path.join(root, "sessions")

    try {
      await writeJson(path.join(usageRoot, "master", "pricing.json"), {
        schemaVersion: 1,
        currency: "USD",
        prices: [
          {
            modelIdentifier: "openai-codex/gpt-test",
            applyFrom: "2026-01-01",
            inputPerMillionUsd: 2,
            outputPerMillionUsd: 8,
            cacheReadPerMillionUsd: 0.5,
            cacheWritePerMillionUsd: 2.5,
          },
          {
            modelIdentifier: "openai-codex/gpt-test",
            applyFrom: "2026-02-01",
            inputPerMillionUsd: 1,
            outputPerMillionUsd: 4,
            cacheReadPerMillionUsd: 0.25,
            cacheWritePerMillionUsd: 1.25,
          },
        ],
      })

      const message = {
        type: "message",
        id: "same-entry",
        parentId: null,
        timestamp: "2026-01-15T10:00:00.000Z",
        message: {
          role: "assistant",
          provider: "openai-codex",
          model: "gpt-test",
          timestamp: Date.parse("2026-01-15T10:00:00.000Z"),
          usage: {
            input: 1_000_000,
            output: 1_000_000,
            cacheRead: 1_000_000,
            cacheWrite: 1_000_000,
          },
        },
      }
      await writeJsonl(path.join(sessionsRoot, "first.jsonl"), [{ type: "session", version: 3 }, message])
      await writeJsonl(path.join(sessionsRoot, "cloned.jsonl"), [{ type: "session", version: 3 }, message])
      await writeJsonl(path.join(sessionsRoot, "second.jsonl"), [
        { type: "session", version: 3 },
        {
          ...message,
          id: "second-entry",
          timestamp: "2026-02-02T10:00:00.000Z",
          message: {
            ...message.message,
            timestamp: Date.parse("2026-02-02T10:00:00.000Z"),
            usage: { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 },
          },
        },
      ])

      await writeJsonl(path.join(usageRoot, "state", "quota", "2026-01-15.jsonl"), [
        {
          schemaVersion: 1,
          kind: "quota_observation",
          observedAt: "2026-01-15T09:00:00.000Z",
          provider: "openai-codex",
          accountAlias: "personal",
          windows: [{ kind: "weekly", usedPercent: 10.2, resetAt: "2026-01-20T00:00:00.000Z" }],
        },
        {
          schemaVersion: 1,
          kind: "quota_observation",
          observedAt: "2026-01-15T20:00:00.000Z",
          provider: "openai-codex",
          accountAlias: "personal",
          windows: [{ kind: "weekly", usedPercent: 12.8, resetAt: "2026-01-20T00:00:00.000Z" }],
        },
      ])

      await aggregateLlmUsage({ usageRoot, sessionsRoot, machineId: "machine-a" })

      expect(
        await readJson(path.join(usageRoot, "aggregate", "machine-a", "2026", "01.json")),
      ).toEqual({
        schemaVersion: 1,
        machineId: "machine-a",
        month: "2026-01",
        days: {
          "2026-01-15": {
            quota: {
              observationCount: 2,
              windows: [
                {
                  provider: "openai-codex",
                  accountAlias: "personal",
                  kind: "weekly",
                  resetAt: "2026-01-20T00:00:00.000Z",
                  firstUsedPercent: 10.2,
                  lastUsedPercent: 12.8,
                  minUsedPercent: 10.2,
                  maxUsedPercent: 12.8,
                },
              ],
            },
            usage: {
              requestCount: 1,
              pricedRequestCount: 1,
              tokens: {
                input: 1_000_000,
                output: 1_000_000,
                cacheRead: 1_000_000,
                cacheWrite: 1_000_000,
              },
              pricedRetailCostUsd: 13,
              pricedQuotaEquivalentCostUsd: 13,
              retailCostUsd: 13,
              quotaEquivalentCostUsd: 13,
              models: [
                {
                  modelIdentifier: "openai-codex/gpt-test",
                  requestCount: 1,
                  pricedRequestCount: 1,
                  tokens: {
                    input: 1_000_000,
                    output: 1_000_000,
                    cacheRead: 1_000_000,
                    cacheWrite: 1_000_000,
                  },
                  pricedRetailCostUsd: 13,
                  pricedQuotaEquivalentCostUsd: 13,
                  retailCostUsd: 13,
                  quotaEquivalentCostUsd: 13,
                  pricingApplyFrom: ["2026-01-01"],
                },
              ],
              unpricedModelIdentifiers: [],
            },
          },
        },
      })

      expect(
        await readJson(path.join(usageRoot, "aggregate", "machine-a", "2026", "02.json")),
      ).toMatchObject({
        days: {
          "2026-02-02": {
            usage: {
              requestCount: 1,
              retailCostUsd: 1,
              models: [{ pricingApplyFrom: ["2026-02-01"] }],
            },
          },
        },
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it("applies a matching input tier within the effective price revision", async () => {
    const root = await mkdtemp(testRootPrefix)
    const usageRoot = path.join(root, "observe", "llm-usage")
    const sessionsRoot = path.join(root, "sessions")

    try {
      await writeJson(path.join(usageRoot, "master", "pricing.json"), {
        schemaVersion: 1,
        currency: "USD",
        prices: [{
          modelIdentifier: "openai-codex/gpt-tiered",
          applyFrom: "2026-01-01",
          inputPerMillionUsd: 1,
          outputPerMillionUsd: 1,
          cacheReadPerMillionUsd: 1,
          cacheWritePerMillionUsd: 1,
          tiers: [{
            inputTokensAbove: 10,
            inputPerMillionUsd: 2,
            outputPerMillionUsd: 2,
            cacheReadPerMillionUsd: 2,
            cacheWritePerMillionUsd: 2,
          }],
          conditions: [{
            kind: "utc-weekly-time-window",
            weekdays: [1],
            startUtc: "01:00",
            endUtc: "04:00",
            inputPerMillionUsd: 3,
            outputPerMillionUsd: 3,
            cacheReadPerMillionUsd: 3,
            cacheWritePerMillionUsd: 3,
            quotaMultiplier: 4,
          }],
        }],
      })
      await writeJsonl(path.join(sessionsRoot, "session.jsonl"), [{
        type: "message",
        id: "tiered-entry",
        timestamp: "2026-01-05T02:00:00.000Z",
        message: {
          role: "assistant",
          provider: "openai-codex",
          model: "gpt-tiered",
          timestamp: Date.parse("2026-01-05T02:00:00.000Z"),
          usage: { input: 11, output: 1, cacheRead: 0, cacheWrite: 0 },
        },
      }])

      await aggregateLlmUsage({ usageRoot, sessionsRoot, machineId: "machine-tiered" })

      expect(
        await readJson(path.join(usageRoot, "aggregate", "machine-tiered", "2026", "01.json")),
      ).toMatchObject({
        days: {
          "2026-01-05": {
            usage: { retailCostUsd: 0.000036, quotaEquivalentCostUsd: 0.000144 },
          },
        },
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it("keeps token totals and marks a model unpriced when no revision applies", async () => {
    const root = await mkdtemp(testRootPrefix)
    const usageRoot = path.join(root, "observe", "llm-usage")
    const sessionsRoot = path.join(root, "sessions")

    try {
      await writeJson(path.join(usageRoot, "aggregate", "machine-b", "2026", "03.json"), {
        schemaVersion: 1,
        machineId: "machine-b",
        month: "2026-03",
        days: {
          "2026-03-02": { preserved: true },
        },
      })
      await writeJsonl(path.join(sessionsRoot, "session.jsonl"), [
        {
          type: "message",
          id: "entry",
          timestamp: "2026-03-01T00:00:00.000Z",
          message: {
            role: "assistant",
            provider: "zai",
            model: "glm-test",
            timestamp: Date.parse("2026-03-01T00:00:00.000Z"),
            usage: { input: 3, output: 5, cacheRead: 7, cacheWrite: 11 },
          },
        },
        {
          type: "message",
          id: "zero-token-entry",
          timestamp: "2026-03-01T00:01:00.000Z",
          message: {
            role: "assistant",
            provider: "zai",
            model: "glm-test:hard",
            timestamp: Date.parse("2026-03-01T00:01:00.000Z"),
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          },
        },
      ])

      await appendFile(path.join(sessionsRoot, "session.jsonl"), "{\"type\":")
      await aggregateLlmUsage({ usageRoot, sessionsRoot, machineId: "machine-b" })

      const aggregate = await readJson(path.join(usageRoot, "aggregate", "machine-b", "2026", "03.json"))
      expect(aggregate).toMatchObject({
        days: {
          "2026-03-01": {
            usage: {
              requestCount: 1,
              pricedRequestCount: 0,
              retailCostUsd: null,
              unpricedModelIdentifiers: ["zai/glm-test"],
              tokens: { input: 3, output: 5, cacheRead: 7, cacheWrite: 11 },
            },
          },
        },
      })
      expect(aggregate).toMatchObject({ days: { "2026-03-02": { preserved: true } } })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
