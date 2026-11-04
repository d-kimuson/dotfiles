import { type Episode, type Face, type Slide, type Speaker } from "../script/schema.ts"
import { type Pose } from "../timeline/framePlan.ts"
import { type Cue } from "../timeline/timeline.ts"

export type CharacterPose = {
  readonly face: Face
  readonly bounce: boolean
  readonly speaking: boolean
}

/** 静止画 1 枚を描くのに必要な情報 */
export type FrameState = {
  readonly episodeTitle: string
  readonly chapter: string
  readonly slide: Slide
  readonly reveal: number | null
  readonly subtitle: { readonly speaker: Speaker; readonly text: string }
  readonly characters: Record<Speaker, CharacterPose>
}

export const frameStateFor = (episode: Episode, cue: Cue, pose: Pose): FrameState => {
  const scene = episode.scenes[cue.sceneIndex]
  const line = scene?.lines[cue.lineIndex]
  if (!scene || !line) throw new Error(`cue ${cue.index} に対応するセリフがありません`)
  const speakerPose: CharacterPose = {
    face: line.face ?? "normal",
    bounce: pose.bounce,
    speaking: true,
  }
  const partnerPose: CharacterPose = {
    face: line.partnerFace ?? "normal",
    bounce: false,
    speaking: false,
  }
  return {
    episodeTitle: episode.title,
    chapter: scene.chapter,
    slide: scene.slide,
    reveal: cue.reveal,
    subtitle: { speaker: line.speaker, text: line.text },
    characters:
      line.speaker === "zundamon"
        ? { zundamon: speakerPose, metan: partnerPose }
        : { metan: speakerPose, zundamon: partnerPose },
  }
}
