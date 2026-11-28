// description の節とタグからカードの状態を読み書きする。kit が知らない項目は持たない。
import type { Card } from "./page.ts"

export const TIME_ZONE = "Asia/Tokyo"
// 表し方は 2 つに分ける。確認が必要・Agent に任せている・日付はタグ、担当と状況の記録は description の節。
// kit の assignee は使わない。
export const CHECK_TAG = "確認が必要"
export const AGENT_TAG = "Agent"
export const START_PREFIX = "着手可能 "
export const DUE_PREFIX = "期日 "
const PENDING_HEADING = "## Pending の理由"
const LEGACY_PENDING_HEADING = "## ブロック理由"
const ASSIGNMENTS_HEADING = "## 担当"
const RECORDS_HEADING = "## 記録"
// 5 回目までの、作業したセッションを並べた節。読むときに担当 (Done) へ移す。
const LEGACY_SESSIONS_HEADING = "## セッション"

// extra は、記録の下に本人が書いた書式外の行 (字下げの無い行と空行)。原文のまま記録の後ろへ書き戻す。
export type Note = { at: string; author: string; text: string; extra?: string[] }
// 担当は 1 行 1 件: `- <status> | <role> | <runtime> | <model> | <session>`。session は担当の Agent のセッションの参照。
export const ASSIGNMENT_STATUSES = ["In Progress", "Done"] as const
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number]
export type Assignment = { status: AssignmentStatus; role: string; runtime: string; model: string; session: string }
export type CardView = {
  detail: string
  pending?: string
  assignments: Assignment[]
  // `## 担当` の節にあった書式外の行。原文のまま担当の後ろへ書き戻す。
  assignmentExtra?: string[]
  records: Note[]
  // `## 記録` の先頭の記録より前にあった行 (書式外の行・字下げした行・空行)。原文のまま書き戻す。
  recordPreamble?: string[]
  check: boolean
  start?: string
  due?: string
  agent: boolean
  warnings: string[]
}

const pad = (n: number): string => String(n).padStart(2, "0")
// at は Asia/Tokyo の "YYYY-MM-DD HH:mm"。
export const tokyoStamp = (now: Date): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  const part = (type: string): string => parts.find((p) => p.type === type)?.value ?? ""
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}`
}
export const tokyoDate = (now: Date): string => tokyoStamp(now).slice(0, 10)
export const isStamp = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v) && isDate(v.slice(0, 10)) && Number(v.slice(11, 13)) < 24 && Number(v.slice(14, 16)) < 60
export const isDate = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const year = Number(v.slice(0, 4))
  const d = new Date(`${v}T00:00:00Z`)
  return year >= 2000 && year <= 2100 && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}
export const shortDate = (date: string): string => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`

const NOTE_LINE = /^- (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) ([^:]+): ?(.*)$/

type Sections = { detail: string[]; pending: string[]; assignments: string[]; records: string[]; sessions: string[] }
const splitSections = (description: string | undefined): Sections => {
  const sections: Sections = { detail: [], pending: [], assignments: [], records: [], sessions: [] }
  let current: keyof Sections = "detail"
  for (const line of (description ?? "").split("\n")) {
    const heading = line.trim()
    if (heading === PENDING_HEADING || heading === LEGACY_PENDING_HEADING) current = "pending"
    else if (heading === ASSIGNMENTS_HEADING) current = "assignments"
    else if (heading === RECORDS_HEADING) current = "records"
    else if (heading === LEGACY_SESSIONS_HEADING) current = "sessions"
    // 本人が書いた見出しは、原文のまま本文に残す。
    else if (/^#{1,6} /.test(heading)) {
      current = "detail"
      sections.detail.push(line)
    } else sections[current].push(line)
  }
  return sections
}

// 本人が kit の詳細の説明欄に自由に書いた行も残す。字下げした続き行は本文、字下げの無い書式外の行は extra に持つ。
// 本人の字下げと空行は、trim しなかった行のまま書き戻す。先頭の記録より前の行は原文として保つ。
const parseRecords = (lines: string[]): { notes: Note[]; preamble: string[] } => {
  const notes: Note[] = []
  const preamble: string[] = []
  // 節の末尾の空行は、次の節との間の空行と同じになるので落とす (formatDescription と対にする)。
  const body = [...lines]
  while (body.length > 0 && (body.at(-1) ?? "").trim() === "") body.pop()
  for (const line of body) {
    const last = notes.at(-1)
    const indented = /^[ \t]/.test(line)
    // 字下げした行は、記録の書式に見えても続き行にする。intent が書く複数行の本文を、新しい記録にしない。
    const m = indented ? null : NOTE_LINE.exec(line.trimEnd())
    if (m !== null) {
      notes.push({ at: m[1] ?? "", author: m[2] ?? "", text: m[3] ?? "" })
      continue
    }
    if (last === undefined) {
      preamble.push(line)
      continue
    }
    if (indented) {
      // 書式が続き行に足す 4 文字分だけを外し、本人がさらに深く入れた字下げは残す。
      last.text = `${last.text}\n${line.startsWith("    ") ? line.slice(4) : line.replace(/^[ \t]+/, "")}`
      continue
    }
    last.extra = [...(last.extra ?? []), line]
  }
  return { notes, preamble }
}

// 担当の項目は | で区切るので、項目の中に | と改行を持たない。役割は連続する空白を 1 つにそろえる。
export const isAssignmentField = (v: unknown): v is string => typeof v === "string" && v.trim() !== "" && !/[|\n]/.test(v)
export const normalizeRole = (role: string): string => role.trim().replace(/\s+/g, " ")
export const RUNTIME = /^[a-z][a-z0-9-]*$/
// 分からない項目は - と書く。モデルの - は 5 回目までの節から移した担当だけが持つ。
export const UNKNOWN = "-"
const WEB_SESSION = /^https:\/\/claude\.ai\/code\/session_[A-Za-z0-9_-]+$/
export const isSessionValue = (v: unknown): v is string => typeof v === "string" && (WEB_SESSION.test(v) || /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(v))
// 同じ担当かどうかは (役割, runtime, セッション) で決める。状態とモデルは更新する値である。
export const assignmentKey = (a: Pick<Assignment, "role" | "runtime" | "session">): string => [normalizeRole(a.role), a.runtime, a.session].join("\u0000")
export const parseAssignment = (line: string): Assignment | undefined => {
  const m = /^- (.*)$/.exec(line.trimEnd())
  const fields = m?.[1]?.split("|").map((f) => f.trim())
  if (fields?.length !== 5) return undefined
  const [status = "", role = "", runtime = "", model = "", session = ""] = fields
  if (!(ASSIGNMENT_STATUSES as readonly string[]).includes(status) || !isAssignmentField(role) || !RUNTIME.test(runtime) || !isAssignmentField(model)) return undefined
  if (session !== UNKNOWN && !isSessionValue(session)) return undefined
  return { status: status as AssignmentStatus, role: normalizeRole(role), runtime, model, session }
}
const parseAssignments = (lines: string[]): { assignments: Assignment[]; extra: string[] } => {
  const assignments: Assignment[] = []
  const extra: string[] = []
  for (const line of lines) {
    if (line.trim() === "") continue
    const a = parseAssignment(line)
    if (a === undefined) extra.push(line)
    else assignments.push(a)
  }
  return { assignments, extra }
}
// 5 回目までの `## セッション` の行 (`<provider> <id>` か web の URL) を、終わった作業の担当として読む。
const legacyAssignments = (lines: string[]): { assignments: Assignment[]; extra: string[] } => {
  const assignments: Assignment[] = []
  const extra: string[] = []
  for (const line of lines) {
    const ref = line.trim().replace(/^- /, "")
    if (ref === "") continue
    const [provider = "", id, ...rest] = ref.split(/\s+/)
    if (WEB_SESSION.test(ref)) assignments.push({ status: "Done", role: "作業", runtime: "claude-code", model: UNKNOWN, session: ref })
    else if (rest.length === 0 && id !== undefined && RUNTIME.test(provider) && isSessionValue(id)) assignments.push({ status: "Done", role: "作業", runtime: provider, model: UNKNOWN, session: id })
    else extra.push(`- ${ref}`)
  }
  return { assignments, extra }
}
export const formatAssignment = (a: Assignment): string => `- ${a.status} | ${a.role} | ${a.runtime} | ${a.model} | ${a.session}`
// レビューの再生で担当を合わせる。鍵ごとの和集合で、どちらかが Done なら Done にする。状態以外は a (base) の値を採る。
export const mergeAssignments = (a: Assignment[], b: Assignment[]): Assignment[] => {
  const out = new Map(a.map((x) => [assignmentKey(x), x]))
  for (const x of b) {
    const key = assignmentKey(x)
    const was = out.get(key)
    if (was === undefined) out.set(key, x)
    else if (x.status === "Done" && was.status !== "Done") out.set(key, { ...was, status: "Done" })
  }
  return [...out.values()]
}

const tagValue = (tags: string[], prefix: string): { value?: string; count: number } => {
  const found = tags.filter((t) => t.startsWith(prefix))
  const valid = found.map((t) => t.slice(prefix.length)).filter(isDate)
  // ページと同じく、末尾 (最後に足したもの) を採る。
  const last = valid.at(-1)
  return { ...(last === undefined ? {} : { value: last }), count: found.length }
}

export const readCard = (card: Card): CardView => {
  const tags = card.tags ?? []
  const sections = splitSections(card.description)
  const records = parseRecords(sections.records)
  const current = parseAssignments(sections.assignments)
  const legacy = legacyAssignments(sections.sessions)
  const assignments = { assignments: mergeAssignments(current.assignments, legacy.assignments), extra: [...current.extra, ...legacy.extra] }
  const warnings: string[] = assignments.extra.map((line) => `担当の行を読めない: ${line.trim()}`)
  for (const tag of tags) if (tag !== AGENT_TAG && tag.toLowerCase() === AGENT_TAG.toLowerCase()) warnings.push(`大小だけ違うタグ: ${tag} (Agent に任せるのは ${AGENT_TAG})`)
  const start = tagValue(tags, START_PREFIX)
  const due = tagValue(tags, DUE_PREFIX)
  if (start.count > 1) warnings.push(`${START_PREFIX.trim()}のタグが ${start.count} 個ある`)
  if (due.count > 1) warnings.push(`${DUE_PREFIX.trim()}のタグが ${due.count} 個ある`)
  for (const tag of tags) {
    if (tag.startsWith(START_PREFIX) && !isDate(tag.slice(START_PREFIX.length))) warnings.push(`日付として読めないタグ: ${tag}`)
    if (tag.startsWith(DUE_PREFIX) && !isDate(tag.slice(DUE_PREFIX.length))) warnings.push(`日付として読めないタグ: ${tag}`)
  }
  return {
    detail: sections.detail.join("\n").trim(),
    ...(sections.pending.join("\n").trim() === "" ? {} : { pending: sections.pending.join("\n").trim() }),
    assignments: assignments.assignments,
    ...(assignments.extra.length === 0 ? {} : { assignmentExtra: assignments.extra }),
    records: records.notes,
    ...(records.preamble.length === 0 ? {} : { recordPreamble: records.preamble }),
    check: tags.includes(CHECK_TAG),
    ...(start.value === undefined ? {} : { start: start.value }),
    ...(due.value === undefined ? {} : { due: due.value }),
    // 5 回目までは Agent に任せていることを assignee の Agent で表していた。読むときはタグと同じ意味にする。
    agent: tags.includes(AGENT_TAG) || card.assignee?.trim() === AGENT_TAG,
    warnings,
  }
}

const RESERVED = [CHECK_TAG, AGENT_TAG]
const isReserved = (tag: string): boolean => RESERVED.includes(tag) || tag.startsWith(START_PREFIX) || tag.startsWith(DUE_PREFIX)

export const formatDescription = (view: CardView): string => {
  const preamble = view.recordPreamble ?? []
  const recordLines = [
    ...preamble,
    ...view.records.flatMap((n) => {
      const [first = "", ...rest] = n.text.split("\n")
      return [`- ${n.at} ${n.author}: ${first}`, ...rest.map((line) => `    ${line}`), ...(n.extra ?? [])]
    }),
  ]
  // 記録の節の末尾の空行は、節と節の間の空行と同じになるので落とす。
  while (recordLines.length > 0 && (recordLines.at(-1) ?? "").trim() === "") recordLines.pop()
  return [
    view.detail.trim(),
    (view.pending ?? "").trim() === "" ? "" : `${PENDING_HEADING}\n${(view.pending ?? "").trim()}`,
    view.assignments.length === 0 && (view.assignmentExtra ?? []).length === 0
      ? ""
      : `${ASSIGNMENTS_HEADING}\n${[...view.assignments.map(formatAssignment), ...(view.assignmentExtra ?? [])].join("\n")}`,
    recordLines.length === 0 ? "" : `${RECORDS_HEADING}\n${recordLines.join("\n")}`,
  ]
    .filter((s) => s !== "")
    .join("\n\n")
}

// 予約したタグ (確認が必要・Agent・着手可能・期日) は view の値で置き換え、ほかのタグはそのまま残す。
// assignee は書かない。kit の assignee を使わないので、書き直したカードからは消える。
export const writeCard = (card: Card, view: CardView): Card => {
  const description = formatDescription(view)
  const tags = [...(card.tags ?? []).filter((t) => !isReserved(t))]
  if (view.check) tags.push(CHECK_TAG)
  if (view.agent) tags.push(AGENT_TAG)
  if (view.start !== undefined) tags.push(`${START_PREFIX}${view.start}`)
  if (view.due !== undefined) tags.push(`${DUE_PREFIX}${view.due}`)
  const out: Card = { id: card.id, number: card.number, title: card.title }
  if (description !== "") out.description = description
  if (tags.length > 0) out.tags = tags
  if (card.links !== undefined && card.links.length > 0) out.links = card.links
  if (card.questions !== undefined) out.questions = card.questions
  return out
}

// 5 回目までの形 (assignee・`## セッション` の節) を今の形に移す。移すものが無ければ同じカードを返す。
export const normalizeCard = (card: Card): { card: Card; migrated: boolean } => {
  const legacy = card.assignee !== undefined || splitSections(card.description).sessions.some((l) => l.trim() !== "")
  return legacy ? { card: writeCard(card, readCard(card)), migrated: true } : { card, migrated: false }
}

// 同じ記録かどうかは日時・書き手・本文で決める。記録の下に足した書式外の行 (extra) は見ない。
const recordKey = (n: Note): string => `${n.at}\n${n.author}\n${n.text}`
export const sameRecord = (a: Note, b: Note): boolean => recordKey(a) === recordKey(b)
const withExtra = (n: Note, extra: string[] | undefined): Note => {
  const out: Note = { at: n.at, author: n.author, text: n.text }
  return extra === undefined || extra.length === 0 ? out : { ...out, extra }
}
// a は原文のまま保ち、b からは a より多く現れる分の行だけを後ろに足す (多重集合の和)。
const unionExtra = (a: string[] | undefined, b: string[] | undefined): string[] | undefined => {
  const remaining = new Map<string, number>()
  for (const line of a ?? []) remaining.set(line, (remaining.get(line) ?? 0) + 1)
  const added: string[] = []
  for (const line of b ?? []) {
    const left = remaining.get(line) ?? 0
    if (left > 0) remaining.set(line, left - 1)
    else added.push(line)
  }
  const all = [...(a ?? []), ...added]
  return all.length === 0 ? undefined : all
}
// 記録は日時順の和集合。同じ日時・書き手・本文の行は 1 つにし、書式外の行は多重集合の和にする。
export const mergeRecords = (a: Note[], b: Note[]): Note[] => {
  const seen = new Map<string, Note>()
  for (const note of [...a, ...b]) {
    const key = recordKey(note)
    const prev = seen.get(key)
    seen.set(key, prev === undefined ? withExtra(note, note.extra) : withExtra(prev, unionExtra(prev.extra, note.extra)))
  }
  return [...seen.values()].sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : x.author < y.author ? -1 : x.author > y.author ? 1 : x.text < y.text ? -1 : x.text > y.text ? 1 : 0))
}
export const authorLabel = (author: { id?: string; name?: string } | undefined): string =>
  author?.name ?? (author?.id?.startsWith("agent:") === true ? "Claude Code" : "本人")
export { pad }
