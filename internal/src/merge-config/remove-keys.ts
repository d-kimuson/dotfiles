import { isPlainObject, type JsonObject } from "./json.ts"

/** 削除するキーのパス。`["env", "FOO"]` は `env.FOO`。キー名に `.` を含められるよう、区切らずに配列で持つ */
export type KeyPath = readonly string[]

const hasKeyPath = (obj: JsonObject, [head, ...rest]: KeyPath): boolean => {
  if (head === undefined || !Object.hasOwn(obj, head)) return false
  const child = obj[head]
  return rest.length === 0 || (isPlainObject(child) && hasKeyPath(child, rest))
}

const removeKeyPath = (obj: JsonObject, [head, ...rest]: KeyPath): JsonObject => {
  if (head === undefined || !Object.hasOwn(obj, head)) return obj
  const child = obj[head]
  if (rest.length === 0) {
    return Object.fromEntries(Object.entries(obj).filter(([key]) => key !== head))
  }
  return isPlainObject(child) ? { ...obj, [head]: removeKeyPath(child, rest) } : obj
}

/** obj にあるキーパスだけを返す */
export const findPresentKeyPaths = (
  obj: JsonObject,
  paths: readonly KeyPath[]
): readonly KeyPath[] => paths.filter((path) => hasKeyPath(obj, path))

/** paths のキーを取り除いた新しい object を返す。存在しないパスは無視し、空になった親 object は残す */
export const removeKeyPaths = (obj: JsonObject, paths: readonly KeyPath[]): JsonObject =>
  paths.reduce(removeKeyPath, obj)
