import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { sampleEpisode } from "../testing/fixtures.ts"
import { buildTimeline } from "../timeline/timeline.ts"
import { buildPlayerPage } from "./playerPage.ts"
import { buildTranscript } from "./transcript.ts"

const episode = sampleEpisode()
const timeline = buildTimeline(episode, [[24000, 24000, 24000], [12000]], {
  fps: 30,
  sampleRate: 24000,
  gapSeconds: 0,
  sceneGapSeconds: 0,
})

describe("buildTranscript", () => {
  it("フレームを秒に直して目次と字幕を作る", () => {
    const transcript = buildTranscript(episode, timeline)
    assert.equal(transcript.durationSeconds, 3.5)
    assert.deepEqual(transcript.chapters, [
      { title: "理由", start: 0 },
      { title: "まとめ", start: 3 },
    ])
    assert.deepEqual(transcript.lines[3], {
      start: 3,
      end: 3.5,
      speaker: "zundamon",
      text: "わかったのだ！",
      chapterIndex: 1,
    })
  })
})

describe("buildPlayerPage", () => {
  it("埋め込む JSON の < をエスケープして script を閉じさせない", () => {
    const transcript = {
      ...buildTranscript(episode, timeline),
      summary: "</script><script>alert(1)</script>",
    }
    const page = buildPlayerPage(transcript, "video.mp4")
    assert.ok(!page.includes("</script><script>alert"))
    assert.ok(page.includes("VOICEVOX:ずんだもん / VOICEVOX:四国めたん"))
  })
})
