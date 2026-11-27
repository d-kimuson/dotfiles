import { execFileSync } from 'node:child_process'
import { cpSync, lstatSync, mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'

import { CliError } from './errors.ts'
import { HARNESS_DIR, harnessDir, isDirectory } from './paths.ts'
import type { Provider } from './providers.ts'
import { PROVIDERS_CONFIG_PATH } from './providers.ts'

/**
 * 配布するファイルの集合。正本は 1 つのままで、環境ごとに「配らないもの」だけを変える。
 * 中身の書き換えはしない (文字列置換で環境差分を作らない)。
 */
export type ExportProfile = {
  readonly name: string
  /** 配布先の `state/providers.json` に書く provider。models list の候補をこの環境で起動できるものに絞る。 */
  readonly providers: readonly Provider[]
  /** `.agents` からの相対パス (区切りは `/`)。ファイルまたはディレクトリ。 */
  readonly exclude: readonly string[]
}

/** 使い捨て環境 (Claude Code on the web) 向け。他の Agent CLI でしか動かないものと、そのロックを配らない。 */
export const EXPORT_PROFILES = [
  {
    name: 'claude-code-web',
    providers: ['claude-code'],
    exclude: [
      '.skill-lock.json',
      'references/agent-call-over-cli.md',
      'skills/orca-cli',
      'skills/orca-computer-use',
    ],
  },
] as const satisfies readonly ExportProfile[]

export type ExportPlan = {
  /** コピーするファイル (`.agents` からの相対パス)。 */
  copy: string[]
  /** 除外したファイル。 */
  excluded: string[]
  /** 追跡ファイルに 1 件も一致しなかった除外パス。 */
  unmatchedExcludes: string[]
}

export type ExportResult = {
  /** 配布先の `.agents` の絶対パス。 */
  targetDir: string
  copied: number
  excluded: string[]
  unmatchedExcludes: string[]
  /** `state/providers.json` に書いた provider。profile がなければ null。 */
  providers: readonly Provider[] | null
}

export type ExportInput = {
  /** 配布元の harness root (`--root` で解決済みのもの)。 */
  sourceRoot: string
  /** 配布先の harness root。既存のディレクトリで、この下に `.agents` を作る。 */
  targetRoot: string
  profile: ExportProfile | null
}

export function findExportProfile(name: string): ExportProfile | undefined {
  return EXPORT_PROFILES.find((profile) => profile.name === name)
}

export function exportProfileNames(): string[] {
  return EXPORT_PROFILES.map((profile) => profile.name)
}

function matches(file: string, entry: string): boolean {
  return file === entry || file.startsWith(`${entry}/`)
}

export function planExport(files: readonly string[], profile: ExportProfile | null): ExportPlan {
  const exclude = profile?.exclude ?? []
  const excluded = files.filter((file) => exclude.some((entry) => matches(file, entry)))
  const excludedSet = new Set(excluded)

  return {
    copy: files.filter((file) => !excludedSet.has(file)),
    excluded,
    unmatchedExcludes: exclude.filter((entry) => !files.some((file) => matches(file, entry))),
  }
}

/** Git の追跡ファイルを `.agents` からの相対パスで返す。sourceDir は実体のディレクトリを渡す。 */
export function listTrackedFiles(sourceDir: string): string[] {
  let stdout: string
  try {
    stdout = execFileSync('git', ['-C', sourceDir, 'ls-files', '-z'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    throw new CliError(`配布元が Git の作業ツリーではありません: ${sourceDir}`)
  }

  const files = stdout.split('\0').filter((file) => file !== '')
  if (files.length === 0) {
    throw new CliError(`配布元に Git の追跡ファイルがありません: ${sourceDir}`)
  }
  return files
}

/**
 * `<sourceRoot>/.agents` の追跡ファイルを `<targetRoot>/.agents` へコピーする。
 * 既存の `.agents` (symlink を含む) は壊さずに失敗する。削除と上書きはしない。
 */
export function exportHarness({ sourceRoot, targetRoot, profile }: ExportInput): ExportResult {
  const sourceDir = realpathSync(harnessDir(sourceRoot))
  if (!isDirectory(targetRoot)) {
    throw new CliError(`配布先のディレクトリがありません: ${targetRoot}`)
  }

  const targetParent = realpathSync(targetRoot)
  const targetDir = join(targetParent, HARNESS_DIR)
  if (lstatSync(targetDir, { throwIfNoEntry: false }) !== undefined) {
    throw new CliError(`配布先が既にあります: ${targetDir}。置き換えるときは先に削除してください。`)
  }
  if (targetDir.startsWith(`${sourceDir}${sep}`)) {
    throw new CliError(`配布先が配布元の中にあります: ${targetDir}`)
  }

  const plan = planExport(listTrackedFiles(sourceDir), profile)
  const staging = mkdtempSync(join(targetParent, '.agents-export-'))
  try {
    for (const file of plan.copy) {
      const to = join(staging, file)
      mkdirSync(dirname(to), { recursive: true })
      try {
        cpSync(join(sourceDir, file), to, { verbatimSymlinks: true })
      } catch {
        throw new CliError(`追跡ファイルが配布元にありません: ${join(sourceDir, file)}`)
      }
    }
    if (profile !== null) {
      const providersFile = join(staging, PROVIDERS_CONFIG_PATH)
      mkdirSync(dirname(providersFile), { recursive: true })
      writeFileSync(providersFile, `${JSON.stringify({ providers: profile.providers }, null, 2)}\n`)
    }
    renameSync(staging, targetDir)
  } catch (error) {
    rmSync(staging, { recursive: true, force: true })
    throw error
  }

  return {
    targetDir,
    copied: plan.copy.length,
    excluded: plan.excluded,
    unmatchedExcludes: plan.unmatchedExcludes,
    providers: profile?.providers ?? null,
  }
}
