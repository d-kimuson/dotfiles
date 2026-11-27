import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { Frontmatter } from './frontmatter.ts'
import { parseFrontmatter, readString } from './frontmatter.ts'
import { harnessDir, isDirectory, isFile } from './paths.ts'

export type ContentKind = 'playbook' | 'principle'

export type ContentSpec = {
  kind: ContentKind
  /** ディレクトリ名（複数形）。CLI のコマンド名にもなる。 */
  dirName: string
  /** 本文ファイル名。 */
  fileName: string
  /** 単数形の表示名。 */
  label: string
}

export const CONTENT_SPECS: Record<ContentKind, ContentSpec> = {
  playbook: { kind: 'playbook', dirName: 'playbooks', fileName: 'PLAYBOOK.md', label: 'playbook' },
  principle: { kind: 'principle', dirName: 'principles', fileName: 'PRINCIPLE.md', label: 'principle' },
}

export const CONTENT_KINDS: ContentKind[] = ['playbook', 'principle']

/** エントリ（playbook / principle の 1 ディレクトリ）。 */
export type Entry = {
  kind: ContentKind
  /** ディレクトリ名。識別子として使う。 */
  name: string
  dir: string
  /** 本文ファイルの絶対パス。 */
  file: string
  /** 本文ファイルが存在するか。 */
  exists: boolean
  /** frontmatter の生テキスト（`---` 区切りを含む）。 */
  raw: string
  frontmatter: Frontmatter
  frontmatterError: string | null
  body: string
  description: string
}

export function contentDir(root: string, kind: ContentKind): string {
  return join(harnessDir(root), CONTENT_SPECS[kind].dirName)
}

export function entryDir(root: string, kind: ContentKind, name: string): string {
  return join(contentDir(root, kind), name)
}

/** ディレクトリ名の一覧を名前順で返す。存在しなければ空配列。 */
export function listEntryNames(root: string, kind: ContentKind): string[] {
  const dir = contentDir(root, kind)
  if (!isDirectory(dir)) {
    return []
  }
  const entries: string[] = []
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    if (!dirent.isDirectory() || dirent.name.startsWith('.')) {
      continue
    }
    entries.push(dirent.name)
  }
  return entries.sort((left, right) => left.localeCompare(right, 'en'))
}

export function loadEntry(root: string, kind: ContentKind, name: string): Entry {
  const spec = CONTENT_SPECS[kind]
  const dir = entryDir(root, kind, name)
  const file = join(dir, spec.fileName)
  const exists = isFile(file)
  const raw = exists ? readFileSync(file, 'utf8') : ''
  const parsed = parseFrontmatter(raw)

  return {
    kind,
    name,
    dir,
    file,
    exists,
    raw,
    frontmatter: parsed.data,
    frontmatterError: parsed.error,
    body: parsed.body,
    description: readString(parsed.data, 'description') ?? '',
  }
}

export function listEntries(root: string, kind: ContentKind): Entry[] {
  return listEntryNames(root, kind).map((name) => loadEntry(root, kind, name))
}

export function findEntry(root: string, kind: ContentKind, name: string): Entry | undefined {
  if (!isDirectory(entryDir(root, kind, name))) {
    return undefined
  }
  return loadEntry(root, kind, name)
}

/** `playbooks/initialize-project` のような表示用パス。 */
export function displayPath(entry: Entry): string {
  return `${CONTENT_SPECS[entry.kind].dirName}/${entry.name}`
}
