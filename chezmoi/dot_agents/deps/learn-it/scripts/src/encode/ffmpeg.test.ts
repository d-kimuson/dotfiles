import { describe, expect, it } from "vitest"
import { encodeArgs } from "./ffmpeg.ts"

describe("encodeArgs", () => {
  it("静止画リストと音声を入力にし、指定の fps と crf で出力する", () => {
    const args = encodeArgs({
      concatListPath: "l.ffconcat",
      audioPath: "a.wav",
      outPath: "v.mp4",
      fps: 30,
      crf: 32,
    })
    expect(args.slice(0, 11)).toEqual([
      "-y",
      "-v",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      "l.ffconcat",
      "-i",
      "a.wav",
    ])
    expect(args[args.indexOf("-crf") + 1]).toBe("32")
    expect(args[args.indexOf("-r") + 1]).toBe("30")
    expect(args.at(-1)).toBe("v.mp4")
  })
})
