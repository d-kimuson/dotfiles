#!/usr/bin/env node
// Personal Task Board の board.json を読み書きし、dev-process-kit の Kanban ページ (public/index.html) を生成する。
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, join } from "node:path"
import { pathToFileURL } from "node:url"
import { parseArgs } from "node:util"

export const DPK_VERSION = "0.4.1"
const BOARD_ID = "personal-task-board"

type Link = { url: string; label?: string }
type Card = { id: string; number: number; title: string; description?: string; tags?: string[]; links?: Link[] }
type Column = { id: string; label: string; color?: string; cards: Card[] }
export type Board = { revision: number; columns: Column[] }

export const initialBoard = (): Board => ({
  revision: 1,
  columns: [
    { id: "learning-backlog", label: "学習バックログ", color: "violet", cards: [] },
    { id: "todo", label: "ToDo", color: "gray", cards: [] },
    { id: "doing", label: "作業中", color: "blue", cards: [] },
    { id: "done", label: "完了", color: "green", cards: [] },
  ],
})

const findColumn = (board: Board, columnId: string): Column => {
  const column = board.columns.find((c) => c.id === columnId)
  if (column === undefined) throw new Error(`unknown column: ${columnId} (${board.columns.map((c) => c.id).join(", ")})`)
  return column
}

export const addCard = (board: Board, columnId: string, card: Omit<Card, "id" | "number">): Card => {
  const column = findColumn(board, columnId)
  const number = Math.max(0, ...board.columns.flatMap((c) => c.cards.map((x) => x.number))) + 1
  const added: Card = { id: `task-${number}`, number, ...card }
  column.cards.push(added)
  return added
}

export const moveCard = (board: Board, number: number, columnId: string): Card => {
  const to = findColumn(board, columnId)
  for (const column of board.columns) {
    const index = column.cards.findIndex((c) => c.number === number)
    if (index === -1) continue
    const [card] = column.cards.splice(index, 1)
    if (card === undefined) break
    to.cards.push(card)
    return card
  }
  throw new Error(`unknown card: TASK-${number}`)
}

// remote があればリポジトリ名、なければディレクトリ名。
export const projectName = (remoteUrl: string | undefined, cwd: string): string =>
  remoteUrl === undefined || remoteUrl === "" ? basename(cwd) : basename(remoteUrl.replace(/\/+$/, "")).replace(/\.git$/, "")

const currentProject = (): string => {
  let remote: string | undefined
  try {
    remote = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
  } catch {
    remote = undefined
  }
  return projectName(remote, process.cwd())
}

const json = (value: unknown): string => JSON.stringify(value).replace(/</g, "\\u003c")

// storage-key に revision を含め、brief を反映した後 (render --fresh) に古い下書きが再生されないようにする。
export const renderHtml = (board: Board): string => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Personal Task Board</title>
<script type="module" src="https://cdn.jsdelivr.net/npm/dev-process-kit@${DPK_VERSION}/dist/boards.js"></script>
<style>html,body{height:100%;margin:0}dpk-app{display:block;height:100%}</style>
</head>
<body>
<dpk-app lang="ja" storage-key="${BOARD_ID}-r${board.revision}">
<script type="application/json">${json({ title: "Personal Task Board" })}</script>
<dpk-page name="board" label="Personal Task Board">
<dpk-board-kanban id="${BOARD_ID}" heading="Personal Task Board">
<script type="application/json">${json({ columns: board.columns })}</script>
</dpk-board-kanban>
</dpk-page>
</dpk-app>
</body>
</html>
`

const parseLink = (value: string): Link => {
  const [url = "", ...label] = value.split(" ")
  return label.length > 0 ? { url, label: label.join(" ") } : { url }
}

const main = (): void => {
  const home = process.env.PERSONAL_TASK_BOARD_HOME ?? join(homedir(), ".agents", "state", "personal-task-board")
  const boardPath = join(home, "board.json")
  const pagePath = join(home, "public", "index.html")
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      column: { type: "string" },
      title: { type: "string" },
      description: { type: "string" },
      tag: { type: "string", multiple: true },
      link: { type: "string", multiple: true },
      project: { type: "boolean" },
      fresh: { type: "boolean" },
    },
  })
  const [command, arg] = positionals
  const board: Board = existsSync(boardPath) ? JSON.parse(readFileSync(boardPath, "utf8")) : initialBoard()
  const save = (): void => {
    mkdirSync(join(home, "public"), { recursive: true })
    writeFileSync(boardPath, `${JSON.stringify(board, null, 2)}\n`)
    writeFileSync(pagePath, renderHtml(board))
  }

  switch (command) {
    case "list":
      for (const column of board.columns) {
        console.log(`## ${column.label} (${column.id})`)
        for (const card of column.cards) console.log(`- TASK-${card.number} ${card.title}${card.tags ? ` [${card.tags.join(", ")}]` : ""}`)
      }
      return
    case "add": {
      if (values.column === undefined || values.title === undefined) throw new Error("add requires --column and --title")
      const tags = [...(values.tag ?? []), ...(values.project === true ? [currentProject()] : [])]
      const card = addCard(board, values.column, {
        title: values.title,
        ...(values.description !== undefined && { description: values.description }),
        ...(tags.length > 0 && { tags }),
        ...(values.link !== undefined && { links: values.link.map(parseLink) }),
      })
      save()
      console.log(`TASK-${card.number}`)
      break
    }
    case "move": {
      if (arg === undefined || values.column === undefined) throw new Error("move requires <number> and --column")
      const card = moveCard(board, Number(arg.replace(/^TASK-/, "")), values.column)
      save()
      console.log(`TASK-${card.number} -> ${values.column}`)
      break
    }
    case "render":
      if (values.fresh === true) board.revision += 1
      save()
      break
    default:
      throw new Error("usage: board.ts list | add --column <id> --title <t> [--description d] [--tag t]... [--link 'url label']... [--project] | move <number> --column <id> | render [--fresh]")
  }
  console.log(`board: ${boardPath}`)
  console.log(`page: ${pathToFileURL(pagePath).href}`)
}

if (import.meta.main) main()
