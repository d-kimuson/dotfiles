import { describe, it, expect } from "vitest"
import { listReplacedHooks, mergeHookEvents, parseHookEvents, type HookEvents } from "./hooks.ts"

const command = (cmd: string) => ({ type: "command", command: cmd })

const languageGuard = command("~/.claude/hooks/mise-shims.sh ~/.claude/hooks/language-guard/hook.mts")
const oldLanguageGuard = command("~/.claude/hooks/language-guard/hook.mts")
const herdr = command("bash ~/.claude/hooks/herdr-agent-state.sh session")
const afplay = command("afplay /System/Library/Sounds/Glass.aiff")

describe("mergeHookEvents", () => {
  it("replaces the events the source has when there is no previous delivery", () => {
    const source: HookEvents = { Stop: [{ hooks: [languageGuard] }] }
    const target: HookEvents = {
      Stop: [{ hooks: [oldLanguageGuard] }, { hooks: [herdr] }],
      SessionStart: [{ hooks: [herdr] }],
    }

    expect(mergeHookEvents({ source, target, previous: null })).toEqual({
      Stop: [{ hooks: [languageGuard] }],
      SessionStart: [{ hooks: [herdr] }],
    })
  })

  it("keeps hooks registered by external tools in events the source manages", () => {
    const source: HookEvents = { SessionStart: [{ hooks: [command("~/.claude/hooks/mise-shims.sh")] }] }
    const target: HookEvents = { SessionStart: [{ hooks: [herdr] }] }

    expect(mergeHookEvents({ source, target, previous: {} })).toEqual({
      SessionStart: [
        { hooks: [command("~/.claude/hooks/mise-shims.sh")] },
        { hooks: [herdr] },
      ],
    })
  })

  it("keeps events that only the target has", () => {
    const source: HookEvents = { Stop: [{ hooks: [languageGuard] }] }
    const target: HookEvents = { Notification: [{ matcher: "", hooks: [afplay] }] }

    expect(mergeHookEvents({ source, target, previous: {} })).toEqual({
      Stop: [{ hooks: [languageGuard] }],
      Notification: [{ matcher: "", hooks: [afplay] }],
    })
  })

  it("does not duplicate hooks the target already has from the source", () => {
    const source: HookEvents = { Stop: [{ hooks: [languageGuard] }] }

    expect(mergeHookEvents({ source, target: source, previous: source })).toEqual(source)
  })

  it("drops hooks that a previous delivery added and the source no longer has", () => {
    const source: HookEvents = { Stop: [{ hooks: [languageGuard] }] }
    const previous: HookEvents = {
      Stop: [{ hooks: [oldLanguageGuard] }],
      PreCompact: [{ hooks: [command("~/.claude/hooks/removed.sh")] }],
    }

    expect(mergeHookEvents({ source, target: previous, previous })).toEqual(source)
  })

  it("strips delivered hooks from a group an external tool appended to", () => {
    const source: HookEvents = { Stop: [{ hooks: [languageGuard] }] }
    const target: HookEvents = { Stop: [{ hooks: [languageGuard, herdr] }] }

    expect(mergeHookEvents({ source, target, previous: source })).toEqual({
      Stop: [{ hooks: [languageGuard] }, { hooks: [herdr] }],
    })
  })
})

describe("mergeHookEvents (handler identity)", () => {
  it("treats a delivered hook edited in the target as delivered, not external", () => {
    const source: HookEvents = { Stop: [{ hooks: [languageGuard] }] }
    const target: HookEvents = { Stop: [{ hooks: [{ ...languageGuard, timeout: 30 }] }] }

    expect(mergeHookEvents({ source, target, previous: source })).toEqual(source)
  })
})

describe("listReplacedHooks", () => {
  it("lists target hooks in the events the source replaces", () => {
    const source: HookEvents = { Stop: [{ hooks: [languageGuard] }] }
    const target: HookEvents = {
      Stop: [{ hooks: [languageGuard, herdr] }],
      Notification: [{ hooks: [afplay] }],
    }

    expect(listReplacedHooks({ source, target })).toEqual([{ event: "Stop", hook: herdr }])
  })
})

describe("parseHookEvents", () => {
  it("treats a missing hooks key as no events", () => {
    expect(parseHookEvents(undefined, "settings.json")).toEqual({})
  })

  it("rejects an event whose groups have no hooks array", () => {
    expect(() => parseHookEvents({ Stop: [{ matcher: "" }] }, "settings.json")).toThrow(
      "hooks.Stop in settings.json"
    )
  })
})
