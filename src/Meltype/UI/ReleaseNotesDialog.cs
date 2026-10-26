// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Yukishiro

using System.Diagnostics;

namespace Meltype.UI;

/// <summary>
/// リリースノートを見せる (issue #1207)。更新したあとの初めての起動で一度だけ出し、トレイの「更新」→「リリースノート...」からも開ける。
/// 中身は自動更新でダウンロードしたときに残しておいたもの。無ければ (インストーラーで入れた など) リリースのページへ案内する。
/// 読めなくても Meltype の動きには関係しない。
/// </summary>
internal sealed class ReleaseNotesDialog : Form
{
    private static ReleaseNotesDialog? _open;

    /// <summary>その版のリリースノートを出す (もう出ていれば前に出す)。updated なら「更新しました」と書く。</summary>
    public static void ShowFor(string version, bool updated)
    {
        try
        {
            if (_open is { IsDisposed: false })
            {
                _open.Activate();
                return;
            }
            _open = new ReleaseNotesDialog(version, updated, Updater.ReleaseNotes(version));
            _open.Show();
        }
        catch (Exception ex)
        {
            Diagnostics.Log.Warn($"リリースノートを出せませんでした: {ex.Message}");
        }
    }

    private ReleaseNotesDialog(string version, bool updated, string? notes)
    {
        Text = $"Meltype {version} のリリースノート";
        StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Yu Gothic UI", 9.5F);
        Size = new Size(LogicalToDeviceUnits(600), LogicalToDeviceUnits(500));
        MinimumSize = new Size(400, 300);

        var intro = new Label
        {
            Dock = DockStyle.Top,
            AutoSize = true,
            MaximumSize = new Size(LogicalToDeviceUnits(560), 0),
            Padding = new Padding(10, 10, 10, 6),
            Text = (updated ? $"Meltype を {version} に更新しました。" : $"Meltype {version} です。")
                + (notes is null ? "\nこの版のリリースノートは、GitHub のリリースのページで見られます。" : "\n新しい機能・直した不具合など、この版で変わったことです。"),
        };
        var text = new TextBox
        {
            Dock = DockStyle.Fill,
            Multiline = true,
            ReadOnly = true,
            ScrollBars = ScrollBars.Vertical,
            BackColor = SystemColors.Window,
            Text = (notes ?? "").ReplaceLineEndings("\r\n"),
        };
        var textPanel = new Panel { Dock = DockStyle.Fill, Padding = new Padding(10, 0, 10, 0), Visible = notes is not null };
        textPanel.Controls.Add(text);

        var close = new Button { Text = "閉じる", AutoSize = true, DialogResult = DialogResult.OK };
        close.Click += (_, _) => Close();
        var page = new Button { Text = "GitHub で見る", AutoSize = true };
        page.Click += (_, _) => Open(Config.ProjectInfo.ReleaseUrl(version));
        var all = new Button { Text = "過去のリリースノート...", AutoSize = true };
        all.Click += (_, _) => Open(Config.ProjectInfo.ReleasesUrl);
        var buttons = new FlowLayoutPanel { Dock = DockStyle.Bottom, AutoSize = true, FlowDirection = FlowDirection.RightToLeft, Padding = new Padding(6) };
        buttons.Controls.AddRange([close, page, all]);

        Controls.Add(textPanel);
        Controls.Add(intro);
        Controls.Add(buttons);
        AcceptButton = close;
        CancelButton = close;
        if (notes is null) Height = intro.PreferredHeight + buttons.PreferredSize.Height + LogicalToDeviceUnits(80);
    }

    private static void Open(string url)
    {
        try
        {
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch (Exception ex)
        {
            Diagnostics.Log.Warn($"リリースのページを開けませんでした: {ex.Message}");
        }
    }
}
