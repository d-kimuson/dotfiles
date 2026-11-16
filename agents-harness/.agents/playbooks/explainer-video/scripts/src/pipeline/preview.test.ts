import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { previewName } from "./preview.ts"

describe("previewName", () => {
  it("シーン番号を 1 始まり 2 桁で並べる", () => {
    assert.equal(previewName(0), "scene-01.png")
    assert.equal(previewName(11), "scene-12.png")
  })
})
