// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Eisenferik

using Meltype.Composition;
using Meltype.Detection;

namespace Meltype.Tests;

internal static class PackedDictionaryTests
{
    [Test]
    public static void PackedWordSet_ContainsExactlyTheListedWords()
    {
        // 並んでいない行・同じ語・前後の空白・空行・# の行があっても、書いた語だけを引ける
        var set = PackedWordSet.FromLines("# 見出し\nたなか\n  あおき \n\nたなか\nあい\n#すずき\nあおきの\n");
        Assert.Equal(4, set.Count);
        Assert.Equal(4, set.MaxLength);
        foreach (var word in (string[])["たなか", "あおき", "あい", "あおきの"]) Assert.True(set.Contains(word), word);
        foreach (var word in (string[])["すずき", "あお", "たな", "たなかさん", "", "# 見出し"]) Assert.True(!set.Contains(word), word);
    }

    [Test]
    public static void PackedWordSet_EmptyTextHasNoWords()
    {
        var set = PackedWordSet.FromLines("");
        Assert.Equal(0, set.Count);
        Assert.True(!set.Contains("あ"), "あ");
    }

    [Test]
    public static void PackedWordSet_FirstFieldTakesTheTextBeforeTheTab()
    {
        // readings.txt の形 (読み [TAB] 活用の種類、行末の \r)
        var set = PackedWordSet.FromLines("# 読み\r\nかく\tv5k\r\nたべる\tv1\r\nきょう\r\n", firstField: true);
        Assert.Equal(3, set.Count);
        foreach (var word in (string[])["かく", "たべる", "きょう"]) Assert.True(set.Contains(word), word);
        foreach (var word in (string[])["v5k", "かく\tv5k", "きょう\r"]) Assert.True(!set.Contains(word), word);
    }

    [Test]
    public static void PackedWordSet_HasPrefixOfListedWords()
    {
        var set = PackedWordSet.FromLines("たなか\nあおき\nあい\nあおきの\n");
        foreach (var prefix in (string[])["", "あ", "あお", "あおき", "あおきの", "たな", "たなか"]) Assert.True(set.HasPrefix(prefix), prefix);
        foreach (var prefix in (string[])["あう", "あおきのこ", "た な", "ん"]) Assert.True(!set.HasPrefix(prefix), prefix);
        Assert.True(!PackedWordSet.FromLines("").HasPrefix(""), "空の集合");
    }

    [Test]
    public static void PackedWordSet_FromWordsDropsRepeatedWords()
    {
        var words = Enumerable.Range(0, 5000).Select(i => $"w{i % 3000}").ToList();
        var set = PackedWordSet.FromWords(words);
        Assert.Equal(3000, set.Count);
        Assert.True(words.All(w => set.Contains(w)), "どの語も引ける");
        Assert.True(!set.Contains("") && !set.Contains("w3000") && !set.Contains("w"), "無い語は引けない");
    }

    [Test]
    public static void RomajiTypos_KnowReadingsAndTheirForms()
    {
        var romaji = new RomajiDetector(null);
        // 読みそのもの・活用した形 (たべ、かき・かい、はやく)・付属語
        var typos = new RomajiTypoCorrector(romaji, "# 読み\nたべる\tv1\nかく\tv5k\nはやい\ti\nきょう\n");
        foreach (var word in (string[])["たべる", "たべ", "かく", "かき", "かか", "かい", "はやい", "はやく", "はやかっ", "きょう", "ます", "は"]) Assert.True(typos.IsWord(word), word);
        foreach (var word in (string[])["たべろ", "かくる", "きょ", "v1", "# 読み"]) Assert.True(!typos.IsWord(word), word);
    }
}
