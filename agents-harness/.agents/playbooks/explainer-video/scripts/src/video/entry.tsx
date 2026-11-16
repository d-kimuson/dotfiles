// motion-kit のエントリ。台本から作ったプラン (virtual:explainer-plan) を 1 本の Composition にする。
// 長さと音声は Composition の宣言で、props では変えられないため、プランはビルドごとに vite.config.ts から渡す。
import "@fontsource/m-plus-rounded-1c/700.css"
import "@fontsource/m-plus-rounded-1c/800.css"
import "./stage.css"
import { defineComposition, defineCompositions } from "@kimuson/motion-kit"
import plan from "virtual:explainer-plan"
import { z } from "zod"
import { COMPOSITION_ID, STAGE_HEIGHT, STAGE_WIDTH } from "../plan/plan.ts"
import { Stage } from "./Stage.tsx"

export const compositions = defineCompositions([
  defineComposition({
    id: COMPOSITION_ID,
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    fps: { numerator: plan.fps, denominator: 1 },
    durationInFrames: plan.totalFrames,
    schema: z.object({}),
    component: () => <Stage plan={plan} />,
    // 全セリフを 1 本に並べた音声。preview では音声を持たない
    ...(plan.audioPath === null
      ? {}
      : { audio: [{ src: plan.audioPath, startInFrames: 0, endInFrames: plan.totalFrames }] }),
  }),
])
