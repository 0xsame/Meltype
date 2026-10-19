# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Konayukiw

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$public = Join-Path $root "public"
$logoPath = Join-Path $public "assets\img\logo.png"
$logo = [System.Drawing.Image]::FromFile($logoPath)

function New-Canvas([int]$width, [int]$height) {
    $bitmap = New-Object System.Drawing.Bitmap $width, $height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    return @($bitmap, $graphics)
}

function Color([string]$hex, [int]$alpha = 255) {
    $c = [System.Drawing.ColorTranslator]::FromHtml($hex)
    return [System.Drawing.Color]::FromArgb($alpha, $c.R, $c.G, $c.B)
}

$flakeLines = @(
    @(30, 42, 30, 22), @(30, 31, 35.4, 25.6), @(30, 31, 24.6, 25.6),
    @(30, 42, 12.7, 32), @(20.5, 36.5, 18.5, 29.2), @(20.5, 36.5, 13.1, 38.5),
    @(30, 42, 12.7, 52), @(20.5, 47.5, 13.1, 45.5), @(20.5, 47.5, 18.5, 54.8),
    @(30, 42, 30, 62), @(30, 53, 24.6, 58.4), @(30, 53, 35.4, 58.4),
    @(30, 42, 47.3, 52), @(39.5, 47.5, 41.5, 54.8), @(39.5, 47.5, 46.9, 45.5),
    @(30, 42, 47.3, 32), @(39.5, 36.5, 46.9, 38.5), @(39.5, 36.5, 41.5, 29.2)
)

function Draw-Flake($graphics, [float]$cx, [float]$cy, [float]$scale, [int]$alpha) {
    foreach ($pass in @(@("#7391ee", 9), @("#ffffff", 6), @("#3aaee8", 3))) {
        $pen = New-Object System.Drawing.Pen (Color $pass[0] $alpha), ([float]$pass[1] * $scale)
        $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        foreach ($l in $flakeLines) {
            $graphics.DrawLine($pen, $cx + ($l[0] - 30) * $scale, $cy + ($l[1] - 42) * $scale, $cx + ($l[2] - 30) * $scale, $cy + ($l[3] - 42) * $scale)
        }
        $pen.Dispose()
    }
}

function Save-Png($bitmap, [string]$path) {
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "wrote $path"
}

$small = New-Canvas 240 120
$small[1].DrawImage($logo, 0, 0, 240, 120)
Save-Png $small[0] (Join-Path $public "assets\img\logo-small.png")
$small[1].Dispose(); $small[0].Dispose()

# リンクを貼ったときの画像 (public/og.png) は、丸ゴシックの文字で描くために scripts/make-images.mjs で作る

$touch = New-Canvas 180 180
$tg = $touch[1]
$tg.Clear((Color "#ffffff"))
$tg.FillEllipse((New-Object System.Drawing.SolidBrush (Color "#e6f5fd")), 14, 14, 152, 152)
Draw-Flake $tg 90 90 3.1 255
Save-Png $touch[0] (Join-Path $public "apple-touch-icon.png")
$tg.Dispose(); $touch[0].Dispose()

$logo.Dispose()
