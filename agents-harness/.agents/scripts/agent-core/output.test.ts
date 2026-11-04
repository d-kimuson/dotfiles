import assert from 'node:assert/strict'
import { test } from 'node:test'

import { UsageError } from './errors.ts'
import { formatTable, nextPageHint, pageSummary, paginate, truncate } from './output.ts'

test('paginate は 1 始まりで切り出す', () => {
  const page = paginate([1, 2, 3, 4, 5], 2, 2)

  assert.deepEqual(page.items, [3, 4])
  assert.equal(page.page, 2)
  assert.equal(page.totalPages, 3)
  assert.equal(page.hasNext, true)
  assert.equal(page.hasPrev, true)
})

test('空配列でも 1 ページとして扱う', () => {
  const page = paginate([], 1, 20)

  assert.deepEqual(page.items, [])
  assert.equal(page.totalPages, 1)
  assert.equal(page.hasNext, false)
})

test('範囲外のページは UsageError', () => {
  assert.throws(() => paginate([1, 2], 3, 20), UsageError)
})

test('pageSummary は件数とページを含む', () => {
  const summary = pageSummary(paginate([1, 2, 3], 2, 2), 'playbooks')

  assert.match(summary, /3 playbooks/)
  assert.match(summary, /page 2\/2/)
})

test('nextPageHint は最終ページでは null', () => {
  assert.equal(nextPageHint(paginate([1, 2], 1, 2)), null)
  assert.match(nextPageHint(paginate([1, 2, 3], 1, 2)) ?? '', /--page 2/)
})

test('truncate は表示幅で切り詰める', () => {
  assert.equal(truncate('abcdef', 4), 'abc…')
  assert.equal(truncate('abc', 4), 'abc')
})

test('formatTable は列を整列する', () => {
  const table = formatTable(['NAME', 'DESC'], [['a', 'x'], ['long-name', 'y']])
  const [header, first] = table.split('\n')

  assert.match(header ?? '', /^NAME\s+DESC$/)
  assert.match(first ?? '', /^a\s+x$/)
})
