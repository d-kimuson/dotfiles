import type { ReactNode } from "react"
import type { PlanCue, PortraitUrls } from "../plan/plan.ts"
import type { Face, Speaker } from "../script/schema.ts"
import { enter, pop } from "./motion.ts"

/** 弾みの高さ (px)。bounce は 0〜1 */
const BOUNCE_PX = 8

/** 立ち絵は 1 枚絵なので、表情は頭の横に出す記号で表す */
const emote = (face: Face): ReactNode => {
  switch (face) {
    case "normal":
      return null
    case "happy":
      return <span className="emote emote-happy">♪</span>
    case "surprised":
      return <span className="emote emote-surprised">！</span>
    case "troubled":
      return (
        <span className="emote emote-troubled">
          <i />
          <i />
        </span>
      )
    case "smug":
      return <span className="emote emote-smug">ドヤッ</span>
    default:
      return face satisfies never
  }
}

/** 記号を拡縮する起点 (記号の位置に近い所) */
const EMOTE_ORIGIN: Record<Speaker, string> = {
  metan: "82% 30%",
  zundamon: "16% 28%",
}

type CharacterProps = {
  readonly speaker: Speaker
  readonly face: Face
  readonly speaking: boolean
  readonly bounce: number
  /** この表情になってからの秒数 (記号の出現アニメーション) */
  readonly sinceFace: number
  readonly portraits: PortraitUrls
}

const Character = ({ speaker, face, speaking, bounce, sinceFace, portraits }: CharacterProps) => {
  const urls = portraits[speaker]
  const image = urls.faces[face] ?? urls.base
  const classes = ["character", `character-${speaker}`, `face-${face}`, speaking ? "is-speaking" : ""]
  return (
    <div className={classes.filter((c) => c !== "").join(" ")}>
      <div
        className="portrait"
        style={{
          backgroundImage: `url("${image}")`,
          transform: `translateY(${String(-BOUNCE_PX * bounce)}px)`,
        }}
      />
      <div
        className="emote-layer"
        style={{
          opacity: enter(sinceFace, 0, 0.1),
          transform: `scale(${String(pop(sinceFace, 0, 0.4))})`,
          transformOrigin: EMOTE_ORIGIN[speaker],
        }}
      >
        {emote(face)}
      </div>
    </div>
  )
}

export type CharactersProps = {
  readonly cue: PlanCue
  /** cue が始まってからの秒数 */
  readonly sinceCue: number
  readonly bounce: number
  readonly portraits: PortraitUrls
}

/** 左にめたん、右にずんだもん。話者の表情とは別に、聞き手は partnerFace で表情をつける */
export const Characters = ({ cue, sinceCue, bounce, portraits }: CharactersProps) => {
  const faceOf = (speaker: Speaker): Face => (speaker === cue.speaker ? cue.face : cue.partnerFace)
  return (
    <>
      {(["metan", "zundamon"] as const).map((speaker) => (
        <Character
          key={speaker}
          speaker={speaker}
          face={faceOf(speaker)}
          speaking={speaker === cue.speaker}
          bounce={speaker === cue.speaker ? bounce : 0}
          sinceFace={sinceCue}
          portraits={portraits}
        />
      ))}
    </>
  )
}
