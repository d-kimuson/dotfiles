// intent を base (kit の Kanban の JSON) への操作に置き換える。何度当てても同じ結果になる。
import { createHash } from "node:crypto"
import {
  AGENT_TAG,
  ASSIGNMENT_STATUSES,
  assignmentKey,
  CHECK_TAG,
  DUE_PREFIX,
  isAssignmentField,
  isDate,
  isSessionValue,
  isStamp,
  mergeRecords,
  normalizeRole,
  readCard,
  RUNTIME,
  START_PREFIX,
  UNKNOWN,
  writeCard,
  type Assignment,
  type AssignmentStatus,
  type Note,
} from "./card.ts"
import { ARCHIVED, BOARD_IDS, BOARDS, DONE, isHttpUrl, type BoardId, type Card, type Kanban, type Page } from "./page.ts"

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
      start?: string
      due?: string
      agent?: boolean
    }
  | ({ op: "move"; column: string; reason?: string } & CardRef)
  | ({ op: "detail"; text: string } & CardRef)
  | ({ op: "link"; url: string; label?: string } & CardRef)
  | ({ op: "comment"; text: string; at: string; by?: string } & CardRef)
  | ({ op: "check"; on: boolean; text?: string; at?: string; by?: string } & CardRef)
  | ({ op: "start" | "due"; date: string | null } & CardRef)
  | ({ op: "agent"; on: boolean } & CardRef)
  | ({ op: "assign"; role: string; runtime: string; model: string; session?: string; status: AssignmentStatus } & CardRef)
  | { op: "archive"; board?: BoardId }

export type Skipped = { intent: Intent; reason: string }

const BLOCKED = "blocked"
const isHttp = isHttpUrl

// 盤面を変える op。未知の op はカードを探す前に拒む。
const OPS = new Set(["add", "move", "detail", "link", "comment", "check", "start", "due", "agent", "assign", "archive"])
// 5 回目までの op。旧い手順で送られたときに、置き換え先を示して拒む。
const RETIRED: Record<string, string> = { session: "assign を使う", owner: "agent を使う" }

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

// セッションの参照: ローカルは runtime のセッション ID、Claude Code on the web はセッションの URL。
export const PROVIDERS = ["claude-code", "pi", "codex", "command-code"] as const
export type SessionRef = { runtime: string; session: string }

// いまのセッションの runtime と参照を環境変数から出す。どのセッションか分からなければ undefined。
export const sessionFromEnv = (env: Record<string, string | undefined>): SessionRef | undefined => {
  if (env.CLAUDE_CODE_REMOTE === "true" && env.CLAUDE_CODE_REMOTE_SESSION_ID)
    return { runtime: "claude-code", session: `https://claude.ai/code/${env.CLAUDE_CODE_REMOTE_SESSION_ID.replace(/^cse_/, "session_")}` }
  if (env.CLAUDE_CODE_SESSION_ID) return { runtime: "claude-code", session: env.CLAUDE_CODE_SESSION_ID }
  if (env.CODEX_THREAD_ID) return { runtime: "codex", session: env.CODEX_THREAD_ID }
  if (env.PI_SESSION_ID) return { runtime: "pi", session: env.PI_SESSION_ID }
  const scratchpad = env.COMMANDCODE_SCRATCHPAD?.split("/").filter((x) => x !== "")
  if (scratchpad !== undefined && scratchpad.length >= 2) return { runtime: "command-code", session: scratchpad.at(-2) ?? "" }
  return undefined
}

// assign の intent を担当の 1 件にする。書式を壊す値は、直し方を添えて拒む。
const toAssignment = (intent: Extract<Intent, { op: "assign" }>, label: string): Assignment => {
  if (!(ASSIGNMENT_STATUSES as readonly string[]).includes(intent.status)) throw new Error(`${label}: status は ${ASSIGNMENT_STATUSES.join(" か ")} (${String(intent.status)})`)
  if (!isAssignmentField(intent.role)) throw new Error(`${label}: role は空でなく、| と改行を含まない (${String(intent.role)})`)
  if (typeof intent.runtime !== "string" || !RUNTIME.test(intent.runtime)) throw new Error(`${label}: runtime は ${PROVIDERS.join(", ")} などの小文字の名前 (${String(intent.runtime)})`)
  if (!isAssignmentField(intent.model) || intent.model.trim() === UNKNOWN) throw new Error(`${label}: model は runtime に渡したモデル id (${String(intent.model)})`)
  if (intent.session !== undefined && typeof intent.session !== "string") throw new Error(`${label}: session は文字列。board.ts session の JSON の session を使う (${String(intent.session)})`)
  const session = intent.session?.trim() ?? ""
  if (session !== "" && !isSessionValue(session))
    throw new Error(`${label}: session はセッション ID か https://claude.ai/code/session_… の URL。board.ts session の JSON の session を使う (${String(intent.session)})`)
  return { status: intent.status, role: normalizeRole(intent.role), runtime: intent.runtime, model: intent.model.trim(), session: session === "" ? UNKNOWN : session }
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
    if (!OPS.has(intent.op)) {
      const op = String((intent as { op: string }).op)
      throw new Error(`unknown op: ${op}${RETIRED[op] === undefined ? "" : ` (${RETIRED[op]})`}`)
    }
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
      if ((intent as { sessions?: unknown }).sessions !== undefined || (intent as { owner?: unknown }).owner !== undefined)
        throw new Error(`add ${id}: sessions と owner は使わない (担当は assign、Agent に任せるのは agent)`)
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
      if (intent.agent !== undefined && typeof intent.agent !== "boolean") throw new Error(`add ${id} agent: true か false (${String(intent.agent)})`)
      const agent = intent.agent ?? tags.includes(AGENT_TAG)
      const card = writeCard(
        { id, number: maxNumber(kanban) + 1, title, ...(tags.length === 0 ? {} : { tags }) },
        {
        detail: intent.detail?.trim() ?? "",
        ...(intent.column === BLOCKED ? { pending: intent.reason?.trim() ?? "" } : {}),
        assignments: [],
        records: [],
        check,
        ...(start === undefined ? {} : { start }),
        ...(due === undefined ? {} : { due }),
        agent,
        warnings: [],
      })
      const links = intent.links ?? []
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
      case "agent": {
        if (typeof intent.on !== "boolean") throw new Error(`agent ${id}: on は true か false (${String(intent.on)})`)
        if (view.agent === intent.on) {
          outcome(outcomes, intent, `agent ${id}: 既に ${intent.on ? "Agent に任せている" : "自分で進めている"}`)
          continue
        }
        view.agent = intent.on
        edit(kanban, at, write)
        break
      }
      case "assign": {
        const next = toAssignment(intent, `assign ${id}`)
        const index = view.assignments.findIndex((a) => assignmentKey(a) === assignmentKey(next))
        const was = view.assignments[index]
        if (was !== undefined && was.status === next.status && was.model === next.model) {
          outcome(outcomes, intent, `assign ${id}: 同じ担当がある (${next.status} | ${next.role})`)
          continue
        }
        if (was === undefined) view.assignments = [...view.assignments, next]
        else view.assignments = view.assignments.map((a, i) => (i === index ? next : a))
        edit(kanban, at, write)
        break
      }
      default:
        throw new Error(`unknown op: ${String((intent as { op: string }).op)}`)
    }
  }
  return { page: next, skipped: outcomes.skipped }
}
