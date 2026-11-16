import { creditLine } from "../cast/cast.ts"
import type { Portraits } from "../cast/portraits.ts"
import type { Episode, Face, Slide, Speaker } from "../script/schema.ts"
import type { Timeline } from "../timeline/timeline.ts"

/** ステージのサイズ。レイアウトはこの座標系で組み、Composition のサイズに合わせて拡縮する */
export const STAGE_WIDTH = 1280
export const STAGE_HEIGHT = 720

/** motion-kit に渡す Composition の id */
export const COMPOSITION_ID = "explainer"

/** 1 セリフ。字幕・表情・段階表示件数をフレームから引けるようにしたもの */
export type PlanCue = {
  readonly startFrame: number
  readonly totalFrames: number
  readonly speaker: Speaker
  readonly text: string
  readonly face: Face
  readonly partnerFace: Face
  /** 段階表示の表示件数。段階表示できないスライドでは null */
  readonly reveal: number | null
}

export type PlanScene = {
  readonly chapter: string
  readonly slide: Slide
  readonly startFrame: number
  readonly totalFrames: number
  readonly cues: readonly PlanCue[]
}

/** ブラウザから読める立ち絵の URL。faces にない表情は base を使う */
export type PortraitUrls = Readonly<
  Record<Speaker, { readonly base: string; readonly faces: Partial<Record<Face, string>> }>
>

/**
 * 動画 1 本分の台本・タイムライン・素材。
 * 音声や長さは Composition の宣言 (props では変えられない) に入るので、ビルドごとに
 * このプランを Vite の仮想モジュール経由でエントリに渡す
 */
export type VideoPlan = {
  readonly fps: number
  readonly totalFrames: number
  readonly title: string
  readonly credit: string
  readonly scenes: readonly PlanScene[]
  readonly portraits: PortraitUrls
  /** フレームごとの立ち絵の弾み (0〜1)。長さは totalFrames */
  readonly bounce: readonly number[]
  /** 画面に出る全文字。フォントのサブセット読み込みの対象にする */
  readonly fontText: string
  /** 全セリフを並べた音声 (WAV) の絶対パス。音声なしなら null */
  readonly audioPath: string | null
}

/** Vite の dev server が絶対パスのファイルを配る URL */
export const fsUrl = (absolutePath: string): string => `/@fs${encodeURI(absolutePath)}`

const portraitUrls = (portraits: Portraits): PortraitUrls => {
  const urlsOf = (speaker: Speaker): PortraitUrls[Speaker] => {
    const entry = portraits[speaker]
    if (entry === undefined) throw new Error(`立ち絵がありません: ${speaker}`)
    return {
      base: fsUrl(entry.base),
      faces: Object.fromEntries(
        Object.entries(entry.faces).map(([face, path]) => [face, fsUrl(path)]),
      ),
    }
  }
  return { zundamon: urlsOf("zundamon"), metan: urlsOf("metan") }
}

const slideTexts = (slide: Slide): string[] => {
  switch (slide.kind) {
    case "title":
      return [slide.title, slide.subtitle ?? ""]
    case "bullets":
      return [slide.heading, ...slide.items]
    case "keyword":
      return [slide.word, slide.description ?? ""]
    case "table":
      return [slide.heading, ...slide.columns, ...slide.rows.flat()]
    case "flow":
      return [slide.heading, ...slide.nodes]
    case "code":
      return [slide.heading, slide.code]
    default:
      return slide satisfies never
  }
}

/** 画面に出る文字の重複を除いた並び (固定の文言も含む) */
export const collectFontText = (episode: Episode, credit: string): string => {
  const texts = [
    episode.title,
    credit,
    "ずんだもん解説",
    "◆♪！ドヤッ➜",
    ...episode.scenes.flatMap((scene) => [
      scene.chapter,
      ...slideTexts(scene.slide),
      ...scene.lines.map((line) => line.text),
    ]),
  ]
  return [...new Set(texts.join(""))].join("")
}

export type PlanInput = {
  readonly episode: Episode
  readonly timeline: Timeline
  /** フレームごとの弾み。長さは timeline.totalFrames */
  readonly bounce: readonly number[]
  readonly portraits: Portraits
  readonly audioPath: string | null
}

export const buildPlan = ({
  episode,
  timeline,
  bounce,
  portraits,
  audioPath,
}: PlanInput): VideoPlan => {
  if (bounce.length !== timeline.totalFrames) {
    throw new Error(`bounce の長さ (${bounce.length}) が総フレーム数 (${timeline.totalFrames}) と違います`)
  }
  const credit = creditLine()
  const scenes = episode.scenes.map((scene, sceneIndex): PlanScene => {
    const cues = timeline.cues
      .filter((cue) => cue.sceneIndex === sceneIndex)
      .map((cue): PlanCue => {
        const line = scene.lines[cue.lineIndex]
        if (!line) throw new Error(`cue ${cue.index} に対応するセリフがありません`)
        return {
          startFrame: cue.startFrame,
          totalFrames: cue.totalFrames,
          speaker: line.speaker,
          text: line.text,
          face: line.face ?? "normal",
          partnerFace: line.partnerFace ?? "normal",
          reveal: cue.reveal,
        }
      })
    const first = cues[0]
    if (!first) throw new Error(`シーン ${sceneIndex} にセリフがありません`)
    const end = cues.reduce((max, cue) => Math.max(max, cue.startFrame + cue.totalFrames), 0)
    return {
      chapter: scene.chapter,
      slide: scene.slide,
      startFrame: first.startFrame,
      totalFrames: end - first.startFrame,
      cues,
    }
  })
  return {
    fps: timeline.fps,
    totalFrames: timeline.totalFrames,
    title: episode.title,
    credit,
    scenes,
    portraits: portraitUrls(portraits),
    bounce,
    fontText: collectFontText(episode, credit),
    audioPath,
  }
}

/** frame を含むセリフ。シーンの範囲外なら null */
export const cueAt = (scene: PlanScene, frame: number): PlanCue | null => {
  if (frame < scene.startFrame || frame >= scene.startFrame + scene.totalFrames) return null
  return scene.cues.findLast((cue) => cue.startFrame <= frame) ?? null
}

/**
 * cue の段階表示件数に切り替わったセリフの開始フレーム。直前のセリフと件数が同じなら、その前から遡る。
 * 段階表示の項目が現れるアニメーションの起点に使う。段階表示しないシーンでは null
 */
export const revealStartFrame = (scene: PlanScene, cue: PlanCue): number | null => {
  if (cue.reveal === null) return null
  let start = cue
  for (const previous of scene.cues.toReversed()) {
    if (previous.startFrame >= start.startFrame) continue
    if (previous.reveal !== cue.reveal) break
    start = previous
  }
  return start.startFrame
}

/** frame が属するシーンの番号。どのシーンにも属さなければ null */
export const sceneIndexAt = (plan: VideoPlan, frame: number): number | null => {
  const index = plan.scenes.findLastIndex((scene) => scene.startFrame <= frame)
  const scene = plan.scenes[index]
  return scene && cueAt(scene, frame) ? index : null
}

/** 各シーンの最後のセリフを撮るフレーム。入場アニメーションが終わった後ろに寄せる */
export const PREVIEW_OFFSET_FRAMES = 20

export const previewFrames = (plan: VideoPlan): number[] =>
  plan.scenes.map((scene) => {
    const last = scene.cues.at(-1)
    if (!last) throw new Error("シーンにセリフがありません")
    return last.startFrame + Math.min(PREVIEW_OFFSET_FRAMES, last.totalFrames - 1)
  })

/** 各セリフの長さを 1 秒とみなして作る preview 用の音声サンプル数 (音声は合成しない) */
export const previewSpeechSamples = (episode: Episode, sampleRate: number): number[][] =>
  episode.scenes.map((scene) => scene.lines.map(() => sampleRate))
