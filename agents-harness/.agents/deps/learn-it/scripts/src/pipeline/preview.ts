import { rm } from "node:fs/promises"
import { join } from "node:path"
import { cachedPortraits, ensurePortraits } from "../cast/portraits.ts"
import { frameStateFor } from "../render/frameState.ts"
import { captureFrames } from "../render/capture.ts"
import { renderStage } from "../render/stage.ts"
import { type Episode } from "../script/schema.ts"
import { buildTimeline } from "../timeline/timeline.ts"
import { withVoicevox } from "../voicevox/engine.ts"
import { TIMELINE_CONFIG } from "./buildVideo.ts"

export type PreviewOptions = {
  readonly episode: Episode
  readonly outDir: string
  readonly cacheDir: string
  readonly voicevoxUrl: string
  readonly log: (message: string) => void
}

/**
 * 各シーンの最後のセリフ (段階表示がすべて出た状態) を PNG に撮る。
 * 音声は合成せず各セリフを 1 秒とみなす。立ち絵がキャッシュにあればエンジンを起動しない
 */
export const preview = async ({
  episode,
  outDir,
  cacheDir,
  voicevoxUrl,
  log,
}: PreviewOptions): Promise<string[]> => {
  const portraitDir = join(cacheDir, "voicevox")
  const portraits =
    (await cachedPortraits(portraitDir)) ??
    (await withVoicevox(voicevoxUrl, log, (client) => ensurePortraits(client, portraitDir)))
  const timeline = buildTimeline(
    episode,
    episode.scenes.map((scene) => scene.lines.map(() => TIMELINE_CONFIG.sampleRate)),
    TIMELINE_CONFIG,
  )
  const previewDir = join(outDir, "preview")
  await rm(previewDir, { recursive: true, force: true })
  const jobs = episode.scenes.map((_, sceneIndex) => {
    const cue = timeline.cues.findLast((c) => c.sceneIndex === sceneIndex)
    if (!cue) throw new Error(`シーン ${sceneIndex} にセリフがありません`)
    return {
      html: renderStage(frameStateFor(episode, cue, { bounce: false })),
      path: join(previewDir, `scene-${String(sceneIndex + 1).padStart(2, "0")}.png`),
    }
  })
  await captureFrames(previewDir, portraits, jobs)
  return jobs.map((job) => job.path)
}
