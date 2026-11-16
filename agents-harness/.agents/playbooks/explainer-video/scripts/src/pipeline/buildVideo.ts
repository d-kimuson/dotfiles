import { stat } from "node:fs/promises"
import { join } from "node:path"
import { concatPadded, encodeWav } from "../audio/wav.ts"
import { writeFileAtomic, withTempDir } from "../lib/fs.ts"
import { VIDEO_ENTRY } from "../lib/paths.ts"
import { projectEnv, renderArgs } from "../motionkit/args.ts"
import { runMotionKit } from "../motionkit/run.ts"
import { buildPlayerPage } from "../player/playerPage.ts"
import { buildTranscript, type Transcript } from "../player/transcript.ts"
import { buildPlan } from "../plan/plan.ts"
import { type Episode } from "../script/schema.ts"
import { bounceForTimeline } from "../timeline/animation.ts"
import { buildTimeline } from "../timeline/timeline.ts"
import { BOUNCE_CONFIG, FPS, SAMPLE_RATE, TIMELINE_CONFIG } from "./config.ts"
import { synthesizeEpisode } from "./synthesizeEpisode.ts"

export type BuildOptions = {
  readonly episode: Episode
  readonly outDir: string
  readonly cacheDir: string
  readonly voicevoxUrl: string
  readonly crf: number
  readonly log: (message: string) => void
}

export type BuildResult = {
  readonly videoPath: string
  readonly pagePath: string
  readonly transcript: Transcript
  readonly bytes: number
}

/** 台本から動画 (video.mp4) とプレイヤーページ (index.html) を作る */
export const buildVideo = async ({
  episode,
  outDir,
  cacheDir,
  voicevoxUrl,
  crf,
  log,
}: BuildOptions): Promise<BuildResult> => {
  log("1/4 VOICEVOX で読み上げ音声を合成しています")
  const { portraits, speeches } = await synthesizeEpisode({ episode, cacheDir, voicevoxUrl, log })

  log("2/4 タイムラインと音声トラックを作っています")
  const speechOf = (sceneIndex: number, lineIndex: number): Int16Array => {
    const samples = speeches[sceneIndex]?.[lineIndex]
    if (!samples) throw new Error(`音声がありません: scenes[${sceneIndex}].lines[${lineIndex}]`)
    return samples
  }
  const timeline = buildTimeline(
    episode,
    speeches.map((row) => row.map((s) => s.length)),
    TIMELINE_CONFIG,
  )
  const cueSpeech = (cueIndex: number): Int16Array => {
    const cue = timeline.cues[cueIndex]
    if (!cue) throw new Error(`cue ${cueIndex} がありません`)
    return speechOf(cue.sceneIndex, cue.lineIndex)
  }
  const samplesPerFrame = SAMPLE_RATE / FPS
  const voice = concatPadded(
    timeline.cues.map((cue, i) => ({
      samples: cueSpeech(i),
      length: cue.totalFrames * samplesPerFrame,
    })),
  )
  const bounce = bounceForTimeline(timeline.cues, cueSpeech, BOUNCE_CONFIG)

  log("3/4 motion-kit でレンダリングしています")
  const videoPath = join(outDir, "video.mp4")
  await withTempDir("explainer-video-", async (workDir) => {
    const audioPath = join(workDir, "voice.wav")
    const planPath = join(workDir, "plan.json")
    await writeFileAtomic(audioPath, encodeWav({ sampleRate: SAMPLE_RATE, samples: voice }))
    const plan = buildPlan({ episode, timeline, bounce, portraits, audioPath })
    await writeFileAtomic(planPath, JSON.stringify(plan))
    await runMotionKit(
      renderArgs({ entry: VIDEO_ENTRY, out: videoPath, crf }),
      projectEnv(planPath, cacheDir),
    )
  })

  log("4/4 プレイヤーページを書いています")
  const transcript = buildTranscript(episode, timeline)
  const pagePath = join(outDir, "index.html")
  await writeFileAtomic(join(outDir, "transcript.json"), `${JSON.stringify(transcript, null, 2)}\n`)
  await writeFileAtomic(pagePath, buildPlayerPage(transcript, "video.mp4"))
  const { size } = await stat(videoPath)
  return { videoPath, pagePath, transcript, bytes: size }
}
