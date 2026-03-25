import { readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { parse as parseTOML, stringify as stringifyTOML } from "smol-toml"

const TEMPLATE_PATH = path.join(
  homedir(),
  ".local/share/chezmoi/config/mcp.template.json"
)

type Target = "claude-code" | "claude-desktop" | "codex"

type McpServerEntry = Readonly<Record<string, unknown>>

type McpTemplate = {
  readonly mcpServers: Readonly<Record<string, McpServerEntry>>
}

type ExpandResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly missing: readonly string[] }

const TARGET_CONFIG_PATHS: Readonly<Record<Target, string>> = {
  "claude-code": path.join(homedir(), ".claude.json"),
  "claude-desktop": path.join(
    homedir(),
    "Library/Application Support/Claude/claude_desktop_config.json"
  ),
  codex: path.join(homedir(), ".codex/config.toml"),
}

const collectEnvVarRefs = (obj: unknown): readonly string[] => {
  if (typeof obj === "string") {
    const matches = obj.matchAll(/\$\{(\w+)\}/g)
    return [...matches].map((m) => m[1] ?? "")
  }
  if (Array.isArray(obj)) return obj.flatMap(collectEnvVarRefs)
  if (typeof obj === "object" && obj !== null) {
    return Object.values(obj).flatMap(collectEnvVarRefs)
  }
  return []
}

const resolveEnvVar = (name: string): string | undefined => {
  if (name === "HOME") return homedir()
  return process.env[name]
}

const expandEnvVarsDeep = (obj: unknown): ExpandResult => {
  const refs = collectEnvVarRefs(obj)
  const missing = refs.filter((name) => resolveEnvVar(name) === undefined)

  if (missing.length > 0) {
    return { ok: false, missing: [...new Set(missing)] }
  }

  const expand = (value: unknown): unknown => {
    if (typeof value === "string") {
      return value.replace(
        /\$\{(\w+)\}/g,
        (_, name: string) => resolveEnvVar(name) ?? ""
      )
    }
    if (Array.isArray(value)) return value.map(expand)
    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, expand(v)])
      )
    }
    return value
  }

  return { ok: true, value: expand(obj) }
}

const readTemplate = async (): Promise<
  Readonly<Record<string, McpServerEntry>>
> => {
  const content = await readFile(TEMPLATE_PATH, "utf-8")
  const parsed: unknown = JSON.parse(content)
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("mcpServers" in parsed)
  ) {
    throw new Error("Template must have mcpServers field")
  }
  const template = parsed as McpTemplate
  const resolved: Record<string, McpServerEntry> = {}

  for (const [name, entry] of Object.entries(template.mcpServers)) {
    const result = expandEnvVarsDeep(entry)
    if (!result.ok) {
      console.warn(
        `  ⚠ Skipping server "${name}": undefined env vars: ${result.missing.join(", ")}`
      )
      continue
    }
    resolved[name] = result.value as McpServerEntry
  }

  return resolved
}

const readJsonFile = async (
  filePath: string
): Promise<Record<string, unknown>> => {
  try {
    const content = await readFile(filePath, "utf-8")
    return JSON.parse(content) as Record<string, unknown>
  } catch {
    return {}
  }
}

const mergeJsonMcpServers = async (
  filePath: string,
  servers: Readonly<Record<string, McpServerEntry>>,
  dryRun: boolean
): Promise<void> => {
  const existing = await readJsonFile(filePath)
  const existingServers =
    typeof existing["mcpServers"] === "object" &&
    existing["mcpServers"] !== null
      ? (existing["mcpServers"] as Record<string, unknown>)
      : {}

  const merged = {
    ...existing,
    mcpServers: { ...existingServers, ...servers },
  }

  const output = JSON.stringify(merged, null, 2) + "\n"

  if (dryRun) {
    console.log(`  [dry-run] Would write to: ${filePath}`)
    console.log(output)
  } else {
    await writeFile(filePath, output, "utf-8")
    console.log(`  Updated: ${filePath}`)
  }
  console.log(`  Merged servers: ${Object.keys(servers).join(", ")}`)
}

const readTomlFile = async (
  filePath: string
): Promise<Record<string, unknown>> => {
  try {
    const content = await readFile(filePath, "utf-8")
    return parseTOML(content) as Record<string, unknown>
  } catch {
    return {}
  }
}

const mergeTomlMcpServers = async (
  filePath: string,
  servers: Readonly<Record<string, McpServerEntry>>,
  dryRun: boolean
): Promise<void> => {
  const existing = await readTomlFile(filePath)
  const existingMcpServers =
    typeof existing["mcp_servers"] === "object" &&
    existing["mcp_servers"] !== null
      ? (existing["mcp_servers"] as Record<string, unknown>)
      : {}

  const added: string[] = []
  for (const [name, config] of Object.entries(servers)) {
    if (name in existingMcpServers) {
      console.log(`  Skipped (already exists): ${name}`)
      continue
    }
    existingMcpServers[name] = config
    added.push(name)
  }

  if (added.length === 0) return

  const merged = { ...existing, mcp_servers: existingMcpServers }
  const output = stringifyTOML(merged) + "\n"

  if (dryRun) {
    console.log(`  [dry-run] Would write to: ${filePath}`)
    console.log(output)
  } else {
    await writeFile(filePath, output, "utf-8")
    console.log(`  Updated: ${filePath}`)
  }
  console.log(`  Added servers: ${added.join(", ")}`)
}

const generateForTarget = async (
  target: Target,
  servers: Readonly<Record<string, McpServerEntry>>,
  dryRun: boolean
): Promise<void> => {
  const configPath = TARGET_CONFIG_PATHS[target]
  console.log(`\n[${target}] ${configPath}`)

  switch (target) {
    case "claude-code":
    case "claude-desktop":
      await mergeJsonMcpServers(configPath, servers, dryRun)
      break
    case "codex":
      await mergeTomlMcpServers(configPath, servers, dryRun)
      break
  }
}

export type GenerateOptions = {
  readonly targets: readonly Target[]
  readonly dryRun: boolean
}

export const generateMcpConfig = async (
  options: GenerateOptions
): Promise<void> => {
  if (options.dryRun) {
    console.log("[dry-run mode]")
  }
  console.log(`Template: ${TEMPLATE_PATH}`)
  console.log(
    `Targets:\n${options.targets.map((t) => `  - [${t}] ${TARGET_CONFIG_PATHS[t]}`).join("\n")}`
  )

  const servers = await readTemplate()
  const serverNames = Object.keys(servers)

  if (serverNames.length === 0) {
    console.log("No servers to generate (all skipped).")
    return
  }

  console.log(`Servers: ${serverNames.join(", ")}`)

  for (const target of options.targets) {
    await generateForTarget(target, servers, options.dryRun)
  }

  console.log("\nDone.")
}
