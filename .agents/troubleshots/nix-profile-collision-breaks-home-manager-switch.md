# nix profile と home.packages のパッケージが衝突して home-manager switch が失敗する

## Symptom

`home.packages` に追加したパッケージが、別途 `nix profile install` で入れたパッケージと同じファイル (共有ライブラリなど) を提供すると、`home-manager switch` が衝突エラーで失敗する。
例: `home.packages` に `pkgs.llama-cpp` を追加したところ、別途入れていた `whisper-cpp` と `lib/libggml-*.dylib` が衝突した。

一般形は次のメッセージ (今回の実際のログは未記録なのでハッシュは一般化している)。

```
error: collision between `/nix/store/<hash>-whisper-cpp-<ver>/lib/libggml-base.dylib' and `/nix/store/<hash>-llama-cpp-<ver>/lib/libggml-base.dylib'
```

switch が失敗すると profile は更新されないため、直前の世代が `home-manager-path` を含んでいない状態になっていることがあり、PATH 上のツールが一括で消える。

## Workaround

`nix profile rollback` で直前の世代に戻す (例: generation 220 → 219)。
衝突するパッケージは `home.packages` に入れず、必要な場所だけ (launchd agent の `EnvironmentVariables.PATH` など) で個別に参照する。llama-cpp の実例は `docs/features/local-llm.md` と `chezmoi/private_dot_config/home-manager/home.nix.tmpl` の `launchd.agents.local-llm`。

## Why Not Fixed

`home.packages` と手動の `nix profile install` が同じファイルを提供するかはパッケージの組み合わせ次第で事前に分からない。衝突が起きたらその都度、該当パッケージを `home.packages` から外す対応になる。
