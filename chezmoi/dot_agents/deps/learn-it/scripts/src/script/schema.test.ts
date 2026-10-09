import { describe, expect, it } from "vitest"
import { parseEpisode } from "./schema.ts"

const base = {
  title: "t",
  summary: "s",
  scenes: [
    {
      chapter: "c",
      slide: { kind: "bullets", heading: "h", items: ["a", "b"] },
      lines: [{ speaker: "metan", text: "x" }],
    },
  ],
}

const withLine = (slide: unknown, line: unknown): unknown => ({
  ...base,
  scenes: [{ chapter: "c", slide, lines: [line] }],
})

describe("parseEpisode", () => {
  it("sources を省略すると空配列になる", () => {
    const result = parseEpisode(base)
    expect(result.ok && result.episode.sources).toEqual([])
  })

  it("reveal が項目数を超えるとパス付きで失敗する", () => {
    const result = parseEpisode(
      withLine(
        { kind: "bullets", heading: "h", items: ["a"] },
        { speaker: "metan", text: "x", reveal: 2 },
      ),
    )
    expect(result).toEqual({
      ok: false,
      issues: ["scenes.0.lines.0.reveal: reveal は項目数 (1) 以下にしてください"],
    })
  })

  it("段階表示できないスライドでは reveal を使えない", () => {
    const result = parseEpisode(
      withLine({ kind: "keyword", word: "w" }, { speaker: "metan", text: "x", reveal: 0 }),
    )
    expect(result.ok).toBe(false)
  })

  it("table の各行は columns と同じ列数でなければならない", () => {
    const result = parseEpisode(
      withLine(
        { kind: "table", heading: "h", columns: ["a", "b"], rows: [["1"]] },
        { speaker: "metan", text: "x" },
      ),
    )
    expect(result).toEqual({
      ok: false,
      issues: ["scenes.0.slide.rows: rows の各行は columns と同じ列数にしてください"],
    })
  })

  it("知らないフィールドを拒否する", () => {
    const result = parseEpisode(
      withLine({ kind: "keyword", word: "w" }, { speaker: "metan", text: "x", voice: 1 }),
    )
    expect(result.ok).toBe(false)
  })
})
