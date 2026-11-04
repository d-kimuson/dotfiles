import { z } from "zod"

export const DEFAULT_VOICEVOX_URL = "http://127.0.0.1:50021"

export const Speakers = z.array(
  z.looseObject({
    name: z.string(),
    speaker_uuid: z.string(),
    styles: z.array(z.looseObject({ name: z.string(), id: z.number().int() })),
  }),
)
export type Speakers = z.infer<typeof Speakers>

export const SpeakerInfo = z.looseObject({
  policy: z.string(),
  /** base64 の PNG */
  portrait: z.string(),
  style_infos: z.array(
    z.looseObject({ id: z.number().int(), portrait: z.string().nullish(), icon: z.string() }),
  ),
})
export type SpeakerInfo = z.infer<typeof SpeakerInfo>

/** 合成パラメータ。読み上げ調整で上書きするフィールドだけ型を付ける */
export const AudioQuery = z.looseObject({
  speedScale: z.number(),
  pitchScale: z.number(),
  intonationScale: z.number(),
  volumeScale: z.number(),
  prePhonemeLength: z.number(),
  postPhonemeLength: z.number(),
  outputSamplingRate: z.number().int(),
  outputStereo: z.boolean(),
  /** AquesTalk 風の読み (アクセント付きカナ)。誤読の確認に使う */
  kana: z.string(),
})
export type AudioQuery = z.infer<typeof AudioQuery>

export type StyleRef = { readonly speakerName: string; readonly styleName: string }
export type ResolvedStyle = { readonly styleId: number; readonly speakerUuid: string }

export const resolveStyleId = (speakers: Speakers, ref: StyleRef): ResolvedStyle => {
  const speaker = speakers.find((s) => s.name === ref.speakerName)
  const style = speaker?.styles.find((s) => s.name === ref.styleName)
  if (!speaker || !style) {
    const available = speakers.flatMap((s) => s.styles.map((st) => `${s.name}/${st.name}`))
    throw new Error(
      `VOICEVOX に ${ref.speakerName}/${ref.styleName} がありません。使えるもの: ${available.join(", ")}`,
    )
  }
  return { styleId: style.id, speakerUuid: speaker.speaker_uuid }
}

export type VoicevoxClient = {
  version: () => Promise<string>
  speakers: () => Promise<Speakers>
  speakerInfo: (speakerUuid: string) => Promise<SpeakerInfo>
  audioQuery: (text: string, styleId: number) => Promise<AudioQuery>
  /** WAV のバイト列を返す */
  synthesis: (query: AudioQuery, styleId: number) => Promise<Uint8Array>
}

/** 応答がないまま固まったときに CLI ごと止まらないようにする */
const TIMEOUT_MS = { probe: 3000, default: 30_000, synthesis: 120_000 } as const

export const createVoicevoxClient = (baseUrl: string = DEFAULT_VOICEVOX_URL): VoicevoxClient => {
  const request = async (
    path: string,
    params: Record<string, string>,
    timeoutMs: number,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = new URL(path, baseUrl)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch(
      (error: unknown) => {
        if (error instanceof DOMException && error.name === "TimeoutError") {
          throw new Error(`VOICEVOX ${path} が ${timeoutMs / 1000} 秒以内に応答しませんでした`, {
            cause: error,
          })
        }
        throw error
      },
    )
    if (!res.ok) {
      throw new Error(`VOICEVOX ${path} が ${res.status} を返しました: ${await res.text()}`)
    }
    return res
  }
  const json = async <T>(schema: z.ZodType<T>, res: Promise<Response>): Promise<T> =>
    schema.parse(await (await res).json())

  return {
    version: async () => json(z.string(), request("/version", {}, TIMEOUT_MS.probe)),
    speakers: async () => json(Speakers, request("/speakers", {}, TIMEOUT_MS.default)),
    speakerInfo: async (speakerUuid) =>
      json(
        SpeakerInfo,
        request(
          "/speaker_info",
          { speaker_uuid: speakerUuid, resource_format: "base64" },
          TIMEOUT_MS.default,
        ),
      ),
    audioQuery: async (text, styleId) =>
      json(
        AudioQuery,
        request("/audio_query", { text, speaker: String(styleId) }, TIMEOUT_MS.default, {
          method: "POST",
        }),
      ),
    synthesis: async (query, styleId) => {
      const res = await request("/synthesis", { speaker: String(styleId) }, TIMEOUT_MS.synthesis, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(query),
      })
      return new Uint8Array(await res.arrayBuffer())
    },
  }
}
