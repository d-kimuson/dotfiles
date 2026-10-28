# cacert の blacklist に上流で削除済みの証明書名を残すと cacert のビルドが失敗する

## Symptom

`pkgs.cacert.override { blacklist = [ ... ]; }` の blacklist に、上流 (NSS の証明書ストア) から既に削除された名前を残していると、cacert のビルドが次のエラーで失敗する。`scripts/update.sh` の `home-manager switch` もここで止まる。

```console
Certs in blocklist but not in cert store: {'emSign ECC Root CA - G3'}
```

## Workaround

blacklist から上流のストアに存在しない名前を消す。
侵害された中間 CA の上位ルートを外すためだけの blacklist なら、override ごと外して `pkgs.cacert` をそのまま使う。nixpkgs の `cacert` (3.131.1 以降) は侵害されたチェーンを既定のバンドルで拒否する。

## Why Not Fixed

blacklist の各名前が上流のストアに存在するかは nixpkgs のビルド時に検査され、リポジトリ側では緩められない。上流のストアは随時変わるため、blacklist はリポジトリに持たず `pkgs.cacert` をそのまま使う方針にした。
