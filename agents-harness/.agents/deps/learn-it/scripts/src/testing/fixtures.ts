import { type EpisodeInput, parseEpisode, type Episode } from "../script/schema.ts"

export const episodeOf = (input: EpisodeInput): Episode => {
  const result = parseEpisode(input)
  if (!result.ok) throw new Error(result.issues.join("\n"))
  return result.episode
}

/** 2 シーン (段階表示ありの bullets と keyword) の最小の台本 */
export const sampleEpisode = (): Episode =>
  episodeOf({
    title: "ずんだもんのテスト入門",
    summary: "テスト用の台本",
    scenes: [
      {
        chapter: "理由",
        slide: { kind: "bullets", heading: "なぜ", items: ["一つ目", "二つ目"] },
        lines: [
          { speaker: "zundamon", text: "なぜなのだ？" },
          {
            speaker: "metan",
            text: "一つ目はこれよ。",
            reveal: 1,
            face: "smug",
            partnerFace: "surprised",
          },
          { speaker: "metan", text: "二つ目はこれ。", reveal: 2 },
        ],
      },
      {
        chapter: "まとめ",
        slide: { kind: "keyword", word: "テスト" },
        lines: [{ speaker: "zundamon", text: "わかったのだ！" }],
      },
    ],
  })
