import { describe, expect, it } from "vitest"
import { planFrames, toFfconcat } from "./framePlan.ts"
import { type Timeline } from "./timeline.ts"

const timeline: Timeline = {
  fps: 30,
  totalFrames: 5,
  chapters: [],
  cues: [
    {
      index: 0,
      sceneIndex: 0,
      lineIndex: 0,
      startFrame: 0,
      speechFrames: 3,
      totalFrames: 3,
      reveal: null,
    },
    {
      index: 1,
      sceneIndex: 0,
      lineIndex: 1,
      startFrame: 3,
      speechFrames: 2,
      totalFrames: 2,
      reveal: null,
    },
  ],
}

describe("planFrames", () => {
  it("(cue, pose) ごとに 1 回だけ撮り、連続する同じ絵を run にまとめる", () => {
    const plan = planFrames(timeline, [[true, true, false], [false]])
    expect(plan.shots.map((s) => s.key)).toEqual(["c0000-b1", "c0000-b0", "c0001-b0"])
    expect(plan.runs).toEqual([
      { shotKey: "c0000-b1", frames: 2 },
      { shotKey: "c0000-b0", frames: 1 },
      { shotKey: "c0001-b0", frames: 2 },
    ])
  })
})

describe("toFfconcat", () => {
  it("最後のファイルを重ねて書き、パスの引用符をエスケープする", () => {
    const list = toFfconcat(
      [
        { shotKey: "a", frames: 15 },
        { shotKey: "b'c", frames: 30 },
      ],
      30,
      (k) => `/f/${k}.png`,
    )
    expect(list).toBe(
      [
        "ffconcat version 1.0",
        "file '/f/a.png'",
        "duration 0.500000",
        "file '/f/b'\\''c.png'",
        "duration 1.000000",
        "file '/f/b'\\''c.png'",
        "",
      ].join("\n"),
    )
  })
})
