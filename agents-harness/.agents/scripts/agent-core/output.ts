import { UsageError } from './errors.ts'

export function line(text = ''): string {
  return `${text}\n`
}

export function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

/** 2 列（左ラベル + 右説明）を整列して返す。 */
export function alignTwoColumns(rows: Array<[string, string]>): string {
  if (rows.length === 0) {
    return ''
  }
  const width = rows.reduce((max, [left]) => Math.max(max, left.length), 0)
  return rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`).join('\n')
}

/** 3 列以上のテーブルを整列して返す。 */
export function formatTable(headers: string[], rows: string[][]): string {
  const allRows = [headers, ...rows]
  const widths = headers.map((_, columnIndex) =>
    allRows.reduce((max, row) => Math.max(max, (row[columnIndex] ?? '').length), 0),
  )
  return allRows
    .map((row) => row.map((cell, columnIndex) => (cell ?? '').padEnd(widths[columnIndex] ?? 0)).join('  ').trimEnd())
    .join('\n')
}

/** 表示幅を超える文字列を省略記号付きで切り詰める。 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  if (maxLength <= 1) {
    return '…'
  }
  return `${text.slice(0, maxLength - 1)}…`
}

export type Page<T> = {
  items: T[]
  page: number
  perPage: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

/** 1 始まりのページ番号で切り出す。範囲外は UsageError。 */
export function paginate<T>(items: T[], page: number, perPage: number): Page<T> {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  if (page > totalPages) {
    throw new UsageError(`--page が範囲外です: ${page} (1-${totalPages})`)
  }

  const start = (page - 1) * perPage
  return {
    items: items.slice(start, start + perPage),
    page,
    perPage,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}

/** ページ状態の 1 行サマリ。 */
export function pageSummary(page: Page<unknown>, label: string, query?: string): string {
  const prefix = query === undefined ? '' : `query "${query}" · `
  return `${prefix}${page.total} ${label} · page ${page.page}/${page.totalPages} (${page.perPage} per page)`
}

/** 次ページがある場合のヒント。 */
export function nextPageHint(page: Page<unknown>, pageFlag = '--page'): string | null {
  if (!page.hasNext) {
    return null
  }
  return `次ページ: ${pageFlag} ${page.page + 1}`
}
