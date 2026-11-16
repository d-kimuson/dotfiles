import { readdir, rename, rm } from "node:fs/promises"
import { join } from "node:path"
import { cachedPortraits, ensurePortraits } from "../cast/portraits.ts"
import { withTempDir, writeFileAtomic } from "../lib/fs.ts"
import { VIDEO_ENTRY } from "../lib/paths.ts"
import { frameArgs, framePngName, projectEnv } from "../motionkit/args.ts"
import { runMotionKit } from "../motionkit/run.ts"
import { buildPlan, previewFrames, previewSpeechSamples } from "../plan/plan.ts"
import { type Episode } from "../script/schema.ts"
import { buildTimeline } from "../timeline/timeline.ts"
import { withVoicevox } from "../voicevox/engine.ts"
import { SAMPLE_RATE, TIMELINE_CONFIG } from "./config.ts"

export type PreviewOptions = {
  readonly episode: Episode
  readonly outDir: string
  readonly cacheDir: string
  readonly voicevoxUrl: string
  readonly log: (message: string) => void
}

/** preview/scene-01.png のような、シーン番号つきの出力名 */
export const previewName = (sceneIndex: number): string =>
  `scene-${String(sceneIndex + 1).padStart(2, "0")}.png`

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
    previewSpeechSamples(episode, SAMPLE_RATE),
    TIMELINE_CONFIG,
  )
  const plan = buildPlan({
    episode,
    timeline,
    bounce: Array.from({ length: timeline.totalFrames }, () => 0),
    portraits,
    audioPath: null,
  })
  const frames = previewFrames(plan)
  const previewDir = join(outDir, "preview")
  await rm(previewDir, { recursive: true, force: true })

  await withTempDir("explainer-video-", async (workDir) => {
    const planPath = join(workDir, "plan.json")
    await writeFileAtomic(planPath, JSON.stringify(plan))
    await runMotionKit(
      frameArgs({ entry: VIDEO_ENTRY, outDir: previewDir, frames }),
      projectEnv(planPath, cacheDir),
    )
  })

  const written = new Set(await readdir(previewDir))
  const paths: string[] = []
  for (const [sceneIndex, frame] of frames.entries()) {
    const source = framePngName(frame)
    if (!written.has(source)) throw new Error(`motion-kit が ${source} を書きませんでした`)
    const target = join(previewDir, previewName(sceneIndex))
    await rename(join(previewDir, source), target)
    paths.push(target)
  }
  return paths
}
