// intent を base (kit の Kanban の JSON) への操作に置き換える。何度当てても同じ結果になる。
import { createHash } from "node:crypto"
import { CHECK_TAG, DUE_PREFIX, isDate, isStamp, mergeRecords, readCard, START_PREFIX, writeCard, type Note } from "./card.ts"
import { ARCHIVED, BOARD_IDS, BOARDS, DONE, isHttpUrl, type BoardId, type Card, type Kanban, type Page } from "./page.ts"

export type Owner = "self" | "agent"
export type CardRef = { card?: string; key?: string }
export type Intent =
  | {
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
    }
  | ({ op: "move"; column: string; reason?: string } & CardRef)
  | ({ op: "detail"; text: string } & CardRef)
  | ({ op: "link"; url: string; label?: string } & CardRef)
  | ({ op: "session"; session: string } & CardRef)
  | ({ op: "comment"; text: string; at: string; by?: string } & CardRef)
  | ({ op: "check"; on: boolean; text?: string; at?: string; by?: string } & CardRef)
  | ({ op: "start" | "due"; date: string | null } & CardRef)
  | ({ op: "owner"; who: Owner | null } & CardRef)
  | { op: "archive"; board?: BoardId }

export type Skipped = { intent: Intent; reason: string }

const BLOCKED = "blocked"
const isHttp = isHttpUrl

// 盤面を変える op。未知の op はカードを探す前に拒む。
const OPS = new Set(["add", "move", "detail", "link", "session", "comment", "check", "start", "due", "owner", "archive"])

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

// セッションの参照: web は claude.ai のセッション URL をリンクに、ローカルは `<provider> <session-id>` を description に置く。
export const PROVIDERS = ["claude-code", "pi", "codex", "command-code"] as const
const SESSION_URL = /^https:\/\/claude\.ai\/code\/session_[A-Za-z0-9_-]+$/
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

const locate = (kanban: Kanban, id: string): { column: number; card: Card } | undefined => {
  for (const [column, c] of kanban.columns.entries()) {
    const card = c.cards.find((x) => x.id === id)
    if (card !== undefined) return { column, card }
  }
  return undefined
}
const maxNumber = (kanban: Kanban): number => Math.max(0, ...kanban.columns.flatMap((c) => c.cards.map((x) => x.number)))

const checkColumn = (board: BoardId, column: string): void => {
  const ids = BOARDS[board].columns.map((c) => c.id).filter((c) => c !== ARCHIVED)
  if (!ids.includes(column)) throw new Error(`unknown column of ${board}: ${column} (${ids.join(", ")}。アーカイブは op "archive")`)
}
const checkBoard = (board: string): BoardId => {
  if (!(BOARD_IDS as readonly string[]).includes(board)) throw new Error(`unknown board: ${board} (${BOARD_IDS.join(", ")})`)
  return board as BoardId
}
const needReason = (column: string, reason: string | undefined, label: string): void => {
  if (column === BLOCKED && (reason === undefined || reason.trim() === "")) throw new Error(`${label}: blocked へは reason (何を待っているか) が要る`)
}

type Outcomes = { skipped: Skipped[] }
const outcome = (outcomes: Outcomes, intent: Intent, reason: string): void => {
  outcomes.skipped.push({ intent, reason })
}

// カードを読んで書き戻す。変化が無ければ書かない。
const edit = (kanban: Kanban, found: { column: number; card: Card }, next: (card: Card) => Card | string): boolean => {
  const updated = next(structuredClone(found.card))
  if (typeof updated === "string") return false
  kanban.columns[found.column]?.cards.splice(
    kanban.columns[found.column]?.cards.findIndex((c) => c.id === found.card.id) ?? 0,
    1,
    updated,
  )
  return true
}

export const applyIntents = (page: Page, intents: Intent[], _options: { now?: Date } = {}): { page: Page; skipped: Skipped[] } => {
  const next: Page = structuredClone(page)
  const outcomes: Outcomes = { skipped: [] }
  for (const intent of intents) {
    if (!OPS.has(intent.op)) throw new Error(`unknown op: ${String((intent as { op: string }).op)}`)
    if (intent.op === "archive") {
      const targets = intent.board === undefined ? [...BOARD_IDS] : [checkBoard(intent.board)]
      for (const board of targets) {
        const kanban = next.boards[board]
        for (const column of kanban.columns.filter((c) => c.id === DONE)) {
          for (const card of [...column.cards]) {
            // 本人の確認を待つカードは、確認が済むまで Done に残す。
            if (readCard(card).check) {
              outcome(outcomes, intent, `archive ${card.id}: 確認が必要なので残す`)
              continue
            }
            column.cards.splice(column.cards.indexOf(card), 1)
            const archived = kanban.columns.find((c) => c.id === ARCHIVED)
            if (archived === undefined) throw new Error(`${board} にアーカイブの列が無い`)
            archived.cards.push(card)
          }
        }
      }
      continue
    }
    const id = intent.op === "add" ? cardId(intent.key) : (intent.card ?? (intent.key === undefined ? "" : cardId(intent.key)))
    if (id === "") throw new Error(`${intent.op}: card か key が要る`)
    if (intent.op === "add") {
      const board = checkBoard(intent.board ?? "personal-task-board")
      const kanban = next.boards[board]
      // 同じ id のカードが別の盤面にあると、後続の intent が後ろの盤面のカードにだけ当たる。両方を見る。
      const existing = BOARD_IDS.map((b) => ({ board: b, at: locate(next.boards[b], id) })).find((x) => x.at !== undefined)
      if (existing?.at !== undefined) {
        const column = next.boards[existing.board].columns[existing.at.column]?.id ?? ""
        outcome(outcomes, intent, `add ${id}: 既にある (${existing.board}/${column}: ${existing.at.card.title})`)
        continue
      }
      checkColumn(board, intent.column)
      const title = intent.title.trim()
      if (title === "") throw new Error(`add ${id}: title が空`)
      needReason(intent.column, intent.reason, `add ${id}`)
      const sessions = (intent.sessions ?? []).map(checkSession)
      const tags = (intent.tags ?? []).map((t) => t.trim()).filter((t) => t !== "")
      // 予約したタグを intent の tags に書いたときも、属性と同じ意味にする。
      const tagDate = (prefix: string): string | undefined => {
        const tag = tags.find((t) => t.startsWith(prefix) && isDate(t.slice(prefix.length)))
        return tag === undefined ? undefined : tag.slice(prefix.length)
      }
      const start = intent.start ?? tagDate(START_PREFIX)
      const due = intent.due ?? tagDate(DUE_PREFIX)
      if (start !== undefined && !isDate(start)) throw new Error(`add ${id} start: YYYY-MM-DD でない (${start})`)
      if (due !== undefined && !isDate(due)) throw new Error(`add ${id} due: YYYY-MM-DD でない (${due})`)
      const check = tags.includes(CHECK_TAG)
      const card = writeCard(
        { id, number: maxNumber(kanban) + 1, title, ...(tags.length === 0 ? {} : { tags }) },
        {
        detail: intent.detail?.trim() ?? "",
        ...(intent.column === BLOCKED ? { pending: intent.reason?.trim() ?? "" } : {}),
        records: [],
        sessions: sessions.filter((s) => !isHttp(s)),
        check,
        ...(start === undefined ? {} : { start }),
        ...(due === undefined ? {} : { due }),
        owner: intent.owner ?? "self",
        warnings: [],
      })
      const links = [...(intent.links ?? []), ...sessions.filter(isHttp).map((url) => ({ url, label: "session" }))]
      for (const link of links) {
        if (!isHttp(link.url)) throw new Error(`add ${id} link: URL として読める http(s) の URL でない (${link.url})`)
        if ((card.links ?? []).some((l) => l.url === link.url)) continue
        card.links = [...(card.links ?? []), link.label === undefined || link.label.trim() === "" ? { url: link.url } : { url: link.url, label: link.label.trim() }]
      }
      const column = kanban.columns.find((c) => c.id === intent.column)
      if (column === undefined) throw new Error(`add ${id}: ${intent.column} が無い`)
      column.cards.push(card)
      continue
    }
    let found: { board: BoardId; kanban: Kanban; at: { column: number; card: Card } } | undefined
    for (const board of BOARD_IDS) {
      const at = locate(next.boards[board], id)
      if (at !== undefined) found = { board, kanban: next.boards[board], at }
    }
    if (found === undefined) {
      outcome(outcomes, intent, `${intent.op} ${id}: カードが無い`)
      continue
    }
    const { kanban, at } = found
    const view = readCard(at.card)
    const write = (card: Card): Card => writeCard(card, view)
    switch (intent.op) {
      case "move": {
        checkColumn(found.board, intent.column)
        needReason(intent.column, intent.reason, `move ${id}`)
        const pending = intent.column === BLOCKED ? (intent.reason?.trim() ?? "") : undefined
        const current = kanban.columns[at.column]
        if (current?.id === intent.column && (view.pending ?? "") === (pending ?? "")) {
          outcome(outcomes, intent, `move ${id}: 既に ${intent.column}`)
          continue
        }
        view.pending = pending
        if (current?.id !== intent.column) {
          current?.cards.splice(
            current.cards.findIndex((c) => c.id === id),
            1,
          )
          kanban.columns.find((c) => c.id === intent.column)?.cards.push(write(at.card))
          break
        }
        current.cards.splice(
          current.cards.findIndex((c) => c.id === id),
          1,
          write(at.card),
        )
        break
      }
      case "detail": {
        const text = intent.text.trim()
        if (text === "") throw new Error(`detail ${id}: text が空`)
        if (view.detail.includes(text)) {
          outcome(outcomes, intent, `detail ${id}: 既にある`)
          continue
        }
        view.detail = [view.detail, text].filter((s) => s !== "").join("\n\n")
        edit(kanban, at, write)
        break
      }
      case "link": {
        const url = intent.url.trim()
        if (!isHttp(url)) throw new Error(`link ${id}: URL として読める http(s) の URL でない (${intent.url})`)
        if ((at.card.links ?? []).some((l) => l.url === url)) {
          outcome(outcomes, intent, `link ${id}: 既にある ${url}`)
          continue
        }
        const label = intent.label?.trim() ?? ""
        edit(kanban, at, (card) => ({ ...card, links: [...(card.links ?? []), label === "" ? { url } : { url, label }] }))
        break
      }
      case "session": {
        const ref = checkSession(intent.session)
        if (isHttp(ref)) {
          if ((at.card.links ?? []).some((l) => l.url === ref)) {
            outcome(outcomes, intent, `session ${id}: 既にある ${ref}`)
            continue
          }
          edit(kanban, at, (card) => ({ ...card, links: [...(card.links ?? []), { url: ref }] }))
          break
        }
        if (view.sessions.includes(ref)) {
          outcome(outcomes, intent, `session ${id}: 既にある ${ref}`)
          continue
        }
        view.sessions = [...view.sessions, ref]
        edit(kanban, at, write)
        break
      }
      case "comment": {
        const text = intent.text.trim()
        if (text === "") throw new Error(`comment ${id}: text が空`)
        if (!isStamp(intent.at)) throw new Error(`comment ${id}: at は Asia/Tokyo の "YYYY-MM-DD HH:mm" (${String(intent.at)})`)
        const note: Note = { at: intent.at, author: intent.by ?? "Claude Code", text }
        if (view.records.some((n) => n.at === note.at && n.author === note.author && n.text === note.text)) {
          outcome(outcomes, intent, `comment ${id}: 既にある`)
          continue
        }
        view.records = mergeRecords(view.records, [note])
        edit(kanban, at, write)
        break
      }
      case "check": {
        if (intent.on === false) {
          if (!view.check) {
            outcome(outcomes, intent, `check ${id}: 既に下りている`)
            continue
          }
          view.check = false
          edit(kanban, at, write)
          break
        }
        const reason = intent.text?.trim() ?? ""
        // 記録を残すときは日時を intent に持たせる。現在時刻で補うと、同じ intent を別の分に当て直すと記録が増える。
        if (reason !== "" && !isStamp(intent.at))
          throw new Error(`check ${id}: text を渡すときは at が要る (Asia/Tokyo の "YYYY-MM-DD HH:mm") (${String(intent.at)})`)
        if (intent.at !== undefined && !isStamp(intent.at)) throw new Error(`check ${id}: at は Asia/Tokyo の "YYYY-MM-DD HH:mm" (${String(intent.at)})`)
        const note: Note | undefined = reason === "" ? undefined : { at: intent.at ?? "", author: intent.by ?? "Claude Code", text: `${CHECK_TAG}: ${reason}` }
        const changed = !view.check || (note !== undefined && !view.records.some((n) => n.at === note.at && n.author === note.author && n.text === note.text))
        view.check = true
        if (note !== undefined) view.records = mergeRecords(view.records, [note])
        if (!changed) {
          outcome(outcomes, intent, `check ${id}: 既に立っている`)
          continue
        }
        edit(kanban, at, write)
        break
      }
      case "start":
      case "due": {
        if (intent.date !== null && !isDate(intent.date)) throw new Error(`${intent.op} ${id}: YYYY-MM-DD か null でない (${String(intent.date)})`)
        if ((view[intent.op] ?? null) === intent.date) {
          outcome(outcomes, intent, `${intent.op} ${id}: 既に ${intent.date ?? "未設定"}`)
          continue
        }
        if (intent.date === null) delete view[intent.op]
        else view[intent.op] = intent.date
        edit(kanban, at, write)
        break
      }
      case "owner": {
        const who = intent.who ?? "self"
        if (view.owner === who) {
          outcome(outcomes, intent, `owner ${id}: 既に ${who}`)
          continue
        }
        view.owner = who
        edit(kanban, at, write)
        break
      }
      default:
        throw new Error(`unknown op: ${String((intent as { op: string }).op)}`)
    }
  }
  return { page: next, skipped: outcomes.skipped }
}
