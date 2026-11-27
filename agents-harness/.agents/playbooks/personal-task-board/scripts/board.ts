#!/usr/bin/env node
// Personal Task Board (Claude Artifact) の db `actions` を畳み込んで盤面を出し、カードを変える action を生成する。
import { createHash, randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

export const BOARD_ID = "personal-task-board"
const PAGE = "board"
export const COLLECTION = "actions"
export const AUTHOR = { id: "agent:claude-code", name: "Claude Code" }
const STATUS_HEADING = "## 状況"
const BATCH_LIMIT = 50

export const COLUMNS = [
  { id: "todo", label: "ToDo", color: "gray" },
  { id: "doing", label: "作業中", color: "blue" },
  { id: "blocked", label: "ブロック中", color: "red" },
  { id: "done", label: "完了", color: "green" },
  { id: "learning-backlog", label: "学習バックログ", color: "violet" },
] as const

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
export type Column = { id: string; label: string; cards: Card[] }
type Target = { type: "element"; id: string }
export type Action = {
  id: string
  type: string
  target: Target
  payload: Record<string, unknown>
  createdAt: string
  author?: { id: string; name?: string }
}
export type Comment = { card: string; body: string; author: string; createdAt: string }
export type Board = { columns: Column[]; comments: Comment[]; stale: { id: string; type: string }[] }

const target = (path: string): Target => ({ type: "element", id: `${BOARD_ID}/${path}@${PAGE}` })
const targetPath = (t: Target): string | undefined => {
  const prefix = `${BOARD_ID}/`
  const suffix = `@${PAGE}`
  return t.id.startsWith(prefix) && t.id.endsWith(suffix) ? t.id.slice(prefix.length, -suffix.length) : undefined
}

// チケットの URL などの同じキーからは、どのセッションでも同じカード id になる。
const isHttp = (url: string): boolean => /^https?:\/\//.test(url)

// 同じチケットの URL が表記ゆれで別のカードにならないよう、host の大小・fragment・末尾の / をそろえる。
export const normalizeKey = (key: string): string => {
  const trimmed = key.trim()
  if (!isHttp(trimmed)) return trimmed
  const url = new URL(trimmed)
  url.hash = ""
  return url.href.replace(/\/+$/, "")
}

export const cardId = (key: string): string => `t-${createHash("sha256").update(normalizeKey(key)).digest("hex").slice(0, 12)}`

const order = (a: Action, b: Action): number =>
  a.createdAt === b.createdAt ? (a.id < b.id ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1

const str = (v: unknown): string => (typeof v === "string" ? v : "")

// dev-process-kit の Kanban と同じ規則で replay する。適用できない action は stale に入れて飛ばす。
export const fold = (actions: Action[]): Board => {
  const columns: Column[] = COLUMNS.map((c) => ({ id: c.id, label: c.label, cards: [] }))
  const comments: Comment[] = []
  const stale: Board["stale"] = []
  const findCard = (id: string): { column: Column; index: number; card: Card } | undefined => {
    for (const column of columns) {
      const index = column.cards.findIndex((c) => c.id === id)
      const card = column.cards[index]
      if (card !== undefined) return { column, index, card }
    }
    return undefined
  }
  const nextNumber = (): number => Math.max(0, ...columns.flatMap((c) => c.cards.map((x) => x.number))) + 1

  for (const action of [...actions].sort(order)) {
    const path = targetPath(action.target)
    const p = action.payload
    const apply = (): boolean => {
      if (action.type === "comment") {
        const id = path === undefined ? str(action.target?.id) : path.startsWith("card/") ? path.slice(5) : path
        comments.push({ card: id, body: str(p.body), author: action.author?.id ?? "", createdAt: action.createdAt })
        return true
      }
      if (path === undefined) return false
      if (action.type === "ADD_CARD") {
        const column = columns.find((c) => `column/${c.id}` === path)
        const id = str(p.id)
        const title = str(p.title).trim()
        const number = typeof p.number === "number" ? p.number : nextNumber()
        if (column === undefined || title === "" || findCard(id) !== undefined) return false
        if (columns.some((c) => c.cards.some((x) => x.number === number))) return false
        column.cards.push({ id, number, title, description: null, tags: [], assignee: null, links: [] })
        return true
      }
      if (!path.startsWith("card/")) return false
      const found = findCard(path.slice(5))
      if (found === undefined) return false
      const { card } = found
      switch (action.type) {
        case "MOVE_CARD": {
          const to = columns.find((c) => c.id === str(p.column))
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
  return { columns, comments, stale }
}

export const findCard = (board: Board, id: string): { column: string; card: Card } | undefined => {
  for (const column of board.columns) {
    const card = column.cards.find((c) => c.id === id)
    if (card !== undefined) return { column: column.id, card }
  }
  return undefined
}

// description は「詳細」と「## 状況」節に分ける。状況は日時つきの行を足していく。
const splitDescription = (description: string | null): { detail: string; status: string[] } => {
  const lines = (description ?? "").split("\n")
  const at = lines.map((l) => l.trim()).lastIndexOf(STATUS_HEADING)
  if (at === -1) return { detail: lines.join("\n").trim(), status: [] }
  const status = lines
    .slice(at + 1)
    .map((l) => l.trim())
    .filter((l) => l !== "")
  return { detail: lines.slice(0, at).join("\n").trim(), status }
}
const joinDescription = (detail: string, status: string[]): string =>
  [detail, status.length === 0 ? "" : `${STATUS_HEADING}\n${status.join("\n")}`].filter((s) => s !== "").join("\n\n")

export type Intent =
  | {
      op: "add"
      key: string
      column: string
      title: string
      detail?: string
      note?: string
      tags?: string[]
      links?: { url: string; label?: string }[]
    }
  | { op: "status"; card?: string; key?: string; column?: string; note: string }
  | { op: "detail"; card?: string; key?: string; text: string }
  | { op: "link"; card?: string; key?: string; url: string; label?: string }

export type PlanResult = { actions: Action[]; skipped: string[] }

export const plan = (actions: Action[], intents: Intent[], options: { writer: string; now: Date }): PlanResult => {
  const created: Action[] = []
  const skipped: string[] = []
  const stamp = options.now.toISOString()
  const day = `${stamp.slice(0, 10)} ${stamp.slice(11, 16)}Z`
  // 書き手の時計が遅れていても、読んだ action より後に再生させる。
  const latest = Math.max(0, ...actions.map((a) => Date.parse(a.createdAt)).filter((t) => !Number.isNaN(t)))
  const base = Math.max(options.now.getTime(), latest + 1)
  const emit = (type: string, path: string, payload: Record<string, unknown>): void => {
    const seq = created.length
    const createdAt = new Date(base + seq).toISOString()
    created.push({ id: `${options.writer}:${String(seq + 1).padStart(3, "0")}`, type, target: target(path), payload, createdAt, author: AUTHOR })
  }
  const columnIds: string[] = COLUMNS.map((c) => c.id)
  for (const intent of intents) {
    const board = fold([...actions, ...created])
    const id = intent.op === "add" ? cardId(intent.key) : (intent.card ?? (intent.key === undefined ? "" : cardId(intent.key)))
    const found = findCard(board, id)
    if (intent.op === "add") {
      if (found !== undefined) {
        skipped.push(`add ${id}: 既にある (${found.column}: ${found.card.title})`)
        continue
      }
      if (!columnIds.includes(intent.column)) throw new Error(`unknown column: ${intent.column} (${columnIds.join(", ")})`)
      emit("ADD_CARD", `column/${intent.column}`, { id, title: intent.title })
      const status = intent.note === undefined ? [] : [`- ${day} ${intent.note}`]
      const description = joinDescription(intent.detail?.trim() ?? "", status)
      if (description !== "") emit("SET_CARD_DESCRIPTION", `card/${id}`, { description })
      for (const tag of intent.tags ?? []) emit("ADD_CARD_TAG", `card/${id}`, { tag })
      for (const link of intent.links ?? [])
        emit("ADD_CARD_LINK", `card/${id}`, link.label === undefined ? { url: link.url } : { url: link.url, label: link.label })
      continue
    }
    if (found === undefined) {
      skipped.push(`${intent.op} ${id}: カードが無い`)
      continue
    }
    const { detail, status } = splitDescription(found.card.description)
    if (intent.op === "status") {
      if (intent.column !== undefined && intent.column !== found.column) {
        if (!columnIds.includes(intent.column)) throw new Error(`unknown column: ${intent.column} (${columnIds.join(", ")})`)
        emit("MOVE_CARD", `card/${id}`, { column: intent.column, before: null })
      }
      emit("SET_CARD_DESCRIPTION", `card/${id}`, { description: joinDescription(detail, [...status, `- ${day} ${intent.note}`]) })
    } else if (intent.op === "detail") {
      const next = [detail, intent.text.trim()].filter((s) => s !== "").join("\n\n")
      emit("SET_CARD_DESCRIPTION", `card/${id}`, { description: joinDescription(next, status) })
    } else if (found.card.links.some((l) => l.url === intent.url)) {
      skipped.push(`link ${id}: 既にある ${intent.url}`)
    } else {
      emit("ADD_CARD_LINK", `card/${id}`, intent.label === undefined ? { url: intent.url } : { url: intent.url, label: intent.label })
    }
  }
  return { actions: created, skipped }
}

// 読み違えた dump を空の盤面として扱うと、既存のカードを積み直して状況の履歴を消すので、空の盤面は明示されたときだけ許す。
export const readActions = (dumpDir: string, options: { allowEmpty?: boolean } = {}): Action[] => {
  const dir = join(dumpDir, COLLECTION)
  if (!existsSync(dir)) {
    if (options.allowEmpty === true) return []
    throw new Error(`${dir} が無い。ArtifactData list の out_dir を渡す。盤面が空なら --empty を付ける`)
  }
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"))
  return files.map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Action)
}

export const renderBoard = (board: Board): string => {
  const lines: string[] = []
  for (const column of board.columns) {
    lines.push(`## ${column.label} (${column.id}) ${column.cards.length}`)
    for (const card of column.cards) {
      const links = card.links.map((l) => l.url).join(" ")
      const tags = card.tags.length === 0 ? "" : ` [${card.tags.join(", ")}]`
      lines.push(`- TASK-${card.number} ${card.id} ${card.title}${tags}${links === "" ? "" : ` ${links}`}`)
      for (const line of (card.description ?? "").split("\n")) if (line.trim() !== "") lines.push(`    ${line}`)
      for (const c of board.comments.filter((x) => x.card === card.id)) lines.push(`    > ${c.createdAt} ${c.author}: ${c.body}`)
    }
  }
  const cardIds = new Set(board.columns.flatMap((c) => c.cards.map((x) => x.id)))
  const others = board.comments.filter((c) => !cardIds.has(c.card))
  if (others.length > 0) {
    lines.push("## カード以外へのコメント")
    for (const c of others) lines.push(`- ${c.card} ${c.createdAt} ${c.author}: ${c.body}`)
  }
  if (board.stale.length > 0) lines.push(`\n適用できなかった action: ${board.stale.map((s) => `${s.id}(${s.type})`).join(", ")}`)
  return lines.join("\n")
}

const usage = `usage:
  board.ts show <dump-dir> [--json] [--empty]
                                          盤面を表示する (<dump-dir>/actions/*.json を畳み込む)。
                                          --empty は <dump-dir>/actions が無いときに空の盤面として扱う
  board.ts id <key>                       キー (チケット URL など) からカード id を出す
  board.ts plan <dump-dir> <intents.json> <out-dir> [--empty]
                                          intents から action を生成し、<out-dir>/<action-id>.json と
                                          ArtifactData batch 1 回分ずつの writes の配列を出力する`

const main = (argv: string[]): void => {
  const allowEmpty = argv.includes("--empty")
  const json = argv.includes("--json")
  const [command, ...rest] = argv.filter((a) => a !== "--empty" && a !== "--json")
  if (command === "show" && rest[0] !== undefined) {
    const board = fold(readActions(rest[0], { allowEmpty }))
    console.log(json ? JSON.stringify(board, null, 2) : renderBoard(board))
    return
  }
  if (command === "id" && rest[0] !== undefined) {
    console.log(cardId(rest[0]))
    return
  }
  if (command === "plan" && rest[0] !== undefined && rest[1] !== undefined && rest[2] !== undefined) {
    const [dumpDir, intentsFile, outDir] = rest as [string, string, string]
    const intents = JSON.parse(readFileSync(intentsFile, "utf8")) as Intent[]
    const writer = `cc-${randomBytes(6).toString("hex")}`
    const result = plan(readActions(dumpDir, { allowEmpty }), intents, { writer, now: new Date() })
    mkdirSync(outDir, { recursive: true })
    const writes = result.actions.map((action) => {
      const file = resolve(outDir, `${action.id.replace(":", "_")}.json`)
      writeFileSync(file, `${JSON.stringify(action, null, 2)}\n`)
      return { op: "set", collection: COLLECTION, doc_id: action.id, file_path: file }
    })
    for (const s of result.skipped) console.error(`skip: ${s}`)
    const batches: (typeof writes)[] = []
    for (let i = 0; i < writes.length; i += BATCH_LIMIT) batches.push(writes.slice(i, i + BATCH_LIMIT))
    console.log(JSON.stringify(batches, null, 2))
    return
  }
  console.error(usage)
  process.exit(2)
}

const entry = process.argv[1]
if (entry !== undefined && import.meta.url === pathToFileURL(realpathSync(entry)).href) main(process.argv.slice(2))
