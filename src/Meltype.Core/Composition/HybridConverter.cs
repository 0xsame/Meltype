// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Yukishiro

using Meltype.Config;

namespace Meltype.Composition;

/// <summary>
/// Mozc と OS の変換エンジン (Windows では Microsoft IME) を組み合わせる。
/// 両方 (既定) なら Mozc で変換し、Mozc が使えない・変換できないときは OS の変換エンジンで変換する。
/// 候補の一覧は Mozc の候補の後ろに OS の変換エンジンの候補を足す (Microsoft IME に登録した単語も出る)。
/// </summary>
public sealed class HybridConverter(Func<ConversionEngine> engine, MozcConverter? mozc, IKanjiConverter system,
    Func<string, IReadOnlyList<string>>? systemCandidates, Func<ZenzaiConverter?>? zenzai = null) : IKanjiConverter, ILearningConverter, IWideContextConverter
{
    /// <summary>Zenzai に渡す広い文脈 (Mozc / Microsoft IME には渡さない)。</summary>
    public string? WideContext { get; set; }

    /// <summary>設定で Zenzai が使えるとき、その変換結果 (読み全体で 1 つの文節)。使えない・変換できなければ null。</summary>
    private IReadOnlyList<ConversionClause>? Zenzai(string hiragana, string? context) =>
        zenzai?.Invoke() is { IsAvailable: true } z ? z.ConvertClauses(hiragana, WideContext ?? context) : null;

    private bool UseMozc => engine() != ConversionEngine.System && mozc is { IsAvailable: true };
    private bool UseSystem => engine() != ConversionEngine.Mozc || mozc is not { IsAvailable: true };

    public string? Convert(string hiragana) =>
        (Zenzai(hiragana, null) is { Count: > 0 } z ? string.Concat(z.Select(c => c.Text)) : null) ??
        (UseMozc ? mozc!.Convert(hiragana) : null) ?? (UseSystem ? system.Convert(hiragana) : null);

    /// <summary>
    /// Zenzai が使えれば Zenzai の結果。Mozc などの結果と同じ文字列なら、そちらの文節の区切りを使う
    /// (Zenzai の結果は読み全体で 1 つの文節で、区切りを動かせないため)。
    /// </summary>
    public IReadOnlyList<ConversionClause>? ConvertClauses(string hiragana, string? context = null)
    {
        var other = (UseMozc ? mozc!.ConvertClauses(hiragana, context) : null) ?? (UseSystem ? system.ConvertClauses(hiragana, context) : null);
        if (Zenzai(hiragana, context) is not { Count: > 0 } z) return other;
        return other is not null && string.Concat(other.Select(c => c.Text)) == z[0].Text ? other : z;
    }

    /// <summary>確定した文節を Mozc に覚えさせる (Microsoft IME の学習は Microsoft IME に任せる)。</summary>
    public void Learn(string? context, IReadOnlyList<ConversionClause> clauses)
    {
        if (UseMozc) mozc!.Learn(context, clauses);
    }

    /// <summary>読みの候補の一覧 (Mozc → OS の変換エンジン)。</summary>
    public IReadOnlyList<string> Candidates(string reading)
    {
        var list = new List<string>();
        if (UseMozc) list.AddRange(mozc!.Candidates(reading));
        if (engine() != ConversionEngine.Mozc && systemCandidates is not null)
        {
            foreach (var candidate in systemCandidates(reading)) if (!list.Contains(candidate)) list.Add(candidate);
        }
        return list;
    }
}
