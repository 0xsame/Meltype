// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Yukishiro
//
// コンフリクトのお知らせ (.github/workflows/conflicts.yml)。
//   node conflicts.mjs main     … main に push されたとき: 開いている Pull Request を全部調べる
//   node conflicts.mjs pr <番号> … Pull Request が更新されたとき: その Pull Request だけ調べる
// main とコンフリクトしている Pull Request には「コンフリクト」のラベルを付け、
// 原因になった Pull Request (分かれば) と、両方で変えたファイルをコメントで知らせる。
// 解消されたらラベルを外し、コメントを「解消しました」に書き換える。
// コードは checkout も実行もしない (GitHub の API で状態を読むだけ)。
const api = process.env.GITHUB_API_URL ?? 'https://api.github.com';
const repo = process.env.GITHUB_REPOSITORY;
const Marker = '<!-- meltype-bot --><!-- conflict -->';
const Label = 'コンフリクト';

async function gh(method, url, body) {
  const response = await fetch(`${api}/repos/${repo}${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'meltype-bot',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error(`${method} ${url}: ${response.status} ${await response.text()}`);
  return response.json();
}

async function paged(url) {
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const items = await gh('GET', `${url}${url.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    all.push(...items);
    if (items.length < 100) break;
  }
  return all;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** GitHub がマージできるかを計算し終えるまで待つ。分からなければ null。 */
async function mergeState(number) {
  for (let i = 0; i < 6; i++) {
    const pr = await gh('GET', `/pulls/${number}`);
    if (pr.state !== 'open') return null;
    if (pr.mergeable !== null && pr.mergeable_state !== 'unknown') return pr;
    await sleep(5000);
  }
  return null;
}

async function files(number) {
  return new Set((await paged(`/pulls/${number}/files`)).map(f => f.filename));
}

/** いま main に入った commit から、マージされた Pull Request を探す (直 push なら null)。 */
async function mergedPull(sha) {
  if (!sha) return null;
  const pulls = await gh('GET', `/commits/${sha}/pulls`).catch(() => []);
  return pulls.find(p => p.merged_at) ?? null;
}

async function findComment(number) {
  const comments = await paged(`/issues/${number}/comments`);
  return comments.find(c => c.user?.type === 'Bot' && c.body?.includes(Marker)) ?? null;
}

async function upsert(number, text) {
  const body = `${Marker}\n${text}`;
  const mine = await findComment(number);
  if (mine) await gh('PATCH', `/issues/comments/${mine.id}`, { body });
  else await gh('POST', `/issues/${number}/comments`, { body });
}

async function ensureLabel() {
  try {
    await gh('GET', `/labels/${encodeURIComponent(Label)}`);
  } catch {
    await gh('POST', '/labels', { name: Label, color: 'e11d48', description: 'main とコンフリクトしています' }).catch(() => {});
  }
}

function conflictText(pr, cause, overlap) {
  const lines = [`@${pr.user.login} この Pull Request は、main とコンフリクトしています。`];
  if (cause) lines.push('', `原因になったと思われる変更: #${cause.number} ${cause.title}`);
  if (overlap.length) {
    lines.push('', '両方で変えたファイル:');
    for (const file of overlap.slice(0, 20)) lines.push(`- \`${file}\``);
    if (overlap.length > 20) lines.push(`- ほか ${overlap.length - 20} 件`);
  }
  lines.push('', 'お手数ですが、main に追従して解消してください ([CONTRIBUTING.md](../blob/main/CONTRIBUTING.md))。解消されると、このコメントとラベルは自動で更新されます。');
  return lines.join('\n');
}

async function check(number, cause, causeFiles) {
  const pr = await mergeState(number);
  if (!pr) return;
  const labeled = pr.labels.some(l => l.name === Label);
  const conflicting = pr.mergeable_state === 'dirty';

  if (conflicting && !labeled) {
    const overlap = causeFiles ? [...await files(number)].filter(f => causeFiles.has(f)).sort() : [];
    await gh('POST', `/issues/${number}/labels`, { labels: [Label] });
    await upsert(number, conflictText(pr, cause, overlap));
    console.log(`#${number}: コンフリクトを知らせました`);
  } else if (!conflicting && labeled) {
    await gh('DELETE', `/issues/${number}/labels/${encodeURIComponent(Label)}`).catch(() => {});
    if (await findComment(number)) await upsert(number, '✅ main とのコンフリクトは解消されました。ありがとうございます!');
    console.log(`#${number}: 解消を確認しました`);
  }
}

const [mode, arg] = process.argv.slice(2);
await ensureLabel();

if (mode === 'main') {
  const cause = await mergedPull(process.env.GITHUB_SHA);
  const causeFiles = cause ? await files(cause.number) : null;
  const open = await paged('/pulls?state=open');
  for (const pr of open) {
    if (cause && pr.number === cause.number) continue;
    await check(pr.number, cause, causeFiles).catch(e => console.log(`#${pr.number}: ${e.message}`));
  }
} else if (mode === 'pr' && /^\d+$/.test(arg ?? '')) {
  await check(Number(arg), null, null);
} else {
  console.error('使い方: node conflicts.mjs main | pr <番号>');
  process.exit(1);
}
