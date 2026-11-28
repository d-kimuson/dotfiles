import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import {
  type Action,
  type Attr,
  ATTR_NAMES,
  BOARDS,
  DEFERRABLE,
  OWNERS,
  SPLIT,
  type Intent,
  type Note,
  attrId,
  attrsOf,
  cardId,
  checkSession,
  isAttr,
  isDeferred,
  findCard,
  fold,
  parseDescription,
  plan,
  planMigration,
  planNoteMigration,
  readActions,
  readAttrs,
  readNotes,
  renderBoard,
  sessionFromEnv,
  tokyoDate,
} from "./board.ts"

const now = new Date("2026-11-27T10:00:00.000Z")
const later = new Date("2026-11-27T10:05:00.000Z")
const archiveAt = new Date("2026-11-28T00:00:00.000Z")

// ページ上の編集が db に入ったときの実際の形 (dev-process-kit 0.4.2 の SyncHost が push したもの)。number が無い。
const userAdd: Action = {
  id: "uwjz3rxk:1",
  type: "ADD_CARD",
  target: { type: "element", id: "personal-task-board/column/todo@board" },
  payload: { id: "ui-card", title: "UI で足したカード" },
  createdAt: "2026-11-27T09:00:00.000Z",
  author: { id: "u_tester" },
}
const pageAction = (id: string, type: string, path: string, payload: Record<string, unknown>, createdAt: string): Action => ({
  id,
  type,
  target: { type: "element", id: `personal-task-board/${path}@board` },
  payload,
  createdAt,
  author: { id: "u_tester" },
})
const run = (actions: Action[], intents: Intent[], writer: string, at = now) => {
  const result = plan(actions, intents, { writer, now: at })
  return [...actions, ...result.actions]
}

test("列は board.html の各 Kanban と同じ", () => {
  const html = readFileSync(new URL("../assets/board.html", import.meta.url), "utf8")
  for (const b of BOARDS) {
    const json = new RegExp(`<dpk-board-kanban id="${b.id}"[^>]*>\\s*<script type="application/json">([\\s\\S]*?)</script>`).exec(html)?.[1]
    assert.ok(json !== undefined, b.id)
    const columns = (JSON.parse(json) as { columns: { id: string; label: string; color: string; cards: unknown[] }[] }).columns
    assert.deepEqual(
      columns.map(({ id, label, color, cards }) => ({ id, label, color, cards: cards.length })),
      b.columns.map((c) => ({ ...c, cards: 0 })),
    )
    assert.match(html, new RegExp(`<dpk-page name="${b.page}"`))
  }
})

test("属性の規則は board.html と同じ", () => {
  const html = readFileSync(new URL("../assets/board.html", import.meta.url), "utf8")
  const constant = (name: string): unknown => {
    const literal = new RegExp(`const ${name} = (.+?);`).exec(html)?.[1]
    assert.ok(literal !== undefined, name)
    return JSON.parse(literal)
  }
  assert.deepEqual(constant("DEFERRABLE"), DEFERRABLE)
  assert.deepEqual(constant("OWNERS"), [...OWNERS])
  assert.equal(constant("SPLIT"), SPLIT)
  assert.deepEqual(constant("ATTR_NAMES"), [...ATTR_NAMES])
})

test("カードの追加・移動・詳細の追記を action にして畳み込み、description に状況の履歴を残さない", () => {
  const key = "https://example.com/issues/1"
  const id = cardId(key)
  const first = run([userAdd], [{ op: "add", key, column: "todo", title: "課題 1", detail: "背景", links: [{ url: key }] }], "cc-a")
  const second = run(first, [{ op: "move", key, column: "doing" }, { op: "detail", card: id, text: "方針: A 案" }], "cc-b", later)
  const board = fold(second)
  const found = findCard(board, id)
  assert.equal(found?.column, "doing")
  assert.equal(found?.card.description, "背景\n\n方針: A 案")
  assert.deepEqual(found?.card.links, [{ url: key, label: null }])
  assert.equal(findCard(board, "ui-card")?.card.number, 1)
  assert.equal(found?.card.number, 2)
  assert.deepEqual(board.stale, [])
  assert.ok(second.slice(1).every((a) => /^[A-Za-z0-9_-]+:[0-9]{3}$/.test(a.id)))
})

test("blocked へは理由が要り、理由は Pending の理由の節に置き、blocked から出ると消える", () => {
  const base = run([], [{ op: "add", key: "k", column: "doing", title: "K", detail: "説明" }], "cc-a")
  assert.throws(() => plan(base, [{ op: "move", key: "k", column: "blocked" }], { writer: "cc-b", now }))
  const blocked = run(base, [{ op: "move", key: "k", column: "blocked", reason: "レビュー待ち" }], "cc-b", later)
  assert.equal(findCard(fold(blocked), cardId("k"))?.card.description, "説明\n\n## Pending の理由\nレビュー待ち")
  const resumed = run(blocked, [{ op: "move", key: "k", column: "doing" }], "cc-c", new Date("2026-11-27T10:10:00.000Z"))
  assert.equal(findCard(fold(resumed), cardId("k"))?.card.description, "説明")
})

test("今日やる列にも移せ、学習カードは別の盤面に積む", () => {
  const actions = run(
    [],
    [
      { op: "add", key: "t", column: "today", title: "今日のタスク" },
      { op: "add", key: "l", board: "personal-learning", column: "backlog", title: "学ぶこと" },
    ],
    "cc-a",
  )
  const board = fold(actions)
  assert.equal(findCard(board, cardId("t"))?.column, "today")
  assert.equal(findCard(board, cardId("l"))?.board, "personal-learning")
  assert.equal(findCard(board, cardId("l"))?.card.number, 1)
  assert.ok(actions.some((a) => a.target.id === "personal-learning/column/backlog@learning"))
  assert.throws(() => plan([], [{ op: "add", key: "x", board: "personal-learning", column: "todo", title: "X" }], { writer: "cc-a", now }))
})

test("セッションの参照は、ローカルは description に重複なく足し、web は URL のリンクにする", () => {
  const web = "https://claude.ai/code/session_01AbC"
  const base = run([], [{ op: "add", key: "k", column: "doing", title: "K", sessions: ["claude-code 11111111-2222-3333-4444-555555555555"] }], "cc-a")
  const next = run(
    base,
    [
      { op: "session", key: "k", session: "codex 019a-thread" },
      { op: "session", key: "k", session: "claude-code 11111111-2222-3333-4444-555555555555" },
      { op: "session", key: "k", session: web },
    ],
    "cc-b",
    later,
  )
  const card = findCard(fold(next), cardId("k"))?.card
  assert.deepEqual(parseDescription(card?.description ?? null).sessions, ["claude-code 11111111-2222-3333-4444-555555555555", "codex 019a-thread"])
  assert.deepEqual(card?.links, [{ url: web, label: "session" }])
  assert.throws(() => checkSession("cursor abc"))
  assert.throws(() => checkSession("https://claude.ai/code/cse_x"))
})

test("同じキーのカードは 2 回積まない", () => {
  const intents = [{ op: "add" as const, key: "slack:C1/p1", column: "todo", title: "返事を書く" }]
  const first = plan([], intents, { writer: "cc-a", now })
  const second = plan(first.actions, intents, { writer: "cc-b", now })
  assert.equal(second.actions.length, 0)
  assert.equal(second.skipped.length, 1)
})

test("別々のセッションが同時に別のカードを更新しても、どちらの更新も残る", () => {
  const base = run(
    [],
    [
      { op: "add", key: "a", column: "todo", title: "A" },
      { op: "add", key: "b", column: "todo", title: "B" },
    ],
    "cc-0",
  )
  // 2 つのセッションが同じ盤面を読み、互いを知らずに書く。
  const s1 = plan(base, [{ op: "move", key: "a", column: "doing" }, { op: "detail", key: "a", text: "A の方針" }], { writer: "cc-1", now: later })
  const s2 = plan(base, [{ op: "move", key: "b", column: "blocked", reason: "B 待ち" }], { writer: "cc-2", now: later })
  const board = fold([...base, ...s2.actions, ...s1.actions])
  assert.equal(findCard(board, cardId("a"))?.column, "doing")
  assert.equal(findCard(board, cardId("b"))?.column, "blocked")
  assert.match(findCard(board, cardId("a"))?.card.description ?? "", /A の方針/)
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

const note = (id: string, card: string, body: string, createdAt: string, author: Note["author"] = { id: "u_tester" }): Note => ({
  id,
  board: "personal-task-board",
  card,
  body,
  author,
  createdAt,
})

test("kit の comment action はレビューコメントとして読み、カードのコメントには出さない", () => {
  const comment = pageAction("uwjz3rxk:2", "comment", "card/ui-card", { body: "本人の指示" }, "2026-11-27T09:01:00.000Z")
  const board = fold([userAdd, comment])
  assert.deepEqual(board.reviews, [
    { id: "uwjz3rxk:2", board: "personal-task-board", path: "card/ui-card", body: "本人の指示", author: { id: "u_tester" }, createdAt: "2026-11-27T09:01:00.000Z" },
  ])
  const text = renderBoard(board, [])
  assert.match(text, /## レビューコメント \(本人から Agent への指示\)\n- uwjz3rxk:2 personal-task-board\/card\/ui-card \S+ 本人: 本人の指示/)
  assert.doesNotMatch(text, /    > /)
})

test("無いカードへの更新は action を作らない", () => {
  const result = plan([], [{ op: "detail", key: "none", text: "x" }], { writer: "cc-a", now })
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
    tags: ["作業"],
    links: [{ url: `https://example.com/${n}` }, { url: `https://example.com/${n}/pr` }],
  }))
  const result = plan([], intents, { writer: "cc-a", now })
  assert.ok(result.actions.length >= 10)
  const board = fold(result.actions)
  assert.deepEqual(board.stale, [])
  for (const n of [1, 2, 3]) {
    const card = findCard(board, cardId(`k${n}`))
    assert.equal(card?.card.number, n)
    assert.equal(card?.card.links.length, 2)
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

test("カード以外へのレビューコメントも宛先と本文つきで出し、カードの無いコメントも落とさない", () => {
  const onColumn = pageAction("uwjz3rxk:3", "comment", "column/todo", { body: "列への指示" }, "2026-11-27T09:02:00.000Z")
  const text = renderBoard(fold([userAdd, onColumn]), [note("u:9", "gone", "消えたカードへのメモ", "2026-11-27T09:03:00.000Z")])
  assert.match(text, /## レビューコメント .*\n- uwjz3rxk:3 personal-task-board\/column\/todo .* 本人: 列への指示/)
  assert.match(text, /## カードの無いコメント\n- personal-task-board\/gone .* 本人: 消えたカードへのメモ/)
})

test("書き手の時計が遅れていても、読んだ action より後に再生される", () => {
  const ahead: Action = { ...userAdd, createdAt: "2026-11-27T10:02:00.000Z" }
  const result = plan([ahead], [{ op: "move", card: "ui-card", column: "doing" }], { writer: "cc-a", now })
  const board = fold([ahead, ...result.actions])
  assert.deepEqual(board.stale, [])
  assert.equal(findCard(board, "ui-card")?.column, "doing")
})

test("移行は「## 状況」節を落とし、Pending のカードは最後の状況を Pending の理由にする", () => {
  const legacy = [
    userAdd,
    pageAction("cc-old:1", "ADD_CARD", "column/blocked", { id: "b", title: "B" }, "2026-11-27T09:01:00.000Z"),
    pageAction("cc-old:2", "SET_CARD_DESCRIPTION", "card/b", { description: "説明\n\n## 状況\n- 2026-11-27 09:01Z 積んだ\n- 2026-11-27 09:02Z PR のレビュー待ち" }, "2026-11-27T09:02:00.000Z"),
    pageAction("cc-old:3", "SET_CARD_DESCRIPTION", "card/ui-card", { description: "## 状況の整理\n\n本文\n\n## 状況\n- 2026-11-27 09:03Z 着手" }, "2026-11-27T09:03:00.000Z"),
  ]
  const created = planMigration(legacy, { writer: "cc-m", now })
  const board = fold([...legacy, ...created])
  assert.equal(findCard(board, "b")?.card.description, "説明\n\n## Pending の理由\nPR のレビュー待ち")
  assert.equal(findCard(board, "ui-card")?.card.description, "## 状況の整理\n\n本文")
  assert.deepEqual(planMigration([...legacy, ...created], { writer: "cc-n", now: later }), [])
})

test("description の本人が書いた見出しと行は、Pending の理由とセッションの節に吸い込まず説明に残す", () => {
  const d = parseDescription("説明\n\n## ブロック理由\n待ち\n\n## メモ\n本人のメモ\n\n## セッション\n- codex abc\n本人の行")
  assert.equal(d.blocked, "待ち")
  assert.deepEqual(d.sessions, ["codex abc"])
  assert.match(d.detail, /## メモ\n本人のメモ/)
  assert.match(d.detail, /本人の行/)
})

const numbersOf = (board: ReturnType<typeof fold>) =>
  Object.fromEntries(board.columns.flatMap((c) => c.cards.map((x) => [x.id, { number: x.number, column: c.id }])))

test("アーカイブは Done のカードを隠した列へ移すだけで、action を消さず、番号を変えない", () => {
  const base = run(
    [userAdd],
    [
      { op: "add", key: "a", column: "doing", title: "A" },
      { op: "add", key: "d", column: "done", title: "D", tags: ["作業"] },
      { op: "add", key: "l", board: "personal-learning", column: "done", title: "L" },
    ],
    "cc-a",
  )
  const comment = pageAction("uwjz3rxk:6", "comment", `card/${cardId("d")}`, { body: "済んだ?" }, "2026-11-27T10:01:30.000Z")
  const notes = [note("uwjz3rxk:7", cardId("d"), "済んだ", "2026-11-27T10:01:40.000Z")]
  const before = fold([...base, comment])
  const only = plan([...base, comment], [{ op: "archive", board: "personal-task-board" }], { writer: "cc-b", now: later })
  assert.deepEqual(only.actions.map((a) => [a.type, a.target.id, a.payload]), [
    ["MOVE_CARD", `personal-task-board/card/${cardId("d")}@board`, { column: "archived", before: null }],
  ])
  const after = run([...base, comment], [{ op: "archive" }], "cc-b", later)
  const board = fold(after)
  assert.deepEqual(board.stale, [])
  assert.equal(findCard(board, cardId("d"))?.column, "archived")
  assert.equal(findCard(board, cardId("l"))?.column, "archived")
  for (const [id, v] of Object.entries(numbersOf(before))) assert.equal(numbersOf(board)[id]?.number, v.number, id)
  // show は既定でアーカイブを出さず、--archived で説明・タグ・コメントごと出す。
  assert.doesNotMatch(renderBoard(board, notes), /TASK-3/)
  assert.doesNotMatch(renderBoard(board, notes), /カードの無いコメント/)
  assert.match(renderBoard(board, notes, { archived: true }), /TASK-3 \S+ D \[作業\][\s\S]*> .* 本人: 済んだ/)
  // アーカイブした後に足したカードは次の番号を取り、同じキーでは積み直さない。
  const next = plan(after, [{ op: "add", key: "n", column: "todo", title: "N" }, { op: "add", key: "d", column: "todo", title: "D" }], { writer: "cc-c", now: archiveAt })
  assert.equal(findCard(fold([...after, ...next.actions]), cardId("n"))?.card.number, 4)
  assert.match(next.skipped[0] ?? "", /既にある \(archived/)
  assert.throws(() => plan(after, [{ op: "move", key: "a", column: "archived" }], { writer: "cc-c", now: archiveAt }))
})

// 各書き手の action は順に届く。どの書き手がどこまで届いたかの全ての組み合わせで、盤面を確かめる。
const prefixes = (writers: Action[][]): Action[][] => {
  const [head, ...tail] = writers
  if (head === undefined) return [[]]
  return tail.length === 0
    ? head.map((_, i) => head.slice(0, i)).concat([head])
    : prefixes(tail).flatMap((rest) => [...head.map((_, i) => head.slice(0, i)), head].map((h) => [...h, ...rest]))
}

test("アーカイブ・Agent の追加と移動・ページの追加がどう重なっても、カードは失われず番号は変わらず重ならない", () => {
  const base = run(
    [],
    [
      { op: "add", key: "d1", column: "done", title: "D1" },
      { op: "add", key: "d2", column: "done", title: "D2" },
      { op: "add", key: "p", column: "doing", title: "P" },
    ],
    "cc-0",
  )
  const initial = numbersOf(fold(base))
  for (const [archiveAtMs, agentAtMs] of [
    [later, archiveAt],
    [archiveAt, later],
  ] as const) {
    const archive = plan(base, [{ op: "archive" }], { writer: "cc-ar", now: archiveAtMs }).actions
    const agent = plan(base, [{ op: "add", key: "x", column: "todo", title: "X" }, { op: "move", key: "p", column: "blocked", reason: "待ち" }], { writer: "cc-ag", now: agentAtMs }).actions
    const page = [pageAction("uwjz3rxk:9", "ADD_CARD", "column/todo", { id: "ui-new", title: "ページで足した" }, "2026-11-27T10:03:00.000Z")]
    const another = plan(base, [{ op: "add", key: "y", column: "today", title: "Y" }], { writer: "cc-an", now: agentAtMs }).actions
    for (const present of prefixes([archive, agent, page, another])) {
      const board = fold([...base, ...present])
      assert.deepEqual(board.stale, [])
      const numbers = numbersOf(board)
      for (const [id, v] of Object.entries(initial)) assert.equal(numbers[id]?.number, v.number, id)
      const all = Object.values(numbers).map((v) => v.number)
      assert.equal(new Set(all).size, all.length)
      const added = present.filter((a) => a.type === "ADD_CARD").map((a) => String(a.payload.id))
      for (const id of added) assert.ok(numbers[id] !== undefined, id)
    }
  }
})

test("セッションの参照を環境変数から出す", () => {
  assert.equal(sessionFromEnv({ CLAUDE_CODE_REMOTE: "true", CLAUDE_CODE_REMOTE_SESSION_ID: "cse_01AbC", CLAUDE_CODE_SESSION_ID: "x" }), "https://claude.ai/code/session_01AbC")
  assert.equal(sessionFromEnv({ CLAUDE_CODE_SESSION_ID: "1111" }), "claude-code 1111")
  assert.equal(sessionFromEnv({ CODEX_THREAD_ID: "019a" }), "codex 019a")
  assert.equal(sessionFromEnv({ PI_SESSION_ID: "p1" }), "pi p1")
  assert.equal(sessionFromEnv({ COMMANDCODE_SCRATCHPAD: "/tmp/commandcode-1000/proj/abc123/scratchpad" }), "command-code abc123")
  assert.equal(sessionFromEnv({}), undefined)
  for (const env of [{ CLAUDE_CODE_SESSION_ID: "1111" }, { COMMANDCODE_SCRATCHPAD: "/tmp/commandcode-1000/proj/abc123/scratchpad" }])
    assert.equal(checkSession(sessionFromEnv(env) ?? ""), sessionFromEnv(env))
})

test("plan は未知の op と盤面を拒み、空の label を付けず、本人の「## 状況」節を残す", () => {
  assert.throws(() => plan([userAdd], [{ op: "status", card: "ui-card" } as unknown as Intent], { writer: "cc-a", now }), /unknown op: status/)
  assert.throws(() => plan([userAdd], [{ op: "archive", board: "nope" } as unknown as Intent], { writer: "cc-a", now }), /unknown board: nope/)
  assert.throws(() => plan([], [{ op: "add", key: "k", board: "nope", column: "todo", title: "T" } as unknown as Intent], { writer: "cc-a", now }), /unknown board: nope/)
  const link = plan([userAdd], [{ op: "link", card: "ui-card", url: "https://example.com/a", label: " " }], { writer: "cc-a", now })
  assert.deepEqual(link.actions[0]?.payload, { url: "https://example.com/a" })
  const own = pageAction("u:2", "SET_CARD_DESCRIPTION", "card/ui-card", { description: "説明\n\n## 状況\n本人のメモ" }, "2026-11-27T10:00:30.000Z")
  const result = plan([userAdd, own], [{ op: "session", card: "ui-card", session: "codex t1" }], { writer: "cc-a", now })
  assert.equal(findCard(fold([userAdd, own, ...result.actions]), "ui-card")?.card.description, "説明\n\n## 状況\n本人のメモ\n\n## セッション\n- codex t1")
})

test("comment は action を作らず、カードへの note を 1 つ作る", () => {
  const result = plan([userAdd], [{ op: "comment", card: "ui-card", text: "  方針: A を採る\n理由は B  " }], { writer: "cc-a", now })
  assert.deepEqual(result.actions, [])
  assert.deepEqual(result.notes, [
    {
      id: "cc-a:001",
      board: "personal-task-board",
      card: "ui-card",
      body: "方針: A を採る\n理由は B",
      author: { id: "agent:claude-code", name: "Claude Code" },
      createdAt: now.toISOString(),
    },
  ])
  assert.deepEqual(fold([userAdd, ...result.actions]).reviews, [])
})

test("comment は無いカードを飛ばし、空の text を拒む", () => {
  const missing = plan([userAdd], [{ op: "comment", key: "none", text: "x" }], { writer: "cc-a", now })
  assert.deepEqual(missing, { actions: [], notes: [], attrs: [], skipped: [`comment ${cardId("none")}: カードが無い`] })
  assert.throws(() => plan([userAdd], [{ op: "comment", card: "ui-card", text: " \n " }], { writer: "cc-a", now }), /comment: text が空/)
})

test("show はページと Agent のコメントを時刻の順に混ぜて出し、複数行の本文の 2 行目以降を字下げする", () => {
  const agent = plan([userAdd], [{ op: "comment", card: "ui-card", text: "Agent のメモ" }], { writer: "cc-a", now: new Date("2026-11-27T09:02:30.000Z") }).notes
  const notes = [note("u:3", "ui-card", "後のコメント", "2026-11-27T09:03:00.000Z"), ...agent, note("u:2", "ui-card", "1 行目\n2 行目", "2026-11-27T09:02:00.000Z")]
  const text = renderBoard(fold([userAdd]), notes)
  assert.ok(
    text.includes(
      [
        "    > 2026-11-27T09:02:00.000Z 本人: 1 行目",
        "    >   2 行目",
        "    > 2026-11-27T09:02:30.000Z Claude Code: Agent のメモ",
        "    > 2026-11-27T09:03:00.000Z 本人: 後のコメント",
      ].join("\n"),
    ),
    text,
  )
})

test("Agent が actions に書いたコメントは別の節に出し、移行で同じ id の note に写して action を消す", () => {
  const legacy: Action = { ...pageAction("cc-old:002", "comment", "card/ui-card", { body: "状況" }, "2026-11-27T09:05:00.000Z"), author: { id: "agent:claude-code", name: "Claude Code" } }
  const review = pageAction("u:4", "comment", "card/ui-card", { body: "直して" }, "2026-11-27T09:06:00.000Z")
  const onColumn: Action = { ...legacy, id: "cc-old:003", target: { type: "element", id: "personal-task-board/column/todo@board" } }
  const actions = [userAdd, legacy, review, onColumn]
  assert.match(renderBoard(fold(actions), []), /## Agent が actions に書いたコメント .*\n- cc-old:002 personal-task-board\/card\/ui-card \S+ Claude Code: 状況/)
  const result = planNoteMigration(actions, [])
  assert.deepEqual(result, {
    notes: [{ id: "cc-old:002", board: "personal-task-board", card: "ui-card", body: "状況", author: { id: "agent:claude-code", name: "Claude Code" }, createdAt: "2026-11-27T09:05:00.000Z" }],
    deletes: ["cc-old:002"],
    skipped: ["cc-old:003: カード宛てでない (personal-task-board/column/todo@board)"],
  })
  // note を書いた後に止まっても、再実行は action を消すだけにする。
  assert.deepEqual(planNoteMigration(actions, result.notes), { notes: [], deletes: ["cc-old:002"], skipped: result.skipped })
  const rest = actions.filter((a) => !result.deletes.includes(a.id))
  assert.deepEqual(planNoteMigration(rest, result.notes).deletes, [])
  const text = renderBoard(fold(rest), result.notes)
  assert.match(text, /    > 2026-11-27T09:05:00.000Z Claude Code: 状況/)
  assert.doesNotMatch(text, /- cc-old:002/)
  assert.match(text, /- u:4 .* 本人: 直して/)
})

test("dump に notes が無ければコメントの無い盤面として読む", () => {
  const dir = mkdtempSync(join(tmpdir(), "board-"))
  assert.deepEqual(readNotes(dir), [])
})

test("kit が区切りごとに符号化した target のカードを読む", () => {
  const add: Action = { ...userAdd, payload: { id: "日本語-card", title: "日本語の id" } }
  const comment: Action = {
    ...pageAction("u:2", "comment", "", { body: "本文" }, "2026-11-27T09:01:00.000Z"),
    target: { type: "element", id: `personal-task-board/card/${encodeURIComponent("日本語-card")}@board` },
  }
  const move: Action = { ...comment, id: "u:3", type: "MOVE_CARD", payload: { column: "doing", before: null }, createdAt: "2026-11-27T09:02:00.000Z" }
  const board = fold([add, comment, move])
  assert.equal(findCard(board, "日本語-card")?.column, "doing")
  assert.deepEqual(board.reviews.map((r) => r.path), ["card/日本語-card"])
  const planned = plan([add], [{ op: "comment", card: "日本語-card", text: "x" }], { writer: "cc-a", now })
  assert.equal(planned.notes[0]?.card, "日本語-card")
})

test("移行は前の呼び名「## ブロック理由」の節を「## Pending の理由」に直す", () => {
  const legacy = [
    userAdd,
    pageAction("cc-old:1", "ADD_CARD", "column/blocked", { id: "b", title: "B" }, "2026-11-27T09:01:00.000Z"),
    pageAction("cc-old:2", "SET_CARD_DESCRIPTION", "card/b", { description: "説明\n\n## ブロック理由\n本人の確認待ち\n\n## セッション\n- codex abc" }, "2026-11-27T09:02:00.000Z"),
  ]
  const created = planMigration(legacy, { writer: "cc-m", now })
  assert.equal(created.length, 1)
  const board = fold([...legacy, ...created])
  assert.equal(findCard(board, "b")?.card.description, "説明\n\n## Pending の理由\n本人の確認待ち\n\n## セッション\n- codex abc")
  assert.deepEqual(planMigration([...legacy, ...created], { writer: "cc-n", now: later }), [])
})

const attr = (card: string, name: Attr["attr"], value: true | string, board: Attr["board"] = "personal-task-board"): Attr => ({
  id: attrId(board, card, name),
  board,
  card,
  attr: name,
  value,
  author: { id: "u_tester" },
  updatedAt: "2026-11-27T09:00:00.000Z",
})

test("今日は Asia/Tokyo の暦日で決まる", () => {
  assert.equal(tokyoDate(new Date("2026-11-28T14:59:59.000Z")), "2026-11-28")
  assert.equal(tokyoDate(new Date("2026-11-28T15:00:00.000Z")), "2026-11-29")
})

test("着手可能日で隠すのは未着手の列で、着手可能日が今日より後のカードだけ", () => {
  const today = "2026-11-28"
  assert.equal(isDeferred("todo", { check: false, start: "2026-11-29" }, today), true)
  assert.equal(isDeferred("backlog", { check: false, start: "2026-11-29" }, today), true)
  assert.equal(isDeferred("todo", { check: false, start: "2026-11-28" }, today), false)
  for (const column of ["today", "doing", "blocked", "done"]) assert.equal(isDeferred(column, { check: false, start: "2026-12-01" }, today), false, column)
})

test("属性を立てる・変える・外す writes は、dump の文書と if_version で決まる", () => {
  const id = attrId("personal-task-board", "ui-card", "due")
  const at = (attrs: Attr[], intent: Intent) => plan([userAdd], [intent], { writer: "cc-a", now, attrs })
  const created = at([], { op: "due", card: "ui-card", date: "2026-12-05" })
  assert.equal(created.attrs.length, 1)
  assert.deepEqual(created.attrs[0], {
    op: "set",
    attr: { id, board: "personal-task-board", card: "ui-card", attr: "due", value: "2026-12-05", author: { id: "agent:claude-code", name: "Claude Code" }, updatedAt: now.toISOString() },
  })
  assert.deepEqual(at([], { op: "due", card: "ui-card", date: null }).attrs, [])
  assert.deepEqual(at([attr("ui-card", "due", "2026-12-05")], { op: "due", card: "ui-card", date: "2026-12-05" }).attrs, [])
  assert.throws(() => at([attr("ui-card", "due", "2026-12-05")], { op: "due", card: "ui-card", date: "2026-12-06" }), /if_version を付けて plan し直す/)
  assert.throws(() => at([attr("ui-card", "due", "2026-12-05")], { op: "due", card: "ui-card", date: null }), /if_version/)
  const changed = at([attr("ui-card", "due", "2026-12-05")], { op: "due", card: "ui-card", date: "2026-12-06", if_version: 3 })
  assert.equal(changed.attrs[0]?.op === "set" && changed.attrs[0].if_version, 3)
  assert.deepEqual(at([attr("ui-card", "due", "2026-12-05")], { op: "due", card: "ui-card", date: null, if_version: 2 }).attrs, [{ op: "delete", doc_id: id, if_version: 2 }])
  assert.throws(() => at([], { op: "due", card: "ui-card", date: "2026-02-30" }), /YYYY-MM-DD/)
  assert.deepEqual(at([], { op: "start", key: "none", date: "2026-12-01" }).skipped, [`start ${cardId("none")}: カードが無い`])
  const moved = at([attr("ui-card", "start", "2026-12-01")], { op: "start", card: "ui-card", date: "2026-12-03", if_version: 1 })
  assert.deepEqual(moved.attrs.map((w) => (w.op === "set" ? [w.attr.attr, w.attr.value, w.if_version] : [])), [["start", "2026-12-03", 1]])
  assert.throws(() => at([], { op: "start", key: "none", date: "12/03" }), /YYYY-MM-DD/)
  assert.throws(() => at([], { op: "owner", key: "none", who: "boss" } as unknown as Intent), /who は/)
})

test("check を立てると属性と note が出て、text が無ければ拒む", () => {
  const result = plan([userAdd], [{ op: "check", card: "ui-card", on: true, text: "画面を見てほしい" }], { writer: "cc-a", now })
  assert.deepEqual(result.attrs.map((w) => (w.op === "set" ? [w.attr.id, w.attr.value, w.if_version] : [])), [[attrId("personal-task-board", "ui-card", "check"), true, undefined]])
  assert.deepEqual(result.notes.map((n) => n.body), ["確認が必要: 画面を見てほしい"])
  assert.throws(() => plan([userAdd], [{ op: "check", card: "ui-card", on: true }], { writer: "cc-a", now }), /text/)
  const again = plan([userAdd], [{ op: "check", card: "ui-card", on: true, text: "もう一度" }], { writer: "cc-a", now, attrs: [attr("ui-card", "check", true)] })
  assert.deepEqual([again.attrs, again.notes.length], [[], 1])
  const off = plan([userAdd], [{ op: "check", card: "ui-card", on: false, if_version: 1 }], { writer: "cc-a", now, attrs: [attr("ui-card", "check", true)] })
  assert.deepEqual([off.attrs, off.notes], [[{ op: "delete", doc_id: attrId("personal-task-board", "ui-card", "check"), if_version: 1 }], []])
})

test("add の start と due は属性になり、別の属性は別の文書になる", () => {
  const result = plan([], [{ op: "add", key: "k", column: "todo", title: "t", start: "2026-12-01", due: "2026-12-10" }], { writer: "cc-a", now })
  const ids = result.attrs.map((w) => (w.op === "set" ? [w.attr.id, w.if_version] : []))
  assert.deepEqual(ids, [
    [attrId("personal-task-board", cardId("k"), "start"), undefined],
    [attrId("personal-task-board", cardId("k"), "due"), undefined],
  ])
  assert.throws(() => plan([userAdd], [{ op: "due", card: "ui-card", date: "2026-12-01" }, { op: "due", card: "ui-card", date: "2026-12-02" }], { writer: "cc-a", now }), /2 回/)
})

test("archive は確認が必要な Done のカードを残す", () => {
  const actions = run([userAdd, pageAction("u:2", "ADD_CARD", "column/done", { id: "other", title: "o" }, "2026-11-27T09:01:00.000Z")], [{ op: "move", card: "ui-card", column: "done" }], "cc-a")
  const result = plan(actions, [{ op: "archive" }], { writer: "cc-b", now: archiveAt, attrs: [attr("ui-card", "check", true)] })
  assert.deepEqual(result.actions.map((a) => a.target.id), ["personal-task-board/card/other@board"])
  assert.deepEqual(result.skipped, ["archive ui-card: 確認が必要なので残す"])
})

test("show は今日と属性の印を出し、カードの無い属性を別の節に出す", () => {
  const actions = [userAdd, pageAction("u:2", "ADD_CARD", "column/doing", { id: "late", title: "遅れ" }, "2026-11-27T09:01:00.000Z"), pageAction("u:3", "ADD_CARD", "column/done", { id: "fin", title: "済み" }, "2026-11-27T09:02:00.000Z")]
  const attrs = [attr("ui-card", "start", "2026-12-01"), attr("ui-card", "check", true), attr("late", "due", "2026-11-27"), attr("late", "start", "2026-12-01"), attr("fin", "due", "2026-11-01"), attr("gone", "due", "2026-11-30")]
  const text = renderBoard(fold(actions), [], { attrs, today: "2026-11-28" })
  assert.match(text, /^今日 \(Asia\/Tokyo\): 2026-11-28/)
  assert.match(text, /- TASK-1 ui-card UI で足したカード \(確認が必要, 着手可能 2026-12-01, ページでは隠れる\)/)
  assert.match(text, /- TASK-2 late 遅れ \(着手可能 2026-12-01, 期日 2026-11-27 超過\)/)
  assert.match(text, /- TASK-3 fin 済み \(期日 2026-11-01\)$/m)
  assert.match(text, /## カードの無い属性\n- personal-task-board~gone~due 2026-11-30/)
  assert.match(renderBoard(fold(actions), [], { attrs: [attr("late", "due", "2026-11-28")], today: "2026-11-28" }), /期日 2026-11-28 今日/)
  const backlog = run([], [{ op: "add", key: "later", board: "personal-learning", column: "backlog", title: "後で" }], "cc-a")
  const learning = (start: string) => renderBoard(fold(backlog), [], { attrs: [attr(cardId("later"), "start", start, "personal-learning")], today: "2026-11-28" })
  assert.match(learning("2026-11-29"), /後で \(着手可能 2026-11-29, ページでは隠れる\)/)
  assert.match(learning("2026-11-28"), /後で$/m)
})

test("readAttrs は形の崩れた属性を飛ばし、attrsOf がカードごとにまとめる", () => {
  const dir = mkdtempSync(join(tmpdir(), "board-attrs-"))
  mkdirSync(join(dir, "attrs"))
  const good = attr("ui-card", "due", "2026-12-05")
  writeFileSync(join(dir, "attrs", "a.json"), JSON.stringify(good))
  writeFileSync(join(dir, "attrs", "b.json"), JSON.stringify({ ...attr("ui-card", "start", "2026-12-01"), value: "12/1" }))
  writeFileSync(join(dir, "attrs", "c.json"), JSON.stringify({ ...attr("ui-card", "check", true), id: "wrong" }))
  assert.deepEqual(readAttrs(dir), [good])
  assert.equal(isAttr({ ...attr("ui-card", "check", true), value: "yes" } as unknown as Attr), false)
  assert.deepEqual(attrsOf([good, attr("ui-card", "check", true), attr("other", "start", "2026-12-01")], "personal-task-board", "ui-card"), { check: true, due: "2026-12-05" })
})

test("担い手は self か agent の属性で、add と owner intent で設定・変更・解除でき、show に出る", () => {
  const added = plan([], [{ op: "add", key: "k", column: "doing", title: "t", owner: "agent" }], { writer: "cc-a", now })
  assert.deepEqual(added.attrs.map((w) => (w.op === "set" ? [w.attr.id, w.attr.value] : [])), [[attrId("personal-task-board", cardId("k"), "owner"), "agent"]])
  const set = plan([userAdd], [{ op: "owner", card: "ui-card", who: "agent" }], { writer: "cc-a", now })
  assert.equal(set.attrs[0]?.op === "set" && set.attrs[0].attr.value, "agent")
  const existing = [attr("ui-card", "owner", "agent")]
  assert.throws(() => plan([userAdd], [{ op: "owner", card: "ui-card", who: "self" }], { writer: "cc-a", now, attrs: existing }), /if_version/)
  const changed = plan([userAdd], [{ op: "owner", card: "ui-card", who: "self", if_version: 4 }], { writer: "cc-a", now, attrs: existing })
  assert.deepEqual(changed.attrs[0]?.op === "set" && [changed.attrs[0].attr.value, changed.attrs[0].if_version], ["self", 4])
  assert.deepEqual(plan([userAdd], [{ op: "owner", card: "ui-card", who: null, if_version: 4 }], { writer: "cc-a", now, attrs: existing }).attrs, [
    { op: "delete", doc_id: attrId("personal-task-board", "ui-card", "owner"), if_version: 4 },
  ])
  assert.deepEqual(plan([userAdd], [{ op: "owner", card: "ui-card", who: "agent" }], { writer: "cc-a", now, attrs: existing }).skipped, ["owner ui-card: 既に agent"])
  assert.throws(() => plan([userAdd], [{ op: "owner", card: "ui-card", who: "bot" as "agent" }], { writer: "cc-a", now }), /who は self か agent か null/)
  assert.equal(isAttr({ ...attr("ui-card", "owner", "agent"), value: "bot" }), false)
  assert.deepEqual(attrsOf(existing, "personal-task-board", "ui-card"), { check: false, owner: "agent" })
  const text = renderBoard(fold([userAdd]), [], { attrs: existing, today: "2026-11-28" })
  assert.match(text, /- TASK-1 ui-card UI で足したカード \(担い手 Agent\)/)
  assert.match(renderBoard(fold([userAdd]), [], { attrs: [attr("ui-card", "owner", "self")], today: "2026-11-28" }), /\(担い手 自分\)/)
})
