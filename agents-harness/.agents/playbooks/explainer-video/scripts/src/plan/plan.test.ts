import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { type Portraits } from "../cast/portraits.ts"
import { sampleEpisode } from "../testing/fixtures.ts"
import { buildTimeline } from "../timeline/timeline.ts"
import {
  buildPlan,
  collectFontText,
  cueAt,
  fsUrl,
  previewFrames,
  previewSpeechSamples,
  revealStartFrame,
  sceneIndexAt,
} from "./plan.ts"

const episode = sampleEpisode()
const config = { fps: 30, sampleRate: 24000, gapSeconds: 0.25, sceneGapSeconds: 0.6 }
const timeline = buildTimeline(episode, [[800, 801, 24000], [800]], config)
const portraits: Portraits = {
  zundamon: { base: "/c/z.png", faces: { happy: "/c/z happy.png" } },
  metan: { base: "/c/m.png", faces: {} },
}
const plan = buildPlan({
  episode,
  timeline,
  bounce: Array.from({ length: timeline.totalFrames }, () => 0),
  portraits,
  audioPath: null,
})

describe("buildPlan", () => {
  it("シーンの範囲とセリフ (表情の既定値・段階表示件数) を持つ", () => {
    assert.deepEqual(
      plan.scenes.map((s) => [s.startFrame, s.totalFrames, s.cues.length]),
      [
        [0, 75, 3],
        [75, 9, 1],
      ],
    )
    assert.deepEqual(plan.scenes[0]?.cues.map((c) => [c.speaker, c.face, c.partnerFace, c.reveal]), [
      ["zundamon", "normal", "normal", 0],
      ["metan", "smug", "surprised", 1],
      ["metan", "normal", "normal", 2],
    ])
    assert.equal(plan.totalFrames, 84)
  })

  it("立ち絵は /@fs/ の URL にし、空白をエスケープする", () => {
    assert.equal(plan.portraits.zundamon.base, "/@fs/c/z.png")
    assert.equal(plan.portraits.zundamon.faces.happy, "/@fs/c/z%20happy.png")
    assert.equal(fsUrl("/a/b.png"), "/@fs/a/b.png")
  })

  it("bounce の長さが総フレーム数と違えば拒否する", () => {
    assert.throws(
      () => buildPlan({ episode, timeline, bounce: [0], portraits, audioPath: null }),
      /bounce/,
    )
  })
})

describe("collectFontText", () => {
  it("画面に出る文字を重複なしで集める", () => {
    const text = collectFontText(episode, "VOICEVOX:ずんだもん")
    assert.ok(text.includes("ず") && text.includes("テ") && text.includes("◆"))
    assert.equal(text.length, new Set(text).size)
  })
})

describe("cueAt", () => {
  it("フレームを含むセリフを返し、シーンの外は null", () => {
    const scene = plan.scenes[0]
    assert.ok(scene)
    assert.equal(cueAt(scene, 0)?.text, "なぜなのだ？")
    assert.equal(cueAt(scene, 9)?.text, "一つ目はこれよ。")
    assert.equal(cueAt(scene, 74)?.text, "二つ目はこれ。")
    assert.equal(cueAt(scene, 75), null)
  })
})

describe("revealStartFrame", () => {
  it("件数が切り替わったセリフの開始フレームを返し、同じ件数が続けばその先頭まで遡る", () => {
    const scene = plan.scenes[0]
    assert.ok(scene)
    const [first, second, third] = scene.cues
    assert.ok(first && second && third)
    assert.equal(revealStartFrame(scene, second), 9)
    assert.equal(revealStartFrame(scene, third), 19)
    const flat = { ...scene, cues: scene.cues.map((cue) => ({ ...cue, reveal: 1 })) }
    assert.equal(revealStartFrame(flat, flat.cues[2] ?? third), 0)
  })

  it("段階表示しないシーンでは null", () => {
    const scene = plan.scenes[1]
    assert.ok(scene?.cues[0])
    assert.equal(revealStartFrame(scene, scene.cues[0]), null)
  })
})

describe("sceneIndexAt", () => {
  it("フレームが属するシーンの番号を返し、範囲外は null", () => {
    assert.equal(sceneIndexAt(plan, 0), 0)
    assert.equal(sceneIndexAt(plan, 74), 0)
    assert.equal(sceneIndexAt(plan, 75), 1)
    assert.equal(sceneIndexAt(plan, 84), null)
  })
})

describe("previewFrames", () => {
  it("各シーンの最後のセリフの中で、入場アニメーションが終わったフレームを選ぶ", () => {
    // 最後のセリフは 19 から 56 フレーム (30 + 8 + 18) と 75 から 9 フレーム
    assert.deepEqual(previewFrames(plan), [39, 83])
  })

  it("preview では全セリフを 1 秒とみなす", () => {
    assert.deepEqual(previewSpeechSamples(episode, 24000), [[24000, 24000, 24000], [24000]])
  })
})
