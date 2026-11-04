import type { Entry } from './content.ts'
import { displayPath, findEntry } from './content.ts'
import { CliError } from './errors.ts'
import type { Frontmatter } from './frontmatter.ts'
import { readStringList } from './frontmatter.ts'

/** role の frontmatter で推奨する principle を列挙するキー。 */
export const PRINCIPLES_KEY = 'principles'

/** principle の名前 (ディレクトリ名)。パス区切りなどを通さないため kebab-case に限る。 */
const PRINCIPLE_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export type PrincipleRefs = { ok: true; names: string[] } | { ok: false; reason: string }

/** role の frontmatter から、推奨する principle の名前を書いた順に読む。書式が不正なら reason を返す。 */
export function readPrincipleRefs(frontmatter: Frontmatter): PrincipleRefs {
  const list = readStringList(frontmatter, PRINCIPLES_KEY)
  if (!list.ok) {
    return list
  }
  const names: string[] = []
  for (const raw of list.items) {
    const name = raw.trim()
    if (!PRINCIPLE_NAME_PATTERN.test(name)) {
      return { ok: false, reason: `${PRINCIPLES_KEY} の名前は kebab-case である必要があります: "${name}"` }
    }
    if (names.includes(name)) {
      return { ok: false, reason: `${PRINCIPLES_KEY} に "${name}" が重複しています` }
    }
    names.push(name)
  }
  return { ok: true, names }
}

/** role が推奨する principle を、書いた順に読み込む。書式の不正や存在しない参照は CliError。 */
export function loadRolePrinciples(root: string, role: Entry): Entry[] {
  const refs = readPrincipleRefs(role.frontmatter)
  if (!refs.ok) {
    throw new CliError(`${displayPath(role)} の frontmatter が不正です: ${refs.reason}`)
  }
  return refs.names.map((name) => {
    const entry = findEntry(root, 'principle', name)
    if (entry === undefined || !entry.exists) {
      throw new CliError(`${displayPath(role)} が参照する principle が見つかりません: principles/${name}`)
    }
    return entry
  })
}

/**
 * role 本文の後ろに、推奨する principle の全文を名前付きの区切りで列挙順に続ける。
 * principle がなければ role 本文のまま返す。
 */
export function renderRoleWithPrinciples(role: Entry, principles: Entry[]): string {
  if (principles.length === 0) {
    return role.body
  }
  const blocks = principles.map((principle) => `<principle name="${principle.name}">\n${principle.body.trim()}\n</principle>`)
  return [
    role.body.trimEnd(),
    '---',
    '# 推奨される原則',
    `この Role が推奨する原則 (${principles.length} 件)。すべて全文を適用する。`,
    blocks.join('\n\n'),
  ].join('\n\n') + '\n'
}
