#!/usr/bin/env node
// Claude Code・Codex・Pi・Command Code のセッションログから、期間内に本人が書いたメッセージだけを Markdown で出力する。
// --mark は今回の実行時刻を記録し、次回の既定の開始時刻にする。--agent (複数可: claude, codex, pi, commandcode) で読むログを絞る。
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { parseArgs } from "node:util"
import { zstdDecompressSync } from "node:zlib"

export type Agent = "claude" | "codex" | "pi" | "commandcode"
export type Session = { agent: Agent; path: string; cwd?: string; messages: { at: string; text: string }[] }

// Task Board のカードに付けるセッションの参照 (`<provider> <id>`)。id はログのファイル名の末尾の UUID。
const PROVIDERS: Record<Agent, string> = { claude: "claude-code", codex: "codex", pi: "pi", commandcode: "command-code" }
export const sessionRef = (agent: Agent, path: string): string | undefined => {
  const id = path.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl(\.zst)?$/)?.[1]
  return id === undefined ? undefined : `${PROVIDERS[agent]} ${id}`
}

const DEFAULT_DAYS = 14

const textsOf = (content: unknown): string[] => {
  if (typeof content === "string") return [content]
  if (!Array.isArray(content)) return []
  return content.flatMap((part) =>
    (part?.type === "text" || part?.type === "input_text") && typeof part.text === "string" ? [part.text] : [],
  )
}

// エージェントが差し込む文脈や、別エージェントからの委譲文は本人の発言ではないので除く。slash command は "/name args" に戻す。
export const normalize = (text: string): string | undefined => {
  const command = text.match(/<command-name>(.*?)<\/command-name>/s)
  if (command !== null) {
    const args = text.match(/<command-args>(.*?)<\/command-args>/s)?.[1]?.trim()
    return [command[1]?.trim(), args].filter(Boolean).join(" ")
  }
  const trimmed = text.trim()
  if (trimmed === "" || trimmed.startsWith("<") || trimmed.startsWith("# AGENTS.md instructions")) return undefined
  if (/^(You are working inside Orca|Please carry out this task from my Orca coordinator|This session is being continued from a previous conversation)/.test(trimmed))
    return undefined
  return trimmed
}

export const parseSession = (agent: Agent, path: string, lines: string[]): Session => {
  const session: Session = { agent, path, messages: [] }
  for (const line of lines) {
    let record
    try {
      record = JSON.parse(line)
    } catch {
      continue
    }
    let at: string | undefined
    let texts: string[] = []
    if (agent === "claude") {
      session.cwd ??= record.cwd
      if (record.type === "user" && record.isSidechain !== true && record.isMeta !== true) {
        at = record.timestamp
        texts = textsOf(record.message?.content)
      }
    } else if (agent === "codex") {
      if (record.type === "session_meta") session.cwd ??= record.payload?.cwd
      if (record.type === "response_item" && record.payload?.type === "message" && record.payload.role === "user") {
        at = record.timestamp
        texts = textsOf(record.payload.content)
      }
    } else {
      if (record.type === "session") session.cwd ??= record.cwd
      if (record.type === "message" && record.message?.role === "user") {
        at = record.timestamp
        texts = textsOf(record.message.content)
      }
    }
    if (at === undefined) continue
    for (const text of texts) {
      const normalized = normalize(text)
      // compaction や再送で同じ発言が繰り返し記録されるので、セッション内の重複は最初の 1 件だけ残す。
      if (normalized !== undefined && !session.messages.some((m) => m.text === normalized)) session.messages.push({ at, text: normalized })
    }
  }
  return session
}

const walk = (dir: string): string[] => {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === "subagents" ? [] : walk(path)
    return /\.jsonl(\.zst)?$/.test(entry.name) ? [path] : []
  })
}

export const renderMarkdown = (sessions: Session[], since: string, maxChars: number): string => {
  const out = [`# Session log since ${since}`, ""]
  for (const s of sessions) {
    out.push(`## ${s.agent} · ${s.cwd ?? "?"} · ${s.messages[0]?.at ?? ""}`, "", `log: ${s.path}`, ...(sessionRef(s.agent, s.path) === undefined ? [] : [`session: ${sessionRef(s.agent, s.path)}`]), "")
    for (const m of s.messages) {
      const text = m.text.replace(/\s+/g, " ")
      out.push(`- [${m.at}] ${text.length > maxChars ? `${text.slice(0, maxChars)}…` : text}`)
    }
    out.push("")
  }
  return out.join("\n")
}

const main = (): void => {
  const home = homedir()
  const lastRunPath = join(home, ".agents", "state", "retro", "last-run")
  const { values } = parseArgs({
    options: {
      since: { type: "string" },
      "max-chars": { type: "string", default: "800" },
      mark: { type: "boolean" },
      agent: { type: "string", multiple: true },
    },
  })
  if (values.mark === true) {
    mkdirSync(dirname(lastRunPath), { recursive: true })
    writeFileSync(lastRunPath, `${new Date().toISOString()}\n`)
    console.log(`marked: ${lastRunPath}`)
    return
  }
  const since =
    values.since ??
    (existsSync(lastRunPath)
      ? readFileSync(lastRunPath, "utf8").trim()
      : new Date(Date.now() - DEFAULT_DAYS * 24 * 60 * 60 * 1000).toISOString())
  const sinceMs = Date.parse(since)
  const roots: [Agent, string][] = [
    ["claude", join(home, ".claude", "projects")],
    ["codex", join(home, ".codex", "sessions")],
    ["pi", join(home, ".pi", "agent", "sessions")],
    ["commandcode", join(home, ".commandcode", "projects")],
  ]
  const agents = values.agent
  const sessions = roots
    .filter(([agent]) => agents === undefined || agents.includes(agent))
    .flatMap(([agent, root]) =>
      walk(root)
        .filter((path) => statSync(path).mtimeMs >= sinceMs)
        .map((path) => {
          const raw = readFileSync(path)
          const text = path.endsWith(".zst") ? zstdDecompressSync(raw).toString("utf8") : raw.toString("utf8")
          const session = parseSession(agent, path, text.split("\n"))
          session.messages = session.messages.filter((m) => Date.parse(m.at) >= sinceMs)
          return session
        }),
    )
    .filter((s) => s.messages.length > 0)
    .sort((a, b) => (a.messages[0]?.at ?? "").localeCompare(b.messages[0]?.at ?? ""))
  console.log(renderMarkdown(sessions, since, Number(values["max-chars"])))
}

if (import.meta.main) main()
