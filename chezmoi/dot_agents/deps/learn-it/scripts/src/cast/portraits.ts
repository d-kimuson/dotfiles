import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"
import { CAST, type CastMember } from "./cast.ts"
import { exists, writeFileAtomic } from "../lib/fs.ts"
import { FACES, type Face, Speaker, SPEAKERS } from "../script/schema.ts"
import {
  resolveStyleId,
  type SpeakerInfo,
  type Speakers,
  type VoicevoxClient,
} from "../voicevox/api.ts"

/** 立ち絵ファイルのパス。faces にない表情は base を使う */
export const CharacterPortraits = z.strictObject({
  base: z.string(),
  faces: z.partialRecord(z.enum(FACES), z.string()),
})
export type CharacterPortraits = z.infer<typeof CharacterPortraits>

export const Portraits = z.record(Speaker, CharacterPortraits)
export type Portraits = z.infer<typeof Portraits>

/** CAST の指定どおりに、既定と表情別の立ち絵 (base64 PNG) を選ぶ */
export const pickPortraits = (
  member: CastMember,
  speakers: Speakers,
  info: SpeakerInfo,
): CharacterPortraits => {
  const portraitOf = (styleName: string): string | undefined => {
    const { styleId } = resolveStyleId(speakers, {
      speakerName: member.voicevox.speakerName,
      styleName,
    })
    return info.style_infos.find((s) => s.id === styleId)?.portrait ?? undefined
  }
  const faces: Partial<Record<Face, string>> = {}
  for (const face of FACES) {
    const styleName = member.faceStyles[face]
    const portrait = styleName === undefined ? undefined : portraitOf(styleName)
    if (portrait !== undefined) faces[face] = portrait
  }
  return { base: portraitOf(member.voicevox.styleName) ?? info.portrait, faces }
}

/** .cache/voicevox/portraits.json */
const Manifest = z.strictObject({ key: z.string(), portraits: Portraits })

const manifestKey = (): string =>
  createHash("sha256")
    .update(JSON.stringify(SPEAKERS.map((s) => [s, CAST[s].voicevox, CAST[s].faceStyles])))
    .digest("hex")

const readManifest = async (dir: string): Promise<Portraits | null> => {
  const path = join(dir, "portraits.json")
  if (!(await exists(path))) return null
  const parsed = Manifest.safeParse(JSON.parse(await readFile(path, "utf8")))
  if (!parsed.success || parsed.data.key !== manifestKey()) return null
  const files = SPEAKERS.flatMap((s) => {
    const p = parsed.data.portraits[s]
    return p === undefined ? [] : [p.base, ...Object.values(p.faces)]
  })
  const allExist = (await Promise.all(files.map(exists))).every(Boolean)
  return allExist ? parsed.data.portraits : null
}

/** キャッシュ済みの立ち絵を返す。なければ null (エンジンを起動せずに済ませたい preview 用) */
export const cachedPortraits = readManifest

/** 立ち絵と利用規約を取得してキャッシュに保存する。キャッシュが揃っていればエンジンに問い合わせない */
export const ensurePortraits = async (client: VoicevoxClient, dir: string): Promise<Portraits> => {
  const cached = await readManifest(dir)
  if (cached) return cached
  const speakers = await client.speakers()
  const entries = await Promise.all(
    SPEAKERS.map(async (speaker): Promise<[Speaker, CharacterPortraits]> => {
      const member = CAST[speaker]
      const { speakerUuid } = resolveStyleId(speakers, member.voicevox)
      const info = await client.speakerInfo(speakerUuid)
      await writeFileAtomic(join(dir, `policy-${speaker}.md`), info.policy)
      const picked = pickPortraits(member, speakers, info)
      const save = async (suffix: string, base64: string): Promise<string> => {
        const path = join(dir, `portrait-${speaker}${suffix}.png`)
        await writeFileAtomic(path, Buffer.from(base64, "base64"))
        return path
      }
      const faces: Partial<Record<Face, string>> = {}
      for (const [face, base64] of Object.entries(picked.faces)) {
        faces[z.enum(FACES).parse(face)] = await save(`-${face}`, base64)
      }
      return [speaker, { base: await save("", picked.base), faces }]
    }),
  )
  const portraits = Portraits.parse(Object.fromEntries(entries))
  await writeFileAtomic(
    join(dir, "portraits.json"),
    JSON.stringify({ key: manifestKey(), portraits }, null, 2),
  )
  return portraits
}
