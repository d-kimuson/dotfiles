import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { deliverMcpConfig } from "./deliver.ts"

const testRootPrefix = path.join(tmpdir(), "deliver-mcp-test-")

let homeDir = ""

const readJson = async (filePath: string): Promise<unknown> => {
  return JSON.parse(await readFile(filePath, "utf-8")) as unknown
}

const writeTemplate = async (): Promise<void> => {
  await writeFile(
    path.join(homeDir, ".local/share/chezmoi/config/mcp.template.json"),
    JSON.stringify(
      {
        mcpServers: {
          obsidian: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-obsidian"],
          },
        },
      },
      null,
      2
    ),
    "utf-8"
  )
}

beforeEach(async () => {
  homeDir = await mkdtemp(testRootPrefix)
  process.env["HOME"] = homeDir

  await mkdir(path.join(homeDir, ".local/share/chezmoi/config"), {
    recursive: true,
  })
})

afterEach(async () => {
  await rm(homeDir, { recursive: true, force: true })
})

describe("deliverMcpConfig", () => {
  it("skips a target when its parent directory does not exist", async () => {
    await writeTemplate()

    const logs: string[] = []
    const originalLog = console.log
    console.log = (...args: unknown[]) => {
      logs.push(args.join(" "))
    }

    try {
      await deliverMcpConfig({
        targets: ["claude-desktop"],
        dryRun: false,
      })
    } finally {
      console.log = originalLog
    }

    expect(
      logs.some((line) => line.includes("Skipped: parent directory does not exist"))
    ).toBe(true)
  })

  it("writes config when the parent directory exists even if the file does not", async () => {
    await writeTemplate()
    const targetFile = path.join(homeDir, ".claude.json")

    await deliverMcpConfig({
      targets: ["claude-code"],
      dryRun: false,
    })

    expect(await readJson(targetFile)).toEqual({
      mcpServers: {
        obsidian: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-obsidian"],
        },
      },
    })
  })
})
