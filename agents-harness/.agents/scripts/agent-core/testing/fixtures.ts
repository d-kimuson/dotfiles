import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { ContentKind } from '../content.ts'
import { CONTENT_SPECS } from '../content.ts'

export type FixtureEntry = {
  kind: ContentKind
  name: string
  /** undefined: name/description を自動生成, null: frontmatter なし */
  frontmatter?: Record<string, string> | null
  body?: string
  /** false にすると README.md を作らない。 */
  readme?: boolean
  /** 本文ファイルを作らない。 */
  omitFile?: boolean
}

export type FixturePrompt = {
  /** 拡張子を除いたファイル名。 */
  name: string
  content: string
}

/** verify が models.json を必須にしているので、未指定のときに置く正しい設定。 */
export const DEFAULT_MODELS_CONFIG = JSON.stringify({
  kinds: [{ name: 'worker', description: '実装担当', candidates: ['claude-code:claude-opus-5-5:high'] }],
  efforts: { 'claude-opus-5-5': ['low', 'high'] },
})

export type FixtureOptions = {
  /** `.agents/config/models.json` の内容。未指定なら正しい既定の設定 (`DEFAULT_MODELS_CONFIG`)、`null` ならファイルを作らない。 */
  modelsConfig?: string | null
  /** `.agents/providers.json` の内容。未指定ならファイルを作らない (マシン固有のローカルファイルなので)。 */
  providersConfig?: string
}

export type HarnessFixture = {
  root: string
  cleanup: () => void
}

/** テスト用の harness ディレクトリを作る。 */
export function createHarnessFixture(
  entries: FixtureEntry[] = [],
  prompts: FixturePrompt[] = [],
  options: FixtureOptions = {},
): HarnessFixture {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-'))
  mkdirSync(join(root, '.agents'), { recursive: true })

  for (const entry of entries) {
    const spec = CONTENT_SPECS[entry.kind]
    const dir = join(root, '.agents', spec.dirName, entry.name)
    mkdirSync(dir, { recursive: true })

    if (entry.omitFile !== true) {
      const frontmatter =
        entry.frontmatter === undefined
          ? { name: entry.name, description: `${entry.name} の説明` }
          : entry.frontmatter
      const header =
        frontmatter === null
          ? ''
          : `---\n${Object.entries(frontmatter)
              .map(([key, value]) => `${key}: ${value}`)
              .join('\n')}\n---\n\n`
      writeFileSync(join(dir, spec.fileName), `${header}${entry.body ?? '# Body\n'}`)
    }

    if (entry.readme !== false) {
      writeFileSync(join(dir, 'README.md'), `# ${entry.name}\n`)
    }
  }

  for (const prompt of prompts) {
    const dir = join(root, '.agents', 'prompts')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, `${prompt.name}.md`), prompt.content)
  }

  const modelsConfig = options.modelsConfig === undefined ? DEFAULT_MODELS_CONFIG : options.modelsConfig
  if (modelsConfig !== null) {
    mkdirSync(join(root, '.agents', 'config'), { recursive: true })
    writeFileSync(join(root, '.agents', 'config', 'models.json'), modelsConfig)
  }

  if (options.providersConfig !== undefined) {
    writeFileSync(join(root, '.agents', 'providers.json'), options.providersConfig)
  }

  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
}
