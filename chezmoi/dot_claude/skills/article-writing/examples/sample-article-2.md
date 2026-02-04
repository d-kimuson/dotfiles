# サンプル記事2: Vercel AI SDK と mastra を使った AI Agent 開発 Tips

この記事は実際に執筆された技術記事のサンプルです。文体のスタイル参考として使用してください。

---

*退屈な開発をサボりたくて* 自律稼働する Devin のような LLM Agent を [Vercel AI SDK](https://sdk.vercel.ai/docs/introduction), [mastra](https://mastra.ai/) 辺りのエコシステムで自前で作ってみていたので知見を紹介します。

開発用の Agent に限らず、これから TypeScript エコシステムで Agent を組もうとしている人の参考になれば幸いです。

具体的な SDK の利用方法などは扱わず、技術選定やハマりがちだったポイントにフォーカスして書いていきます。

## TypeScript エコシステムでの SDK の選定

まず、プログラムから LLM をさわろうと思ったら SDK を使うのが手っ取り早いですが、複数のオプションがあります。

- OpenAI や Anthropic など特定のプロバイダの SDK を使う
  - 公式提供で安定していて使いやすい
  - 一方、モデルを差し替えたり、特定の用途に限って別のプロバイダのモデルを使ったりがしづらい
    - エージェント用途だと Claude Sonnet 3.5(or 3.7) が人気だが、そこそこ高いので一部のタスクをよりコスパの良いモデルに流したりしたいことはよくある

- 各 LLM Provider を抽象化して共通のインタフェースで扱える SDK を利用する
  - 著名なところだと LangChain・LiteLLM 辺り
    - Python で書かれている SDK ですが、それぞれ JavaScript 版も提供されています
    - (個人の感想でしかないですが) Python 用に設計された SDK をそのまま移植した感が強くて体験がかなり微妙でした
  - [Vercel AI SDK](https://sdk.vercel.ai/docs/introduction): Vercel が出している TypeScript で書かれた SDK. TypeScript らしくて書きやすい抽象化がされていて、さらに Vercel AI SDK の上に乗るエージェントフレームワークの [mastra](https://mastra.ai/) も利用できる

この記事では TypeScript で使いやすい Vercel AI SDK, mastra について書いていきます。

## モデルの選定

モデル選定については、実際に Agent を組んでみてどういうところで躓くか・どういう品質が必要になるかを掴みながら調整していく感じで良さそうです。

ただ、まず試すなら Claude Sonnet 3.5 (or 3.7) を選んでおけば間違いないです。

OpenAI の o1 や o3 系はコンピュータを使うような Agentic ワークフローと相性が悪いです。というのも、これらのモデルは与えられたプロンプトを長時間拡張思考した上で回答を返すことを目的としており、その代わりとして tool calls がサポートされていないためです。

一方で、Agentic ワークフローでは tool calls を行い、その結果をまたモデルに返してさらにツールを使ったり次のステップに進んだりをループして行うので、コンピュータを使うタイプの Agent を組むのであれば tool calls がサポートされているモデルを選ぶ必要があります。

## RAG の実装

Agent がコードベースや外部ドキュメントを参照する必要がある場合、RAG（Retrieval Augmented Generation）の実装が必要になります。

mastra は RAG の機構を提供してくれていますが、個人的には利用を見送りました。

理由は大きく2つあります:

### データソースの対応

mastra の RAG は Retriever という抽象化で扱います。これはデータソース（例: GitHub リポジトリ、Notion のデータ、etc）から embedding し RAG のインデックスを構築する基盤です。

現時点で対応しているデータソースは限られており、自分が欲しいデータソースが未対応だったこともあり、retriever 部分は自前で実装しました。

### Knowledge オブジェクトの構築

mastra では Knowledge というオブジェクトを構築することで RAG を使えるようにします。

```typescript
const knowledge = new Knowledge({
  name: 'my-knowledge',
  embedder,
  vectorStore,
  retriever,
})
```

この Knowledge オブジェクトを作るのに必要な embedder と vectorStore は、自前で用意する必要があります。

ドキュメントでは OpenAI と Pinecone を組み合わせた実装例が紹介されていますが、個人的にはもう少しシンプルにしたかったので、ローカルで動く [Chroma](https://www.trychroma.com/) を使って実装しました。

## ループを自前で書く

mastra の Agent では、Tool の呼び出しとその結果を使った次のステップへの進行といったループ処理を自動で行ってくれます。

しかし、実際に使ってみると、ループの途中でカスタムな処理を挟みたいケースが多々出てきました。

例えば:
- Tool の実行結果をログに残したい
- 特定の Tool が呼ばれた時に追加の処理を挟みたい
- ループの途中で状態を保存したい

こういったニーズに対応するため、最終的にはループ処理を自前で実装することにしました。

```typescript
while (true) {
  const result = await generateText({
    model,
    messages,
    tools,
  })

  if (result.finishReason === 'stop') {
    break
  }

  // Tool の実行
  for (const toolCall of result.toolCalls) {
    const toolResult = await executeTool(toolCall)

    // カスタム処理をここに挟める
    await logToolExecution(toolCall, toolResult)

    messages.push({
      role: 'tool',
      content: toolResult,
    })
  }
}
```

このように自前でループを書くことで、より柔軟な制御が可能になります。

## まとめ

Vercel AI SDK と mastra を使って AI Agent を開発する際のポイントをまとめました。

- モデルは Claude Sonnet 3.5/3.7 がおすすめ
- RAG は用途に応じて自前実装も検討
- ループ処理は自前で書くと柔軟性が高い

これから Agent 開発を始める方の参考になれば幸いです！
