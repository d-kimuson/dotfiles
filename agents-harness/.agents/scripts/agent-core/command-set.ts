import type { CommandSpec } from './registry.ts'
import { createCollectionCommand } from './commands/collection.ts'
import { createExportCommand } from './commands/export.ts'
import { createModelsCommand } from './commands/models.ts'
import { createPromptCommand } from './commands/prompt.ts'
import { createVerifyCommand } from './commands/verify.ts'

/** CLI 全体のコマンド定義。ここに足すだけで `--help` に反映される。 */
export function createRootCommand(): CommandSpec {
  return {
    name: 'agent-core',
    summary: 'Project Scope Harness のコア CLI',
    description:
      'playbooks / principles を一覧・検索し、本文をプロンプトとして出力する。SubAgent のモデル候補も一覧する。' +
      'コマンドは宣言的に登録され、help は自動生成される。',
    options: [
      {
        flags: '--root <dir>',
        description: 'harness root を明示する（既定: ~/.agents。開発中は --root . で cwd を利用）',
      },
    ],
    subcommands: [
      createCollectionCommand('playbook'),
      createCollectionCommand('principle'),
      createModelsCommand(),
      createPromptCommand(),
      createVerifyCommand(),
      createExportCommand(),
    ],
    examples: [
      'agent-core playbooks list --page 1 --per-page 10',
      'agent-core playbooks search bug --page 1',
      'agent-core principles search 検証',
      'agent-core models list arbiter',
      'agent-core prompt initialize-project',
      'agent-core verify',
      'agent-core export --to /tmp/harness-copy --profile claude-code-web',
    ],
  }
}
