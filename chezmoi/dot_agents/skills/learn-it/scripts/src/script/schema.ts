import { z } from "zod"

/**
 * 掛け合い解説動画 (ゆっくり解説形式) の台本 (Episode) の契約。
 * Claude が生成する JSON はこのスキーマで検証してから動画化する。
 */

export const SPEAKERS = ["zundamon", "metan"] as const
export const Speaker = z.enum(SPEAKERS)
export type Speaker = z.infer<typeof Speaker>

export const FACES = ["normal", "happy", "surprised", "troubled", "smug"] as const
export const Face = z.enum(FACES)
export type Face = z.infer<typeof Face>

const nonEmpty = z.string().trim().min(1)

/** スライド: kind で判別する直和型 */
export const TitleSlide = z.strictObject({
  kind: z.literal("title"),
  title: nonEmpty,
  subtitle: nonEmpty.optional(),
})

export const BulletsSlide = z.strictObject({
  kind: z.literal("bullets"),
  heading: nonEmpty,
  items: z.array(nonEmpty).min(1).max(6),
})

export const KeywordSlide = z.strictObject({
  kind: z.literal("keyword"),
  word: nonEmpty,
  description: nonEmpty.optional(),
})

export const TableSlide = z
  .strictObject({
    kind: z.literal("table"),
    heading: nonEmpty,
    columns: z.array(nonEmpty).min(2).max(4),
    rows: z.array(z.array(z.string())).min(1).max(6),
  })
  .refine((s) => s.rows.every((row) => row.length === s.columns.length), {
    message: "rows の各行は columns と同じ列数にしてください",
    path: ["rows"],
  })

export const FlowSlide = z.strictObject({
  kind: z.literal("flow"),
  heading: nonEmpty,
  nodes: z.array(nonEmpty).min(2).max(6),
})

export const CodeSlide = z.strictObject({
  kind: z.literal("code"),
  heading: nonEmpty,
  language: nonEmpty,
  code: nonEmpty.refine((c) => c.split("\n").length <= 14, {
    message: "code は 14 行以内にしてください",
  }),
})

export const Slide = z.discriminatedUnion("kind", [
  TitleSlide,
  BulletsSlide,
  KeywordSlide,
  TableSlide,
  FlowSlide,
  CodeSlide,
])
export type Slide = z.infer<typeof Slide>

export const Line = z.strictObject({
  speaker: Speaker,
  /** 字幕に表示するテキスト */
  text: nonEmpty.max(80),
  /** 読み上げ用テキスト (誤読対策)。省略時は text を読む */
  yomi: nonEmpty.optional(),
  /** 話者の表情 */
  face: Face.optional(),
  /** 聞き手の表情 */
  partnerFace: Face.optional(),
  /** このセリフ以降に表示する項目数 (bullets/table/flow の段階表示) */
  reveal: z.int().nonnegative().optional(),
})
export type Line = z.infer<typeof Line>

/** 段階表示できる項目数。段階表示できないスライドは null */
export const revealableCount = (slide: Slide): number | null => {
  switch (slide.kind) {
    case "bullets":
      return slide.items.length
    case "table":
      return slide.rows.length
    case "flow":
      return slide.nodes.length
    case "title":
    case "keyword":
    case "code":
      return null
    default:
      return slide satisfies never
  }
}

export const Scene = z
  .strictObject({
    /** チャプター名 (プレイヤーの目次に使う) */
    chapter: nonEmpty,
    slide: Slide,
    lines: z.array(Line).min(1),
  })
  .superRefine((scene, ctx) => {
    const max = revealableCount(scene.slide)
    scene.lines.forEach((line, i) => {
      if (line.reveal === undefined) return
      if (max === null) {
        ctx.addIssue({
          code: "custom",
          message: `${scene.slide.kind} スライドでは reveal を使えません`,
          path: ["lines", i, "reveal"],
        })
      } else if (line.reveal > max) {
        ctx.addIssue({
          code: "custom",
          message: `reveal は項目数 (${max}) 以下にしてください`,
          path: ["lines", i, "reveal"],
        })
      }
    })
  })
export type Scene = z.infer<typeof Scene>

export const Source = z.strictObject({
  title: nonEmpty,
  /** プレイヤーページのリンクになるため http(s) に限る */
  url: z.url({ protocol: /^https?$/ }).optional(),
})
export type Source = z.infer<typeof Source>

export const Episode = z.strictObject({
  title: nonEmpty,
  /** 一覧やプレイヤーに出す一文の概要 */
  summary: nonEmpty,
  scenes: z.array(Scene).min(1),
  /** 台本作成時に参照した情報源 */
  sources: z.array(Source).default([]),
})
export type Episode = z.infer<typeof Episode>
export type EpisodeInput = z.input<typeof Episode>

export type ParseResult = { ok: true; episode: Episode } | { ok: false; issues: string[] }

export const parseEpisode = (input: unknown): ParseResult => {
  const result = Episode.safeParse(input)
  if (result.success) return { ok: true, episode: result.data }
  return {
    ok: false,
    issues: result.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    ),
  }
}
