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
    path.join(homeDir, ".local/share/chezmoi/config/agent/mcp.template.json"),
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
  delete process.env["MCP_LAYERS"]
  delete process.env["DISABLE_MCPS"]
  delete process.env["GATED_TOKEN"]

  await mkdir(path.join(homeDir, ".local/share/chezmoi/config/agent"), {
    recursive: true,
  })
})

afterEach(async () => {
  delete process.env["MCP_LAYERS"]
  delete process.env["DISABLE_MCPS"]
  delete process.env["GATED_TOKEN"]
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
      path.join(homeDir, ".local/share/chezmoi/config/agent/mcp.template.json"),
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
      path.join(homeDir, ".local/share/chezmoi/config/agent/mcp.template.json"),
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
      path.join(homeDir, ".local/share/chezmoi/config/agent/mcp.template.json"),
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

  it("writes command-code config with transport and replaces stale servers", async () => {
    await writeFile(
      path.join(homeDir, ".local/share/chezmoi/config/agent/mcp.template.json"),
      JSON.stringify(
        {
          mcpServers: {
            local: { command: "local-cmd", args: [] },
            remote: { type: "http", url: "https://example.com/mcp" },
          },
        },
        null,
        2
      ),
      "utf-8"
    )
    const targetFile = path.join(homeDir, ".commandcode/mcp.json")
    await mkdir(path.join(homeDir, ".commandcode"), { recursive: true })
    await writeFile(
      targetFile,
      JSON.stringify({
        mcpServers: {
          stale: { transport: "stdio", command: "stale-cmd" },
        },
      }),
      "utf-8"
    )

    await deliverMcpConfig({
      targets: ["command-code"],
      dryRun: false,
    })

    expect(await readJson(targetFile)).toEqual({
      mcpServers: {
        local: { transport: "stdio", command: "local-cmd", args: [] },
        remote: { transport: "http", url: "https://example.com/mcp" },
      },
    })
  })

  it("selects layers with MCP_LAYERS", async () => {
    await writeFile(
      path.join(homeDir, ".local/share/chezmoi/config/agent/mcp.template.json"),
      JSON.stringify(
        {
          mcpServers: {
            core: { layer: "core", command: "core-cmd", args: [] },
            personal: {
              layer: "personal",
              command: "personal-cmd",
              args: [],
              remote: true,
            },
          },
        },
        null,
        2
      ),
      "utf-8"
    )
    const target = path.join(homeDir, ".pi/agent/mcp.json")

    process.env["MCP_LAYERS"] = "core"
    await deliverMcpConfig({ targets: ["pi-agent"], dryRun: false })
    expect(await readJson(target)).toEqual({
      mcpServers: { core: { command: "core-cmd", args: [] } },
    })

    process.env["MCP_LAYERS"] = "core,personal"
    await deliverMcpConfig({ targets: ["pi-agent"], dryRun: false })
    expect(await readJson(target)).toEqual({
      mcpServers: {
        core: { command: "core-cmd", args: [] },
        personal: { command: "personal-cmd", args: [] },
      },
    })
  })

  it("skips servers whose requiresEnv vars are not set", async () => {
    await writeFile(
      path.join(homeDir, ".local/share/chezmoi/config/agent/mcp.template.json"),
      JSON.stringify(
        {
          mcpServers: {
            gated: {
              command: "gated-cmd",
              args: [],
              requiresEnv: ["GATED_TOKEN"],
            },
          },
        },
        null,
        2
      ),
      "utf-8"
    )
    const target = path.join(homeDir, ".pi/agent/mcp.json")

    await deliverMcpConfig({ targets: ["pi-agent"], dryRun: false })
    expect(await readJson(target)).toEqual({ mcpServers: {} })

    process.env["GATED_TOKEN"] = "1"
    await deliverMcpConfig({ targets: ["pi-agent"], dryRun: false })
    expect(await readJson(target)).toEqual({
      mcpServers: { gated: { command: "gated-cmd", args: [] } },
    })
  })

  it("skips remote MCPs for connector targets", async () => {
    await writeFile(
      path.join(homeDir, ".local/share/chezmoi/config/agent/mcp.template.json"),
      JSON.stringify(
        {
          mcpServers: {
            local: { command: "local-cmd", args: [] },
            remote: {
              type: "http",
              url: "https://example.com/mcp",
              remote: true,
            },
          },
        },
        null,
        2
      ),
      "utf-8"
    )

    const claudeFile = path.join(homeDir, ".claude.json")
    await deliverMcpConfig({ targets: ["claude-code"], dryRun: false })
    const claude = (await readJson(claudeFile)) as {
      mcpServers: Record<string, unknown>
    }
    expect(claude.mcpServers).toHaveProperty("local")
    expect(claude.mcpServers).not.toHaveProperty("remote")

    const piFile = path.join(homeDir, ".pi/agent/mcp.json")
    await deliverMcpConfig({ targets: ["pi-agent"], dryRun: false })
    const pi = (await readJson(piFile)) as {
      mcpServers: Record<string, unknown>
    }
    expect(pi.mcpServers).toHaveProperty("local")
    expect(pi.mcpServers).toHaveProperty("remote")
  })

  it("writes OpenCode mcp.servers with local and remote conversions", async () => {
    await writeFile(
      path.join(homeDir, ".local/share/chezmoi/config/agent/mcp.template.json"),
      JSON.stringify(
        {
          mcpServers: {
            local: {
              command: "local-cmd",
              args: ["--flag"],
              env: { TOKEN: "local-secret" },
            },
            remote: {
              type: "http",
              url: "https://example.com/mcp",
              headers: { Authorization: "Bearer header-secret" },
            },
          },
        },
        null,
        2
      ),
      "utf-8"
    )
    const target = path.join(homeDir, ".config/opencode/opencode.json")
    await mkdir(path.join(homeDir, ".config/opencode"), { recursive: true })
    await writeFile(
      target,
      JSON.stringify({ $schema: "https://opencode.ai/config.json", mcp: {} }),
      "utf-8"
    )

    await deliverMcpConfig({ targets: ["opencode"], dryRun: false })

    expect(await readJson(target)).toEqual({
      $schema: "https://opencode.ai/config.json",
      mcp: {
        servers: {
          local: {
            type: "local",
            command: ["local-cmd", "--flag"],
            environment: { TOKEN: "local-secret" },
          },
          remote: {
            type: "remote",
            url: "https://example.com/mcp",
            headers: { Authorization: "Bearer header-secret" },
          },
        },
      },
    })
  })

  it("replaces pi-agent servers instead of merging stale entries", async () => {
    await writeTemplate()
    const target = path.join(homeDir, ".pi/agent/mcp.json")
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(
      target,
      JSON.stringify({
        mcpServers: { stale: { command: "stale-cmd", args: [] } },
      }),
      "utf-8"
    )

    await deliverMcpConfig({ targets: ["pi-agent"], dryRun: false })

    expect(await readJson(target)).toEqual({
      mcpServers: {
        obsidian: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-obsidian"],
        },
      },
    })
  })

  it("does not print server secrets in dry-run mode", async () => {
    await writeFile(
      path.join(homeDir, ".local/share/chezmoi/config/agent/mcp.template.json"),
      JSON.stringify(
        {
          mcpServers: {
            stdio: {
              command: "cmd",
              args: [],
              env: { API_KEY: "env-secret-value" },
            },
            remote: {
              type: "http",
              url: "https://example.com/mcp",
              headers: { Authorization: "Basic header-secret-value" },
            },
          },
        },
        null,
        2
      ),
      "utf-8"
    )
    await mkdir(path.join(homeDir, ".codex"), { recursive: true })

    const logs: string[] = []
    const originalLog = console.log
    console.log = (...args: unknown[]) => {
      logs.push(args.join(" "))
    }

    try {
      await deliverMcpConfig({
        targets: ["claude-code", "codex", "pi-agent"],
        dryRun: true,
      })
    } finally {
      console.log = originalLog
    }

    const output = logs.join("\n")
    expect(output).not.toContain("env-secret-value")
    expect(output).not.toContain("header-secret-value")
    expect(output).toContain("+ mcpServers")
    expect(output).toContain("+ mcp_servers")
  })
})
