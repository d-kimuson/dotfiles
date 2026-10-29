import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  checkNpmShadowing,
  findShadowedNpmTools,
  listInstalledNpmTools,
  parseManagedNpmTools,
  resolveSearchRoots,
  type InstalledNpmTool,
} from "./check.ts"

let testDir: string

beforeEach(async () => {
  testDir = await mkdtemp(path.join(tmpdir(), "npm-shadowing-test-"))
})

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true })
})

const writePackage = async (
  nodeModules: string,
  name: string,
  version: string
): Promise<void> => {
  const dir = path.join(nodeModules, name)
  await mkdir(dir, { recursive: true })
  await writeFile(
    path.join(dir, "package.json"),
    JSON.stringify({ name, version }),
    "utf-8"
  )
}

describe("parseManagedNpmTools", () => {
  it("reads string and object versions of npm entries", () => {
    const config = [
      "[tools]",
      '"npm:command-code" = "1.88.2"',
      '"npm:@opencode/cli" = { version = "2.1.4", allow_builds = ["@opencode/cli"] }',
      'node = "26.12.1"',
    ].join("\n")

    expect(parseManagedNpmTools(config)).toEqual([
      { name: "command-code", version: "1.88.2" },
      { name: "@opencode/cli", version: "2.1.4" },
    ])
  })

  it("ignores npm entries without a version string", () => {
    const config = ['[tools]', '"npm:broken" = 1', '"npm:no-version" = { allow_builds = ["x"] }'].join(
      "\n"
    )

    expect(parseManagedNpmTools(config)).toEqual([])
  })

  it("returns nothing without a tools section", () => {
    expect(parseManagedNpmTools("[settings]\nfoo = 1")).toEqual([])
  })
})

describe("findShadowedNpmTools", () => {
  const installed: readonly InstalledNpmTool[] = [
    { name: "command-code", version: "1.88.2", root: "/npm-global" },
    { name: "other", version: "1.0.0", root: "/npm-global" },
  ]

  it("returns the managed tools that also exist outside mise", () => {
    const shadowed = findShadowedNpmTools(
      [
        { name: "command-code", version: "1.88.2" },
        { name: "claude", version: "2.1.312" },
      ],
      installed
    )

    expect(shadowed).toEqual([
      {
        name: "command-code",
        version: "1.88.2",
        installed: [
          { name: "command-code", version: "1.88.2", root: "/npm-global" },
        ],
      },
    ])
  })

  it("returns every install when the package exists in several roots", () => {
    const shadowed = findShadowedNpmTools(
      [{ name: "command-code", version: "1.88.2" }],
      [
        { name: "command-code", version: "1.88.2", root: "/a" },
        { name: "command-code", version: "1.87.0", root: "/b" },
      ]
    )

    expect(shadowed[0]?.installed.map((tool) => tool.root)).toEqual(["/a", "/b"])
  })

  it("returns nothing when every managed tool is only inside mise", () => {
    expect(
      findShadowedNpmTools([{ name: "claude", version: "2.1.312" }], installed)
    ).toEqual([])
  })
})

describe("listInstalledNpmTools", () => {
  it("reads both scoped and unscoped packages", async () => {
    const nodeModules = path.join(testDir, "node_modules")
    await writePackage(nodeModules, "command-code", "1.88.2")
    await writePackage(nodeModules, "@anthropic-ai/claude-code", "2.1.312")

    const tools = await listInstalledNpmTools(nodeModules)

    expect([...tools].sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      {
        name: "@anthropic-ai/claude-code",
        version: "2.1.312",
        root: nodeModules,
      },
      { name: "command-code", version: "1.88.2", root: nodeModules },
    ])
  })

  it("ignores dot directories, packages without package.json and broken files", async () => {
    const nodeModules = path.join(testDir, "node_modules")
    await mkdir(path.join(nodeModules, ".bin"), { recursive: true })
    await mkdir(path.join(nodeModules, "empty"), { recursive: true })
    await mkdir(path.join(nodeModules, "broken"), { recursive: true })
    await writeFile(
      path.join(nodeModules, "broken", "package.json"),
      "{not json",
      "utf-8"
    )

    expect(await listInstalledNpmTools(nodeModules)).toEqual([])
  })

  it("returns nothing for a missing root", async () => {
    expect(
      await listInstalledNpmTools(path.join(testDir, "missing"))
    ).toEqual([])
  })
})

describe("resolveSearchRoots", () => {
  it("returns node_modules directories that npm installs into", async () => {
    const roots = await resolveSearchRoots()

    expect(roots.length).toBeGreaterThan(0)
    for (const root of roots) expect(path.basename(root)).toBe("node_modules")
  })
})

describe("checkNpmShadowing", () => {
  it("matches the mise config against the search roots", async () => {
    const configPath = path.join(testDir, "config.toml")
    await writeFile(
      configPath,
      '[tools]\n"npm:command-code" = "1.88.2"\n',
      "utf-8"
    )
    const nodeModules = path.join(testDir, "node_modules")
    await writePackage(nodeModules, "command-code", "1.88.2")

    const shadowed = await checkNpmShadowing({
      configPath,
      searchRoots: [nodeModules],
    })

    expect(shadowed.map((tool) => tool.name)).toEqual(["command-code"])
  })

  it("fails instead of reporting a clean result when the config is missing", async () => {
    await expect(
      checkNpmShadowing({
        configPath: path.join(testDir, "missing.toml"),
        searchRoots: [path.join(testDir, "node_modules")],
      })
    ).rejects.toThrow(/mise config not found/)
  })

  it("fails instead of reporting a clean result when a root cannot be read", async () => {
    const configPath = path.join(testDir, "config.toml")
    await writeFile(configPath, '[tools]\n"npm:command-code" = "1.88.2"\n')
    const notADirectory = path.join(testDir, "file")
    await writeFile(notADirectory, "")

    await expect(
      checkNpmShadowing({ configPath, searchRoots: [notADirectory] })
    ).rejects.toThrow(/failed to list/)
  })
})
