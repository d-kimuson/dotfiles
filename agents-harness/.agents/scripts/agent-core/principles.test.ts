import assert from 'node:assert/strict'
import { test } from 'node:test'

import { loadEntry } from './content.ts'
import { CliError } from './errors.ts'
import { loadRolePrinciples, readPrincipleRefs, renderRoleWithPrinciples } from './principles.ts'
import { createHarnessFixture } from './testing/fixtures.ts'

test('readPrincipleRefs: principles がなければ空', () => {
  assert.deepEqual(readPrincipleRefs({}), { ok: true, names: [] })
})

test('readPrincipleRefs: 書いた順を保って読む', () => {
  assert.deepEqual(readPrincipleRefs({ principles: ['b-one', 'a'] }), { ok: true, names: ['b-one', 'a'] })
})

test('readPrincipleRefs: リストでない値はエラー', () => {
  const result = readPrincipleRefs({ principles: 'a' })

  assert.equal(result.ok, false)
  assert.match(result.ok ? '' : result.reason, /リスト/)
})

test('readPrincipleRefs: kebab-case でない名前はエラー (パス区切りを通さない)', () => {
  for (const name of ['Upper', '../x', 'a/b', 'a b', '-a', 'a-']) {
    const result = readPrincipleRefs({ principles: [name] })

    assert.equal(result.ok, false, name)
    assert.match(result.ok ? '' : result.reason, /kebab-case/, name)
  }
})

test('readPrincipleRefs: 重複はエラー', () => {
  const result = readPrincipleRefs({ principles: ['a', 'a'] })

  assert.equal(result.ok, false)
  assert.match(result.ok ? '' : result.reason, /重複/)
})

function createRoleFixture(roleFrontmatter: Record<string, string>) {
  return createHarnessFixture([
    { kind: 'role', name: 'dev', frontmatter: { name: 'dev', description: 'dev の説明', ...roleFrontmatter }, body: '# Dev\n\n本文\n' },
    { kind: 'principle', name: 'alpha', body: '# Alpha\n\nA の本文\n' },
    { kind: 'principle', name: 'beta', body: '# Beta\n\nB の本文\n' },
  ])
}

test('loadRolePrinciples: 参照を書いた順に解決する', () => {
  const fixture = createRoleFixture({ principles: '[beta, alpha]' })

  try {
    const role = loadEntry(fixture.root, 'role', 'dev')

    assert.deepEqual(
      loadRolePrinciples(fixture.root, role).map((entry) => entry.name),
      ['beta', 'alpha'],
    )
  } finally {
    fixture.cleanup()
  }
})

test('loadRolePrinciples: 存在しない principle は role 名と共に CliError', () => {
  const fixture = createRoleFixture({ principles: '[alpha, missing]' })

  try {
    const role = loadEntry(fixture.root, 'role', 'dev')

    assert.throws(
      () => loadRolePrinciples(fixture.root, role),
      (error) => error instanceof CliError && /dev/.test(error.message) && /principles\/missing/.test(error.message),
    )
  } finally {
    fixture.cleanup()
  }
})

test('loadRolePrinciples: principles の書式が不正なら CliError', () => {
  const fixture = createRoleFixture({ principles: 'alpha' })

  try {
    const role = loadEntry(fixture.root, 'role', 'dev')

    assert.throws(() => loadRolePrinciples(fixture.root, role), CliError)
  } finally {
    fixture.cleanup()
  }
})

test('renderRoleWithPrinciples: principle がなければ role 本文のまま', () => {
  const fixture = createRoleFixture({})

  try {
    const role = loadEntry(fixture.root, 'role', 'dev')

    assert.equal(renderRoleWithPrinciples(role, []), '# Dev\n\n本文\n')
  } finally {
    fixture.cleanup()
  }
})

test('renderRoleWithPrinciples: role 本文の後ろに principle の全文を、名前付きの区切りで列挙順に続ける', () => {
  const fixture = createRoleFixture({ principles: '[beta, alpha]' })

  try {
    const role = loadEntry(fixture.root, 'role', 'dev')
    const text = renderRoleWithPrinciples(role, loadRolePrinciples(fixture.root, role))

    assert.ok(text.startsWith('# Dev\n\n本文\n'))
    assert.ok(text.endsWith('</principle>\n'))
    const beta = text.indexOf('<principle name="beta">\n# Beta\n\nB の本文\n</principle>')
    const alpha = text.indexOf('<principle name="alpha">\n# Alpha\n\nA の本文\n</principle>')
    assert.ok(beta > 0 && alpha > beta, text)
  } finally {
    fixture.cleanup()
  }
})
