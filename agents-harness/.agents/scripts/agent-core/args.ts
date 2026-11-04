import { UsageError } from './errors.ts'

/** コマンドが受け付けるオプション定義。Commander 風の flags 文字列で書く。 */
export type OptionSpec = {
  /** 例: `--page <n>` / `-p, --page <n>` / `--json` */
  flags: string
  description: string
  /** help に `(default: x)` として表示する。値の適用はコマンド側で行う。 */
  defaultValue?: string
}

export type OptionInfo = {
  spec: OptionSpec
  long: string
  short: string | null
  takesValue: boolean
  valueName: string | null
}

export type ParsedArgs = {
  options: Map<string, string | boolean>
  positionals: string[]
  help: boolean
}

export const HELP_KEY = '__help'

/** flags 文字列を解析する。 */
export function parseOptionSpec(spec: OptionSpec): OptionInfo {
  const match = /^(.*?)\s*<([^>]+)>\s*$/.exec(spec.flags)
  const flagsPart = (match?.[1] ?? spec.flags).trim()
  const valueName = match?.[2] ?? null

  let long: string | null = null
  let short: string | null = null
  for (const token of flagsPart.split(',')) {
    const flag = token.trim()
    if (flag.startsWith('--')) {
      long = flag.slice(2)
    } else if (flag.startsWith('-')) {
      short = flag
    }
  }

  if (long === null) {
    throw new UsageError(`内部エラー: 長いオプション名がありません: ${spec.flags}`)
  }

  return {
    spec,
    long,
    short,
    takesValue: valueName !== null,
    valueName,
  }
}

export function parseOptionSpecs(specs: OptionSpec[]): OptionInfo[] {
  return specs.map(parseOptionSpec)
}

/** 長いオプション名が重複した場合は後勝ち（子コマンドを優先）。 */
export function mergeOptionInfos(...groups: OptionInfo[][]): OptionInfo[] {
  const merged = new Map<string, OptionInfo>()
  for (const group of groups) {
    for (const info of group) {
      merged.set(info.long, info)
    }
  }
  return [...merged.values()]
}

type ConsumedOption = {
  key: string
  value: string | boolean
  nextIndex: number
}

function consumeOption(argv: string[], index: number, infos: OptionInfo[]): ConsumedOption {
  const token = argv[index]
  if (token === undefined) {
    throw new UsageError('内部エラー: オプション位置が不正です')
  }

  if (token === '-h' || token === '--help') {
    return { key: HELP_KEY, value: true, nextIndex: index + 1 }
  }

  let name = token
  let inlineValue: string | null = null
  const equals = token.indexOf('=')
  if (token.startsWith('--') && equals !== -1) {
    name = token.slice(0, equals)
    inlineValue = token.slice(equals + 1)
  }

  const info = name.startsWith('--')
    ? infos.find((candidate) => candidate.long === name.slice(2))
    : infos.find((candidate) => candidate.short === name)

  if (info === undefined) {
    throw new UsageError(`不明なオプションです: ${name}`)
  }

  if (!info.takesValue) {
    if (inlineValue !== null) {
      throw new UsageError(`オプション ${name} は値を受け取りません`)
    }
    return { key: info.long, value: true, nextIndex: index + 1 }
  }

  if (inlineValue !== null) {
    return { key: info.long, value: inlineValue, nextIndex: index + 1 }
  }

  const next = argv[index + 1]
  if (next === undefined || next.startsWith('-')) {
    throw new UsageError(`オプション ${name} には値が必要です: <${info.valueName ?? 'value'}>`)
  }

  return { key: info.long, value: next, nextIndex: index + 2 }
}

/**
 * 先頭のオプションだけを読み取り、最初の位置引数以降を rest として返す。
 * 階層的なサブコマンド解決で使う。
 */
export function splitLeadingOptions(
  argv: string[],
  infos: OptionInfo[],
): { pairs: Array<[string, string | boolean]>; rest: string[] } {
  const pairs: Array<[string, string | boolean]> = []

  for (let index = 0; index < argv.length; ) {
    const token = argv[index]
    if (token === undefined) {
      break
    }
    if (token === '--') {
      return { pairs, rest: argv.slice(index + 1) }
    }
    if (!token.startsWith('-') || token === '-') {
      return { pairs, rest: argv.slice(index) }
    }
    const consumed = consumeOption(argv, index, infos)
    pairs.push([consumed.key, consumed.value])
    index = consumed.nextIndex
  }

  return { pairs, rest: [] }
}

/** フラグと位置引数をまとめて解析する。 */
export function parseArgs(argv: string[], infos: OptionInfo[]): ParsedArgs {
  const options = new Map<string, string | boolean>()
  const positionals: string[] = []
  let help = false

  for (let index = 0; index < argv.length; ) {
    const token = argv[index]
    if (token === undefined) {
      break
    }
    if (token === '--') {
      positionals.push(...argv.slice(index + 1))
      break
    }
    if (!token.startsWith('-') || token === '-') {
      positionals.push(token)
      index += 1
      continue
    }
    const consumed = consumeOption(argv, index, infos)
    if (consumed.key === HELP_KEY) {
      help = true
    } else {
      options.set(consumed.key, consumed.value)
    }
    index = consumed.nextIndex
  }

  return { options, positionals, help }
}

export function readOption(options: Map<string, string | boolean>, name: string): string | undefined {
  const value = options.get(name)
  return typeof value === 'string' ? value : undefined
}

export function readBoolean(options: Map<string, string | boolean>, name: string): boolean {
  return options.get(name) === true
}

export function readNumber(
  options: Map<string, string | boolean>,
  name: string,
  fallback: number,
): number {
  const raw = readOption(options, name)
  if (raw === undefined) {
    return fallback
  }
  if (!/^\d+$/.test(raw)) {
    throw new UsageError(`--${name} は 1 以上の整数で指定してください: ${raw}`)
  }
  const value = Number(raw)
  if (value < 1) {
    throw new UsageError(`--${name} は 1 以上で指定してください: ${raw}`)
  }
  return value
}
