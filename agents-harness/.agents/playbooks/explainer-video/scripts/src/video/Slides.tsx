import type { CSSProperties } from "react"
import type { Slide } from "../script/schema.ts"
import { enter } from "./motion.ts"
import { Fit } from "./Fit.tsx"

/** 段階表示の状態。reveal が null なら段階表示しないスライド */
export type RevealView = {
  readonly reveal: number | null
  /** 直近の項目が現れてからの秒数。アニメーションしないなら null */
  readonly sinceReveal: number | null
}

type ItemView = { readonly className: string; readonly style: CSSProperties | undefined }

/** 段階表示: 未表示の項目は場所だけ確保し、直近に表示した項目を強調して下から浮かせる */
const itemView = (index: number, view: RevealView): ItemView => {
  const { reveal, sinceReveal } = view
  if (reveal === null) return { className: "", style: undefined }
  if (index >= reveal) return { className: "is-hidden", style: undefined }
  if (index !== reveal - 1) return { className: "", style: undefined }
  if (sinceReveal === null) return { className: "is-latest", style: undefined }
  const amount = enter(sinceReveal, 0, 0.28)
  return {
    className: "is-latest",
    style: { opacity: amount, transform: `translateY(${String(Math.round((1 - amount) * 14))}px)` },
  }
}

const Heading = ({ text }: { readonly text: string }) => (
  <Fit as="h2" className="heading" fitKey={text}>
    {text}
  </Fit>
)

export const SlideBody = ({ slide, view }: { readonly slide: Slide; readonly view: RevealView }) => {
  switch (slide.kind) {
    case "title":
      return (
        <div className="slide slide-title">
          <p className="badge">ずんだもん解説</p>
          <Fit as="h1" className="title-main" fitKey={slide.title}>
            {slide.title}
          </Fit>
          {slide.subtitle === undefined ? null : <p className="subtitle-text">{slide.subtitle}</p>}
        </div>
      )
    case "bullets":
      return (
        <div className="slide slide-bullets">
          <Heading text={slide.heading} />
          <Fit as="ul" className="bullets" fitKey={slide.items.join("\n")}>
            {slide.items.map((item, i) => {
              const { className, style } = itemView(i, view)
              return (
                <li key={`${String(i)}-${item}`} className={className} style={style}>
                  {item}
                </li>
              )
            })}
          </Fit>
        </div>
      )
    case "keyword":
      return (
        <div className="slide slide-keyword">
          <Fit as="p" className="keyword" fitKey={slide.word}>
            <span>{slide.word}</span>
          </Fit>
          {slide.description === undefined ? null : (
            <p className="description">{slide.description}</p>
          )}
        </div>
      )
    case "table":
      return (
        <div className="slide slide-table">
          <Heading text={slide.heading} />
          <Fit as="div" className="table-wrap" fitKey={JSON.stringify([slide.columns, slide.rows])}>
            <table>
              <thead>
                <tr>
                  {slide.columns.map((column, i) => (
                    <th key={`${String(i)}-${column}`}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slide.rows.map((row, i) => {
                  const { className, style } = itemView(i, view)
                  return (
                    <tr key={`${String(i)}-${row.join("|")}`} className={className} style={style}>
                      {row.map((cell, j) => (
                        <td key={`${String(j)}-${cell}`}>{cell}</td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Fit>
        </div>
      )
    case "flow":
      return (
        <div className="slide slide-flow">
          <Heading text={slide.heading} />
          <Fit as="ol" className="flow" fitKey={slide.nodes.join("\n")}>
            {slide.nodes.map((node, i) => {
              const { className, style } = itemView(i, view)
              return (
                <li key={`${String(i)}-${node}`} className={className} style={style}>
                  <span>{node}</span>
                </li>
              )
            })}
          </Fit>
        </div>
      )
    case "code":
      return (
        <div className="slide slide-code">
          <Heading text={slide.heading} />
          <Fit as="pre" className="code" fitKey={slide.code} data-lang={slide.language}>
            <code>{slide.code}</code>
          </Fit>
        </div>
      )
    default:
      return slide satisfies never
  }
}
