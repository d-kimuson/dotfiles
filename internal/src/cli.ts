import { homedir } from "node:os"
import path from "node:path"
import { Command } from "commander"
import { mergeConfigs } from "./merge-config/merge.ts"
import { deliverMcpConfig } from "./mcp/deliver.ts"

const VALID_TARGETS = ["claude-code", "claude-desktop", "codex"] as const
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

const mcp = program.command("mcp").description("MCP configuration management")

mcp
  .command("deliver")
  .description("Deliver MCP configuration from template to target platforms")
  .option(
    "--target <targets>",
    "Target platforms separated by | (all|claude-code|claude-desktop|codex)",
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
