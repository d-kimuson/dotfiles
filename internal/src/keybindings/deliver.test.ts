import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { deliverKeybindings } from "./deliver.ts"

let homeDir = ""

const sourcePath = (): string =>
  path.join(homeDir, ".local/share/chezmoi/config/agent/keybindings.json")

const readJson = async (filePath: string): Promise<unknown> =>
  JSON.parse(await readFile(filePath, "utf-8")) as unknown

const writeSource = async (keymap: Record<string, unknown>): Promise<void> => {
  const filePath = sourcePath()
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(keymap, null, 2), "utf-8")
}

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf-8")
}

const keymap = {
  "editor.cursorUp": ["up", "ctrl+p"],
  "editor.cursorDown": ["down", "ctrl+n"],
  "editor.newline": ["shift+enter", "ctrl+enter", "ctrl+j"],
  "command.palette": ["ctrl+k"],
  "history.previous": ["up", "ctrl+p"],
  "voice.dictationSingleTap": ["ctrl+m"],
}

beforeEach(async () => {
  homeDir = await mkdtemp(path.join(tmpdir(), "deliver-keybindings-test-"))
  process.env["HOME"] = homeDir
  await writeSource(keymap)
  vi.spyOn(console, "log").mockImplementation(() => undefined)
  vi.spyOn(console, "warn").mockImplementation(() => undefined)
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(homeDir, { recursive: true, force: true })
})

describe("deliverKeybindings", () => {
  it("writes pi-agent bindings and preserves unknown keys", async () => {
    const target = path.join(homeDir, ".pi/agent/keybindings.json")
    await writeJson(target, { "app.custom": ["ctrl+x"] })

    await deliverKeybindings({ targets: ["pi-agent"], dryRun: false })

    expect(await readJson(target)).toEqual({
      "app.custom": ["ctrl+x"],
      "tui.editor.cursorUp": ["up", "ctrl+p"],
      "tui.editor.cursorDown": ["down", "ctrl+n"],
      "tui.input.newLine": ["shift+enter", "ctrl+enter", "ctrl+j"],
    })
  })

  it("converts bindings to OpenCode cli.json keybinds", async () => {
    const target = path.join(homeDir, ".config/opencode/cli.json")
    await writeJson(target, {
      $schema: "https://opencode.ai/config.json",
      keybinds: { "app.exit": "ctrl+c" },
    })

    await deliverKeybindings({ targets: ["opencode"], dryRun: false })

    expect(await readJson(target)).toEqual({
      $schema: "https://opencode.ai/config.json",
      keybinds: {
        "app.exit": "ctrl+c",
        "input.move.up": "up,ctrl+p",
        "input.move.down": "down,ctrl+n",
        "input.newline": "shift+return,ctrl+return,ctrl+j",
        "command.palette.show": "ctrl+k",
        "prompt.history.previous": "up,ctrl+p",
      },
    })
  })

  it("creates Claude Code bindings under the Chat context", async () => {
    const target = path.join(homeDir, ".claude/keybindings.json")

    await deliverKeybindings({ targets: ["claude-code"], dryRun: false })

    expect(await readJson(target)).toEqual({
      $schema: "https://www.schemastore.org/claude-code-keybindings.json",
      $docs: "https://code.claude.com/docs/en/keybindings",
      bindings: [
        {
          context: "Chat",
          bindings: {
            "shift+enter": "chat:newline",
            "ctrl+j": "chat:newline",
            up: "history:previous",
            "ctrl+p": "history:previous",
          },
        },
      ],
    })
  })

  it("updates Codex command entries and preserves other commands", async () => {
    const target = path.join(homeDir, ".codex/keybindings.json")
    await writeJson(target, [
      { command: "globalDictationHold", key: null },
      { command: "globalDictationSingleTap", key: "Ctrl+Shift+M" },
      { command: "realtimeVoice", key: null },
    ])

    await deliverKeybindings({ targets: ["codex"], dryRun: false })

    expect(await readJson(target)).toEqual([
      { command: "globalDictationHold", key: null },
      { command: "globalDictationSingleTap", key: "Ctrl+M" },
      { command: "realtimeVoice", key: null },
    ])
  })

  it("removes keys that are no longer in the source", async () => {
    const target = path.join(homeDir, ".pi/agent/keybindings.json")

    await deliverKeybindings({ targets: ["pi-agent"], dryRun: false })
    expect(await readJson(target)).toHaveProperty("tui.editor.cursorUp")

    await writeSource({ "editor.cursorDown": ["down"] })
    await deliverKeybindings({ targets: ["pi-agent"], dryRun: false })

    expect(await readJson(target)).toEqual({
      "tui.editor.cursorDown": ["down"],
    })
  })

  it("does not write files in dry-run mode", async () => {
    const target = path.join(homeDir, ".commandcode/keybindings.json")

    await deliverKeybindings({ targets: ["command-code"], dryRun: true })

    await expect(readFile(target, "utf-8")).rejects.toThrow()
  })
})
