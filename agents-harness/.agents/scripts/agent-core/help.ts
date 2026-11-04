import type { OptionInfo, OptionSpec } from './args.ts'
import { parseOptionSpecs } from './args.ts'
import type { CommandSpec } from './registry.ts'
import { alignTwoColumns } from './output.ts'

const ROOT_NAME = 'agent-core'

const HELP_OPTION: OptionSpec = { flags: '-h, --help', description: 'このヘルプを表示する' }

/** 祖先のオプションを継承しつつ help を描画する。 */
export function renderHelp(path: CommandSpec[]): string {
  const target = path[path.length - 1]
  if (target === undefined) {
    return ''
  }
  if (path.length === 1) {
    return renderRootHelp(target)
  }
  return renderCommandHelp(path, target)
}

function commandPath(path: CommandSpec[]): string {
  return [ROOT_NAME, ...path.slice(1).map((command) => command.name)].join(' ')
}

function inheritedOptions(path: CommandSpec[]): OptionSpec[] {
  return path.flatMap((command) => command.options ?? [])
}

function renderRootHelp(root: CommandSpec): string {
  const lines: string[] = []
  lines.push(`${ROOT_NAME} <command>`)
  lines.push('')
  if (root.description !== undefined) {
    lines.push(root.description)
    lines.push('')
  }

  lines.push('Usage:')
  lines.push(`  ${ROOT_NAME} [options]`)
  lines.push(`  ${ROOT_NAME} <command> [options]`)
  lines.push('')

  const subcommands = root.subcommands ?? []
  if (subcommands.length > 0) {
    lines.push('Commands:')
    lines.push(
      alignTwoColumns(subcommands.map((command) => [command.name, command.summary])),
    )
    lines.push('')
  }

  const options = [...(root.options ?? []), HELP_OPTION]
  lines.push('Options:')
  lines.push(alignTwoColumns(parseOptionSpecs(options).map(optionRow)))
  lines.push('')

  if (root.examples !== undefined && root.examples.length > 0) {
    lines.push('Examples:')
    for (const example of root.examples) {
      lines.push(`  ${example}`)
    }
    lines.push('')
  }

  lines.push(`各コマンドの詳細: ${ROOT_NAME} <command> --help`)
  return `${lines.join('\n').trimEnd()}\n`
}

function renderCommandHelp(path: CommandSpec[], target: CommandSpec): string {
  const lines: string[] = []
  const usageArgs = target.usageArgs ?? '[options]'
  lines.push(`${commandPath(path)} ${usageArgs}`)
  lines.push('')

  const description = target.description ?? target.summary
  lines.push(description)
  lines.push('')

  lines.push('Usage:')
  lines.push(`  ${commandPath(path)} ${usageArgs}`)
  const subcommands = target.subcommands ?? []
  if (subcommands.length > 0 && !usageArgs.startsWith('<command>')) {
    lines.push(`  ${commandPath(path)} <command> [options]`)
  }
  lines.push('')

  if (subcommands.length > 0) {
    lines.push('Commands:')
    lines.push(alignTwoColumns(subcommands.map((command) => [command.name, command.summary])))
    lines.push('')
  }

  if (target.arguments !== undefined && target.arguments.length > 0) {
    lines.push('Arguments:')
    lines.push(alignTwoColumns(target.arguments.map((argument) => [argument.name, argument.description])))
    lines.push('')
  }

  const options = [...inheritedOptions(path).filter(isNotLocalHelp), HELP_OPTION]
  lines.push('Options:')
  lines.push(alignTwoColumns(parseOptionSpecs(options).map(optionRow)))
  lines.push('')

  if (target.examples !== undefined && target.examples.length > 0) {
    lines.push('Examples:')
    for (const example of target.examples) {
      lines.push(`  ${example}`)
    }
    lines.push('')
  }

  return `${lines.join('\n').trimEnd()}\n`
}

function isNotLocalHelp(spec: OptionSpec): boolean {
  return !spec.flags.includes('--help')
}

function optionRow(info: OptionInfo): [string, string] {
  const flags = info.spec.flags
  const defaultValue = info.spec.defaultValue
  const description =
    defaultValue === undefined ? info.spec.description : `${info.spec.description} (default: ${defaultValue})`
  return [flags, description]
}
