import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { ContentKind } from './content.ts'
import { CONTENT_KINDS, CONTENT_SPECS, contentDir, entryDir, listEntryNames, loadEntry } from './content.ts'
import type { Frontmatter } from './frontmatter.ts'
import { hasFrontmatter, readString } from './frontmatter.ts'
import type { ModelsIssue } from './models.ts'
import { loadModelsConfig, MODELS_CONFIG_PATH } from './models.ts'
import { harnessDir, isDirectory, isFile } from './paths.ts'
import { readPrincipleRefs } from './principles.ts'
import { loadProvidersConfig, PI_PROVIDER_PREFIXES, providerOfCandidate, PROVIDERS_CONFIG_PATH } from './providers.ts'

export type VerifySeverity = 'error' | 'warning'

/** 検証対象の種類。models と providers は設定ファイル 1 つ。prompts は playbook / role と違い 1 ファイル 1 エントリ。 */
export type VerifyKind = ContentKind | 'prompt' | 'models' | 'providers'

export type VerifyIssue = {
  severity: VerifySeverity
  kind: VerifyKind
  /** エントリ名。ディレクトリ単位の問題（ディレクトリ欠如など）では null。 */
  entry: string | null
  /** 問題のあるファイル名。ディレクトリ単位では null。 */
  file: string | null
  code: string
  message: string
}

export type FileCheck = {
  fileName: string
  exists: boolean
}

export type EntryReport = {
  kind: VerifyKind
  name: string
  path: string
  files: FileCheck[]
  issues: VerifyIssue[]
}

export type VerifyReport = {
  root: string
  checked: number
  entries: EntryReport[]
  issues: VerifyIssue[]
  errorCount: number
  warningCount: number
  ok: boolean
}

/** 本文ファイルが持つべき frontmatter キー。 */
export const REQUIRED_FRONTMATTER = ['name', 'description'] as const

/** 各エントリディレクトリに必須の説明ファイル。 */
export const README_FILE = 'README.md'

/** prompts のディレクトリ名。存在しなくてもよい。 */
export const PROMPTS_DIR = 'prompts'

/** prompt の末尾に必須の引数ブロック。 */
export const ARGUMENTS_FOOTER = '\n---\n\n$ARGUMENTS'

export function verifyHarness(root: string): VerifyReport {
  const entries: EntryReport[] = []
  const issues: VerifyIssue[] = []

  for (const kind of CONTENT_KINDS) {
    const spec = CONTENT_SPECS[kind]
    const dir = contentDir(root, kind)
    if (!isDirectory(dir)) {
      issues.push({
        severity: 'warning',
        kind,
        entry: null,
        file: null,
        code: 'missing-directory',
        message: `${spec.dirName}/ が存在しません`,
      })
      continue
    }
    for (const name of listEntryNames(root, kind)) {
      const report = verifyEntry(root, kind, name)
      entries.push(report)
      issues.push(...report.issues)
    }
  }

  for (const report of verifyPrompts(root)) {
    entries.push(report)
    issues.push(...report.issues)
  }

  for (const report of [...verifyModels(root), ...verifyProviders(root)]) {
    entries.push(report)
    issues.push(...report.issues)
  }

  const errorCount = issues.filter((issue) => issue.severity === 'error').length
  const warningCount = issues.length - errorCount

  return {
    root,
    checked: entries.length,
    entries,
    issues,
    errorCount,
    warningCount,
    ok: errorCount === 0,
  }
}

function verifyEntry(root: string, kind: ContentKind, name: string): EntryReport {
  const spec = CONTENT_SPECS[kind]
  const entry = loadEntry(root, kind, name)
  const readmeExists = isFile(join(entry.dir, README_FILE))

  const files: FileCheck[] = [
    { fileName: spec.fileName, exists: entry.exists },
    { fileName: README_FILE, exists: readmeExists },
  ]

  const issues: VerifyIssue[] = []
  const add = (severity: VerifySeverity, code: string, message: string, file: string): void => {
    issues.push({ severity, kind, entry: name, file, code, message })
  }

  if (!entry.exists) {
    add('error', 'missing-file', `${spec.fileName} が存在しません`, spec.fileName)
  }
  if (!readmeExists) {
    add('error', 'missing-file', `${README_FILE} が存在しません`, README_FILE)
  }

  if (entry.exists) {
    if (!hasFrontmatter(entry.raw)) {
      add('error', 'missing-frontmatter', `frontmatter (${'---'} 区切り) がありません`, spec.fileName)
    } else {
      if (entry.frontmatterError !== null) {
        add('error', 'invalid-frontmatter', `frontmatter が不正です: ${entry.frontmatterError}`, spec.fileName)
      }
      for (const key of REQUIRED_FRONTMATTER) {
        const value = readString(entry.frontmatter, key)
        if (value === undefined || value.trim() === '') {
          add('error', `missing-${key}`, `frontmatter の ${key} が必須です`, spec.fileName)
        }
      }
      const declaredName = readString(entry.frontmatter, 'name')?.trim()
      if (declaredName !== undefined && declaredName !== '' && declaredName !== name) {
        add(
          'warning',
          'name-mismatch',
          `frontmatter の name (${declaredName}) がディレクトリ名 (${name}) と一致しません`,
          spec.fileName,
        )
      }
    }

    if (entry.body.trim() === '') {
      add('warning', 'empty-body', '本文が空です', spec.fileName)
    }

    if (kind === 'role') {
      verifyPrincipleRefs(root, entry.frontmatter, add, spec.fileName)
    }
  }

  return { kind, name, path: `${spec.dirName}/${name}`, files, issues }
}

/** role の `principles` が、書式として正しく、実在する principle だけを指すことを検証する。 */
function verifyPrincipleRefs(
  root: string,
  frontmatter: Frontmatter,
  add: (severity: VerifySeverity, code: string, message: string, file: string) => void,
  fileName: string,
): void {
  const refs = readPrincipleRefs(frontmatter)
  if (!refs.ok) {
    add('error', 'invalid-principles', `frontmatter の principles が不正です: ${refs.reason}`, fileName)
    return
  }
  for (const name of refs.names) {
    const spec = CONTENT_SPECS.principle
    if (!isFile(join(entryDir(root, 'principle', name), spec.fileName))) {
      add('error', 'unknown-principle', `principles が存在しない principle を参照しています: ${name} (${spec.dirName}/${name}/${spec.fileName} がありません)`, fileName)
    }
  }
}

function verifyPrompts(root: string): EntryReport[] {
  const dir = join(harnessDir(root), PROMPTS_DIR)
  if (!isDirectory(dir)) {
    return []
  }
  const fileNames = readdirSync(dir, { withFileTypes: true })
    .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.md'))
    .map((dirent) => dirent.name)
    .sort((left, right) => left.localeCompare(right, 'en'))

  return fileNames.map((fileName) => {
    const name = fileName.slice(0, -'.md'.length)
    const raw = readFileSync(join(dir, fileName), 'utf8')
    const issues: VerifyIssue[] = []
    const footerOnly = raw.trimEnd().endsWith(ARGUMENTS_FOOTER) && raw.split('$ARGUMENTS').length === 2
    if (!footerOnly) {
      issues.push({
        severity: 'error',
        kind: 'prompt',
        entry: name,
        file: fileName,
        code: 'missing-arguments-footer',
        message: '`$ARGUMENTS` は末尾の `---` 区切りのブロックに 1 回だけ置く必要があります',
      })
    }
    return {
      kind: 'prompt',
      name,
      path: `${PROMPTS_DIR}/${name}`,
      files: [{ fileName, exists: true }],
      issues,
    }
  })
}

/**
 * モデル設定の書式と、候補の effort がモデルで使える値か、候補の provider が決まるかを検証する。
 * 設定ファイルは必須で、なければ error。
 */
function verifyModels(root: string): EntryReport[] {
  const loaded = loadModelsConfig(root)
  const fileName = MODELS_CONFIG_PATH
  const toIssue = (severity: VerifySeverity) => (issue: ModelsIssue): VerifyIssue => ({
    severity,
    kind: 'models',
    entry: 'models',
    file: fileName,
    code: issue.code,
    message: issue.message,
  })
  if (!loaded.exists) {
    const missing = toIssue('error')({ code: 'missing-file', message: `${fileName} が存在しません` })
    return [{ kind: 'models', name: 'models', path: fileName, files: [{ fileName, exists: false }], issues: [missing] }]
  }

  const unknownProviders: ModelsIssue[] = (loaded.config?.kinds ?? []).flatMap((kind) =>
    kind.candidates
      .filter((candidate) => providerOfCandidate(candidate) === null)
      .map((candidate) => ({
        code: 'unknown-candidate-provider',
        message:
          `${kind.name}: 候補 "${candidate.spec}" の provider が決まりません ` +
          `(runtime は claude-code / command-code / antigravity / pi。pi の model は ${PI_PROVIDER_PREFIXES.map((prefix) => `${prefix}/`).join(' | ')} のいずれかで始める必要があります)`,
      })),
  )
  const issues: VerifyIssue[] = [
    ...loaded.issues.map(toIssue('error')),
    ...unknownProviders.map(toIssue('error')),
    ...loaded.warnings.map(toIssue('warning')),
  ]
  return [{ kind: 'models', name: 'models', path: fileName, files: [{ fileName, exists: true }], issues }]
}

/** state/providers.json の書式を検証する。マシン固有のローカルファイルなので、なくてもエラーにも警告にもしない。 */
function verifyProviders(root: string): EntryReport[] {
  const loaded = loadProvidersConfig(root)
  if (!loaded.exists) {
    return []
  }
  const fileName = PROVIDERS_CONFIG_PATH
  const issues: VerifyIssue[] = loaded.issues.map((issue) => ({
    severity: 'error',
    kind: 'providers',
    entry: 'providers',
    file: fileName,
    code: issue.code,
    message: issue.message,
  }))
  return [{ kind: 'providers', name: 'providers', path: fileName, files: [{ fileName, exists: true }], issues }]
}
