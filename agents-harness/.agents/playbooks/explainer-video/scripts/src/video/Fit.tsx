import { type CSSProperties, type ElementType, type ReactNode, useLayoutEffect, useRef } from "react"

/** 文字を縮める下限 (px) */
const MIN_FONT_PX = 14

const fit = (el: HTMLElement): void => {
  el.style.fontSize = ""
  let size = parseFloat(getComputedStyle(el).fontSize)
  while ((el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) && size > MIN_FONT_PX) {
    size -= 1
    el.style.fontSize = `${size}px`
  }
}

type FitProps = {
  readonly as: ElementType
  readonly className: string
  /** 中身が変わったら縮め直す。同じ値の間は再計算しない */
  readonly fitKey: string
  readonly style?: CSSProperties
  readonly children: ReactNode
  readonly [attribute: `data-${string}`]: string
}

/** はみ出すテキストを、はみ出さなくなるまで 1px ずつ縮める。フォントの読み込み後に描画される前提 */
export const Fit = ({ as: Tag, className, fitKey, style, children, ...rest }: FitProps) => {
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    if (ref.current) fit(ref.current)
  }, [fitKey])
  return (
    <Tag ref={ref} className={className} style={style} {...rest}>
      {children}
    </Tag>
  )
}
