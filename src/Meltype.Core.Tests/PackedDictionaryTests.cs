// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Eisenferik

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
}
