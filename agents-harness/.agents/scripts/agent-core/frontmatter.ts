/**
 * YAML のサブセットだけを扱う frontmatter パーサ（依存なし）。
 *
 * 対応する構文:
 *   ---
 *   name: value
 *   quoted: "double quoted"
 *   single: 'single quoted'
 *   list:
 *     - a
 *     - b
 *   inline: [a, b]
 *   ---
 *
 * 非対応: ネストしたマッピング、複数行スカラー、アンカー/エイリアス。
 * 非対応構文は `error` として報告し、解釈できた範囲のデータは返す。
 */

export type FrontmatterValue = string | string[]
export type Frontmatter = Record<string, FrontmatterValue>

export type FrontmatterParseResult = {
  data: Frontmatter
  body: string
  error: string | null
}

const DELIMITER = '---'

/** frontmatter を持つテキストかどうか。 */
export function hasFrontmatter(text: string): boolean {
  return firstLine(text) === DELIMITER
}

export function parseFrontmatter(text: string): FrontmatterParseResult {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  if (!hasFrontmatter(normalized)) {
    return { data: {}, body: normalized, error: null }
  }

  const lines = normalized.split('\n')
  let closingIndex = -1
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === DELIMITER) {
      closingIndex = index
      break
    }
  }

  if (closingIndex === -1) {
    return {
      data: {},
      body: normalized,
      error: `frontmatter が ${DELIMITER} で閉じられていません`,
    }
  }

  const result = parseBlock(lines.slice(1, closingIndex))
  const body = lines.slice(closingIndex + 1).join('\n').replace(/^\n/, '')
  return { data: result.data, body, error: result.errors.length > 0 ? result.errors.join(' / ') : null }
}

function firstLine(text: string): string {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const newline = normalized.indexOf('\n')
  const line = newline === -1 ? normalized : normalized.slice(0, newline)
  return line.trim()
}

type BlockParseResult = {
  data: Frontmatter
  errors: string[]
}

function parseBlock(block: string[]): BlockParseResult {
  const data: Frontmatter = {}
  const errors: string[] = []
  let currentKey: string | null = null
  /** 直前のキーが値なし (`key:`) で、リスト項目を受け取れる状態か。 */
  let listOpen = false

  for (const rawLine of block) {
    const line = rawLine.replace(/\s+$/, '')
    const trimmed = line.trim()

    if (trimmed === '' || trimmed.startsWith('#')) {
      continue
    }

    const indent = line.length - line.trimStart().length
    if (indent > 0) {
      if (!trimmed.startsWith('-')) {
        errors.push(`ネストしたマッピングは未対応です: ${trimmed}`)
        currentKey = null
        listOpen = false
        continue
      }
      if (currentKey === null) {
        errors.push(`リスト項目に対応するキーがありません: ${trimmed}`)
        continue
      }
      if (!listOpen) {
        errors.push(`値のあるキー (${currentKey}) にリスト項目は続けられません: ${trimmed}`)
        continue
      }
      const item = unquote(stripComment(trimmed.slice(1).trim()))
      const existing = data[currentKey]
      const list = Array.isArray(existing) ? existing : []
      list.push(item)
      data[currentKey] = list
      continue
    }

    const entry = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line)
    if (entry === null) {
      errors.push(`frontmatter の行を解釈できません: ${line}`)
      currentKey = null
      listOpen = false
      continue
    }

    const key = entry[1] ?? ''
    const valueText = stripComment((entry[2] ?? '').trim())
    if (Object.hasOwn(data, key)) {
      errors.push(`キーが重複しています: ${key}`)
    }
    currentKey = key
    listOpen = valueText === ''

    if (valueText === '') {
      data[key] = ''
      continue
    }

    if (valueText.startsWith('[') && valueText.endsWith(']')) {
      data[key] = splitInlineList(valueText.slice(1, -1)).map(unquote)
      continue
    }

    data[key] = unquote(valueText)
  }

  return { data, errors }
}

/** クォート外の ` #` 以降をコメントとして落とす。 */
function stripComment(value: string): string {
  let quote: '"' | "'" | null = null
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (quote !== null) {
      if (char === quote) {
        quote = null
      }
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    const previous = value[index - 1]
    if (char === '#' && previous !== undefined && /\s/.test(previous)) {
      return value.slice(0, index).trimEnd()
    }
  }
  return value
}

/** クォートを外し、最低限のエスケープを戻す。 */
function unquote(value: string): string {
  if (value.length < 2) {
    return value
  }
  const quote = value[0]
  if ((quote !== '"' && quote !== "'") || value[value.length - 1] !== quote) {
    return value
  }
  const inner = value.slice(1, -1)
  if (quote === "'") {
    return inner.replace(/''/g, "'")
  }
  return inner.replace(/\\(["\\nt])/g, (_match, char: string) => {
    if (char === 'n') return '\n'
    if (char === 't') return '\t'
    return char
  })
}

/** インライン配列をクォートを考慮して分割する。 */
function splitInlineList(value: string): string[] {
  const items: string[] = []
  let buffer = ''
  let quote: '"' | "'" | null = null

  for (const char of value) {
    if (quote !== null) {
      buffer += char
      if (char === quote) {
        quote = null
      }
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      buffer += char
      continue
    }
    if (char === ',') {
      items.push(buffer.trim())
      buffer = ''
      continue
    }
    buffer += char
  }

  if (buffer.trim() !== '') {
    items.push(buffer.trim())
  }

  return items
}

/** frontmatter の値を単一の文字列として読む（配列はカンマ結合）。 */
export function readString(data: Frontmatter, key: string): string | undefined {
  const value = data[key]
  if (value === undefined) {
    return undefined
  }
  return Array.isArray(value) ? value.join(', ') : value
}

export type StringListResult = { ok: true; items: string[] } | { ok: false; reason: string }

/**
 * frontmatter の値を文字列のリストとして厳密に読む。
 * キーがなければ空のリスト。スカラーと値なし (`key:` だけ) はリストではないのでエラー。空文字の項目もエラー。
 */
export function readStringList(data: Frontmatter, key: string): StringListResult {
  const value = data[key]
  if (value === undefined) {
    return { ok: true, items: [] }
  }
  if (!Array.isArray(value)) {
    return { ok: false, reason: `${key} はリストで書く必要があります (\`${key}: [a, b]\` か \`- a\` の行。ない場合はキーごと省く)` }
  }
  if (value.some((item) => item.trim() === '')) {
    return { ok: false, reason: `${key} に空の項目があります` }
  }
  return { ok: true, items: value }
}
