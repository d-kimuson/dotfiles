import { readFile, rm, writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { parse as parseTOML } from "smol-toml"
import { mergeConfigs } from "./merge.ts"

const testDir = path.join(tmpdir(), "merge-config-test")

beforeEach(async () => {
  await mkdir(testDir, { recursive: true })
})

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true })
})

const writeTempJson = async (
  name: string,
  data: Record<string, unknown>
): Promise<string> => {
  const filePath = path.join(testDir, name)
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8")
  return filePath
}

const readTempJson = async (name: string): Promise<unknown> => {
  const content = await readFile(path.join(testDir, name), "utf-8")
  return JSON.parse(content) as unknown
}

describe("mergeConfigs", () => {
  it("creates target when it does not exist", async () => {
    const source = await writeTempJson("source.json", {
      language: "日本語",
      statusLine: { type: "command" },
    })
    const target = path.join(testDir, "target.json")

    await mergeConfigs({
      entries: [{ source, target }],
      dryRun: false,
    })

    expect(await readTempJson("target.json")).toEqual({
      language: "日本語",
      statusLine: { type: "command" },
    })
  })

  it("merges source into existing target, source wins on overlap", async () => {
    const source = await writeTempJson("source.json", {
      language: "日本語",
      theme: "dark",
    })
    const target = await writeTempJson("target.json", {
      language: "English",
      customSetting: true,
    })

    await mergeConfigs({
      entries: [{ source, target }],
      dryRun: false,
    })

    expect(await readTempJson("target.json")).toEqual({
      language: "日本語",
      theme: "dark",
      customSetting: true,
    })
  })

  it("deep merges nested objects", async () => {
    const source = await writeTempJson("source.json", {
      statusLine: { command: "foo", type: "command" },
    })
    const target = await writeTempJson("target.json", {
      statusLine: { command: "bar", padding: 10 },
    })

    await mergeConfigs({
      entries: [{ source, target }],
      dryRun: false,
    })

    expect(await readTempJson("target.json")).toEqual({
      statusLine: { command: "foo", type: "command", padding: 10 },
    })
  })

  it("does not write in dry-run mode", async () => {
    const source = await writeTempJson("source.json", { language: "日本語" })
    const target = await writeTempJson("target.json", { old: true })
    const originalContent = await readFile(target, "utf-8")

    await mergeConfigs({
      entries: [{ source, target }],
      dryRun: true,
    })

    const afterContent = await readFile(target, "utf-8")
    expect(afterContent).toBe(originalContent)
  })

  it("reports extra keys in target not present in source", async () => {
    const source = await writeTempJson("source.json", { a: 1 })
    await writeTempJson("target.json", { a: 2, extra1: true, extra2: "val" })

    const logs: string[] = []
    const originalLog = console.log
    console.log = (...args: unknown[]) => {
      logs.push(args.join(" "))
    }

    try {
      await mergeConfigs({
        entries: [
          {
            source,
            target: path.join(testDir, "target.json"),
          },
        ],
        dryRun: false,
      })
    } finally {
      console.log = originalLog
    }

    const extraLogs = logs.filter((l) => l.includes("Extra keys"))
    expect(extraLogs).toHaveLength(1)
    expect(logs.some((l) => l.includes("extra1"))).toBe(true)
    expect(logs.some((l) => l.includes("extra2"))).toBe(true)
  })
})

const writeTempToml = async (name: string, content: string): Promise<string> => {
  const filePath = path.join(testDir, name)
  await writeFile(filePath, content, "utf-8")
  return filePath
}

const readTempToml = async (name: string): Promise<unknown> => {
  const content = await readFile(path.join(testDir, name), "utf-8")
  return parseTOML(content) as unknown
}

describe("mergeConfigs (TOML)", () => {
  it("creates toml target when it does not exist", async () => {
    const source = await writeTempToml(
      "source.toml",
      'model = "gpt-5.4"\n\n[features]\nskills = true\n'
    )
    const target = path.join(testDir, "target.toml")

    await mergeConfigs({
      entries: [{ source, target }],
      dryRun: false,
    })

    expect(await readTempToml("target.toml")).toEqual({
      model: "gpt-5.4",
      features: { skills: true },
    })
  })

  it("merges toml source into existing target, source wins", async () => {
    const source = await writeTempToml(
      "source.toml",
      'model = "gpt-5.4"\n\n[features]\nskills = true\n'
    )
    const target = await writeTempToml(
      "target.toml",
      'model = "gpt-4o"\napproval_mode = "suggest"\n\n[features]\nweb_search_cached = true\n'
    )

    await mergeConfigs({
      entries: [{ source, target }],
      dryRun: false,
    })

    expect(await readTempToml("target.toml")).toEqual({
      model: "gpt-5.4",
      approval_mode: "suggest",
      features: { skills: true, web_search_cached: true },
    })
  })

  it("reports extra keys in toml target", async () => {
    const source = await writeTempToml("source.toml", 'model = "gpt-5.4"\n')
    await writeTempToml(
      "target.toml",
      'model = "gpt-4o"\napproval_mode = "suggest"\n'
    )

    const logs: string[] = []
    const originalLog = console.log
    console.log = (...args: unknown[]) => {
      logs.push(args.join(" "))
    }

    try {
      await mergeConfigs({
        entries: [{ source, target: path.join(testDir, "target.toml") }],
        dryRun: false,
      })
    } finally {
      console.log = originalLog
    }

    expect(logs.some((l) => l.includes("approval_mode"))).toBe(true)
  })
})
