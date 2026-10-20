// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Akatuki1121
// Static snapshots of public Meltype Issues for deterministic offline regression checks.
// These examples are a small regression set, not a statistically representative precision/recall estimate.
export const historical = {

  261: {
    number: 261,
    title: '[不具合] 入力が早いと日本語にならない',
    body: 'Claude、ChatGPT、Comet などで入力が早いとローマ字が日本語にならない。入力が早ければほぼ毎回発生する。',
    labels: [{ name: 'bug' }, { name: 'windows' }],
  },
  316: {
    number: 316,
    title: '[誤判定] 英単語 Claude の直後に空白なしで日本語を続けると「Cぁうっえ」になる',
    body: 'Claude のチャット入力欄で英単語 Claude の後に空白を入れず日本語を続けると、残りがローマ字として読まれる。#261 と同じ環境で起きており、関連するかもしれない。\n\nRelates to #261',
    labels: [{ name: 'windows' }, { name: 'bug' }],
  },
  234: {
    number: 234,
    title: '[機能提案] Z + H / J / K / L キーでの矢印入力機能の追加',
    body: '従来のMacの日本語入力などであれば、Z + H / J / K / L キーでそれぞれ ← / ↓ / ↑ / → が入力できたが、meltypeではまだ対応していない。Z + H / J / K / L キーで、それぞれ ← / ↓ / ↑ / → が入力できる機能。',
    labels: [{ name: '提案' }],
  },
  338: {
    number: 338,
    title: '[機能提案] zlで→と矢印が打てるようにしてほしい',
    body: '矢印を使う際に時間短縮となる。zh、zj、zk、zlで←、↓、↑、→とGoogle日本語入力では矢印が打てるので、こちらでも使えるようにしてほしい。zlと打つと、自動で→が表示される、またはzlと入力してスパースでの変換候補にあるだけでもいい。',
    labels: [{ name: '提案' }],
  },
  717: {
    number: 717,
    title: '[誤判定] URL入力時に日本語と判別されてしまう',
    body: '### 種類\n英語のつもりがかなになった (みいてぃんg)\n### 打ったもの (キーをそのまま)\nzenn.dev\n### 出たもの\nぜん。dev\n### 期待した結果\nzenn.dev\n### 前後の文 (分かれば)\n_No response_\n### どのアプリで\nZen Browser のURL入力欄 (control+T)\n### OS\nLinux (プレビュー版)\n### Meltype の版\n1.2.1',
    labels: [{ name: '誤判定' }, { name: 'linux' }],
  },
  725: {
    number: 725,
    title: '[誤判定] OpenStreetMap が おぺんstreetmap になる',
    body: '### 種類\n英語のつもりがかなになった (みいてぃんg)\n### 打ったもの (キーをそのまま)\nopenstreetmap\n### 出たもの\nおぺんstreetmap\n### 期待した結果\nopenstreetmap\n### 前後の文 (分かれば)\n_No response_\n### どのアプリで\nFloorp\n### OS\nLinux (プレビュー版)\n### Meltype の版\n1.2.1',
    labels: [{ name: '誤判定' }, { name: 'linux' }],
  },
  873: {
    number: 873,
    title: '[不具合] BraveのTwitchコメント欄・U-NEXT検索欄で日本語に切り替えられず半角しか打てない',
    body: 'Windows 11。Meltype キーボード。Brave ブラウザの Twitch コメント欄・U-NEXT 検索欄で、半角/全角を押しても「A」のままで半角英字しか入らず、日本語に戻らない。Microsoft IMEなら同じ欄で日本語を打てる。',
    labels: [{ name: 'bug' }, { name: 'windows' }, { name: 'アプリ: ブラウザー' }],
  },
  874: {
    number: 874,
    title: '[不具合] PWA内フォームでの変換が機能しない',
    body: 'Windows 11 26H2。IME 自動切替 (Microsoft IME を使う)。PWA(Brave) のフォームで、Meltype IMEによる日本語入力を期待しているが、日本語入力モードでもすべてローマ字として扱われる。ログでは入力欄と認識している。',
    labels: [{ name: 'bug' }, { name: 'windows' }, { name: 'アプリ: ブラウザー' }],
  },
};

export const cases = [
  { source: 234, expected: 338, related: true, note: 'Z+H/J/K/L arrow-input feature' },
  { source: 338, expected: 234, related: true, note: 'reciprocal arrow-input feature' },
  { source: 873, expected: 874, related: true, note: 'Brave/PWA IME input failure' },
  { source: 874, expected: 873, related: true, note: 'reciprocal Brave/PWA IME input failure' },
  { source: 316, expected: 261, related: true, note: 'explicit reference; keyword search may miss' },
  { source: 717, expected: 725, related: false, note: 'same form/category but different defect' },
  { source: 725, expected: 717, related: false, note: 'reciprocal unrelated-defect control' },
];
