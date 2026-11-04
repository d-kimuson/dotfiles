import { describe, expect, it } from "vitest"
import { sampleEpisode } from "../testing/fixtures.ts"
import { buildTimeline, resolveReveals } from "./timeline.ts"

const config = { fps: 30, sampleRate: 24000, gapSeconds: 0.25, sceneGapSeconds: 0.6 }

describe("resolveReveals", () => {
  it("reveal を使うシーンは 0 件から始めて直前の値を引き継ぐ", () => {
    const scene = sampleEpisode().scenes[0]
    expect(scene && resolveReveals(scene)).toEqual([0, 1, 2])
  })

  it("段階表示できないスライドは null", () => {
    const scene = sampleEpisode().scenes[1]
    expect(scene && resolveReveals(scene)).toEqual([null])
  })
})

describe("buildTimeline", () => {
  it("発話を切り上げたフレームに、セリフ間とシーン間 (最終シーン以外) の無音を足す", () => {
    // 1 フレーム = 800 サンプル。801 サンプルは 2 フレーム
    const timeline = buildTimeline(sampleEpisode(), [[800, 801, 24000], [800]], config)
    expect(timeline.cues.map((c) => [c.startFrame, c.speechFrames, c.totalFrames])).toEqual([
      [0, 1, 1 + 8],
      [9, 2, 2 + 8],
      [19, 30, 30 + 8 + 18],
      [75, 1, 1 + 8],
    ])
    expect(timeline.chapters).toEqual([
      { sceneIndex: 0, title: "理由", startFrame: 0 },
      { sceneIndex: 1, title: "まとめ", startFrame: 75 },
    ])
    expect(timeline.totalFrames).toBe(84)
  })

  it("1 フレームのサンプル数が整数にならない設定は拒否する", () => {
    expect(() => buildTimeline(sampleEpisode(), [], { ...config, sampleRate: 24010 })).toThrow(
      "割り切れる",
    )
  })

  it("音声が足りなければ失敗する", () => {
    expect(() => buildTimeline(sampleEpisode(), [[800]], config)).toThrow("scenes[0].lines[1]")
  })
})
