import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { parse as parseTOML, stringify as stringifyTOML } from "smol-toml"
import { diffKeyPaths, formatDryRunReport } from "../dry-run/describe-changes.ts"
import { isPlainObject } from "../merge-config/json.ts"

type Target =
  | "claude-code"
  | "claude-desktop"
  | "codex"
  | "pi-agent"
  | "command-code"
  | "opencode"

type McpServerEntry = Readonly<Record<string, unknown>>

type McpTemplate = {
  readonly mcpServers: Readonly<Record<string, McpServerEntry>>
}

type ExpandResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly missing: readonly string[] }

const ALLOWED_LAYERS = ["core", "personal"] as const
type Layer = (typeof ALLOWED_LAYERS)[number]

/** cloud connector で代替できる target。remote な MCP は配らない */
const CONNECTOR_TARGETS: ReadonlySet<Target> = new Set([
  "claude-code",
  "claude-desktop",
  "codex",
])

/** 配布先の MCP 一覧をテンプレートで全置換する target */
const REPLACE_TARGETS: ReadonlySet<Target> = new Set([
  "pi-agent",
  "command-code",
  "opencode",
])

const getTemplatePath = (): string => {
  return path.join(homedir(), ".local/share/chezmoi/config/agent/mcp.template.json")
}

const getTargetConfigPaths = (): Readonly<Record<Target, string>> => {
  return {
    "claude-code": path.join(homedir(), ".claude.json"),
    "claude-desktop": path.join(
      homedir(),
      "Library/Application Support/Claude/claude_desktop_config.json"
    ),
    codex: path.join(homedir(), ".codex/config.toml"),
    "pi-agent": path.join(homedir(), ".pi/agent/mcp.json"),
    "command-code": path.join(homedir(), ".commandcode/mcp.json"),
    opencode: path.join(homedir(), ".config/opencode/opencode.json"),
  }
}

const canWriteTarget = async (filePath: string): Promise<boolean> => {
  const parentDir = path.dirname(filePath)

  try {
    await access(parentDir)
    return true
  } catch {
    return false
  }
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

const parseMcpTemplate = (content: string): McpTemplate => {
  const parsed: unknown = JSON.parse(content)
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("mcpServers" in parsed)
  ) {
    throw new Error("Template must have mcpServers field")
  }
  return parsed as McpTemplate
}

const getEnabledLayers = (): ReadonlySet<Layer> => {
  const raw = process.env["MCP_LAYERS"] ?? "core"
  const layers = raw
    .split(",")
    .map((layer) => layer.trim())
    .filter((layer) => layer.length > 0)
  if (layers.length === 0) return new Set(["core"])
  const invalid = layers.filter(
    (layer): layer is string => !ALLOWED_LAYERS.includes(layer as Layer)
  )
  if (invalid.length > 0) {
    throw new Error(
      `Invalid MCP_LAYERS: ${invalid.join(", ")}. Valid layers: ${ALLOWED_LAYERS.join(", ")}`
    )
  }
  return new Set(layers as readonly Layer[])
}

const getLayer = (name: string, entry: McpServerEntry): Layer => {
  const value = entry["layer"] ?? "core"
  if (
    typeof value !== "string" ||
    !ALLOWED_LAYERS.includes(value as Layer)
  ) {
    throw new Error(
      `Server ${name} has an invalid layer: ${String(value)}. Valid layers: ${ALLOWED_LAYERS.join(", ")}`
    )
  }
  return value as Layer
}

const resolveServers = (
  servers: Readonly<Record<string, McpServerEntry>>
): Record<string, McpServerEntry> => {
  const resolved: Record<string, McpServerEntry> = {}

  for (const [name, entry] of Object.entries(servers)) {
    const requiredEnv = entry["requiresEnv"]
    if (requiredEnv !== undefined) {
      if (
        !Array.isArray(requiredEnv) ||
        !requiredEnv.every((envName): envName is string => typeof envName === "string")
      ) {
        throw new Error(`Server ${name} has invalid requiresEnv`)
      }
      const missing = requiredEnv.filter(
        (envName) => resolveEnvVar(envName) === undefined
      )
      if (missing.length > 0) {
        console.log(`  ⊘ Skipped (requires env not set): ${name}`)
        continue
      }
    }

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

const getDisabledMcps = (): ReadonlySet<string> => {
  const raw = process.env["DISABLE_MCPS"] ?? ""
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  )
}

const readTemplate = async (): Promise<
  Readonly<Record<string, McpServerEntry>>
> => {
  const enabledLayers = getEnabledLayers()
  console.log(`Layers: ${[...enabledLayers].join(", ")}`)

  const content = await readFile(getTemplatePath(), "utf-8")
  const template = parseMcpTemplate(content)
  const selected: Record<string, McpServerEntry> = {}

  for (const [name, entry] of Object.entries(template.mcpServers)) {
    const layer = getLayer(name, entry)
    if (!enabledLayers.has(layer)) {
      console.log(`  ⊘ Layer ${layer} disabled: ${name}`)
      continue
    }
    selected[name] = entry
  }

  const resolved = resolveServers(selected)

  const disabled = getDisabledMcps()
  for (const name of disabled) {
    if (name in resolved) {
      delete resolved[name]
      console.log(`  ⊘ Disabled by DISABLE_MCPS: ${name}`)
    }
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
    console.log(formatDryRunReport(filePath, diffKeyPaths(existing, merged)))
  } else {
    await writeFile(filePath, output, "utf-8")
    console.log(`  Updated: ${filePath}`)
  }
  console.log(`  Merged servers: ${Object.keys(servers).join(", ")}`)
}

/** Convert a Claude Code style entry to Command Code's schema (`type` → `transport`) */
const toCommandCodeEntry = (entry: McpServerEntry): McpServerEntry => {
  const result: Record<string, unknown> = {
    transport: entry["type"] === "http" ? "http" : "stdio",
  }

  for (const key of ["command", "args", "env", "url", "headers", "oauth"] as const) {
    if (key in entry) result[key] = entry[key]
  }

  return result
}

/** Convert a Claude Code style entry to OpenCode's `mcp.servers` schema */
const toOpenCodeEntry = (entry: McpServerEntry): McpServerEntry => {
  if (entry["type"] === "http") {
    const result: Record<string, unknown> = {
      type: "remote",
      url: entry["url"],
    }
    for (const key of ["headers", "oauth", "timeout", "enabled"] as const) {
      if (key in entry) result[key] = entry[key]
    }
    return result
  }

  const command = entry["command"]
  if (typeof command !== "string") {
    throw new Error("OpenCode local MCP requires a command")
  }
  const rawArgs = entry["args"]
  if (
    rawArgs !== undefined &&
    (!Array.isArray(rawArgs) ||
      !rawArgs.every((arg) => typeof arg === "string"))
  ) {
    throw new Error("OpenCode MCP args must be strings")
  }
  const args = Array.isArray(rawArgs) ? (rawArgs as readonly string[]) : []
  const result: Record<string, unknown> = {
    type: "local",
    command: [command, ...args],
  }
  if ("env" in entry) result["environment"] = entry["env"]
  for (const key of ["cwd", "timeout", "enabled"] as const) {
    if (key in entry) result[key] = entry[key]
  }
  return result
}

/**
 * Generated MCP files are replaced, not merged, so servers from other agents
 * or previous delivery do not linger.
 */
const replaceJsonMcpServers = async (
  filePath: string,
  servers: Readonly<Record<string, McpServerEntry>>,
  dryRun: boolean
): Promise<void> => {
  const existing = await readJsonFile(filePath)
  const merged = {
    ...existing,
    mcpServers: servers,
  }

  const output = JSON.stringify(merged, null, 2) + "\n"

  if (dryRun) {
    console.log(formatDryRunReport(filePath, diffKeyPaths(existing, merged)))
  } else {
    await writeFile(filePath, output, "utf-8")
    console.log(`  Updated: ${filePath}`)
  }
  console.log(`  Replaced servers: ${Object.keys(servers).join(", ")}`)
}

const replaceOpenCodeMcpServers = async (
  filePath: string,
  servers: Readonly<Record<string, McpServerEntry>>,
  dryRun: boolean
): Promise<void> => {
  const existing = await readJsonFile(filePath)
  const existingMcp = isPlainObject(existing["mcp"]) ? existing["mcp"] : {}
  const merged = {
    ...existing,
    mcp: { ...existingMcp, servers },
  }

  const output = JSON.stringify(merged, null, 2) + "\n"

  if (dryRun) {
    console.log(formatDryRunReport(filePath, diffKeyPaths(existing, merged)))
  } else {
    await writeFile(filePath, output, "utf-8")
    console.log(`  Updated: ${filePath}`)
  }
  console.log(`  Replaced servers: ${Object.keys(servers).join(", ")}`)
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

/** Convert a Claude Code/Desktop MCP entry to Codex TOML format */
const toCodexEntry = (entry: McpServerEntry): Record<string, unknown> => {
  const result: Record<string, unknown> = {}

  // Copy fields that are shared as-is
  for (const key of ["command", "args", "env", "url"] as const) {
    if (key in entry) result[key] = entry[key]
  }

  // headers → http_headers
  if ("headers" in entry && typeof entry["headers"] === "object") {
    result["http_headers"] = entry["headers"]
  }

  // type is not used in Codex config
  return result
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

  const mergedMcpServers = Object.fromEntries(
    Object.entries(servers).map(([name, config]) => {
      const current = existingMcpServers[name]
      return [
        name,
        {
          ...(typeof current === "object" && current !== null
            ? (current as Record<string, unknown>)
            : {}),
          ...toCodexEntry(config),
        },
      ]
    })
  )

  const merged = {
    ...existing,
    mcp_servers: { ...existingMcpServers, ...mergedMcpServers },
  }
  const output = stringifyTOML(merged) + "\n"

  if (dryRun) {
    console.log(formatDryRunReport(filePath, diffKeyPaths(existing, merged)))
  } else {
    await writeFile(filePath, output, "utf-8")
    console.log(`  Updated: ${filePath}`)
  }
  console.log(`  Merged servers: ${Object.keys(servers).join(", ")}`)
}

/**
 * Convert HTTP servers to mcp-remote stdio for claude-desktop,
 * which does not support the HTTP transport natively.
 */
const toDesktopEntry = (entry: McpServerEntry): McpServerEntry => {
  if (entry["type"] !== "http") return entry

  const url = entry["url"]
  if (typeof url !== "string") return entry

  const headers = entry["headers"]
  const headerArgs =
    typeof headers === "object" && headers !== null
      ? Object.entries(headers as Record<string, string>).flatMap(
          ([key, value]) => ["--header", `${key}:${value}`]
        )
      : []

  return {
    command: "npx",
    args: ["-y", "mcp-remote", url, ...headerArgs],
  }
}

const replaceNpxCommand = (
  entry: McpServerEntry,
  npxPath: string
): McpServerEntry => {
  if (entry["command"] !== "npx") return entry
  return { ...entry, command: npxPath }
}

const toDesktopServers = async (
  servers: Readonly<Record<string, McpServerEntry>>
): Promise<Readonly<Record<string, McpServerEntry>>> => {
  const npxPath = `${homedir()}/.local/share/mise/shims/npx` // Node.js からの which node だと shims が見つかってくれないのでハードコード
  return Object.fromEntries(
    Object.entries(servers).map(([name, entry]) => [
      name,
      replaceNpxCommand(toDesktopEntry(entry), npxPath),
    ])
  )
}

const ensureTargetParentDir = async (target: Target, filePath: string): Promise<void> => {
  if (
    target !== "pi-agent" &&
    target !== "command-code" &&
    target !== "opencode"
  ) {
    return
  }
  await mkdir(path.dirname(filePath), { recursive: true })
}

const filterServersForTarget = (
  target: Target,
  servers: Readonly<Record<string, McpServerEntry>>
): Readonly<Record<string, McpServerEntry>> => {
  const filtered: Record<string, McpServerEntry> = {}

  for (const [name, entry] of Object.entries(servers)) {
    const excludeTargets = entry["excludeTargets"]
    if (Array.isArray(excludeTargets) && excludeTargets.includes(target)) {
      console.log(`  ⊘ Excluded from ${target}: ${name}`)
      continue
    }
    if (entry["remote"] === true && CONNECTOR_TARGETS.has(target)) {
      console.log(`  ⊘ Remote MCP skipped for connector target ${target}: ${name}`)
      continue
    }
    const {
      excludeTargets: _excludeTargets,
      layer: _layer,
      remote: _remote,
      requiresEnv: _requiresEnv,
      ...rest
    } = entry as Record<string, unknown>
    filtered[name] = rest as McpServerEntry
  }

  return filtered
}

const generateForTarget = async (
  target: Target,
  servers: Readonly<Record<string, McpServerEntry>>,
  dryRun: boolean
): Promise<void> => {
  const configPath = getTargetConfigPaths()[target]
  console.log(`\n[${target}] ${configPath}`)

  await ensureTargetParentDir(target, configPath)

  if (!(await canWriteTarget(configPath))) {
    console.log(
      `  Skipped: parent directory does not exist: ${path.dirname(configPath)}`
    )
    return
  }

  const targetServers = filterServersForTarget(target, servers)

  if (Object.keys(targetServers).length === 0) {
    console.log(`  No servers for this target.`)
    if (!REPLACE_TARGETS.has(target)) return
  }

  switch (target) {
    case "claude-code":
      await mergeJsonMcpServers(configPath, targetServers, dryRun)
      break
    case "claude-desktop":
      await mergeJsonMcpServers(
        configPath,
        await toDesktopServers(targetServers),
        dryRun
      )
      break
    case "codex":
      await mergeTomlMcpServers(configPath, targetServers, dryRun)
      break
    case "pi-agent":
      await replaceJsonMcpServers(configPath, targetServers, dryRun)
      break
    case "command-code": {
      const commandCodeServers = Object.fromEntries(
        Object.entries(targetServers).map(([name, entry]) => [
          name,
          toCommandCodeEntry(entry),
        ])
      )
      await replaceJsonMcpServers(configPath, commandCodeServers, dryRun)
      break
    }
    case "opencode": {
      const openCodeServers = Object.fromEntries(
        Object.entries(targetServers).map(([name, entry]) => [
          name,
          toOpenCodeEntry(entry),
        ])
      )
      await replaceOpenCodeMcpServers(configPath, openCodeServers, dryRun)
      break
    }
  }
}

export type DeliverOptions = {
  readonly targets: readonly Target[]
  readonly dryRun: boolean
}

export const deliverMcpConfig = async (
  options: DeliverOptions
): Promise<void> => {
  const targetConfigPaths = getTargetConfigPaths()

  if (options.dryRun) {
    console.log("[dry-run mode]")
  }
  console.log(`Template: ${getTemplatePath()}`)
  console.log(
    `Targets:\n${options.targets.map((t) => `  - [${t}] ${targetConfigPaths[t]}`).join("\n")}`
  )

  const servers = await readTemplate()
  const serverNames = Object.keys(servers)

  if (serverNames.length === 0) {
    console.log("No servers to deliver (all skipped).")
  } else {
    console.log(`Servers: ${serverNames.join(", ")}`)
  }

  for (const target of options.targets) {
    await generateForTarget(target, servers, options.dryRun)
  }

  console.log("\nDone.")
}
