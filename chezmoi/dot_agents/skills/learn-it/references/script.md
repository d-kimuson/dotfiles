# 台本

台本は `episodes/<slug>/script.json` に置く JSON。下の zod スキーマが唯一の契約で、ここに書いていない制約はスキーマが正。

## 契約 (`src/script/schema.ts`)

仕組みを新しく作るときはこのファイルをそのまま置く。スライドの種類を増やすときは discriminated union に足し、`revealableCount` の `switch` (`satisfies never` の網羅チェック) と [stage.md](stage.md) の `slideBody` も直す。

```ts
import { z } from 'zod';

/**
 * 掛け合い解説動画 (ゆっくり解説形式) の台本 (Episode) の契約。
 * Claude が生成する JSON はこのスキーマで検証してから動画化する。
 */

export const SPEAKERS = ['zundamon', 'metan'] as const;
export const Speaker = z.enum(SPEAKERS);
export type Speaker = z.infer<typeof Speaker>;

export const FACES = ['normal', 'happy', 'surprised', 'troubled', 'smug'] as const;
export const Face = z.enum(FACES);
export type Face = z.infer<typeof Face>;

const nonEmpty = z.string().trim().min(1);

/** スライド: kind で判別する直和型 */
export const TitleSlide = z.strictObject({
  kind: z.literal('title'),
  title: nonEmpty,
  subtitle: nonEmpty.optional(),
});

export const BulletsSlide = z.strictObject({
  kind: z.literal('bullets'),
  heading: nonEmpty,
  items: z.array(nonEmpty).min(1).max(6),
});

export const KeywordSlide = z.strictObject({
  kind: z.literal('keyword'),
  word: nonEmpty,
  description: nonEmpty.optional(),
});

export const TableSlide = z
  .strictObject({
    kind: z.literal('table'),
    heading: nonEmpty,
    columns: z.array(nonEmpty).min(2).max(4),
    rows: z.array(z.array(z.string())).min(1).max(6),
  })
  .refine((s) => s.rows.every((row) => row.length === s.columns.length), {
    message: 'rows の各行は columns と同じ列数にしてください',
    path: ['rows'],
  });

export const FlowSlide = z.strictObject({
  kind: z.literal('flow'),
  heading: nonEmpty,
  nodes: z.array(nonEmpty).min(2).max(6),
});

export const CodeSlide = z.strictObject({
  kind: z.literal('code'),
  heading: nonEmpty,
  language: nonEmpty,
  code: nonEmpty.refine((c) => c.split('\n').length <= 14, {
    message: 'code は 14 行以内にしてください',
  }),
});

export const Slide = z.discriminatedUnion('kind', [
  TitleSlide,
  BulletsSlide,
  KeywordSlide,
  TableSlide,
  FlowSlide,
  CodeSlide,
]);
export type Slide = z.infer<typeof Slide>;

export const Line = z.strictObject({
  speaker: Speaker,
  /** 字幕に表示するテキスト */
  text: nonEmpty.max(80),
  /** 読み上げ用テキスト (誤読対策)。省略時は text を読む */
  yomi: nonEmpty.optional(),
  /** 話者の表情 */
  face: Face.optional(),
  /** 聞き手の表情 */
  partnerFace: Face.optional(),
  /** このセリフ以降に表示する項目数 (bullets/table/flow の段階表示) */
  reveal: z.int().nonnegative().optional(),
});
export type Line = z.infer<typeof Line>;

/** 段階表示できる項目数。段階表示できないスライドは null */
export const revealableCount = (slide: Slide): number | null => {
  switch (slide.kind) {
    case 'bullets':
      return slide.items.length;
    case 'table':
      return slide.rows.length;
    case 'flow':
      return slide.nodes.length;
    case 'title':
    case 'keyword':
    case 'code':
      return null;
    default:
      return slide satisfies never;
  }
};

export const Scene = z
  .strictObject({
    /** チャプター名 (プレイヤーの目次に使う) */
    chapter: nonEmpty,
    slide: Slide,
    lines: z.array(Line).min(1),
  })
  .superRefine((scene, ctx) => {
    const max = revealableCount(scene.slide);
    scene.lines.forEach((line, i) => {
      if (line.reveal === undefined) return;
      if (max === null) {
        ctx.addIssue({
          code: 'custom',
          message: `${scene.slide.kind} スライドでは reveal を使えません`,
          path: ['lines', i, 'reveal'],
        });
      } else if (line.reveal > max) {
        ctx.addIssue({
          code: 'custom',
          message: `reveal は項目数 (${max}) 以下にしてください`,
          path: ['lines', i, 'reveal'],
        });
      }
    });
  });
export type Scene = z.infer<typeof Scene>;

export const Source = z.strictObject({
  title: nonEmpty,
  /** プレイヤーページのリンクになるため http(s) に限る */
  url: z.url({ protocol: /^https?$/ }).optional(),
});
export type Source = z.infer<typeof Source>;

export const Episode = z.strictObject({
  title: nonEmpty,
  /** 一覧やプレイヤーに出す一文の概要 */
  summary: nonEmpty,
  scenes: z.array(Scene).min(1),
  /** 台本作成時に参照した情報源 */
  sources: z.array(Source).default([]),
});
export type Episode = z.infer<typeof Episode>;
export type EpisodeInput = z.input<typeof Episode>;

export type ParseResult = { ok: true; episode: Episode } | { ok: false; issues: string[] };

export const parseEpisode = (input: unknown): ParseResult => {
  const result = Episode.safeParse(input);
  if (result.success) return { ok: true, episode: result.data };
  return {
    ok: false,
    issues: result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    ),
  };
};
```

## 全体構成

- 長さの目安は **5〜6 分 / 70〜90 セリフ / 10〜12 シーン**。1 セリフ ≒ 3〜4 秒。
- 1 シーン = 1 チャプター = 1 スライド。セリフは 5〜8 個。
- 定番の流れ:
  1. オープニング (`title`): 名乗り (「ずんだもんなのだ！」「四国めたんよ。」) → トピック提示 → ずんだもんの素朴な疑問 → 「さっそく教えてほしいのだ！」
  2. それは何か (`keyword`)
  3. なぜ必要か・何が嬉しいか (`bullets`)
  4. 中心概念を 1 シーン 1 つずつ (`table` / `flow` / `code` / `bullets`)
  5. よくある誤解・注意点
  6. 明日からできること (`flow`)
  7. まとめ (`bullets`) → 「ご視聴ありがとう。」「また見てほしいのだ！」

## キャラクター

|        | ずんだもん (`zundamon`)                                    | 四国めたん (`metan`)                           |
| ------ | ---------------------------------------------------------- | ---------------------------------------------- |
| 役割   | 聞き手。視聴者の代わりに素朴な疑問・誤解・ツッコミを入れる | 解説役。落ち着いたお姉さん口調で具体例で答える |
| 語尾   | 「〜なのだ」「〜のだ？」「〜なのだ！」 (一人称は「ボク」)  | 「〜わ」「〜よ」「〜かしら」「〜ね」           |
| 割合   | 3〜4 割                                                    | 6〜7 割                                        |
| 立ち絵 | 画面右。`happy` / `smug` / `troubled` で立ち絵が差し替わる | 画面左。立ち絵は 1 枚 (表情は記号で出る)       |

- めたんが 3 セリフ以上続いたら、ずんだもんの相づち・質問・言い換えを挟む。
- ずんだもんがわざと誤解を口にし (「エンティティを作ればDDDってことなのだ？」)、めたんが正す流れを各回 1〜2 回入れる。
- 「なのだ」を毎文に付けるとくどい。ずんだもんは 2 文に 1 回程度でよい。
- 社内トピックでは身近な具体例 (自社のサービス名・業務) を積極的に使う。

## セリフ (`lines[]`)

| フィールド    | 用途                                                                                   |
| ------------- | -------------------------------------------------------------------------------------- |
| `speaker`     | `zundamon` / `metan`                                                                   |
| `text`        | 字幕。**80 字以内**、目安は 40 字以内 (長いと 2 行で小さくなる)。1 セリフ 1 メッセージ |
| `yomi`        | 読み上げ用。英字・略語・記号・カギ括弧・誤読しやすい漢字を含むときは必ず書く           |
| `face`        | 話者の表情 `normal` / `happy` / `surprised` / `troubled` / `smug`                      |
| `partnerFace` | 聞き手の表情 (驚かせる・苦笑させるなど)                                                |
| `reveal`      | 段階表示の件数 (後述)                                                                  |

### yomi

VOICEVOX は辞書にない英字・略語を 1 文字ずつや英語風に読みがち。`text` を元にカタカナへ置き換える。
読みが怪しいときは、エンジン起動中に次で読み (アクセント付きカナ) を確認できる。

```sh
curl -s -X POST '127.0.0.1:50021/audio_query?speaker=3' --data-urlencode 'text=<yomi>' -G | jq -r .kana
```

- `DDD` → `ディーディーディー`、`ID` → `アイディー`、`API` → `エーピーアイ`
- `User` → `ユーザー`、`calc()` → `カルク`、`Eric Evans` → `エリック・エヴァンス`
- 「」や（）は読み上げで間が崩れることがあるので、`yomi` では外すか読点に置き換える
- 数字は基本そのままでよい (`2003年`、`10件` は正しく読む)

### 表情

- `happy`: 納得・挨拶・まとめ (♪) / `surprised`: 意外な事実 (！) / `troubled`: 困りごと・ややこしい話 (汗) / `smug`: 決め台詞 (ドヤッ)
- 全セリフに付けない。感情が動くところだけ (3 割程度)。

## スライド (`slide`)

`kind` で判別する。文字を詰め込まない (はみ出すと自動縮小で読みにくくなる)。

| kind      | フィールド                                 | 使いどころ・上限                                           |
| --------- | ------------------------------------------ | ---------------------------------------------------------- |
| `title`   | `title`, `subtitle?`                       | オープニング                                               |
| `keyword` | `word`, `description?`                     | 用語の定義。`word` は 10 字前後、`description` は 2 行以内 |
| `bullets` | `heading`, `items` (1〜6)                  | 理由・ルール・まとめ。各項目 25 字以内                     |
| `table`   | `heading`, `columns` (2〜4), `rows` (1〜6) | 比較・対応表。各行は `columns` と同じ列数                  |
| `flow`    | `heading`, `nodes` (2〜6)                  | 手順・データの流れ。各ノード 10 字以内                     |
| `code`    | `heading`, `language`, `code` (14 行以内)  | コード例。空行は入れず 12 行以内が読みやすい               |

`heading` は 20 字以内を目安にする。

### 段階表示 (`reveal`)

`bullets` / `table` / `flow` では、セリフに合わせて項目を 1 つずつ出せる。

- シーン内で一度も `reveal` を書かなければ最初から全件表示。
- 一度でも書くと最初は 0 件から始まり、`reveal: n` のセリフ以降は先頭 n 件を表示する (指定のないセリフは直前の値を引き継ぐ)。
- 直近に出した項目は強調表示される。説明している項目と `reveal` を一致させる。
- `table` の `reveal` は行数 (ヘッダーは常に表示)。

```json
{
  "chapter": "なぜ必要なのか",
  "slide": {
    "kind": "bullets",
    "heading": "複雑になる理由",
    "items": ["業務ルールが複雑", "言葉がずれる"]
  },
  "lines": [
    { "speaker": "zundamon", "text": "どうしてそんな考え方が必要なのだ？", "reveal": 0 },
    { "speaker": "metan", "text": "難しさの原因は、たいてい業務ルールなのよ。", "reveal": 1 },
    { "speaker": "metan", "text": "しかも言葉がずれると、翻訳ミスが起きるわ。", "reveal": 2 }
  ]
}
```

## トップレベル

```json
{
  "title": "ずんだもんのDDD入門",
  "summary": "プレイヤーページに出す一文の概要",
  "sources": [{ "title": "資料名", "url": "https://..." }],
  "scenes": [
    {
      "chapter": "オープニング",
      "slide": { "kind": "title", "title": "ずんだもんのDDD入門", "subtitle": "ドメイン駆動設計をざっくり理解しよう" },
      "lines": [
        { "speaker": "zundamon", "text": "ずんだもんなのだ！", "face": "happy" },
        { "speaker": "metan", "text": "四国めたんよ。", "face": "happy" },
        { "speaker": "metan", "text": "今回はDDD、ドメイン駆動設計について解説するわ。", "yomi": "今回はディーディーディー、ドメイン駆動設計について解説するわ。" },
        { "speaker": "zundamon", "text": "名前はよく聞くけど、難しそうなのだ……。", "face": "troubled" },
        { "speaker": "metan", "text": "DDDの本質はクラスの作り方じゃないのよ。", "yomi": "ディーディーディーの本質はクラスの作り方じゃないのよ。", "face": "smug", "partnerFace": "surprised" }
      ]
    }
  ]
}
```

- `title` は 15 字前後。「ずんだもんの〇〇入門」の形にすると雰囲気が出る。
- `sources[].url` は省略可 (書籍など)。

## セルフチェック

- [ ] ずんだもんの疑問 → めたんの答え、のリズムになっている
- [ ] ずんだもんは「〜なのだ」、めたんは「〜わ/〜よ」の口調が崩れていない
- [ ] 英字・略語を含む全セリフに `yomi` がある
- [ ] `reveal` が説明の順番と一致している
- [ ] 事実関係が調査結果・出典と一致している (特に社内トピック)
