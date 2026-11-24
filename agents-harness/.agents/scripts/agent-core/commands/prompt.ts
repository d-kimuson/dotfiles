import { readBoolean, readOption } from '../args.ts'
import type { ContentKind, Entry } from '../content.ts'
import { CONTENT_KINDS, CONTENT_SPECS, displayPath, findEntry } from '../content.ts'
import { CliError, UsageError } from '../errors.ts'
import { toJson } from '../output.ts'
import { loadRolePrinciples, renderRoleWithPrinciples } from '../principles.ts'
import type { CommandSpec, CommandContext } from '../registry.ts'

const TYPE_VALUES: ContentKind[] = CONTENT_KINDS

/**
 * playbook / role / principle の本文を stdout に出力する。
 * SubAgent へ指示を注入する用途を想定し、既定では frontmatter を除いた本文だけを出す。
 */
export function createPromptCommand(): CommandSpec {
  return {
    name: 'prompt',
    summary: 'playbook / role / principle の本文を出力する',
    description:
      '名前から playbook / role / principle を解決し、本文を stdout に出力する。既定の解決順は playbooks → roles → principles。' +
      'role は frontmatter の principles で推奨する principle の全文を本文の後ろに続ける。' +
      'frontmatter は既定で出力しない（--with-frontmatter で元ファイル全体を出力。この場合 principle は続けない）。',
    usageArgs: '<name> [options]',
    arguments: [{ name: '<name>', description: 'playbook / role / principle のディレクトリ名' }],
    options: [
      { flags: '--type <kind>', description: `探索する種類を限定する (${TYPE_VALUES.join(' | ')})` },
      { flags: '--with-frontmatter', description: 'frontmatter を含む元ファイル全体を出力する' },
      { flags: '--json', description: '解決結果とメタデータを JSON で出力する' },
    ],
    examples: [
      'agent-core prompt initialize-project',
      'agent-core prompt coordinator --type role',
      'agent-core prompt qae --with-frontmatter',
    ],
    run: (context) => runPrompt(context),
  }
}

function runPrompt(context: CommandContext): number {
  const name = readPromptName(context, 'agent-core prompt <name>', 'プロンプト')
  const kind = resolveKind(context)
  const entry = resolveEntry(context.root, name, kind)
  return outputEntry(context, entry, readBoolean(context.options, 'with-frontmatter'))
}

/**
 * 種類を固定して本文だけを出力する。`roles use <name>` / `playbooks use <name>` から使う。
 * frontmatter を除くのは、SubAgent へプロンプトとして注入する用途を想定しているため。
 */
export function runUsePrompt(kind: ContentKind, context: CommandContext): number {
  const spec = CONTENT_SPECS[kind]
  const name = readPromptName(context, `agent-core ${spec.dirName} use <name>`, spec.label)
  const entry = resolveEntry(context.root, name, kind, spec.label)
  return outputEntry(context, entry, false)
}

function readPromptName(context: CommandContext, usage: string, subject: string): string {
  const name = context.positionals[0]
  if (name === undefined || name.trim() === '') {
    throw new UsageError(`${subject}名を指定してください: ${usage}`)
  }
  if (context.positionals.length > 1) {
    throw new UsageError(`位置引数は 1 つだけ指定してください: ${context.positionals.join(' ')}`)
  }
  return name
}

/**
 * role は推奨する principle の全文を本文の後ろに続けて出す (--with-frontmatter は元ファイルだけ)。
 * 参照の解決に失敗したら、何も出力せずに CliError にする。
 */
function outputEntry(context: CommandContext, entry: Entry, withFrontmatter: boolean): number {
  const principles = entry.kind === 'role' && !withFrontmatter ? loadRolePrinciples(context.root, entry) : []

  if (readBoolean(context.options, 'json')) {
    context.out(
      toJson({
        kind: entry.kind,
        name: entry.name,
        path: displayPath(entry),
        file: entry.file,
        frontmatter: entry.frontmatter,
        body: entry.body,
        ...(entry.kind === 'role'
          ? {
              principles: principles.map((principle) => ({
                name: principle.name,
                path: displayPath(principle),
                body: principle.body,
              })),
            }
          : {}),
      }),
    )
    return 0
  }

  const text = withFrontmatter ? entry.raw : entry.kind === 'role' ? renderRoleWithPrinciples(entry, principles) : entry.body
  context.out(text.endsWith('\n') ? text : `${text}\n`)
  return 0
}

function resolveKind(context: CommandContext): ContentKind | undefined {
  const raw = readOption(context.options, 'type')
  if (raw === undefined) {
    return undefined
  }
  const match = TYPE_VALUES.find((candidate) => candidate === raw)
  if (match === undefined) {
    throw new UsageError(`--type は ${TYPE_VALUES.join(' | ')} のいずれかです: ${raw}`)
  }
  return match
}

function resolveEntry(
  root: string,
  name: string,
  kind: ContentKind | undefined,
  notFoundLabel = 'プロンプト',
): Entry {
  const searchOrder = kind === undefined ? CONTENT_KINDS : [kind]

  for (const candidate of searchOrder) {
    const entry = findEntry(root, candidate, name)
    if (entry === undefined) {
      continue
    }
    if (!entry.exists) {
      throw new CliError(
        `${displayPath(entry)} は存在しますが ${CONTENT_SPECS[candidate].fileName} がありません`,
      )
    }
    return entry
  }

  const searched = searchOrder.map((candidate) => CONTENT_SPECS[candidate].dirName).join(' / ')
  throw new CliError(`${notFoundLabel}が見つかりません: ${name} (探索: ${searched})`)
}
