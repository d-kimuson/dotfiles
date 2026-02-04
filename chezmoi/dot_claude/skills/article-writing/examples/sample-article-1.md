# サンプル記事1: MCPたくさん入れたいけどコンテキストが...を解決した話

この記事は実際に執筆された技術記事のサンプルです。文体のスタイル参考として使用してください。

---

## はじめに

MCP (Model Context Protocol) が Anthropic から公開されてもうすぐ1年になりますね。

各社ベンダーや個人が便利な MCP を公開しできることが増えていく一方で、MCP をたくさん登録しておくことによるコンテキストの肥大化問題にも焦点が当たるようになってきました。

単一の MCP サーバーから複数のツールが登録され、それぞれのツールに対する description・スキーマ情報がすべてシステムプロンプトとして読まれるため、たまに使う MCP も雑に追加していくとコンテキストを圧迫してしまうよね、というものです。

下記の記事で詳しく説明されています:

https://zenn.dev/medley/articles/optimizing-claude-code-context-with-mcp-tool-audit

かくいう私もコンテキストを圧迫したくないので、常時繋いでいるのは利用頻度が高くツール数の少ない upstash/context7 のみで他は都度繋ぐ運用をしていますが、なかなか不便です。

そんな中、Claude に新機能として「Claude Skills」がリリースされました。

https://www.anthropic.com/news/skills

簡単に説明すると

- Skill はディレクトリ単位で登録し、SKILL.md をエントリポイントとして設定
  - ドキュメントやスクリプトを置いておくことができる
- システムプロンプトに Skill の一覧（name, description）のみが表示される
- LLM は必要になったら `view(skill='skills/typescript/SKILL.md')` のように指定することで、スキルの使い方を知り SKILL.md の説明にしたがって参照やスクリプト実行を行う

MCP とかなり似通った使い方ができそうに思えますが、重要な違いは **「Skill はグループに対する description しか読まれない」** ので、コンテキストを圧迫しづらい、ということです。

例として Playwright MCP は20以上のツールを登録する MCP なので、Playwright を操作する20個の関数×(name + description + inputSchema)の情報がコンテキストに含まれることになります。

一方、Playwright Skill として同様の仕組みを作った場合、システムプロンプトに含まれるのは Playwright Skills の description のみであり、使える処理やドキュメントはすべて SKILL.md を介して読まるので不要なタスクでコンテキストを圧迫しません。

Claude Skills では MCP や常時読ませるプロンプトの辛かったポイントが解決されているように思えます。

こういう管理は自分も以前からやっていたので、標準で入って嬉しい機能でした！一方で、ツール呼び出し（≒スクリプト実行）に関しては MCP のエコシステムが発達しつつあるので、むしろ MCP の拡張でこういう仕組みがほしかったなーーというのが一番の感想でした。

で、よくよく考えると別に MCP 側でサポートされなくても既存の MCP を Proxy して遅延で関数情報等を読ませるだけで実現できるな？？となったので、さくっと実装して公開しました。

## 作ったもの

薄い実装なので、自前で実装して再現することも可能ですが、試しやすいように npm パッケージとして作成し公開しています。

https://www.npmjs.com/package/@kimuson/modular-mcp

パッケージは modular-mcp と命名しました。

これは他の MCP サーバーをプロキシする MCP サーバーで、Claude Skills のように必要になったときに、必要なグループのみツールの詳細情報を読み込むことができます。

リポジトリ:
https://github.com/d-kimuson/modular-mcp

## How it works?

考え方はシンプルで

- 1MCP Server=1グループとしてまとめ、それぞれの MCP Server には `@kimuson/modular-mcp` を介してアクセスされる
  - Ex. 冒頭の例なら `@playwright/mcp` から提供されるツール群 = playwright グループ
- エージェントに直接登録されるのは `@kimuson/modular-mcp` のみなので、MCP の数が増えてもコンテキストが(ほぼ)増えない
- じゃあエージェントはどうMCPを利用するか？
  - システムプロンプトとしてMCPグループの一覧と対象のグループをどういうときに利用するかの説明が載る
  - それぞれのグループの関数一覧・スキーマは `@kimuson/modular-mcp` のツール呼び出しによって読み込む → 必要なときのみコンテキストに載せて利用できる

という感じで、Claude Skills に近いです。

ざっとを仕組みを説明します。

利用するエージェントは Claude Code を前提に記載しますが、MCP なのでエージェントツールに縛りはないです。

まず、利用したい MCP の設定ファイルを用意します。これは直接 Claude Code に読ませないので `.mcp.json` ではなく任意の名前(Ex. modular-mcp.json) として作成します。

設定は標準的な MCP の設定が基本ですが、`description` フィールドだけ拡張されています。

```json:modular-mcp.json
{
  "mcpServers": {
    "context7": {
+     "description": "ライブラリのドキュメントを検索したいときに使ってね",
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"],
      "env": {}
    },
    "playwright": {
+     "description": "ブラウザを操作をしたいときに使ってね",
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"],
      "env": {}
    }
  }
}
```

MCP 設定ファイルができたら、Claude Code に登録する用(=`@kimuson/modular-mcp` のみ)の MCP 設定ファイル(`.mcp.json`)を作成します。

```json:.mcp.json
{
  "mcpServers": {
    "modular-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@kimuson/modular-mcp@latest", "./modular-mcp.json"],
      "env": {}
    }
  }
}
```

MCP が起動し、エージェントと会話を始めると `@kimuson/modular-mcp` は2つのツールを登録します。

- `get-modular-tools(group: string)`: 特定のグループのツール一覧とスキーマを取得
- `call-modular-tool(group: string, name: string, args: object)`: 特定のグループのツールを実行

そして `get-modular-tools` の description として以下のような説明がシステムプロンプトに追加されます:

```
modular-mcp は複数の MCP サーバーを整理されたグループとして管理し、すべてのツール説明で LLM を圧迫する代わりに、必要なグループのツール説明のみをオンデマンドで提供します。
このツールを使用して特定のグループで利用可能なツールを取得し、次に call-modular-tool を使用してそれらを実行します。

利用可能なグループ:
- context7: ライブラリのドキュメントを検索したいときに使ってね
- playwright: ブラウザを操作・自動化したいときに使ってね
```

description に利用可能なグループの名前と説明を載せるのがキモで、これによりエージェントはシステムプロンプトとして、ツール呼び出しなしで利用可能なグループを把握できます。

あとは、実際に実行するのは簡単です

1. ブラウザ操作が必要な状況にぶつかり、システムプロンプトで「ブラウザ操作したいときはplaywrightグループを使えば良いらしい」と知っているので、使える関数を調べる: `get-modular-tools(group="playwright")`
2. 関数名・スキーマ情報が返ってくるのでそれにしたがって `call-modular-tool(group="playwright", name="browser_navigate", args={"url": "https://example.com"})` を呼び出す

実際に Claude Code で動かしたログ:

[スクリーンショット画像]

通常の利用方法と比較して `get-modular-tools` のステップだけ増えてますが、正しく利用できています。

## コンテキストを見てみる

さて、本題はコンテキストサイズの削減だったので実際にどれくらい影響があるのかを見てみましょう。

私が常に入れている MCP はコンテキスト圧迫を避けるために利用頻度が高いかつツール数の少ない `@upstash/context7-mcp` だけだったので、例によってPlaywright MCP を追加して確認してみます。

### まずは Before

```
> /context
  ⎿
      Context Usage
     ⛁ ⛁ ⛁ ⛁ ⛁ ⛁ ⛁ ⛁ ⛁ ⛁   claude-sonnet-4-5-20250929 · 82k/200k tokens (41%)
     ⛁ ⛁ ⛁ ⛁ ⛁ ⛁ ⛁ ⛀ ⛀ ⛀
     ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶   ⛁ System prompt: 2.4k tokens (1.2%)
     ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶   ⛁ System tools: 15.7k tokens (7.8%)
     ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶   ⛁ MCP tools: 16.7k tokens (8.3%)
     ...
```

⛁ System tools: 15.7k tokens (7.8%)
⛁ MCP tools: 16.7k tokens (8.3%)

この2つが大きそうですね。

やはり Playwright の圧迫量が大きく、MCP だけでウィンドウの 8.3% (16.7k/200k) を占有しています。

### After: Modular MCP を利用した場合

```
> /context
  ⎿
      Context Usage
     ⛁ ⛁ ⛁ ⛁ ⛁ ⛁ ⛁ ⛁ ⛁ ⛁   claude-sonnet-4-5-20250929 · 68k/200k tokens (34%)
     ⛀ ⛀ ⛀ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶
     ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶   ⛁ System prompt: 2.5k tokens (1.2%)
     ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶   ⛁ System tools: 15.7k tokens (7.8%)
     ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶   ⛁ MCP tools: 2.7k tokens (1.4%)
     ...
```

⛁ System tools: 15.7k tokens (7.8%)
⛁ MCP tools: 2.7k tokens (1.4%)

System tools は当然変わっていませんが、MCP に関しては 8.3% -> 1.4% に減少しました。トークンサイズで約84%減になりますのでかなり大きいですね。

また、Playwright のような「たまにあると便利なんだけど8割型のタスクではいらないんだよな〜」系の MCP を雑に突っ込んでおいても、Modular MCP 経由であればシステムプロンプトは1行しか増えないのでほとんど気にせず追加できそうです。

実際、直接追加すると 4.8k のトークンサイズの増加が見られた aws-knowledge-mcp-server を追加してみてもトークンサイズの増加はありませんでした。

## まとめ

Claude Skills にインスパイアされて、MCP でも同様のコンテキスト効率化を実現する Modular MCP を作ったので紹介しました！

https://github.com/d-kimuson/modular-mcp

MCP たくさん登録してるよ！という人は、かなりエージェントの思考力を奪っている可能性があるので `@kimuson/modular-mcp` 経由にすると、普段のエージェントの力が一回りパワーアップするんじゃないかなと思います

また、私と同様にコンテキストに気をつけているが故に都度 MCP を差し替えて手間になっている方も、この仕組みの上でなら「便利だけどたまにしか使わない MCP Server」をカジュアルに登録しやすくなるので、お試しください！

リポジトリ見てもらえるとわかりますが、そこそこ薄いライブラリなのでセキュリティ面等、気になる方はお手元でさっと実装してもらっても手間はあまりかからないと思います。

ではでは〜
