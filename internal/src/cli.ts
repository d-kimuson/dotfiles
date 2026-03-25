import { Command } from "commander"
import { generateMcpConfig } from "./mcp/generate.ts"

const VALID_TARGETS = ["claude-code", "claude-desktop", "codex"] as const
type Target = (typeof VALID_TARGETS)[number]

const parseTargets = (value: string): readonly Target[] => {
  const targets = value.split("|")
  const invalid = targets.filter(
    (t): t is string => !VALID_TARGETS.includes(t as Target)
  )
  if (invalid.length > 0) {
    throw new Error(
      `Invalid target(s): ${invalid.join(", ")}. Valid targets: ${VALID_TARGETS.join(", ")}`
    )
  }
  return targets as unknown as readonly Target[]
}

const program = new Command()
  .name("internal-cli")
  .description("Internal CLI utilities for dotfiles management")

const mcp = program.command("mcp").description("MCP configuration management")

mcp
  .command("generate")
  .description("Generate MCP configuration from template")
  .requiredOption(
    "--target <targets>",
    "Target platforms separated by | (claude-code|claude-desktop|codex)",
    parseTargets
  )
  .option("--dry-run", "Show what would be written without making changes")
  .action(
    async (opts: {
      readonly target: readonly Target[]
      readonly dryRun?: boolean
    }) => {
      await generateMcpConfig({
        targets: opts.target,
        dryRun: opts.dryRun ?? false,
      })
    }
  )

program.parse()
