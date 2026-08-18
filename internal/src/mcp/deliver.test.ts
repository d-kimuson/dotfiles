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

  it("writes pi-agent config to ~/.pi/agent/mcp.json", async () => {
    await writeTemplate()
    const targetFile = path.join(homeDir, ".pi/agent/mcp.json")

    await deliverMcpConfig({
      targets: ["pi-agent"],
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

  it("excludes servers with excludeTargets for the matching target", async () => {
    await writeFile(
      path.join(homeDir, ".local/share/chezmoi/config/mcp.template.json"),
      JSON.stringify(
        {
          mcpServers: {
            shared: {
              command: "shared-cmd",
              args: [],
            },
            excluded: {
              command: "excluded-cmd",
              args: [],
              excludeTargets: ["claude-code"],
            },
          },
        },
        null,
        2
      ),
      "utf-8"
    )

    const claudeFile = path.join(homeDir, ".claude.json")
    await deliverMcpConfig({
      targets: ["claude-code"],
      dryRun: false,
    })

    const claudeConfig = (await readJson(claudeFile)) as {
      mcpServers: Record<string, unknown>
    }
    expect(claudeConfig.mcpServers).toHaveProperty("shared")
    expect(claudeConfig.mcpServers).not.toHaveProperty("excluded")
  })

  it("delivers excludeTargets servers to non-excluded targets", async () => {
    await writeFile(
      path.join(homeDir, ".local/share/chezmoi/config/mcp.template.json"),
      JSON.stringify(
        {
          mcpServers: {
            "only-excluded-from-claude": {
              command: "some-cmd",
              args: [],
              excludeTargets: ["claude-code"],
            },
          },
        },
        null,
        2
      ),
      "utf-8"
    )

    const piFile = path.join(homeDir, ".pi/agent/mcp.json")
    await deliverMcpConfig({
      targets: ["pi-agent"],
      dryRun: false,
    })

    const piConfig = (await readJson(piFile)) as {
      mcpServers: Record<string, unknown>
    }
    expect(piConfig.mcpServers).toHaveProperty("only-excluded-from-claude")
  })

  it("strips excludeTargets field from delivered config", async () => {
    await writeFile(
      path.join(homeDir, ".local/share/chezmoi/config/mcp.template.json"),
      JSON.stringify(
        {
          mcpServers: {
            server: {
              command: "cmd",
              args: [],
              excludeTargets: ["codex"],
            },
          },
        },
        null,
        2
      ),
      "utf-8"
    )

    const claudeFile = path.join(homeDir, ".claude.json")
    await deliverMcpConfig({
      targets: ["claude-code"],
      dryRun: false,
    })

    const config = (await readJson(claudeFile)) as {
      mcpServers: Record<string, Record<string, unknown>>
    }
    expect(config.mcpServers["server"]).not.toHaveProperty("excludeTargets")
  })
})
