export type BounceConfig = {
  readonly fps: number
  readonly sampleRate: number
  /** 最大 RMS に対するこの比率を超えたフレームを発声中とみなす */
  readonly voicedRatio: number
  /** 発声中に「弾んで戻る」1 周期のフレーム数 (立ち絵を声に合わせて上下させる) */
  readonly cycleFrames: number
}

export const DEFAULT_BOUNCE: Omit<BounceConfig, "fps" | "sampleRate"> = {
  voicedRatio: 0.12,
  cycleFrames: 8,
}

const frameRms = (samples: Int16Array, from: number, to: number): number => {
  if (to <= from) return 0
  let sum = 0
  for (let i = from; i < to; i++) {
    const v = samples[i] ?? 0
    sum += v * v
  }
  return Math.sqrt(sum / (to - from))
}

/**
 * 音声の音量から立ち絵の弾みトラックを作る。フレームごとに 0 (元の位置) 〜 1 (最も高い) を返す。
 * 発声中は cycleFrames の周期でなめらかに上下し、無音区間では 0 に戻って周期の位相も戻す。
 */
export const bounceTrack = (
  samples: Int16Array,
  totalFrames: number,
  config: BounceConfig,
): number[] => {
  const samplesPerFrame = config.sampleRate / config.fps
  const rms = Array.from({ length: totalFrames }, (_, f) =>
    frameRms(
      samples,
      Math.round(f * samplesPerFrame),
      Math.min(samples.length, Math.round((f + 1) * samplesPerFrame)),
    ),
  )
  const threshold = Math.max(...rms, 0) * config.voicedRatio
  let voicedRun = 0
  return rms.map((value) => {
    if (threshold === 0 || value <= threshold) {
      voicedRun = 0
      return 0
    }
    const phase = (voicedRun % config.cycleFrames) / config.cycleFrames
    voicedRun++
    // 丸め誤差で 1e-16 級の値が残らないようにする
    return Math.round(Math.sin(Math.PI * phase) * 1000) / 1000
  })
}

/** タイムライン全体のフレームごとの弾み。セリフごとに音量を正規化して、cue を並べた順につなぐ */
export const bounceForTimeline = (
  cues: readonly { readonly totalFrames: number }[],
  samplesOf: (cueIndex: number) => Int16Array,
  config: BounceConfig,
): number[] => cues.flatMap((cue, i) => bounceTrack(samplesOf(i), cue.totalFrames, config))
