import { readFile } from "node:fs/promises"
import { type Episode, parseEpisode } from "./schema.ts"

/** 台本の JSON を読み込んで検証する。違反はパス付きで 1 行ずつ並べて throw する */
export const loadEpisode = async (scriptPath: string): Promise<Episode> => {
  const raw = await readFile(scriptPath, "utf8")
  let input: unknown
  try {
    input = JSON.parse(raw)
  } catch (error) {
    throw new Error(`${scriptPath} は JSON として読めません`, { cause: error })
  }
  const result = parseEpisode(input)
  if (!result.ok) {
    throw new Error(
      `${scriptPath} が台本の契約に合いません:\n${result.issues.map((i) => `  - ${i}`).join("\n")}`,
    )
  }
  return result.episode
}
