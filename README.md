# Loop Pad (Web)

複数のボタンに音源を割り当てて、タップで再生/停止できるシンプルな Web アプリです。  
各パッドごとに `ループ` の ON/OFF ができます。

## 機能

- 4 / 8 / 12 / 16 / 24 / 32 パッドに切り替え
- 各パッド名を自由に変更
- 各パッドで音源ファイルを割り当て（`audio/*`）
- 各パッドでマイク録音して音源を割り当て
- `マイク接続` で許可を先に取得して録音ごとの再許可を減らす
- 録音済みパッドを `01_(パッド名).拡張子` 形式で一括ZIP保存
- パッドタップで再生 / 停止
- パッドごとのループ再生
- `全停止` ボタン

## ローカルで確認

依存関係はありません。`index.html` をブラウザで開くだけで動きます。

`file://` 直接起動だとブラウザによってはマイク許可が毎回出ます。  
オフラインでも `http://localhost` で開く方が安定します。

```bash
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000` を開いて使ってください。

## GitHub で公開（GitHub Pages）

1. GitHub で新規リポジトリを作成（例: `loop-pad`）
2. このフォルダで以下を実行

```bash
git init
git add .
git commit -m "Initial loop pad app"
git branch -M main
git remote add origin https://github.com/<your-name>/loop-pad.git
git push -u origin main
```

3. GitHub の `Settings > Pages`
4. `Build and deployment` で `Deploy from a branch`
5. Branch を `main` / Folder を `/ (root)` にして保存
6. 数十秒待って公開URLにアクセス

## iPhone で使うときの補足

- Safari は自動再生制限があるため、最初の再生はタップ操作で開始してください
- 録音を使うときはマイク許可が必要です
- 許可ダイアログを減らすには先に `マイク接続` を押して接続を維持します
- 一括保存は録音パッドのみ対象（ファイル割り当ては対象外）
- ホーム画面に追加すると、アプリ風に使えます

## 既存サービス（参考）

- Koala Sampler (iOS)
- Launchpad (iOS)
- BandLab Sampler (Web / モバイル)

「ブラウザだけで自分専用UIを作りたい」なら、このリポジトリ方式が一番自由です。
