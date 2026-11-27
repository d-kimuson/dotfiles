import type { OptionSpec } from '../args.ts'
import { readBoolean, readNumber } from '../args.ts'
import type { ContentKind, Entry } from '../content.ts'
import { CONTENT_SPECS, displayPath, listEntries } from '../content.ts'
import { UsageError } from '../errors.ts'
import { formatTable, nextPageHint, paginate, pageSummary, toJson, truncate } from '../output.ts'
import type { CommandSpec, CommandContext } from '../registry.ts'
import { searchEntries } from '../search.ts'
import { createUseCommand } from './use.ts'

const PAGE_OPTIONS: OptionSpec[] = [
  { flags: '--page <n>', description: 'ページ番号（1 始まり）', defaultValue: '1' },
  { flags: '--per-page <n>', description: '1 ページあたりの件数', defaultValue: '10' },
  { flags: '--json', description: 'JSON で出力する' },
]

const DESCRIPTION_MAX = 60

/** `playbooks` / `principles` のコマンドを組み立てる。list / search / use を持つ。 */
export function createCollectionCommand(kind: ContentKind): CommandSpec {
  const spec = CONTENT_SPECS[kind]
  return {
    name: spec.dirName,
    summary: `${spec.dirName} を一覧・検索し、本文を出力する`,
    description: `${spec.dirName}/ 配下の ${spec.label} を一覧・検索し、frontmatter を除いた本文を出力する。list / search の出力はページネーションされる。`,
    usageArgs: '<command>',
    subcommands: [createListCommand(kind), createSearchCommand(kind), createUseCommand(kind)],
    examples: [
      `agent-core ${spec.dirName} list --page 1 --per-page 10`,
      `agent-core ${spec.dirName} search <query> --page 1`,
      `agent-core ${spec.dirName} use <name>`,
    ],
  }
}

function createListCommand(kind: ContentKind): CommandSpec {
  const spec = CONTENT_SPECS[kind]
  return {
    name: 'list',
    summary: `${spec.dirName} をページネーション付きで一覧する`,
    description: `${spec.dirName}/ 配下のディレクトリを名前順で一覧する。description は frontmatter から読む。`,
    usageArgs: '[options]',
    options: PAGE_OPTIONS,
    run: (context) => runList(kind, context),
  }
}

function createSearchCommand(kind: ContentKind): CommandSpec {
  const spec = CONTENT_SPECS[kind]
  return {
    name: 'search',
    summary: `${spec.dirName} を全文検索する`,
    description: `name / description / 本文を対象に全文検索する。複数語は AND 条件。結果はページネーションされる。`,
    usageArgs: '<query...> [options]',
    arguments: [{ name: '<query...>', description: '検索語（空白区切りで AND）' }],
    options: PAGE_OPTIONS,
    run: (context) => runSearch(kind, context),
  }
}

function runList(kind: ContentKind, context: CommandContext): number {
  const spec = CONTENT_SPECS[kind]
  const entries = listEntries(context.root, kind)
  const page = paginate(entries, readNumber(context.options, 'page', 1), readNumber(context.options, 'per-page', 10))

  if (readBoolean(context.options, 'json')) {
    context.out(
      toJson({
        kind,
        total: page.total,
        page: page.page,
        perPage: page.perPage,
        totalPages: page.totalPages,
        items: page.items.map(serializeEntry),
      }),
    )
    return 0
  }

  context.outLine(pageSummary(page, spec.dirName))
  if (entries.length === 0) {
    context.outLine(`(${spec.dirName}/ は空です)`)
    return 0
  }

  context.outLine()
  context.outLine(
    formatTable(
      ['NAME', 'DESCRIPTION'],
      page.items.map((entry) => [entry.name, truncate(entry.description === '' ? '-' : entry.description, DESCRIPTION_MAX)]),
    ),
  )

  const hint = nextPageHint(page)
  if (hint !== null) {
    context.outLine()
    context.outLine(hint)
  }
  return 0
}

function runSearch(kind: ContentKind, context: CommandContext): number {
  const spec = CONTENT_SPECS[kind]
  const query = context.positionals.join(' ').trim()
  if (query === '') {
    throw new UsageError(`検索クエリを指定してください: agent-core ${spec.dirName} search <query>`)
  }

  const hits = searchEntries(listEntries(context.root, kind), query)
  const page = paginate(hits, readNumber(context.options, 'page', 1), readNumber(context.options, 'per-page', 10))

  if (readBoolean(context.options, 'json')) {
    context.out(
      toJson({
        kind,
        query,
        total: page.total,
        page: page.page,
        perPage: page.perPage,
        totalPages: page.totalPages,
        items: page.items.map((hit) => ({ ...serializeEntry(hit.entry), score: hit.score, matched: hit.matched })),
      }),
    )
    return 0
  }

  context.outLine(pageSummary(page, 'hits', query))
  if (hits.length === 0) {
    context.outLine('(no matches)')
    return 0
  }

  context.outLine()
  context.outLine(
    formatTable(
      ['NAME', 'SCORE', 'MATCHED', 'DESCRIPTION'],
      page.items.map((hit) => [
        hit.entry.name,
        String(hit.score),
        hit.matched.join(','),
        truncate(hit.entry.description === '' ? '-' : hit.entry.description, DESCRIPTION_MAX),
      ]),
    ),
  )

  const hint = nextPageHint(page)
  if (hint !== null) {
    context.outLine()
    context.outLine(hint)
  }
  return 0
}

function serializeEntry(entry: Entry): {
  name: string
  path: string
  description: string
  frontmatter: Entry['frontmatter']
} {
  return {
    name: entry.name,
    path: displayPath(entry),
    description: entry.description,
    frontmatter: entry.frontmatter,
  }
}
