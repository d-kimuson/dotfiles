# package

## .node-version

```text
24.11.1
```

## package.json

```json
{
  "name": "<package-name>",
  "version": "0.0.0",
  "private": true,  // 非公開の場合のみ
  "license": "MIT", // 公開の場合のみ
  "type": "module",
  "scripts": {},
  "dependencies": {},
  "devDependencies": {},
  "packageManager": "pnpm@10.26.1+sha512.664074abc367d2c9324fdc18037097ce0a8f126034160f709928e9e9f95d98714347044e5c3164d65bd5da6c59c6be362b107546292a8eecb7999196e5ce58fa"
}
```

パッケージ作成後に `` を実行することで できる(する)

```bash
pnpm dlx corepack use pnpm@latest # packageManager を最新 & ハッシュ固定にアップデート
pnpm i # lockfile
```

## .npmrc

```toml
engine-strict=true
save-exact=true
```

## pnpm-workspace.yaml

```yaml
catalogMode: strict

cleanupUnusedCatalogs: true

minimumReleaseAge: 7200
```

## LICENSE

```text:LICENSE
MIT License

Copyright (c) 2025 d-kimuson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
