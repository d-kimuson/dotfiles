export type BounceConfig = {
  readonly fps: number
  readonly sampleRate: number
  /** 最大 RMS に対するこの比率を超えたフレームを発声中とみなす */
  readonly voicedRatio: number
  /** 発声中に「弾む/戻る」を繰り返すフレーム数 (立ち絵を声に合わせて上下させる) */
  readonly upFrames: number
  readonly downFrames: number
}

export const DEFAULT_BOUNCE: Omit<BounceConfig, "fps" | "sampleRate"> = {
  voicedRatio: 0.12,
  upFrames: 4,
  downFrames: 4,
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
 * 音声の音量から立ち絵の弾みトラックを作る。
 * 発声中は upFrames/downFrames の周期で上下し、無音区間では元の位置に戻る。
 */
export const bounceTrack = (
  samples: Int16Array,
  totalFrames: number,
  config: BounceConfig,
): boolean[] => {
  const samplesPerFrame = config.sampleRate / config.fps
  const rms = Array.from({ length: totalFrames }, (_, f) =>
    frameRms(
      samples,
      Math.round(f * samplesPerFrame),
      Math.min(samples.length, Math.round((f + 1) * samplesPerFrame)),
    ),
  )
  const threshold = Math.max(...rms, 0) * config.voicedRatio
  const cycle = config.upFrames + config.downFrames
  let voicedRun = 0
  return rms.map((value) => {
    if (threshold === 0 || value <= threshold) {
      voicedRun = 0
      return false
    }
    const up = voicedRun % cycle < config.upFrames
    voicedRun++
    return up
  })
}
