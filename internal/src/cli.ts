import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { Command } from "commander"
import { mergeConfigs } from "./merge-config/merge.ts"
import { deliverMcpConfig } from "./mcp/deliver.ts"
import { aggregateLlmUsage } from "./llm-usage/aggregate.ts"
import { startDashboardServer } from "./llm-usage/dashboard.ts"
import { deliverPiAgentConfig } from "./pi-agent/deliver.ts"

const VALID_TARGETS = ["claude-code", "claude-desktop", "codex", "pi-agent"] as const
type Target = (typeof VALID_TARGETS)[number]

const DOTFILES_ROOT = path.join(homedir(), ".local/share/chezmoi")

const CONFIG_ENTRIES = [
  {
    source: path.join(DOTFILES_ROOT, "config/claude-settings.json"),
    target: path.join(homedir(), ".claude/settings.json"),
  },
  {
    source: path.join(DOTFILES_ROOT, "config/codex-config.toml"),
    target: path.join(homedir(), ".codex/config.toml"),
  },
] as const

const ALL_TARGETS: readonly Target[] = VALID_TARGETS

const parseTargets = (value: string): readonly Target[] => {
  if (value === "all") return ALL_TARGETS
  const targets = value.split("|")
  const invalid = targets.filter(
    (t): t is string => !VALID_TARGETS.includes(t as Target)
  )
  if (invalid.length > 0) {
    throw new Error(
      `Invalid target(s): ${invalid.join(", ")}. Valid targets: all, ${VALID_TARGETS.join(", ")}`
    )
  }
  return targets as unknown as readonly Target[]
}

const program = new Command()
  .name("internal-cli")
  .description("Internal CLI utilities for dotfiles management")

program
  .command("merge-config")
  .description("Merge managed config files into their targets")
  .option("--dry-run", "Show what would be written without making changes")
  .action(async (opts: { readonly dryRun?: boolean }) => {
    await mergeConfigs({
      entries: CONFIG_ENTRIES,
      dryRun: opts.dryRun ?? false,
    })
  })

const parseProviders = (value: string): readonly string[] =>
  value
    .split(/[|,]/)
    .map((provider) => provider.trim())
    .filter((provider) => provider.length > 0)

const piAgent = program
  .command("pi-agent")
  .description("pi-agent configuration management")

piAgent
  .command("deliver")
  .description("Deliver pi-agent configuration from shared and local parts")
  .option("--dry-run", "Show what would be written without making changes")
  .option(
    "--providers <providers>",
    "Available providers separated by | or , (opencode-go|openai-codex|openrouter|github-copilot)",
    parseProviders
  )
  .action(
    async (opts: {
      readonly dryRun?: boolean
      readonly providers?: readonly string[]
    }) => {
      await deliverPiAgentConfig(
        opts.providers === undefined
          ? { dryRun: opts.dryRun ?? false }
          : {
              dryRun: opts.dryRun ?? false,
              availableProviders: opts.providers,
            }
      )
    }
  )

const LLM_USAGE_ROOT = path.join(DOTFILES_ROOT, "observe", "llm-usage")
const MACHINE_ID_PATH = path.join(LLM_USAGE_ROOT, "state", "machine-id")

const isMachineId = (value: string): boolean => /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value)

const resolveMachineId = async (configured: string | undefined): Promise<string> => {
  if (configured !== undefined) return configured
  try {
    const machineId = (await readFile(MACHINE_ID_PATH, "utf-8")).trim()
    if (machineId.length === 0) throw new Error("empty machine ID")
    return machineId
  } catch {
    throw new Error(`Machine ID is not initialized. Run: node internal/src/cli.ts llm-usage init`)
  }
}

const llmUsage = program.command("llm-usage").description("Aggregate local Pi usage and subscription quota observations")

llmUsage
  .command("init")
  .description("Initialize this machine's stable identifier in ignored state")
  .option("--machine-id <machineId>", "Stable machine identifier (defaults to a generated UUID)")
  .action(async (opts: { readonly machineId?: string }) => {
    const machineId = opts.machineId ?? randomUUID()
    if (!isMachineId(machineId)) {
      throw new Error("machineId must contain only letters, numbers, hyphens, and underscores")
    }
    await mkdir(path.dirname(MACHINE_ID_PATH), { recursive: true, mode: 0o700 })
    await writeFile(MACHINE_ID_PATH, `${machineId}\n`, { encoding: "utf-8", mode: 0o600, flag: "wx" })
    console.log(`Initialized machine ID: ${machineId}`)
  })

llmUsage
  .command("aggregate")
  .description("Aggregate ignored quota observations and Pi session JSONL into committed daily data")
  .option("--machine-id <machineId>", "Override the initialized machine identifier")
  .option("--sessions-dir <path>", "Pi session JSONL directory", path.join(homedir(), ".pi", "agent", "sessions"))
  .action(async (opts: { readonly machineId?: string; readonly sessionsDir: string }) => {
    const machineId = await resolveMachineId(opts.machineId)
    const outputPaths = await aggregateLlmUsage({
      usageRoot: LLM_USAGE_ROOT,
      sessionsRoot: opts.sessionsDir,
      machineId,
    })
    if (outputPaths.length === 0) {
      console.log("No quota observations or Pi usage events found.")
      return
    }
    console.log(`Updated ${outputPaths.length} aggregate file(s):`)
    for (const outputPath of outputPaths) console.log(`  ${outputPath}`)
  })

const parsePort = (value: string): number => {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("port must be an integer from 0 to 65535")
  }
  return port
}

llmUsage
  .command("dashboard")
  .description("Serve a read-only local dashboard for committed LLM usage aggregates")
  .option("--port <port>", "Local loopback port", parsePort, 48_321)
  .action(async (opts: { readonly port: number }) => {
    const dashboard = await startDashboardServer({ usageRoot: LLM_USAGE_ROOT, port: opts.port })
    console.log(`LLM usage dashboard: ${dashboard.url}`)
    console.log("Press Ctrl-C to stop. The server accepts connections only from this machine.")
  })

const mcp = program.command("mcp").description("MCP configuration management")

mcp
  .command("deliver")
  .description("Deliver MCP configuration from template to target platforms")
  .option(
    "--target <targets>",
    "Target platforms separated by | (all|claude-code|claude-desktop|codex|pi-agent)",
    parseTargets,
    ALL_TARGETS
  )
  .option("--dry-run", "Show what would be written without making changes")
  .action(
    async (opts: {
      readonly target: readonly Target[]
      readonly dryRun?: boolean
    }) => {
      await deliverMcpConfig({
        targets: opts.target,
        dryRun: opts.dryRun ?? false,
      })
    }
  )

program.parse()
