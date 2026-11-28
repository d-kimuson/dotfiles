# agent-browser のスクリーンショットで日本語が豆腐になる

## Symptom

Nix store の Chromium (`agent-browser-cannot-launch-without-chrome.md` の手順) で日本語のページを撮ると、日本語の文字がすべて四角 (豆腐) で描かれる。英数字とレイアウトは正しく描かれる。

`fc-list :lang=ja` が何も返さない。マシンに日本語のフォントが入っていない。

## Workaround

文言の確認はスクリーンショットに頼らず、`eval` でテキストを取り出して確かめる。スクリーンショットはレイアウト (列の数、要素の有無、配置) の確認にだけ使う。

```sh
agent-browser --session <session> --executable-path "$chromium_bin" --args "--no-sandbox" batch \
  "open http://localhost:<port>/index.html" \
  "wait 6000" \
  "eval document.body.innerText" \
  "screenshot /path/to/out.png"
```

文言の見た目まで確かめる必要があるときは、ユーザーに日本語フォントの導入可否を確認する。

## Why Not Fixed

agent-browser 用のブラウザとフォントを home-manager で入れる方針が決まっていない (`agent-browser-cannot-launch-without-chrome.md` と同じ)。
