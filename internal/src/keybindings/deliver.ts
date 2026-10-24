import { mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { isPlainObject } from "../merge-config/json.ts"
import { diffKeyPaths, formatDryRunReport } from "../dry-run/describe-changes.ts"

export const KEYBINDING_TARGETS = [
  "claude-code",
  "codex",
  "pi-agent",
  "command-code",
  "opencode",
] as const

export type KeybindingTarget = (typeof KEYBINDING_TARGETS)[number]

type JsonObject = Record<string, unknown>
type Keymap = Readonly<Record<string, readonly string[]>>
type KeyStyle = "enter" | "return" | "codex"

type ClaudeBlock = {
  readonly context: string
  readonly bindings: Record<string, unknown>
}

type CodexBinding = {
  readonly command: string
  readonly key: string | null
}

const ACTION_MAPPINGS: Readonly<
  Record<KeybindingTarget, Readonly<Record<string, string>>>
> = {
  "pi-agent": {
    "editor.cursorUp": "tui.editor.cursorUp",
    "editor.cursorDown": "tui.editor.cursorDown",
    "editor.cursorLeft": "tui.editor.cursorLeft",
    "editor.cursorRight": "tui.editor.cursorRight",
    "editor.lineStart": "tui.editor.cursorLineStart",
    "editor.lineEnd": "tui.editor.cursorLineEnd",
    "editor.newline": "tui.input.newLine",
    "model.cycleForward": "app.model.cycleForward",
    "model.cycleBackward": "app.model.cycleBackward",
  },
  "command-code": {
    "editor.cursorUp": "tui.editor.cursorUp",
    "editor.cursorDown": "tui.editor.cursorDown",
    "editor.cursorLeft": "tui.editor.cursorLeft",
    "editor.cursorRight": "tui.editor.cursorRight",
    "editor.lineStart": "tui.editor.cursorLineStart",
    "editor.lineEnd": "tui.editor.cursorLineEnd",
    "editor.newline": "tui.input.newLine",
  },
  opencode: {
    "editor.cursorUp": "input.move.up",
    "editor.cursorDown": "input.move.down",
    "editor.cursorLeft": "input.move.left",
    "editor.cursorRight": "input.move.right",
    "editor.lineStart": "input.line.home",
    "editor.lineEnd": "input.line.end",
    "editor.newline": "input.newline",
    "model.cycleForward": "model.cycle_recent",
    "model.cycleBackward": "model.cycle_recent_reverse",
    "command.palette": "command.palette.show",
    "history.previous": "prompt.history.previous",
    "history.next": "prompt.history.next",
  },
  "claude-code": {
    "editor.newline": "chat:newline",
    "history.previous": "history:previous",
    "history.next": "history:next",
  },
  codex: {
    "voice.dictationSingleTap": "globalDictationSingleTap",
  },
}

const CLAUDE_ACTION_CONTEXTS: Readonly<Record<string, string>> = {
  "chat:newline": "Chat",
  "history:previous": "Chat",
  "history:next": "Chat",
}

/** Claude Code の既定動作を壊さないよう、target 側で受け付けないキー */
const TARGET_EXCLUDED_KEYS: Partial<
  Readonly<Record<KeybindingTarget, ReadonlySet<string>>>
> = {
  "claude-code": new Set(["ctrl+enter"]),
}

const getSourcePath = (): string =>
  path.join(homedir(), ".local/share/chezmoi/config/agent/keybindings.json")

const getStatePath = (): string =>
  path.join(homedir(), ".local/state/dotfiles/keybindings.json")

const getTargetPaths = (): Readonly<Record<KeybindingTarget, string>> => ({
  "claude-code": path.join(homedir(), ".claude/keybindings.json"),
  codex: path.join(homedir(), ".codex/keybindings.json"),
  "pi-agent": path.join(homedir(), ".pi/agent/keybindings.json"),
  "command-code": path.join(homedir(), ".commandcode/keybindings.json"),
  opencode: path.join(homedir(), ".config/opencode/cli.json"),
})

const parseKeys = (action: string, value: unknown): readonly string[] => {
  if (typeof value === "string") {
    if (value.trim().length === 0) {
      throw new Error(`Keybinding ${action} must not be empty`)
    }
    return [value]
  }
  if (Array.isArray(value)) {
    const keys = value.filter(
      (key): key is string => typeof key === "string" && key.trim().length > 0
    )
    if (keys.length > 0 && keys.length === value.length) return keys
  }
  throw new Error(
    `Keybinding ${action} must be a string or a non-empty array of strings`
  )
}

const parseKeymap = (content: string): Keymap => {
  const parsed: unknown = JSON.parse(content)
  if (!isPlainObject(parsed)) {
    throw new Error("config/agent/keybindings.json must contain a JSON object")
  }
  return Object.fromEntries(
    Object.entries(parsed).map(([action, value]) => [
      action,
      parseKeys(action, value),
    ])
  )
}

const normalizeKey = (key: string, style: KeyStyle): string => {
  if (style === "return") return key.replace(/\benter\b/g, "return")
  if (style === "codex") {
    return key
      .split("+")
      .map((part) => {
        const lower = part.toLowerCase()
        if (lower === "ctrl") return "Ctrl"
        if (lower === "alt") return "Alt"
        if (lower === "shift") return "Shift"
        if (lower === "meta") return "Meta"
        return part.length === 1 ? part.toUpperCase() : part
      })
      .join("+")
  }
  return key
}

const mapActions = (
  keymap: Keymap,
  mapping: Readonly<Record<string, string>>,
  style: KeyStyle,
  excludedKeys?: ReadonlySet<string>
): {
  readonly mapped: Readonly<Record<string, readonly string[]>>
  readonly skipped: readonly string[]
} => {
  const mapped: Record<string, readonly string[]> = {}
  const skipped: string[] = []

  for (const [action, keys] of Object.entries(keymap)) {
    const targetId = mapping[action]
    if (targetId === undefined) {
      skipped.push(action)
      continue
    }
    const acceptedKeys =
      excludedKeys === undefined
        ? keys
        : keys.filter((key) => !excludedKeys.has(key))
    if (acceptedKeys.length === 0) {
      skipped.push(action)
      continue
    }
    mapped[targetId] = acceptedKeys.map((key) => normalizeKey(key, style))
  }

  return { mapped, skipped }
}

const readJsonFile = async (filePath: string): Promise<unknown | null> => {
  try {
    return JSON.parse(await readFile(filePath, "utf-8")) as unknown
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null
    throw err
  }
}

const writeJsonFile = async (
  filePath: string,
  value: unknown
): Promise<void> => {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8")
}

type DeliveryState = Readonly<Record<string, readonly string[]>>

const readState = async (): Promise<DeliveryState> => {
  const statePath = getStatePath()
  const raw = await readJsonFile(statePath)
  if (raw === null) return {}
  if (!isPlainObject(raw)) {
    throw new Error(`${statePath} must contain a JSON object`)
  }
  return Object.fromEntries(
    Object.entries(raw).map(([target, ids]) => {
      if (
        !Array.isArray(ids) ||
        !ids.every((id): id is string => typeof id === "string")
      ) {
        throw new Error(`Invalid delivered keybindings for ${target} in ${statePath}`)
      }
      return [target, ids]
    })
  )
}

const writeState = async (state: DeliveryState): Promise<void> => {
  const sorted = Object.fromEntries(
    Object.entries(state).sort(([a], [b]) => a.localeCompare(b))
  )
  await writeJsonFile(getStatePath(), sorted)
}

const claudeId = (context: string, key: string): string =>
  `${context}\u0000${key}`

const parseClaudeId = (
  id: string
): { readonly context: string; readonly key: string } | null => {
  const [context, key] = id.split("\u0000")
  return context === undefined || key === undefined ? null : { context, key }
}

const report = (
  target: KeybindingTarget,
  filePath: string,
  before: JsonObject,
  after: JsonObject,
  skipped: readonly string[],
  dryRun: boolean
): void => {
  console.log(`\n[${target}] ${filePath}`)
  if (dryRun) {
    console.log(formatDryRunReport(filePath, diffKeyPaths(before, after)))
  } else {
    console.log(`  Updated: ${filePath}`)
  }
  if (skipped.length > 0) {
    console.log(`  No equivalent (${skipped.length}): ${skipped.join(", ")}`)
  }
}

const deliverFlat = async (
  target: "pi-agent" | "command-code",
  filePath: string,
  keymap: Keymap,
  previousIds: readonly string[],
  dryRun: boolean
): Promise<readonly string[]> => {
  const { mapped, skipped } = mapActions(
    keymap,
    ACTION_MAPPINGS[target],
    "enter"
  )
  const existing = await readJsonFile(filePath)
  if (existing !== null && !isPlainObject(existing)) {
    throw new Error(`${filePath} must contain a JSON object`)
  }
  const before = existing ?? {}
  const currentIds = Object.keys(mapped)
  const managed = new Set(currentIds)
  const after: Record<string, unknown> = { ...before }
  for (const id of previousIds) {
    if (!managed.has(id)) delete after[id]
  }
  Object.assign(after, mapped)
  report(target, filePath, before, after, skipped, dryRun)
  if (!dryRun) await writeJsonFile(filePath, after)
  return currentIds
}

const deliverOpenCode = async (
  filePath: string,
  keymap: Keymap,
  previousIds: readonly string[],
  dryRun: boolean
): Promise<readonly string[]> => {
  const { mapped, skipped } = mapActions(
    keymap,
    ACTION_MAPPINGS.opencode,
    "return"
  )
  const existing = await readJsonFile(filePath)
  if (existing !== null && !isPlainObject(existing)) {
    throw new Error(`${filePath} must contain a JSON object`)
  }
  const before = existing ?? {}
  const existingKeybinds = isPlainObject(before["keybinds"])
    ? before["keybinds"]
    : {}
  const currentIds = Object.keys(mapped)
  const managed = new Set(currentIds)
  const keybinds: Record<string, unknown> = { ...existingKeybinds }
  for (const id of previousIds) {
    if (!managed.has(id)) delete keybinds[id]
  }
  for (const [id, keys] of Object.entries(mapped)) {
    keybinds[id] = keys.join(",")
  }
  const after = { ...before, keybinds }
  report("opencode", filePath, before, after, skipped, dryRun)
  if (!dryRun) await writeJsonFile(filePath, after)
  return currentIds
}

const parseClaudeBlocks = (value: unknown, filePath: string): ClaudeBlock[] => {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    throw new Error(`${filePath} has a non-array bindings value`)
  }
  return value.map((block, index) => {
    if (
      !isPlainObject(block) ||
      typeof block["context"] !== "string" ||
      !isPlainObject(block["bindings"])
    ) {
      throw new Error(`Invalid bindings block at index ${index} in ${filePath}`)
    }
    return {
      context: block["context"],
      bindings: { ...block["bindings"] },
    }
  })
}

const deliverClaudeCode = async (
  filePath: string,
  keymap: Keymap,
  previousIds: readonly string[],
  dryRun: boolean
): Promise<readonly string[]> => {
  const { mapped, skipped } = mapActions(
    keymap,
    ACTION_MAPPINGS["claude-code"],
    "enter",
    TARGET_EXCLUDED_KEYS["claude-code"]
  )
  const existing = await readJsonFile(filePath)
  if (existing !== null && !isPlainObject(existing)) {
    throw new Error(`${filePath} must contain a JSON object`)
  }
  const before: JsonObject = existing ?? {
    $schema: "https://www.schemastore.org/claude-code-keybindings.json",
    $docs: "https://code.claude.com/docs/en/keybindings",
    bindings: [],
  }
  const blocks = parseClaudeBlocks(before["bindings"], filePath)

  const current = Object.entries(mapped).flatMap(([action, keys]) => {
    const context = CLAUDE_ACTION_CONTEXTS[action] ?? "Chat"
    return keys.map((key) => ({ context, key, action }))
  })
  const currentIds = current.map(({ context, key }) => claudeId(context, key))
  const managed = new Set(currentIds)

  for (const id of previousIds) {
    if (managed.has(id)) continue
    const parsed = parseClaudeId(id)
    if (parsed === null) continue
    const block = blocks.find(
      (candidate) => candidate.context === parsed.context
    )
    if (block !== undefined) delete block.bindings[parsed.key]
  }

  const populatedBlocks = blocks.filter(
    (block) => Object.keys(block.bindings).length > 0
  )
  for (const { context, key, action } of current) {
    let block = populatedBlocks.find(
      (candidate) => candidate.context === context
    )
    if (block === undefined) {
      block = { context, bindings: {} }
      populatedBlocks.push(block)
    }
    block.bindings[key] = action
  }

  const after: JsonObject = { ...before, bindings: populatedBlocks }
  report("claude-code", filePath, before, after, skipped, dryRun)
  if (!dryRun) await writeJsonFile(filePath, after)
  return currentIds
}

const isCodexBinding = (value: unknown): value is CodexBinding =>
  isPlainObject(value) &&
  typeof value["command"] === "string" &&
  (typeof value["key"] === "string" || value["key"] === null)

const deliverCodex = async (
  filePath: string,
  keymap: Keymap,
  previousIds: readonly string[],
  dryRun: boolean
): Promise<readonly string[]> => {
  const { mapped, skipped } = mapActions(keymap, ACTION_MAPPINGS.codex, "codex")
  const existing = await readJsonFile(filePath)
  if (existing !== null && !Array.isArray(existing)) {
    throw new Error(`${filePath} must contain a JSON array`)
  }
  const existingBindings = (existing ?? []).filter(isCodexBinding)
  const byCommand = new Map(
    existingBindings.map((binding) => [binding.command, binding])
  )

  const currentIds = Object.keys(mapped)
  const managed = new Set(currentIds)
  for (const command of previousIds) {
    if (!managed.has(command)) byCommand.delete(command)
  }

  for (const [command, keys] of Object.entries(mapped)) {
    const key = keys[0]
    if (key === undefined) continue
    if (keys.length > 1) {
      console.warn(
        `  ⚠ Codex supports one key per command; using the first for ${command}`
      )
    }
    byCommand.set(command, { ...byCommand.get(command), command, key })
  }

  const merged = [...byCommand.values()]
  report(
    "codex",
    filePath,
    { bindings: existingBindings },
    { bindings: merged },
    skipped,
    dryRun
  )
  if (!dryRun) await writeJsonFile(filePath, merged)
  return currentIds
}

export type DeliverKeybindingsOptions = {
  readonly targets: readonly KeybindingTarget[]
  readonly dryRun: boolean
}

export const deliverKeybindings = async (
  options: DeliverKeybindingsOptions
): Promise<void> => {
  const sourcePath = getSourcePath()
  if (options.dryRun) console.log("[dry-run mode]")
  console.log(`Source: ${sourcePath}`)
  const keymap = parseKeymap(await readFile(sourcePath, "utf-8"))
  const targetPaths = getTargetPaths()
  const state = await readState()
  const nextState: Record<string, readonly string[]> = { ...state }
  console.log(
    `Targets:\n${options.targets
      .map((target) => `  - [${target}] ${targetPaths[target]}`)
      .join("\n")}`
  )

  for (const target of options.targets) {
    const previousIds = state[target] ?? []
    let currentIds: readonly string[] = []
    switch (target) {
      case "pi-agent":
      case "command-code":
        currentIds = await deliverFlat(
          target,
          targetPaths[target],
          keymap,
          previousIds,
          options.dryRun
        )
        break
      case "opencode":
        currentIds = await deliverOpenCode(
          targetPaths[target],
          keymap,
          previousIds,
          options.dryRun
        )
        break
      case "claude-code":
        currentIds = await deliverClaudeCode(
          targetPaths[target],
          keymap,
          previousIds,
          options.dryRun
        )
        break
      case "codex":
        currentIds = await deliverCodex(
          targetPaths[target],
          keymap,
          previousIds,
          options.dryRun
        )
        break
    }
    if (!options.dryRun) nextState[target] = currentIds
  }

  if (!options.dryRun) await writeState(nextState)
  console.log("\nDone.")
}
