/**
 * dry-run 用に「どのキーが変わるか」だけを表す。
 * 配布先の設定には MCP の env や headers などの秘密情報が含まれるため、値は一切保持・出力しない。
 */
export type KeyChange = {
  readonly kind: "added" | "changed" | "removed"
  readonly path: string
}

type PlainObject = Readonly<Record<string, unknown>>

const isPlainObject = (v: unknown): v is PlainObject =>
  typeof v === "object" && v !== null && !Array.isArray(v)

const isSameValue = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

const diffObjects = (
  before: PlainObject,
  after: PlainObject,
  prefix: string
): readonly KeyChange[] => {
  const common = Object.keys(before)
    .filter((key) => key in after)
    .flatMap((key) => {
      const path = `${prefix}${key}`
      const b = before[key]
      const a = after[key]
      if (isPlainObject(b) && isPlainObject(a)) return diffObjects(b, a, `${path}.`)
      return isSameValue(b, a) ? [] : [{ kind: "changed" as const, path }]
    })
  const removed = Object.keys(before)
    .filter((key) => !(key in after))
    .map((key) => ({ kind: "removed" as const, path: `${prefix}${key}` }))
  const added = Object.keys(after)
    .filter((key) => !(key in before))
    .map((key) => ({ kind: "added" as const, path: `${prefix}${key}` }))

  return [...common, ...removed, ...added]
}

/** 変更前 (null は未作成) と変更後を比較し、変化したキーパスを返す。配列は葉として扱う。 */
export const diffKeyPaths = (
  before: PlainObject | null,
  after: PlainObject
): readonly KeyChange[] => diffObjects(before ?? {}, after, "")

const MARKS: Readonly<Record<KeyChange["kind"], string>> = {
  added: "+",
  changed: "~",
  removed: "-",
}

export const formatDryRunReport = (
  targetPath: string,
  changes: readonly KeyChange[]
): string =>
  [
    `  [dry-run] Would write to: ${targetPath}`,
    ...(changes.length === 0
      ? ["    (no changes)"]
      : changes.map((change) => `    ${MARKS[change.kind]} ${change.path}`)),
  ].join("\n")
