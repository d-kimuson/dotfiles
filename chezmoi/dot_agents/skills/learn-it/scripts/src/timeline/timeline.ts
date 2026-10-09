import { type Episode, type Scene, revealableCount } from "../script/schema.ts"

export type TimelineConfig = {
  readonly fps: number
  readonly sampleRate: number
  /** セリフ間の無音 */
  readonly gapSeconds: number
  /** シーン間の無音 (最終シーンの後には入れない) */
  readonly sceneGapSeconds: number
}

export type Cue = {
  readonly index: number
  readonly sceneIndex: number
  readonly lineIndex: number
  readonly startFrame: number
  readonly speechFrames: number
  readonly totalFrames: number
  /** 段階表示の表示件数。段階表示できないスライドでは null */
  readonly reveal: number | null
}

export type Chapter = {
  readonly sceneIndex: number
  readonly title: string
  readonly startFrame: number
}

export type Timeline = {
  readonly fps: number
  readonly cues: readonly Cue[]
  readonly chapters: readonly Chapter[]
  readonly totalFrames: number
}

/**
 * 各セリフ時点での段階表示件数を求める。
 * シーン内で reveal が一度も指定されなければ全件表示、指定があれば最初は 0 件から始めて直前の値を引き継ぐ。
 */
export const resolveReveals = (scene: Scene): (number | null)[] => {
  const max = revealableCount(scene.slide)
  if (max === null) return scene.lines.map(() => null)
  const usesReveal = scene.lines.some((line) => line.reveal !== undefined)
  let current = usesReveal ? 0 : max
  return scene.lines.map((line) => {
    current = line.reveal ?? current
    return current
  })
}

const secondsToFrames = (seconds: number, fps: number): number => Math.round(seconds * fps)

/**
 * @param speechSamples scenes[i].lines[j] の音声サンプル数
 */
export const buildTimeline = (
  episode: Episode,
  speechSamples: readonly (readonly number[])[],
  config: TimelineConfig,
): Timeline => {
  if (!Number.isInteger(config.sampleRate / config.fps)) {
    // 音声をフレーム境界で区切るため、1 フレームのサンプル数は整数でなければならない
    throw new Error(
      `sampleRate (${config.sampleRate}) は fps (${config.fps}) で割り切れる必要があります`,
    )
  }
  const gapFrames = secondsToFrames(config.gapSeconds, config.fps)
  const sceneGapFrames = secondsToFrames(config.sceneGapSeconds, config.fps)
  const cues: Cue[] = []
  const chapters: Chapter[] = []
  let cursor = 0

  episode.scenes.forEach((scene, sceneIndex) => {
    chapters.push({ sceneIndex, title: scene.chapter, startFrame: cursor })
    const reveals = resolveReveals(scene)
    const isLastScene = sceneIndex === episode.scenes.length - 1

    scene.lines.forEach((_, lineIndex) => {
      const samples = speechSamples[sceneIndex]?.[lineIndex]
      if (samples === undefined) {
        throw new Error(`音声がありません: scenes[${sceneIndex}].lines[${lineIndex}]`)
      }
      const speechFrames = Math.ceil((samples * config.fps) / config.sampleRate)
      const isSceneEnd = lineIndex === scene.lines.length - 1
      const totalFrames =
        speechFrames + gapFrames + (isSceneEnd && !isLastScene ? sceneGapFrames : 0)
      cues.push({
        index: cues.length,
        sceneIndex,
        lineIndex,
        startFrame: cursor,
        speechFrames,
        totalFrames,
        reveal: reveals[lineIndex] ?? null,
      })
      cursor += totalFrames
    })
  })

  return { fps: config.fps, cues, chapters, totalFrames: cursor }
}
