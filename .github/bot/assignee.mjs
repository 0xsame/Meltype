// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Yukishiro
// PR の作者が、本文の「Fixes #123」などで閉じる Issue の担当 (Assignees) に入っていなければ、PR を Draft にする (issue #1208)。
// 担当のいない Issue・関連 Issue の書かれていない PR はそのまま。メンテナー (OWNER / MEMBER / COLLABORATOR) の PR も対象にしない。
// GitHub の本文はデータとして読むだけ。PR のコードは実行しない。
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const Marker = '<!-- meltype-bot --><!-- assignee -->';
const Maintainers = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const Actions = new Set(['opened', 'reopened', 'ready_for_review', 'edited']);
const BotLogins = new Set(['github-actions[bot]', 'meltype-helper[bot]']);

/** 本文で閉じる Issue の番号 (Fixes / Closes / Resolves #123。重複なし)。テンプレートの説明の <!-- --> の中は読まない。 */
export function linkedIssues(body) {
  const numbers = [...(body ?? '').replace(/<!--[\s\S]*?-->/g, '').matchAll(/\b(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?)\s*:?\s+#(\d+)\b/gi)].map(m => Number(m[1]));
  return [...new Set(numbers)];
}

/** 担当がいて、その中に作者がいない Issue。 */
export function mismatched(author, issues) {
  const login = author.toLowerCase();
  return issues.filter(i => (i.assignees ?? []).length > 0 && !i.assignees.some(a => a.login.toLowerCase() === login));
}

export function render(author, issues) {
  return `${Marker}\n`
    + `この PR が閉じる Issue の担当 (Assignees) に、作成者の \`${author}\` が入っていないため、Draft にしました。同じ Issue の作業が重ならないようにするためです。\n\n`
    + issues.map(i => `- #${i.number} の担当: ${i.assignees.map(a => `\`${a.login}\``).join(', ')}`).join('\n')
    + '\n\n対応したい場合は、その Issue のコメントで担当を相談してください。担当に入ったら「Ready for review」で戻せます (戻したときにもう一度確かめます)。';
}

export function githubApi({ token, repository, api = 'https://api.github.com', fetcher = fetch }) {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'meltype-bot' };
  const request = async (method, path, body) => {
    const response = await fetcher(`${api}/repos/${repository}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (method === 'GET' && response.status === 404) return null;
    if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`);
    return response.status === 204 ? null : response.json();
  };
  const graphql = async (query, variables) => {
    const response = await fetcher(`${api}/graphql`, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
    if (!response.ok) throw new Error(`POST /graphql: ${response.status}`);
    const result = await response.json();
    if (result.errors?.length) throw new Error(`GraphQL: ${result.errors.map(e => e.message).join(', ')}`);
    return result.data;
  };
  return { request, graphql };
}

/** PR のイベントで確かめ、担当でなければ Draft にして理由をコメントする (前のコメントがあれば書き換える)。 */
export async function runAssigneeCheck(api, event) {
  const pr = event.pull_request;
  if (!pr || pr.state !== 'open' || pr.draft || !Actions.has(event.action)) return 'skip';
  if (event.action === 'edited' && !event.changes?.body) return 'skip';
  if (Maintainers.has(pr.author_association) || pr.user.type === 'Bot') return 'skip';
  const issues = [];
  for (const number of linkedIssues(pr.body)) {
    const issue = await api.request('GET', `/issues/${number}`);
    // 消えた Issue・PR を指す番号は数えない
    if (issue && !issue.pull_request) issues.push(issue);
  }
  const wrong = mismatched(pr.user.login, issues);
  if (wrong.length === 0) return 'ok';
  await api.graphql('mutation($id: ID!) { convertPullRequestToDraft(input: { pullRequestId: $id }) { pullRequest { isDraft } } }', { id: pr.node_id });
  const comments = await api.request('GET', `/issues/${pr.number}/comments?per_page=100`) ?? [];
  const previous = comments.find(c => c.user?.type === 'Bot' && BotLogins.has(c.user.login) && c.body?.startsWith(Marker));
  const body = render(pr.user.login, wrong);
  if (previous) await api.request('PATCH', `/issues/comments/${previous.id}`, { body });
  else await api.request('POST', `/issues/${pr.number}/comments`, { body });
  return 'draft';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  console.log(await runAssigneeCheck(githubApi({ token: process.env.GITHUB_TOKEN, repository: process.env.GITHUB_REPOSITORY }), event));
}
