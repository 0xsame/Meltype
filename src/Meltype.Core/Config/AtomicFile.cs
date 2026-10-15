// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Yukishiro

namespace Meltype.Config;

/// <summary>設定・学習データの保存。一時ファイル (.tmp) に書いてから置き換え、書きかけのファイルを残さない。</summary>
internal static class AtomicFile
{
    /// <summary>write に一時ファイルのパスを渡して書かせ、書き終えたら path に置き換える。フォルダが無ければ作る。</summary>
    public static void Write(string path, Action<string> write)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temp = path + ".tmp";
        write(temp);
        File.Move(temp, path, overwrite: true);
    }
}
