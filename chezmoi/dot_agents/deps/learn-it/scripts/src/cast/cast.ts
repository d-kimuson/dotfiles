import { type Face, type Speaker } from "../script/schema.ts"

export type VoiceParams = {
  readonly speedScale: number
  readonly pitchScale: number
  readonly intonationScale: number
  readonly volumeScale: number
  readonly prePhonemeLength: number
  readonly postPhonemeLength: number
}

export type CastMember = {
  /** 字幕・プレイヤーページに出す名前 */
  readonly label: string
  /** VOICEVOX の /speakers に出てくる話者名とスタイル名 */
  readonly voicevox: { readonly speakerName: string; readonly styleName: string }
  /**
   * 表情ごとに立ち絵を差し替えるスタイル名 (声は voicevox.styleName のまま)。
   * VOICEVOX がスタイル別の立ち絵を配布しているキャラだけ指定する
   */
  readonly faceStyles: Partial<Record<Face, string>>
  readonly voice: VoiceParams
  /** 利用規約で求められるクレジット表記。動画とプレイヤーページから消さない */
  readonly credit: string
}

/** ながら見向けに少し速め。前後の無音はタイムライン側で間を足すので短くする */
const BASE_VOICE: VoiceParams = {
  speedScale: 1.15,
  pitchScale: 0,
  intonationScale: 1.1,
  volumeScale: 1,
  prePhonemeLength: 0.05,
  postPhonemeLength: 0.05,
}

/** ずんだもん = 聞き手、四国めたん = 解説役 */
export const CAST: Record<Speaker, CastMember> = {
  zundamon: {
    label: "ずんだもん",
    voicevox: { speakerName: "ずんだもん", styleName: "ノーマル" },
    faceStyles: { happy: "あまあま", smug: "ツンツン", troubled: "なみだめ" },
    voice: BASE_VOICE,
    credit: "VOICEVOX:ずんだもん",
  },
  metan: {
    label: "四国めたん",
    voicevox: { speakerName: "四国めたん", styleName: "ノーマル" },
    faceStyles: {},
    voice: BASE_VOICE,
    credit: "VOICEVOX:四国めたん",
  },
}

export const creditLine = (cast: Record<Speaker, CastMember> = CAST): string =>
  Object.values(cast)
    .map((member) => member.credit)
    .join(" / ")
