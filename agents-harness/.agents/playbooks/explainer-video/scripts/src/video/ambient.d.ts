// vite.config.ts の仮想モジュール。ビルドごとのプラン (JSON) をエントリに渡す
declare module "virtual:explainer-plan" {
  import type { VideoPlan } from "../plan/plan.ts"
  const plan: VideoPlan
  export default plan
}

// Vite が取り込む CSS (副作用 import のみ)
declare module "*.css"
