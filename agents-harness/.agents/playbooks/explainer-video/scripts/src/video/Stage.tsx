import { Sequence, useAsset, useFrame, useTimeline } from "@kimuson/motion-kit"
import { type ReactNode, Suspense } from "react"
import {
  cueAt,
  STAGE_WIDTH,
  type PortraitUrls,
  sceneIndexAt,
  type VideoPlan,
} from "../plan/plan.ts"
import { SPEAKERS } from "../script/schema.ts"
import { Characters } from "./Characters.tsx"
import { SceneView } from "./SceneView.tsx"

const FONT_FAMILY = "M PLUS Rounded 1c"
/** エントリが import しているウェイト */
const FONT_WEIGHTS = [700, 800] as const

const FontWeight = ({ weight, text }: { readonly weight: number; readonly text: string }) => {
  useAsset({ kind: "font-family", id: `font-${String(weight)}`, family: FONT_FAMILY, weight, text })
  return null
}

const Portrait = ({ id, source }: { readonly id: string; readonly source: string }) => {
  useAsset({ kind: "image", id, source })
  return null
}

const portraitSources = (portraits: PortraitUrls): { id: string; source: string }[] =>
  SPEAKERS.flatMap((speaker) => [
    { id: `portrait-${speaker}`, source: portraits[speaker].base },
    ...Object.entries(portraits[speaker].faces).map(([face, source]) => ({
      id: `portrait-${speaker}-${face}`,
      source,
    })),
  ])

/** フォントと立ち絵が読み込めるまで、フレームを確定させない */
const AssetGate = ({ plan, children }: { readonly plan: VideoPlan; readonly children: ReactNode }) => (
  <>
    {FONT_WEIGHTS.map((weight) => (
      <FontWeight key={weight} weight={weight} text={plan.fontText} />
    ))}
    {portraitSources(plan.portraits).map(({ id, source }) => (
      <Portrait key={id} id={id} source={source} />
    ))}
    {children}
  </>
)

/** 立ち絵はシーンをまたいで出し続ける。いまのセリフを話者と表情に反映する */
const CharacterLayer = ({ plan }: { readonly plan: VideoPlan }) => {
  const frame = useFrame()
  const sceneIndex = sceneIndexAt(plan, frame)
  const scene = sceneIndex === null ? undefined : plan.scenes[sceneIndex]
  const cue = scene && cueAt(scene, frame)
  if (!cue) return null
  return (
    <Characters
      cue={cue}
      sinceCue={(frame - cue.startFrame) / plan.fps}
      bounce={plan.bounce[frame] ?? 0}
      portraits={plan.portraits}
    />
  )
}

/** 動画全体。1280x720 のステージを Composition の幅に合わせて拡縮する */
export const Stage = ({ plan }: { readonly plan: VideoPlan }) => {
  const { width } = useTimeline()
  const scale = width / STAGE_WIDTH
  return (
    <div className="stage" lang="ja" style={scale === 1 ? undefined : { transform: `scale(${String(scale)})` }}>
      <Suspense fallback={null}>
        <AssetGate plan={plan}>
          {plan.scenes.map((scene) => (
            <Sequence
              key={scene.startFrame}
              from={{ numerator: scene.startFrame, denominator: plan.fps }}
              duration={{ numerator: scene.totalFrames, denominator: plan.fps }}
              name={scene.chapter}
            >
              <SceneView plan={plan} scene={scene} />
            </Sequence>
          ))}
          <CharacterLayer plan={plan} />
        </AssetGate>
      </Suspense>
    </div>
  )
}
