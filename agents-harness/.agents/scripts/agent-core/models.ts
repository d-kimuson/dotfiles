import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { harnessDir, isFile } from './paths.ts'

/** harness root からの設定ファイルの相対パス。 */
export const MODELS_CONFIG_PATH = 'config/models.json'

/** `<runtime>:<model>:<effort>` を分解したもの。 */
export type ModelCandidate = {
  /** 設定ファイル上の元の表記。 */
  spec: string
  runtime: string
  model: string
  effort: string
}

export type ModelKind = {
  name: string
  description: string
  /** 使う条件の補足。なければ空配列。 */
  conditions: string[]
  /** 優先順。 */
  candidates: ModelCandidate[]
}

/** モデル名（provider の接頭辞を除いたもの）ごとに使える effort の一覧。 */
export type ModelEfforts = Record<string, string[]>

export type ModelsConfig = {
  kinds: ModelKind[]
  efforts: ModelEfforts
}

export type ModelsIssue = {
  code: string
  message: string
}

export type ParseCandidateResult =
  { ok: true; candidate: ModelCandidate } | { ok: false; message: string }

export type ParseModelsConfigResult = {
  /** issues が 1 件でもあれば null。warnings だけなら読める。 */
  config: ModelsConfig | null
  issues: ModelsIssue[]
  /** 設定は読めるが、検査しきれなかったもの（effort の一覧が未定義のモデルなど）。 */
  warnings: ModelsIssue[]
}

type Report = (code: string, message: string) => void

type ParseContext = {
  efforts: ModelEfforts
  warnedModels: Set<string>
  warn: Report
}

export type LoadedModelsConfig = ParseModelsConfigResult & {
  exists: boolean
}

const RUNTIME_PATTERN = /^[a-z][a-z0-9-]*$/
const KIND_NAME_PATTERN = /^[a-z][a-z0-9-]*$/
const EFFORT_PATTERN = /^[a-z][a-z0-9]*$/
const KIND_KEYS = ['name', 'description', 'conditions', 'candidates']

/** model から effort の一覧を引くキーを得る。`opencode-go/deepseek-v4.1-flash` なら `deepseek-v4.1-flash`。 */
export function modelEffortKey(model: string): string {
  return model.slice(model.lastIndexOf('/') + 1)
}

/** モデルに使える effort の一覧。定義がなければ undefined。 */
export function effortsOf(efforts: ModelEfforts, model: string): string[] | undefined {
  const key = modelEffortKey(model)
  return Object.hasOwn(efforts, key) ? efforts[key] : undefined
}

/**
 * `<runtime>:<model>:<effort>` を分解する。effort は書式だけを見る（使える値かは `efforts` の一覧で検査する）。
 * 最初の `:` までが runtime、最後の `:` 以降が effort で、間が model（`/` や `:` を含みうる）。
 */
export function parseCandidate(spec: string): ParseCandidateResult {
  const first = spec.indexOf(':')
  const last = spec.lastIndexOf(':')
  if (first === -1 || first === last) {
    return { ok: false, message: '`<runtime>:<model>:<effort>` の形式ではありません' }
  }

  const runtime = spec.slice(0, first)
  const model = spec.slice(first + 1, last)
  const effort = spec.slice(last + 1)

  if (!RUNTIME_PATTERN.test(runtime)) {
    return { ok: false, message: `runtime は小文字英数字とハイフンで書く必要があります: "${runtime}"` }
  }
  if (model === '' || /\s/.test(model)) {
    return { ok: false, message: 'model は空白を含まない 1 語以上で書く必要があります' }
  }
  if (!EFFORT_PATTERN.test(effort)) {
    return { ok: false, message: `effort は小文字英数字で書く必要があります: "${effort}"` }
  }
  return { ok: true, candidate: { spec, runtime, model, effort } }
}

export function parseModelsConfig(text: string): ParseModelsConfigResult {
  const issues: ModelsIssue[] = []
  const warnings: ModelsIssue[] = []
  const add: Report = (code, message) => {
    issues.push({ code, message })
  }
  const warn: Report = (code, message) => {
    warnings.push({ code, message })
  }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (error) {
    add('invalid-json', `JSON として解釈できません: ${error instanceof Error ? error.message : String(error)}`)
    return { config: null, issues, warnings }
  }

  const rawKinds = isRecord(data) ? data['kinds'] : undefined
  if (!Array.isArray(rawKinds) || rawKinds.length === 0) {
    add('invalid-kinds', '`kinds` は 1 件以上の配列である必要があります')
    return { config: null, issues, warnings }
  }

  const efforts = parseEfforts(isRecord(data) ? data['efforts'] : undefined, add)
  const context: ParseContext = { efforts, warnedModels: new Set(), warn }

  const kinds: ModelKind[] = []
  const seen = new Set<string>()
  rawKinds.forEach((raw, index) => {
    const kind = parseKind(raw, index, seen, add, context)
    if (kind !== null) {
      kinds.push(kind)
    }
  })

  return issues.length > 0 ? { config: null, issues, warnings } : { config: { kinds, efforts }, issues, warnings }
}

/** `efforts` はモデル名から effort の一覧への対応。省略すると空（どのモデルも未定義）。 */
function parseEfforts(raw: unknown, add: Report): ModelEfforts {
  if (raw === undefined) {
    return {}
  }
  if (!isRecord(raw)) {
    add('invalid-efforts', '`efforts` はモデル名から effort の配列への対応である必要があります')
    return {}
  }

  const efforts: ModelEfforts = {}
  for (const [model, value] of Object.entries(raw)) {
    const valid =
      isStringArray(value) &&
      value.length > 0 &&
      value.every((effort) => EFFORT_PATTERN.test(effort)) &&
      new Set(value).size === value.length
    if (!valid) {
      add('invalid-efforts', `efforts.${model} は重複のない小文字英数字の配列(1 件以上)である必要があります`)
      continue
    }
    efforts[model] = value
  }
  return efforts
}

function parseKind(
  raw: unknown,
  index: number,
  seen: Set<string>,
  add: Report,
  context: ParseContext,
): ModelKind | null {
  if (!isRecord(raw)) {
    add('invalid-kind', `kinds[${index}] はオブジェクトである必要があります`)
    return null
  }

  const name = typeof raw['name'] === 'string' ? raw['name'] : ''
  const label = name === '' ? `kinds[${index}]` : name
  let failures = 0
  const fail = (code: string, message: string): void => {
    failures += 1
    add(code, `${label}: ${message}`)
  }

  if (!KIND_NAME_PATTERN.test(name)) {
    fail('invalid-name', `name は小文字英数字とハイフンで書く必要があります: ${JSON.stringify(raw['name'])}`)
  } else if (seen.has(name)) {
    fail('duplicate-kind', 'name が重複しています')
  } else {
    seen.add(name)
  }

  for (const key of Object.keys(raw)) {
    if (!KIND_KEYS.includes(key)) {
      fail('unknown-key', `未知のキーです: ${key} (使えるキー: ${KIND_KEYS.join(', ')})`)
    }
  }

  const description = raw['description']
  if (typeof description !== 'string' || description.trim() === '') {
    fail('missing-description', 'description が必須です')
  }

  const conditions = raw['conditions'] ?? []
  if (!isStringArray(conditions) || conditions.some((item) => item.trim() === '')) {
    fail('invalid-conditions', 'conditions は空でない文字列の配列である必要があります')
  }

  const candidates = parseCandidates(raw['candidates'], fail, context)

  if (failures > 0 || typeof description !== 'string' || !isStringArray(conditions)) {
    return null
  }
  return { name, description, conditions, candidates }
}

function parseCandidates(raw: unknown, fail: Report, context: ParseContext): ModelCandidate[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    fail('empty-candidates', 'candidates は 1 件以上の配列である必要があります')
    return []
  }

  const candidates: ModelCandidate[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') {
      fail('invalid-candidate', `候補は文字列である必要があります: ${JSON.stringify(item)}`)
      continue
    }
    const parsed = parseCandidate(item)
    if (!parsed.ok) {
      fail('invalid-candidate', `候補 "${item}" が不正です: ${parsed.message}`)
      continue
    }
    if (seen.has(item)) {
      fail('duplicate-candidate', `候補 "${item}" が重複しています`)
      continue
    }
    seen.add(item)
    candidates.push(parsed.candidate)
    checkEffort(parsed.candidate, fail, context)
  }
  return candidates
}

/** 候補の effort をモデルの一覧で検査する。一覧がないモデルは検査できないので、モデルごとに 1 回だけ warning にする。 */
function checkEffort(candidate: ModelCandidate, fail: Report, context: ParseContext): void {
  const supported = effortsOf(context.efforts, candidate.model)
  if (supported === undefined) {
    const key = modelEffortKey(candidate.model)
    if (!context.warnedModels.has(key)) {
      context.warnedModels.add(key)
      context.warn(
        'unknown-model-efforts',
        `モデル "${key}" の effort の一覧が efforts に未定義のため、effort を検査していません (候補 "${candidate.spec}")`,
      )
    }
    return
  }
  if (!supported.includes(candidate.effort)) {
    fail(
      'unsupported-effort',
      `候補 "${candidate.spec}" の effort は ${modelEffortKey(candidate.model)} で使えません (使える effort: ${supported.join(' | ')})`,
    )
  }
}

export function modelsConfigFile(root: string): string {
  return join(harnessDir(root), 'config', 'models.json')
}

/** 設定ファイルを読む。ファイルがなければ exists: false（エラーにはしない）。 */
export function loadModelsConfig(root: string): LoadedModelsConfig {
  const file = modelsConfigFile(root)
  if (!isFile(file)) {
    return { exists: false, config: null, issues: [], warnings: [] }
  }
  return { exists: true, ...parseModelsConfig(readFileSync(file, 'utf8')) }
}

export function findModelKind(config: ModelsConfig, name: string): ModelKind | undefined {
  return config.kinds.find((kind) => kind.name === name)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}
