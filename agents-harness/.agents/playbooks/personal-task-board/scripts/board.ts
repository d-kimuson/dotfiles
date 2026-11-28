#!/usr/bin/env node
// Personal Task Board (Claude Artifact) の db `actions` を畳み込んで盤面を出し、カードを変える action を生成する。
import { createHash, randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

export const COLLECTION = "actions"
// カードのコメントは kit の draft (actions) の外に置く。actions の comment はレビューコメント (本人から Agent への指示) になり、反映したら消される。
export const NOTES = "notes"
// カードの属性 (確認が必要・着手可能日・期日・担い手) も kit の外に置く。カードと属性の組ごとに 1 文書で、外すときは文書を消す。
export const ATTRS = "attrs"
export const ATTR_NAMES = ["check", "start", "due", "owner"] as const
// 担い手。未設定のカードは本人 (self) が進めるものとして扱う。
export const OWNERS = ["self", "agent"] as const
export type Owner = (typeof OWNERS)[number]
export type AttrName = (typeof ATTR_NAMES)[number]
// 着手可能日の前に隠すのは、まだ手を付けていない列のカードだけである。
export const DEFERRABLE = ["todo", "backlog"]
// 進行中の列は、担い手で本人のカードと Agent のカードに分けて並べる。
export const SPLIT = "doing"
const TIME_ZONE = "Asia/Tokyo"
export const AUTHOR = { id: "agent:claude-code", name: "Claude Code" }
const BATCH_LIMIT = 50
const BLOCKED_HEADING = "## Pending の理由"
const LEGACY_BLOCKED_HEADING = "## ブロック理由"
const SESSIONS_HEADING = "## セッション"
const LEGACY_STATUS_HEADING = "## 状況"

export const BOARDS = [
  {
    id: "personal-task-board",
    page: "board",
    columns: [
      { id: "todo", label: "Todo", color: "gray" },
      { id: "today", label: "今日やる", color: "amber" },
      { id: "doing", label: "進行中", color: "blue" },
      { id: "blocked", label: "Pending", color: "red" },
      { id: "done", label: "Done", color: "green" },
      { id: "archived", label: "アーカイブ", color: "gray" },
    ],
  },
  {
    id: "personal-learning",
    page: "learning",
    columns: [
      { id: "backlog", label: "バックログ", color: "violet" },
      { id: "done", label: "Done", color: "green" },
      { id: "archived", label: "アーカイブ", color: "gray" },
    ],
  },
] as const
export type BoardId = (typeof BOARDS)[number]["id"]
const DONE = "done"
const BLOCKED = "blocked"
// アーカイブは、ページで隠した列への移動である。action を消さないので、番号もほかのカードも変わらない。
export const ARCHIVED = "archived"

type Link = { url: string; label: string | null }
export type Card = {
  id: string
  number: number
  title: string
  description: string | null
  tags: string[]
  assignee: string | null
  links: Link[]
}
export type Column = { board: BoardId; id: string; label: string; cards: Card[] }
type Target = { type: "element"; id: string }
export type Action = {
  id: string
  type: string
  target: Target
  payload: Record<string, unknown>
  createdAt: string
  author?: { id: string; name?: string }
}
export type Author = { id: string; name?: string }
export type Note = { id: string; board: BoardId; card: string; body: string; author: Author; createdAt: string }
export type ReviewComment = { id: string; board?: BoardId; path: string; body: string; author: Author; createdAt: string }
export type Attr = { id: string; board: BoardId; card: string; attr: AttrName; value: true | string; author: Author; updatedAt: string }
export type Stale = { id: string; type: string }
export type Board = { columns: Column[]; reviews: ReviewComment[]; stale: Stale[] }
const boardOf = (id: string) => BOARDS.find((b) => b.id === id)
// kit と同じく、区切りごとに encodeURIComponent する (commentRef)。
const target = (board: BoardId, path: string): Target => ({
  type: "element",
  id: `${[board, ...path.split("/")].map(encodeURIComponent).join("/")}@${boardOf(board)?.page}`,
})
const decode = (segment: string): string => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
export const parseTarget = (t: Target | undefined): { board: BoardId; path: string } | undefined => {
  for (const b of BOARDS) {
    const prefix = `${b.id}/`
    const suffix = `@${b.page}`
    if (t?.id?.startsWith(prefix) === true && t.id.endsWith(suffix))
      return { board: b.id, path: t.id.slice(prefix.length, -suffix.length).split("/").map(decode).join("/") }
  }
  return undefined
}
// action が触るカード (ADD_CARD は payload の id、ほかは target の card/<id>)。
export const actionCard = (action: Action): { board: BoardId; card: string } | undefined => {
  const t = parseTarget(action.target)
  if (t === undefined) return undefined
  if (action.type === "ADD_CARD") return { board: t.board, card: str(action.payload?.id) }
  return t.path.startsWith("card/") ? { board: t.board, card: t.path.slice(5) } : undefined
}

const isHttp = (url: string): boolean => /^https?:\/\//.test(url)

// 同じチケットの URL が表記ゆれで別のカードにならないよう、host の大小・fragment・末尾の / をそろえる。
export const normalizeKey = (key: string): string => {
  const trimmed = key.trim()
  if (!isHttp(trimmed)) return trimmed
  const url = new URL(trimmed)
  url.hash = ""
  return url.href.replace(/\/+$/, "")
}

// チケットの URL などの同じキーからは、どのセッションでも同じカード id になる。
export const cardId = (key: string): string => `t-${createHash("sha256").update(normalizeKey(key)).digest("hex").slice(0, 12)}`

export const order = (a: Action, b: Action): number =>
  a.createdAt === b.createdAt ? (a.id < b.id ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1

const str = (v: unknown): string => (typeof v === "string" ? v : "")

export const tokyoDate = (now: Date): string => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now)
  const part = (type: string): string => parts.find((p) => p.type === type)?.value ?? ""
  return `${part("year")}-${part("month")}-${part("day")}`
}
export const isDate = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const year = Number(v.slice(0, 4))
  const d = new Date(`${v}T00:00:00Z`)
  return year >= 2000 && year <= 2100 && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}
export const attrId = (board: string, card: string, attr: AttrName): string => `${board}~${card}~${attr}`
export const isAttr = (a: Partial<Attr>): a is Attr =>
  typeof a.board === "string" &&
  typeof a.card === "string" &&
  ATTR_NAMES.includes(a.attr as AttrName) &&
  a.id === attrId(a.board, a.card, a.attr as AttrName) &&
  (a.attr === "check" ? a.value === true : a.attr === "owner" ? OWNERS.includes(a.value as Owner) : isDate(a.value)) &&
  typeof a.author?.id === "string" &&
  typeof a.updatedAt === "string"
export type CardAttrs = { check: boolean; start?: string; due?: string; owner?: Owner }
export const attrsOf = (attrs: Attr[], board: string, card: string): CardAttrs => {
  const result: CardAttrs = { check: false }
  for (const a of attrs) {
    if (a.board !== board || a.card !== card) continue
    if (a.attr === "check") result.check = true
    else if (a.attr === "owner") result.owner = a.value as Owner
    else result[a.attr] = a.value as string
  }
  return result
}
export const isDeferred = (column: string, attrs: CardAttrs, today: string): boolean =>
  DEFERRABLE.includes(column) && attrs.start !== undefined && attrs.start > today

// dev-process-kit の Kanban と同じ規則で replay する。適用できない action は stale に入れて飛ばす。
export const fold = (actions: Action[]): Board => {
  const columns: Column[] = BOARDS.flatMap((b) => b.columns.map((c) => ({ board: b.id, id: c.id, label: c.label, cards: [] as Card[] })))
  const reviews: ReviewComment[] = []
  const stale: Stale[] = []
  const locate = (board: BoardId, id: string): { column: Column; index: number; card: Card } | undefined => {
    for (const column of columns.filter((c) => c.board === board)) {
      const index = column.cards.findIndex((c) => c.id === id)
      const card = column.cards[index]
      if (card !== undefined) return { column, index, card }
    }
    return undefined
  }
  const numbers = (board: BoardId): number[] => columns.filter((c) => c.board === board).flatMap((c) => c.cards.map((x) => x.number))

  for (const action of [...actions].sort(order)) {
    const t = parseTarget(action.target)
    const p = action.payload ?? {}
    const apply = (): boolean => {
      if (action.type === "comment") {
        const path = t === undefined ? str(action.target?.id) : t.path
        reviews.push({ id: action.id, ...(t === undefined ? {} : { board: t.board }), path, body: str(p.body), author: action.author ?? { id: "" }, createdAt: action.createdAt })
        return true
      }
      if (t === undefined) return false
      if (action.type === "ADD_CARD") {
        const column = columns.find((c) => c.board === t.board && `column/${c.id}` === t.path)
        const id = str(p.id)
        const title = str(p.title).trim()
        const number = typeof p.number === "number" ? p.number : Math.max(0, ...numbers(t.board)) + 1
        if (column === undefined || title === "" || locate(t.board, id) !== undefined) return false
        if (numbers(t.board).includes(number)) return false
        column.cards.push({ id, number, title, description: null, tags: [], assignee: null, links: [] })
        return true
      }
      if (!t.path.startsWith("card/")) return false
      const found = locate(t.board, t.path.slice(5))
      if (found === undefined) return false
      const { card } = found
      switch (action.type) {
        case "MOVE_CARD": {
          const to = columns.find((c) => c.board === t.board && c.id === str(p.column))
          const before = p.before === null || p.before === undefined ? null : str(p.before)
          if (to === undefined || before === card.id) return false
          if (before !== null && !to.cards.some((c) => c.id === before)) return false
          found.column.cards.splice(found.index, 1)
          const at = before === null ? -1 : to.cards.findIndex((c) => c.id === before)
          if (at === -1) to.cards.push(card)
          else to.cards.splice(at, 0, card)
          return true
        }
        case "SET_CARD_TITLE": {
          const title = str(p.title).trim()
          if (title === "") return false
          card.title = title
          return true
        }
        case "SET_CARD_DESCRIPTION":
          card.description = str(p.description) === "" ? null : str(p.description)
          return true
        case "SET_CARD_ASSIGNEE":
          card.assignee = str(p.assignee).trim() === "" ? null : str(p.assignee).trim()
          return true
        case "ADD_CARD_TAG": {
          const tag = str(p.tag).trim()
          if (tag === "" || card.tags.includes(tag)) return false
          card.tags.push(tag)
          return true
        }
        case "REMOVE_CARD_TAG": {
          const index = card.tags.indexOf(str(p.tag))
          if (index === -1) return false
          card.tags.splice(index, 1)
          return true
        }
        case "ADD_CARD_LINK": {
          const url = str(p.url)
          if (!isHttp(url) || card.links.some((l) => l.url === url)) return false
          card.links.push({ url, label: str(p.label) === "" ? null : str(p.label) })
          return true
        }
        case "REMOVE_CARD_LINK": {
          const index = card.links.findIndex((l) => l.url === str(p.url))
          if (index === -1) return false
          card.links.splice(index, 1)
          return true
        }
        default:
          return false
      }
    }
    if (!apply()) stale.push({ id: action.id, type: action.type })
  }
  return { columns, reviews, stale }
}

export const findCard = (board: Board, id: string): { board: BoardId; column: string; card: Card } | undefined => {
  for (const column of board.columns) {
    const card = column.cards.find((c) => c.id === id)
    if (card !== undefined) return { board: column.board, column: column.id, card }
  }
  return undefined
}

// description は「説明」「## Pending の理由」「## セッション」の 3 節。前の形式の「## 状況」節は migrate だけが落とし、「## ブロック理由」節は Pending の理由として読む。
export type Description = { detail: string; blocked: string; sessions: string[] }
export const parseDescription = (description: string | null, options: { dropLegacy?: boolean } = {}): Description => {
  const sections: Record<string, string[]> = { detail: [], blocked: [], sessions: [], legacy: [] }
  let current = "detail"
  for (const line of (description ?? "").split("\n")) {
    const heading = line.trim()
    if (heading === BLOCKED_HEADING || heading === LEGACY_BLOCKED_HEADING) current = "blocked"
    else if (heading === SESSIONS_HEADING) current = "sessions"
    else if (options.dropLegacy === true && heading === LEGACY_STATUS_HEADING) current = "legacy"
    else if (/^#{1,6} /.test(heading)) {
      // 本人が書いた見出しの節は、原文のまま説明に残す。
      current = "detail"
      sections.detail?.push(line)
    } else if (current === "sessions" && heading !== "" && !isSessionLine(heading)) sections.detail?.push(line)
    else sections[current]?.push(line)
  }
  return {
    detail: (sections.detail ?? []).join("\n").trim(),
    blocked: (sections.blocked ?? []).join("\n").trim(),
    sessions: (sections.sessions ?? []).map((l) => l.trim().replace(/^- /, "")).filter((l) => l !== ""),
  }
}
export const formatDescription = (d: Description): string =>
  [
    d.detail,
    d.blocked === "" ? "" : `${BLOCKED_HEADING}\n${d.blocked}`,
    d.sessions.length === 0 ? "" : `${SESSIONS_HEADING}\n${d.sessions.map((s) => `- ${s}`).join("\n")}`,
  ]
    .filter((s) => s !== "")
    .join("\n\n")

// セッションの参照: web は claude.ai のセッション URL をリンクに、ローカルは `<provider> <session-id>` を description に置く。
export const PROVIDERS = ["claude-code", "pi", "codex", "command-code"] as const
const SESSION_URL = /^https:\/\/claude\.ai\/code\/session_[A-Za-z0-9_-]+$/
const isSessionLine = (line: string): boolean => new RegExp(`^- (${PROVIDERS.join("|")}) \\S+$`).test(line)
export const checkSession = (ref: string): string => {
  const trimmed = ref.trim()
  if (SESSION_URL.test(trimmed)) return trimmed
  const [provider, id, ...rest] = trimmed.split(/\s+/)
  if (rest.length > 0 || id === undefined || !(PROVIDERS as readonly string[]).includes(provider ?? ""))
    throw new Error(`session は https://claude.ai/code/session_… か "<provider> <id>" (provider: ${PROVIDERS.join(", ")}): ${ref}`)
  return `${provider} ${id}`
}

// いまのセッションの参照を環境変数から出す。どのセッションか分からなければ undefined。
export const sessionFromEnv = (env: Record<string, string | undefined>): string | undefined => {
  if (env.CLAUDE_CODE_REMOTE === "true" && env.CLAUDE_CODE_REMOTE_SESSION_ID)
    return `https://claude.ai/code/${env.CLAUDE_CODE_REMOTE_SESSION_ID.replace(/^cse_/, "session_")}`
  if (env.CLAUDE_CODE_SESSION_ID) return `claude-code ${env.CLAUDE_CODE_SESSION_ID}`
  if (env.CODEX_THREAD_ID) return `codex ${env.CODEX_THREAD_ID}`
  if (env.PI_SESSION_ID) return `pi ${env.PI_SESSION_ID}`
  const scratchpad = env.COMMANDCODE_SCRATCHPAD?.split("/").filter((x) => x !== "")
  if (scratchpad !== undefined && scratchpad.length >= 2) return `command-code ${scratchpad.at(-2)}`
  return undefined
}

type CardRef = { card?: string; key?: string }
export type Intent =
  | ({
      op: "add"
      key: string
      board?: BoardId
      column: string
      title: string
      detail?: string
      reason?: string
      tags?: string[]
      links?: { url: string; label?: string }[]
      sessions?: string[]
      start?: string
      due?: string
      owner?: Owner
    })
  | ({ op: "move"; column: string; reason?: string } & CardRef)
  | ({ op: "detail"; text: string } & CardRef)
  | ({ op: "link"; url: string; label?: string } & CardRef)
  | ({ op: "session"; session: string } & CardRef)
  | ({ op: "comment"; text: string } & CardRef)
  | ({ op: "check"; on: boolean; text?: string; if_version?: number } & CardRef)
  | ({ op: "start" | "due"; date: string | null; if_version?: number } & CardRef)
  | ({ op: "owner"; who: Owner | null; if_version?: number } & CardRef)
  | { op: "archive"; board?: BoardId }

export type AttrWrite = { op: "set"; attr: Attr; if_version?: number } | { op: "delete"; doc_id: string; if_version: number }
export type PlanResult = { actions: Action[]; notes: Note[]; attrs: AttrWrite[]; skipped: string[] }

export const plan = (
  actions: Action[],
  intents: Intent[],
  options: { writer: string; now: Date; attrs?: Attr[] },
): PlanResult => {
  const created: Action[] = []
  const notes: Note[] = []
  const attrWrites: AttrWrite[] = []
  // dump にある属性と、この plan で書く属性。同じ plan で同じ属性を 2 回書くと、2 回目の version が分からない。
  const current = new Map((options.attrs ?? []).map((a) => [a.id, a]))
  const planned = new Set<string>()
  const skipped: string[] = []
  // 書き手の時計が遅れていても、読んだ action より後に再生させる。
  const latest = Math.max(0, ...actions.map((a) => Date.parse(a.createdAt)).filter((t) => !Number.isNaN(t)))
  const base = Math.max(options.now.getTime(), latest + 1)
  const next = (): { id: string; createdAt: string } => {
    const seq = created.length + notes.length
    return { id: `${options.writer}:${String(seq + 1).padStart(3, "0")}`, createdAt: new Date(base + seq).toISOString() }
  }
  const emit = (board: BoardId, type: string, path: string, payload: Record<string, unknown>): void => {
    created.push({ ...next(), type, target: target(board, path), payload, author: AUTHOR })
  }
  const checkColumn = (board: BoardId, column: string): void => {
    const ids: string[] = boardOf(board)?.columns.map((c) => c.id).filter((c) => c !== ARCHIVED) ?? []
    if (!ids.includes(column)) throw new Error(`unknown column of ${board}: ${column} (${ids.join(", ")}。アーカイブは op "archive")`)
  }
  const checkBoard = (board: string): BoardId => {
    const found = BOARDS.find((b) => b.id === board)
    if (found === undefined) throw new Error(`unknown board: ${board} (${BOARDS.map((b) => b.id).join(", ")})`)
    return found.id
  }
  const linkPayload = (url: string, label: string | undefined): Record<string, unknown> =>
    label === undefined || label.trim() === "" ? { url } : { url, label: label.trim() }
  const needReason = (column: string, reason: string | undefined, label: string): void => {
    if (column === BLOCKED && (reason === undefined || reason.trim() === "")) throw new Error(`${label}: blocked へは reason (何を待っているか) が要る`)
  }
  const writeAttr = (board: BoardId, card: string, attr: AttrName, value: Attr["value"] | null, ifVersion: number | undefined): boolean => {
    const id = attrId(board, card, attr)
    if (planned.has(id)) throw new Error(`${attr} ${card}: 同じ plan で同じ属性を 2 回変えない`)
    const existing = current.get(id)
    if (existing === undefined && value === null) return false
    if (existing !== undefined && existing.value === value) return false
    if (existing !== undefined && ifVersion === undefined)
      throw new Error(`${attr} ${card}: ${ATTRS}/${id} がある。ArtifactData get (collection "${ATTRS}") で version を読み、intent に if_version を付けて plan し直す`)
    planned.add(id)
    if (value === null) {
      attrWrites.push({ op: "delete", doc_id: id, if_version: ifVersion as number })
      current.delete(id)
      return true
    }
    const doc: Attr = { id, board, card, attr, value, author: AUTHOR, updatedAt: new Date(base + created.length + notes.length + attrWrites.length).toISOString() }
    attrWrites.push(existing === undefined ? { op: "set", attr: doc } : { op: "set", attr: doc, if_version: ifVersion })
    current.set(id, doc)
    return true
  }
  const checkDate = (date: unknown, label: string): string | null => {
    if (date === null) return null
    if (!isDate(date)) throw new Error(`${label}: date は Asia/Tokyo の暦日 YYYY-MM-DD か null (${String(date)})`)
    return date
  }
  const checkOwner = (who: unknown, label: string): Owner | null => {
    if (who === null) return null
    if (!OWNERS.includes(who as Owner)) throw new Error(`${label}: who は ${OWNERS.join(" か ")} か null (${String(who)})`)
    return who as Owner
  }
  const OPS = ["add", "move", "detail", "link", "session", "comment", "check", "start", "due", "owner", "archive"]
  for (const intent of intents) {
    if (!OPS.includes(intent.op)) throw new Error(`unknown op: ${String(intent.op)} (${OPS.join(", ")})`)
    if (intent.op === "comment" && (typeof intent.text !== "string" || intent.text.trim() === "")) throw new Error("comment: text が空")
    if (intent.op === "check" && typeof intent.on !== "boolean") throw new Error("check: on は true か false")
    if (intent.op === "check" && intent.on && (typeof intent.text !== "string" || intent.text.trim() === "")) throw new Error("check: 立てるときは text (何を確かめてほしいか) が要る")
    if (intent.op === "start" || intent.op === "due") checkDate(intent.date, intent.op)
    if (intent.op === "owner") checkOwner(intent.who, "owner")
    if (intent.op === "add") {
      if (intent.start !== undefined) checkDate(intent.start, "add start")
      if (intent.due !== undefined) checkDate(intent.due, "add due")
      if (intent.owner !== undefined) checkOwner(intent.owner, "add owner")
    }
    const board = fold([...actions, ...created])
    if (intent.op === "archive") {
      if (intent.board !== undefined) checkBoard(intent.board)
      const done = board.columns.filter((c) => c.id === DONE && (intent.board === undefined || c.board === intent.board))
      for (const column of done)
        for (const card of column.cards) {
          // 本人の確認を待つカードは、確認が済むまで Done に残す。
          if (current.has(attrId(column.board, card.id, "check"))) skipped.push(`archive ${card.id}: 確認が必要なので残す`)
          else emit(column.board, "MOVE_CARD", `card/${card.id}`, { column: ARCHIVED, before: null })
        }
      continue
    }
    const id = intent.op === "add" ? cardId(intent.key) : (intent.card ?? (intent.key === undefined ? "" : cardId(intent.key)))
    const found = findCard(board, id)
    if (intent.op === "add") {
      if (found !== undefined) {
        skipped.push(`add ${id}: 既にある (${found.column}: ${found.card.title})`)
        continue
      }
      const b = checkBoard(intent.board ?? "personal-task-board")
      checkColumn(b, intent.column)
      needReason(intent.column, intent.reason, `add ${id}`)
      const sessions = (intent.sessions ?? []).map(checkSession)
      // number は付けない。番号は再生の順に決まるので、同時に足したカードの番号は重ならない。
      emit(b, "ADD_CARD", `column/${intent.column}`, { id, title: intent.title })
      const description = formatDescription({
        detail: intent.detail?.trim() ?? "",
        blocked: intent.column === BLOCKED ? (intent.reason?.trim() ?? "") : "",
        sessions: sessions.filter((s) => !isHttp(s)),
      })
      if (description !== "") emit(b, "SET_CARD_DESCRIPTION", `card/${id}`, { description })
      for (const tag of intent.tags ?? []) emit(b, "ADD_CARD_TAG", `card/${id}`, { tag })
      const links = [...(intent.links ?? []), ...sessions.filter(isHttp).map((url) => ({ url, label: "session" }))]
      for (const link of links)
        emit(b, "ADD_CARD_LINK", `card/${id}`, linkPayload(link.url, link.label))
      if (intent.start !== undefined) writeAttr(b, id, "start", checkDate(intent.start, `add ${id} start`), undefined)
      if (intent.due !== undefined) writeAttr(b, id, "due", checkDate(intent.due, `add ${id} due`), undefined)
      if (intent.owner !== undefined) writeAttr(b, id, "owner", checkOwner(intent.owner, `add ${id} owner`), undefined)
      continue
    }
    if (found === undefined) {
      skipped.push(`${intent.op} ${id}: カードが無い`)
      continue
    }
    const b = found.board
    const desc = parseDescription(found.card.description)
    const setDescription = (next: Description): void => {
      const text = formatDescription(next)
      if (text !== (found.card.description ?? "")) emit(b, "SET_CARD_DESCRIPTION", `card/${id}`, { description: text })
    }
    const addLink = (url: string, label: string | undefined): void => {
      if (found.card.links.some((l) => l.url === url)) skipped.push(`${intent.op} ${id}: 既にある ${url}`)
      else emit(b, "ADD_CARD_LINK", `card/${id}`, linkPayload(url, label))
    }
    if (intent.op === "move") {
      checkColumn(b, intent.column)
      needReason(intent.column, intent.reason, `move ${id}`)
      if (intent.column !== found.column) emit(b, "MOVE_CARD", `card/${id}`, { column: intent.column, before: null })
      setDescription({ ...desc, blocked: intent.column === BLOCKED ? (intent.reason?.trim() ?? "") : "" })
    } else if (intent.op === "detail") {
      setDescription({ ...desc, detail: [desc.detail, intent.text.trim()].filter((s) => s !== "").join("\n\n") })
    } else if (intent.op === "link") {
      addLink(intent.url, intent.label)
    } else if (intent.op === "comment") {
      const { id: noteId, createdAt } = next()
      notes.push({ id: noteId, board: b, card: id, body: intent.text.trim(), author: AUTHOR, createdAt })
    } else if (intent.op === "check") {
      if (!writeAttr(b, id, "check", intent.on ? true : null, intent.if_version)) skipped.push(`check ${id}: 既に ${intent.on ? "立っている" : "下りている"}`)
      if (intent.on) {
        const { id: noteId, createdAt } = next()
        notes.push({ id: noteId, board: b, card: id, body: `確認が必要: ${(intent.text ?? "").trim()}`, author: AUTHOR, createdAt })
      }
    } else if (intent.op === "start" || intent.op === "due") {
      const date = checkDate(intent.date, `${intent.op} ${id}`)
      if (!writeAttr(b, id, intent.op, date, intent.if_version)) skipped.push(`${intent.op} ${id}: 既に ${date ?? "未設定"}`)
    } else if (intent.op === "owner") {
      const who = checkOwner(intent.who, `owner ${id}`)
      if (!writeAttr(b, id, "owner", who, intent.if_version)) skipped.push(`owner ${id}: 既に ${who ?? "未設定"}`)
    } else if (intent.op === "session") {
      const ref = checkSession(intent.session)
      if (isHttp(ref)) addLink(ref, "session")
      else if (desc.sessions.includes(ref)) skipped.push(`session ${id}: 既にある ${ref}`)
      else setDescription({ ...desc, sessions: [...desc.sessions, ref] })
    }
  }
  return { actions: created, notes, attrs: attrWrites, skipped }
}

// 前の形式からの移行: description の「## 状況」節を落とし、「## ブロック理由」節を「## Pending の理由」にする。Pending のカードは最後の状況の行を理由にする。
export const planMigration = (actions: Action[], options: { writer: string; now: Date }): Action[] => {
  const latest = Math.max(0, ...actions.map((a) => Date.parse(a.createdAt)).filter((t) => !Number.isNaN(t)))
  const base = Math.max(options.now.getTime(), latest + 1)
  const created: Action[] = []
  for (const column of fold(actions).columns) {
    for (const card of column.cards) {
      const lines = (card.description ?? "").split("\n")
      if (!lines.some((l) => l.trim() === LEGACY_STATUS_HEADING || l.trim() === LEGACY_BLOCKED_HEADING)) continue
      const desc = parseDescription(card.description, { dropLegacy: true })
      const lastStatus = lines.filter((l) => /^- \d{4}-\d{2}-\d{2} \d{2}:\d{2}Z /.test(l.trim())).at(-1)
      const blocked = column.id === BLOCKED && desc.blocked === "" ? (lastStatus?.trim().replace(/^- \S+ \S+ /, "") ?? "") : desc.blocked
      const seq = created.length
      created.push({
        id: `${options.writer}:${String(seq + 1).padStart(3, "0")}`,
        type: "SET_CARD_DESCRIPTION",
        target: target(column.board, `card/${card.id}`),
        payload: { description: formatDescription({ ...desc, blocked }) },
        createdAt: new Date(base + seq).toISOString(),
        author: AUTHOR,
      })
    }
  }
  return created
}

const isAgent = (author: Author | undefined): boolean => author?.id?.startsWith("agent:") === true

// 前の形式からの移行: Agent が actions に書いたカードへの comment を、同じ id の note に写して action を消す。
export const planNoteMigration = (actions: Action[], notes: Note[]): { notes: Note[]; deletes: string[]; skipped: string[] } => {
  const existing = new Set(notes.map((n) => n.id))
  const result = { notes: [] as Note[], deletes: [] as string[], skipped: [] as string[] }
  for (const action of [...actions].sort(order)) {
    if (action.type !== "comment" || !isAgent(action.author)) continue
    const t = parseTarget(action.target)
    if (t === undefined || !t.path.startsWith("card/")) {
      result.skipped.push(`${action.id}: カード宛てでない (${action.target?.id})`)
      continue
    }
    if (!existing.has(action.id))
      result.notes.push({ id: action.id, board: t.board, card: t.path.slice("card/".length), body: str(action.payload?.body), author: action.author ?? AUTHOR, createdAt: action.createdAt })
    result.deletes.push(action.id)
  }
  return result
}

// 読み違えた dump を空の盤面として扱うと、既存のカードを積み直すので、空の盤面は明示されたときだけ許す。
export const readActions = (dumpDir: string, options: { allowEmpty?: boolean } = {}): Action[] => {
  const dir = join(dumpDir, COLLECTION)
  if (!existsSync(dir)) {
    if (options.allowEmpty === true) return []
    throw new Error(`${dir} が無い。ArtifactData list の out_dir を渡す。盤面が空なら --empty を付ける`)
  }
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Action)
}

export const readAttrs = (dumpDir: string): Attr[] => {
  const dir = join(dumpDir, ATTRS)
  if (!existsSync(dir)) return []
  const attrs: Attr[] = []
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const a = JSON.parse(readFileSync(join(dir, f), "utf8")) as Partial<Attr>
    if (isAttr(a)) attrs.push(a)
    else console.error(`skip attr: ${f} の形が崩れている`)
  }
  return attrs
}

export const readNotes = (dumpDir: string): Note[] => {
  const dir = join(dumpDir, NOTES)
  if (!existsSync(dir)) return []
  const notes: Note[] = []
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const n = JSON.parse(readFileSync(join(dir, f), "utf8")) as Partial<Note>
    // ページの閲覧者は誰でも notes に書けるので、形の崩れた文書は飛ばして盤面を読めるようにする。
    if (typeof n.id === "string" && typeof n.board === "string" && typeof n.card === "string" && typeof n.body === "string" && typeof n.createdAt === "string" && typeof n.author?.id === "string")
      notes.push(n as Note)
    else console.error(`skip note: ${f} の形が崩れている`)
  }
  return notes
}

const byTime = (a: { createdAt: string; id: string }, b: { createdAt: string; id: string }): number =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
const authorLabel = (author: Author): string => author.name ?? (isAgent(author) ? author.id : "本人")

const commentLines = (head: string, body: string, indent: string): string[] =>
  body.split("\n").map((line, i) => (i === 0 ? `${head}${line}` : `${indent}${line}`))

const OWNER_LABEL: Record<Owner, string> = { self: "自分", agent: "Agent" }
const attrLabel = (column: string, a: CardAttrs, today: string): string => {
  const marks: string[] = []
  if (a.check) marks.push("確認が必要")
  if (a.owner !== undefined) marks.push(`担い手 ${OWNER_LABEL[a.owner]}`)
  if (a.start !== undefined && a.start > today) marks.push(`着手可能 ${a.start}${DEFERRABLE.includes(column) ? ", ページでは隠れる" : ""}`)
  if (a.due !== undefined) {
    const open = column !== DONE && column !== ARCHIVED
    marks.push(`期日 ${a.due}${open && a.due < today ? " 超過" : open && a.due === today ? " 今日" : ""}`)
  }
  return marks.length === 0 ? "" : ` (${marks.join(", ")})`
}

export const renderBoard = (board: Board, notes: Note[], options: { archived?: boolean; attrs?: Attr[]; today?: string } = {}): string => {
  const lines: string[] = []
  const sorted = [...notes].sort(byTime)
  const attrs = options.attrs ?? []
  const today = options.today ?? tokyoDate(new Date())
  lines.push(`今日 (Asia/Tokyo): ${today}`)
  for (const b of BOARDS) {
    lines.push(`# ${b.id}`)
    for (const column of board.columns.filter((c) => c.board === b.id && (options.archived === true || c.id !== ARCHIVED))) {
      lines.push(`## ${column.label} (${column.id}) ${column.cards.length}`)
      for (const card of column.cards) {
        const links = card.links.map((l) => l.url).join(" ")
        const tags = card.tags.length === 0 ? "" : ` [${card.tags.join(", ")}]`
        const marks = attrLabel(column.id, attrsOf(attrs, b.id, card.id), today)
        lines.push(`- TASK-${card.number} ${card.id} ${card.title}${tags}${marks}${links === "" ? "" : ` ${links}`}`)
        for (const line of (card.description ?? "").split("\n")) if (line.trim() !== "") lines.push(`    ${line}`)
        for (const n of sorted.filter((x) => x.board === b.id && x.card === card.id))
          lines.push(...commentLines(`    > ${n.createdAt} ${authorLabel(n.author)}: `, n.body, "    >   "))
      }
    }
  }
  const cardIds = new Set(board.columns.flatMap((c) => c.cards.map((x) => `${c.board}/${x.id}`)))
  if (options.archived !== true) for (const c of board.columns.filter((x) => x.id === ARCHIVED)) if (c.cards.length > 0) lines.push(`(${c.board} のアーカイブ ${c.cards.length} 枚は --archived で出す)`)
  const orphans = sorted.filter((n) => !cardIds.has(`${n.board}/${n.card}`))
  if (orphans.length > 0) {
    lines.push("## カードの無いコメント")
    for (const n of orphans) lines.push(...commentLines(`- ${n.board}/${n.card} ${n.createdAt} ${authorLabel(n.author)}: `, n.body, "    "))
  }
  const lostAttrs = attrs.filter((a) => !cardIds.has(`${a.board}/${a.card}`)).sort((x, y) => (x.id < y.id ? -1 : 1))
  if (lostAttrs.length > 0) {
    lines.push("## カードの無い属性")
    for (const a of lostAttrs) lines.push(`- ${a.id} ${a.value === true ? "確認が必要" : String(a.value)}`)
  }
  const section = (heading: string, reviews: ReviewComment[]): void => {
    if (reviews.length === 0) return
    lines.push(heading)
    for (const r of [...reviews].sort(byTime))
      lines.push(...commentLines(`- ${r.id} ${r.board === undefined ? "" : `${r.board}/`}${r.path} ${r.createdAt} ${authorLabel(r.author)}: `, r.body, "    "))
  }
  section("## レビューコメント (本人から Agent への指示)", board.reviews.filter((r) => !isAgent(r.author)))
  section("## Agent が actions に書いたコメント (カード宛ては `board.ts migrate-notes` で notes へ移す)", board.reviews.filter((r) => isAgent(r.author)))
  if (board.stale.length > 0) lines.push(`\n適用できなかった action: ${board.stale.map((s) => `${s.id}(${s.type})`).join(", ")}`)
  return lines.join("\n")
}

const usage = `usage:
  board.ts show <dump-dir> [--json] [--empty] [--archived]
                                          盤面を表示する (<dump-dir>/actions/*.json を畳み込み、<dump-dir>/notes/*.json をカードのコメント、
                                          <dump-dir>/attrs/*.json をカードの属性として出す)。
                                          --empty は <dump-dir>/actions が無いときに空の盤面として扱う。
                                          --archived はアーカイブしたカードも出す
  board.ts id <key>                       キー (チケット URL など) からカード id を出す
  board.ts session                        いまのセッションの参照を環境変数から出す
  board.ts plan <dump-dir> <intents.json> <out-dir> [--empty]
                                          intents から action を生成し、ArtifactData batch 1 回分ずつの writes の配列を出力する
  board.ts archive <dump-dir> <out-dir> [<board>]
                                          Done 列のカードをアーカイブする writes の配列を出力する。<board> を省くと全盤面
  board.ts migrate <dump-dir> <out-dir>   description の前の形式 (「## 状況」「## ブロック理由」) を直す writes の配列を出力する
  board.ts migrate-notes <dump-dir> <out-dir>
                                          Agent が actions に書いたカードのコメントを notes へ移す writes の配列を出力する`

const toBatches = <T>(writes: T[]): T[][] => {
  const batches: T[][] = []
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) batches.push(writes.slice(i, i + BATCH_LIMIT))
  return batches
}
type Write =
  | { op: "set"; collection: string; doc_id: string; file_path: string; if_version?: number }
  | { op: "delete"; collection: string; doc_id: string; if_version: number }
const sets = (outDir: string, collection: string, docs: { id: string }[]): Write[] => {
  mkdirSync(outDir, { recursive: true })
  return docs.map((d) => {
    const file = resolve(outDir, `${collection}_${d.id.replace(/[:~]/g, "_")}.json`)
    writeFileSync(file, `${JSON.stringify(d, null, 2)}\n`)
    return { op: "set", collection, doc_id: d.id, file_path: file }
  })
}
const attrWrites = (outDir: string, writes: AttrWrite[]): Write[] =>
  writes.map((w) => {
    if (w.op === "delete") return { op: "delete", collection: ATTRS, doc_id: w.doc_id, if_version: w.if_version }
    const [set] = sets(outDir, ATTRS, [w.attr]) as [Write]
    return w.if_version === undefined ? set : { ...set, if_version: w.if_version }
  })
const output = (writes: Write[]): void => console.log(JSON.stringify(toBatches(writes), null, 2))
const writerId = (): string => `cc-${randomBytes(6).toString("hex")}`

const main = (argv: string[]): void => {
  const flags = ["--empty", "--json", "--archived"]
  const allowEmpty = argv.includes("--empty")
  const [command, ...rest] = argv.filter((a) => !flags.includes(a))
  if (command === "show" && rest[0] !== undefined) {
    const board = fold(readActions(rest[0], { allowEmpty }))
    const notes = readNotes(rest[0])
    const attrs = readAttrs(rest[0])
    const today = tokyoDate(new Date())
    console.log(
      argv.includes("--json")
        ? JSON.stringify({ ...board, notes, attrs, today }, null, 2)
        : renderBoard(board, notes, { archived: argv.includes("--archived"), attrs, today }),
    )
    return
  }
  if (command === "id" && rest[0] !== undefined) {
    console.log(cardId(rest[0]))
    return
  }
  if (command === "session") {
    const ref = sessionFromEnv(process.env)
    if (ref === undefined) {
      console.error("セッションを見分ける環境変数が無い")
      process.exit(1)
    }
    console.log(ref)
    return
  }
  const [dumpDir, second, third] = rest
  if (command === "plan" && dumpDir !== undefined && second !== undefined && third !== undefined) {
    const intents = JSON.parse(readFileSync(second, "utf8")) as Intent[]
    const result = plan(readActions(dumpDir, { allowEmpty }), intents, { writer: writerId(), now: new Date(), attrs: readAttrs(dumpDir) })
    for (const s of result.skipped) console.error(`skip: ${s}`)
    output([...sets(third, COLLECTION, result.actions), ...sets(third, NOTES, result.notes), ...attrWrites(third, result.attrs)])
    return
  }
  if (command === "archive" && dumpDir !== undefined && second !== undefined) {
    const board = BOARDS.find((b) => b.id === third)?.id
    if (third !== undefined && board === undefined) throw new Error(`unknown board: ${third} (${BOARDS.map((b) => b.id).join(", ")})`)
    const actions = readActions(dumpDir)
    const result = plan(actions, [board === undefined ? { op: "archive" } : { op: "archive", board }], { writer: writerId(), now: new Date(), attrs: readAttrs(dumpDir) })
    for (const s of result.skipped) console.error(`skip: ${s}`)
    const after = fold([...actions, ...result.actions])
    for (const a of result.actions) {
      const found = findCard(after, parseTarget(a.target)?.path.slice("card/".length) ?? "")
      console.error(`archive: TASK-${found?.card.number} ${found?.card.id} ${found?.card.title}`)
    }
    output(sets(second, COLLECTION, result.actions))
    return
  }
  if (command === "migrate" && dumpDir !== undefined && second !== undefined) {
    output(sets(second, COLLECTION, planMigration(readActions(dumpDir), { writer: writerId(), now: new Date() })))
    return
  }
  if (command === "migrate-notes" && dumpDir !== undefined && second !== undefined) {
    const result = planNoteMigration(readActions(dumpDir), readNotes(dumpDir))
    for (const s of result.skipped) console.error(`skip: ${s}`)
    // note を書いてから action を消す。途中で止まっても再実行で続きから移る。
    const deletes: Write[] = result.deletes.map((id) => ({ op: "delete", collection: COLLECTION, doc_id: id, if_version: 1 }))
    output([...sets(second, NOTES, result.notes), ...deletes])
    return
  }
  console.error(usage)
  process.exit(2)
}

const entry = process.argv[1]
if (entry !== undefined && import.meta.url === pathToFileURL(realpathSync(entry)).href) main(process.argv.slice(2))
