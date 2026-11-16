import { COMPOSITION_ID } from "../plan/plan.ts"

/** motion-kit の render: mp4 にエンコードする (音声は Composition の宣言どおりに混ぜる) */
export const renderArgs = (options: {
  readonly entry: string
  readonly out: string
  readonly crf: number
}): string[] => [
  "render",
  options.entry,
  "--composition",
  COMPOSITION_ID,
  "--out",
  options.out,
  "--video-crf",
  String(options.crf),
  "--json",
]

/** motion-kit の frame: 指定フレームを outDir に frame-NNNNN.png として書く */
export const frameArgs = (options: {
  readonly entry: string
  readonly outDir: string
  readonly frames: readonly number[]
}): string[] => [
  "frame",
  options.entry,
  "--composition",
  COMPOSITION_ID,
  "--frame",
  options.frames.join(","),
  "--out",
  options.outDir,
  "--json",
]

/** `frame` が書くファイル名 (フレーム番号は 5 桁にゼロ埋めされる) */
export const framePngName = (frame: number): string => `frame-${String(frame).padStart(5, "0")}.png`

/**
 * motion-kit の子プロセス (vite.config.ts) に渡す環境変数。
 * プランの JSON の場所と、/@fs/ で配ってよい立ち絵のキャッシュ置き場
 */
export const projectEnv = (planPath: string, cacheDir: string): Record<string, string> => ({
  EXPLAINER_PLAN: planPath,
  EXPLAINER_FS_ALLOW: cacheDir,
})
