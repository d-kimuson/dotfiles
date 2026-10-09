import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { type CastMember } from "../cast/cast.ts"
import { exists, writeFileAtomic } from "../lib/fs.ts"
import { type VoicevoxClient } from "./api.ts"

/** 合成の仕方を変えたら上げて、古いキャッシュを使わないようにする */
const CACHE_VERSION = 1

export type SynthesisRequest = {
  readonly text: string
  readonly styleId: number
  readonly member: CastMember
  readonly sampleRate: number
  readonly engineVersion: string
}

export const cacheKey = (req: SynthesisRequest): string =>
  createHash("sha256")
    .update(
      JSON.stringify({
        text: req.text,
        styleId: req.styleId,
        voice: req.member.voice,
        sampleRate: req.sampleRate,
        engineVersion: req.engineVersion,
        v: CACHE_VERSION,
      }),
    )
    .digest("hex")
    .slice(0, 24)

/** 1 セリフを合成して WAV のバイト列を返す。同じ条件で合成済みならキャッシュを返す */
export const synthesize = async (
  client: VoicevoxClient,
  ttsCacheDir: string,
  req: SynthesisRequest,
): Promise<Uint8Array> => {
  const path = join(ttsCacheDir, `${cacheKey(req)}.wav`)
  if (await exists(path)) return new Uint8Array(await readFile(path))
  const query = await client.audioQuery(req.text, req.styleId)
  const wav = await client.synthesis(
    { ...query, ...req.member.voice, outputSamplingRate: req.sampleRate, outputStereo: false },
    req.styleId,
  )
  await writeFileAtomic(path, wav)
  return wav
}
