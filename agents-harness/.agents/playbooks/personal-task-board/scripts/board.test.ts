import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { type Action, COLUMNS, cardId, findCard, fold, plan, readActions, renderBoard } from "./board.ts"

const now = new Date("2026-11-27T10:00:00.000Z")
const later = new Date("2026-11-27T10:05:00.000Z")

// ページ上の編集が db に入ったときの実際の形 (dev-process-kit 0.4.2 の SyncHost が push したもの)。
const userAdd: Action = {
  id: "uwjz3rxk:1",
  type: "ADD_CARD",
  target: { type: "element", id: "personal-task-board/column/todo@board" },
  payload: { id: "ui-card", title: "UI で足したカード" },
  createdAt: "2026-11-27T09:00:00.000Z",
  author: { id: "u_tester" },
}

test("base の列は board.html の Kanban と同じ", () => {
  const html = readFileSync(new URL("../assets/board.html", import.meta.url), "utf8")
  const json = /<dpk-board-kanban[^>]*>\s*<script type="application\/json">([\s\S]*?)<\/script>/.exec(html)?.[1]
  assert.ok(json !== undefined)
  const columns = (JSON.parse(json) as { columns: { id: string; label: string; color: string; cards: unknown[] }[] }).columns
  assert.deepEqual(
    columns.map(({ id, label, color, cards }) => ({ id, label, color, cards: cards.length })),
    COLUMNS.map((c) => ({ ...c, cards: 0 })),
  )
})

test("カードの追加・状況の更新・詳細の追記を action にして畳み込める", () => {
  const key = "https://example.com/issues/1"
  const id = cardId(key)
  const first = plan([userAdd], [{ op: "add", key, column: "todo", title: "課題 1", detail: "背景", note: "積んだ", links: [{ url: key }] }], {
    writer: "cc-a",
    now,
  })
  const second = plan([userAdd, ...first.actions], [{ op: "status", key, column: "doing", note: "着手" }, { op: "detail", card: id, text: "方針: A 案" }], {
    writer: "cc-b",
    now: later,
  })
  const board = fold([userAdd, ...first.actions, ...second.actions])
  const found = findCard(board, id)
  assert.equal(found?.column, "doing")
  assert.equal(found?.card.description, "背景\n\n方針: A 案\n\n## 状況\n- 2026-11-27 10:00Z 積んだ\n- 2026-11-27 10:05Z 着手")
  assert.deepEqual(found?.card.links, [{ url: key, label: null }])
  assert.equal(findCard(board, "ui-card")?.card.number, 1)
  assert.equal(found?.card.number, 2)
  assert.deepEqual(board.stale, [])
  assert.ok([...first.actions, ...second.actions].every((a) => /^[A-Za-z0-9_-]+:[0-9]{3}$/.test(a.id)))
})

test("同じキーのカードは 2 回積まない", () => {
  const intents = [{ op: "add" as const, key: "slack:C1/p1", column: "todo", title: "返事を書く" }]
  const first = plan([], intents, { writer: "cc-a", now })
  const second = plan(first.actions, intents, { writer: "cc-b", now })
  assert.equal(second.actions.length, 0)
  assert.equal(second.skipped.length, 1)
})

test("別々のセッションが同時に別のカードを更新しても、どちらの更新も残る", () => {
  const base = plan(
    [],
    [
      { op: "add", key: "a", column: "todo", title: "A" },
      { op: "add", key: "b", column: "todo", title: "B" },
    ],
    { writer: "cc-0", now },
  ).actions
  // 2 つのセッションが同じ盤面を読み、互いを知らずに書く。
  const s1 = plan(base, [{ op: "status", key: "a", column: "doing", note: "A 着手" }], { writer: "cc-1", now: later })
  const s2 = plan(base, [{ op: "status", key: "b", column: "blocked", note: "B 待ち" }], { writer: "cc-2", now: later })
  const board = fold([...base, ...s2.actions, ...s1.actions])
  assert.equal(findCard(board, cardId("a"))?.column, "doing")
  assert.equal(findCard(board, cardId("b"))?.column, "blocked")
  assert.match(findCard(board, cardId("a"))?.card.description ?? "", /A 着手/)
  assert.match(findCard(board, cardId("b"))?.card.description ?? "", /B 待ち/)
})

test("同じ id の ADD_CARD が競合しても 1 枚にまとまり、後のものは stale になる", () => {
  const intents = [{ op: "add" as const, key: "same", column: "todo", title: "X" }]
  const s1 = plan([], intents, { writer: "cc-1", now })
  const s2 = plan([], intents, { writer: "cc-2", now })
  const board = fold([...s1.actions, ...s2.actions])
  assert.equal(board.columns.flatMap((c) => c.cards).length, 1)
  assert.deepEqual(board.stale, [{ id: "cc-2:001", type: "ADD_CARD" }])
})

test("ページ上のコメントはカードごとに読める", () => {
  const comment: Action = {
    id: "uwjz3rxk:2",
    type: "comment",
    target: { type: "element", id: "personal-task-board/card/ui-card@board" },
    payload: { body: "本人のコメント" },
    createdAt: "2026-11-27T09:01:00.000Z",
    author: { id: "u_tester" },
  }
  assert.deepEqual(fold([userAdd, comment]).comments, [
    { card: "ui-card", body: "本人のコメント", author: "u_tester", createdAt: "2026-11-27T09:01:00.000Z" },
  ])
})

test("無いカードへの更新は action を作らない", () => {
  const result = plan([], [{ op: "status", key: "none", note: "x" }], { writer: "cc-a", now })
  assert.equal(result.actions.length, 0)
  assert.equal(result.skipped.length, 1)
})

test("1 回の plan で 10 個以上の action を作っても、作った順に再生される", () => {
  const intents = [1, 2, 3].map((n) => ({
    op: "add" as const,
    key: `k${n}`,
    column: "todo",
    title: `課題 ${n}`,
    detail: "背景",
    note: "積んだ",
    tags: ["作業"],
    links: [{ url: `https://example.com/${n}` }],
  }))
  const result = plan([], intents, { writer: "cc-a", now })
  assert.ok(result.actions.length >= 10)
  const board = fold(result.actions)
  assert.deepEqual(board.stale, [])
  for (const n of [1, 2, 3]) {
    const card = findCard(board, cardId(`k${n}`))
    assert.equal(card?.card.number, n)
    assert.deepEqual(card?.card.links, [{ url: `https://example.com/${n}`, label: null }])
  }
})

test("URL の key は表記ゆれをそろえて同じカード id にする", () => {
  const id = cardId("https://example.com/issues/12")
  assert.equal(cardId("https://EXAMPLE.com/issues/12/"), id)
  assert.equal(cardId(" https://example.com/issues/12#comment-3 "), id)
  assert.notEqual(cardId("https://example.com/issues/13"), id)
  assert.equal(cardId("session:x"), cardId(" session:x "))
})

test("dump に actions が無ければ失敗し、--empty のときだけ空の盤面にする", () => {
  const dir = mkdtempSync(join(tmpdir(), "board-"))
  assert.throws(() => readActions(dir))
  assert.deepEqual(readActions(dir, { allowEmpty: true }), [])
  mkdirSync(join(dir, "actions"))
  assert.deepEqual(readActions(dir), [])
})

test("カード以外に付いたコメントも宛先と本文つきで出す", () => {
  const onColumn: Action = {
    id: "uwjz3rxk:3",
    type: "comment",
    target: { type: "element", id: "personal-task-board/column/todo@board" },
    payload: { body: "列へのコメント" },
    createdAt: "2026-11-27T09:02:00.000Z",
    author: { id: "u_tester" },
  }
  const text = renderBoard(fold([userAdd, onColumn]))
  assert.match(text, /## カード以外へのコメント\n- column\/todo .* u_tester: 列へのコメント/)
})

test("書き手の時計が遅れていても、読んだ action より後に再生される", () => {
  const ahead: Action = { ...userAdd, createdAt: "2026-11-27T10:02:00.000Z" }
  const result = plan([ahead], [{ op: "status", card: "ui-card", column: "doing", note: "着手" }], { writer: "cc-a", now })
  const board = fold([ahead, ...result.actions])
  assert.deepEqual(board.stale, [])
  assert.equal(findCard(board, "ui-card")?.column, "doing")
})

test("詳細に「## 状況」で始まる別の見出しがあっても、状況の節だけに行を足す", () => {
  const set: Action = {
    id: "uwjz3rxk:4",
    type: "SET_CARD_DESCRIPTION",
    target: { type: "element", id: "personal-task-board/card/ui-card@board" },
    payload: { description: "## 状況の整理\n\n本文" },
    createdAt: "2026-11-27T09:03:00.000Z",
  }
  const result = plan([userAdd, set], [{ op: "status", card: "ui-card", note: "着手" }], { writer: "cc-a", now })
  const board = fold([userAdd, set, ...result.actions])
  assert.equal(findCard(board, "ui-card")?.card.description, "## 状況の整理\n\n本文\n\n## 状況\n- 2026-11-27 10:00Z 着手")
})
