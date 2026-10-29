import type { Dirent } from "node:fs"
import { readdir, readFile, realpath } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { parse as parseTOML } from "smol-toml"

/**
 * CLI 自身の自己更新は `npm i -g` で mise の管理外 (~/.npm-global など) に入る。
 * そこが PATH に残っていると mise の npm バックエンドをシャドウするため、
 * mise の管理対象と同じパッケージが外側にも入っていないかを突き合わせる。
 */
export type ManagedNpmTool = {
  readonly name: string
  readonly version: string
}

export type InstalledNpmTool = ManagedNpmTool & {
  readonly root: string
}

export type ShadowedNpmTool = ManagedNpmTool & {
  readonly installed: readonly InstalledNpmTool[]
}

const NPM_BACKEND_PREFIX = "npm:"

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

const isMissingFile = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT"

/** 見つからないだけなら空で続け、読めない場合は理由を添えて投げる。 */
const readEntries = async (dir: string): Promise<readonly Dirent[]> => {
  try {
    return await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (isMissingFile(error)) return []
    throw new Error(`failed to list ${dir}`, { cause: error })
  }
}

/** 見つからないだけなら null を返し、読めない場合は理由を添えて投げる。 */
const readText = async (filePath: string): Promise<string | null> => {
  try {
    return await readFile(filePath, "utf-8")
  } catch (error) {
    if (isMissingFile(error)) return null
    throw new Error(`failed to read ${filePath}`, { cause: error })
  }
}

const readVersion = (value: unknown): string | null => {
  if (typeof value === "string") return value
  if (isPlainObject(value) && typeof value["version"] === "string") {
    return value["version"]
  }
  return null
}

/** mise の config (`[tools]`) から npm バックエンドのエントリを取り出す。 */
export const parseManagedNpmTools = (
  config: string
): readonly ManagedNpmTool[] => {
  const parsed = parseTOML(config)
  const tools = isPlainObject(parsed["tools"]) ? parsed["tools"] : {}

  return Object.entries(tools).flatMap(([key, value]) => {
    if (!key.startsWith(NPM_BACKEND_PREFIX)) return []
    const version = readVersion(value)
    if (version === null) return []
    return [{ name: key.slice(NPM_BACKEND_PREFIX.length), version }]
  })
}

/** managed のうち、外側にも同じ名前で入っているものを返す。 */
export const findShadowedNpmTools = (
  managed: readonly ManagedNpmTool[],
  installed: readonly InstalledNpmTool[]
): readonly ShadowedNpmTool[] =>
  managed.flatMap((tool) => {
    const hits = installed.filter((candidate) => candidate.name === tool.name)
    if (hits.length === 0) return []
    return [{ ...tool, installed: hits }]
  })

const readInstalledTool = async (
  dir: string,
  root: string
): Promise<InstalledNpmTool | null> => {
  try {
    const raw = await readFile(path.join(dir, "package.json"), "utf-8")
    const pkg = JSON.parse(raw) as unknown
    if (!isPlainObject(pkg) || typeof pkg["name"] !== "string") return null
    return {
      name: pkg["name"],
      version: typeof pkg["version"] === "string" ? pkg["version"] : "unknown",
      root,
    }
  } catch {
    // 壊れた symlink や package.json を持たない (または壊れた) ディレクトリは対象外
    return null
  }
}

const listPackageDirs = async (root: string): Promise<readonly string[]> => {
  const entries = await readEntries(root)
  const dirs: string[] = []

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue
    const entryPath = path.join(root, entry.name)
    if (entry.name.startsWith("@")) {
      const scoped = await readEntries(entryPath)
      for (const nested of scoped) dirs.push(path.join(entryPath, nested.name))
      continue
    }
    dirs.push(entryPath)
  }

  return dirs
}

/** node_modules のルート 1 つから、直下のパッケージ (scope 付きを含む) を読む。 */
export const listInstalledNpmTools = async (
  root: string
): Promise<readonly InstalledNpmTool[]> => {
  const dirs = await listPackageDirs(root)
  const tools = await Promise.all(dirs.map((dir) => readInstalledTool(dir, root)))
  return tools.filter((tool): tool is InstalledNpmTool => tool !== null)
}

/** mise の node インストールごとの global prefix (`<version>/lib/node_modules`) を列挙する。 */
const listNodePrefixes = async (
  installsDir: string
): Promise<readonly string[]> => {
  const entries = await readEntries(installsDir)
  return entries
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => path.join(installsDir, entry.name, "lib", "node_modules"))
}

/** 同じディレクトリを指す symlink (`22` と `22.17.1` など) を 1 つに量す。 */
const dedupeRoots = async (
  roots: readonly string[]
): Promise<readonly string[]> => {
  const resolved = await Promise.all(
    roots.map(async (root) => {
      try {
        return await realpath(root)
      } catch (error) {
        if (isMissingFile(error)) return root
        throw new Error(`failed to resolve ${root}`, { cause: error })
      }
    })
  )
  return [...new Set(resolved)]
}

/** `npm i -g` のインストール先として既定で確認するディレクトリ。 */
export const resolveSearchRoots = async (): Promise<readonly string[]> => {
  const home = homedir()
  return dedupeRoots([
    path.join(home, ".npm-global/lib/node_modules"),
    path.join(home, ".local/lib/node_modules"),
    path.join(home, ".pi/agent/npm-global/lib/node_modules"),
    ...(await listNodePrefixes(
      path.join(home, ".local/share/mise/installs/node")
    )),
  ])
}

/** mise 管理の npm CLI を `npm i -g` 側がシャドウしていないか調べる。 */
export const checkNpmShadowing = async (opts: {
  readonly configPath: string
  readonly searchRoots: readonly string[]
}): Promise<readonly ShadowedNpmTool[]> => {
  const config = await readText(opts.configPath)
  if (config === null) {
    throw new Error(`mise config not found: ${opts.configPath}`)
  }

  const managed = parseManagedNpmTools(config)
  const installed = (
    await Promise.all(opts.searchRoots.map((root) => listInstalledNpmTools(root)))
  ).flat()

  return findShadowedNpmTools(managed, installed)
}

export const DEFAULT_MISE_CONFIG_PATH = path.join(
  homedir(),
  ".config/mise/config.toml"
)
