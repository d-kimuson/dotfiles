import assert from 'node:assert/strict'
import { test } from 'node:test'

import { hasFrontmatter, parseFrontmatter, readString, readStringList } from './frontmatter.ts'

test('frontmatter を解析して本文を分離する', () => {
  const text = '---\nname: sample\ndescription: 説明\n---\n\n# Title\nbody\n'
  const result = parseFrontmatter(text)

  assert.equal(result.error, null)
  assert.equal(result.data['name'], 'sample')
  assert.equal(result.data['description'], '説明')
  assert.equal(result.body, '# Title\nbody\n')
})

test('配列とインライン配列を解析する', () => {
  const text = '---\ntags:\n  - a\n  - b\nlist: [x, "y, z"]\n---\nbody\n'
  const result = parseFrontmatter(text)

  assert.equal(result.error, null)
  assert.deepEqual(result.data['tags'], ['a', 'b'])
  assert.deepEqual(result.data['list'], ['x', 'y, z'])
})

test('クォートとコメントを処理する', () => {
  const text = '---\nname: "a # not comment" # comment\nsingle: \'it\'\'s\'\n---\n'
  const result = parseFrontmatter(text)

  assert.equal(result.data['name'], 'a # not comment')
  assert.equal(result.data['single'], "it's")
})

test('frontmatter がない場合は本文全体を返す', () => {
  const text = '# Title\nbody\n'
  const result = parseFrontmatter(text)

  assert.equal(hasFrontmatter(text), false)
  assert.equal(result.error, null)
  assert.deepEqual(result.data, {})
  assert.equal(result.body, text)
})

test('閉じられていない frontmatter はエラー', () => {
  const result = parseFrontmatter('---\nname: sample\n')

  assert.equal(hasFrontmatter('---\nname: sample\n'), true)
  assert.match(result.error ?? '', /閉じられていません/)
})

test('ネストしたマッピングはエラーとして報告する', () => {
  const result = parseFrontmatter('---\nmeta:\n  nested: value\n---\n')

  assert.match(result.error ?? '', /ネスト/)
})

test('readString は配列をカンマ結合する', () => {
  assert.equal(readString({ key: ['a', 'b'] }, 'key'), 'a, b')
  assert.equal(readString({}, 'key'), undefined)
})

test('スカラー値のキーにリスト項目を続けるとエラー (黙って上書きしない)', () => {
  const result = parseFrontmatter('---\nprinciples: a\n  - b\n---\n')

  assert.match(result.error ?? '', /リスト項目/)
})

test('インライン配列のキーにリスト項目を続けるとエラー', () => {
  const result = parseFrontmatter('---\nprinciples: [a]\n  - b\n---\n')

  assert.match(result.error ?? '', /リスト項目/)
})

test('同じキーの重複はエラー', () => {
  const result = parseFrontmatter('---\nname: a\nname: b\n---\n')

  assert.match(result.error ?? '', /重複/)
})

test('readStringList: キーがなければ空のリスト', () => {
  assert.deepEqual(readStringList({}, 'principles'), { ok: true, items: [] })
})

test('readStringList: ブロックとインラインのリストを読む', () => {
  assert.deepEqual(readStringList({ principles: ['a', 'b'] }, 'principles'), { ok: true, items: ['a', 'b'] })
  assert.deepEqual(readStringList({ principles: [] }, 'principles'), { ok: true, items: [] })
})

test('readStringList: スカラーと空の値はリストではないのでエラー', () => {
  for (const value of ['a', '']) {
    const result = readStringList({ principles: value }, 'principles')

    assert.equal(result.ok, false, JSON.stringify(value))
    assert.match(result.ok ? '' : result.reason, /リスト/)
  }
})

test('readStringList: 空の項目はエラー', () => {
  const result = readStringList({ principles: ['a', ''] }, 'principles')

  assert.equal(result.ok, false)
  assert.match(result.ok ? '' : result.reason, /空/)
})
