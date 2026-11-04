import { readBoolean } from '../args.ts'
import { harnessDir } from '../paths.ts'
import type { CommandSpec, CommandContext } from '../registry.ts'
import { line, toJson } from '../output.ts'
import type { VerifyReport } from '../verify.ts'
import { verifyHarness } from '../verify.ts'

export function createVerifyCommand(): CommandSpec {
  return {
    name: 'verify',
    summary: 'playbooks / roles / principles / prompts / models / providers の構造を検証する',
    description:
      '各エントリが必須ファイル（PLAYBOOK.md / ROLE.md / PRINCIPLE.md と README.md）を持ち、' +
      'frontmatter に name と description を持つか、role の principles が実在する principle だけを指すか、prompts の末尾が $ARGUMENTS のブロックか、config/models.json（必須）の書式（候補の形式、空の候補リストなど）と、' +
      '候補の effort が efforts の一覧に含まれるか、候補の provider が決まるかを検証する。' +
      'providers.json はマシン固有のローカルファイルなので必須ではなく、あれば書式だけを検証する（なくても警告しない）。' +
      '一覧が未定義のモデルは警告。エラーがあれば exit 1、警告のみなら exit 0。',
    usageArgs: '[options]',
    options: [{ flags: '--json', description: '検証結果を JSON で出力する' }],
    examples: ['agent-core verify', 'agent-core verify --json'],
    run: (context) => runVerify(context),
  }
}

function runVerify(context: CommandContext): number {
  const report = verifyHarness(context.root)

  if (readBoolean(context.options, 'json')) {
    context.out(toJson(report))
    return report.ok ? 0 : 1
  }

  context.out(renderReport(report))
  return report.ok ? 0 : 1
}

export function renderReport(report: VerifyReport): string {
  const lines: string[] = []
  lines.push(`verify ${harnessDir(report.root)}`)
  lines.push('')

  const directoryIssues = report.issues.filter((issue) => issue.entry === null)
  for (const issue of directoryIssues) {
    lines.push(`${issue.severity === 'error' ? '✗' : '!'} ${issue.message}`)
  }
  if (directoryIssues.length > 0) {
    lines.push('')
  }

  if (report.entries.length === 0) {
    lines.push('(エントリがありません)')
    lines.push('')
  }

  for (const entry of report.entries) {
    lines.push(entry.path)
    for (const file of entry.files) {
      lines.push(`  ${file.exists ? '✓' : '✗'} ${file.fileName}`)
    }
    for (const issue of entry.issues) {
      // ファイル欠如は上のチェック行で示しているので重複表示しない。
      if (issue.code === 'missing-file') {
        continue
      }
      lines.push(`  ${issue.severity === 'error' ? '✗' : '!'} ${issue.message}`)
    }
    lines.push('')
  }

  const mark = report.ok ? '✓' : '✗'
  lines.push(
    line(
      `${mark} ${report.checked} entries · ${report.errorCount} errors · ${report.warningCount} warnings`,
    ).trimEnd(),
  )

  return `${lines.join('\n').trimEnd()}\n`
}
