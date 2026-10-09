import { describe, expect, it } from "vitest"
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
    expect(transcript.durationSeconds).toBe(3.5)
    expect(transcript.chapters).toEqual([
      { title: "理由", start: 0 },
      { title: "まとめ", start: 3 },
    ])
    expect(transcript.lines[3]).toEqual({
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
    expect(page).not.toContain("</script><script>alert")
    expect(page).toContain("VOICEVOX:ずんだもん / VOICEVOX:四国めたん")
  })
})
