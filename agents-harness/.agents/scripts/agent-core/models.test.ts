import assert from 'node:assert/strict'
import { test } from 'node:test'

import { loadModelsConfig, parseCandidate, parseModelsConfig } from './models.ts'
import { createHarnessFixture } from './testing/fixtures.ts'

function config(kinds: unknown): string {
  return JSON.stringify({ kinds })
}

const VALID_KIND = { name: 'worker', description: '実装担当', candidates: ['pi:a/b:high'] }

test('候補は runtime / model / effort に分解される', () => {
  const result = parseCandidate('command-code:deepseek-v4.1-flash:high')

  assert.deepEqual(result, {
    ok: true,
    candidate: {
      spec: 'command-code:deepseek-v4.1-flash:high',
      runtime: 'command-code',
      model: 'deepseek-v4.1-flash',
      effort: 'high',
    },
  })
})

test('model に / を含む候補も分解できる', () => {
  const result = parseCandidate('pi:opencode-go/deepseek-v4.1-flash:low')

  assert.equal(result.ok && result.candidate.runtime, 'pi')
  assert.equal(result.ok && result.candidate.model, 'opencode-go/deepseek-v4.1-flash')
  assert.equal(result.ok && result.candidate.effort, 'low')
})

test('最初の : までが runtime、最後の : 以降が effort', () => {
  const result = parseCandidate('pi:vendor:model:xhigh')

  assert.equal(result.ok && result.candidate.runtime, 'pi')
  assert.equal(result.ok && result.candidate.model, 'vendor:model')
  assert.equal(result.ok && result.candidate.effort, 'xhigh')
})

test('不正な候補は理由付きで拒否される', () => {
  const invalid = [
    'pi:model',
    'pi',
    '',
    ':model:high',
    'pi::high',
    'pi:model:',
    'pi:model:High',
    'pi:model:hi gh',
    'Pi:model:high',
    'pi:mo del:high',
  ]

  for (const spec of invalid) {
    const result = parseCandidate(spec)
    assert.equal(result.ok, false, spec)
  }
})

test('effort の値そのものは書式だけを見て、使えるかどうかは efforts で検査する', () => {
  const result = parseCandidate('pi:model:ultra')

  assert.equal(result.ok && result.candidate.effort, 'ultra')
})

test('正しい設定は種類の順序と候補の優先順を保って読める', () => {
  const result = parseModelsConfig(
    config([
      { name: 'worker', description: '実装', candidates: ['pi:a:high', 'command-code:b:low'] },
      { name: 'judge', description: '判断', conditions: ['条件 1'], candidates: ['claude-code:c:high'] },
    ]),
  )

  assert.deepEqual(result.issues, [])
  assert.deepEqual(
    result.config?.kinds.map((kind) => kind.name),
    ['worker', 'judge'],
  )
  assert.deepEqual(
    result.config?.kinds[0]?.candidates.map((candidate) => candidate.spec),
    ['pi:a:high', 'command-code:b:low'],
  )
  assert.deepEqual(result.config?.kinds[0]?.conditions, [])
  assert.deepEqual(result.config?.kinds[1]?.conditions, ['条件 1'])
})

test('JSON として不正なら invalid-json', () => {
  const result = parseModelsConfig('{ kinds: ')

  assert.equal(result.config, null)
  assert.equal(result.issues[0]?.code, 'invalid-json')
})

test('kinds が配列でない、または空なら error', () => {
  assert.equal(parseModelsConfig('{}').issues[0]?.code, 'invalid-kinds')
  assert.equal(parseModelsConfig('[]').issues[0]?.code, 'invalid-kinds')
  assert.equal(parseModelsConfig(config([])).issues[0]?.code, 'invalid-kinds')
})

test('候補が空の種類は empty-candidates', () => {
  const result = parseModelsConfig(config([{ ...VALID_KIND, candidates: [] }]))

  assert.equal(result.config, null)
  assert.ok(result.issues.some((issue) => issue.code === 'empty-candidates'))
})

test('候補の書式違反は invalid-candidate として種類名付きで報告される', () => {
  const result = parseModelsConfig(config([{ ...VALID_KIND, candidates: ['pi:a:high', 'broken'] }]))
  const issue = result.issues.find((candidate) => candidate.code === 'invalid-candidate')

  assert.equal(result.config, null)
  assert.match(issue?.message ?? '', /worker/)
  assert.match(issue?.message ?? '', /broken/)
})

test('同じ種類内の重複した候補は duplicate-candidate', () => {
  const result = parseModelsConfig(
    config([{ ...VALID_KIND, candidates: ['pi:a:high', 'pi:a:high'] }]),
  )

  assert.ok(result.issues.some((issue) => issue.code === 'duplicate-candidate'))
})

test('description が空、または name が不正・重複なら error', () => {
  assert.ok(
    parseModelsConfig(config([{ ...VALID_KIND, description: ' ' }])).issues.some(
      (issue) => issue.code === 'missing-description',
    ),
  )
  assert.ok(
    parseModelsConfig(config([{ ...VALID_KIND, name: 'Bad Name' }])).issues.some(
      (issue) => issue.code === 'invalid-name',
    ),
  )
  assert.ok(
    parseModelsConfig(config([VALID_KIND, VALID_KIND])).issues.some(
      (issue) => issue.code === 'duplicate-kind',
    ),
  )
})

test('conditions が文字列の配列でなければ error', () => {
  const result = parseModelsConfig(config([{ ...VALID_KIND, conditions: ['ok', ''] }]))

  assert.ok(result.issues.some((issue) => issue.code === 'invalid-conditions'))
})

test('未知のキーは typo を防ぐため error', () => {
  const result = parseModelsConfig(config([{ ...VALID_KIND, candidate: ['pi:a:high'] }]))

  assert.ok(result.issues.some((issue) => issue.code === 'unknown-key'))
})

const EFFORTS_CONFIG = {
  kinds: [
    {
      name: 'worker',
      description: '実装担当',
      candidates: ['pi:opencode-go/deepseek-v4.1-flash:high', 'command-code:deepseek-v4.1-flash:low'],
    },
  ],
  efforts: { 'deepseek-v4.1-flash': ['none', 'low', 'high', 'max'] },
}

test('efforts に一覧があるモデルは、その一覧に含まれる effort だけを許す', () => {
  const result = parseModelsConfig(JSON.stringify(EFFORTS_CONFIG))

  assert.deepEqual(result.issues, [])
  assert.deepEqual(result.warnings, [])
  assert.deepEqual(result.config?.efforts, { 'deepseek-v4.1-flash': ['none', 'low', 'high', 'max'] })
})

test('一覧にない effort は unsupported-effort の error で、一覧を示す', () => {
  const result = parseModelsConfig(
    JSON.stringify({
      ...EFFORTS_CONFIG,
      kinds: [{ name: 'worker', description: '実装担当', candidates: ['pi:opencode-go/deepseek-v4.1-flash:medium'] }],
    }),
  )
  const issue = result.issues.find((candidate) => candidate.code === 'unsupported-effort')

  assert.equal(result.config, null)
  assert.match(issue?.message ?? '', /worker/)
  assert.match(issue?.message ?? '', /medium/)
  assert.match(issue?.message ?? '', /none \| low \| high \| max/)
})

test('efforts のキーは model の最後の / 以降で引く', () => {
  const result = parseModelsConfig(
    JSON.stringify({
      kinds: [{ name: 'worker', description: '実装担当', candidates: ['pi:a/b/m:high', 'pi:m:max'] }],
      efforts: { m: ['high'] },
    }),
  )

  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ['unsupported-effort'],
  )
})

test('一覧が定義されていないモデルは error にせず、モデルごとに 1 回だけ warning', () => {
  const result = parseModelsConfig(
    config([
      { ...VALID_KIND, candidates: ['pi:a/new-model:high', 'command-code:new-model:low'] },
      { ...VALID_KIND, name: 'judge', candidates: ['pi:new-model:high'] },
    ]),
  )

  assert.deepEqual(result.issues, [])
  assert.notEqual(result.config, null)
  assert.deepEqual(
    result.warnings.map((warning) => warning.code),
    ['unknown-model-efforts'],
  )
  assert.match(result.warnings[0]?.message ?? '', /new-model/)
})

test('efforts がなければ空の一覧として扱う', () => {
  const result = parseModelsConfig(config([VALID_KIND]))

  assert.deepEqual(result.config?.efforts, {})
})

test('efforts が不正なら invalid-efforts', () => {
  const invalid: unknown[] = [
    [],
    'high',
    { m: [] },
    { m: 'high' },
    { m: ['high', 'high'] },
    { m: ['High'] },
    { m: [1] },
  ]

  for (const efforts of invalid) {
    const result = parseModelsConfig(JSON.stringify({ kinds: [VALID_KIND], efforts }))

    assert.equal(result.config, null, JSON.stringify(efforts))
    assert.ok(
      result.issues.some((issue) => issue.code === 'invalid-efforts'),
      JSON.stringify(efforts),
    )
  }
})

test('設定ファイルがなければ exists: false', () => {
  const fixture = createHarnessFixture([], [], { modelsConfig: null })

  try {
    const loaded = loadModelsConfig(fixture.root)

    assert.equal(loaded.exists, false)
    assert.equal(loaded.config, null)
    assert.deepEqual(loaded.issues, [])
    assert.deepEqual(loaded.warnings, [])
  } finally {
    fixture.cleanup()
  }
})

test('設定ファイルを harness root から読み込む', () => {
  const fixture = createHarnessFixture([], [], { modelsConfig: config([VALID_KIND]) })

  try {
    const loaded = loadModelsConfig(fixture.root)

    assert.equal(loaded.exists, true)
    assert.equal(loaded.config?.kinds[0]?.name, 'worker')
  } finally {
    fixture.cleanup()
  }
})
