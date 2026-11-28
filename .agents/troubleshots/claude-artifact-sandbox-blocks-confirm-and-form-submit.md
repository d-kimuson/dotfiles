# claude.ai の Artifact で confirm() が常に false になり、form の submit が発火しない

## Symptom

claude.ai の Artifact のページで、次の 2 つが起きる。エラーは出ない。

- 確認つきのボタンを押しても何も起きない。`confirm()` がダイアログを出さずに常に `false` を返す。`alert()` と `prompt()` もダイアログを出さない。
- form の submit イベントが発火しない。dev-process-kit 0.4.2 の Kanban の詳細にある「リンクの追加」(`form.kanban-link-add`) も動かない。

Artifact のページは sandbox の iframe で動き、sandbox 属性に `allow-modals` と `allow-forms` が無い。手元で `<iframe sandbox="allow-scripts allow-same-origin">` にページを入れると同じ挙動を再現できる。

## Workaround

Artifact のページでは `confirm()`・`alert()`・`prompt()` と form の submit を使わない。

- 確認が要る操作は、ページ内の要素 (2 段階のボタンなど) で確認を取る。
- 入力の確定は、button の click と、入力欄の Enter の keydown で処理する。
- type=url などの入力検査は、submit に頼らず `input.checkValidity()` を呼んで自前で行う。
- dev-process-kit の form (`form.kanban-link-add` など) は、shadow root に capture で click と Enter の keydown のリスナーを付け、form の submit と同じ action を `dispatchElementAction` で書く。

手元で確かめるときは、ページを `<iframe sandbox="allow-scripts allow-same-origin">` に入れた模擬ページで動作を見る。

## Why Not Fixed

iframe の sandbox 属性は claude.ai 側が決めており、ページからは変えられない。dev-process-kit の form の実装は外部の kit のもので、このリポジトリからは直せない。
