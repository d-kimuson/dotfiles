import type { ContentSpec, Entry } from './content.ts'
import { CONTENT_SPECS } from './content.ts'

export type SearchHit = {
  entry: Entry
  score: number
  /** ヒットしたフィールド（`name` / `description` / `body`）。 */
  matched: string[]
}

const SCORE_NAME_EXACT = 40
const SCORE_NAME_PARTIAL = 20
const SCORE_DESCRIPTION = 8
const SCORE_BODY = 3
const BODY_OCCURRENCE_BONUS_CAP = 5

/** クエリを正規化して空白区切りのトークンにする。 */
export function tokenize(query: string): string[] {
  return query
    .normalize('NFKC')
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token !== '')
}

/**
 * 全文検索。全トークンがどこかにヒットしたエントリだけを返す（AND）。
 * スコア降順、同点は名前順。
 */
export function searchEntries(entries: Entry[], query: string): SearchHit[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) {
    return []
  }

  const hits: SearchHit[] = []
  for (const entry of entries) {
    const name = entry.name.normalize('NFKC').toLowerCase()
    const description = entry.description.normalize('NFKC').toLowerCase()
    const body = entry.body.normalize('NFKC').toLowerCase()

    let score = 0
    const matched = new Set<string>()
    let everyTokenHit = true

    for (const token of tokens) {
      let tokenScore = 0
      if (name === token) {
        tokenScore += SCORE_NAME_EXACT
        matched.add('name')
      } else if (name.includes(token)) {
        tokenScore += SCORE_NAME_PARTIAL
        matched.add('name')
      }
      if (description.includes(token)) {
        tokenScore += SCORE_DESCRIPTION
        matched.add('description')
      }
      const occurrences = countOccurrences(body, token)
      if (occurrences > 0) {
        tokenScore += SCORE_BODY + Math.min(occurrences, BODY_OCCURRENCE_BONUS_CAP)
        matched.add('body')
      }
      if (tokenScore === 0) {
        everyTokenHit = false
        break
      }
      score += tokenScore
    }

    if (!everyTokenHit) {
      continue
    }
    hits.push({ entry, score, matched: [...matched] })
  }

  return hits.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score
    }
    return left.entry.name.localeCompare(right.entry.name, 'en')
  })
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle === '') {
    return 0
  }
  let count = 0
  let index = haystack.indexOf(needle)
  while (index !== -1 && count < 100) {
    count += 1
    index = haystack.indexOf(needle, index + needle.length)
  }
  return count
}

/** 検索対象のラベル（help 表示用）。 */
export function searchLabel(spec: ContentSpec): string {
  return spec.dirName
}

export function kindLabel(kind: Entry['kind']): string {
  return CONTENT_SPECS[kind].label
}
