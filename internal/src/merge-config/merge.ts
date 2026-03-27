import { readFile, writeFile, mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import { parse as parseTOML, stringify as stringifyTOML } from "smol-toml"

type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue }

type JsonObject = Record<string, JsonValue>

type MergeResult = {
  readonly written: boolean
  readonly extras: readonly string[]
}

const isPlainObject = (v: unknown): v is JsonObject =>
  typeof v === "object" && v !== null && !Array.isArray(v)

/**
 * Deep merge source into target.
 * Source values win for overlapping keys. Target-only keys are preserved.
 * Returns the merged object and a list of extra key paths (in target but not in source).
 */
const deepMerge = (
  source: JsonObject,
  target: JsonObject,
  prefix = ""
): { readonly merged: JsonObject; readonly extras: readonly string[] } => {
  const merged: JsonObject = { ...target }
  const extras: string[] = []

  for (const key of Object.keys(source)) {
    const srcVal = source[key]
    const tgtVal = target[key]

    if (isPlainObject(srcVal) && isPlainObject(tgtVal)) {
      const nested = deepMerge(
        srcVal as JsonObject,
        tgtVal as JsonObject,
        `${prefix}${key}.`
      )
      merged[key] = nested.merged
      extras.push(...nested.extras)
    } else {
      merged[key] = srcVal as JsonValue
    }
  }

  for (const key of Object.keys(target)) {
    if (!(key in source)) {
      extras.push(`${prefix}${key}`)
    }
  }

  return { merged, extras }
}

type Format = "json" | "toml"

const parseContent = (content: string, format: Format): JsonObject => {
  switch (format) {
    case "json":
      return JSON.parse(content) as JsonObject
    case "toml":
      return parseTOML(content) as unknown as JsonObject
  }
}

const serializeContent = (data: JsonObject, format: Format): string => {
  switch (format) {
    case "json":
      return JSON.stringify(data, null, 2) + "\n"
    case "toml":
      return stringifyTOML(data as Record<string, unknown>) + "\n"
  }
}

const readObjectFile = async (
  filePath: string,
  format: Format
): Promise<JsonObject | null> => {
  try {
    const content = await readFile(filePath, "utf-8")
    const parsed = parseContent(content, format)
    if (!isPlainObject(parsed)) {
      throw new Error(`Expected object in ${filePath}`)
    }
    return parsed
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null
    }
    throw err
  }
}

export type MergeConfigEntry = {
  readonly source: string
  readonly target: string
  readonly format?: Format
}

export type MergeConfigOptions = {
  readonly entries: readonly MergeConfigEntry[]
  readonly dryRun: boolean
}

const detectFormat = (filePath: string): Format =>
  filePath.endsWith(".toml") ? "toml" : "json"

const mergeOne = async (
  entry: MergeConfigEntry,
  dryRun: boolean
): Promise<MergeResult> => {
  const sourceFormat = entry.format ?? detectFormat(entry.source)
  const targetFormat = entry.format ?? detectFormat(entry.target)

  const source = await readObjectFile(entry.source, sourceFormat)
  if (source === null) {
    console.error(`  Source not found: ${entry.source}`)
    return { written: false, extras: [] }
  }

  const target = await readObjectFile(entry.target, targetFormat)

  if (target === null) {
    const output = serializeContent(source, targetFormat)
    if (dryRun) {
      console.log(`  [dry-run] Would write to: ${entry.target}`)
      console.log(output)
    } else {
      await mkdir(dirname(entry.target), { recursive: true })
      await writeFile(entry.target, output, "utf-8")
      console.log(`  Created: ${entry.target}`)
    }
    return { written: true, extras: [] }
  }

  const { merged, extras } = deepMerge(source, target)
  const output = serializeContent(merged, targetFormat)

  if (dryRun) {
    console.log(`  [dry-run] Would write to: ${entry.target}`)
    console.log(output)
  } else {
    await writeFile(entry.target, output, "utf-8")
    console.log(`  Updated: ${entry.target}`)
  }

  if (extras.length > 0) {
    console.log(`  Extra keys in target (not in source):`)
    for (const key of extras) {
      console.log(`    - ${key}`)
    }
  }

  return { written: true, extras }
}

export const mergeConfigs = async (
  options: MergeConfigOptions
): Promise<void> => {
  if (options.dryRun) {
    console.log("[dry-run mode]")
  }

  for (const entry of options.entries) {
    console.log(`\n${entry.source} → ${entry.target}`)
    await mergeOne(entry, options.dryRun)
  }

  console.log("\nDone.")
}
