import { isDeepStrictEqual } from "node:util"
import { isPlainObject, type JsonObject, type JsonValue } from "./json.ts"

/** hooks.<event> の要素。matcher ごとのグループで、handler を hooks に並べる */
export type HookGroup = JsonObject & { readonly hooks: readonly JsonValue[] }

export type HookEvents = { readonly [event: string]: readonly HookGroup[] }

const isHookGroup = (v: JsonValue): v is HookGroup =>
  isPlainObject(v) && Array.isArray(v["hooks"])

export const parseHookEvents = (
  value: JsonValue | undefined,
  location: string
): HookEvents => {
  if (value === undefined) return {}
  if (!isPlainObject(value)) {
    throw new Error(`Expected an object at hooks in ${location}`)
  }
  return Object.fromEntries(
    Object.entries(value).map(([event, groups]) => {
      if (!Array.isArray(groups) || !groups.every(isHookGroup)) {
        throw new Error(`Expected hook groups with a hooks array at hooks.${event} in ${location}`)
      }
      return [event, groups]
    })
  )
}

/** handler の同一性。command を持つ handler は、timeout などを書き換えても同じ handler とみなす */
const handlerKey = (hook: JsonValue): JsonValue =>
  isPlainObject(hook) && typeof hook["command"] === "string" ? hook["command"] : hook

const sameHandler = (a: JsonValue, b: JsonValue): boolean =>
  isDeepStrictEqual(handlerKey(a), handlerKey(b))

const handlersOf = (groups: readonly HookGroup[] | undefined): readonly JsonValue[] =>
  (groups ?? []).flatMap((group) => group.hooks)

/**
 * source の hooks を target に反映し、外部ツール (Orca など) が登録した hook を残す。
 * 今回か前回配布した source にある handler を dotfiles のものとみなし、それ以外を外部のものとして残す。
 * 前回の配布記録がない (初回) ときは外部のものを見分けられないので、source にあるイベントだけを source で置き換える。
 */
export const mergeHookEvents = ({
  source,
  target,
  previous,
}: {
  readonly source: HookEvents
  readonly target: HookEvents
  readonly previous: HookEvents | null
}): HookEvents => {
  if (previous === null) return { ...target, ...source }

  const events = [...new Set([...Object.keys(source), ...Object.keys(target)])]
  return Object.fromEntries(
    events.flatMap((event) => {
      const delivered = [...handlersOf(source[event]), ...handlersOf(previous[event])]
      const external = (target[event] ?? []).flatMap((group) => {
        const hooks = group.hooks.filter((hook) => !delivered.some((d) => sameHandler(d, hook)))
        return hooks.length === 0 ? [] : [{ ...group, hooks }]
      })
      const groups = [...(source[event] ?? []), ...external]
      return groups.length === 0 ? [] : [[event, groups] as const]
    })
  )
}

/** 初回の置き換えで消える target の hook。外部ツールのものなら登録し直す必要がある */
export const listReplacedHooks = ({
  source,
  target,
}: {
  readonly source: HookEvents
  readonly target: HookEvents
}): readonly { readonly event: string; readonly hook: JsonValue }[] =>
  Object.keys(source).flatMap((event) =>
    handlersOf(target[event])
      .filter((hook) => !handlersOf(source[event]).some((s) => sameHandler(s, hook)))
      .map((hook) => ({ event, hook }))
  )
