import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { ModelKind } from './models.ts'
import { parseCandidate } from './models.ts'
import {
  filterKindsByProviders,
  loadProvidersConfig,
  parseProvidersConfig,
  providerOfCandidate,
  PROVIDERS,
} from './providers.ts'
import { createHarnessFixture } from './testing/fixtures.ts'

function candidateOf(spec: string) {
  const parsed = parseCandidate(spec)
  assert.ok(parsed.ok, spec)
  return parsed.candidate
}

test('provider は 5 種類で、順序を保って読める', () => {
  assert.deepEqual([...PROVIDERS], ['claude-code', 'opencode-go', 'openai-codex', 'command-code', 'antigravity'])

  const result = parseProvidersConfig('{ "providers": ["openai-codex", "claude-code"] }')

  assert.deepEqual(result.issues, [])
  assert.deepEqual(result.config, { providers: ['openai-codex', 'claude-code'] })
})

test('providers が空の配列でも読める (使える provider がない状態)', () => {
  const result = parseProvidersConfig('{ "providers": [] }')

  assert.deepEqual(result.issues, [])
  assert.deepEqual(result.config, { providers: [] })
})

test('JSON として不正なら invalid-json', () => {
  const result = parseProvidersConfig('{ providers: ')

  assert.equal(result.config, null)
  assert.equal(result.issues[0]?.code, 'invalid-json')
})

test('形が違うものは invalid-shape', () => {
  const invalid: unknown[] = [[], 'claude-code', null, {}, { providers: 'claude-code' }, { providers: [1] }, { providers: {} }]

  for (const data of invalid) {
    const result = parseProvidersConfig(JSON.stringify(data))

    assert.equal(result.config, null, JSON.stringify(data))
    assert.equal(result.issues[0]?.code, 'invalid-shape', JSON.stringify(data))
  }
})

test('未知の provider は unknown-provider で、使える値を示す', () => {
  const result = parseProvidersConfig('{ "providers": ["claude-code", "gemini"] }')
  const issue = result.issues.find((candidate) => candidate.code === 'unknown-provider')

  assert.equal(result.config, null)
  assert.match(issue?.message ?? '', /gemini/)
  assert.match(issue?.message ?? '', /claude-code \| opencode-go \| openai-codex \| command-code/)
})

test('重複した provider は duplicate-provider', () => {
  const result = parseProvidersConfig('{ "providers": ["openai-codex", "openai-codex"] }')

  assert.equal(result.config, null)
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ['duplicate-provider'],
  )
})

test('旧名の openai は provider として受け付けない (将来 API 直利用の provider と区別するため)', () => {
  const result = parseProvidersConfig('{ "providers": ["openai"] }')

  assert.equal(result.config, null)
  assert.ok(result.issues.some((issue) => issue.code === 'unknown-provider' && /"openai"/.test(issue.message)))
})

test('未知のキーは typo を防ぐため unknown-key', () => {
  const result = parseProvidersConfig('{ "providers": ["openai-codex"], "provider": ["openai-codex"] }')

  assert.equal(result.config, null)
  assert.ok(result.issues.some((issue) => issue.code === 'unknown-key'))
})

test('runtime が claude-code / command-code / antigravity なら、そのまま provider になる', () => {
  assert.equal(providerOfCandidate(candidateOf('claude-code:claude-opus-5-5:high')), 'claude-code')
  assert.equal(providerOfCandidate(candidateOf('command-code:deepseek/deepseek-v4.1-flash:high')), 'command-code')
  assert.equal(providerOfCandidate(candidateOf('antigravity:gemini-4-neon:high')), 'antigravity')
})

test('runtime が pi なら、model の最初の / より前の接頭辞で provider が決まる', () => {
  assert.equal(providerOfCandidate(candidateOf('pi:opencode-go/deepseek-v4.1-flash:high')), 'opencode-go')
  assert.equal(providerOfCandidate(candidateOf('pi:openai-codex/gpt-6-astra:xhigh')), 'openai-codex')
  assert.equal(providerOfCandidate(candidateOf('pi:openai-codex/a/b:high')), 'openai-codex')
})

test('provider が決まらない候補は null', () => {
  assert.equal(providerOfCandidate(candidateOf('pi:zai/glm-5.3-flash:high')), null)
  assert.equal(providerOfCandidate(candidateOf('pi:gpt-6-astra:high')), null)
  assert.equal(providerOfCandidate(candidateOf('pi:openai/gpt-6:high')), null)
  assert.equal(providerOfCandidate(candidateOf('codex:gpt-6:high')), null)
})

function kind(name: string, candidates: string[]): ModelKind {
  return { name, description: `${name} の説明`, conditions: [], candidates: candidates.map(candidateOf) }
}

test('provider が許可された候補だけを、優先順を保って残す', () => {
  const kinds = [
    kind('worker', ['command-code:d/m:high', 'pi:opencode-go/m:high']),
    kind('judge', ['claude-code:c:high', 'pi:openai-codex/g:high']),
  ]

  const filtered = filterKindsByProviders(kinds, ['openai-codex', 'command-code'])

  assert.deepEqual(
    filtered.map((item) => [item.name, item.candidates.map((candidate) => candidate.spec)]),
    [
      ['worker', ['command-code:d/m:high']],
      ['judge', ['pi:openai-codex/g:high']],
    ],
  )
})

test('候補がすべて外れた種類も、候補なしとして残す', () => {
  const filtered = filterKindsByProviders([kind('worker', ['claude-code:c:high'])], ['openai-codex'])

  assert.equal(filtered.length, 1)
  assert.equal(filtered[0]?.name, 'worker')
  assert.deepEqual(filtered[0]?.candidates, [])
})

test('provider が決まらない候補は、許可に関わらず残さない', () => {
  const filtered = filterKindsByProviders(
    [kind('worker', ['pi:zai/m:high'])],
    ['claude-code', 'opencode-go', 'openai-codex', 'command-code'],
  )

  assert.deepEqual(filtered[0]?.candidates, [])
})

test('providers.json がなければ exists: false', () => {
  const fixture = createHarnessFixture()

  try {
    const loaded = loadProvidersConfig(fixture.root)

    assert.equal(loaded.exists, false)
    assert.equal(loaded.config, null)
    assert.deepEqual(loaded.issues, [])
    assert.match(loaded.file, /\.agents[\\/]providers\.json$/)
  } finally {
    fixture.cleanup()
  }
})

test('providers.json を harness root から読み込む', () => {
  const fixture = createHarnessFixture([], [], { providersConfig: '{ "providers": ["claude-code"] }' })

  try {
    const loaded = loadProvidersConfig(fixture.root)

    assert.equal(loaded.exists, true)
    assert.deepEqual(loaded.config, { providers: ['claude-code'] })
  } finally {
    fixture.cleanup()
  }
})
