// description の節とタグからカードの状態を読み書きする。kit が知らない項目は持たない。
import type { Card } from "./page.ts"

export const TIME_ZONE = "Asia/Tokyo"
// 表し方は 3 つに分ける。確認が必要と日付はタグ、担い手は assignee、状況の記録は description の節。
export const CHECK_TAG = "確認が必要"
export const START_PREFIX = "着手可能 "
export const DUE_PREFIX = "期日 "
const PENDING_HEADING = "## Pending の理由"
const LEGACY_PENDING_HEADING = "## ブロック理由"
const RECORDS_HEADING = "## 記録"
const SESSIONS_HEADING = "## セッション"
export const AGENT = "Agent"

// extra は、記録の下に本人が書いた書式外の行 (字下げの無い行と空行)。原文のまま記録の後ろへ書き戻す。
export type Note = { at: string; author: string; text: string; extra?: string[] }
export type CardView = {
  detail: string
  pending?: string
  records: Note[]
  // `## 記録` の先頭の記録より前にあった行 (書式外の行・字下げした行・空行)。原文のまま書き戻す。
  recordPreamble?: string[]
  sessions: string[]
  check: boolean
  start?: string
  due?: string
  owner: "self" | "agent"
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

type Sections = { detail: string[]; pending: string[]; records: string[]; sessions: string[] }
const splitSections = (description: string | undefined): Sections => {
  const sections: Sections = { detail: [], pending: [], records: [], sessions: [] }
  let current: keyof Sections = "detail"
  for (const line of (description ?? "").split("\n")) {
    const heading = line.trim()
    if (heading === PENDING_HEADING || heading === LEGACY_PENDING_HEADING) current = "pending"
    else if (heading === RECORDS_HEADING) current = "records"
    else if (heading === SESSIONS_HEADING) current = "sessions"
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
  const warnings: string[] = []
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
    records: records.notes,
    ...(records.preamble.length === 0 ? {} : { recordPreamble: records.preamble }),
    sessions: sections.sessions.map((l) => l.trim().replace(/^- /, "")).filter((l) => l !== ""),
    check: tags.includes(CHECK_TAG),
    ...(start.value === undefined ? {} : { start: start.value }),
    ...(due.value === undefined ? {} : { due: due.value }),
    owner: card.assignee?.trim() === AGENT ? "agent" : "self",
    warnings,
  }
}

const RESERVED = [CHECK_TAG]
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
    recordLines.length === 0 ? "" : `${RECORDS_HEADING}\n${recordLines.join("\n")}`,
    view.sessions.length === 0 ? "" : `${SESSIONS_HEADING}\n${view.sessions.map((s) => `- ${s}`).join("\n")}`,
  ]
    .filter((s) => s !== "")
    .join("\n\n")
}

// 予約したタグ (確認が必要・着手可能・期日) は view の値で置き換え、ほかのタグはそのまま残す。
// 担い手が Agent のときは assignee を Agent にする。本人に戻したときは Agent だけを外し、
// 本人が kit の詳細で入れた Agent 以外の assignee (例: 「妻」) は消さない。
export const writeCard = (card: Card, view: CardView): Card => {
  const description = formatDescription(view)
  const tags = [...(card.tags ?? []).filter((t) => !isReserved(t))]
  if (view.check) tags.push(CHECK_TAG)
  if (view.start !== undefined) tags.push(`${START_PREFIX}${view.start}`)
  if (view.due !== undefined) tags.push(`${DUE_PREFIX}${view.due}`)
  const out: Card = { id: card.id, number: card.number, title: card.title }
  if (description !== "") out.description = description
  if (tags.length > 0) out.tags = tags
  if (view.owner === "agent") out.assignee = AGENT
  else if (card.assignee !== undefined && card.assignee.trim() !== AGENT) out.assignee = card.assignee
  if (card.links !== undefined && card.links.length > 0) out.links = card.links
  if (card.questions !== undefined) out.questions = card.questions
  return out
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
