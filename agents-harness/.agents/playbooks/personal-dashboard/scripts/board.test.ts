import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { applyReview, cardId, changesForIntents, foldDump, normalizePage, pageTemplate, renderText } from "./board.ts"
import {
  AGENT_TAG,
  assignmentKey,
  authorLabel,
  CHECK_TAG,
  DUE_PREFIX,
  formatAssignment,
  mergeAssignments,
  mergeRecords,
  normalizeCard,
  readCard,
  START_PREFIX,
  tokyoDate,
  tokyoStamp,
  writeCard,
  type Assignment,
  type CardView,
  type Note,
} from "./card.ts"
import { applyEdits, editsBetween } from "./text-edits.ts"
import { applyIntents, normalizeKey, sessionFromEnv, type Intent } from "./intents.ts"
import { emptyKanban, parsePage, renderPage, validateKanban, type Card, type Kanban, type Page } from "./page.ts"
import { addressedHas, mergeAddressed, parseAddressed, parseBrief, parseTargetId, replay, type DraftAction } from "./replay.ts"

const here = dirname(fileURLToPath(import.meta.url))
const TEMPLATE = readFileSync(join(here, "..", "assets", "board.html"), "utf8")
const now = new Date("2026-11-29T01:00:00.000Z")
const today = "2026-11-29"

const empty = (): Page => parsePage(TEMPLATE)
const blankView = (over: Partial<CardView> = {}): CardView => ({ detail: "", assignments: [], records: [], check: false, agent: false, warnings: [], ...over })
const boardOf = (page: Page, id: "personal-task-board" | "personal-learning" = "personal-task-board"): Kanban => page.boards[id]
const columnOf = (kanban: Kanban, id: string) => {
  const column = kanban.columns.find((c) => c.id === id)
  assert.ok(column !== undefined, `列 ${id} が無い`)
  return column
}
const cardOf = (kanban: Kanban, id: string): Card => {
  for (const column of kanban.columns) {
    const card = column.cards.find((c) => c.id === id)
    if (card !== undefined) return card
  }
  throw new Error(`カード ${id} が無い`)
}
const card = (id: string, number: number, title: string, extra: Partial<Card> = {}): Card => ({ id, number, title, ...extra })
const action = (over: Partial<DraftAction> & Pick<DraftAction, "id" | "type">): DraftAction => ({
  target: { type: "element", id: "personal-task-board/column/todo@board" },
  payload: {},
  createdAt: "2026-11-29T00:00:00.000Z",
  ...over,
})
const brief = (draft: DraftAction[], addressed: string): string =>
  [
    "# Review draft — タスク",
    "",
    "## Requested changes (1)",
    "",
    "## Not applicable to the current base (1)",
    "",
    "## Change log: addressed",
    "",
    "When you regenerate the page, set `\"addressed\"` at the top of its change log.",
    "",
    "```text",
    addressed,
    "```",
    "",
    "## Canonical draft (JSON)",
    "",
    "```json",
    JSON.stringify(draft, null, 2),
    "```",
    "",
  ].join("\n")

test("テンプレートの base は空の列で、render と parse が往復する", () => {
  const page = empty()
  assert.deepEqual(
    boardOf(page).columns.map((c) => [c.id, c.cards.length]),
    [["todo", 0], ["today", 0], ["doing", 0], ["blocked", 0], ["done", 0], ["archived", 0]],
  )
  const withCard = applyIntents(page, [
    { op: "add", key: "https://example.com/a", column: "todo", title: "往復する", detail: "説明", tags: ["作業"], links: [{ url: "https://example.com/x" }] },
  ])
  const rendered = renderPage(TEMPLATE, withCard.page)
  const parsed = parsePage(rendered)
  assert.deepEqual(parsed.boards, withCard.page.boards)
  // 番号は base に明示する (省略すると並び替えで変わる)。
  assert.equal(parsed.boards["personal-task-board"].columns[0]?.cards[0]?.number, 1)
})

test("`<` を含む値でも script を閉じず、往復する", () => {
  const page = empty()
  const id = cardId("https://example.com/b")
  const text = "<script>alert(1)</script><!-- --> </script>"
  const next = applyIntents(page, [{ op: "add", key: "https://example.com/b", column: "todo", title: "a < b", detail: text }])
  const rendered = renderPage(TEMPLATE, next.page)
  assert.ok(!rendered.includes("<script>alert(1)"), "生の <script> が HTML に出ている")
  assert.ok(rendered.includes("\\u003cscript>"), "`<` を \\u003c にしていない")
  const parsed = parsePage(rendered)
  assert.equal(cardOf(boardOf(parsed), id).title, "a < b")
  assert.equal(readCard(cardOf(boardOf(parsed), id)).detail, text)
})

test("change log は base の後ろに置き、addressed と revisions を往復する", () => {
  const page = empty()
  page.changes = { addressed: "w:1-3,x:2", revisions: [{ revision: "2026-11-29.1", changes: [{ title: "追加", target: "card:a@board" }] }] }
  const rendered = renderPage(TEMPLATE, page)
  assert.deepEqual(parsePage(rendered).changes, page.changes)
  // app の base の後ろ、dpk-app の中に置く。
  assert.ok(rendered.indexOf('"title"') < rendered.indexOf("data-dpk-changes"))
  assert.ok(rendered.indexOf("data-dpk-changes") < rendered.indexOf("</dpk-app>"))
  // 書き直しても字下げは変わらず、change log を消しても空行を残さない。
  assert.equal(renderPage(rendered, page), rendered)
  assert.equal(renderPage(rendered, empty()), renderPage(TEMPLATE, empty()))
})

test("kit と同じ入力を拒む", () => {
  const ok = { columns: [{ id: "todo", label: "Todo", cards: [] }] }
  assert.deepEqual(validateKanban(ok).columns[0]?.id, "todo")
  // 未知のキー
  assert.throws(() => validateKanban({ columns: [], extra: true }), /board\.extra: 未知の項目/)
  assert.throws(() => validateKanban({ columns: [{ id: "todo", label: "Todo", nope: 1 }] }), /nope: 未知の項目/)
  // 列とカードの id の重複
  assert.throws(() => validateKanban({ columns: [{ id: "todo", label: "Todo" }, { id: "todo", label: "Again" }] }), /列の id が重なっている/)
  assert.throws(
    () => validateKanban({ columns: [{ id: "todo", label: "Todo", cards: [{ id: "a", title: "A" }] }, { id: "done", label: "Done", cards: [{ id: "a", title: "B" }] }] }),
    /カードの id が重なっている/,
  )
  // 番号の重複
  assert.throws(
    () => validateKanban({ columns: [{ id: "todo", label: "Todo", cards: [{ id: "a", number: 2, title: "A" }, { id: "b", number: 2, title: "B" }] }] }),
    /カードの番号が重なっている/,
  )
  // 空の題
  assert.throws(() => validateKanban({ columns: [{ id: "todo", label: "Todo", cards: [{ id: "a", title: "" }] }] }), /title: 文字列 \(1 文字以上\)/)
  // 同じカードに同じ URL
  assert.throws(
    () =>
      validateKanban({
        columns: [{ id: "todo", label: "Todo", cards: [{ id: "a", title: "A", links: [{ url: "https://example.com" }, { url: "https://example.com" }] }] }],
      }),
    /同じ URL を 2 つ持っている/,
  )
  // http(s) でないリンク
  assert.throws(() => validateKanban({ columns: [{ id: "todo", label: "Todo", cards: [{ id: "a", title: "A", links: [{ url: "ftp://example.com" }] }] }] }), /http\(s\) の URL/)
  // kit の base は空文字のタグを許す。
  assert.deepEqual(validateKanban({ columns: [{ id: "todo", label: "Todo", cards: [{ id: "a", title: "A", tags: [""] }] }] }).columns[0]?.cards[0]?.tags, [""])
  // 番号は省略でき、盤面の順に最大番号 + 1 が振られる。
  const numbered = validateKanban({ columns: [{ id: "todo", label: "Todo", cards: [{ id: "a", number: 4, title: "A" }, { id: "b", title: "B" }] }] })
  assert.equal(numbered.columns[0]?.cards[1]?.number, 5)
})

test("replay は kit と同じく適用できない action を stale にし、番号を振る", () => {
  const page = empty()
  columnOf(boardOf(page), "todo").cards = [card("a", 3, "A")]
  const actions: DraftAction[] = [
    action({ id: "w:1", type: "ADD_CARD", payload: { id: "b", title: " B " } }),
    action({ id: "w:2", type: "ADD_CARD", payload: { id: "b", title: "重複" } }),
    action({ id: "w:3", type: "ADD_CARD", payload: { id: "c", title: "   " } }),
    action({ id: "w:4", type: "ADD_CARD", payload: { id: "d", title: "番号が重なる", number: 4 } }),
    action({ id: "w:5", type: "ADD_CARD", target: { type: "element", id: "personal-task-board/column/nope@board" }, payload: { id: "e", title: "E" } }),
    action({ id: "w:6", type: "MOVE_CARD", target: { type: "element", id: "personal-task-board/card/a@board" }, payload: { column: "doing", before: null } }),
    action({ id: "w:7", type: "MOVE_CARD", target: { type: "element", id: "personal-task-board/card/b@board" }, payload: { column: "nope", before: null } }),
    action({ id: "w:8", type: "MOVE_CARD", target: { type: "element", id: "personal-task-board/card/b@board" }, payload: { column: "doing", before: "missing" } }),
    action({ id: "w:9", type: "MOVE_CARD", target: { type: "element", id: "personal-task-board/card/b@board" }, payload: { column: "doing", before: "b" } }),
    action({ id: "w:10", type: "ADD_CARD_TAG", target: { type: "element", id: "personal-task-board/card/a@board" }, payload: { tag: "x" } }),
    action({ id: "w:11", type: "ADD_CARD_TAG", target: { type: "element", id: "personal-task-board/card/a@board" }, payload: { tag: "x" } }),
    action({ id: "w:12", type: "REMOVE_CARD_TAG", target: { type: "element", id: "personal-task-board/card/a@board" }, payload: { tag: "nope" } }),
    action({ id: "w:13", type: "ADD_CARD_LINK", target: { type: "element", id: "personal-task-board/card/a@board" }, payload: { url: "ftp://example.com" } }),
    action({ id: "w:14", type: "SET_CARD_TITLE", target: { type: "element", id: "personal-task-board/card/missing@board" }, payload: { title: "x" } }),
    action({ id: "w:15", type: "SOMETHING_NEW", target: { type: "element", id: "personal-task-board/card/a@board" }, payload: {} }),
    action({ id: "w:16", type: "comment", target: { type: "element", id: "personal-task-board/card/a@board" }, payload: { body: "本文" } }),
  ]
  const out = replay(boardOf(page), "personal-task-board", actions)
  const status = Object.fromEntries(out.results.map((r) => [r.id, r.status === "stale" ? r.reason : r.status]))
  assert.deepEqual(status, {
    "w:1": "applied",
    "w:2": "constraint-violated",
    "w:3": "constraint-violated",
    "w:4": "constraint-violated",
    "w:5": "target-missing",
    "w:6": "applied",
    "w:7": "constraint-violated",
    "w:8": "constraint-violated",
    "w:9": "constraint-violated",
    "w:10": "applied",
    "w:11": "constraint-violated",
    "w:12": "constraint-violated",
    "w:13": "constraint-violated",
    "w:14": "target-missing",
    "w:15": "unsupported-action-type",
    "w:16": "comment",
  })
  // 番号なしの ADD_CARD は最大番号 + 1。題は trim する。
  assert.deepEqual(cardOf(out.board, "b"), { id: "b", number: 4, title: "B" })
  assert.equal(cardOf(out.board, "a").tags?.join(","), "x")
  assert.equal(columnOf(out.board, "doing").cards[0]?.id, "a")
})

test("replay の編集は base を置き換え、空の description と assignee はキーごと消す", () => {
  const page = empty()
  columnOf(boardOf(page), "todo").cards = [card("a", 1, "A", { description: "古い", assignee: "Agent", tags: ["x"], links: [{ url: "https://example.com" }] })]
  const target = { type: "element", id: "personal-task-board/card/a@board" }
  const out = replay(boardOf(page), "personal-task-board", [
    action({ id: "w:1", type: "SET_CARD_DESCRIPTION", target, payload: { description: "   " } }),
    action({ id: "w:2", type: "SET_CARD_ASSIGNEE", target, payload: { assignee: "" } }),
    action({ id: "w:3", type: "REMOVE_CARD_TAG", target, payload: { tag: "x" } }),
    action({ id: "w:4", type: "REMOVE_CARD_LINK", target, payload: { url: "https://example.com" } }),
    action({ id: "w:5", type: "SET_CARD_TITLE", target, payload: { title: " 新しい題 " } }),
  ])
  assert.deepEqual(cardOf(out.board, "a"), { id: "a", number: 1, title: "新しい題" })
  assert.ok(out.results.every((r) => r.status === "applied"))
})

test("addressed は writer ごとの範囲で、増える方向にだけまとめる", () => {
  assert.equal(mergeAddressed(undefined, ["w:1"]), "w:1")
  assert.equal(mergeAddressed("w:1-3", ["w:5", "w:4"]), "w:1-5")
  assert.equal(mergeAddressed("w:1-5", ["w:2"]), "w:1-5")
  assert.equal(mergeAddressed("w:1-2,x:1", ["w:3", "y:2"]), "w:1-3,x:1,y:1-2")
  assert.equal(mergeAddressed(undefined, ["w:1", "w:2", "w:4"], ["w:3"]), "w:1-2,w:4")
  assert.equal(mergeAddressed("w:1-2", ["w:4"], ["w:3", "w:5"]), "w:1-2,w:4")
  assert.equal(mergeAddressed(undefined, ["w:2"], ["w:1"]), "w:2")
  // UUID 形式の id は範囲に入れない (kit と同じ)。
  assert.equal(mergeAddressed(undefined, ["tgmdkw1b:44", "9d1e0a5c-0000-4000-8000-000000000000"]), "tgmdkw1b:1-44")
  assert.equal(addressedHas("w:1-5", "w:3"), true)
  assert.equal(addressedHas("w:1-5", "w:6"), false)
  assert.deepEqual([...parseAddressed("w:1-3,w:2-4").get("w") ?? []], [[1, 4]])
  assert.throws(() => mergeAddressed("w:1-", ["w:2"]), /addressed/)
  assert.throws(() => mergeAddressed("w:3-1", ["w:2"]), /逆になっている/)
})

test("brief から draft・addressed・コメントを読む", () => {
  const draft = [
    action({ id: "w:1", type: "MOVE_CARD", target: { type: "element", id: "personal-task-board/card/a@board" }, payload: { column: "doing", before: null } }),
    action({ id: "w:2", type: "comment", target: { type: "element", id: "personal-task-board/card/a@board" }, payload: { body: "ここを直す" } }),
  ]
  const parsed = parseBrief(brief(draft, "w:1-2"))
  assert.equal(parsed.addressed, "w:1-2")
  assert.equal(parsed.draft.length, 2)
  assert.deepEqual(parsed.comments.map((c) => c.payload?.body), ["ここを直す"])
  // review.json (draft の配列) も読む。
  assert.equal(parseBrief(JSON.stringify(draft)).draft.length, 2)
})

test("intent は 2 回当てても 1 回と同じで、記録も増えない", () => {
  const page = empty()
  columnOf(boardOf(page), "doing").cards = [card("a", 2, "動かす")]
  columnOf(boardOf(page), "done").cards = [card("d", 3, "終わった")]
  const intents: Intent[] = [
    { op: "add", key: "https://example.com/new", column: "todo", title: "新しい", tags: ["作業"], due: "2026-12-05", agent: true },
    { op: "move", card: "a", column: "today" },
    { op: "detail", card: "a", text: "追記" },
    { op: "comment", card: "a", text: "1 行目\n2 行目", at: "2026-11-29 10:00" },
    { op: "check", card: "a", on: true, text: "本人に確かめる", at: "2026-11-29 10:01" },
    { op: "start", card: "a", date: "2026-12-01" },
    { op: "due", card: "a", date: "2026-12-10" },
    { op: "agent", card: "a", on: true },
    { op: "link", card: "a", url: "https://example.com/pr", label: "PR" },
    { op: "assign", card: "a", status: "In Progress", role: "実装する", runtime: "claude-code", model: "claude-opus-5-5", session: "abc" },
    { op: "archive" },
  ]
  const once = applyIntents(page, intents, { now })
  const twice = applyIntents(once.page, intents, { now })
  assert.deepEqual(twice.page, once.page)
  // 2 回目は「既にある」として飛ばす。
  assert.ok(twice.skipped.length >= 9, `skip が少ない: ${JSON.stringify(twice.skipped)}`)
  const view = readCard(cardOf(boardOf(once.page), "a"))
  assert.equal(view.pending, undefined)
  assert.equal(view.records.length, 2)
  assert.equal(view.records[0]?.text, "1 行目\n2 行目")
  assert.equal(view.check, true)
  assert.equal(view.start, "2026-12-01")
  assert.equal(view.due, "2026-12-10")
  assert.equal(view.agent, true)
  assert.deepEqual(view.assignments, [{ status: "In Progress", role: "実装する", runtime: "claude-code", model: "claude-opus-5-5", session: "abc" }])
  assert.equal(cardOf(boardOf(once.page), "d").id, "d")
  assert.deepEqual(columnOf(boardOf(once.page), "archived").cards.map((c) => c.id), ["d"])
  const added = cardOf(boardOf(once.page), cardId("https://example.com/new"))
  assert.equal(added.number, 4)
  assert.deepEqual(added.tags, ["作業", AGENT_TAG, `${DUE_PREFIX}2026-12-05`])
  assert.equal(added.assignee, undefined)
})

test("衝突からの回復: 新しい base に同じ intents を当て直せる", () => {
  const page = empty()
  columnOf(boardOf(page), "todo").cards = [card("a", 1, "A")]
  const intents: Intent[] = [
    { op: "comment", card: "a", text: "記録", at: "2026-11-29 09:00" },
    { op: "add", key: "https://example.com/b", column: "today", title: "B" },
  ]
  const mine = applyIntents(page, intents, { now })
  // その間に別のセッションが 1 枚足して公開した。
  const theirs = applyIntents(page, [{ op: "add", key: "https://example.com/z", column: "todo", title: "Z" }], { now })
  const retry = applyIntents(theirs.page, intents, { now })
  assert.equal(columnOf(boardOf(retry.page), "todo").cards.length, 2)
  assert.deepEqual(columnOf(boardOf(retry.page), "today").cards.map((c) => c.id), [cardId("https://example.com/b")])
  const view = readCard(cardOf(boardOf(retry.page), "a"))
  assert.equal(view.records.length, 1)
  // 当てる前と後で、同じ intents の結果が同じになる。
  assert.deepEqual(view, readCard(cardOf(boardOf(mine.page), "a")))
  // 同じ intents をもう一度当てても増えない。
  assert.deepEqual(applyIntents(retry.page, intents, { now }).page, retry.page)
})

test("レビューは `## 記録` を和集合にし、addressed を次の値にする", () => {
  const page = empty()
  const old = writeCard(card("a", 1, "A"), blankView({ detail: "説明", records: [{ at: "2026-11-28 10:00", author: "本人", text: "古い記録" }] }))
  columnOf(boardOf(page), "todo").cards = [old]
  const next = writeCard(old, blankView({ detail: "説明を直した", records: [{ at: "2026-11-29 10:00", author: "本人", text: "新しい記録" }] }))
  const draft = [
    action({ id: "w:1", type: "SET_CARD_DESCRIPTION", target: { type: "element", id: "personal-task-board/card/a@board" }, payload: { description: next.description ?? "" } }),
  ]
  const output = applyReview(page, brief(draft, "w:1"), { now })
  const view = readCard(cardOf(boardOf(output.page), "a"))
  assert.equal(view.detail, "説明を直した")
  assert.deepEqual(view.records.map((n) => n.text), ["古い記録", "新しい記録"])
  assert.equal(output.addressed, "w:1")
  assert.equal(output.page.changes.addressed, "w:1")
  assert.equal(output.page.changes.revisions?.length, 1)
  // brief の addressed が計算と違えば書かない。
  assert.throws(() => applyReview(page, brief(draft, "w:1-9"), { now }), /addressed/)
  // --keep の action は当てず、addressed にも入れず、draft に残す。
  const kept = applyReview(page, brief(draft, "w:1"), { keep: ["w:1"], now })
  assert.equal(readCard(cardOf(boardOf(kept.page), "a")).detail, "説明")
  assert.equal(kept.addressed, "")
  assert.equal(kept.results[0]?.reason, "kept")
})

test("レビューで同じ action を 2 回流しても記録は増えない", () => {
  const page = empty()
  columnOf(boardOf(page), "todo").cards = [card("a", 1, "A")]
  const draft = [action({ id: "w:1", type: "ADD_CARD_TAG", target: { type: "element", id: "personal-task-board/card/a@board" }, payload: { tag: "作業" } })]
  const once = applyReview(page, brief(draft, "w:1"), { now })
  const twice = applyReview(once.page, brief(draft, "w:1"), { now })
  assert.deepEqual(cardOf(boardOf(twice.page), "a").tags, ["作業"])
  assert.equal(readCard(cardOf(boardOf(twice.page), "a")).records.length, 0)
})

test("blocked へは理由が要り、理由は Pending の理由の節に入り、出ると消える", () => {
  const page = empty()
  columnOf(boardOf(page), "doing").cards = [card("a", 1, "A")]
  assert.throws(() => applyIntents(page, [{ op: "move", card: "a", column: "blocked" }]), /reason/)
  const blocked = applyIntents(page, [{ op: "move", card: "a", column: "blocked", reason: "本人の返事待ち" }])
  assert.equal(readCard(cardOf(boardOf(blocked.page), "a")).pending, "本人の返事待ち")
  const out = applyIntents(blocked.page, [{ op: "move", card: "a", column: "today" }])
  assert.equal(readCard(cardOf(boardOf(out.page), "a")).pending, undefined)
})

test("確認が必要・Agent に任せている・着手可能日・期日はタグで表し、assignee は使わない", () => {
  const page = empty()
  columnOf(boardOf(page), "todo").cards = [card("a", 1, "A")]
  const out = applyIntents(page, [
    { op: "check", card: "a", on: true },
    { op: "start", card: "a", date: "2026-12-01" },
    { op: "due", card: "a", date: "2026-12-05" },
    { op: "agent", card: "a", on: true },
  ])
  const got = cardOf(boardOf(out.page), "a")
  assert.deepEqual(got.tags, [CHECK_TAG, AGENT_TAG, `${START_PREFIX}2026-12-01`, `${DUE_PREFIX}2026-12-05`])
  assert.equal(got.assignee, undefined)
  const view = readCard(got)
  assert.equal(view.check, true)
  assert.equal(view.start, "2026-12-01")
  assert.equal(view.due, "2026-12-05")
  assert.equal(view.agent, true)
  const off = applyIntents(out.page, [{ op: "agent", card: "a", on: false }])
  assert.deepEqual(cardOf(boardOf(off.page), "a").tags, [CHECK_TAG, `${START_PREFIX}2026-12-01`, `${DUE_PREFIX}2026-12-05`])
  assert.ok(applyIntents(off.page, [{ op: "agent", card: "a", on: false }]).skipped.length === 1)
  assert.ok(readCard(card("x", 9, "X", { tags: ["agent"] })).warnings.some((w) => w.includes("大小だけ違う")))
  // 日付を変えると古いタグを外す。解除するとタグも消える。
  const moved = applyIntents(off.page, [{ op: "due", card: "a", date: "2026-12-09" }])
  assert.deepEqual(cardOf(boardOf(moved.page), "a").tags, [CHECK_TAG, `${START_PREFIX}2026-12-01`, `${DUE_PREFIX}2026-12-09`])
  const cleared = applyIntents(moved.page, [{ op: "due", card: "a", date: null }, { op: "start", card: "a", date: null }])
  assert.deepEqual(cardOf(boardOf(cleared.page), "a").tags, [CHECK_TAG])
  // 書式の崩れたタグは警告にして、カードは落とさない。
  const broken = readCard(card("b", 2, "B", { tags: [`${DUE_PREFIX}2026/12/01`, `${DUE_PREFIX}2026-12-02`] }))
  assert.equal(broken.due, "2026-12-02")
  assert.ok(broken.warnings.some((w) => w.includes("読めない")))
  assert.ok(broken.warnings.some((w) => w.includes("2 個ある")))
  // 日付のタグが 2 個あれば、ページと同じく末尾 (最後に足したもの) を採る。
  assert.equal(readCard(card("c", 3, "C", { tags: [`${DUE_PREFIX}2026-12-05`, "作業", `${DUE_PREFIX}2026-12-20`] })).due, "2026-12-20")
})

test("アーカイブは確認が必要なカードを Done に残す", () => {
  const page = empty()
  columnOf(boardOf(page), "done").cards = [
    card("a", 1, "A"),
    writeCard(card("b", 2, "B"), blankView({ check: true })),
  ]
  const out = applyIntents(page, [{ op: "archive" }])
  assert.deepEqual(columnOf(boardOf(out.page), "archived").cards.map((c) => c.id), ["a"])
  assert.deepEqual(columnOf(boardOf(out.page), "done").cards.map((c) => c.id), ["b"])
  assert.ok(out.skipped.some((s) => s.reason.includes("確認が必要")))
})

test("担当は (役割, runtime, セッション) を鍵に、同じなら飛ばし、状態とモデルは置き換える", () => {
  const page = empty()
  columnOf(boardOf(page), "todo").cards = [card("a", 1, "A")]
  const base = { op: "assign", card: "a", role: "QA  をする", runtime: "pi", model: "m1", session: "s1" } as const
  const once = applyIntents(page, [{ ...base, status: "In Progress" }, { ...base, role: "方針を決める", status: "In Progress" }])
  const twice = applyIntents(once.page, [{ ...base, status: "In Progress" }])
  assert.deepEqual(twice.page, once.page)
  assert.match(twice.skipped[0]?.reason ?? "", /同じ担当/)
  const done = applyIntents(once.page, [{ ...base, role: "QA をする", model: "m2", status: "Done" }])
  const got = cardOf(boardOf(done.page), "a")
  assert.deepEqual(readCard(got).assignments.map((a) => [a.status, a.role, a.model]), [["Done", "QA をする", "m2"], ["In Progress", "方針を決める", "m1"]])
  assert.match(got.description ?? "", /## 担当\n- Done \| QA をする \| pi \| m2 \| s1\n- In Progress \| 方針を決める \| pi \| m1 \| s1/)
  // セッションを省くと - になる。web のセッションは URL のまま持つ。
  const url = "https://claude.ai/code/session_abc"
  const more = applyIntents(done.page, [
    { op: "assign", card: "a", role: "調べる", runtime: "codex", model: "gpt", status: "In Progress" },
    { op: "assign", card: "a", role: "調べる", runtime: "claude-code", model: "claude-opus-5-5", session: url, status: "Done" },
  ])
  assert.deepEqual(readCard(cardOf(boardOf(more.page), "a")).assignments.slice(2).map((a) => a.session), ["-", url])
  // 書式を壊す値と、旧い形のセッション参照と、廃止した op は拒む。
  assert.throws(() => applyIntents(page, [{ ...base, role: "a | b", status: "Done" }]), /role/)
  assert.throws(() => applyIntents(page, [{ ...base, session: "claude-code s1", status: "Done" }]), /board.ts session/)
  assert.throws(() => applyIntents(page, [{ ...base, model: "-", status: "Done" }]), /model/)
  assert.throws(() => applyIntents(page, [{ ...base, status: "Waiting" as "Done" }]), /status/)
  assert.throws(() => applyIntents(page, [{ ...base, session: 123 as unknown as string, status: "Done" }]), /session は文字列/)
  assert.throws(() => applyIntents(page, [{ op: "add", key: "https://example.com/b", column: "todo", title: "B", agent: "false" as unknown as boolean }]), /agent: true か false/)
  assert.throws(() => applyIntents(page, [{ op: "session", card: "a", session: "x" } as unknown as Intent]), /unknown op: session \(assign を使う\)/)
  assert.throws(() => applyIntents(page, [{ op: "owner", card: "a", who: "agent" } as unknown as Intent]), /unknown op: owner \(agent を使う\)/)
  assert.equal(normalizeKey("https://Example.com/x/#frag"), "https://example.com/x")
  assert.deepEqual(sessionFromEnv({ CLAUDE_CODE_SESSION_ID: "s1" }), { runtime: "claude-code", session: "s1" })
  assert.deepEqual(sessionFromEnv({ PI_SESSION_ID: "p1" }), { runtime: "pi", session: "p1" })
  assert.deepEqual(sessionFromEnv({ CLAUDE_CODE_REMOTE: "true", CLAUDE_CODE_REMOTE_SESSION_ID: "cse_x" }), { runtime: "claude-code", session: "https://claude.ai/code/session_x" })
  assert.equal(sessionFromEnv({}), undefined)
})

test("担当の合わせ方は、鍵を失わず、Done を戻さず、冪等で、状態以外は base の値を採る (81 通り)", () => {
  const keys = [
    { role: "実装する", runtime: "pi", session: "s1" },
    { role: "QA をする", runtime: "codex", session: "-" },
  ]
  const states = [undefined, "In Progress", "Done"] as const
  const make = (picks: (typeof states)[number][], model: string): Assignment[] =>
    picks.flatMap((status, i) => (status === undefined ? [] : [{ ...(keys[i] ?? keys[0]), status, model } as Assignment]))
  let count = 0
  for (const b0 of states) for (const b1 of states) for (const r0 of states) for (const r1 of states) {
    count++
    const base = make([b0, b1], "base")
    const review = make([r0, r1], "review")
    const merged = mergeAssignments(base, review)
    const keyset = (list: Assignment[]): string[] => [...new Set(list.map(assignmentKey))].sort()
    assert.deepEqual(keyset(merged), keyset([...base, ...review]))
    for (const a of merged) {
      const b = base.find((x) => assignmentKey(x) === assignmentKey(a))
      const r = review.find((x) => assignmentKey(x) === assignmentKey(a))
      if (b?.status === "Done" || r?.status === "Done") assert.equal(a.status, "Done")
      if (b !== undefined) assert.equal(a.model, b.model)
    }
    assert.deepEqual(mergeAssignments(merged, review), merged)
  }
  assert.equal(count, 81)
})

test("5 回目までの assignee と `## セッション` は、書き出すときに Agent のタグと Done の担当へ移す", () => {
  const legacy = card("a", 1, "A", { assignee: "Agent", description: "説明\n\n## セッション\n- claude-code s1\n- https://claude.ai/code/session_w\n- 読めない 行 です" })
  const { card: moved, migrated } = normalizeCard(legacy)
  assert.equal(migrated, true)
  assert.equal(moved.assignee, undefined)
  assert.deepEqual(moved.tags, [AGENT_TAG])
  assert.equal(
    moved.description,
    "説明\n\n## 担当\n- Done | 作業 | claude-code | - | s1\n- Done | 作業 | claude-code | - | https://claude.ai/code/session_w\n- 読めない 行 です",
  )
  assert.ok(readCard(moved).warnings.some((w) => w.includes("担当の行を読めない")))
  assert.equal(normalizeCard(moved).migrated, false)
  // Agent 以外の assignee も消し、タグにはしない。
  assert.deepEqual(normalizeCard(card("b", 2, "B", { assignee: "山田" })).card, { id: "b", number: 2, title: "B" })
  // 書き出す前に盤面の全カードへ当て、移したカードを change log に載せる。
  const page = empty()
  columnOf(boardOf(page), "todo").cards = [legacy, card("c", 3, "C")]
  const out = normalizePage(page)
  assert.deepEqual(out.changes.map((c) => c.title), ["TASK-1 A: 古い形式を移行"])
  assert.deepEqual(cardOf(boardOf(out.page), "c"), card("c", 3, "C"))
  // レビューで本人が旧ページの詳細から Agent を assignee に入れても、書き出すときにタグになる。
  const target = { type: "element", id: "personal-task-board/card/c@board" }
  const reviewed = applyReview(page, brief([action({ id: "w:1", type: "SET_CARD_ASSIGNEE", target, payload: { assignee: "Agent" } })], "w:1"), { now })
  assert.deepEqual(cardOf(boardOf(reviewed.page), "c").tags, [AGENT_TAG])
  assert.equal(cardOf(boardOf(reviewed.page), "c").assignee, undefined)
})

test("レビューの古い説明の再生で、Agent が足した担当は消えず、Done は戻らない", () => {
  const page = empty()
  const stale = writeCard(card("a", 1, "A"), blankView({ detail: "説明", assignments: [{ status: "In Progress", role: "実装する", runtime: "pi", model: "m", session: "s1" }] }))
  const current = writeCard(stale, blankView({
    detail: "説明",
    assignments: [
      { status: "Done", role: "実装する", runtime: "pi", model: "m", session: "s1" },
      { status: "In Progress", role: "QA をする", runtime: "codex", model: "g", session: "-" },
    ],
  }))
  columnOf(boardOf(page), "todo").cards = [current]
  const description = (stale.description ?? "").replace("説明", "説明を直した")
  const draft = [action({ id: "w:1", type: "SET_CARD_DESCRIPTION", target: { type: "element", id: "personal-task-board/card/a@board" }, payload: { description } })]
  const view = readCard(cardOf(boardOf(applyReview(page, brief(draft, "w:1"), { now }).page), "a"))
  assert.equal(view.detail, "説明を直した")
  assert.deepEqual(view.assignments.map((a) => `${a.status} ${a.role}`), ["Done 実装する", "In Progress QA をする"])
  // office のページへのコメントで review は落ちない。
  const comment = action({ id: "c:1", type: "comment", target: { type: "element", id: "personal-task-board/section:office" }, payload: { body: "見た" } })
  assert.equal(applyReview(page, brief([comment], "c:1"), { now }).comments.length, 1)
})

test("テンプレートは agent-office.js を text/plain の script に埋め込み、</script を逃がす", () => {
  const dir = mkdtempSync(join(tmpdir(), "ptb-tpl-"))
  writeFileSync(join(dir, "board.html"), '<p>a</p>\n<script type="text/plain" id="ptb-agent-office" data-src="agent-office.js"></script>\n')
  writeFileSync(join(dir, "agent-office.js"), 'export const x = "</script>"\n')
  assert.equal(pageTemplate(dir), '<p>a</p>\n<script type="text/plain" id="ptb-agent-office">\nexport const x = "<\\/script>"\n</script>\n')
  assert.match(pageTemplate(), /export function mountAgentOffice/)
  assert.deepEqual(parsePage(pageTemplate()).boards, empty().boards)
  assert.equal(formatAssignment({ status: "Done", role: "r", runtime: "pi", model: "m", session: "-" }), "- Done | r | pi | m | -")
})

test("記録は日時順の和集合で、同じ行は 1 つにする", () => {
  const a: Note = { at: "2026-11-29 10:00", author: "本人", text: "後" }
  const b: Note = { at: "2026-11-28 10:00", author: "Claude Code", text: "先" }
  assert.deepEqual(mergeRecords([a], [b, a]).map((n) => n.text), ["先", "後"])
})

test("移行は dump のカード・番号・記録・属性を base に畳む", () => {
  const dir = mkdtempSync(join(tmpdir(), "ptb-migrate-"))
  mkdirSync(join(dir, "actions"))
  mkdirSync(join(dir, "notes"))
  mkdirSync(join(dir, "attrs"))
  const put = (collection: string, name: string, value: unknown): void => writeFileSync(join(dir, collection, name), JSON.stringify(value))
  put("actions", "a1.json", {
    id: "w:1",
    type: "ADD_CARD",
    target: { type: "element", id: "personal-task-board/column/todo@board" },
    payload: { id: "a", title: "A" },
    createdAt: "2026-11-27T00:00:00.000Z",
  })
  put("actions", "a2.json", {
    id: "w:2",
    type: "ADD_CARD",
    target: { type: "element", id: "personal-task-board/column/done@board" },
    payload: { id: "b", title: "B" },
    createdAt: "2026-11-27T00:00:01.000Z",
  })
  put("actions", "a3.json", {
    id: "w:3",
    type: "SET_CARD_DESCRIPTION",
    target: { type: "element", id: "personal-task-board/card/a@board" },
    payload: { description: "説明\n\n## セッション\n- claude-code s1" },
    createdAt: "2026-11-27T00:00:02.000Z",
  })
  put("notes", "n1.json", { board: "personal-task-board", card: "a", body: "記録", author: { id: "agent:claude-code" }, createdAt: "2026-11-28T13:53:03.254Z" })
  put("attrs", "at1.json", { board: "personal-task-board", card: "a", attr: "owner", value: "agent" })
  put("attrs", "at2.json", { board: "personal-task-board", card: "b", attr: "due", value: "2026-12-05" })
  const { page, warnings } = foldDump(dir)
  assert.deepEqual(warnings, [])
  const got = cardOf(boardOf(page), "a")
  assert.equal(got.number, 1)
  const view = readCard(got)
  assert.equal(view.detail, "説明")
  assert.deepEqual(view.assignments, [{ status: "Done", role: "作業", runtime: "claude-code", model: "-", session: "s1" }])
  assert.deepEqual(view.records, [{ at: "2026-11-28 22:53", author: "Claude Code", text: "記録" }])
  assert.equal(view.agent, true)
  const done = cardOf(boardOf(page), "b")
  assert.equal(done.number, 2)
  assert.deepEqual(done.tags, [`${DUE_PREFIX}2026-12-05`])
  // 畳んだページはそのまま HTML にして読み直せる。
  const html = renderPage(TEMPLATE, page)
  assert.deepEqual(parsePage(html).boards, page.boards)
})

test("show はタグ・Agent・担当・記録・アーカイブを人が読める形で出す", () => {
  const page = empty()
  columnOf(boardOf(page), "archived").cards = [card("z", 9, "アーカイブ済み")]
  columnOf(boardOf(page), "todo").cards = [
    writeCard(card("a", 1, "A"), blankView({
      detail: "説明",
      assignments: [{ status: "In Progress", role: "QA をする", runtime: "pi", model: "m", session: "s1" }],
      records: [{ at: "2026-11-29 10:00", author: "本人", text: "1 行目\n2 行目" }],
      check: true,
      start: "2026-12-01",
      due: today,
      agent: true,
    })),
  ]
  const text = renderText(page, { today })
  assert.match(text, /- TASK-1 a A \(確認が必要, Agent, 着手可能 2026-12-01, 期日 2026-11-29 今日\)/)
  assert.match(text, /    > 2026-11-29 10:00 本人: 1 行目\n    >   2 行目/)
  assert.match(text, /    ## 担当\n    - In Progress \| QA をする \| pi \| m \| s1/)
  assert.match(text, /アーカイブ 1 枚は --archived で出す/)
  assert.match(renderText(page, { today, archived: true }), /TASK-9 z アーカイブ済み/)
})

test("空の盤面は列だけを持ち、board.html の列の定義と一致する", () => {
  for (const board of ["personal-task-board", "personal-learning"] as const) {
    assert.deepEqual(emptyKanban(board).columns.map((c) => c.id), empty().boards[board].columns.map((c) => c.id))
  }
  assert.equal(authorLabel({ id: "agent:claude-code" }), "Claude Code")
  assert.equal(authorLabel({ id: "u_1" }), "本人")
  assert.equal(tokyoStamp(new Date("2026-11-28T13:53:03.254Z")), "2026-11-28 22:53")
})

test("`## 記録` の書式外の行は捨てず、記録の続きか原文として書き戻す", () => {
  const description = "本文\n\n## 記録\n本人が書いたメモ (形式外)\n- 2026-11-29 10:00 本人: 記録\n    字下げした続き\n形式外の続き"
  const page = empty()
  columnOf(boardOf(page), "todo").cards = [card("a", 1, "A", { description })]
  const view = readCard(cardOf(boardOf(page), "a"))
  assert.deepEqual(view.recordPreamble, ["本人が書いたメモ (形式外)"])
  // 字下げした行は本文、字下げの無い行は extra に分かれる。
  assert.deepEqual(view.records, [{ at: "2026-11-29 10:00", author: "本人", text: "記録\n字下げした続き", extra: ["形式外の続き"] }])
  // intent を当てても、書式外の行は残る。
  const out = applyIntents(page, [{ op: "detail", card: "a", text: "追記" }])
  const written = readCard(cardOf(boardOf(out.page), "a"))
  assert.deepEqual(written.recordPreamble, view.recordPreamble)
  assert.deepEqual(written.records, view.records)
  // もう 1 度当てても、行は増えも減りもしない。
  const twice = applyIntents(out.page, [{ op: "comment", card: "a", text: "新しい記録", at: "2026-11-29 11:00" }])
  const text = cardOf(boardOf(twice.page), "a").description ?? ""
  for (const line of ["本人が書いたメモ (形式外)", "形式外の続き", "- 2026-11-29 10:00 本人: 記録", "- 2026-11-29 11:00 Claude Code: 新しい記録"]) assert.ok(text.includes(line), line)
  const again = applyIntents(twice.page, [{ op: "comment", card: "a", text: "新しい記録", at: "2026-11-29 11:00" }])
  assert.equal(cardOf(boardOf(again.page), "a").description, text)
})

test("本人が記録の下に足した行は、レビューでも comment の当て直しでも 2 重にならない", () => {
  const description = "本文\n\n## 記録\n- 2026-11-27 10:00 Claude Code: 調べた"
  const target = { type: "element", id: "personal-task-board/card/a@board" }
  const page = empty()
  columnOf(boardOf(page), "todo").cards = [card("a", 1, "A", { description })]
  // 本人が記録の下に足した行を含む説明でレビューを当てる。
  const draft = [action({ id: "w:1", type: "SET_CARD_DESCRIPTION", target, payload: { description: `${description}\n補足を本人が書いた` } })]
  const reviewed = applyReview(page, brief(draft, "w:1"), { now })
  const view = readCard(cardOf(boardOf(reviewed.page), "a"))
  assert.deepEqual(view.records, [{ at: "2026-11-27 10:00", author: "Claude Code", text: "調べた", extra: ["補足を本人が書いた"] }])
  assert.equal(cardOf(boardOf(reviewed.page), "a").description, `${description}\n補足を本人が書いた`)
  // 同じ記録を comment で当て直しても、記録は増えない。
  const again = applyIntents(reviewed.page, [{ op: "comment", card: "a", at: "2026-11-27 10:00", by: "Claude Code", text: "調べた" }])
  assert.deepEqual(again.skipped.map((s) => s.reason), ["comment a: 既にある"])
  assert.equal(cardOf(boardOf(again.page), "a").description, `${description}\n補足を本人が書いた`)
})

test("`## 記録` の字下げと空行は原文のまま往復する", () => {
  const description = "## 記録\n本人のメモ\n  - 字下げした項目\n\n- 2026-11-27 10:00 本人: a\n     - 深い字下げ\n    - 2026-11-27 11:00 他人: b\n\n````\ncode\n````"
  const card1 = card("a", 1, "A", { description })
  const view = readCard(card1)
  // 先頭の記録より前の行は、字下げも空行も原文のまま持つ。
  assert.deepEqual(view.recordPreamble, ["本人のメモ", "  - 字下げした項目", ""])
  // 続き行は書式が足す 4 文字分だけを外し、それより深い字下げは本文に残す。
  // 字下げした行は、記録の書式に見えても続き行にして、記録を増やさない。
  assert.deepEqual(view.records, [
    { at: "2026-11-27 10:00", author: "本人", text: "a\n - 深い字下げ\n- 2026-11-27 11:00 他人: b", extra: ["", "````", "code", "````"] },
  ])
  // 書き戻して読み直しても、行は変わらない。
  const written = writeCard(card1, view)
  assert.equal(written.description, description)
  assert.deepEqual(readCard(written), view)
})

test("リンクの URL は URL として読める http(s) だけを通し、公開前に base を検査する", () => {
  const bad = ["https://", "http://a b", "https://[::1", "ftp://example.com"]
  for (const url of bad) {
    assert.throws(() => validateKanban({ columns: [{ id: "todo", label: "Todo", cards: [{ id: "a", title: "A", links: [{ url }] }] }] }), /URL/)
  }
  const page = empty()
  columnOf(boardOf(page), "todo").cards = [card("a", 1, "A")]
  for (const url of bad) assert.throws(() => applyIntents(page, [{ op: "link", card: "a", url }]), /http\(s\) の URL でない/)
  assert.throws(() => applyIntents(page, [{ op: "add", key: "k", column: "todo", title: "T", links: [{ url: "https://" }] }]), /http\(s\) の URL でない/)
  const out = replay(boardOf(page), "personal-task-board", [
    action({ id: "w:1", type: "ADD_CARD_LINK", target: { type: "element", id: "personal-task-board/card/a@board" }, payload: { url: "https://" } }),
  ])
  assert.equal(out.results[0]?.reason, "constraint-violated")
  // renderPage は kit が開けない base を埋め込まない。
  const broken = empty()
  columnOf(boardOf(broken), "todo").cards = [card("a", 1, "A", { links: [{ url: "https://" }] })]
  assert.throws(() => renderPage(TEMPLATE, broken), /URL/)
  // 正しい URL はそのまま通る。
  assert.equal(parsePage(renderPage(TEMPLATE, page)).boards["personal-task-board"].columns[0]?.cards.length, 1)
})

test("check intent は text を渡すとき at が要り、当て直しても記録が増えない", () => {
  const page = empty()
  columnOf(boardOf(page), "todo").cards = [card("a", 1, "A")]
  assert.throws(() => applyIntents(page, [{ op: "check", card: "a", on: true, text: "確認して" }]), /at/)
  assert.throws(() => applyIntents(page, [{ op: "check", card: "a", on: true, text: "確認して", at: "2026-11-29" }]), /at/)
  const intent: Intent = { op: "check", card: "a", on: true, text: "確認して", at: "2026-11-29 12:00" }
  const once = applyIntents(page, [intent])
  assert.deepEqual(readCard(cardOf(boardOf(once.page), "a")).records, [{ at: "2026-11-29 12:00", author: "Claude Code", text: "確認が必要: 確認して" }])
  // 同じ intent を当て直しても、記録は増えない。
  const twice = applyIntents(once.page, [intent])
  assert.equal(readCard(cardOf(boardOf(twice.page), "a")).records.length, 1)
  // text が無ければ at は要らず、記録も作らない。
  const noText = applyIntents(page, [{ op: "check", card: "a", on: true }])
  assert.equal(noText.skipped.length, 0)
  assert.equal(readCard(cardOf(boardOf(noText.page), "a")).records.length, 0)
})

test("replay は kit と同じ順に検査し、列を対象にした SET_* は target-missing にする", () => {
  const page = empty()
  columnOf(boardOf(page), "todo").cards = [card("a", 1, "A")]
  const cardTarget = (id: string) => ({ type: "element", id: `personal-task-board/card/${id}@board` })
  const columnTarget = { type: "element", id: "personal-task-board/column/todo@board" }
  const out = replay(boardOf(page), "personal-task-board", [
    action({ id: "w:1", type: "SET_CARD_TITLE", target: columnTarget, payload: { title: "x" } }),
    action({ id: "w:2", type: "SET_CARD_TITLE", target: cardTarget("missing"), payload: { title: "  " } }),
    action({ id: "w:3", type: "SET_CARD_TITLE", target: columnTarget, payload: { title: "  " } }),
    action({ id: "w:4", type: "MOVE_CARD", target: cardTarget("missing"), payload: { column: "doing", before: null } }),
    action({ id: "w:5", type: "ADD_CARD_TAG", target: cardTarget("missing"), payload: { tag: " " } }),
    action({ id: "w:6", type: "ADD_CARD_LINK", target: cardTarget("a"), payload: { url: "https://example.com", label: "  " } }),
    action({ id: "w:7", type: "ADD_CARD", target: { type: "element", id: "personal-task-board/column/nope@board" }, payload: { id: "z" } }),
    action({ id: "w:8", type: "SOMETHING_NEW", target: columnTarget, payload: {} }),
    action({ id: "w:9", type: "SET_CARD_TITLE", target: cardTarget("a"), payload: { title: " 新しい " } }),
  ])
  const status = Object.fromEntries(out.results.map((r) => [r.id, r.status === "stale" ? r.reason : r.status]))
  assert.deepEqual(status, {
    "w:1": "target-missing",
    "w:2": "constraint-violated",
    "w:3": "constraint-violated",
    "w:4": "target-missing",
    "w:5": "constraint-violated",
    "w:6": "constraint-violated",
    "w:7": "target-missing",
    "w:8": "unsupported-action-type",
    "w:9": "applied",
  })
  assert.equal(cardOf(out.board, "a").title, "新しい")
  assert.deepEqual(cardOf(out.board, "a").links, undefined)
})

test("addressed は brief の値が計算値に含まれればよく、含まれなければ止める", () => {
  const page = empty()
  columnOf(boardOf(page), "todo").cards = [card("a", 1, "A")]
  page.changes = { addressed: "w:1-5" }
  const draft = [action({ id: "w:6", type: "ADD_CARD_TAG", target: { type: "element", id: "personal-task-board/card/a@board" }, payload: { tag: "作業" } })]
  // 別の端末の brief を先に反映していて、計算値の方が広い。
  const out = applyReview(page, brief(draft, "w:6"), { now })
  assert.equal(out.addressed, "w:1-6")
  assert.throws(() => applyReview(page, brief(draft, "w:1-9"), { now }), /addressed/)
})

test("--keep で見送った ADD_CARD のカードを対象にする action も見送る", () => {
  const page = empty()
  columnOf(boardOf(page), "todo").cards = [card("a", 1, "A")]
  const target = (id: string) => ({ type: "element", id: `personal-task-board/card/${id}@board` })
  const draft = [
    action({ id: "w:1", type: "ADD_CARD", payload: { id: "x", title: "X" } }),
    action({ id: "w:2", type: "MOVE_CARD", target: target("x"), payload: { column: "doing", before: null } }),
    action({ id: "w:3", type: "ADD_CARD_TAG", target: target("x"), payload: { tag: "t" } }),
    action({ id: "w:4", type: "ADD_CARD_TAG", target: target("a"), payload: { tag: "作業" } }),
  ]
  const out = applyReview(page, brief(draft, "w:1-4"), { keep: ["w:1"], now })
  const status = Object.fromEntries(out.results.map((r) => [r.id, r.status === "stale" ? r.reason : r.status]))
  assert.deepEqual(status, { "w:1": "kept", "w:2": "kept-add", "w:3": "kept-add", "w:4": "applied" })
  // 見送ったカードは積まれず、ほかの変更だけが残る。
  assert.ok(!boardOf(out.page).columns.some((c) => c.cards.some((x) => x.id === "x")))
  assert.deepEqual(cardOf(boardOf(out.page), "a").tags, ["作業"])
  // 見送った action は addressed に入らず、draft に残る。
  assert.equal(out.addressed, "w:4")
})

test("--keep で見送った ADD_CARD のカードを payload.before に指す MOVE_CARD も見送る", () => {
  const page = empty()
  columnOf(boardOf(page), "todo").cards = [card("a", 1, "A"), card("b", 2, "B")]
  const target = (id: string) => ({ type: "element", id: `personal-task-board/card/${id}@board` })
  const draft = [
    action({ id: "w:1", type: "ADD_CARD", payload: { id: "x", title: "X" } }),
    // 見送るカードの前に差し込む移動。base に x が無いので stale になる。
    action({ id: "w:2", type: "MOVE_CARD", target: target("a"), payload: { column: "doing", before: "x" } }),
    // 見送ったカードの後ろへの移動は、位置が変わらないだけなので適用する。
    action({ id: "w:3", type: "MOVE_CARD", target: target("b"), payload: { column: "doing", before: null } }),
  ]
  const out = applyReview(page, brief(draft, "w:1-3"), { keep: ["w:1"], now })
  const status = Object.fromEntries(out.results.map((r) => [r.id, r.status === "stale" ? r.reason : r.status]))
  assert.deepEqual(status, { "w:1": "kept", "w:2": "kept-add", "w:3": "applied" })
  // 見送った移動は積まれず、ほかの移動だけが残る。
  assert.deepEqual(columnOf(boardOf(out.page), "todo").cards.map((c) => c.id), ["a"])
  assert.deepEqual(columnOf(boardOf(out.page), "doing").cards.map((c) => c.id), ["b"])
  // 見送った action は addressed に入らず、draft に残る。
  assert.equal(out.addressed, "w:3")
})

test("archive intent は確認が必要のカードがあっても、移したカードの変更を記録する", () => {
  const page = empty()
  const check = writeCard(card("b", 2, "B"), blankView({ check: true }))
  columnOf(boardOf(page), "done").cards = [card("a", 1, "A"), check]
  const intents: Intent[] = [{ op: "archive" }]
  const out = applyIntents(page, intents)
  assert.ok(out.skipped.length > 0)
  assert.deepEqual(
    changesForIntents(page, out.page, intents, out.skipped).map((c) => c.title),
    ["TASK-1 A: アーカイブ"],
  )
  // archive intent が 2 つあっても、同じ変更を 2 度記録しない。
  const two: Intent[] = [{ op: "archive" }, { op: "archive" }]
  const twice = applyIntents(page, two)
  assert.equal(changesForIntents(page, twice.page, two, twice.skipped).length, 1)
})

test("add は同じ key のカードが別の盤面にあっても積まない", () => {
  const learning = applyIntents(empty(), [{ op: "add", key: "k", board: "personal-learning", column: "backlog", title: "学習" }])
  assert.equal(columnOf(boardOf(learning.page, "personal-learning"), "backlog").cards.length, 1)
  const again = applyIntents(learning.page, [{ op: "add", key: "k", column: "todo", title: "重複" }])
  assert.equal(again.skipped.length, 1)
  assert.match(again.skipped[0]?.reason ?? "", /既にある/)
  assert.equal(columnOf(boardOf(again.page), "todo").cards.length, 0)
  assert.equal(columnOf(boardOf(again.page, "personal-learning"), "backlog").cards.length, 1)
})

test("change log の revisions は直近 20 件だけを残す", () => {
  const page = empty()
  columnOf(boardOf(page), "todo").cards = [card("a", 1, "A")]
  page.changes = {
    revisions: Array.from({ length: 20 }, (_, i) => ({ revision: `2026-11-01.${i + 1}`, changes: [{ title: `古い ${i + 1}` }] })),
  }
  const draft = [action({ id: "w:1", type: "ADD_CARD_TAG", target: { type: "element", id: "personal-task-board/card/a@board" }, payload: { tag: "作業" } })]
  const revisions = applyReview(page, brief(draft, "w:1"), { now }).page.changes.revisions ?? []
  assert.equal(revisions.length, 20)
  assert.equal(revisions[0]?.revision, "2026-11-01.2")
  assert.match(revisions.at(-1)?.changes[0]?.title ?? "", /タグを追加/)
})

test("区切りごとに符号化した target の id を読み、盤面とページの食い違いは捨てる", () => {
  assert.deepEqual(parseTargetId("personal-task-board/card/a%2Fb%40c@board"), { board: "personal-task-board", kind: "card", id: "a/b@c" })
  assert.deepEqual(parseTargetId("personal-learning/column/backlog@learning"), { board: "personal-learning", kind: "column", id: "backlog" })
  assert.equal(parseTargetId("personal-task-board/card/a@learning"), undefined)
  assert.equal(parseTargetId("personal-task-board/card/a"), undefined)
  assert.equal(parseTargetId("nope/card/a@board"), undefined)
  assert.equal(parseTargetId("personal-task-board/card/%E0%A4%A@board"), undefined)
  assert.equal(parseTargetId(undefined), undefined)
})

test("本人が書いた見出しは説明に残し、書き戻しても残る", () => {
  const page = empty()
  columnOf(boardOf(page), "todo").cards = [card("a", 1, "A", { description: "説明\n\n## メモ\n本人のメモ" })]
  const view = readCard(cardOf(boardOf(page), "a"))
  assert.match(view.detail, /## メモ\n本人のメモ/)
  const out = applyIntents(page, [{ op: "detail", card: "a", text: "追記" }])
  const written = readCard(cardOf(boardOf(out.page), "a"))
  assert.match(written.detail, /## メモ\n本人のメモ/)
  assert.match(written.detail, /追記/)
})

test("`## ブロック理由` は `## Pending の理由` として読み、書き戻すと見出しをそろえる", () => {
  const legacy = card("a", 1, "A", { description: "説明\n\n## ブロック理由\n待ち" })
  const view = readCard(legacy)
  assert.equal(view.pending, "待ち")
  const written = writeCard(legacy, view)
  assert.match(written.description ?? "", /## Pending の理由\n待ち/)
  assert.ok(!(written.description ?? "").includes("ブロック理由"))
  assert.equal(readCard(written).pending, "待ち")
})

test("Asia/Tokyo の日付は 23:59 と 00:00 で切り替わる", () => {
  assert.equal(tokyoStamp(new Date("2026-11-29T14:59:00.000Z")), "2026-11-29 23:59")
  assert.equal(tokyoDate(new Date("2026-11-29T14:59:59.999Z")), "2026-11-29")
  assert.equal(tokyoStamp(new Date("2026-11-29T15:00:00.000Z")), "2026-11-30 00:00")
  assert.equal(tokyoDate(new Date("2026-11-29T15:00:00.000Z")), "2026-11-30")
})

test("未知の op はカードを探す前に拒む", () => {
  const page = empty()
  const unknown = (card?: string): Intent => ({ op: "nope", ...(card === undefined ? {} : { card }) }) as unknown as Intent
  assert.throws(() => applyIntents(page, [unknown("missing")]), /unknown op: nope/)
  columnOf(boardOf(page), "todo").cards = [card("a", 1, "A")]
  assert.throws(() => applyIntents(page, [unknown("a")]), /unknown op: nope/)
  assert.throws(() => applyIntents(page, [unknown()]), /unknown op: nope/)
})

test("記録の下の書式外の行は、同じ記録をまとめても繰り返しの行とコードブロックの閉じを落とさない", () => {
  const extra = ["```", "npm i", "```", "同じ行", "同じ行"]
  const note: Note = { at: "2026-11-27 10:00", author: "本人", text: "手順", extra }
  assert.deepEqual(mergeRecords([note], [{ ...note, extra: [...extra] }]), [note])
  assert.deepEqual(mergeRecords([note], [{ ...note, extra: [...extra, "足した行"] }])[0]?.extra, [...extra, "足した行"])
})

test("draft action の配列から反映し、addressed 済みの action は当て直さない", () => {
  const page = empty()
  columnOf(boardOf(page), "todo").cards = [card("a", 1, "A")]
  const target = { type: "element", id: "personal-task-board/card/a@board" }
  const first = action({ id: "w:1", type: "SET_CARD_TITLE", target, payload: { title: "本人が直した題" } })
  const state = (actions: DraftAction[]) => JSON.stringify(actions.map((a) => ({ ...a, author: { id: "u1" } })))
  const once = applyReview(page, state([first]), { now })
  assert.equal(cardOf(boardOf(once.page), "a").title, "本人が直した題")
  assert.equal(once.addressed, "w:1")
  assert.deepEqual(once.handled, [])
  // Agent が題を直したあと、閲覧者がまだ開いておらず draft に w:1 が残っていても、w:1 は当て直さない。
  columnOf(boardOf(once.page), "todo").cards = [{ ...cardOf(boardOf(once.page), "a"), title: "Agent が直した題" }]
  const second = action({ id: "w:2", type: "ADD_CARD_TAG", target, payload: { tag: "作業" } })
  const twice = applyReview(once.page, state([first, second]), { now })
  assert.equal(cardOf(boardOf(twice.page), "a").title, "Agent が直した題")
  assert.deepEqual(cardOf(boardOf(twice.page), "a").tags, ["作業"])
  assert.deepEqual(twice.handled, ["w:1"])
  assert.equal(twice.addressed, "w:1-2")
})

test("edits は、順に当てると前の HTML を後の HTML に変える", () => {
  const before = ["<a>", "  {", "    x", "  }", "  {", "    y", "  }", "</a>", ""].join("\n")
  const cases = [
    ["<a>", "  {", "    x", "  }", "  {", "    z", "  }", "  {", "    w", "  }", "</a>", ""].join("\n"),
    ["<a>", "  {", "    y", "  }", "</a>", ""].join("\n"),
    ["<b>", "  {", "    x", "  }", "  {", "    y", "  }", "</b>", ""].join("\n"),
  ]
  for (const after of cases) assert.equal(applyEdits(before, editsBetween(before, after)), after)
  // カードを前の列へ動かすと、前の置き換えが挿し込んだ行と元の行が同じになる。後の oldText は当てた後の本文で 1 か所に絞る。
  const moveFrom = "<col a>\nc1\n</col>\n<col b>\nc2\ncard-X\n</col>\n"
  const moveTo = "<col a>\nc1\ncard-X\n</col>\n<col b>\nc2\n</col>\n"
  assert.equal(applyEdits(moveFrom, editsBetween(moveFrom, moveTo)), moveTo)
  // 重なる出現も数える。
  assert.equal(applyEdits("x\nx\nx\n", editsBetween("x\nx\nx\n", "x\nx\nz\nx\n")), "x\nx\nz\nx\n")
  // max を超える件数になると失敗する。
  const many = Array.from({ length: 600 }, (_, i) => `line ${i}\n`)
  const changed = many.map((line, i) => (i % 10 === 0 ? `changed ${i}\n` : line))
  assert.throws(() => editsBetween(many.join(""), changed.join(""), 50), /上限 50 件/)
  assert.equal(applyEdits(many.join(""), editsBetween(many.join(""), changed.join(""))), changed.join(""))
  assert.deepEqual(editsBetween(before, before), [])
  // 盤面の HTML を apply した結果でも、送る量は文書全体より小さい。
  const page = empty()
  const html = renderPage(TEMPLATE, page)
  const next = applyIntents(page, [{ op: "add", key: "k", column: "todo", title: "t" }], { now: new Date("2026-11-28T00:00:00Z") })
  const out = renderPage(html, next.page)
  const edits = editsBetween(html, out)
  assert.equal(applyEdits(html, edits), out)
  assert.ok(edits.reduce((sum, e) => sum + e.oldText.length + e.newText.length, 0) < out.length)
})
