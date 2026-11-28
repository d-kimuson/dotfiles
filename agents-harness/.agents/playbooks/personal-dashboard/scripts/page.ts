// ページ (公開する HTML) と盤面の状態 (kit の base JSON と change log) の変換。I/O を持たない。

export const BOARD_IDS = ["personal-task-board", "personal-learning"] as const
export type BoardId = (typeof BOARD_IDS)[number]

export type Color = "gray" | "blue" | "green" | "amber" | "violet" | "red"
const COLORS: Color[] = ["gray", "blue", "green", "amber", "violet", "red"]

export type Link = { url: string; label?: string }
export type Card = {
  id: string
  number: number
  title: string
  description?: string
  tags?: string[]
  assignee?: string
  links?: Link[]
  questions?: string
}
export type Column = {
  id: string
  label: string
  description?: string
  color?: Color
  limit?: number
  cards: Card[]
}
export type Kanban = { columns: Column[] }

export type Change = { id?: string; title: string; body?: string; target?: string; navigate?: string }
export type Revision = { revision: string; changes: Change[] }
// addressed は writer ごとの seq の範囲。値は `writer:from-to,...` の文字列のまま持つ。
export type ChangeLog = { addressed?: string; revisions?: Revision[] }
export type Page = { boards: Record<BoardId, Kanban>; changes: ChangeLog }

export const ARCHIVED = "archived"
export const DONE = "done"

type BoardDef = { id: BoardId; page: string; columns: { id: string; label: string; color: Color }[] }
export const BOARDS: Record<BoardId, BoardDef> = {
  "personal-task-board": {
    id: "personal-task-board",
    page: "board",
    columns: [
      { id: "todo", label: "Todo", color: "gray" },
      { id: "today", label: "今日やる", color: "amber" },
      { id: "doing", label: "進行中", color: "blue" },
      { id: "blocked", label: "Pending", color: "red" },
      { id: "done", label: "Done", color: "green" },
      { id: ARCHIVED, label: "アーカイブ", color: "gray" },
    ],
  },
  "personal-learning": {
    id: "personal-learning",
    page: "learning",
    columns: [
      { id: "backlog", label: "バックログ", color: "violet" },
      { id: DONE, label: "Done", color: "green" },
      { id: ARCHIVED, label: "アーカイブ", color: "gray" },
    ],
  },
}
export const boardOfPage = (page: string): BoardDef | undefined => Object.values(BOARDS).find((b) => b.page === page)

// 空の列。テンプレートの base と同じ形で、列の順も同じ。
export const emptyKanban = (board: BoardId): Kanban => ({
  columns: BOARDS[board].columns.map((c) => ({ id: c.id, label: c.label, color: c.color, cards: [] })),
})
export const emptyPage = (): Page => ({
  boards: { "personal-task-board": emptyKanban("personal-task-board"), "personal-learning": emptyKanban("personal-learning") },
  changes: {},
})

// HTML に埋め込む JSON は `<` を必ず `\u003c` にする。`</script` も `<!--` も script を閉じさせないため。
export const embedJson = (value: unknown): string => JSON.stringify(value, null, 2).replace(/</g, "\\u003c")

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
// kit の base のリンクは、URL として読めること (URL.canParse) と http(s) であることの両方を満たす必要がある。
// kit は 1 本の違反で base 全体を拒み、ページが出なくなる。
export const isHttpUrl = (url: string): boolean => /^https?:\/\//i.test(url) && URL.canParse(url)

function fail(path: string, reason: string): never {
  throw new Error(`${path}: ${reason}`)
}
const onlyKeys = (value: Record<string, unknown>, keys: string[], path: string): void => {
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${path}.${key}`, "未知の項目")
}
const text = (value: unknown, path: string, min = 1): string => {
  if (typeof value !== "string" || value.length < min) fail(path, `文字列 (${min} 文字以上) であること`)
  return value
}
const optionalText = (value: unknown, path: string): string | undefined =>
  value === undefined ? undefined : text(value, path, 0)
const positive = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) fail(path, "1 以上の整数であること")
  return value
}

const CARD_KEYS = ["id", "number", "title", "description", "tags", "assignee", "links", "questions"]
const validateCard = (value: unknown, path: string, assign: () => number): Card => {
  if (!isObject(value)) fail(path, "オブジェクトであること")
  onlyKeys(value, CARD_KEYS, path)
  const card: Card = { id: text(value.id, `${path}.id`), number: value.number === undefined ? assign() : positive(value.number, `${path}.number`), title: text(value.title, `${path}.title`) }
  const description = optionalText(value.description, `${path}.description`)
  if (description !== undefined) card.description = description
  const questions = optionalText(value.questions, `${path}.questions`)
  if (questions !== undefined) card.questions = questions
  if (value.tags !== undefined) {
    if (!Array.isArray(value.tags)) fail(`${path}.tags`, "配列であること")
    // kit の base は空文字のタグを許す。
    card.tags = value.tags.map((tag, i) => text(tag, `${path}.tags[${i}]`, 0))
  }
  if (value.assignee !== undefined) card.assignee = text(value.assignee, `${path}.assignee`, 0)
  if (value.links !== undefined) {
    if (!Array.isArray(value.links)) fail(`${path}.links`, "配列であること")
    card.links = value.links.map((link, i) => {
      if (!isObject(link)) fail(`${path}.links[${i}]`, "オブジェクトであること")
      onlyKeys(link, ["url", "label"], `${path}.links[${i}]`)
      const url = text(link.url, `${path}.links[${i}].url`)
      if (!isHttpUrl(url)) fail(`${path}.links[${i}].url`, "URL として読める http(s) の URL であること")
      const label = optionalText(link.label, `${path}.links[${i}].label`)
      return label === undefined || label === "" ? { url } : { url, label }
    })
    const urls = card.links.map((l) => l.url)
    if (new Set(urls).size !== urls.length) fail(`${path}.links`, "同じ URL を 2 つ持っている")
  }
  return card
}

// kit 0.4.2 の Kanban と同じ入力を拒む。違反は path 付きの例外にする。
export const validateKanban = (value: unknown): Kanban => {
  if (!isObject(value)) fail("board", "オブジェクトであること")
  onlyKeys(value, ["columns"], "board")
  if (!Array.isArray(value.columns)) fail("board.columns", "配列であること")
  const numbers = value.columns.flatMap((column) =>
    isObject(column) && Array.isArray(column.cards) ? column.cards.flatMap((card) => (isObject(card) && card.number !== undefined ? [card.number] : [])) : [],
  )
  const seenNumber = numbers.find((n, i) => numbers.indexOf(n) !== i)
  if (seenNumber !== undefined) fail("board", `カードの番号が重なっている: ${String(seenNumber)}`)
  let next = Math.max(0, ...numbers.filter((n): n is number => typeof n === "number" && Number.isSafeInteger(n)))
  const columnIds = new Set<string>()
  const cardIds = new Set<string>()
  const columns = value.columns.map((column, c) => {
    const path = `board.columns[${c}]`
    if (!isObject(column)) fail(path, "オブジェクトであること")
    onlyKeys(column, ["id", "label", "description", "color", "limit", "cards"], path)
    const id = text(column.id, `${path}.id`)
    if (columnIds.has(id)) fail(`${path}.id`, `列の id が重なっている: ${id}`)
    columnIds.add(id)
    const out: Column = { id, label: text(column.label, `${path}.label`), cards: [] }
    const description = optionalText(column.description, `${path}.description`)
    if (description !== undefined) out.description = description
    if (column.color !== undefined) {
      const color = text(column.color, `${path}.color`)
      if (!COLORS.includes(color as Color)) fail(`${path}.color`, `${COLORS.join(" | ")} のどれかであること`)
      out.color = color as Color
    }
    if (column.limit !== undefined) out.limit = positive(column.limit, `${path}.limit`)
    if (column.cards !== undefined) {
      if (!Array.isArray(column.cards)) fail(`${path}.cards`, "配列であること")
      out.cards = column.cards.map((card, i) => {
        const parsed = validateCard(card, `${path}.cards[${i}]`, () => ++next)
        if (cardIds.has(parsed.id)) fail(`${path}.cards[${i}].id`, `カードの id が重なっている: ${parsed.id}`)
        cardIds.add(parsed.id)
        return parsed
      })
    }
    return out
  })
  return { columns }
}

const attr = (attrs: string, name: string): string | undefined => new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1]
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/g
// 要素の中の最初の base JSON (option block ではない script) を探す。
const baseScript = (body: string, from = 0): { start: number; end: number; inner: string; indent: string } | undefined => {
  SCRIPT.lastIndex = from
  for (let m = SCRIPT.exec(body); m !== null; m = SCRIPT.exec(body)) {
    const attrs = m[1] ?? ""
    if (!/type="application\/json"/.test(attrs) || /data-dpk-(changes|grill)/.test(attrs)) continue
    const start = (m.index ?? 0) + m[0].indexOf(">") + 1
    const inner = m[2] ?? ""
    const lineStart = body.lastIndexOf("\n", m.index ?? 0) + 1
    const indent = /^[ \t]*/.exec(body.slice(lineStart, m.index ?? 0))?.[0] ?? ""
    return { start, end: start + inner.length, inner, indent }
  }
  return undefined
}

export const KANBAN_TAG = /<dpk-board-kanban\b([^>]*)>([\s\S]*?)<\/dpk-board-kanban>/g

export function parsePage(html: string): Page {
  const boards = {} as Record<BoardId, Kanban>
  KANBAN_TAG.lastIndex = 0
  for (let m = KANBAN_TAG.exec(html); m !== null; m = KANBAN_TAG.exec(html)) {
    const id = attr(m[1] ?? "", "id")
    if (id === undefined) fail("dpk-board-kanban", "id が無い")
    if (!(BOARD_IDS as readonly string[]).includes(id)) continue
    const body = m[2] ?? ""
    const script = baseScript(body)
    if (script === undefined) fail(`dpk-board-kanban#${id}`, "base の JSON が無い")
    let parsed: unknown
    try {
      parsed = JSON.parse(script.inner)
    } catch (e) {
      fail(`dpk-board-kanban#${id}`, `base の JSON を読めない: ${(e as Error).message}`)
    }
    boards[id as BoardId] = validateKanban(parsed)
  }
  for (const id of BOARD_IDS) if (boards[id] === undefined) fail(`dpk-board-kanban#${id}`, "ページに無い")
  return { boards, changes: parseChanges(html) }
}

const parseChanges = (html: string): ChangeLog => {
  const m = /<script\b([^>]*data-dpk-changes[^>]*)>([\s\S]*?)<\/script>/.exec(html)
  if (m === null) return {}
  let value: unknown
  try {
    value = JSON.parse(m[2] ?? "")
  } catch (e) {
    fail("data-dpk-changes", `JSON を読めない: ${(e as Error).message}`)
  }
  if (!isObject(value)) fail("data-dpk-changes", "オブジェクトであること")
  onlyKeys(value, ["addressed", "revisions", "revision", "changes"], "data-dpk-changes")
  const log: ChangeLog = {}
  const addressed = optionalText(value.addressed, "data-dpk-changes.addressed")
  if (addressed !== undefined) log.addressed = addressed
  const revisions = value.revisions ?? (value.revision === undefined ? undefined : [{ revision: value.revision, changes: value.changes ?? [] }])
  if (revisions !== undefined) {
    if (!Array.isArray(revisions)) fail("data-dpk-changes.revisions", "配列であること")
    log.revisions = revisions.map((revision, i) => {
      const path = `data-dpk-changes.revisions[${i}]`
      if (!isObject(revision)) fail(path, "オブジェクトであること")
      onlyKeys(revision, ["revision", "changes"], path)
      if (!Array.isArray(revision.changes)) fail(`${path}.changes`, "配列であること")
      return {
        revision: text(revision.revision, `${path}.revision`),
        changes: revision.changes.map((change, j) => {
          const at = `${path}.changes[${j}]`
          if (!isObject(change)) fail(at, "オブジェクトであること")
          onlyKeys(change, ["id", "title", "body", "target", "navigate"], at)
          const out: Change = { title: text(change.title, `${at}.title`) }
          if (change.id !== undefined) out.id = text(change.id, `${at}.id`)
          if (change.body !== undefined) out.body = text(change.body, `${at}.body`, 0)
          if (change.target !== undefined) out.target = text(change.target, `${at}.target`)
          if (change.navigate !== undefined) out.navigate = text(change.navigate, `${at}.navigate`)
          return out
        }),
      }
    })
  }
  return log
}

const indentOf = (json: string, indent: string): string =>
  json
    .split("\n")
    .map((line) => (line === "" ? line : `${indent}${line}`))
    .join("\n")

const changeLogBlock = (log: ChangeLog, indent: string): string => {
  if (log.addressed === undefined && (log.revisions === undefined || log.revisions.length === 0)) return ""
  const value: Record<string, unknown> = {}
  if (log.addressed !== undefined) value.addressed = log.addressed
  if (log.revisions !== undefined) value.revisions = log.revisions
  return `${indent}<script type="application/json" data-dpk-changes>\n${indentOf(embedJson(value), `${indent}  `)}\n${indent}</script>`
}

// base はテンプレートの空の列。カードと change log を差し込む。
export function renderPage(template: string, page: Page): string {
  KANBAN_TAG.lastIndex = 0
  let html = template.replace(KANBAN_TAG, (whole, attrs: string, body: string) => {
    const id = attr(attrs, "id") as BoardId | undefined
    if (id === undefined || !(BOARD_IDS as readonly string[]).includes(id)) return whole
    const script = baseScript(body)
    if (script === undefined) return whole
    // kit が開けない base を公開しないよう、埋め込む直前に検査する。
    const json = indentOf(embedJson(validateKanban(page.boards[id])), `${script.indent}  `)
    const nextBody = `${body.slice(0, script.start)}\n${json}\n${script.indent}${body.slice(script.end)}`
    return `<dpk-board-kanban${attrs}>${nextBody}</dpk-board-kanban>`
  })
  // 既存の change log は前の改行と字下げごと差し替える。字下げを二重にせず、消すときに空行を残さないため。
  const existing = /(?:\n[ \t]*)?<script\b[^>]*data-dpk-changes[^>]*>[\s\S]*?<\/script>/.exec(html)
  const app = /<dpk-app\b([^>]*)>/.exec(html)
  if (app === null) fail("dpk-app", "ページに無い")
  const appScript = baseScript(html, (app.index ?? 0) + app[0].length)
  if (appScript === undefined) fail("dpk-app", "base の JSON が無い")
  const indent = appScript.indent
  const block = changeLogBlock(page.changes, indent)
  if (existing !== null) {
    html = `${html.slice(0, existing.index)}${block === "" ? "" : `\n${block}`}${html.slice(existing.index + existing[0].length)}`
  } else if (block !== "") {
    const at = appScript.end + "</script>".length
    html = `${html.slice(0, at)}\n${block}${html.slice(at)}`
  }
  return html
}
