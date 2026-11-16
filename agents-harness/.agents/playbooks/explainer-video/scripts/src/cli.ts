import { resolve } from "node:path"
import { Command, InvalidArgumentError, Option } from "commander"
import { z } from "zod"
import { cacheDir, episodePaths } from "./lib/paths.ts"
import { buildVideo } from "./pipeline/buildVideo.ts"
import { preview } from "./pipeline/preview.ts"
import { readings } from "./pipeline/reading.ts"
import { loadEpisode } from "./script/loadEpisode.ts"
import { Episode, SPEAKERS, type Speaker } from "./script/schema.ts"
import { DEFAULT_VOICEVOX_URL } from "./voicevox/api.ts"

const log = (message: string): void => {
  process.stderr.write(`${message}\n`)
}

const voicevoxUrl = (): string => process.env["VOICEVOX_URL"] || DEFAULT_VOICEVOX_URL

const parseCrf = (value: string): number => {
  const crf = Number(value)
  if (!Number.isInteger(crf) || crf < 0 || crf > 51) throw new InvalidArgumentError("0〜51 の整数")
  return crf
}

const program = new Command("video")
  .description("台本 (JSON) から、ずんだもんと四国めたんの掛け合い解説動画を作る")
  .showHelpAfterError()

program
  .command("schema")
  .description("台本の JSON Schema を出力する")
  .action(() => {
    process.stdout.write(`${JSON.stringify(z.toJSONSchema(Episode, { io: "input" }), null, 2)}\n`)
  })

program
  .command("validate")
  .description("台本を検証する")
  .argument("<script>", "台本の JSON")
  .action(async (script: string) => {
    await loadEpisode(script)
    log(`OK: ${script}`)
  })

program
  .command("preview")
  .description("各シーンの最後のセリフを PNG に撮る (音声なし・数秒)")
  .argument("<script>", "台本の JSON")
  .action(async (script: string) => {
    const episode = await loadEpisode(script)
    const paths = await preview({
      episode,
      outDir: episodePaths(resolve(script)).outDir,
      cacheDir: cacheDir(),
      voicevoxUrl: voicevoxUrl(),
      log,
    })
    process.stdout.write(`${paths.join("\n")}\n`)
  })

program
  .command("yomi")
  .description("VOICEVOX の読み (アクセント付きカナ) を出す。yomi が要るかの確認に使う")
  .argument("<text...>", "読みを確かめる文")
  .addOption(new Option("--speaker <name>", "話者").choices(SPEAKERS).default("metan"))
  .action(async (texts: string[], options: { speaker: Speaker }) => {
    const kana = await readings({
      texts,
      speaker: options.speaker,
      voicevoxUrl: voicevoxUrl(),
      log,
    })
    process.stdout.write(texts.map((text, i) => `${text}\t${kana[i]}\n`).join(""))
  })

program
  .command("build")
  .description("動画 (video.mp4) とプレイヤーページ (index.html) を作る")
  .argument("<script>", "台本の JSON")
  .option("--crf <n>", "x264 の品質。大きいほど小さく粗い", parseCrf, 28)
  .action(async (script: string, options: { crf: number }) => {
    const started = performance.now()
    const episode = await loadEpisode(script)
    const result = await buildVideo({
      episode,
      outDir: episodePaths(resolve(script)).outDir,
      cacheDir: cacheDir(),
      voicevoxUrl: voicevoxUrl(),
      crf: options.crf,
      log,
    })
    const seconds = ((performance.now() - started) / 1000).toFixed(0)
    const minutes = (result.transcript.durationSeconds / 60).toFixed(1)
    const megabytes = (result.bytes / 1024 / 1024).toFixed(1)
    log(`完了 (${seconds}s): ${minutes} 分 / ${megabytes} MB`)
    process.stdout.write(`${result.pagePath}\n${result.videoPath}\n`)
  })

try {
  await program.parseAsync()
} catch (error) {
  log(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
