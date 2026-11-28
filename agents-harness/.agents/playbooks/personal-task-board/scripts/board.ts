#!/usr/bin/env node
// Personal Task Board (Claude Artifact) の db `actions` を畳み込んで盤面を出し、カードを変える action を生成する。
import { createHash, randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

export const COLLECTION = "actions"
export const AUTHOR = { id: "agent:claude-code", name: "Claude Code" }
const BATCH_LIMIT = 50
const BLOCKED_HEADING = "## ブロック理由"
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
      { id: "blocked", label: "ブロック", color: "red" },
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
export type Comment = { board?: BoardId; card: string; body: string; author: string; createdAt: string }
export type Stale = { id: string; type: string }
export type Board = { columns: Column[]; comments: Comment[]; stale: Stale[] }
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

// dev-process-kit の Kanban と同じ規則で replay する。適用できない action は stale に入れて飛ばす。
export const fold = (actions: Action[]): Board => {
  const columns: Column[] = BOARDS.flatMap((b) => b.columns.map((c) => ({ board: b.id, id: c.id, label: c.label, cards: [] as Card[] })))
  const comments: Comment[] = []
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
        const id = t === undefined ? str(action.target?.id) : t.path.startsWith("card/") ? t.path.slice(5) : t.path
        comments.push({ ...(t === undefined ? {} : { board: t.board }), card: id, body: str(p.body), author: action.author?.name ?? action.author?.id ?? "", createdAt: action.createdAt })
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
  return { columns, comments, stale }
}

export const findCard = (board: Board, id: string): { board: BoardId; column: string; card: Card } | undefined => {
  for (const column of board.columns) {
    const card = column.cards.find((c) => c.id === id)
    if (card !== undefined) return { board: column.board, column: column.id, card }
  }
  return undefined
}

// description は「説明」「## ブロック理由」「## セッション」の 3 節。前の形式の「## 状況」節は migrate だけが落とす。
export type Description = { detail: string; blocked: string; sessions: string[] }
export const parseDescription = (description: string | null, options: { dropLegacy?: boolean } = {}): Description => {
  const sections: Record<string, string[]> = { detail: [], blocked: [], sessions: [], legacy: [] }
  let current = "detail"
  for (const line of (description ?? "").split("\n")) {
    const heading = line.trim()
    if (heading === BLOCKED_HEADING) current = "blocked"
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
    })
  | ({ op: "move"; column: string; reason?: string } & CardRef)
  | ({ op: "detail"; text: string } & CardRef)
  | ({ op: "link"; url: string; label?: string } & CardRef)
  | ({ op: "session"; session: string } & CardRef)
  | ({ op: "comment"; text: string } & CardRef)
  | { op: "archive"; board?: BoardId }

export type PlanResult = { actions: Action[]; skipped: string[] }

export const plan = (
  actions: Action[],
  intents: Intent[],
  options: { writer: string; now: Date },
): PlanResult => {
  const created: Action[] = []
  const skipped: string[] = []
  // 書き手の時計が遅れていても、読んだ action より後に再生させる。
  const latest = Math.max(0, ...actions.map((a) => Date.parse(a.createdAt)).filter((t) => !Number.isNaN(t)))
  const base = Math.max(options.now.getTime(), latest + 1)
  const emit = (board: BoardId, type: string, path: string, payload: Record<string, unknown>): void => {
    const seq = created.length
    const createdAt = new Date(base + seq).toISOString()
    created.push({ id: `${options.writer}:${String(seq + 1).padStart(3, "0")}`, type, target: target(board, path), payload, createdAt, author: AUTHOR })
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
  const OPS = ["add", "move", "detail", "link", "session", "comment", "archive"]
  for (const intent of intents) {
    if (!OPS.includes(intent.op)) throw new Error(`unknown op: ${String(intent.op)} (${OPS.join(", ")})`)
    if (intent.op === "comment" && (typeof intent.text !== "string" || intent.text.trim() === "")) throw new Error("comment: text が空")
    const board = fold([...actions, ...created])
    if (intent.op === "archive") {
      if (intent.board !== undefined) checkBoard(intent.board)
      const done = board.columns.filter((c) => c.id === DONE && (intent.board === undefined || c.board === intent.board))
      for (const column of done) for (const card of column.cards) emit(column.board, "MOVE_CARD", `card/${card.id}`, { column: ARCHIVED, before: null })
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
      emit(b, "comment", `card/${id}`, { body: intent.text.trim() })
    } else if (intent.op === "session") {
      const ref = checkSession(intent.session)
      if (isHttp(ref)) addLink(ref, "session")
      else if (desc.sessions.includes(ref)) skipped.push(`session ${id}: 既にある ${ref}`)
      else setDescription({ ...desc, sessions: [...desc.sessions, ref] })
    }
  }
  return { actions: created, skipped }
}

// 前の形式からの移行: description の「## 状況」節を落とす。ブロック中のカードは最後の状況の行をブロック理由にする。
export const planMigration = (actions: Action[], options: { writer: string; now: Date }): Action[] => {
  const latest = Math.max(0, ...actions.map((a) => Date.parse(a.createdAt)).filter((t) => !Number.isNaN(t)))
  const base = Math.max(options.now.getTime(), latest + 1)
  const created: Action[] = []
  for (const column of fold(actions).columns) {
    for (const card of column.cards) {
      const lines = (card.description ?? "").split("\n")
      if (!lines.some((l) => l.trim() === LEGACY_STATUS_HEADING)) continue
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

const commentLines = (head: string, body: string, indent: string): string[] =>
  body.split("\n").map((line, i) => (i === 0 ? `${head}${line}` : `${indent}${line}`))

export const renderBoard = (board: Board, options: { archived?: boolean } = {}): string => {
  const lines: string[] = []
  for (const b of BOARDS) {
    lines.push(`# ${b.id}`)
    for (const column of board.columns.filter((c) => c.board === b.id && (options.archived === true || c.id !== ARCHIVED))) {
      lines.push(`## ${column.label} (${column.id}) ${column.cards.length}`)
      for (const card of column.cards) {
        const links = card.links.map((l) => l.url).join(" ")
        const tags = card.tags.length === 0 ? "" : ` [${card.tags.join(", ")}]`
        lines.push(`- TASK-${card.number} ${card.id} ${card.title}${tags}${links === "" ? "" : ` ${links}`}`)
        for (const line of (card.description ?? "").split("\n")) if (line.trim() !== "") lines.push(`    ${line}`)
        for (const c of board.comments.filter((x) => x.board === b.id && x.card === card.id))
          lines.push(...commentLines(`    > ${c.createdAt} ${c.author}: `, c.body, "    >   "))
      }
    }
  }
  const cardIds = new Set(board.columns.flatMap((c) => c.cards.map((x) => `${c.board}/${x.id}`)))
  if (options.archived !== true) for (const c of board.columns.filter((x) => x.id === ARCHIVED)) if (c.cards.length > 0) lines.push(`(${c.board} のアーカイブ ${c.cards.length} 枚は --archived で出す)`)
  const others = board.comments.filter((c) => !cardIds.has(`${c.board}/${c.card}`))
  if (others.length > 0) {
    lines.push("## カード以外へのコメント")
    for (const c of others) lines.push(...commentLines(`- ${c.card} ${c.createdAt} ${c.author}: `, c.body, "    "))
  }
  if (board.stale.length > 0) lines.push(`\n適用できなかった action: ${board.stale.map((s) => `${s.id}(${s.type})`).join(", ")}`)
  return lines.join("\n")
}

const usage = `usage:
  board.ts show <dump-dir> [--json] [--empty] [--archived]
                                          盤面を表示する (<dump-dir>/actions/*.json を畳み込む)。
                                          --empty は <dump-dir>/actions が無いときに空の盤面として扱う。
                                          --archived はアーカイブしたカードも出す
  board.ts id <key>                       キー (チケット URL など) からカード id を出す
  board.ts session                        いまのセッションの参照を環境変数から出す
  board.ts plan <dump-dir> <intents.json> <out-dir> [--empty]
                                          intents から action を生成し、ArtifactData batch 1 回分ずつの writes の配列を出力する
  board.ts archive <dump-dir> <out-dir> [<board>]
                                          Done 列のカードをアーカイブする writes の配列を出力する。<board> を省くと全盤面
  board.ts migrate <dump-dir> <out-dir>   description の「## 状況」節を落とす writes の配列を出力する`

const toBatches = <T>(writes: T[]): T[][] => {
  const batches: T[][] = []
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) batches.push(writes.slice(i, i + BATCH_LIMIT))
  return batches
}
const output = (outDir: string, actions: Action[]): void => {
  mkdirSync(outDir, { recursive: true })
  const writes = actions.map((a) => {
    const file = resolve(outDir, `${COLLECTION}_${a.id.replace(/:/g, "_")}.json`)
    writeFileSync(file, `${JSON.stringify(a, null, 2)}\n`)
    return { op: "set", collection: COLLECTION, doc_id: a.id, file_path: file }
  })
  console.log(JSON.stringify(toBatches(writes), null, 2))
}
const writerId = (): string => `cc-${randomBytes(6).toString("hex")}`

const main = (argv: string[]): void => {
  const flags = ["--empty", "--json", "--archived"]
  const allowEmpty = argv.includes("--empty")
  const [command, ...rest] = argv.filter((a) => !flags.includes(a))
  if (command === "show" && rest[0] !== undefined) {
    const board = fold(readActions(rest[0], { allowEmpty }))
    console.log(argv.includes("--json") ? JSON.stringify(board, null, 2) : renderBoard(board, { archived: argv.includes("--archived") }))
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
    const result = plan(readActions(dumpDir, { allowEmpty }), intents, { writer: writerId(), now: new Date() })
    for (const s of result.skipped) console.error(`skip: ${s}`)
    output(third, result.actions)
    return
  }
  if (command === "archive" && dumpDir !== undefined && second !== undefined) {
    const board = BOARDS.find((b) => b.id === third)?.id
    if (third !== undefined && board === undefined) throw new Error(`unknown board: ${third} (${BOARDS.map((b) => b.id).join(", ")})`)
    const actions = readActions(dumpDir)
    const result = plan(actions, [board === undefined ? { op: "archive" } : { op: "archive", board }], { writer: writerId(), now: new Date() })
    const after = fold([...actions, ...result.actions])
    for (const a of result.actions) {
      const found = findCard(after, parseTarget(a.target)?.path.slice("card/".length) ?? "")
      console.error(`archive: TASK-${found?.card.number} ${found?.card.id} ${found?.card.title}`)
    }
    output(second, result.actions)
    return
  }
  if (command === "migrate" && dumpDir !== undefined && second !== undefined) {
    output(second, planMigration(readActions(dumpDir), { writer: writerId(), now: new Date() }))
    return
  }
  console.error(usage)
  process.exit(2)
}

const entry = process.argv[1]
if (entry !== undefined && import.meta.url === pathToFileURL(realpathSync(entry)).href) main(process.argv.slice(2))
