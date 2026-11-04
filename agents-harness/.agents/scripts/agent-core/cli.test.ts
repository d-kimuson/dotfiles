import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import type { CliIo } from './cli.ts'
import { resolveCommand, run } from './cli.ts'
import { createRootCommand } from './command-set.ts'
import { createHarnessFixture } from './testing/fixtures.ts'

type TestIo = CliIo & {
  outText: () => string
  errText: () => string
}

function createIo(cwd: string, env: Record<string, string | undefined> = { HOME: cwd }): TestIo {
  let out = ''
  let err = ''
  return {
    cwd,
    env,
    out: (text) => {
      out += text
    },
    err: (text) => {
      err += text
    },
    outText: () => out,
    errText: () => err,
  }
}

function createFixture(): ReturnType<typeof createHarnessFixture> {
  return createHarnessFixture([
    { kind: 'playbook', name: 'alpha', body: '# Alpha\nnpm publish\n' },
    { kind: 'playbook', name: 'beta', body: '# Beta\n' },
    { kind: 'role', name: 'gamma', body: '# Gamma\n' },
    { kind: 'principle', name: 'delta', body: '# Delta\n\n検証してから完了と言う\n' },
  ])
}

test('サブコマンドを解決してオプションを集める', () => {
  const resolved = resolveCommand(createRootCommand(), [
    'playbooks',
    'list',
    '--page',
    '2',
    '--per-page=5',
  ])

  assert.equal(resolved.command.name, 'list')
  assert.deepEqual(
    resolved.path.map((command) => command.name),
    ['agent-core', 'playbooks', 'list'],
  )
  assert.equal(resolved.options.get('page'), '2')
  assert.equal(resolved.options.get('per-page'), '5')
})

test('--help は対象コマンドの help を出す', async () => {
  const io = createIo(process.cwd())
  const code = await run(['playbooks', 'search', '--help'], io)

  assert.equal(code, 0)
  assert.match(io.outText(), /agent-core playbooks search <query\.\.\.> \[options\]/)
  assert.match(io.outText(), /--per-page/)
})

test('list はページネーション付きで一覧する', async () => {
  const fixture = createFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['playbooks', 'list', '--per-page', '1', '--page', '1'], io)

    assert.equal(code, 0)
    assert.match(io.outText(), /2 playbooks · page 1\/2/)
    assert.match(io.outText(), /alpha/)
    assert.doesNotMatch(io.outText(), /beta/)
    assert.match(io.outText(), /--page 2/)
  } finally {
    fixture.cleanup()
  }
})

test('list の範囲外ページは exit 2', async () => {
  const fixture = createFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['playbooks', 'list', '--page', '99'], io)

    assert.equal(code, 2)
    assert.match(io.errText(), /--page が範囲外です/)
  } finally {
    fixture.cleanup()
  }
})

test('未知のオプションは exit 2', async () => {
  const fixture = createFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['playbooks', 'list', '--unknown'], io)

    assert.equal(code, 2)
    assert.match(io.errText(), /不明なオプションです/)
  } finally {
    fixture.cleanup()
  }
})

test('search はクエリ必須', async () => {
  const fixture = createFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['playbooks', 'search'], io)

    assert.equal(code, 2)
    assert.match(io.errText(), /検索クエリを指定してください/)
  } finally {
    fixture.cleanup()
  }
})

test('search は AND で絞り込む', async () => {
  const fixture = createFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['playbooks', 'search', 'npm', 'publish'], io)

    assert.equal(code, 0)
    assert.match(io.outText(), /alpha/)
    assert.doesNotMatch(io.outText(), /beta/)
  } finally {
    fixture.cleanup()
  }
})

test('prompt は本文だけを出力する', async () => {
  const fixture = createFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['prompt', 'gamma'], io)

    assert.equal(code, 0)
    assert.equal(io.outText(), '# Gamma\n')
  } finally {
    fixture.cleanup()
  }
})

test('prompt --with-frontmatter は元ファイルを出力する', async () => {
  const fixture = createFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['prompt', 'gamma', '--with-frontmatter'], io)

    assert.equal(code, 0)
    assert.match(io.outText(), /^---\nname: gamma/)
  } finally {
    fixture.cleanup()
  }
})

test('prompt --type で探索対象を限定する', async () => {
  const fixture = createFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['prompt', 'gamma', '--type', 'playbook'], io)

    assert.equal(code, 1)
    assert.match(io.errText(), /プロンプトが見つかりません/)
  } finally {
    fixture.cleanup()
  }
})

test('roles use は本文だけを出力する', async () => {
  const fixture = createFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['roles', 'use', 'gamma'], io)

    assert.equal(code, 0)
    assert.equal(io.outText(), '# Gamma\n')
  } finally {
    fixture.cleanup()
  }
})

test('playbooks use も本文だけを出力する', async () => {
  const fixture = createFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['playbooks', 'use', 'alpha'], io)

    assert.equal(code, 0)
    assert.equal(io.outText(), '# Alpha\nnpm publish\n')
  } finally {
    fixture.cleanup()
  }
})

test('roles use は名前必須', async () => {
  const fixture = createFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['roles', 'use'], io)

    assert.equal(code, 2)
    assert.match(io.errText(), /role名を指定してください: agent-core roles use <name>/)
  } finally {
    fixture.cleanup()
  }
})

test('roles use は playbook を解決しない', async () => {
  const fixture = createFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['roles', 'use', 'alpha'], io)

    assert.equal(code, 1)
    assert.match(io.errText(), /roleが見つかりません: alpha \(探索: roles\)/)
  } finally {
    fixture.cleanup()
  }
})

test('roles use --json はメタデータ付きで出力する', async () => {
  const fixture = createFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['roles', 'use', 'gamma', '--json'], io)
    const parsed = JSON.parse(io.outText()) as { kind: string; name: string; body: string; frontmatter: Record<string, string> }

    assert.equal(code, 0)
    assert.equal(parsed.kind, 'role')
    assert.equal(parsed.name, 'gamma')
    assert.equal(parsed.body, '# Gamma\n')
    assert.equal(parsed.frontmatter.name, 'gamma')
  } finally {
    fixture.cleanup()
  }
})

test('prompt の不正な --type は exit 2', async () => {
  const fixture = createFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['prompt', 'gamma', '--type', 'nope'], io)

    assert.equal(code, 2)
    assert.match(io.errText(), /--type は/)
  } finally {
    fixture.cleanup()
  }
})

test('存在しないプロンプトは exit 1', async () => {
  const fixture = createFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['prompt', 'missing'], io)

    assert.equal(code, 1)
    assert.match(io.errText(), /プロンプトが見つかりません/)
  } finally {
    fixture.cleanup()
  }
})

test('verify は正常系で exit 0', async () => {
  const fixture = createFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['verify'], io)

    assert.equal(code, 0)
    assert.match(io.outText(), /5 entries · 0 errors · 0 warnings/)
  } finally {
    fixture.cleanup()
  }
})

test('verify はエラーで exit 1', async () => {
  const fixture = createHarnessFixture([{ kind: 'playbook', name: 'sample', readme: false }])
  try {
    const io = createIo(fixture.root)
    const code = await run(['verify'], io)

    assert.equal(code, 1)
    assert.match(io.outText(), /README\.md/)
  } finally {
    fixture.cleanup()
  }
})

test('verify --json は機械可読な結果を出す', async () => {
  const fixture = createFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['verify', '--json'], io)
    const parsed = JSON.parse(io.outText()) as { ok: boolean; checked: number }

    assert.equal(code, 0)
    assert.equal(parsed.ok, true)
    assert.equal(parsed.checked, 5)
  } finally {
    fixture.cleanup()
  }
})

test('--root で harness root を明示できる', async () => {
  const fixture = createFixture()
  try {
    const io = createIo(process.cwd(), {})
    const code = await run(['--root', fixture.root, 'roles', 'list'], io)

    assert.equal(code, 0)
    assert.match(io.outText(), /gamma/)
  } finally {
    fixture.cleanup()
  }
})

test('既定の per-page は 10', async () => {
  const fixture = createFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['playbooks', 'list'], io)

    assert.equal(code, 0)
    assert.match(io.outText(), /\(10 per page\)/)
  } finally {
    fixture.cleanup()
  }
})

function createPrinciplesFixture(rolePrinciples: string | undefined): ReturnType<typeof createHarnessFixture> {
  return createHarnessFixture([
    {
      kind: 'role',
      name: 'dev',
      frontmatter: {
        name: 'dev',
        description: 'dev の説明',
        ...(rolePrinciples === undefined ? {} : { principles: rolePrinciples }),
      },
      body: '# Dev\n\n役割の本文\n',
    },
    { kind: 'principle', name: 'alpha', body: '# Alpha\n\nA の本文\n' },
    { kind: 'principle', name: 'beta', body: '# Beta\n\nB の本文\n' },
  ])
}

test('principles list は principle を一覧する', async () => {
  const fixture = createPrinciplesFixture(undefined)
  try {
    const io = createIo(fixture.root)
    const code = await run(['principles', 'list'], io)

    assert.equal(code, 0)
    assert.match(io.outText(), /2 principles/)
    assert.match(io.outText(), /alpha/)
    assert.match(io.outText(), /beta/)
  } finally {
    fixture.cleanup()
  }
})

test('principles search は本文を全文検索する', async () => {
  const fixture = createPrinciplesFixture(undefined)
  try {
    const io = createIo(fixture.root)
    const code = await run(['principles', 'search', 'B', '本文'], io)

    assert.equal(code, 0)
    assert.match(io.outText(), /beta/)
    assert.doesNotMatch(io.outText(), /alpha/)
  } finally {
    fixture.cleanup()
  }
})

test('principles use は本文だけを出力する', async () => {
  const fixture = createPrinciplesFixture(undefined)
  try {
    const io = createIo(fixture.root)
    const code = await run(['principles', 'use', 'alpha'], io)

    assert.equal(code, 0)
    assert.equal(io.outText(), '# Alpha\n\nA の本文\n')
  } finally {
    fixture.cleanup()
  }
})

test('principles use は存在しない principle を exit 1 にする', async () => {
  const fixture = createPrinciplesFixture(undefined)
  try {
    const io = createIo(fixture.root)
    const code = await run(['principles', 'use', 'nope'], io)

    assert.equal(code, 1)
    assert.match(io.errText(), /principleが見つかりません: nope \(探索: principles\)/)
  } finally {
    fixture.cleanup()
  }
})

test('roles use は role 本文の後ろに推奨する principle の全文を、書いた順に続ける', async () => {
  const fixture = createPrinciplesFixture('[beta, alpha]')
  try {
    const io = createIo(fixture.root)
    const code = await run(['roles', 'use', 'dev'], io)
    const text = io.outText()

    assert.equal(code, 0)
    assert.ok(text.startsWith('# Dev\n\n役割の本文\n'))
    const beta = text.indexOf('<principle name="beta">')
    const alpha = text.indexOf('<principle name="alpha">')
    assert.ok(beta > 0 && alpha > beta, text)
    assert.match(text, /B の本文/)
    assert.match(text, /A の本文/)
    assert.doesNotMatch(text, /^name: /m)
  } finally {
    fixture.cleanup()
  }
})

test('roles use は block 形式の principles も読む', async () => {
  const fixture = createHarnessFixture([
    { kind: 'role', name: 'dev', frontmatter: null, body: '# Dev\n' },
    { kind: 'principle', name: 'alpha', body: '# Alpha\n' },
  ])
  try {
    writeFileSync(
      join(fixture.root, '.agents', 'roles', 'dev', 'ROLE.md'),
      '---\nname: dev\ndescription: d\nprinciples:\n  - alpha\n---\n\n# Dev\n',
    )
    const io = createIo(fixture.root)
    const code = await run(['roles', 'use', 'dev'], io)

    assert.equal(code, 0)
    assert.match(io.outText(), /<principle name="alpha">\n# Alpha\n<\/principle>/)
  } finally {
    fixture.cleanup()
  }
})

test('roles use は principles のない role を本文のまま出す', async () => {
  const fixture = createPrinciplesFixture(undefined)
  try {
    const io = createIo(fixture.root)
    const code = await run(['roles', 'use', 'dev'], io)

    assert.equal(code, 0)
    assert.equal(io.outText(), '# Dev\n\n役割の本文\n')
  } finally {
    fixture.cleanup()
  }
})

test('roles use は存在しない principle の参照を exit 1 にし、何も出力しない', async () => {
  const fixture = createPrinciplesFixture('[alpha, missing]')
  try {
    const io = createIo(fixture.root)
    const code = await run(['roles', 'use', 'dev'], io)

    assert.equal(code, 1)
    assert.equal(io.outText(), '')
    assert.match(io.errText(), /principles\/missing/)
  } finally {
    fixture.cleanup()
  }
})

test('roles use --json は body を role のものに保ち、principles を別に持つ', async () => {
  const fixture = createPrinciplesFixture('[alpha]')
  try {
    const io = createIo(fixture.root)
    const code = await run(['roles', 'use', 'dev', '--json'], io)
    const parsed = JSON.parse(io.outText()) as { body: string; principles: { name: string; path: string; body: string }[] }

    assert.equal(code, 0)
    assert.equal(parsed.body, '# Dev\n\n役割の本文\n')
    assert.deepEqual(parsed.principles, [{ name: 'alpha', path: 'principles/alpha', body: '# Alpha\n\nA の本文\n' }])
  } finally {
    fixture.cleanup()
  }
})

test('prompt <role> も推奨する principle を続け、--with-frontmatter は元ファイルだけを出す', async () => {
  const fixture = createPrinciplesFixture('[alpha]')
  try {
    const expanded = createIo(fixture.root)
    assert.equal(await run(['prompt', 'dev'], expanded), 0)
    assert.match(expanded.outText(), /<principle name="alpha">/)

    const raw = createIo(fixture.root)
    assert.equal(await run(['prompt', 'dev', '--with-frontmatter'], raw), 0)
    assert.match(raw.outText(), /^---\nname: dev/)
    assert.doesNotMatch(raw.outText(), /<principle/)
  } finally {
    fixture.cleanup()
  }
})

test('principles は help に載る', async () => {
  const io = createIo(process.cwd())
  const code = await run(['--help'], io)

  assert.equal(code, 0)
  assert.match(io.outText(), /^\s+principles\s/m)
})

const MODELS_CONFIG = JSON.stringify({
  kinds: [
    {
      name: 'worker',
      description: '実装担当',
      candidates: ['command-code:deepseek-v4.1-flash:high', 'pi:opencode-go/deepseek-v4.1-flash:high'],
    },
    {
      name: 'arbiter',
      description: '重要な判断だけ',
      conditions: ['条件 A', '条件 B'],
      candidates: ['pi:openai-codex/gpt-6-astra:xhigh'],
    },
  ],
  efforts: {
    'deepseek-v4.1-flash': ['low', 'high', 'max'],
    'gpt-6-astra': ['low', 'medium', 'high', 'xhigh', 'max'],
  },
})

const ALL_PROVIDERS = JSON.stringify({ providers: ['claude-code', 'opencode-go', 'openai-codex', 'command-code'] })

function createModelsFixture(
  providersConfig: string | undefined = ALL_PROVIDERS,
): ReturnType<typeof createHarnessFixture> {
  return createHarnessFixture([], [], { modelsConfig: MODELS_CONFIG, providersConfig })
}

test('models list は全種類を設定の順に出し、候補を優先順の表にする', async () => {
  const fixture = createModelsFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['models', 'list'], io)
    const text = io.outText()

    assert.equal(code, 0)
    assert.ok(text.indexOf('worker') < text.indexOf('arbiter'))
    assert.match(text, /実装担当/)
    assert.match(text, /重要な判断だけ/)
    assert.match(text, /- 条件 A/)
    assert.match(text, /- 条件 B/)
    assert.match(text, /1\s+command-code\s+deepseek-v4\.1-flash\s+high/)
    assert.match(text, /2\s+pi\s+opencode-go\/deepseek-v4\.1-flash\s+high/)
    assert.match(text, /1\s+pi\s+openai-codex\/gpt-6-astra\s+xhigh/)
  } finally {
    fixture.cleanup()
  }
})

test('models list <kind> は指定した種類だけを出す', async () => {
  const fixture = createModelsFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['models', 'list', 'arbiter'], io)

    assert.equal(code, 0)
    assert.match(io.outText(), /重要な判断だけ/)
    assert.match(io.outText(), /gpt-6-astra/)
    assert.doesNotMatch(io.outText(), /実装担当/)
    assert.doesNotMatch(io.outText(), /command-code/)
  } finally {
    fixture.cleanup()
  }
})

test('models list --json は分解済みの候補を優先順で出す', async () => {
  const fixture = createModelsFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['models', 'list', 'worker', '--json'], io)
    const payload: unknown = JSON.parse(io.outText())

    assert.equal(code, 0)
    assert.deepEqual(payload, {
      kinds: [
        {
          name: 'worker',
          description: '実装担当',
          conditions: [],
          candidates: [
            {
              spec: 'command-code:deepseek-v4.1-flash:high',
              runtime: 'command-code',
              model: 'deepseek-v4.1-flash',
              effort: 'high',
            },
            {
              spec: 'pi:opencode-go/deepseek-v4.1-flash:high',
              runtime: 'pi',
              model: 'opencode-go/deepseek-v4.1-flash',
              effort: 'high',
            },
          ],
        },
      ],
    })
  } finally {
    fixture.cleanup()
  }
})

test('models list の存在しない種類は exit 2 で選択肢を示す', async () => {
  const fixture = createModelsFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['models', 'list', 'nope'], io)

    assert.equal(code, 2)
    assert.match(io.errText(), /nope/)
    assert.match(io.errText(), /worker, arbiter/)
  } finally {
    fixture.cleanup()
  }
})

test('models list は種類を 2 つ以上受け取らない', async () => {
  const fixture = createModelsFixture()
  try {
    const io = createIo(fixture.root)
    const code = await run(['models', 'list', 'worker', 'arbiter'], io)

    assert.equal(code, 2)
  } finally {
    fixture.cleanup()
  }
})

test('models list は設定ファイルがなければ exit 1', async () => {
  const fixture = createHarnessFixture([], [], { modelsConfig: null, providersConfig: ALL_PROVIDERS })
  try {
    const io = createIo(fixture.root)
    const code = await run(['models', 'list'], io)

    assert.equal(code, 1)
    assert.match(io.errText(), /config\/models\.json/)
  } finally {
    fixture.cleanup()
  }
})

test('models list は effort の一覧がないモデルを warning として stderr に出し、一覧は出す', async () => {
  const fixture = createHarnessFixture([], [], {
    modelsConfig: JSON.stringify({
      kinds: [{ name: 'worker', description: '実装担当', candidates: ['pi:opencode-go/new-model:high'] }],
    }),
    providersConfig: ALL_PROVIDERS,
  })
  try {
    const io = createIo(fixture.root)
    const code = await run(['models', 'list'], io)

    assert.equal(code, 0)
    assert.match(io.outText(), /new-model/)
    assert.match(io.errText(), /warning/)
    assert.match(io.errText(), /new-model/)
  } finally {
    fixture.cleanup()
  }
})

test('models list は --json でも warning を stderr に出し、stdout は JSON のまま', async () => {
  const fixture = createHarnessFixture([], [], {
    modelsConfig: JSON.stringify({
      kinds: [{ name: 'worker', description: '実装担当', candidates: ['pi:opencode-go/new-model:high'] }],
    }),
    providersConfig: ALL_PROVIDERS,
  })
  try {
    const io = createIo(fixture.root)
    const code = await run(['models', 'list', '--json'], io)

    assert.equal(code, 0)
    assert.doesNotThrow(() => JSON.parse(io.outText()))
    assert.match(io.errText(), /new-model/)
  } finally {
    fixture.cleanup()
  }
})

test('models list は effort が一覧にない値なら exit 1 で理由を示す', async () => {
  const fixture = createHarnessFixture([], [], {
    modelsConfig: JSON.stringify({
      kinds: [{ name: 'worker', description: '実装担当', candidates: ['pi:opencode-go/m:xhigh'] }],
      efforts: { m: ['low', 'high'] },
    }),
    providersConfig: ALL_PROVIDERS,
  })
  try {
    const io = createIo(fixture.root)
    const code = await run(['models', 'list'], io)

    assert.equal(code, 1)
    assert.match(io.errText(), /xhigh/)
  } finally {
    fixture.cleanup()
  }
})

test('models list は設定が不正なら exit 1 で理由を示す', async () => {
  const fixture = createHarnessFixture([], [], {
    modelsConfig: JSON.stringify({ kinds: [{ name: 'worker', description: 'x', candidates: ['broken'] }] }),
    providersConfig: ALL_PROVIDERS,
  })
  try {
    const io = createIo(fixture.root)
    const code = await run(['models', 'list'], io)

    assert.equal(code, 1)
    assert.match(io.errText(), /broken/)
  } finally {
    fixture.cleanup()
  }
})

test('models list は providers.json の provider の候補だけを、優先順を保って出す (番号は残った候補で振り直す)', async () => {
  const fixture = createModelsFixture(JSON.stringify({ providers: ['opencode-go'] }))
  try {
    const io = createIo(fixture.root)
    const code = await run(['models', 'list', 'worker'], io)

    assert.equal(code, 0)
    assert.match(io.outText(), /1\s+pi\s+opencode-go\/deepseek-v4\.1-flash\s+high/)
    assert.doesNotMatch(io.outText(), /command-code/)
    assert.doesNotMatch(io.outText(), /候補なし/)
  } finally {
    fixture.cleanup()
  }
})

test('models list は候補がすべて外れた種類を「候補なし」として残す', async () => {
  const fixture = createModelsFixture(JSON.stringify({ providers: ['opencode-go'] }))
  try {
    const io = createIo(fixture.root)
    const code = await run(['models', 'list'], io)
    const text = io.outText()

    assert.equal(code, 0)
    assert.ok(text.indexOf('worker') < text.indexOf('arbiter'))
    assert.match(text, /重要な判断だけ/)
    assert.match(text, /候補なし/)
    assert.doesNotMatch(text, /gpt-6-astra/)
  } finally {
    fixture.cleanup()
  }
})

test('models list --json は外れた候補を除き、候補がなくなった種類は空配列で残す', async () => {
  const fixture = createModelsFixture(JSON.stringify({ providers: ['openai-codex'] }))
  try {
    const io = createIo(fixture.root)
    const code = await run(['models', 'list', '--json'], io)
    const payload = JSON.parse(io.outText()) as {
      kinds: { name: string; candidates: { spec: string }[] }[]
    }

    assert.equal(code, 0)
    assert.deepEqual(
      payload.kinds.map((kind) => [kind.name, kind.candidates.map((candidate) => candidate.spec)]),
      [
        ['worker', []],
        ['arbiter', ['pi:openai-codex/gpt-6-astra:xhigh']],
      ],
    )
  } finally {
    fixture.cleanup()
  }
})

test('models list は providers が空なら全種類を候補なしにする', async () => {
  const fixture = createModelsFixture(JSON.stringify({ providers: [] }))
  try {
    const io = createIo(fixture.root)
    const code = await run(['models', 'list'], io)

    assert.equal(code, 0)
    assert.equal(io.outText().match(/候補なし/g)?.length, 2)
  } finally {
    fixture.cleanup()
  }
})

test('models list は providers.json がなければ exit 1 で、playbook のコマンドと期待するパスを示す', async () => {
  const fixture = createHarnessFixture([], [], { modelsConfig: MODELS_CONFIG })
  try {
    const io = createIo(fixture.root)
    const code = await run(['models', 'list'], io)

    assert.equal(code, 1)
    assert.equal(io.outText(), '')
    assert.match(io.errText(), /providers\.json/)
    assert.ok(io.errText().includes(join(fixture.root, '.agents', 'providers.json')))
    assert.ok(io.errText().includes("~/.agents/scripts/agent-core.ts playbooks use 'configure-providers'"))
  } finally {
    fixture.cleanup()
  }
})

test('models list は --root が指す harness の providers.json を読む', async () => {
  const fixture = createModelsFixture()
  try {
    const io = createIo(tmpdir(), { HOME: tmpdir() })
    const code = await run(['--root', fixture.root, 'models', 'list', 'worker'], io)

    assert.equal(code, 0)
    assert.match(io.outText(), /command-code/)
  } finally {
    fixture.cleanup()
  }
})

test('models list は providers.json が不正なら exit 1 でパースエラーを示す', async () => {
  const fixture = createModelsFixture(JSON.stringify({ providers: ['gemini', 'openai-codex', 'openai-codex'] }))
  try {
    const io = createIo(fixture.root)
    const code = await run(['models', 'list'], io)

    assert.equal(code, 1)
    assert.match(io.errText(), /providers\.json/)
    assert.match(io.errText(), /gemini/)
    assert.match(io.errText(), /openai-codex/)
    assert.doesNotMatch(io.errText(), /playbooks use/)
  } finally {
    fixture.cleanup()
  }
})

test('models は help に載る', async () => {
  const io = createIo(process.cwd())
  const root = await run(['--help'], io)
  const sub = await run(['models', 'list', '--help'], io)

  assert.equal(root, 0)
  assert.equal(sub, 0)
  assert.match(io.outText(), /models/)
  assert.match(io.outText(), /agent-core models list \[kind\] \[options\]/)
})
