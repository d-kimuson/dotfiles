import { type Episode, type Source, type Speaker } from "../script/schema.ts"
import { type Timeline } from "../timeline/timeline.ts"

/** プレイヤーページ用の目次と字幕 (秒単位) */
export type Transcript = {
  readonly title: string
  readonly summary: string
  readonly sources: readonly Source[]
  readonly durationSeconds: number
  readonly chapters: readonly { readonly title: string; readonly start: number }[]
  readonly lines: readonly {
    readonly start: number
    readonly end: number
    readonly speaker: Speaker
    readonly text: string
    readonly chapterIndex: number
  }[]
}

const round = (seconds: number): number => Math.round(seconds * 1000) / 1000

export const buildTranscript = (episode: Episode, timeline: Timeline): Transcript => {
  const toSeconds = (frame: number): number => round(frame / timeline.fps)
  return {
    title: episode.title,
    summary: episode.summary,
    sources: episode.sources,
    durationSeconds: toSeconds(timeline.totalFrames),
    chapters: timeline.chapters.map((c) => ({ title: c.title, start: toSeconds(c.startFrame) })),
    lines: timeline.cues.map((cue) => {
      const line = episode.scenes[cue.sceneIndex]?.lines[cue.lineIndex]
      if (!line) throw new Error(`cue ${cue.index} に対応するセリフがありません`)
      return {
        start: toSeconds(cue.startFrame),
        end: toSeconds(cue.startFrame + cue.totalFrames),
        speaker: line.speaker,
        text: line.text,
        chapterIndex: cue.sceneIndex,
      }
    }),
  }
}
