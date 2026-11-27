import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createHarnessFixture } from './testing/fixtures.ts'
import { verifyHarness } from './verify.ts'

test('正しい構造なら ok', () => {
  const fixture = createHarnessFixture([
    { kind: 'playbook', name: 'sample' },
    { kind: 'principle', name: 'sample-principle' },
  ])

  try {
    const report = verifyHarness(fixture.root)

    assert.equal(report.ok, true)
    // playbook と principle に、必須の models.json を加えた数
    assert.equal(report.checked, 3)
    assert.equal(report.errorCount, 0)
    assert.equal(report.warningCount, 0)
  } finally {
    fixture.cleanup()
  }
})

test('README.md 欠如は error', () => {
  const fixture = createHarnessFixture([{ kind: 'playbook', name: 'sample', readme: false }])

  try {
    const report = verifyHarness(fixture.root)
    const issue = report.issues.find((candidate) => candidate.code === 'missing-file')

    assert.equal(report.ok, false)
    assert.equal(issue?.file, 'README.md')
    assert.equal(issue?.severity, 'error')
  } finally {
    fixture.cleanup()
  }
})

test('本文ファイル欠如は error', () => {
  const fixture = createHarnessFixture([{ kind: 'playbook', name: 'sample', omitFile: true }])

  try {
    const report = verifyHarness(fixture.root)

    assert.equal(report.ok, false)
    assert.ok(report.issues.some((issue) => issue.file === 'PLAYBOOK.md' && issue.code === 'missing-file'))
  } finally {
    fixture.cleanup()
  }
})

test('frontmatter がない場合は error', () => {
  const fixture = createHarnessFixture([{ kind: 'playbook', name: 'sample', frontmatter: null }])

  try {
    const report = verifyHarness(fixture.root)

    assert.equal(report.ok, false)
    assert.ok(report.issues.some((issue) => issue.code === 'missing-frontmatter'))
  } finally {
    fixture.cleanup()
  }
})

test('description 欠如は error', () => {
  const fixture = createHarnessFixture([
    { kind: 'playbook', name: 'sample', frontmatter: { name: 'sample' } },
  ])

  try {
    const report = verifyHarness(fixture.root)

    assert.equal(report.ok, false)
    assert.ok(report.issues.some((issue) => issue.code === 'missing-description'))
  } finally {
    fixture.cleanup()
  }
})

test('name がディレクトリ名と違う場合は warning（exit 0 相当）', () => {
  const fixture = createHarnessFixture([
    { kind: 'playbook', name: 'sample', frontmatter: { name: 'other', description: '説明' } },
    { kind: 'principle', name: 'sample-principle' },
  ])

  try {
    const report = verifyHarness(fixture.root)

    assert.equal(report.ok, true)
    assert.equal(report.warningCount, 1)
    assert.ok(report.issues.some((issue) => issue.code === 'name-mismatch'))
  } finally {
    fixture.cleanup()
  }
})

test('本文が空なら warning', () => {
  const fixture = createHarnessFixture([{ kind: 'playbook', name: 'sample', body: '' }])

  try {
    const report = verifyHarness(fixture.root)

    assert.equal(report.ok, true)
    assert.ok(report.issues.some((issue) => issue.code === 'empty-body'))
  } finally {
    fixture.cleanup()
  }
})

test('playbooks/principles ディレクトリがない場合は warning のみ', () => {
  const fixture = createHarnessFixture([])

  try {
    const report = verifyHarness(fixture.root)

    assert.equal(report.ok, true)
    // 数えるのは必須の models.json だけ
    assert.equal(report.checked, 1)
    assert.equal(report.warningCount, 2)
  } finally {
    fixture.cleanup()
  }
})

const PROMPT_HEADER = '---\nname: sample\ndescription: sample の説明\n---\n\n'

test('prompt が $ARGUMENTS の区切りで終わっていれば ok', () => {
  const fixture = createHarnessFixture(
    [],
    [{ name: 'sample', content: `${PROMPT_HEADER}指示。\n\n---\n\n$ARGUMENTS\n` }],
  )

  try {
    const report = verifyHarness(fixture.root)

    assert.equal(report.errorCount, 0)
    assert.ok(report.entries.some((entry) => entry.kind === 'prompt' && entry.name === 'sample'))
  } finally {
    fixture.cleanup()
  }
})

test('prompt の末尾に $ARGUMENTS の区切りがなければ error', () => {
  const fixture = createHarnessFixture(
    [],
    [
      { name: 'missing', content: `${PROMPT_HEADER}指示。\n` },
      { name: 'inline', content: `${PROMPT_HEADER}指示。引数: $ARGUMENTS\n` },
      { name: 'not-last', content: `${PROMPT_HEADER}指示。\n\n---\n\n$ARGUMENTS\n\n補足。\n` },
      { name: 'twice', content: `${PROMPT_HEADER}$ARGUMENTS を使う。\n\n---\n\n$ARGUMENTS\n` },
    ],
  )

  try {
    const report = verifyHarness(fixture.root)
    const flagged = report.issues
      .filter((issue) => issue.code === 'missing-arguments-footer')
      .map((issue) => issue.entry)
      .sort()

    assert.equal(report.ok, false)
    assert.deepEqual(flagged, ['inline', 'missing', 'not-last', 'twice'])
  } finally {
    fixture.cleanup()
  }
})

const VALID_MODELS = JSON.stringify({
  kinds: [{ name: 'worker', description: '実装担当', candidates: ['pi:opencode-go/b:high'] }],
  efforts: { b: ['low', 'high'] },
})

test('models 設定が正しければ ok で、検証対象に数えられる', () => {
  const fixture = createHarnessFixture([], [], { modelsConfig: VALID_MODELS })

  try {
    const report = verifyHarness(fixture.root)

    assert.equal(report.errorCount, 0)
    assert.deepEqual(report.issues.filter((issue) => issue.kind === 'models'), [])
    assert.ok(report.entries.some((entry) => entry.kind === 'models' && entry.path === 'config/models.json'))
  } finally {
    fixture.cleanup()
  }
})

test('models 設定がなければ error (必須)', () => {
  const fixture = createHarnessFixture([], [], { modelsConfig: null })

  try {
    const report = verifyHarness(fixture.root)
    const issue = report.issues.find((candidate) => candidate.kind === 'models')

    assert.equal(report.ok, false)
    assert.equal(issue?.severity, 'error')
    assert.equal(issue?.code, 'missing-file')
    assert.equal(issue?.file, 'config/models.json')
    assert.deepEqual(
      report.entries.find((entry) => entry.kind === 'models')?.files,
      [{ fileName: 'config/models.json', exists: false }],
    )
  } finally {
    fixture.cleanup()
  }
})

test('provider が決まらない候補は error で、種類名と候補を示す', () => {
  const fixture = createHarnessFixture([], [], {
    modelsConfig: JSON.stringify({
      kinds: [
        { name: 'worker', description: '実装担当', candidates: ['claude-code:a:high', 'pi:zai/b:high'] },
        { name: 'scout', description: '探索', candidates: ['codex:c:low'] },
      ],
      efforts: { a: ['high'], b: ['high'], c: ['low'] },
    }),
  })

  try {
    const report = verifyHarness(fixture.root)
    const issues = report.issues.filter((issue) => issue.kind === 'models')

    assert.equal(report.ok, false)
    assert.deepEqual(
      issues.map((issue) => issue.code),
      ['unknown-candidate-provider', 'unknown-candidate-provider'],
    )
    assert.match(issues[0]?.message ?? '', /worker/)
    assert.match(issues[0]?.message ?? '', /pi:zai\/b:high/)
    assert.match(issues[1]?.message ?? '', /codex:c:low/)
  } finally {
    fixture.cleanup()
  }
})

test('providers.json がなくても verify は通り、警告も出さない (ローカルファイルなので)', () => {
  const fixture = createHarnessFixture([
    { kind: 'playbook', name: 'sample' },
    { kind: 'principle', name: 'sample-principle' },
  ])

  try {
    const report = verifyHarness(fixture.root)

    assert.equal(report.ok, true)
    assert.equal(report.warningCount, 0)
    assert.ok(!report.entries.some((entry) => entry.kind === 'providers'))
  } finally {
    fixture.cleanup()
  }
})

test('providers.json があれば検証し、正しければ検証対象に数える', () => {
  const fixture = createHarnessFixture([], [], { providersConfig: '{ "providers": ["claude-code", "openai-codex"] }' })

  try {
    const report = verifyHarness(fixture.root)

    assert.equal(report.ok, true)
    assert.ok(report.entries.some((entry) => entry.kind === 'providers' && entry.path === 'state/providers.json'))
  } finally {
    fixture.cleanup()
  }
})

test('providers.json が不正なら error', () => {
  const fixture = createHarnessFixture([], [], { providersConfig: '{ "providers": ["gemini", "openai-codex", "openai-codex"] }' })

  try {
    const report = verifyHarness(fixture.root)
    const codes = report.issues.filter((issue) => issue.kind === 'providers').map((issue) => issue.code)

    assert.equal(report.ok, false)
    assert.deepEqual(codes.sort(), ['duplicate-provider', 'unknown-provider'])
  } finally {
    fixture.cleanup()
  }
})

test('models 設定の候補の書式違反と空の候補リストは error', () => {
  const fixture = createHarnessFixture([], [], {
    modelsConfig: JSON.stringify({
      kinds: [
        { name: 'worker', description: '実装担当', candidates: ['pi:opencode-go/a:Ultra'] },
        { name: 'scout', description: '探索', candidates: [] },
      ],
    }),
  })

  try {
    const report = verifyHarness(fixture.root)
    const codes = report.issues.filter((issue) => issue.kind === 'models').map((issue) => issue.code)

    assert.equal(report.ok, false)
    assert.deepEqual(codes.sort(), ['empty-candidates', 'invalid-candidate'])
  } finally {
    fixture.cleanup()
  }
})

test('models 設定の effort がモデルの一覧にない値なら error', () => {
  const fixture = createHarnessFixture([], [], {
    modelsConfig: JSON.stringify({
      kinds: [{ name: 'worker', description: '実装担当', candidates: ['pi:opencode-go/b:xhigh'] }],
      efforts: { b: ['low', 'high'] },
    }),
  })

  try {
    const report = verifyHarness(fixture.root)
    const issue = report.issues.find((candidate) => candidate.kind === 'models')

    assert.equal(report.ok, false)
    assert.equal(issue?.severity, 'error')
    assert.equal(issue?.code, 'unsupported-effort')
  } finally {
    fixture.cleanup()
  }
})

test('models 設定に effort の一覧がないモデルは warning で、verify は通る', () => {
  const fixture = createHarnessFixture([], [], {
    modelsConfig: JSON.stringify({
      kinds: [{ name: 'worker', description: '実装担当', candidates: ['pi:opencode-go/b:high'] }],
    }),
  })

  try {
    const report = verifyHarness(fixture.root)
    const issues = report.issues.filter((candidate) => candidate.kind === 'models')

    assert.equal(report.ok, true)
    assert.equal(report.errorCount, 0)
    assert.deepEqual(
      issues.map((issue) => [issue.severity, issue.code]),
      [['warning', 'unknown-model-efforts']],
    )
  } finally {
    fixture.cleanup()
  }
})

test('models 設定が JSON として不正なら error', () => {
  const fixture = createHarnessFixture([], [], { modelsConfig: '{' })

  try {
    const report = verifyHarness(fixture.root)

    assert.equal(report.ok, false)
    assert.ok(report.issues.some((issue) => issue.kind === 'models' && issue.code === 'invalid-json'))
  } finally {
    fixture.cleanup()
  }
})

function principleFixture(playbookFrontmatter: Record<string, string>) {
  return createHarnessFixture([
    { kind: 'playbook', name: 'sample' },
    { kind: 'playbook', name: 'dev', frontmatter: { name: 'dev', description: 'dev の説明', ...playbookFrontmatter } },
    { kind: 'principle', name: 'alpha' },
    { kind: 'principle', name: 'beta' },
  ])
}

test('principle も README.md と frontmatter を検証する', () => {
  const fixture = createHarnessFixture([
    { kind: 'playbook', name: 'sample' },
    { kind: 'principle', name: 'broken', readme: false, frontmatter: { name: 'broken' } },
  ])

  try {
    const report = verifyHarness(fixture.root)
    const codes = report.issues.filter((issue) => issue.kind === 'principle').map((issue) => issue.code)

    assert.equal(report.ok, false)
    assert.deepEqual(codes.sort(), ['missing-description', 'missing-file'])
  } finally {
    fixture.cleanup()
  }
})

test('playbook が実在する principle だけを参照していれば ok', () => {
  const fixture = principleFixture({ principles: '[alpha, beta]' })

  try {
    const report = verifyHarness(fixture.root)

    assert.equal(report.ok, true)
    assert.equal(report.warningCount, 0)
  } finally {
    fixture.cleanup()
  }
})

test('playbook が存在しない principle を参照していれば error で、名前を示す', () => {
  const fixture = principleFixture({ principles: '[alpha, missing]' })

  try {
    const report = verifyHarness(fixture.root)
    const issue = report.issues.find((candidate) => candidate.code === 'unknown-principle')

    assert.equal(report.ok, false)
    assert.equal(issue?.severity, 'error')
    assert.equal(issue?.kind, 'playbook')
    assert.equal(issue?.entry, 'dev')
    assert.match(issue?.message ?? '', /missing/)
  } finally {
    fixture.cleanup()
  }
})

test('principle のディレクトリはあっても PRINCIPLE.md がなければ参照は unknown-principle', () => {
  const fixture = createHarnessFixture([
    { kind: 'playbook', name: 'dev', frontmatter: { name: 'dev', description: 'd', principles: '[alpha]' } },
    { kind: 'principle', name: 'alpha', omitFile: true },
  ])

  try {
    const report = verifyHarness(fixture.root)

    assert.ok(report.issues.some((issue) => issue.code === 'unknown-principle'))
  } finally {
    fixture.cleanup()
  }
})

test('principles が不正な書式なら invalid-principles', () => {
  for (const principles of ['alpha', '[alpha, alpha]', '[Alpha]', '[]x']) {
    const fixture = principleFixture({ principles })

    try {
      const report = verifyHarness(fixture.root)

      assert.equal(report.ok, false, principles)
      assert.ok(
        report.issues.some((issue) => issue.kind === 'playbook' && issue.code === 'invalid-principles'),
        principles,
      )
    } finally {
      fixture.cleanup()
    }
  }
})

test('principles: [] は空のリストとして許す', () => {
  const fixture = principleFixture({ principles: '[]' })

  try {
    const report = verifyHarness(fixture.root)

    assert.equal(report.ok, true)
  } finally {
    fixture.cleanup()
  }
})
