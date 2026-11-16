import { homedir } from "node:os"
import { basename, dirname, extname, join, resolve } from "node:path"

export type EpisodePaths = {
  /** 台本のファイル名 (拡張子なし)。出力先のディレクトリ名になる */
  readonly name: string
  readonly outDir: string
}

/** `<topic>/main.json` → `<topic>/out/main/` */
export const episodePaths = (scriptPath: string): EpisodePaths => {
  const name = basename(scriptPath, extname(scriptPath))
  return { name, outDir: join(dirname(scriptPath), "out", name) }
}

/** 音声・立ち絵のキャッシュ。トピックをまたいで共有する */
export const cacheDir = (env: NodeJS.ProcessEnv = process.env): string =>
  join(env["XDG_CACHE_HOME"] || join(homedir(), ".cache"), "explainer-video")

/** scripts/ (package.json、node_modules、vite.config.ts のあるディレクトリ)。motion-kit のプロジェクトルートになる */
export const PROJECT_ROOT: string = resolve(import.meta.dirname, "..", "..")

/** motion-kit に渡すエントリ (PROJECT_ROOT からの相対パス) */
export const VIDEO_ENTRY = "src/video/entry.tsx"
