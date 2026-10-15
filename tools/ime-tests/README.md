# IME入力テスト

Playwright Testで、入力テスト画面とイベント記録を検査するためのツールです。
製品IMEは起動せず、テストページと記録処理の動作を確認します。

## クイックスタート(基盤テスト)

Node.js 22.xを用意し、リポジトリのルートから実行します。

```bash
cd tools/ime-tests
npm ci
npx playwright install chromium
npm run test:ci
```

> Linuxでブラウザーの共有ライブラリも入れる場合は、`npx playwright install --with-deps chromium`を使います。

`test:ci`は型検査と基盤自身のテストです。実IMEを使うテストは含まれません。

> 画面用サーバーはテスト時に自動で起動します。手動で起動した`npm run dev`は、先に停止してください。

## ファイル構成

| 場所 | 役割 |
| --- | --- |
| `src/` | テストページと記録処理 |
| `tests/unit/` | 記録処理のテスト |
| `tests/page/` | テストページのテスト |

## テストを追加する

記録処理は`tests/unit/`、テストページは`tests/page/`に`*.spec.ts`を追加します。
各ディレクトリのspecはサブディレクトリも含めて自動で収集されます。

```bash
npm run test:ci
```

入力にはダミー値だけを使ってください。passwordの文字情報はイベント記録と書き出しJSONから除外します。

## 失敗を確認する

コンソールには、失敗したテスト名、アサーションのファイルと行番号、期待値と実際の値が表示されます。詳しく調べるには、実行後にHTMLレポートを開きます。

```bash
npm run report
```

レポートから失敗したテストを選ぶと、該当コードと差分を確認できます。

HTMLレポートは`artifacts/report/`、失敗時のtrace・スクリーンショットは`artifacts/results/`に保存します。
