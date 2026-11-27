import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'

import { CliError } from './errors.ts'
import type { ExportProfile } from './export.ts'
import { EXPORT_PROFILES, exportHarness, listTrackedFiles, planExport } from './export.ts'
import { parseProvidersConfig } from './providers.ts'

const WEB_PROFILE: ExportProfile = {
  name: 'test-web',
  providers: ['claude-code'],
  exclude: ['.skill-lock.json', 'references/agent-call-over-cli.md', 'skills/orca-cli', 'skills/orca-computer-use'],
}

type SourceFixture = {
  /** git リポジトリのルート (= harness root)。 */
  source: string
  /** 配布先として渡す既存ディレクトリ。 */
  target: string
  /** `<source>/.agents`。 */
  agents: string
  cleanup: () => void
}

function createSourceFixture(files: Record<string, string>, gitignore = 'state/\nskills/synced/\n'): SourceFixture {
  const base = mkdtempSync(join(tmpdir(), 'agent-core-export-'))
  const source = join(base, 'source')
  const agents = join(source, '.agents')
  const target = join(base, 'target')
  mkdirSync(target, { recursive: true })
  mkdirSync(agents, { recursive: true })
  writeFileSync(join(agents, '.gitignore'), gitignore)
  writeFileSync(join(agents, 'AGENTS.md'), '# Agents\n')
  for (const [rel, body] of Object.entries(files)) {
    const file = join(agents, rel)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, body)
  }
  execFileSync('git', ['-C', source, 'init', '-q'], { stdio: 'ignore' })
  execFileSync('git', ['-C', source, 'add', '-A'], { stdio: 'ignore' })
  return {
    source,
    target,
    agents,
    cleanup: () => {
      rmSync(base, { recursive: true, force: true })
    },
  }
}

function planFor(exclude: string[], files: string[]) {
  return planExport(files, { name: 'p', providers: ['claude-code'], exclude })
}

test('planExport は profile が null なら全件をコピーする', () => {
  const plan = planExport(['a.md', 'skills/x/SKILL.md'], null)

  assert.deepEqual(plan.copy, ['a.md', 'skills/x/SKILL.md'])
  assert.deepEqual(plan.excluded, [])
  assert.deepEqual(plan.unmatchedExcludes, [])
})

test('planExport のディレクトリ除外は配下だけを落とし、名前の前方一致は落とさない', () => {
  const plan = planFor(['skills/orca-cli'], [
    'skills/orca-cli/SKILL.md',
    'skills/orca-cli/references/a.md',
    'skills/orca-cli-extra/SKILL.md',
    'skills/orca-cli.md',
  ])

  assert.deepEqual(plan.copy, ['skills/orca-cli-extra/SKILL.md', 'skills/orca-cli.md'])
  assert.deepEqual(plan.excluded, ['skills/orca-cli/SKILL.md', 'skills/orca-cli/references/a.md'])
})

test('planExport のファイル除外は完全一致だけを落とす', () => {
  const plan = planFor(['.skill-lock.json'], ['.skill-lock.json', '.skill-lock.json.bak', 'nested/.skill-lock.json'])

  assert.deepEqual(plan.copy, ['.skill-lock.json.bak', 'nested/.skill-lock.json'])
  assert.deepEqual(plan.excluded, ['.skill-lock.json'])
})

test('planExport は一致しない除外パスを unmatchedExcludes に集める', () => {
  const plan = planFor(['missing.md', 'skills/orca-cli'], ['skills/orca-cli/SKILL.md'])

  assert.deepEqual(plan.copy, [])
  assert.deepEqual(plan.excluded, ['skills/orca-cli/SKILL.md'])
  assert.deepEqual(plan.unmatchedExcludes, ['missing.md'])
})

test('exportHarness は追跡ファイルだけをコピーする', () => {
  const fixture = createSourceFixture({
    'skills/synced/x/SKILL.md': 'synced\n',
    'state/providers.json': '{}\n',
  })
  try {
    writeFileSync(join(fixture.agents, 'untracked.md'), 'untracked\n')

    const result = exportHarness({ sourceRoot: fixture.source, targetRoot: fixture.target, profile: null })

    assert.deepEqual(readTree(join(fixture.target, '.agents')), ['.gitignore', 'AGENTS.md'])
    assert.equal(result.copied, 2)
    assert.equal(result.providers, null)
  } finally {
    fixture.cleanup()
  }
})

test('exportHarness は実行ビットを保つ', () => {
  const fixture = createSourceFixture({})
  try {
    const script = join(fixture.agents, 'scripts', 'run.sh')
    mkdirSync(dirname(script), { recursive: true })
    writeFileSync(script, '#!/bin/sh\necho ok\n', { mode: 0o755 })
    execFileSync('git', ['-C', fixture.source, 'add', '-A'], { stdio: 'ignore' })

    exportHarness({ sourceRoot: fixture.source, targetRoot: fixture.target, profile: null })

    assert.equal(statSync(join(fixture.target, '.agents', 'scripts', 'run.sh')).mode & 0o777, 0o755)
  } finally {
    fixture.cleanup()
  }
})

test('exportHarness は profile の providers を state/providers.json に書き、profile なしでは書かない', () => {
  const fixture = createSourceFixture({})
  try {
    const withProfile = exportHarness({
      sourceRoot: fixture.source,
      targetRoot: fixture.target,
      profile: WEB_PROFILE,
    })
    const written = parseProvidersConfig(
      readFileSync(join(fixture.target, '.agents', 'state', 'providers.json'), 'utf8'),
    )

    assert.deepEqual(withProfile.providers, ['claude-code'])
    assert.deepEqual(written.config, { providers: ['claude-code'] })

    const other = mkdtempSync(join(tmpdir(), 'agent-core-export-target-'))
    try {
      exportHarness({ sourceRoot: fixture.source, targetRoot: other, profile: null })
      assert.equal(existsSync(join(other, '.agents', 'state')), false)
    } finally {
      rmSync(other, { recursive: true, force: true })
    }
  } finally {
    fixture.cleanup()
  }
})

test('exportHarness は配布先に .agents があれば何も変えずに失敗する', () => {
  const fixture = createSourceFixture({})
  try {
    const existing = join(fixture.target, '.agents')
    writeFileSync(existing, 'keep\n')

    assert.throws(
      () => exportHarness({ sourceRoot: fixture.source, targetRoot: fixture.target, profile: null }),
      CliError,
    )
    assert.equal(readFileSync(existing, 'utf8'), 'keep\n')
  } finally {
    fixture.cleanup()
  }
})

test('exportHarness は配布先の .agents が symlink でも失敗し、リンクも配布元も変えない', () => {
  const fixture = createSourceFixture({})
  try {
    const link = join(fixture.target, '.agents')
    symlinkSync(fixture.agents, link)
    const before = readFileSync(join(fixture.agents, 'AGENTS.md'), 'utf8')

    assert.throws(
      () => exportHarness({ sourceRoot: fixture.source, targetRoot: fixture.target, profile: null }),
      CliError,
    )
    assert.ok(lstatSync(link).isSymbolicLink())
    assert.equal(readFileSync(join(fixture.agents, 'AGENTS.md'), 'utf8'), before)
  } finally {
    fixture.cleanup()
  }
})

test('exportHarness は配布元が Git 管理外なら失敗する', () => {
  const base = mkdtempSync(join(tmpdir(), 'agent-core-export-nogit-'))
  try {
    const source = join(base, 'source')
    mkdirSync(join(source, '.agents'), { recursive: true })
    writeFileSync(join(source, '.agents', 'AGENTS.md'), '# Agents\n')
    const target = join(base, 'target')
    mkdirSync(target)

    assert.throws(() => exportHarness({ sourceRoot: source, targetRoot: target, profile: null }), CliError)
    assert.equal(existsSync(join(target, '.agents')), false)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('exportHarness は途中で失敗したら配布先の親に何も残さない', () => {
  const fixture = createSourceFixture({ 'missing.md': 'x\n' })
  try {
    rmSync(join(fixture.agents, 'missing.md'))

    assert.throws(
      () => exportHarness({ sourceRoot: fixture.source, targetRoot: fixture.target, profile: null }),
      CliError,
    )
    assert.deepEqual(readdirSync(fixture.target), [])
  } finally {
    fixture.cleanup()
  }
})

test('exportHarness は配布先のディレクトリがなければ失敗する', () => {
  const fixture = createSourceFixture({})
  try {
    assert.throws(
      () =>
        exportHarness({
          sourceRoot: fixture.source,
          targetRoot: join(fixture.target, 'missing'),
          profile: null,
        }),
      CliError,
    )
  } finally {
    fixture.cleanup()
  }
})

test('EXPORT_PROFILES の除外パスは実ツリーの追跡ファイルに一致する', () => {
  const agents = resolve(import.meta.dirname, '..', '..')
  const files = listTrackedFiles(agents)

  for (const profile of EXPORT_PROFILES) {
    const plan = planExport(files, profile)
    assert.deepEqual(plan.unmatchedExcludes, [], profile.name)
    assert.ok(plan.excluded.length > 0, profile.name)
  }
})

function readTree(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) {
      found.push(relative(dir, join(entry.parentPath, entry.name)))
    }
  }
  return found.sort()
}

function relative(from: string, file: string): string {
  return file.slice(from.length + 1).split('\\').join('/')
}
