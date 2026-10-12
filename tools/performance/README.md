# 性能の計測

Meltype の性能を測る仕組みは 2 つあります。

- **変換エンジンの計測 (`--perf`)**: Mozc を使って例文を打ち、遅延・段階ごとの時間・候補の数・控えの使い回し・メモリ・正解率を測ります。変換の精度を上げる機能を足す前と後の比較に使います (#279)
- **打鍵の処理の計測 (`benchmark-composition.py`)**: 変換エンジンを外して (候補を返さない偽物にして)、1 キーごとの処理だけを NativeAOT で測ります。下の [Composition performance check](#composition-performance-check)

どちらもアプリ本体には組み込みません。ふだんの入力では何も測らず、何もログに残しません。

## 変換エンジンの計測 (`--perf`)

```powershell
$env:MELTYPE_MOZC = "$PWD\native\mozc\bin\meltype_mozc_helper.exe"
dotnet run -c Release --project src/Meltype.Core.Tests -- --perf perf.json
```

```bash
MELTYPE_MOZC=/path/to/meltype_mozc_helper dotnet run -c Release --project src/Meltype.Core.Tests -- --perf perf.json
```

`--perf 出力ファイル [例文のファイル] [回数]` です。例文は既定で `tools/mozc-compare-cases.tsv` (1 行に「打ったもの<Tab>期待」)、回数は 5 回です。
`MELTYPE_MOZC` が無いと判定だけ (漢字にしない) で測るので、時間は Mozc ありのものと比べられません。
必ず `-c Release` で動かしてください (結果の `meta.configuration` に残ります)。

### 前と後を比べる

```powershell
git worktree add ..\meltype-base main
cd ..\meltype-base
dotnet run -c Release --project src/Meltype.Core.Tests -- --perf $env:TEMP\perf-base.json
cd -
dotnet run -c Release --project src/Meltype.Core.Tests -- --perf $env:TEMP\perf-current.json
dotnet run -c Release --project src/Meltype.Core.Tests -- --perf-compare $env:TEMP\perf-base.json $env:TEMP\perf-current.json
```

`--perf-compare` は、項目ごとの前・後・倍率を Markdown の表で出し (そのまま Pull Request に貼れます)、正解・不正解が変わった例文と、品質テストで新しく外れた例を出します。
比べる 2 つの版は、どちらも `--perf` がある版 (#279 より後) にしてください。

時間はばらつきます。同じ版を 2 回測っても、p95 は 1.5 倍、p99 は 2 倍ほどずれることがあります。

- ほかに重い処理が動いていないときに、同じ PC・同じ電源の設定で測る
- 前 → 後 → 前 → 後 のように交互に 2 回ずつ測り、同じ版どうしのずれより大きいかを見る
- 回数を増やす (`--perf perf.json tools/mozc-compare-cases.tsv 20`) と p99 が安定する
- 回数・控えの使い回し率・候補の数・正解率はばらつかないので、変わっていればそれは変更のせいです

### 測るもの

1 つの例文を、変換の控えを捨ててから打つ (**cold**) のと、すぐにもう一度打つ (**warm**、控えが残っている) のを交互に繰り返します。最初の 1 周は JIT と変換ヘルパーの起動を済ませるためだけに打ち、数えません。
時間はミリ秒で、p50 / p95 / p99 は小さい方から 50% / 95% / 99% の位置の値 (nearest-rank 法) です。

| 結果の項目 | 意味 |
|---|---|
| `latency.keyCold` / `keyWarm` | 1 キーを押してから変換ボックスの表示ができるまで (ライブ変換で Mozc に頼む時間を含む) |
| `latency.conversionCold` / `conversionWarm` | Space を押してから変換の結果と候補が出るまで |
| `stages.cold` / `warm` | 1 文 (例文を打って Space で変換するまで) あたりの時間の内訳。`ConverterMs` は変換エンジン (Mozc) を呼んだ時間、`CandidatesMs` は候補の一覧を引いた時間、`OtherMs` はそれ以外 (判定・ローマ字・文節の組み立て・辞書の候補)、`ConverterCalls` は変換エンジンを呼んだ回数 |
| `cache` | Mozc の控えの使い回し。`ConversionHitRate` は同じ読みの変換を使い回した割合、`CandidateHitRate` は候補の一覧を使い回した割合、`HelperMsPerCall` は変換ヘルパーとの 1 回のやり取りの時間 |
| `candidates` | Space で変換したときの、選んでいる文節の候補の数 |
| `memory` | `managedHeapStartBytes` / `EndBytes` は辞書を読んだ後・測り終えた後の .NET のヒープ (常駐のメモリ)、`peakWorkingSetBytes` はプロセスの最大のメモリ、`helperWorkingSetBytes` は変換ヘルパーのメモリ、`allocatedBytesPerKey` は 1 キーあたりに一時的に確保したメモリ |
| `accuracy.conversion` | 例文の変換が期待どおりになった割合 (空白と大文字・小文字は区別しない) |
| `accuracy.brokenEnglish` | 誤った修正の割合: 期待にある英単語が、結果では英字のまま残っていない (かなにした・つづりを変えた) 例文の数 |
| `accuracy.quality` | 品質テスト (`--eval`、判定の正解率) の全体とカテゴリーごとの正解率 |
| `results` | 例文ごとの結果 (結果の文字列・正解か・候補の数・1 キーの p95・変換の時間) |

変換の控えの回数とヘルパーとのやり取りの時間は、`MozcConverter.Statistics()` で読みます。控えを引くときに回数を足しているだけなので、ふだんの入力は遅くなりません (アプリはこれを読みません)。

### 入力した文字について

結果の JSON には、例文のファイルにある文と、それを打った結果だけが入ります。
例文のファイルには、自分が実際に打った文 (メール・チャットなど) を入れないでください。足すときは、作った文か、公開されている文にしてください。

### 測らないもの

Windows のキーボードフック・TSF・IMK・IBus とのやり取りと、画面に描くまでの時間は含みません (`Meltype.Core` の中だけ)。
Microsoft IME で変換するときの時間も測りません (Mozc が無いときは判定だけで測ります)。

## Composition performance check

```sh
python3 tools/benchmark-composition.py /path/to/baseline-checkout \
  --output /path/to/results
```

Use the original v1.0.0 commit `467255bfe3e36b803a3fd3f5a1480fe35d5058c9`
for the PR's baseline. The command builds both versions with the same C# harness,
SDK and NativeAOT settings, then alternates which version runs first by scenario.
Each scenario uses 64, 128 and 256 keys, three warmups and 15 measured repetitions.
Use an otherwise idle machine. `--common-dictionaries` embeds the current
repository's dictionaries in both versions as a control for dictionary changes.
`--jit` runs release JIT code instead and disables tiered compilation.

The timer covers `HandleKey`, result JSON serialization and Enter commit. It
excludes dictionary loading, startup and session creation. Both versions have the built-in spelling checker and the same empty language
memory enabled. The converter is a stub returning no candidates. It records total time, thread allocations, per-key
p50/p95/max and the committed output SHA-256. Non-URL output must match the
baseline. The URL intentionally changes to preserve the raw token.

`report.json` contains raw samples, medians, ratios, dictionary/program hashes,
SDK and machine information. The command fails if the current median total time
exceeds 50% of the baseline or unchanged-output checks fail. This is a local
synthetic performance gate; it does not measure IMK/IBus/Windows GUI latency or
conversion-engine time. NativeAOT build diagnostics are saved separately.
