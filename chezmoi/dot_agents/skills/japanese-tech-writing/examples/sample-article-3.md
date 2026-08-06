# サンプル記事3: RUN --mount=type=bind の動きを調べて COPY のオーバーヘッドを無くす

この記事は実際に執筆された技術記事のサンプルです。文体のスタイル参考として使用してください。

---

## はじめに

この記事は、株式会社エス・エム・エス Advent Calendar 2024 シリーズ2の12/6の記事です。

Docker において、ビルド時にファイルマウントを行うことができる `RUN --mount=type=bind` を使ってみたところ

- `docker run --mount type=bind` と混同して理解に詰まったり
- 後続のステップで参照できないため、実際に使うには工夫が必要だったり

といったことがありました。

このエントリでは細かいな動き等を試して理解を進めながら、実際に Dockerfile でどう利用していくか等を考えてみようと思います。

## おさらい: `docker container run --mount type=bind`

本題の `RUN --mount=type=bind` を見ていく前に、よく知られた docker run の mount bind をおさらいしておきます。

docker run するときに `--mount type=bind` オプションを指定することで、ホストマシンのファイルやディレクトリをコンテナ内にマウントすることができます。
マウントしていると、コンテナの中からホストマシンからバインドしたファイルを参照でき、ホストマシン側の変更がコンテナ側にも反映されます:

```bash
$ echo 'dummy' >> ./dummy.txt
$ docker container run --mount type=bind,source=./,target=/run-mount ubuntu:latest bash -c 'cat /run-mount/dummy.txt'
dummy
```

また、コンテナの中でファイルを編集した場合に変更がホストマシン側にも反映されます:

```bash
$ docker container run -it --mount type=bind,source=./,target=/run-mount ubuntu:latest bash -c 'echo "dummy from container" >> /run-mount/dummy.txt'
$ cat ./dummy.txt
dummy
dummy from container
```

(ビルド時ではなく)起動してから必要な設定ファイルを流し込んだり、on Docker で開発したいときにコンテナ内のファイルとホストマシン側のファイルを同期したり等幅広く利用されています。

## `RUN --mount-type=bind`: ビルド時にコンテキストとバインドする

さて、本題の `RUN --mount-type=bind` について見ていきます。

まずは公式ドキュメントの説明を見てみます。

[Dockerfile reference | Docker Docs](https://docs.docker.com/reference/dockerfile/#run---mount)

> (--mount の説明)
> RUN --mount allows you to create filesystem mounts that the build can access. This can be used to:
>
> (type=bind の説明)
> This mount type allows binding files or directories to the build container. A bind mount is read-only by default.
>
> (from オプションの説明)
> Build stage, context, or image name for the root of the source. Defaults to the build context.

つまり、`--mount=type=bind, ...` を指定すること

- ビルド時にアクセスできる read-only なマウントを作成できる
- マウント元は特に from を明示しなければビルドコンテキスト(**ホストマシンではない**)になる
    - 指定をすれば任意のステージ・任意のイメージからマウントすることもできる

と読めます。

したがって

```dockerfile
WORKDIR /app
COPY . .
RUN pnpm build
```

のようにソースコードをコピーしてきてビルドするような処理を

```dockerfile
WORKDIR /app
RUN --mount=type=bind,source=.,target=/app \
  pnpm build
```

のようにコピーなしでソースコードはマウントしてビルド処理を書いたりと言った使い方ができます。

## 単一ステージでビルドする

具体的な利用方法として、まずは単一ステージで `RUN --mount=type=bind` を使う場合を見ていきます。

```dockerfile
FROM node:20-slim AS build

WORKDIR /app

RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline

RUN --mount=type=bind,source=.,target=/app \
    npm run build
```

この例では、`package.json` と `package-lock.json` をマウントして `npm ci` を実行し、その後ソースコード全体をマウントしてビルドしています。

重要なのは、**マウントはそのステップ限りで有効**という点です。次のステップでは参照できません。

## readwrite オプションで吐き出した成果物の扱い

ビルド成果物を後続のステップで使いたい場合、`readwrite` オプションを使うことで書き込み可能なマウントを作成できます。

```dockerfile
RUN --mount=type=bind,source=.,target=/app,readwrite \
    npm run build
```

ただし、これでも成果物はマウント先に書き込まれるため、後続のステップでは参照できません。

実際に成果物を利用するには、明示的にコピーする必要があります:

```dockerfile
RUN --mount=type=bind,source=.,target=/build-context,readwrite \
    npm run build && \
    cp -r /build-context/dist /app/dist
```

## まとめ

`RUN --mount=type=bind` を使うことで、COPY によるオーバーヘッドを削減できます。

ポイント:
- マウントはそのステップ限りで有効
- 成果物を利用するには明示的なコピーが必要
- キャッシュマウントと組み合わせると効果的

ビルド時間の短縮やイメージサイズの削減に役立つので、ぜひ試してみてください！
