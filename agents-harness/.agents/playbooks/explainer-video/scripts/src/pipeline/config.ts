import { type BounceConfig, DEFAULT_BOUNCE } from "../timeline/animation.ts"
import { type TimelineConfig } from "../timeline/timeline.ts"

export const FPS = 30
export const SAMPLE_RATE = 24_000

export const TIMELINE_CONFIG: TimelineConfig = {
  fps: FPS,
  sampleRate: SAMPLE_RATE,
  gapSeconds: 0.25,
  sceneGapSeconds: 0.6,
}

export const BOUNCE_CONFIG: BounceConfig = {
  ...DEFAULT_BOUNCE,
  fps: FPS,
  sampleRate: SAMPLE_RATE,
}
