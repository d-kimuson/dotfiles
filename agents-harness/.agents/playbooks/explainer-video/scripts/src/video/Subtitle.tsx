import type { PlanCue } from "../plan/plan.ts"
import { Fit } from "./Fit.tsx"
import { enter } from "./motion.ts"

/** 長い字幕は、はみ出しを縮める前に最初から小さめにしておく */
export const subtitleSize = (text: string): string => {
  if (text.length > 44) return "is-small"
  if (text.length > 26) return "is-medium"
  return ""
}

/** セリフの字幕。話者の色で縁取り、セリフが替わるたびに短くフェードインする */
export const Subtitle = ({ cue, sinceCue }: { readonly cue: PlanCue; readonly sinceCue: number }) => (
  <Fit
    as="p"
    className={["subtitle", `subtitle-${cue.speaker}`, subtitleSize(cue.text)]
      .filter((c) => c !== "")
      .join(" ")}
    fitKey={cue.text}
    style={{ opacity: enter(sinceCue, 0, 0.12) }}
  >
    <span>{cue.text}</span>
  </Fit>
)
