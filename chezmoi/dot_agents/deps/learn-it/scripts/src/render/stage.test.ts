import { describe, expect, it } from "vitest"
import { sampleEpisode } from "../testing/fixtures.ts"
import { buildTimeline } from "../timeline/timeline.ts"
import { frameStateFor } from "./frameState.ts"
import { renderStage } from "./stage.ts"

const episode = sampleEpisode()
const timeline = buildTimeline(episode, [[800, 800, 800], [800]], {
  fps: 30,
  sampleRate: 24000,
  gapSeconds: 0,
  sceneGapSeconds: 0,
})
const cue = (i: number) => {
  const c = timeline.cues[i]
  if (!c) throw new Error("no cue")
  return c
}

describe("frameStateFor", () => {
  it("話者に face と弾みを、聞き手に partnerFace を当てる", () => {
    const state = frameStateFor(episode, cue(1), { bounce: true })
    expect(state.characters).toEqual({
      metan: { face: "smug", bounce: true, speaking: true },
      zundamon: { face: "surprised", bounce: false, speaking: false },
    })
  })
})

describe("renderStage", () => {
  it("未表示の項目は隠し、直近の項目を強調する", () => {
    const html = renderStage(frameStateFor(episode, cue(1), { bounce: false }))
    expect(html).toContain('<li class="is-latest">一つ目</li>')
    expect(html).toContain('<li class="is-hidden">二つ目</li>')
  })

  it("台本の文字列をエスケープする", () => {
    const state = frameStateFor(episode, cue(0), { bounce: false })
    const html = renderStage({ ...state, subtitle: { speaker: "zundamon", text: "<b>&" } })
    expect(html).toContain("&lt;b&gt;&amp;")
  })

  it("クレジットを必ず出す", () => {
    const html = renderStage(frameStateFor(episode, cue(0), { bounce: false }))
    expect(html).toContain("VOICEVOX:ずんだもん / VOICEVOX:四国めたん")
  })
})
