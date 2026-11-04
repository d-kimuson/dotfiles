import assert from 'node:assert/strict'
import { test } from 'node:test'

import { CliError } from './errors.ts'
import { harnessDir, resolveHarnessRoot } from './paths.ts'
import { createHarnessFixture } from './testing/fixtures.ts'

test('既定は HOME 配下の .agents', () => {
  const fixture = createHarnessFixture([{ kind: 'playbook', name: 'sample' }])

  try {
    assert.equal(resolveHarnessRoot({ cwd: '/', env: { HOME: fixture.root } }), fixture.root)
  } finally {
    fixture.cleanup()
  }
})

test('--root は cwd 相対で解決する', () => {
  const fixture = createHarnessFixture()

  try {
    assert.equal(resolveHarnessRoot({ root: '.', cwd: fixture.root, env: {} }), fixture.root)
  } finally {
    fixture.cleanup()
  }
})

test('--root に .agents 自身を渡すと親を root にする', () => {
  const fixture = createHarnessFixture()

  try {
    assert.equal(resolveHarnessRoot({ root: harnessDir(fixture.root), cwd: '/', env: {} }), fixture.root)
  } finally {
    fixture.cleanup()
  }
})

test('AGENT_CORE_ROOT は --root より弱い', () => {
  const first = createHarnessFixture()
  const second = createHarnessFixture()

  try {
    assert.equal(
      resolveHarnessRoot({ cwd: '/', env: { HOME: '/nonexistent-home', AGENT_CORE_ROOT: first.root } }),
      first.root,
    )
    assert.equal(
      resolveHarnessRoot({ root: second.root, cwd: '/', env: { AGENT_CORE_ROOT: first.root } }),
      second.root,
    )
  } finally {
    first.cleanup()
    second.cleanup()
  }
})

test('既定の .agents がなければ CliError', () => {
  assert.throws(
    () => resolveHarnessRoot({ cwd: '/', env: { HOME: '/nonexistent-agent-core-home' } }),
    CliError,
  )
})
