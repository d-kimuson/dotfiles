import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveStyleId } from "./api.ts"

const speakers = [{ name: "ずんだもん", speaker_uuid: "u1", styles: [{ name: "ノーマル", id: 3 }] }]

describe("resolveStyleId", () => {
  it("話者名とスタイル名から styleId を引く", () => {
    assert.deepEqual(
      resolveStyleId(speakers, { speakerName: "ずんだもん", styleName: "ノーマル" }),
      { styleId: 3, speakerUuid: "u1" },
    )
  })

  it("見つからなければ使えるものを添えて失敗する", () => {
    assert.throws(
      () => resolveStyleId(speakers, { speakerName: "ずんだもん", styleName: "ささやき" }),
      /使えるもの: ずんだもん\/ノーマル/,
    )
  })
})
