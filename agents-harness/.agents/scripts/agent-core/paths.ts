import { statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

import { CliError } from './errors.ts'

/** harness の正本ディレクトリ名。 */
export const HARNESS_DIR = '.agents'

/** `--root` 探索の起点を上書きする環境変数。 */
export const ROOT_ENV = 'AGENT_CORE_ROOT'

export type RootOptions = {
  root?: string | undefined
  cwd?: string | undefined
  env?: Record<string, string | undefined> | undefined
}

export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

export function isFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

/** harness root（`.agents` を内包するディレクトリ）を返す。 */
export function harnessDir(root: string): string {
  return join(root, HARNESS_DIR)
}

/**
 * harness root を解決する。
 * 優先順: `--root` > 環境変数 > ホームディレクトリ（既定は `~/.agents`）。
 * `--root` に `.agents` 自身が渡された場合は親を root とみなす。
 */
export function resolveHarnessRoot(options: RootOptions = {}): string {
  const cwd = resolve(options.cwd ?? process.cwd())
  const env = options.env ?? process.env

  const explicit = options.root
  if (explicit !== undefined && explicit !== '') {
    return normalizeRoot(resolve(cwd, explicit), cwd)
  }

  const fromEnv = env[ROOT_ENV]
  if (fromEnv !== undefined && fromEnv !== '') {
    return normalizeRoot(resolve(cwd, fromEnv), cwd)
  }

  const defaultRoot = defaultHarnessRoot(env)
  if (!isDirectory(harnessDir(defaultRoot))) {
    throw new CliError(
      `harness root (${HARNESS_DIR}) が見つかりません: ${harnessDir(defaultRoot)}。--root で指定してください。`,
    )
  }
  return defaultRoot
}

/** 既定の harness root。実運用は `~`、開発中は `--root .` で上書きする。 */
function defaultHarnessRoot(env: Record<string, string | undefined>): string {
  const home = env['HOME']
  return home !== undefined && home !== '' ? home : homedir()
}

function normalizeRoot(candidate: string, cwd: string): string {
  const root = basename(candidate) === HARNESS_DIR ? dirname(candidate) : candidate
  if (!isDirectory(harnessDir(root))) {
    throw new CliError(`harness root が不正です: ${harnessDir(root)} が存在しません (cwd: ${cwd})`)
  }
  return root
}
