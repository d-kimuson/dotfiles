#!/usr/bin/env node
// カレントディレクトリに .agents/handoff/<yyyymmddHHMMSS>-<uuid>/index.md をテンプレートから作り、パスを出力する。
// Git リポジトリ内で .agents/handoff/ が ignore されていなければ、.git/info/exclude に追記する (プロジェクトのファイルは変えない)。
import { execFileSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { appendFileSync, copyFileSync, mkdirSync } from "node:fs"
import { dirname, join, relative } from "node:path"

const HANDOFF_DIR = join(".agents", "handoff")
const TEMPLATE = join(import.meta.dirname, "..", "references", "template.md")

const git = (...args: string[]): string | undefined => {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
  } catch {
    return undefined
  }
}

const timestamp = (date: Date): string =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join("")

const ensureIgnored = (dir: string): void => {
  if (git("rev-parse", "--is-inside-work-tree") !== "true") return
  if (git("check-ignore", "-q", join(dir, "index.md")) !== undefined) return
  const exclude = git("rev-parse", "--git-path", "info/exclude")
  const top = git("rev-parse", "--show-toplevel")
  if (exclude === undefined || top === undefined) return
  mkdirSync(dirname(exclude), { recursive: true })
  appendFileSync(exclude, `\n/${relative(top, join(process.cwd(), HANDOFF_DIR))}/\n`)
}

const dir = join(HANDOFF_DIR, `${timestamp(new Date())}-${randomUUID()}`)
mkdirSync(dir, { recursive: true })
copyFileSync(TEMPLATE, join(dir, "index.md"))
ensureIgnored(dir)
console.log(join(dir, "index.md"))
