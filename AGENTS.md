AI エージェント（Claude Code・Codex など）が Meltype で作業するときの決まりです。

詳しい開発手順は [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)、貢献の決まりは [CONTRIBUTING.md](CONTRIBUTING.md) を見てください。

## 構成（どこを触るか）

| 場所                         | 中身                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `src/Meltype.Core`         | OS 非依存の判定・変換コア（Composition / Detection / Input / Config / Diagnostics）。**判定・変換を直すときはまずここ** |
| `src/Meltype.Core.Tests`   | コアのテスト（どの OS でも動く）                                                                         |
| `src/Meltype`              | Windows 版（TSF・UI・更新）                                                                       |
| `src/Meltype.Tests`        | Windows 版のテスト（Windows 専用。Core のテストもまとめて流せる）                                                |
| `src/Meltype.Mac.Native`   | Mac 版から呼ぶコアの出口                                                                             |
| `native/tip`・`native/mozc` | ネイティブ（TSF の TIP・Mozc）                                                                      |
| `mac/`                     | Mac 版（Swift）                                                                               |
| `linux/`                   | Linux 版（fcitx5・ibus）とパッケージ                                                                 |
| `web/`                     | Web（Cloudflare Workers・報告フォーム）                                                             |
| `dictionaries/`            | 辞書                                                                                         |
| `tools/`                   | 辞書生成・検査・ベンチ・テスト用スクリプト                                                                      |
| `docs/`                    | 使い方・開発・設計の文書                                                                               |

## ビルドとテスト

```bash

dotnet build Meltype.sln

# コアのテスト（Linux / macOS / Windows どれでも）
dotnet run --project src/Meltype.Core.Tests
dotnet run --project src/Meltype.Core.Tests -- CompositionTests # 名前に一致するテストだけ
dotnet run --project src/Meltype.Core.Tests -- --eval # 品質テスト（正解率と外れた例）
dotnet run --project src/Meltype.Core.Tests -- --repro kyouhagoogle enter # 打ったときの見え方と確定結果
dotnet run --project src/Meltype.Core.Tests -- --explain konnichiwa hello # 1文字ずつの判定理由
dotnet run --project src/Meltype.Core.Tests -- --segments kyouhagoogle # 単位と英日区間分け
dotnet run --project src/Meltype.Core.Tests -- --expect path/to/cases.tsv out.json # 報告された誤変換
dotnet run --project src/Meltype.Core.Tests -- --mixed-bench out.json # 日本語文中の英単語の区切り
dotnet run --project src/Meltype.Core.Tests -- --version

# Windows 専用（src/Meltype.Tests。Windows のスペルチェッカーも使う）
dotnet run --project src/Meltype.Tests
dotnet run --project src/Meltype.Tests -- CompositionTests
dotnet run --project src/Meltype.Tests -- --explain konnichiwa hello
dotnet run --project src/Meltype.Tests -- --convert きょうはいいてんき # 変換結果と文節区切り
dotnet run --project src/Meltype.Tests -- --context この本は:あつい # 文脈付き変換

# 辞書を変えたとき
node tools/check-dictionaries.mjs

```

- **Linux / macOS では `src/Meltype.Tests` は動かない。** `src/Meltype.Core.Tests` で確認する。
- `--repro`・`--perf` などで漢字変換するには、環境変数 `MELTYPE_MOZC` に Mozc 変換ヘルパーのパスを指定する（未指定だと判定のみで、かなのまま確定する）。
- ヘルパーは main の `linux.yml` 成果物 `meltype-linux` の zip 内 `Meltype-linux/mozc/meltype_mozc_helper` を使う。
- `native/mozc/build-mozc-helper.sh` で手元ビルドするのは、ヘルパーのソースや `MOZC_COMMIT` を変えたときだけ（初回 30〜40 分かかる）。

その他のフラグ（`--perf`・`--judge-corpus`・`--henkan` など）は `src/Meltype.Core.Tests/Program.cs` のコメントを見てください。



## フォーマット

CI は **変えた行の空白・改行・字下げ** だけを見る（前からある違反は失敗にしない）。自動では直さない。

```bash

# 変えたファイルだけ直す
dotnet format whitespace --folder --include path/to/File.cs

# 手元で CI と同じ検査（main と比較）
node tools/check-format.mjs origin/main

```

PR を出す前に、変えた `.cs` に対して `dotnet format whitespace` をかけておく。フォーマットの失敗を CI まで残さない。

## テストの書き方

判定・変換を変えたら、報告された例をテストに足す。特に次を優先する。

- **リグレしそうなもの**（直した語の逆向き・似た入力）
- **エッジケース**
- **複数の解釈がありそうなもの**（例: `midika` → `midiか` / `身近`）

実装の写しのようなテストは書かない。将来の挙動を保証したいものも書く。

例: `midi` を英語にする直しをしたら、`midika`（身近）が壊れないかも足す。英語にする直しならその語で始まる日本語、日本語にする直しならその語を含む英単語を足す。

## 必ず守ること

- **新しいソースファイルの先頭**にライセンスと著作権を入れる。既存ファイルを真似て `Yukishiro` にせず、変更を頼んだ人（PR を出す人）の名前にする。分からなければ聞く。

```
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 あなたの名前

```

- **PR は [テンプレート](.github/PULL_REQUEST_TEMPLATE.md) どおりに書く。**
- **「## 確かめること」は変換・判定の例を `打ったもの → 期待する結果` の形で書く。**
（一般の「やること → 結果」ではない。bot が PR のコードで再現を確認する）

```

* kyouhagoogle → 今日はgoogle
* midika → 身近

```

- **AI を使ったことを PR に書く。** テンプレートの「AI を使った」にチェックを入れ、使った部分を書く。
- **説明は日本語で書く。** PR の本文・コメント・文書は日本語で書く。
- **PR と関係ない場所を変更しない。**

## してはいけないこと

- テストを消す・飛ばす・ゆるめることで通す。
- 生成されたファイル（辞書から作るもの、`tools/make-*` で作るものなど）を手で直す。生成スクリプトを使う。
- 頼まれていないのに、リリース・Homebrew cask・winget などの配布まわり（`.github/workflows`・`Casks/`・`packaging/`）を変える。

## 迷ったとき

1. **スコープを超えない** … 頼まれた Issue / 指示に必要な最小限だけ。関係ない場所は触らない。
2. **判定・変換の変更は Core から** … `src/Meltype.Core` を直し、テストは `src/Meltype.Core.Tests` に足す。
3. **分からないことは聞く** … 著作権名、仕様の解釈、配布まわりなど、推測で進めない。
