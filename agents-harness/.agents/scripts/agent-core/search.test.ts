import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { Entry } from './content.ts'
import { searchEntries, tokenize } from './search.ts'

function entry(name: string, description: string, body: string): Entry {
  return {
    kind: 'playbook',
    name,
    dir: `/tmp/${name}`,
    file: `/tmp/${name}/PLAYBOOK.md`,
    exists: true,
    raw: body,
    frontmatter: { name, description },
    frontmatterError: null,
    body,
    description,
  }
}

const entries = [
  entry('initialize-project', 'プロジェクト初期化', '# Initialize\nproject setup\n'),
  entry('security-check', 'セキュリティ検査', '# Security\nnpm audit を実行する\n'),
  entry('npm-publishing', 'npm 公開設定', '# Publish\nproject を公開する\n'),
]

test('tokenize は正規化して分割する', () => {
  assert.deepEqual(tokenize('  NPM   公開 '), ['npm', '公開'])
})

test('全トークンがヒットするものだけを返す（AND）', () => {
  const hits = searchEntries(entries, 'npm project')

  assert.deepEqual(
    hits.map((hit) => hit.entry.name),
    ['npm-publishing'],
  )
})

test('name 一致は description/body より高スコア', () => {
  const hits = searchEntries(entries, 'security')

  assert.equal(hits[0]?.entry.name, 'security-check')
  assert.ok(hits[0]?.score !== undefined)
})

test('ヒットしない場合は空配列', () => {
  assert.deepEqual(searchEntries(entries, 'no-such-token'), [])
})

test('空クエリは空配列', () => {
  assert.deepEqual(searchEntries(entries, '   '), [])
})
