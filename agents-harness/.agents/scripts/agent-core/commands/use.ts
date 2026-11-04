import type { ContentKind } from '../content.ts'
import { CONTENT_SPECS } from '../content.ts'
import type { CommandSpec } from '../registry.ts'
import { runUsePrompt } from './prompt.ts'

/**
 * `${dirName} use <name>` を組み立てる。
 * frontmatter を除いた本文だけを返し、SubAgent のタスクブリーフ先頭に置く用途を想定する。
 */
export function createUseCommand(kind: ContentKind): CommandSpec {
  const spec = CONTENT_SPECS[kind]
  return {
    name: 'use',
    summary: `${spec.dirName} の本文を frontmatter なしで出力する`,
    description:
      `${spec.dirName}/<name>/${spec.fileName} を読み、frontmatter を除いた本文だけを stdout に出力する。` +
      (kind === 'role' ? 'frontmatter の principles で推奨する principle の全文を、本文の後ろに列挙順で続ける。' : ''),
    usageArgs: '<name> [options]',
    arguments: [{ name: '<name>', description: `${spec.label} のディレクトリ名` }],
    options: [{ flags: '--json', description: '解決結果とメタデータを JSON で出力する' }],
    examples: [`agent-core ${spec.dirName} use <name>`],
    run: (context) => runUsePrompt(kind, context),
  }
}
