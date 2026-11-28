import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { ModelCandidate, ModelKind } from './models.ts'
import { harnessDir, isFile } from './paths.ts'

/** harness root からの設定ファイルの相対パス。マシン固有のローカルファイルで、コミットしない。 */
export const PROVIDERS_CONFIG_PATH = 'state/providers.json'

/** 移行前の旧パス。新パスがなく旧パスだけがあるときに移動を案内する。 */
export const LEGACY_PROVIDERS_CONFIG_PATH = 'providers.json'

/** この設定を作る playbook。`state/providers.json` がないときに案内する。 */
export const CONFIGURE_PROVIDERS_PLAYBOOK = 'configure-providers'

/** モデルを提供する契約・認証の単位。ここに挙げたものだけを state/providers.json に書ける。 */
export const PROVIDERS = ['claude-code', 'opencode-go', 'openai-codex', 'command-code', 'antigravity'] as const

export type Provider = (typeof PROVIDERS)[number]

export type ProvidersConfig = {
  /** この環境で使える provider。 */
  providers: Provider[]
}

export type ProvidersIssue = {
  code: string
  message: string
}

export type ParseProvidersConfigResult = {
  /** issues が 1 件でもあれば null。 */
  config: ProvidersConfig | null
  issues: ProvidersIssue[]
}

export type LoadedProvidersConfig = ParseProvidersConfigResult & {
  exists: boolean
  /** 読もうとしたファイルの絶対パス。なかったときの案内に使う。 */
  file: string
  /** 新パスになく旧パスだけにファイルがあるときの絶対パス。それ以外は null。 */
  legacyFile: string | null
}

const CONFIG_KEYS = ['providers']

/** runtime がそのまま provider になるもの。 */
const RUNTIME_PROVIDERS: Readonly<Record<string, Provider>> = {
  'claude-code': 'claude-code',
  'command-code': 'command-code',
  antigravity: 'antigravity',
}

/** pi は model の接頭辞 (`<prefix>/<model>`) で provider が決まる。 */
const PI_PREFIX_PROVIDERS: Readonly<Record<string, Provider>> = {
  'opencode-go': 'opencode-go',
  'openai-codex': 'openai-codex',
}

/** pi の model に使える接頭辞。 */
export const PI_PROVIDER_PREFIXES = Object.keys(PI_PREFIX_PROVIDERS)

export function isProvider(value: string): value is Provider {
  return (PROVIDERS as readonly string[]).includes(value)
}

/** 候補の provider。決められない候補は null (models.json に置いてはいけないので verify がエラーにする)。 */
export function providerOfCandidate(candidate: Pick<ModelCandidate, 'runtime' | 'model'>): Provider | null {
  const { runtime, model } = candidate
  if (Object.hasOwn(RUNTIME_PROVIDERS, runtime)) {
    return RUNTIME_PROVIDERS[runtime] ?? null
  }
  if (runtime === 'pi') {
    const slash = model.indexOf('/')
    const prefix = slash === -1 ? '' : model.slice(0, slash)
    return Object.hasOwn(PI_PREFIX_PROVIDERS, prefix) ? (PI_PREFIX_PROVIDERS[prefix] ?? null) : null
  }
  return null
}

/**
 * 許可された provider の候補だけを、優先順を保って残す。
 * 候補がすべて外れた種類も残す (候補が無いときの呼び出し方は AGENTS.md の「Agent の呼び出し」に従う)。provider が決まらない候補は残さない。
 */
export function filterKindsByProviders(kinds: ModelKind[], allowed: readonly Provider[]): ModelKind[] {
  return kinds.map((kind) => ({
    ...kind,
    candidates: kind.candidates.filter((candidate) => {
      const provider = providerOfCandidate(candidate)
      return provider !== null && allowed.includes(provider)
    }),
  }))
}

export function parseProvidersConfig(text: string): ParseProvidersConfigResult {
  const issues: ProvidersIssue[] = []
  const add = (code: string, message: string): void => {
    issues.push({ code, message })
  }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (error) {
    add('invalid-json', `JSON として解釈できません: ${error instanceof Error ? error.message : String(error)}`)
    return { config: null, issues }
  }

  const rawProviders = isRecord(data) ? data['providers'] : undefined
  if (!isRecord(data) || !Array.isArray(rawProviders) || rawProviders.some((item) => typeof item !== 'string')) {
    add('invalid-shape', '`{ "providers": ["claude-code", ...] }` の形式である必要があります (providers は文字列の配列)')
    return { config: null, issues }
  }

  for (const key of Object.keys(data)) {
    if (!CONFIG_KEYS.includes(key)) {
      add('unknown-key', `未知のキーです: ${key} (使えるキー: ${CONFIG_KEYS.join(', ')})`)
    }
  }

  const providers: Provider[] = []
  for (const item of rawProviders as string[]) {
    if (!isProvider(item)) {
      add('unknown-provider', `未知の provider です: "${item}" (使える値: ${PROVIDERS.join(' | ')})`)
    } else if (providers.includes(item)) {
      add('duplicate-provider', `provider "${item}" が重複しています`)
    } else {
      providers.push(item)
    }
  }

  return issues.length > 0 ? { config: null, issues } : { config: { providers }, issues }
}

export function providersConfigFile(root: string): string {
  return join(harnessDir(root), PROVIDERS_CONFIG_PATH)
}

export function legacyProvidersConfigFile(root: string): string {
  return join(harnessDir(root), LEGACY_PROVIDERS_CONFIG_PATH)
}

/** 設定ファイルを読む。ファイルがなければ exists: false。必須かどうかは呼び出し側が決める。 */
export function loadProvidersConfig(root: string): LoadedProvidersConfig {
  const file = providersConfigFile(root)
  if (!isFile(file)) {
    const legacy = legacyProvidersConfigFile(root)
    return { exists: false, file, legacyFile: isFile(legacy) ? legacy : null, config: null, issues: [] }
  }
  return { exists: true, file, legacyFile: null, ...parseProvidersConfig(readFileSync(file, 'utf8')) }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
