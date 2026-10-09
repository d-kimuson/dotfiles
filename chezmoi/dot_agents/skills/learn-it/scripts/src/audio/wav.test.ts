import { describe, expect, it } from "vitest"
import { concatPadded, decodeWav, encodeWav } from "./wav.ts"

describe("wav", () => {
  it("encode した WAV を decode すると元に戻る", () => {
    const samples = Int16Array.from([0, 1, -1, 32767, -32768])
    expect(decodeWav(encodeWav({ sampleRate: 24000, samples }))).toEqual({
      sampleRate: 24000,
      samples,
    })
  })

  it("奇数長のチャンクの詰め物を飛ばして data を読む", () => {
    const wav = encodeWav({ sampleRate: 24000, samples: Int16Array.from([7, 8]) })
    // fmt と data の間に 3 バイトの LIST チャンク (+ 詰め物 1 バイト) を差し込む
    const extra = Uint8Array.from([0x4c, 0x49, 0x53, 0x54, 3, 0, 0, 0, 1, 2, 3, 0])
    const bytes = new Uint8Array(wav.length + extra.length)
    bytes.set(wav.subarray(0, 36))
    bytes.set(extra, 36)
    bytes.set(wav.subarray(36), 36 + extra.length)
    expect(decodeWav(bytes).samples).toEqual(Int16Array.from([7, 8]))
  })

  it("mono 16bit 以外は拒否する", () => {
    const wav = encodeWav({ sampleRate: 24000, samples: new Int16Array(1) })
    new DataView(wav.buffer).setUint16(22, 2, true)
    expect(() => decodeWav(wav)).toThrow("mono 16bit PCM")
  })

  it("concatPadded は各区間を length まで無音で埋め、長ければ切る", () => {
    const out = concatPadded([
      { samples: Int16Array.from([1, 2]), length: 4 },
      { samples: Int16Array.from([3, 4, 5]), length: 2 },
    ])
    expect(out).toEqual(Int16Array.from([1, 2, 0, 0, 3, 4]))
  })
})
