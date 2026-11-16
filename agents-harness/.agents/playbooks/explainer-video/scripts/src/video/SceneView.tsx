import { useFrame, useTime } from "@kimuson/motion-kit"
import { cueAt, type PlanScene, revealStartFrame, type VideoPlan } from "../plan/plan.ts"
import { enter } from "./motion.ts"
import { SlideBody } from "./Slides.tsx"
import { Subtitle } from "./Subtitle.tsx"

/** シーン 1 つ分 (Sequence の中)。上部のバー、スライド、字幕を描く */
export const SceneView = ({ plan, scene }: { readonly plan: VideoPlan; readonly scene: PlanScene }) => {
  const frame = useFrame()
  const sinceScene = useTime()
  const cue = cueAt(scene, frame) ?? scene.cues[0]
  if (!cue) return null
  const sinceCue = (frame - cue.startFrame) / plan.fps
  const revealStart = revealStartFrame(scene, cue)
  // 動画の先頭と、シーンの冒頭から出ている項目はアニメーションしない
  const animateReveal = revealStart !== null && revealStart > scene.startFrame
  // 最初のシーンは先頭のフレームから見えているようにする (サムネイルになる)
  const arrival = scene.startFrame === 0 ? 1 : enter(sinceScene, 0, 0.3)

  return (
    <>
      <header className="topbar" style={{ opacity: arrival }}>
        <span className="chapter">{scene.chapter}</span>
        <span className="episode">{plan.title}</span>
        <span className="credit">{plan.credit}</span>
      </header>
      <main
        className="board"
        style={{ opacity: arrival, transform: `translateY(${String(Math.round((1 - arrival) * 18))}px)` }}
      >
        <SlideBody
          slide={scene.slide}
          view={{
            reveal: cue.reveal,
            sinceReveal: animateReveal ? (frame - revealStart) / plan.fps : null,
          }}
        />
      </main>
      <Subtitle cue={cue} sinceCue={sinceCue} />
    </>
  )
}
