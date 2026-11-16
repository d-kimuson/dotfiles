import { randomUUID } from "node:crypto"
import { access, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

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

/** 一時ディレクトリを作って fn に渡し、終わったら (失敗しても) 消す */
export const withTempDir = async <T>(prefix: string, fn: (dir: string) => Promise<T>): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
