import { type Timeline } from "./timeline.ts"

export type Pose = {
  bounce: boolean
}

/** 撮影する静止画 1 枚 = (セリフ, ポーズ) の組 */
export type Shot = { key: string; cueIndex: number; pose: Pose }

/** 同じ静止画が連続するフレーム数 */
export type Run = { shotKey: string; frames: number }

export type FramePlan = { shots: Shot[]; runs: Run[] }

const flag = (b: boolean): string => (b ? "1" : "0")

export const shotKey = (cueIndex: number, pose: Pose): string =>
  `c${String(cueIndex).padStart(4, "0")}-b${flag(pose.bounce)}`

/**
 * フレームごとのポーズを計算し、撮影が必要な静止画とその並びを求める。
 * @param bounceTracks cue ごとの弾みトラック (長さは cue.totalFrames 以上)
 */
export const planFrames = (
  timeline: Timeline,
  bounceTracks: readonly (readonly boolean[])[],
): FramePlan => {
  const shots = new Map<string, Shot>()
  const runs: Run[] = []

  for (const cue of timeline.cues) {
    const track = bounceTracks[cue.index] ?? []
    for (let f = 0; f < cue.totalFrames; f++) {
      const pose: Pose = { bounce: track[f] ?? false }
      const key = shotKey(cue.index, pose)
      if (!shots.has(key)) shots.set(key, { key, cueIndex: cue.index, pose })
      const last = runs.at(-1)
      if (last?.shotKey === key) {
        last.frames++
      } else {
        runs.push({ shotKey: key, frames: 1 })
      }
    }
  }

  return { shots: [...shots.values()], runs }
}

/**
 * ffmpeg concat demuxer 用のリストを作る。
 * concat demuxer は最後の duration を無視するため、最後のファイルを重ねて書く。
 */
export const toFfconcat = (
  runs: readonly Run[],
  fps: number,
  pathOf: (shotKey: string) => string,
): string => {
  const lines = ["ffconcat version 1.0"]
  for (const run of runs) {
    lines.push(
      `file '${pathOf(run.shotKey).replaceAll("'", "'\\''")}'`,
      `duration ${(run.frames / fps).toFixed(6)}`,
    )
  }
  const last = runs.at(-1)
  if (last) lines.push(`file '${pathOf(last.shotKey).replaceAll("'", "'\\''")}'`)
  return `${lines.join("\n")}\n`
}
