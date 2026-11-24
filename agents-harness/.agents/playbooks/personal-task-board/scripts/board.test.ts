import assert from "node:assert/strict"
import { test } from "node:test"
import { addCard, initialBoard, moveCard, projectName, renderHtml } from "./board.ts"

test("addCard は盤面全体で次の番号を振る", () => {
  const board = initialBoard()
  addCard(board, "todo", { title: "a" })
  const card = addCard(board, "learning-backlog", { title: "b" })
  assert.equal(card.number, 2)
  assert.equal(card.id, "task-2")
})

test("addCard は存在しない列を拒否する", () => {
  assert.throws(() => addCard(initialBoard(), "nope", { title: "a" }), /unknown column/)
})

test("moveCard は列の末尾へ移す", () => {
  const board = initialBoard()
  addCard(board, "todo", { title: "a" })
  addCard(board, "todo", { title: "b" })
  moveCard(board, 1, "doing")
  assert.deepEqual(board.columns.find((c) => c.id === "doing")?.cards.map((c) => c.title), ["a"])
  assert.deepEqual(board.columns.find((c) => c.id === "todo")?.cards.map((c) => c.title), ["b"])
})

test("renderHtml はカード本文の </script> でスクリプトを閉じない", () => {
  const board = initialBoard()
  addCard(board, "todo", { title: "</script><b>x" })
  const html = renderHtml(board)
  assert.equal(html.match(/<\/script>/g)?.length, 3)
  assert.match(html, /storage-key="personal-task-board-r1"/)
})

test("projectName は remote のリポジトリ名、なければディレクトリ名を返す", () => {
  assert.equal(projectName("git@github.com:d-kimuson/dotfiles.git", "/w/x"), "dotfiles")
  assert.equal(projectName("https://github.com/d-kimuson/dotfiles/", "/w/x"), "dotfiles")
  assert.equal(projectName(undefined, "/w/my-app"), "my-app")
})
