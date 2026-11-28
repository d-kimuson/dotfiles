#!/usr/bin/env node
// 盤面の正は公開する HTML の kit の base JSON。この CLI は base の読み書きと、レビュー (draft action) の反映を担う。
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import {
  AGENT_TAG,
  authorLabel,
  CHECK_TAG,
  DUE_PREFIX,
  formatAssignment,
  isDate,
  mergeAssignments,
  mergeRecords,
  normalizeCard,
  readCard,
  START_PREFIX,
  tokyoDate,
  tokyoStamp,
  writeCard,
  type CardView,
  type Note,
} from "./card.ts"
import { editsBetween } from "./text-edits.ts"
import { applyIntents, cardId, sessionFromEnv, type Intent, type Skipped } from "./intents.ts"
import {
  ARCHIVED,
  BOARD_IDS,
  BOARDS,
  DONE,
  emptyKanban,
  emptyPage,
  parsePage,
  renderPage,
  type BoardId,
  type Card,
  type Change,
  type ChangeLog,
  type Kanban,
  type Page,
  type Revision,
} from "./page.ts"
import { actionBoard, addressedHas, addressedIncludes, mergeAddressed, parseBrief, parseTargetId, replay, type DraftAction, type Result } from "./replay.ts"

export { cardId, sessionFromEnv }

// --- 表示 -----------------------------------------------------------------

const findInBoard = (kanban: Kanban, id: string): { column: string; card: Card } | undefined => {
  for (const column of kanban.columns) {
    const card = column.cards.find((c) => c.id === id)
    if (card !== undefined) return { column: column.id, card }
  }
  return undefined
}
const findInPage = (page: Page, id: string): { board: BoardId; column: string; card: Card } | undefined => {
  for (const board of BOARD_IDS) {
    const found = findInBoard(page.boards[board], id)
    if (found !== undefined) return { board, ...found }
  }
  return undefined
}

const RESERVED_TAG = (tag: string): boolean => tag === CHECK_TAG || tag === AGENT_TAG || tag.startsWith(START_PREFIX) || tag.startsWith(DUE_PREFIX)

const marks = (column: string, view: CardView, today: string): string => {
  const out: string[] = []
  if (view.check) out.push(CHECK_TAG)
  if (view.agent) out.push(AGENT_TAG)
  if (view.start !== undefined) out.push(`着手可能 ${view.start}`)
  if (view.due !== undefined) {
    const open = column !== DONE && column !== ARCHIVED
    out.push(`期日 ${view.due}${open && view.due < today ? " 超過" : open && view.due === today ? " 今日" : ""}`)
  }
  return out.length === 0 ? "" : ` (${out.join(", ")})`
}

const indent = (text: string, prefix = "    "): string[] => text.split("\n").map((line) => (line.trim() === "" ? "" : `${prefix}${line}`))

export const renderText = (page: Page, options: { archived?: boolean; today?: string } = {}): string => {
  const today = options.today ?? tokyoDate(new Date())
  const lines: string[] = [`今日 (Asia/Tokyo): ${today}`]
  for (const board of BOARD_IDS) {
    lines.push(`# ${board}`)
    for (const column of page.boards[board].columns) {
      if (options.archived !== true && column.id === ARCHIVED) continue
      lines.push(`## ${column.label} (${column.id}) ${column.cards.length}`)
      for (const card of column.cards) {
        const view = readCard(card)
        const tags = (card.tags ?? []).filter((t) => !RESERVED_TAG(t))
        const tagText = tags.length === 0 ? "" : ` [${tags.join(", ")}]`
        const links = (card.links ?? []).map((l) => l.url).join(" ")
        lines.push(`- TASK-${card.number} ${card.id} ${card.title}${tagText}${marks(column.id, view, today)}${links === "" ? "" : ` ${links}`}`)
        if (view.detail !== "") lines.push(...indent(view.detail))
        if (view.pending !== undefined) {
          lines.push("    ## Pending の理由")
          lines.push(...indent(view.pending))
        }
        if (view.assignments.length > 0) {
          lines.push("    ## 担当")
          for (const a of view.assignments) lines.push(`    ${formatAssignment(a)}`)
        }
        for (const note of view.records) {
          const [first = "", ...rest] = note.text.split("\n")
          lines.push(`    > ${note.at} ${note.author}: ${first}`)
          lines.push(...rest.map((line) => `    >   ${line}`))
        }
        for (const warning of view.warnings) lines.push(`    ! ${warning}`)
      }
    }
    if (options.archived !== true) {
      const archived = page.boards[board].columns.find((c) => c.id === ARCHIVED)
      if (archived !== undefined && archived.cards.length > 0) lines.push(`(${board} のアーカイブ ${archived.cards.length} 枚は --archived で出す)`)
    }
  }
  return lines.join("\n")
}

// --- change log ------------------------------------------------------------

const stampName = (now: Date): string => tokyoStamp(now).replace(/[-:]/g, "").replace(" ", ".")
// 変更履歴はページの重さになる。直近の 20 件だけを残す。
const REVISIONS = 20
const nextRevision = (log: ChangeLog, now: Date): Revision => {
  const name = stampName(now)
  const used = new Set((log.revisions ?? []).map((r) => r.revision))
  let revision = name
  for (let i = 2; used.has(revision); i++) revision = `${name}-${i}`
  return { revision, changes: [] }
}
const withRevision = (log: ChangeLog, changes: Change[], now: Date): ChangeLog => {
  if (changes.length === 0) return log
  const revision = nextRevision(log, now)
  revision.changes = changes
  return { ...log, revisions: [...(log.revisions ?? []), revision].slice(-REVISIONS) }
}

const cardLabel = (card: Card | undefined, id: string): string => (card === undefined ? id : `TASK-${card.number} ${card.title}`)
const targetOf = (board: BoardId, id: string): string => `card:${id}@${BOARDS[board].page}`

const intentSummary = (intent: Intent): string => {
  switch (intent.op) {
    case "add":
      return "追加"
    case "move":
      return `→ ${intent.column}`
    case "detail":
      return "説明を更新"
    case "link":
      return "リンクを追加"
    case "comment":
      return "記録を追加"
    case "check":
      return intent.on ? "確認が必要を立てる" : "確認が必要を下ろす"
    case "start":
      return intent.date === null ? "着手可能日を解除" : `着手可能日 ${intent.date}`
    case "due":
      return intent.date === null ? "期日を解除" : `期日 ${intent.date}`
    case "agent":
      return intent.on ? "Agent に任せる" : "Agent に任せるのをやめる"
    case "assign":
      return `担当 ${intent.status} | ${intent.role}`
    case "archive":
      return "アーカイブ"
  }
}

export const changesForIntents = (before: Page, after: Page, intents: Intent[], skipped: Skipped[]): Change[] => {
  const skippedSet = new Set(skipped.map((s) => s.intent))
  const changes: Change[] = []
  // 同じ archive intent が 2 つあっても、同じカードの変更を 2 度記録しない。
  const moved: string[] = []
  for (const [i, intent] of intents.entries()) {
    // archive は確認が必要で止めたカードがあっても、ほかに移したカードの変更を記録する。
    if (intent.op === "archive") {
      const boards = intent.board === undefined ? [...BOARD_IDS] : [intent.board]
      for (const board of boards) {
        const was = new Set(before.boards[board].columns.find((c) => c.id === ARCHIVED)?.cards.map((c) => c.id) ?? [])
        for (const card of after.boards[board].columns.find((c) => c.id === ARCHIVED)?.cards ?? []) {
          const key = `${board}/${card.id}`
          if (was.has(card.id) || moved.includes(key)) continue
          moved.push(key)
          changes.push({ id: `${i}-${card.id}`, title: `${cardLabel(card, card.id)}: アーカイブ`, target: targetOf(board, card.id) })
        }
      }
      continue
    }
    if (skippedSet.has(intent)) continue
    const id = intent.op === "add" ? cardId(intent.key) : (intent.card ?? cardId(intent.key ?? ""))
    const found = findInPage(after, id)
    if (found === undefined) continue
    changes.push({ id: `${i}`, title: `${cardLabel(found.card, id)}: ${intentSummary(intent)}`, target: targetOf(found.board, id) })
  }
  return changes
}

const ACTION_SUMMARY: Record<string, string> = {
  ADD_CARD: "追加",
  MOVE_CARD: "移動",
  SET_CARD_TITLE: "題を変更",
  SET_CARD_DESCRIPTION: "説明を更新",
  SET_CARD_ASSIGNEE: "assignee を変更 (書き出すときに消す)",
  ADD_CARD_TAG: "タグを追加",
  REMOVE_CARD_TAG: "タグを削除",
  ADD_CARD_LINK: "リンクを追加",
  REMOVE_CARD_LINK: "リンクを削除",
}
const changesForActions = (after: Page, actions: DraftAction[], results: Result[]): Change[] => {
  const applied = new Set(results.filter((r) => r.status === "applied").map((r) => r.id))
  const changes: Change[] = []
  for (const action of actions) {
    if (!applied.has(action.id)) continue
    const target = parseTargetId(action.target?.id)
    const id = action.type === "ADD_CARD" ? (typeof action.payload?.id === "string" ? action.payload.id : undefined) : target?.id
    if (id === undefined) continue
    const found = findInPage(after, id)
    const board = found?.board ?? target?.board
    if (board === undefined) continue
    changes.push({ id: action.id, title: `${cardLabel(found?.card, id)}: ${ACTION_SUMMARY[action.type] ?? action.type}`, target: targetOf(board, id) })
  }
  return changes
}

// --- draft の再生 ----------------------------------------------------------

const byCreated = (a: DraftAction, b: DraftAction): number =>
  a.createdAt === b.createdAt ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.createdAt < b.createdAt ? -1 : 1

const groupByBoard = (actions: DraftAction[]): { byBoard: Map<BoardId, DraftAction[]>; orphan: Result[] } => {
  const byBoard = new Map<BoardId, DraftAction[]>(BOARD_IDS.map((b) => [b, []]))
  const orphan: Result[] = []
  for (const action of actions) {
    if (action.type === "comment") continue
    const board = actionBoard(action)
    if (board === undefined) orphan.push({ id: action.id, status: "stale", reason: "target-missing" })
    else byBoard.get(board)?.push(action)
  }
  return { byBoard, orphan }
}

const replayPage = (page: Page, actions: DraftAction[]): { page: Page; results: Map<string, Result>; boards: Map<BoardId, Result[]> } => {
  const { byBoard, orphan } = groupByBoard(actions)
  // comment は base を変えない。結果だけ返す。
  const results = new Map<string, Result>([...orphan, ...actions.filter((a) => a.type === "comment").map((a) => ({ id: a.id, status: "comment" as const }))].map((r) => [r.id, r]))
  const boards = new Map<BoardId, Result[]>()
  const next: Page = { boards: { ...page.boards }, changes: page.changes }
  for (const board of BOARD_IDS) {
    const list = byBoard.get(board) ?? []
    const out = replay(page.boards[board], board, list)
    next.boards[board] = out.board
    boards.set(board, out.results)
    for (const result of out.results) results.set(result.id, result)
  }
  return { page: next, results, boards }
}

// レビューは description の全体を置き換える。本人が古い base を見て書いた説明で `## 記録` と `## 担当` の行が消えないよう、和集合にする。
// 担当は鍵ごとに合わせ、どちらかが Done なら Done にする。
const unionSections = (before: Page, after: Page): Page => {
  for (const board of BOARD_IDS) {
    for (const column of after.boards[board].columns) {
      column.cards = column.cards.map((card) => {
        const was = findInBoard(before.boards[board], card.id)?.card
        if (was === undefined || was.description === card.description) return card
        const view = readCard(card)
        const old = readCard(was)
        return writeCard(card, { ...view, records: mergeRecords(old.records, view.records), assignments: mergeAssignments(old.assignments, view.assignments) })
      })
    }
  }
  return after
}

// 5 回目までの形 (assignee・`## セッション`) のカードを今の形に移す。書き戻すよう、移したカードを change log に載せる。
export const normalizePage = (page: Page): { page: Page; changes: Change[] } => {
  const changes: Change[] = []
  const next: Page = { boards: { ...page.boards }, changes: page.changes }
  for (const board of BOARD_IDS) {
    const kanban = structuredClone(page.boards[board])
    for (const column of kanban.columns) {
      column.cards = column.cards.map((card) => {
        const out = normalizeCard(card)
        if (out.migrated) changes.push({ id: `migrate-${card.id}`, title: `${cardLabel(out.card, card.id)}: 古い形式を移行`, target: targetOf(board, card.id) })
        return out.card
      })
    }
    next.boards[board] = kanban
  }
  return { page: next, changes }
}

// --- レビューの反映 --------------------------------------------------------

export type ReviewOutput = { page: Page; results: Result[]; addressed: string; comments: DraftAction[]; handled: string[] }

// brief (kit の Copy changes & comments) の draft を base に当て、addressed を次の値にする。
// keep の id は本人に確かめたいものとして見送り、draft に残す。
export function applyReview(before: Page, markdown: string, options: { keep?: string[]; now?: Date } = {}): ReviewOutput {
  const parsed = parseBrief(markdown)
  // draft は、addressed を書き戻したあとも閲覧者がページを開くまで残ることがある。処理済みの action は当て直さない。
  const handled = parsed.draft.filter((a) => addressedHas(before.changes.addressed, a.id)).map((a) => a.id)
  const brief = { ...parsed, draft: parsed.draft.filter((a) => !handled.includes(a.id)), comments: parsed.comments.filter((a) => !handled.includes(a.id)) }
  const keep = new Set(options.keep ?? [])
  for (const id of keep) if (!brief.draft.some((a) => a.id === id)) throw new Error(`--keep ${id}: brief の draft に無い`)
  const now = options.now ?? new Date()
  // 見送った ADD_CARD のカードを対象にする action と、そのカードを挿入位置 (payload.before) に指す MOVE_CARD も見送る。
  // base にそのカードが無いので stale になり、draft から消えてしまう。
  const keptCards = new Set(
    brief.draft.flatMap((a) => (keep.has(a.id) && a.type === "ADD_CARD" && typeof a.payload?.id === "string" ? [a.payload.id] : [])),
  )
  const autoKeep = new Set<string>()
  let grew = keptCards.size > 0
  while (grew) {
    grew = false
    for (const a of brief.draft) {
      if (keep.has(a.id) || autoKeep.has(a.id)) continue
      const target = parseTargetId(a.target?.id)
      const added = a.type === "ADD_CARD" && typeof a.payload?.id === "string" ? a.payload.id : undefined
      const before = a.type === "MOVE_CARD" && typeof a.payload?.before === "string" ? a.payload.before : undefined
      if ((target?.kind === "card" && keptCards.has(target.id)) || (added !== undefined && keptCards.has(added)) || (before !== undefined && keptCards.has(before))) {
        autoKeep.add(a.id)
        grew = true
      }
    }
  }
  const skippedKeep = new Set([...keep, ...autoKeep])
  const draft = brief.draft.filter((a) => !skippedKeep.has(a.id))
  const replayed = replayPage(before, draft)
  const after = normalizePage(unionSections(before, replayed.page))
  const ids = draft.map((a) => a.id)
  const addressed = mergeAddressed(before.changes.addressed, ids, [...skippedKeep])
  // 見送りが無いときは、brief が示す addressed を計算した値が含むはず。別の端末の brief を先に反映していると計算値の方が広くなる。
  if (skippedKeep.size === 0 && brief.addressed !== "" && !addressedIncludes(addressed, brief.addressed))
    throw new Error(`brief の addressed (${brief.addressed}) と計算した値 (${addressed}) が違う`)
  const results = brief.draft.map((a) =>
    keep.has(a.id)
      ? { id: a.id, status: "stale" as const, reason: "kept" }
      : autoKeep.has(a.id)
        ? { id: a.id, status: "stale" as const, reason: "kept-add" }
        : (replayed.results.get(a.id) ?? { id: a.id, status: "stale" as const, reason: "target-missing" }),
  )
  const changes = [...changesForActions(after.page, draft, results), ...after.changes]
  const page: Page = { boards: after.page.boards, changes: { ...withRevision(after.page.changes, changes, now), addressed } }
  return { page, results, addressed, comments: brief.comments, handled }
}

// --- 入出力 ----------------------------------------------------------------

// 公開するページは 1 つの HTML なので、assets/agent-office.js をページの text/plain の script に埋め込む。
const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "..", "assets")
const OFFICE_SLOT = /<script type="text\/plain" id="ptb-agent-office" data-src="agent-office\.js"><\/script>/
export const pageTemplate = (assets = ASSETS): string => {
  const template = readFileSync(join(assets, "board.html"), "utf8")
  if (!OFFICE_SLOT.test(template)) throw new Error("board.html に agent-office.js の埋め込み先が無い")
  const source = readFileSync(join(assets, "agent-office.js"), "utf8").replace(/<\/(script)/gi, "<\\/$1")
  return template.replace(OFFICE_SLOT, () => `<script type="text/plain" id="ptb-agent-office">\n${source.trimEnd()}\n</script>`)
}

// 古いテンプレートのページに書くと、カードだけが新しい形式になり、ページの UI と食い違う。
const KIT_VERSION_LINE = /const KIT_VERSION = "([^"]+)"/
const assertCurrentTemplate = (html: string): void => {
  const want = KIT_VERSION_LINE.exec(pageTemplate())?.[1]
  const got = KIT_VERSION_LINE.exec(html)?.[1]
  if (got !== want || !html.includes('id="ptb-agent-office"'))
    throw new Error(`ページのテンプレートが古い (kit ${got ?? "不明"})。先に board.ts render <page.html> <out.html> で作り直す`)
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
// 入力のパスに - を渡すと標準入力から読む。
const readInput = (path: string): string => readFileSync(path === "-" ? 0 : path, "utf8")
const readJson = (path: string): Json => JSON.parse(readInput(path)) as Json
// HTML を標準出力に書くときは、要約を標準エラーに出して HTML に混ぜない。
const printSummary = (summary: unknown, outPath: string): void => {
  const text = JSON.stringify(summary, null, 2)
  if (outPath === "-") console.error(text)
  else console.log(text)
}
const writeOutput = (html: string, outPath: string): void => {
  if (outPath === "-") {
    process.stdout.write(html)
    return
  }
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, html)
}
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)

const readDumpActions = (dumpDir: string): DraftAction[] => {
  const dir = join(dumpDir, "actions")
  if (!existsSync(dir)) throw new Error(`${dir} が無い。db の dump (actions・notes・attrs) を渡す`)
  const actions: DraftAction[] = []
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const value = readJson(join(dir, file))
    if (!isObject(value) || typeof value.id !== "string" || typeof value.type !== "string" || typeof value.createdAt !== "string" || !isObject(value.target) || typeof value.target.id !== "string") {
      console.error(`skip action: ${file} の形が崩れている`)
      continue
    }
    actions.push({
      id: value.id,
      type: value.type,
      target: { type: typeof value.target.type === "string" ? value.target.type : "element", id: value.target.id },
      payload: isObject(value.payload) ? value.payload : {},
      createdAt: value.createdAt,
    })
  }
  return actions
}

const readDumpNotes = (dumpDir: string): { board: BoardId; card: string; body: string; author?: { id?: string; name?: string }; createdAt: string }[] => {
  const dir = join(dumpDir, "notes")
  if (!existsSync(dir)) return []
  const notes: { board: BoardId; card: string; body: string; author?: { id?: string; name?: string }; createdAt: string }[] = []
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const value = readJson(join(dir, file))
    if (!isObject(value) || typeof value.board !== "string" || typeof value.card !== "string" || typeof value.body !== "string" || typeof value.createdAt !== "string") {
      console.error(`skip note: ${file} の形が崩れている`)
      continue
    }
    if (!(BOARD_IDS as readonly string[]).includes(value.board)) {
      console.error(`skip note: ${file} の board が知らない (${value.board})`)
      continue
    }
    const author = isObject(value.author) ? { ...(typeof value.author.id === "string" ? { id: value.author.id } : {}), ...(typeof value.author.name === "string" ? { name: value.author.name } : {}) } : undefined
    notes.push({ board: value.board as BoardId, card: value.card, body: value.body, ...(author === undefined ? {} : { author }), createdAt: value.createdAt })
  }
  return notes
}

type DumpAttr = { board: BoardId; card: string; attr: "check" | "start" | "due" | "owner"; value: true | string }
const readDumpAttrs = (dumpDir: string): DumpAttr[] => {
  const dir = join(dumpDir, "attrs")
  if (!existsSync(dir)) return []
  const attrs: DumpAttr[] = []
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const value = readJson(join(dir, file))
    const attr = isObject(value) ? value.attr : undefined
    const board = isObject(value) ? value.board : undefined
    const card = isObject(value) ? value.card : undefined
    if (typeof board !== "string" || !(BOARD_IDS as readonly string[]).includes(board) || typeof card !== "string" || (attr !== "check" && attr !== "start" && attr !== "due" && attr !== "owner")) {
      console.error(`skip attr: ${file} の形が崩れている`)
      continue
    }
    const raw = isObject(value) ? value.value : undefined
    if (attr === "check" && raw !== true) {
      console.error(`skip attr: ${file} の value が true でない`)
      continue
    }
    if (attr === "owner" && raw !== "self" && raw !== "agent") {
      console.error(`skip attr: ${file} の value が owner でない`)
      continue
    }
    if ((attr === "start" || attr === "due") && !isDate(raw)) {
      console.error(`skip attr: ${file} の value が日付でない`)
      continue
    }
    attrs.push({ board: board as BoardId, card, attr, value: raw as true | string })
  }
  return attrs
}

// 4 回目の db の dump を base に畳む。再生の規則は kit と同じ (replay) で、comment は base に書かない。
export const foldDump = (dumpDir: string): { page: Page; warnings: string[] } => {
  const actions = readDumpActions(dumpDir).sort(byCreated)
  const page = emptyPage()
  const warnings: string[] = []
  const { byBoard } = groupByBoard(actions)
  for (const board of BOARD_IDS) {
    const out = replay(emptyKanban(board), board, byBoard.get(board) ?? [])
    page.boards[board] = out.board
    for (const result of out.results) if (result.status === "stale") warnings.push(`${board} の ${result.id} (${result.reason}) を適用できなかった`)
  }
  const records = new Map<string, Note[]>()
  for (const note of readDumpNotes(dumpDir)) {
    const key = `${note.board}/${note.card}`
    if (findInBoard(page.boards[note.board], note.card) === undefined) {
      warnings.push(`カードの無いコメント: ${key} ${note.createdAt}`)
      continue
    }
    const at = tokyoStamp(new Date(note.createdAt))
    records.set(key, [...(records.get(key) ?? []), { at, author: authorLabel(note.author), text: note.body }])
  }
  const views = new Map<string, CardView>()
  const viewOf = (board: BoardId, card: Card): CardView => {
    const key = `${board}/${card.id}`
    const cached = views.get(key)
    if (cached !== undefined) return cached
    const view = readCard(card)
    views.set(key, view)
    return view
  }
  for (const attr of readDumpAttrs(dumpDir)) {
    const found = findInBoard(page.boards[attr.board], attr.card)
    if (found === undefined) {
      warnings.push(`カードの無い属性: ${attr.board}~${attr.card}~${attr.attr}`)
      continue
    }
    const view = viewOf(attr.board, found.card)
    if (attr.attr === "check") view.check = true
    // 4 回目の db は Agent に任せていることを attr "owner" の値 agent で持っていた。
    else if (attr.attr === "owner") view.agent = attr.value === "agent"
    else view[attr.attr] = attr.value as string
  }
  for (const board of BOARD_IDS) {
    for (const column of page.boards[board].columns) {
      column.cards = column.cards.map((card) => {
        const view = viewOf(board, card)
        view.records = mergeRecords(view.records, records.get(`${board}/${card.id}`) ?? [])
        return writeCard(card, view)
      })
    }
  }
  return { page, warnings }
}

// --- CLI -------------------------------------------------------------------

const usage = `usage:
  board.ts show <page.html> [--json] [--archived]
                                          盤面を表示する。base の JSON と change log を読み、カードを人が読める形か JSON で出す
  board.ts apply <page.html> <intents.json> <out.html>
                                          intent を base に当て、公開用の HTML を書き出す
  board.ts review <page.html> <brief.md|draft.json> <out.html> [--keep <id>...]
                                          brief (kit の Copy changes & comments) か kit の draft action の JSON 配列を base に反映し、addressed を更新する。
                                          --keep の id は見送り、draft に残す
  board.ts migrate-db <dump-dir> <page.html> <out.html>
                                          4 回目の db の dump (actions・notes・attrs) を base に畳んで HTML を書き出す
  board.ts edits <before.html> <after.html> [--max <n>]
                                          書く前と後の HTML の差分を、順に当てる置き換え (oldText と newText) の JSON 配列で出す。
                                          --max の件数を超えるか範囲を絞れなければ失敗する
  入力のパスに - を渡すと標準入力から読む
  board.ts template [out.html]            カードを持たないページ (agent-office.js を埋め込んだ assets/board.html) を書き出す
  board.ts render <page.html> <out.html>  盤面と change log を保ったまま、ページを今のテンプレートで書き直す
  board.ts id <key>                       キー (チケット URL など) からカード id を出す
  board.ts session                        いまのセッションの runtime と参照を {"runtime","session"} の JSON で出す`

type Flags = { values: Map<string, string[]>; rest: string[] }
const parseFlags = (argv: string[], known: string[]): Flags => {
  const values = new Map<string, string[]>(known.map((k) => [k, []]))
  const rest: string[] = []
  const boolean = ["--json", "--archived"]
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? ""
    const name = arg.split("=")[0] ?? ""
    if (!known.includes(name)) {
      rest.push(arg)
      continue
    }
    if (boolean.includes(name)) {
      values.get(name)?.push("true")
      continue
    }
    const inline = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : undefined
    if (inline !== undefined) {
      values.get(name)?.push(inline)
      continue
    }
    while (i + 1 < argv.length && !(argv[i + 1] ?? "").startsWith("--")) {
      const next = argv[i + 1]
      if (next === undefined) break
      values.get(name)?.push(next)
      i++
    }
  }
  return { values, rest }
}

const main = (argv: string[]): void => {
  const flags = parseFlags(argv, ["--json", "--archived", "--keep", "--max"])
  const [command, ...rest] = flags.rest
  const json = (flags.values.get("--json")?.length ?? 0) > 0
  const archived = (flags.values.get("--archived")?.length ?? 0) > 0
  if (command === "show" && rest[0] !== undefined) {
    const page = parsePage(readInput(rest[0]))
    console.log(json ? JSON.stringify({ today: tokyoDate(new Date()), boards: page.boards, changes: page.changes }, null, 2) : renderText(page, { archived }))
    return
  }
  if (command === "edits" && rest[0] !== undefined && rest[1] !== undefined) {
    const max = flags.values.get("--max")?.[0]
    const edits = editsBetween(readInput(rest[0]), readInput(rest[1]), max === undefined ? undefined : Number(max))
    if (edits.length === 0) console.error("差分が無い。書き戻さない")
    console.log(JSON.stringify(edits))
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
    console.log(JSON.stringify(ref))
    return
  }
  if (command === "template") {
    writeOutput(pageTemplate(), rest[0] ?? "-")
    return
  }
  if (command === "render" && rest[0] !== undefined && rest[1] !== undefined) {
    // 盤面と change log はそのまま、ページの外側を今のテンプレートにする。
    const normalized = normalizePage(parsePage(readInput(rest[0])))
    const page: Page = { ...normalized.page, changes: withRevision(normalized.page.changes, normalized.changes, new Date()) }
    writeOutput(renderPage(pageTemplate(), page), rest[1])
    printSummary({ migrated: normalized.changes.length, addressed: page.changes.addressed ?? "" }, rest[1])
    return
  }
  if (command === "apply" && rest[0] !== undefined && rest[1] !== undefined && rest[2] !== undefined) {
    const html = readInput(rest[0])
    assertCurrentTemplate(html)
    const before = parsePage(html)
    const intents = readJson(rest[1])
    if (!Array.isArray(intents)) throw new Error("intents.json は配列であること")
    const now = new Date()
    const result = applyIntents(before, intents as Intent[], { now })
    for (const skipped of result.skipped) console.error(`skip: ${skipped.reason}`)
    const normalized = normalizePage(result.page)
    const changes = [...changesForIntents(before, normalized.page, intents as Intent[], result.skipped), ...normalized.changes]
    const page: Page = { ...normalized.page, changes: withRevision(normalized.page.changes, changes, now) }
    writeOutput(renderPage(html, page), rest[2])
    printSummary({ changes: changes.length, skipped: result.skipped.length, addressed: page.changes.addressed ?? "" }, rest[2])
    return
  }
  if (command === "review" && rest[0] !== undefined && rest[1] !== undefined && rest[2] !== undefined) {
    const html = readInput(rest[0])
    assertCurrentTemplate(html)
    const before = parsePage(html)
    const output = applyReview(before, readInput(rest[1]), { keep: flags.values.get("--keep") ?? [] })
    writeOutput(renderPage(html, output.page), rest[2])
    printSummary(
      {
        results: output.results,
        addressed: output.addressed,
        handled: output.handled,
        comments: output.comments.map((c) => ({ id: c.id, target: c.target.id, body: c.payload?.body })),
      },
      rest[2],
    )
    return
  }
  if (command === "migrate-db" && rest[0] !== undefined && rest[1] !== undefined && rest[2] !== undefined) {
    const { page, warnings } = foldDump(rest[0])
    for (const warning of warnings) console.error(`warn: ${warning}`)
    const template = readInput(rest[1])
    // 移行は base を dump から作り直す。change log はテンプレートのものを残す。
    const changes = parsePage(template).changes
    writeOutput(renderPage(template, { ...page, changes }), rest[2])
    const counts = BOARD_IDS.map((b) => `${b}: ${page.boards[b].columns.map((c) => `${c.id} ${c.cards.length}`).join(", ")}`)
    console.error(counts.join("\n"))
    console.log(JSON.stringify({ boards: page.boards, warnings }, null, 2))
    return
  }
  console.error(usage)
  process.exit(2)
}

const entry = process.argv[1]
if (entry !== undefined && import.meta.url === pathToFileURL(realpathSync(entry)).href) main(process.argv.slice(2))
