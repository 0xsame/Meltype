# 報告された誤変換のコーパス

GitHub の `誤判定` Issue から、「打ったもの (キーをそのまま)」と「期待した結果」を取り出したものです。
判定の作り方に関係なく、判定を変えるときに同じ物差しで比べられます (`--expect` にそのまま渡せます)。

```bash
dotnet run --project src/Meltype.Core.Tests -c Release -- --expect src/Meltype.Core.Tests/data/issue-cases.tsv /tmp/issue.json
```

- 打ったものが英数字・記号だけのもの
- 期待がかな・カタカナ・英字だけのもの (漢字を含む期待は、テストの変換器が Mozc を使わないため除いています)
- 同じ組は 1 回だけ

## いまの結果

| 条件 | 結果 |
|---|---|
| upstream/main `cd4b75e` (#1148 の前) | 51/74 |
| upstream/main の最新 (#1148 で `english-readable.txt` に語を足した後) | 57/74 |

`--expect` は、カタカナの期待をひらがなとして比べ、漢字を含む期待は英字の部分だけを比べます
(`Repro.Expect`)。このコーパスは上の条件で抜き出しているので、すべて「かな・カタカナ・英字」の比較になります。
