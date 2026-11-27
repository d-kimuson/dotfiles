# agent-browser が Chrome を見つけられず起動しない

## Symptom

agent-browser (mise で入れた `npm:agent-browser`) を既定のまま起動すると、ブラウザが見つからず失敗する。

```
  - agent-browser cache: /home/fleet/.agent-browser/browsers
  - System Chrome installations
  - Puppeteer browser cache
  - Playwright browser cache
Run `agent-browser install` to download Chrome, or use --executable-path.
```

Nix store の Chromium を `--executable-path` で渡しても、`--no-sandbox` なしでは crashpad のエラーを出して起動しない。

```
Hint: try --args "--no-sandbox" (required in containers, VMs, and some Linux setups)
```

## Workaround

Nix store に残っている Chromium を探し、`--executable-path` と `--args "--no-sandbox"` を付けて起動する。

```sh
chromium_bin=$(ls -d /nix/store/*-chromium-*/bin/chromium | tail -n 1)
agent-browser --session browser-ops-qa-<random> \
  --executable-path "$chromium_bin" --args "--no-sandbox" \
  open file:///path/to/page.html
```

Nix store に Chromium が無い場合は、ユーザーに `agent-browser install` の実行可否を確認する。

claude.ai 上の Artifact ページのようにログインが要るページは、shared profile (`~/.config/agent-browser/profiles/shared`) にログイン済みでないと確かめられない。browser-ops skill のログイン手順でユーザーにログインを依頼する。

## Why Not Fixed

agent-browser 用のブラウザを home-manager で入れるか `agent-browser install` で入れるかの方針が決まっていない。Nix store の Chromium は GC root が無く、`nix-collect-garbage` で消えることがある。
