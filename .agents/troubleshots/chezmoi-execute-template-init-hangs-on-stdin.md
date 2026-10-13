# chezmoi execute-template --init が非対話実行で入力待ちのまま hang する

## Symptom

`chezmoi execute-template --init` は `chezmoi init` を模して、テンプレート内の `promptString`/`promptBool` などの prompt 関数を実行する。
対象テンプレートが使う prompt 関数に対応する値 (`--promptString`/`--promptBool`/`--promptChoice`/`--promptInt`/`--promptMultichoice`) を渡さずに非対話 (スクリプト・エージェント) から実行すると、標準入力からの応答を待ち続けて hang する。

## Workaround

テンプレートが使うすべての prompt 関数に対応する値を `--promptString key=value` などで渡す (`chezmoi execute-template --help` の Examples を参照)。
`--init` 特有の挙動 (prompt 関数の模倣) が不要なら、`--init` を付けずに `chezmoi execute-template` だけでテンプレートを検証する。

## Why Not Fixed

`--init` が対話を前提にした prompt 関数を評価する仕様自体は chezmoi 側の設計。
