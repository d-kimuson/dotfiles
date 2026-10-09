import { randomUUID } from "node:crypto"
import { access, mkdir, rename, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

/** 一時ファイルに書いてから rename し、書きかけのファイルを残さない */
export const writeFileAtomic = async (path: string, data: string | Uint8Array): Promise<void> => {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.${randomUUID()}.tmp`
  await writeFile(tmp, data)
  await rename(tmp, path)
}

export const exists = async (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  )
