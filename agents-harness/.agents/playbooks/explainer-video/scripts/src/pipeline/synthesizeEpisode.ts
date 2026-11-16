import { join } from "node:path"
import { decodeWav } from "../audio/wav.ts"
import { CAST } from "../cast/cast.ts"
import { ensurePortraits, type Portraits } from "../cast/portraits.ts"
import { type Episode } from "../script/schema.ts"
import { resolveStyleId } from "../voicevox/api.ts"
import { withVoicevox } from "../voicevox/engine.ts"
import { synthesize } from "../voicevox/synthesize.ts"
import { SAMPLE_RATE } from "./config.ts"

export type Synthesized = {
  readonly portraits: Portraits
  /** speeches[sceneIndex][lineIndex] の音声サンプル */
  readonly speeches: readonly (readonly Int16Array[])[]
}

/**
 * VOICEVOX で全セリフを合成し、立ち絵を用意する。合成済みのセリフはキャッシュから返すので、
 * 台本のうち変えた行だけがエンジンを動かす
 */
export const synthesizeEpisode = async (options: {
  readonly episode: Episode
  readonly cacheDir: string
  readonly voicevoxUrl: string
  readonly log: (message: string) => void
}): Promise<Synthesized> => {
  const { episode, cacheDir, voicevoxUrl, log } = options
  return withVoicevox(voicevoxUrl, log, async (client) => {
    const portraits = await ensurePortraits(client, join(cacheDir, "voicevox"))
    const speakers = await client.speakers()
    const engineVersion = await client.version()
    const total = episode.scenes.reduce((n, s) => n + s.lines.length, 0)
    let done = 0
    const speeches: Int16Array[][] = []
    // エンジンは 1 リクエストで CPU を使い切るので、並列にしても速くならない
    for (const scene of episode.scenes) {
      const row: Int16Array[] = []
      for (const line of scene.lines) {
        const member = CAST[line.speaker]
        const { styleId } = resolveStyleId(speakers, member.voicevox)
        const wav = await synthesize(client, join(cacheDir, "tts"), {
          text: line.yomi ?? line.text,
          styleId,
          member,
          sampleRate: SAMPLE_RATE,
          engineVersion,
        })
        const pcm = decodeWav(wav)
        if (pcm.sampleRate !== SAMPLE_RATE) {
          throw new Error(
            `合成した音声のサンプルレートが ${pcm.sampleRate} です (期待値 ${SAMPLE_RATE})`,
          )
        }
        row.push(pcm.samples)
        done++
        if (done % 20 === 0 || done === total) log(`  ${done}/${total}`)
      }
      speeches.push(row)
    }
    return { portraits, speeches }
  })
}
