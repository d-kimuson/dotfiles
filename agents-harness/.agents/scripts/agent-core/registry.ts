import type { OptionSpec } from './args.ts'

/** コマンド実行時に渡される文脈。 */
export type CommandContext = {
  /** harness root（`.agents` を内包するディレクトリ） */
  root: string
  options: Map<string, string | boolean>
  positionals: string[]
  /** 改行を付けずに stdout へ書く。 */
  out: (text: string) => void
  /** 改行を付けずに stderr へ書く。 */
  err: (text: string) => void
  /** 末尾に改行を付けて stdout へ書く。 */
  outLine: (text?: string) => void
}

/** 位置引数の説明。help の表示にだけ使う。 */
export type ArgumentSpec = {
  name: string
  description: string
}

export type CommandSpec = {
  name: string
  summary: string
  description?: string
  /** usage 行に付ける引数部分。例: `[options]`, `<query...> [options]` */
  usageArgs?: string
  arguments?: ArgumentSpec[]
  options?: OptionSpec[]
  subcommands?: CommandSpec[]
  examples?: string[]
  run?: (context: CommandContext) => number | void | Promise<number | void>
}
