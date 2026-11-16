import { easing, interpolate, spring } from "@kimuson/motion-kit/motion"

type Outcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly message: string } }

/** motion-kit のモーション値は Result を返す。引数はこのモジュールが固定するので、失敗は実装の誤り */
const unwrap = <T,>(result: Outcome<T>): T => {
  if (!result.ok) throw new Error(`motion: ${result.error.message}`)
  return result.value
}

/** at 秒から duration 秒かけて 0 → 1 に、ゆっくり止まる動き */
export const enter = (seconds: number, at = 0, duration = 0.3): number =>
  unwrap(interpolate(seconds, [at, at + duration], [0, 1], { easing: easing.easeOutCubic }))

/** at 秒から from → 1 へ、少し行き過ぎて収まるばね。記号の「ポン」と出る動きに使う */
export const pop = (seconds: number, at = 0, from = 0.5): number =>
  unwrap(
    spring(seconds, { from, to: 1, start: at, velocity: 0, stiffness: 420, damping: 17, mass: 1 }),
  )
