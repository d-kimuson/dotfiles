import type { OptionInfo } from './args.ts'
import {
  HELP_KEY,
  mergeOptionInfos,
  parseArgs,
  parseOptionSpecs,
  readOption,
  splitLeadingOptions,
} from './args.ts'
import { createRootCommand } from './command-set.ts'
import { isCliError, isUsageError } from './errors.ts'
import { renderHelp } from './help.ts'
import { line } from './output.ts'
import { resolveHarnessRoot } from './paths.ts'
import type { CommandContext, CommandSpec } from './registry.ts'

export type CliIo = {
  cwd: string
  env: Record<string, string | undefined>
  out: (text: string) => void
  err: (text: string) => void
}

export function defaultIo(): CliIo {
  return {
    cwd: process.cwd(),
    env: process.env,
    out: (text) => process.stdout.write(text),
    err: (text) => process.stderr.write(text),
  }
}

export type ResolvedCommand = {
  command: CommandSpec
  path: CommandSpec[]
  options: Map<string, string | boolean>
  positionals: string[]
  help: boolean
}

/**
 * argv をコマンド階層に沿って解決する。
 * 各階層で先頭のオプションだけを読み、最初の位置引数がサブコマンド名なら降りる。
 */
export function resolveCommand(root: CommandSpec, argv: string[]): ResolvedCommand {
  const options = new Map<string, string | boolean>()
  let command = root
  let path: CommandSpec[] = [root]
  let remaining = argv
  let inherited: OptionInfo[] = []
  let help = false

  for (;;) {
    const own = parseOptionSpecs(command.options ?? [])
    const infos = mergeOptionInfos(inherited, own)
    const { pairs, rest } = splitLeadingOptions(remaining, infos)

    for (const [key, value] of pairs) {
      if (key === HELP_KEY) {
        help = true
      } else {
        options.set(key, value)
      }
    }

    const candidate = rest[0]
    const subcommand =
      candidate === undefined ? undefined : command.subcommands?.find((sub) => sub.name === candidate)

    if (subcommand === undefined) {
      const parsed = parseArgs(rest, infos)
      for (const [key, value] of parsed.options) {
        options.set(key, value)
      }
      return {
        command,
        path,
        options,
        positionals: parsed.positionals,
        help: help || parsed.help,
      }
    }

    inherited = infos
    command = subcommand
    path = [...path, subcommand]
    remaining = rest.slice(1)
  }
}

export async function run(argv: string[], io: CliIo = defaultIo()): Promise<number> {
  const rootCommand = createRootCommand()

  try {
    const resolved = resolveCommand(rootCommand, argv)

    if (resolved.help || resolved.command.run === undefined) {
      io.out(renderHelp(resolved.path))
      return 0
    }

    const root = resolveHarnessRoot({
      root: readOption(resolved.options, 'root'),
      cwd: io.cwd,
      env: io.env,
    })

    const context: CommandContext = {
      root,
      cwd: io.cwd,
      options: resolved.options,
      positionals: resolved.positionals,
      out: io.out,
      err: io.err,
      outLine: (text = '') => io.out(line(text)),
    }

    const code = await resolved.command.run(context)
    return code ?? 0
  } catch (error) {
    return reportError(error, io)
  }
}

function reportError(error: unknown, io: CliIo): number {
  if (isUsageError(error)) {
    io.err(`error: ${error.message}\n`)
    io.err('hint: --help を参照してください\n')
    return error.exitCode
  }

  if (isCliError(error)) {
    io.err(`error: ${error.message}\n`)
    return error.exitCode
  }

  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  io.err(`unexpected error: ${message}\n`)
  return 1
}
