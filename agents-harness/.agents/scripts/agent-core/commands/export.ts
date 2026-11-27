import { resolve } from 'node:path'

import { readOption } from '../args.ts'
import { UsageError } from '../errors.ts'
import type { ExportProfile } from '../export.ts'
import { exportHarness, exportProfileNames, findExportProfile } from '../export.ts'
import type { CommandContext, CommandSpec } from '../registry.ts'

export function createExportCommand(): CommandSpec {
  return {
    name: 'export',
    summary: 'harness をコピーして別のディレクトリへ配布する (使い捨て環境向け)',
    description:
      '配布元の harness (--root で解決した .agents) の Git 追跡ファイルを、--to の下の .agents へコピーする。' +
      '通常マシンは chezmoi の symlink で配布するので、このコマンドはコピーが必要な環境 (使い捨てのクラウド環境など) で使う。' +
      '--profile を指定すると、その環境で動かないファイルを除外し、state/providers.json を profile の provider で書く。' +
      '配布先に .agents があるとき (symlink を含む) は、削除も上書きもせずに失敗する。',
    usageArgs: '--to <dir> [options]',
    options: [
      { flags: '--to <dir>', description: '配布先の harness root。この下に .agents を作る' },
      {
        flags: '--profile <name>',
        description: `配布するファイルの集合（${exportProfileNames().join(' | ')}）。省略すると全追跡ファイルをコピーし、providers を書かない`,
      },
    ],
    examples: [
      'agent-core --root <dotfiles>/agents-harness export --to ~ --profile claude-code-web',
      'agent-core export --to /tmp/harness-copy',
    ],
    run: (context) => runExport(context),
  }
}

function runExport(context: CommandContext): number {
  const to = readOption(context.options, 'to')
  if (to === undefined || to === '') {
    throw new UsageError('配布先を指定してください: agent-core export --to <dir>')
  }

  const profile = readProfile(context)
  const result = exportHarness({
    sourceRoot: context.root,
    targetRoot: resolve(context.cwd, to),
    profile,
  })

  for (const path of result.unmatchedExcludes) {
    context.err(`warning: 除外パスが追跡ファイルに一致しません: ${path}\n`)
  }

  context.outLine(`配布先: ${result.targetDir}`)
  context.outLine(`コピー: ${result.copied} 件`)
  if (result.excluded.length > 0) {
    context.outLine(`除外: ${result.excluded.length} 件`)
    for (const path of result.excluded) {
      context.outLine(`  ${path}`)
    }
  }
  if (result.providers !== null) {
    context.outLine(`providers: ${result.providers.join(', ')}`)
  }
  return 0
}

function readProfile(context: CommandContext): ExportProfile | null {
  const name = readOption(context.options, 'profile')
  if (name === undefined) {
    return null
  }
  const profile = findExportProfile(name)
  if (profile === undefined) {
    throw new UsageError(`未知の profile です: ${name} (使える profile: ${exportProfileNames().join(', ')})`)
  }
  return profile
}
