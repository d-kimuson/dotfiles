import { dirname } from 'node:path'

import { readBoolean } from '../args.ts'
import { CliError, UsageError } from '../errors.ts'
import type { ModelKind, ModelsConfig, ModelsIssue } from '../models.ts'
import { findModelKind, loadModelsConfig, MODELS_CONFIG_PATH } from '../models.ts'
import { formatTable, toJson } from '../output.ts'
import type { ProvidersConfig } from '../providers.ts'
import {
  CONFIGURE_PROVIDERS_PLAYBOOK,
  filterKindsByProviders,
  loadProvidersConfig,
  PROVIDERS_CONFIG_PATH,
} from '../providers.ts'
import type { CommandContext, CommandSpec } from '../registry.ts'

/** `models` のコマンドを組み立てる。SubAgent に使うモデル候補の一覧を出す。 */
export function createModelsCommand(): CommandSpec {
  return {
    name: 'models',
    summary: 'SubAgent に使うモデル候補を作業の種類ごとに一覧する',
    description:
      `${MODELS_CONFIG_PATH} の設定を出力する。候補は優先順で、runtime / model / effort に分解して出す。` +
      `${PROVIDERS_CONFIG_PATH} (この環境で使える provider。マシン固有でコミットしない) にある provider の候補だけを出し、` +
      '候補がすべて外れた種類は「候補なし」として残す。' +
      `${PROVIDERS_CONFIG_PATH} がなければ ${CONFIGURE_PROVIDERS_PLAYBOOK} playbook で作るよう案内して失敗する。` +
      'effort の一覧が未定義のモデルがあれば warning を stderr に出す。選び方は guidelines/delegate.md を参照。',
    usageArgs: '<command>',
    subcommands: [createListCommand()],
    examples: ['agent-core models list', 'agent-core models list arbiter'],
  }
}

function createListCommand(): CommandSpec {
  return {
    name: 'list',
    summary: '作業の種類ごとの説明と、モデル候補を優先順に一覧する',
    description:
      '種類を指定するとその説明と候補を、省略すると全種類を出す。候補は上ほど優先度が高い。' +
      `候補は ${PROVIDERS_CONFIG_PATH} で許可された provider のものだけで、番号は残った候補で振り直す。`,
    usageArgs: '[kind] [options]',
    arguments: [{ name: '[kind]', description: '作業の種類（省略で全種類）' }],
    options: [{ flags: '--json', description: 'JSON で出力する' }],
    examples: ['agent-core models list', 'agent-core models list worker --json'],
    run: (context) => runList(context),
  }
}

function runList(context: CommandContext): number {
  const { config, warnings } = requireConfig(context.root)
  for (const warning of warnings) {
    context.err(`warning: ${MODELS_CONFIG_PATH}: ${warning.message}\n`)
  }
  const providers = requireProviders(context.root)
  const kinds = filterKindsByProviders(selectKinds(config, context.positionals), providers.providers)

  if (readBoolean(context.options, 'json')) {
    context.out(toJson({ kinds }))
    return 0
  }

  context.out(kinds.map(renderKind).join('\n'))
  return 0
}

function requireConfig(root: string): { config: ModelsConfig; warnings: ModelsIssue[] } {
  const loaded = loadModelsConfig(root)
  if (!loaded.exists) {
    throw new CliError(`${MODELS_CONFIG_PATH} が見つかりません`)
  }
  if (loaded.config === null) {
    const reasons = loaded.issues.map((issue) => `  - ${issue.message}`).join('\n')
    throw new CliError(`${MODELS_CONFIG_PATH} が不正です (agent-core verify で確認できます):\n${reasons}`)
  }
  return { config: loaded.config, warnings: loaded.warnings }
}

function requireProviders(root: string): ProvidersConfig {
  const loaded = loadProvidersConfig(root)
  if (!loaded.exists) {
    if (loaded.legacyFile !== null) {
      throw new CliError(
        `${PROVIDERS_CONFIG_PATH} が見つかりませんが、旧パス (${loaded.legacyFile}) にファイルがあります。\n` +
          '次のコマンドで新しいパスへ移動してください:\n' +
          `  mkdir -p "${dirname(loaded.file)}" && mv "${loaded.legacyFile}" "${loaded.file}"`,
      )
    }
    throw new CliError(
      `${PROVIDERS_CONFIG_PATH} が見つかりません (期待するパス: ${loaded.file})。\n` +
        'この環境で使える provider の設定が必要です。次のコマンドで playbook を取得し、手順に従って設定してください:\n' +
        `  ~/.agents/scripts/agent-core.ts playbooks use '${CONFIGURE_PROVIDERS_PLAYBOOK}'`,
    )
  }
  if (loaded.config === null) {
    const reasons = loaded.issues.map((issue) => `  - ${issue.message}`).join('\n')
    throw new CliError(`${PROVIDERS_CONFIG_PATH} が不正です (${loaded.file}):\n${reasons}`)
  }
  return loaded.config
}

function selectKinds(config: ModelsConfig, positionals: string[]): ModelKind[] {
  if (positionals.length > 1) {
    throw new UsageError(`種類は 1 つだけ指定してください: ${positionals.join(' ')}`)
  }
  const name = positionals[0]
  if (name === undefined) {
    return config.kinds
  }
  const kind = findModelKind(config, name)
  if (kind === undefined) {
    const available = config.kinds.map((candidate) => candidate.name).join(', ')
    throw new UsageError(`存在しない種類です: ${name} (使える種類: ${available})`)
  }
  return [kind]
}

function renderKind(kind: ModelKind): string {
  const lines = [kind.name, `  ${kind.description}`]
  for (const condition of kind.conditions) {
    lines.push(`  - ${condition}`)
  }
  lines.push('')
  if (kind.candidates.length === 0) {
    lines.push(`  候補なし (この環境で使える provider の候補がありません。呼び出し方は AGENTS.md の「Agent の呼び出し」の、どの候補も呼べない場合に従う)`)
    return `${lines.join('\n')}\n`
  }
  const table = formatTable(
    ['#', 'RUNTIME', 'MODEL', 'EFFORT'],
    kind.candidates.map((candidate, index) => [
      String(index + 1),
      candidate.runtime,
      candidate.model,
      candidate.effort,
    ]),
  )
  lines.push(...table.split('\n').map((row) => `  ${row}`))
  return `${lines.join('\n')}\n`
}
