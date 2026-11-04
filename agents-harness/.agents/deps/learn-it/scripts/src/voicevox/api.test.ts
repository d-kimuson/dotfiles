import { describe, expect, it } from "vitest"
import { resolveStyleId } from "./api.ts"

const speakers = [{ name: "ずんだもん", speaker_uuid: "u1", styles: [{ name: "ノーマル", id: 3 }] }]

describe("resolveStyleId", () => {
  it("話者名とスタイル名から styleId を引く", () => {
    expect(resolveStyleId(speakers, { speakerName: "ずんだもん", styleName: "ノーマル" })).toEqual({
      styleId: 3,
      speakerUuid: "u1",
    })
  })

  it("見つからなければ使えるものを添えて失敗する", () => {
    expect(() =>
      resolveStyleId(speakers, { speakerName: "ずんだもん", styleName: "ささやき" }),
    ).toThrow("使えるもの: ずんだもん/ノーマル")
  })
})
