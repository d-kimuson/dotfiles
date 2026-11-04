import { CAST } from "../cast/cast.ts"
import { type Speaker } from "../script/schema.ts"
import { resolveStyleId } from "../voicevox/api.ts"
import { withVoicevox } from "../voicevox/engine.ts"

export type ReadingOptions = {
  readonly texts: readonly string[]
  readonly speaker: Speaker
  readonly voicevoxUrl: string
  readonly log: (message: string) => void
}

/** VOICEVOX が text をどう読むか (アクセント付きカナ) を返す。yomi を書くか決めるのに使う */
export const readings = async ({
  texts,
  speaker,
  voicevoxUrl,
  log,
}: ReadingOptions): Promise<readonly string[]> =>
  withVoicevox(voicevoxUrl, log, async (client) => {
    const { styleId } = resolveStyleId(await client.speakers(), CAST[speaker].voicevox)
    const kana: string[] = []
    for (const text of texts) kana.push((await client.audioQuery(text, styleId)).kana)
    return kana
  })
