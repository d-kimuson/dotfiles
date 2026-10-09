export type EncodeRequest = {
  readonly concatListPath: string
  readonly audioPath: string
  readonly outPath: string
  readonly fps: number
  /** x264 の品質 (大きいほど小さく粗い)。静止画主体なので 28 前後で十分 */
  readonly crf: number
}

/** 静止画リスト (concat demuxer) と音声トラックから MP4 を作る ffmpeg 引数 */
export const encodeArgs = ({
  concatListPath,
  audioPath,
  outPath,
  fps,
  crf,
}: EncodeRequest): string[] => [
  "-y",
  "-v",
  "error",
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  concatListPath,
  "-i",
  audioPath,
  "-map",
  "0:v",
  "-map",
  "1:a",
  "-fps_mode",
  "cfr",
  "-r",
  String(fps),
  "-c:v",
  "libx264",
  "-preset",
  "medium",
  "-tune",
  "stillimage",
  "-crf",
  String(crf),
  "-pix_fmt",
  "yuv420p",
  // 読み上げごとの音量差を均すため、配信系の目安 (-16 LUFS) に揃える
  "-af",
  "loudnorm=I=-16:TP=-1.5:LRA=11",
  "-ar",
  "48000",
  "-c:a",
  "aac",
  "-b:a",
  "96k",
  "-movflags",
  "+faststart",
  "-shortest",
  outPath,
]
