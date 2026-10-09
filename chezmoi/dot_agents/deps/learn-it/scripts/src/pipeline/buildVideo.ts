import { rm, stat } from "node:fs/promises"
import { join } from "node:path"
import { CAST } from "../cast/cast.ts"
import { ensurePortraits } from "../cast/portraits.ts"
import { decodeWav, concatPadded, encodeWav } from "../audio/wav.ts"
import { encodeArgs } from "../encode/ffmpeg.ts"
import { run } from "../lib/exec.ts"
import { writeFileAtomic } from "../lib/fs.ts"
import { buildPlayerPage } from "../player/playerPage.ts"
import { buildTranscript, type Transcript } from "../player/transcript.ts"
import { frameStateFor } from "../render/frameState.ts"
import { captureFrames } from "../render/capture.ts"
import { renderStage } from "../render/stage.ts"
import { type Episode } from "../script/schema.ts"
import { bounceTrack, DEFAULT_BOUNCE } from "../timeline/animation.ts"
import { planFrames, toFfconcat } from "../timeline/framePlan.ts"
import { buildTimeline, type TimelineConfig } from "../timeline/timeline.ts"
import { synthesize } from "../voicevox/synthesize.ts"
import { resolveStyleId } from "../voicevox/api.ts"
import { withVoicevox } from "../voicevox/engine.ts"

export const FPS = 30
export const SAMPLE_RATE = 24_000

export const TIMELINE_CONFIG: TimelineConfig = {
  fps: FPS,
  sampleRate: SAMPLE_RATE,
  gapSeconds: 0.25,
  sceneGapSeconds: 0.6,
}

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
  log("1/5 VOICEVOX で読み上げ音声を合成しています")
  const { portraits, speeches } = await withVoicevox(voicevoxUrl, log, async (client) => {
    const portraits = await ensurePortraits(client, join(cacheDir, "voicevox"))
    const speakers = await client.speakers()
    const engineVersion = await client.version()
    const total = episode.scenes.reduce((n, s) => n + s.lines.length, 0)
    let done = 0
    const speeches: Int16Array[][] = []
    // エンジンは 1 リクエストで CPU を使い切るので、並列にしても速くならない
    for (const scene of episode.scenes) {
      const row: Int16Array[] = []
      for (const line of scene.lines) {
        const member = CAST[line.speaker]
        const { styleId } = resolveStyleId(speakers, member.voicevox)
        const wav = await synthesize(client, join(cacheDir, "tts"), {
          text: line.yomi ?? line.text,
          styleId,
          member,
          sampleRate: SAMPLE_RATE,
          engineVersion,
        })
        const pcm = decodeWav(wav)
        if (pcm.sampleRate !== SAMPLE_RATE) {
          throw new Error(
            `合成した音声のサンプルレートが ${pcm.sampleRate} です (期待値 ${SAMPLE_RATE})`,
          )
        }
        row.push(pcm.samples)
        done++
        if (done % 20 === 0 || done === total) log(`  ${done}/${total}`)
      }
      speeches.push(row)
    }
    return { portraits, speeches }
  })

  log("2/5 タイムラインと撮影計画を作っています")
  const timeline = buildTimeline(
    episode,
    speeches.map((row) => row.map((s) => s.length)),
    TIMELINE_CONFIG,
  )
  const speechOf = (sceneIndex: number, lineIndex: number): Int16Array => {
    const samples = speeches[sceneIndex]?.[lineIndex]
    if (!samples) throw new Error(`音声がありません: scenes[${sceneIndex}].lines[${lineIndex}]`)
    return samples
  }
  const bounceTracks = timeline.cues.map((cue) =>
    bounceTrack(speechOf(cue.sceneIndex, cue.lineIndex), cue.totalFrames, {
      ...DEFAULT_BOUNCE,
      fps: FPS,
      sampleRate: SAMPLE_RATE,
    }),
  )
  const plan = planFrames(timeline, bounceTracks)

  log(`3/5 静止画を ${plan.shots.length} 枚撮影しています`)
  const framesDir = join(outDir, "frames")
  await rm(framesDir, { recursive: true, force: true })
  const framePath = (key: string): string => join(framesDir, `${key}.png`)
  await captureFrames(
    framesDir,
    portraits,
    plan.shots.map((shot) => {
      const cue = timeline.cues[shot.cueIndex]
      if (!cue) throw new Error(`cue ${shot.cueIndex} がありません`)
      return {
        html: renderStage(frameStateFor(episode, cue, shot.pose)),
        path: framePath(shot.key),
      }
    }),
    (done) => {
      if (done % 50 === 0 || done === plan.shots.length) log(`  ${done}/${plan.shots.length}`)
    },
  )

  log("4/5 音声トラックを書いています")
  const samplesPerFrame = SAMPLE_RATE / FPS
  const audio = concatPadded(
    timeline.cues.map((cue) => ({
      samples: speechOf(cue.sceneIndex, cue.lineIndex),
      length: cue.totalFrames * samplesPerFrame,
    })),
  )
  const audioPath = join(outDir, "audio.wav")
  const concatListPath = join(outDir, "frames.ffconcat")
  await writeFileAtomic(audioPath, encodeWav({ sampleRate: SAMPLE_RATE, samples: audio }))
  await writeFileAtomic(concatListPath, toFfconcat(plan.runs, FPS, framePath))

  log("5/5 ffmpeg で動画にしています")
  const videoPath = join(outDir, "video.mp4")
  await run("ffmpeg", encodeArgs({ concatListPath, audioPath, outPath: videoPath, fps: FPS, crf }))
  const transcript = buildTranscript(episode, timeline)
  const pagePath = join(outDir, "index.html")
  await writeFileAtomic(join(outDir, "transcript.json"), `${JSON.stringify(transcript, null, 2)}\n`)
  await writeFileAtomic(pagePath, buildPlayerPage(transcript, "video.mp4"))
  const { size } = await stat(videoPath)
  return { videoPath, pagePath, transcript, bytes: size }
}
