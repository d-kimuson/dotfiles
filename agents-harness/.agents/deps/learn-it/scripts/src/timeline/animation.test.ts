import { describe, expect, it } from "vitest"
import { bounceTrack } from "./animation.ts"

const config = { fps: 30, sampleRate: 24000, voicedRatio: 0.12, upFrames: 2, downFrames: 2 }

const framesOf = (levels: readonly number[]): Int16Array =>
  Int16Array.from(levels.flatMap((level) => Array.from({ length: 800 }, () => level)))

describe("bounceTrack", () => {
  it("発声中は up/down を繰り返し、無音で位相ごと元に戻る", () => {
    const samples = framesOf([1000, 1000, 1000, 1000, 1000, 0, 1000])
    expect(bounceTrack(samples, 8, config)).toEqual([
      true,
      true,
      false,
      false,
      true,
      false,
      true,
      false,
    ])
  })

  it("無音だけなら弾まない", () => {
    expect(bounceTrack(new Int16Array(1600), 2, config)).toEqual([false, false])
  })
})
