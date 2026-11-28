// kit 0.4.2 の draft action を base の上で再生する。規則は kit の Kanban (dist/boards.js) と同じ。
import { BOARDS, isHttpUrl, type BoardId, type Card, type Kanban } from "./page.ts"

export type DraftAction = {
  id: string
  type: string
  target: { type: string; id: string }
  payload?: Record<string, unknown>
  note?: string
  createdAt: string
}
export type Result = { id: string; status: "applied" | "stale" | "comment"; reason?: string }
export type Target = { board: BoardId; kind: string; id: string }

const isBoardId = (v: string): v is BoardId => (Object.keys(BOARDS) as string[]).includes(v)
const decode = (segment: string): string | undefined => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return undefined
  }
}

// target の id は `<board>/<column|card>/<id>@<page>`。区切りごとに encodeURIComponent されている。
export const parseTargetId = (id: string | undefined): Target | undefined => {
  if (id === undefined) return undefined
  const parts = id.split("/")
  if (parts.length !== 3) return undefined
  const board = parts[0] ?? ""
  if (!isBoardId(board)) return undefined
  const suffix = `@${BOARDS[board].page}`
  const last = parts[2] ?? ""
  if (!last.endsWith(suffix)) return undefined
  const value = decode(last.slice(0, -suffix.length))
  const kind = parts[1] ?? ""
  return value === undefined ? undefined : { board, kind, id: value }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
const trimmed = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined)

const numbers = (board: Kanban): number[] => board.columns.flatMap((c) => c.cards.map((x) => x.number))
const nextNumber = (board: Kanban): number => Math.max(0, ...numbers(board)) + 1
const findCard = (board: Kanban, id: string): { column: number; index: number; card: Card } | undefined => {
  for (const [column, c] of board.columns.entries()) {
    const index = c.cards.findIndex((x) => x.id === id)
    const card = c.cards[index]
    if (card !== undefined) return { column, index, card }
  }
  return undefined
}
const hasCard = (board: Kanban, id: string): boolean => findCard(board, id) !== undefined
const columnOf = (board: Kanban, id: string) => board.columns.find((c) => c.id === id)

const STALE = { missing: "target-missing", constraint: "constraint-violated", unsupported: "unsupported-action-type" } as const

// kit の Kanban が受け付ける action。未知の type はカードを探す前に拒む。
const ACTION_TYPES = new Set([
  "ADD_CARD",
  "MOVE_CARD",
  "SET_CARD_TITLE",
  "SET_CARD_DESCRIPTION",
  "SET_CARD_ASSIGNEE",
  "ADD_CARD_TAG",
  "REMOVE_CARD_TAG",
  "ADD_CARD_LINK",
  "REMOVE_CARD_LINK",
])

// undefined なら適用済み、文字列なら stale の理由。
// kit と同じ順に検査する。ADD_CARD と MOVE_CARD は対象を先に解決し、SET_CARD_* と ADD_CARD_* / REMOVE_CARD_* は payload を先に検査する。
const applyAction = (board: Kanban, target: Target, action: DraftAction): string | undefined => {
  if (!ACTION_TYPES.has(action.type)) return STALE.unsupported
  const p = action.payload ?? {}
  if (action.type === "ADD_CARD") {
    if (target.kind !== "column") return STALE.missing
    const column = columnOf(board, target.id)
    if (column === undefined) return STALE.missing
    const id = typeof p.id === "string" && p.id !== "" ? p.id : undefined
    const title = trimmed(p.title)
    if (id === undefined || title === undefined) return STALE.constraint
    const number = p.number === undefined ? undefined : typeof p.number === "number" && Number.isSafeInteger(p.number) && p.number >= 1 ? p.number : null
    if (number === null) return STALE.constraint
    if (hasCard(board, id)) return STALE.constraint
    if (number !== undefined && numbers(board).includes(number)) return STALE.constraint
    column.cards.push({ id, number: number ?? nextNumber(board), title })
    return undefined
  }
  if (action.type === "MOVE_CARD") {
    if (target.kind !== "card") return STALE.missing
    const moved = findCard(board, target.id)
    if (moved === undefined) return STALE.missing
    const to = typeof p.column === "string" && p.column !== "" ? columnOf(board, p.column) : undefined
    const before = p.before
    if (to === undefined || before === undefined || (before !== null && trimmed(before) === undefined)) return STALE.constraint
    const key = before as string | null
    if (key !== null && (key === moved.card.id || !to.cards.some((c) => c.id === key))) return STALE.constraint
    const from = board.columns[moved.column]
    if (from === undefined) return STALE.missing
    from.cards.splice(moved.index, 1)
    if (key === null) to.cards.push(moved.card)
    else to.cards.splice(to.cards.findIndex((c) => c.id === key), 0, moved.card)
    return undefined
  }
  // payload の検査。対象のカードが見つからなくても、payload の不正を先に返す。
  if (action.type === "SET_CARD_TITLE" && trimmed(p.title) === undefined) return STALE.constraint
  if (action.type === "SET_CARD_DESCRIPTION" && typeof p.description !== "string") return STALE.constraint
  if (action.type === "SET_CARD_ASSIGNEE" && typeof p.assignee !== "string") return STALE.constraint
  if ((action.type === "ADD_CARD_TAG" || action.type === "REMOVE_CARD_TAG") && trimmed(p.tag) === undefined) return STALE.constraint
  if (action.type === "REMOVE_CARD_LINK" && trimmed(p.url) === undefined) return STALE.constraint
  if (action.type === "ADD_CARD_LINK") {
    const url = typeof p.url === "string" ? p.url : undefined
    if (url === undefined || !isHttpUrl(url)) return STALE.constraint
    // kit の payload は label を trim してから 1 文字以上を検査する。空白だけの label は違反である。
    if (p.label !== undefined && trimmed(p.label) === undefined) return STALE.constraint
  }
  if (target.kind !== "card") return STALE.missing
  const found = findCard(board, target.id)
  if (found === undefined) return STALE.missing
  const source = board.columns[found.column]
  if (source === undefined) return STALE.missing
  const card = found.card
  const edit = (next: Card): string | undefined => {
    source.cards[found.index] = next
    return undefined
  }
  switch (action.type) {
    case "SET_CARD_TITLE":
      return edit({ ...card, title: String(trimmed(p.title)) })
    case "SET_CARD_DESCRIPTION": {
      const next: Card = { ...card }
      if (String(p.description).trim() === "") delete next.description
      else next.description = String(p.description)
      return edit(next)
    }
    case "SET_CARD_ASSIGNEE": {
      const next: Card = { ...card }
      const assignee = String(p.assignee).trim()
      if (assignee === "") delete next.assignee
      else next.assignee = assignee
      return edit(next)
    }
    case "ADD_CARD_TAG": {
      const tag = String(trimmed(p.tag))
      if ((card.tags ?? []).includes(tag)) return STALE.constraint
      return edit({ ...card, tags: [...(card.tags ?? []), tag] })
    }
    case "REMOVE_CARD_TAG": {
      const tag = String(trimmed(p.tag))
      if (!(card.tags ?? []).includes(tag)) return STALE.constraint
      const tags = (card.tags ?? []).filter((t) => t !== tag)
      const next: Card = { ...card }
      if (tags.length === 0) delete next.tags
      else next.tags = tags
      return edit(next)
    }
    case "ADD_CARD_LINK": {
      const url = String(p.url)
      if ((card.links ?? []).some((l) => l.url === url)) return STALE.constraint
      const label = trimmed(p.label)
      return edit({ ...card, links: [...(card.links ?? []), label === undefined ? { url } : { url, label }] })
    }
    case "REMOVE_CARD_LINK": {
      const url = String(trimmed(p.url))
      if (!(card.links ?? []).some((l) => l.url === url)) return STALE.constraint
      const links = (card.links ?? []).filter((l) => l.url !== url)
      const next: Card = { ...card }
      if (links.length === 0) delete next.links
      else next.links = links
      return edit(next)
    }
    default:
      return STALE.unsupported
  }
}

export function replay(board: Kanban, boardId: BoardId, actions: DraftAction[]): { board: Kanban; results: Result[] } {
  const state = structuredClone(board)
  const results: Result[] = []
  for (const action of actions) {
    if (action.type === "comment") {
      results.push({ id: action.id, status: "comment" })
      continue
    }
    const target = parseTargetId(action.target?.id)
    if (target === undefined || target.board !== boardId) {
      results.push({ id: action.id, status: "stale", reason: STALE.missing })
      continue
    }
    const reason = applyAction(state, target, action)
    results.push(reason === undefined ? { id: action.id, status: "applied" } : { id: action.id, status: "stale", reason })
  }
  return { board: state, results }
}

export const actionBoard = (action: DraftAction): BoardId | undefined => parseTargetId(action.target?.id)?.board

// addressed は writer:from-to の範囲。処理した id の writer ごとの最大 seq までを [1, max] として足す (kit の Op と同じ)。
type Ranges = Map<string, [number, number][]>
const ID = /^([A-Za-z0-9_-]+):([1-9][0-9]*)$/
const RANGE = /^([A-Za-z0-9_-]+):([1-9][0-9]*)(?:-([1-9][0-9]*))?$/

const merge = (ranges: [number, number][]): [number, number][] => {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const out: [number, number][] = []
  for (const [from, to] of sorted) {
    const last = out.at(-1)
    if (last !== undefined && from <= last[1] + 1) last[1] = Math.max(last[1], to)
    else out.push([from, to])
  }
  return out
}

export const parseAddressed = (value: string | undefined): Ranges => {
  const ranges: Ranges = new Map()
  for (const part of (value ?? "").split(",")) {
    const entry = part.trim()
    if (entry === "") continue
    const m = RANGE.exec(entry)
    if (m === null) throw new Error(`addressed は "writer:from-to" の形で書く: ${entry}`)
    const from = Number(m[2])
    const to = m[3] === undefined ? from : Number(m[3])
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) throw new Error(`addressed の範囲が大きすぎる: ${entry}`)
    if (to < from) throw new Error(`addressed の範囲が逆になっている: ${entry}`)
    const writer = m[1] ?? ""
    ranges.set(writer, [...(ranges.get(writer) ?? []), [from, to]])
  }
  for (const [writer, list] of ranges) ranges.set(writer, merge(list))
  return ranges
}

export const formatAddressed = (ranges: Ranges): string =>
  [...ranges.keys()]
    .sort()
    .flatMap((writer) => (ranges.get(writer) ?? []).map(([from, to]) => (from === to ? `${writer}:${from}` : `${writer}:${from}-${to}`)))
    .join(",")

export const addressedHas = (value: string | undefined, id: string): boolean => {
  const parsed = ID.exec(id)
  if (parsed === null) return false
  const writer = parsed[1] ?? ""
  const seq = Number(parsed[2])
  return (parseAddressed(value).get(writer) ?? []).some(([from, to]) => seq >= from && seq <= to)
}

// inner の範囲がすべて outer に含まれるか。別の端末の brief を先に反映していても、計算した値の方が広い。
export const addressedIncludes = (outer: string | undefined, inner: string | undefined): boolean => {
  const total = parseAddressed(outer)
  for (const [writer, ranges] of parseAddressed(inner)) {
    const mine = total.get(writer) ?? []
    for (const [from, to] of ranges) if (!mine.some(([a, b]) => from >= a && to <= b)) return false
  }
  return true
}

// 現在の addressed に、処理を終えた id を足す。値は増える方向にだけ動く。
// keep の id (見送って draft に残す action) は範囲から外す。外した seq の前後で範囲を分ける。
export function mergeAddressed(current: string | undefined, ids: string[], keep: string[] = []): string {
  const ranges = parseAddressed(current)
  const latest = new Map<string, number>()
  for (const id of ids) {
    const m = ID.exec(id)
    if (m === null) continue
    const writer = m[1] ?? ""
    latest.set(writer, Math.max(latest.get(writer) ?? 0, Number(m[2])))
  }
  const kept = new Map<string, number[]>()
  for (const id of keep) {
    const m = ID.exec(id)
    if (m === null) continue
    const writer = m[1] ?? ""
    kept.set(writer, [...(kept.get(writer) ?? []), Number(m[2])])
  }
  for (const [writer, seq] of latest) {
    const added: [number, number][] = []
    let from = 1
    for (const k of [...(kept.get(writer) ?? [])].sort((a, b) => a - b)) {
      if (k > seq) break
      if (k > from) added.push([from, k - 1])
      from = Math.max(from, k + 1)
    }
    if (from <= seq) added.push([from, seq])
    ranges.set(writer, merge([...(ranges.get(writer) ?? []), ...added]))
  }
  return formatAddressed(ranges)
}

const fenced = (markdown: string, after: string, language: string): string | undefined => {
  const at = markdown.indexOf(after)
  if (at === -1) return undefined
  const rest = markdown.slice(at + after.length)
  const m = new RegExp("```" + language + "\\n([\\s\\S]*?)\\n```").exec(rest)
  return m?.[1]
}

const parseDraft = (value: unknown): DraftAction[] => {
  if (!Array.isArray(value)) throw new Error("draft は配列であること")
  return value.map((item, i) => {
    if (!isObject(item)) throw new Error(`draft[${i}] がオブジェクトでない`)
    const id = item.id
    const type = item.type
    const target = item.target
    const createdAt = item.createdAt
    if (typeof id !== "string" || typeof type !== "string" || typeof createdAt !== "string" || !isObject(target) || typeof target.id !== "string")
      throw new Error(`draft[${i}] に id・type・target.id・createdAt が揃っていない`)
    const payload = isObject(item.payload) ? item.payload : {}
    return {
      id,
      type,
      target: { type: typeof target.type === "string" ? target.type : "element", id: target.id },
      payload,
      createdAt,
      ...(typeof item.note === "string" ? { note: item.note } : {}),
    }
  })
}

// folio_get_draft_state の結果は storageKey と template ごとの group に action を持つ。盤面のページの storageKey の group だけを使う。
export const STORAGE_KEY = "personal-task-board"
const draftOfGroups = (groups: unknown[]): unknown[] =>
  groups.flatMap((group) => (isObject(group) && group.storageKey === STORAGE_KEY && Array.isArray(group.actions) ? group.actions : []))

// brief (kit の Copy changes & comments が出した Markdown) を読む。addressed は次の公開で置き換える値。
export function parseBrief(markdown: string): { draft: DraftAction[]; addressed: string; comments: DraftAction[] } {
  const trimmed = markdown.trim()
  let draft: DraftAction[]
  let addressed = ""
  if (trimmed.startsWith("[")) {
    draft = parseDraft(JSON.parse(trimmed))
  } else if (trimmed.startsWith("{")) {
    const value = JSON.parse(trimmed) as unknown
    if (!isObject(value)) throw new Error("review.json がオブジェクトでない")
    draft = Array.isArray(value.groups) ? parseDraft(draftOfGroups(value.groups)) : parseDraft(value.draft)
    if (typeof value.addressed === "string") addressed = value.addressed.trim()
  } else {
    const json = fenced(markdown, "## Canonical draft (JSON)", "json")
    if (json === undefined) throw new Error("brief に `## Canonical draft (JSON)` の節が無い")
    draft = parseDraft(JSON.parse(json))
    addressed = (fenced(markdown, "## Change log: addressed", "text") ?? "").trim()
  }
  return { draft, addressed, comments: draft.filter((a) => a.type === "comment") }
}
