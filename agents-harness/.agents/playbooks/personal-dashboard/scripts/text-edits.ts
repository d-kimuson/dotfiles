// 書く前と後の本文の差分を、順に当てる置き換え (oldText → newText) の列にする。
export type TextEdit = { oldText: string; newText: string }

// 置き換えは順に当たるので、各 oldText は前の置き換えを当てた後の本文で 1 か所にだけ当たるまで前後の行を広げる。
// max を渡すと、置き換えがその件数を超えたときに失敗する。
export function editsBetween(before: string, after: string, max?: number): TextEdit[] {
  const a = before.split(/(?<=\n)/)
  const b = after.split(/(?<=\n)/)
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  let tail = 0
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++
  const ai = a.slice(head, a.length - tail)
  const bi = b.slice(head, b.length - tail)
  // 違う範囲の中で LCS を取り、一致しない行の塊を hunk にする。
  const n = ai.length
  const m = bi.length
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i]![j] = ai[i] === bi[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
  const hunks: { a1: number; a2: number; b1: number; b2: number }[] = []
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && ai[i] === bi[j]) {
      i++
      j++
      continue
    }
    const a1 = i
    const b1 = j
    while ((i < n || j < m) && !(i < n && j < m && ai[i] === bi[j])) {
      if (j >= m || (i < n && lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) i++
      else j++
    }
    hunks.push({ a1: head + a1, a2: head + i, b1: head + b1, b2: head + j })
  }
  const edits: TextEdit[] = []
  // 置き換えは順に当たるので、1 か所に当たるかは前の置き換えを当てた後の本文で数える。
  let current = before
  let prevEnd = 0
  for (let k = 0; k < hunks.length; k++) {
    const h = { ...hunks[k]! }
    for (let ctx = 0; ; ctx++) {
      const nextStart = hunks[k + 1]?.a1 ?? a.length
      const lo = Math.max(prevEnd, h.a1 - ctx)
      const hi = Math.min(nextStart, h.a2 + ctx)
      const oldText = a.slice(lo, hi).join("")
      if (oldText !== "" && occurrences(current, oldText) === 1) {
        const newText = a.slice(lo, h.a1).join("") + b.slice(h.b1, h.b2).join("") + a.slice(h.a2, hi).join("")
        edits.push({ oldText, newText })
        current = current.replace(oldText, () => newText)
        prevEnd = hi
        break
      }
      // 隣の hunk まで広げても 1 か所に絞れなければ、隣と 1 つにまとめる。
      if (lo === prevEnd && hi === nextStart) {
        const next = hunks[k + 1]
        if (next === undefined) throw new Error("置き換えの範囲を 1 か所に絞れない")
        h.a2 = next.a2
        h.b2 = next.b2
        k++
      }
    }
  }
  if (max !== undefined && edits.length > max) throw new Error(`置き換えが ${edits.length} 件あり、上限 ${max} 件を超える`)
  if (applyEdits(before, edits) !== after) throw new Error("置き換えを当てても書いた後の HTML にならない")
  return edits
}

// 重なる出現も数える。1 か所かどうかだけを見るので 2 で打ち切る。
const occurrences = (text: string, part: string): number => {
  const first = text.indexOf(part)
  if (first === -1) return 0
  return text.indexOf(part, first + 1) === -1 ? 1 : 2
}

export function applyEdits(text: string, edits: TextEdit[]): string {
  let out = text
  for (const edit of edits) {
    const at = out.indexOf(edit.oldText)
    if (at === -1 || occurrences(out, edit.oldText) !== 1) throw new Error("oldText が 1 か所に当たらない")
    out = out.slice(0, at) + edit.newText + out.slice(at + edit.oldText.length)
  }
  return out
}
