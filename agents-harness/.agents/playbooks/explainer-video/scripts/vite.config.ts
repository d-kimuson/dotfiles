// motion-kit が読み込む Vite 設定。vite 自体は import しない (motion-kit が同梱するものを使う)。
//
// - virtual:explainer-plan: ビルドごとのプラン (EXPLAINER_PLAN が指す JSON) をエントリに渡す
// - server.fs.allow: キャッシュにある立ち絵を /@fs/ で配れるようにする (EXPLAINER_FS_ALLOW、区切りは : )
import { readFile } from "node:fs/promises"
import { delimiter } from "node:path"

const PLAN_MODULE = "virtual:explainer-plan"
const RESOLVED = `\0${PLAN_MODULE}`

const planPath = (): string => {
  const path = process.env["EXPLAINER_PLAN"]
  if (!path) throw new Error("EXPLAINER_PLAN (プランの JSON) が指定されていません")
  return path
}

export default {
  plugins: [
    {
      name: "explainer-plan",
      resolveId: (id: string) => (id === PLAN_MODULE ? RESOLVED : undefined),
      load: async (id: string) =>
        id === RESOLVED ? `export default ${await readFile(planPath(), "utf8")}\n` : undefined,
    },
  ],
  server: {
    fs: {
      allow: [import.meta.dirname, ...(process.env["EXPLAINER_FS_ALLOW"] ?? "").split(delimiter).filter(Boolean)],
    },
  },
}
