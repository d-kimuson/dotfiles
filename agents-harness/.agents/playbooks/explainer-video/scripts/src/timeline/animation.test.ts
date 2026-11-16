import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { bounceForTimeline, bounceTrack } from "./animation.ts"

const config = { fps: 30, sampleRate: 24000, voicedRatio: 0.12, cycleFrames: 4 }

const framesOf = (levels: readonly number[]): Int16Array =>
  Int16Array.from(levels.flatMap((level) => Array.from({ length: 800 }, () => level)))

describe("bounceTrack", () => {
  it("発声中は周期的に上下し、無音で 0 に戻って位相も戻る", () => {
    const samples = framesOf([1000, 1000, 1000, 1000, 1000, 0, 1000])
    assert.deepEqual(bounceTrack(samples, 8, config), [0, 0.707, 1, 0.707, 0, 0, 0, 0])
  })

  it("無音だけなら弾まない", () => {
    assert.deepEqual(bounceTrack(new Int16Array(1600), 2, config), [0, 0])
  })
})

describe("bounceForTimeline", () => {
  it("セリフごとの弾みをフレーム順につなぎ、静かなセリフも音量を正規化する", () => {
    const loud = framesOf([1000, 1000, 1000])
    const quiet = framesOf([10, 10, 10])
    const track = bounceForTimeline(
      [{ totalFrames: 4 }, { totalFrames: 3 }],
      (i) => (i === 0 ? loud : quiet),
      config,
    )
    assert.deepEqual(track, [0, 0.707, 1, 0, 0, 0.707, 1])
  })
})
