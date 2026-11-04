/** mono / 16bit PCM の WAV だけを扱う最小実装 */

export type Pcm = { readonly sampleRate: number; readonly samples: Int16Array }

const ascii = (view: DataView, offset: number, length: number): string =>
  String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(offset + i)))

export const decodeWav = (bytes: Uint8Array): Pcm => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.byteLength < 12 || ascii(view, 0, 4) !== "RIFF" || ascii(view, 8, 4) !== "WAVE") {
    throw new Error("WAV ではありません")
  }
  let sampleRate: number | undefined
  let offset = 12
  while (offset + 8 <= bytes.byteLength) {
    const id = ascii(view, offset, 4)
    const size = view.getUint32(offset + 4, true)
    const body = offset + 8
    if (id === "fmt ") {
      const format = view.getUint16(body, true)
      const channels = view.getUint16(body + 2, true)
      const bits = view.getUint16(body + 14, true)
      if (format !== 1 || channels !== 1 || bits !== 16) {
        throw new Error(
          `mono 16bit PCM 以外の WAV です (format ${format}, ${channels}ch, ${bits}bit)`,
        )
      }
      sampleRate = view.getUint32(body + 4, true)
    } else if (id === "data") {
      if (sampleRate === undefined) throw new Error("WAV の fmt チャンクが data より後にあります")
      const length = Math.min(size, bytes.byteLength - body) >> 1
      const samples = new Int16Array(length)
      for (let i = 0; i < length; i++) samples[i] = view.getInt16(body + i * 2, true)
      return { sampleRate, samples }
    }
    // チャンクは偶数境界に揃えられる (奇数長なら 1 バイトの詰め物がある)
    offset = body + size + (size % 2)
  }
  throw new Error("WAV に data チャンクがありません")
}

export const encodeWav = ({ sampleRate, samples }: Pcm): Uint8Array => {
  const dataSize = samples.length * 2
  const bytes = new Uint8Array(44 + dataSize)
  const view = new DataView(bytes.buffer)
  const writeAscii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  writeAscii(0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(8, "WAVE")
  writeAscii(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(36, "data")
  view.setUint32(40, dataSize, true)
  samples.forEach((v, i) => view.setInt16(44 + i * 2, v, true))
  return bytes
}

/**
 * 各セリフの音声を length サンプルまで無音で埋めて連結する。
 * length をタイムラインの cue の長さから決めるので、映像と音声がずれない
 */
export const concatPadded = (
  segments: readonly { readonly samples: Int16Array; readonly length: number }[],
): Int16Array => {
  const out = new Int16Array(segments.reduce((sum, s) => sum + s.length, 0))
  let cursor = 0
  for (const { samples, length } of segments) {
    out.set(samples.subarray(0, length), cursor)
    cursor += length
  }
  return out
}
