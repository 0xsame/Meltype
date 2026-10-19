// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Akatuki1121
// Historical evaluation set from public Meltype issues. This file is a regression
// sample, not a claim of exhaustive precision/recall measurement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreCandidate } from '../issue-relation-candidates.mjs';

const historical = {
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

test('historical related pair: #234 and #338 describe the same Z+H/J/K/L arrow-input feature', () => {
  assert.ok(scoreCandidate(historical[234], historical[338]), 'expected #338 to be considered for #234');
  assert.ok(scoreCandidate(historical[338], historical[234]), 'expected #234 to be considered for #338');
});

test('historical false-positive control: #717 and #725 share an issue form and category, not a specific defect', () => {
  assert.equal(scoreCandidate(historical[717], historical[725]), null);
  assert.equal(scoreCandidate(historical[725], historical[717]), null);
});

test('historical related pair: #873 and #874 were later grouped in #878 as a common Brave IME issue', () => {
  assert.ok(scoreCandidate(historical[873], historical[874]), 'expected #874 to be considered for #873');
  assert.ok(scoreCandidate(historical[874], historical[873]), 'expected #873 to be considered for #874');
});
