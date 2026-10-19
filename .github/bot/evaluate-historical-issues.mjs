// SPDX-License-Identifier: GPL-3.0-or-later
// Small live evaluation of the candidate pipeline against public historical Issues.
// Run manually with a read-only GITHUB_TOKEN; not on every PR push.
import { findRelatedIssues } from './issue-relation-candidates.mjs';

const repo = process.env.EVALUATION_REPOSITORY || 'yksr-melt/Meltype';
const api = process.env.GITHUB_API_URL || 'https://api.github.com';
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error('Set GITHUB_TOKEN with read-only Issues access.');

const headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'meltype-historical-evaluation' };

async function getIssue(number) {
  const response = await fetch(api + '/repos/' + repo + '/issues/' + number, { headers });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('GET issue #' + number + ': HTTP ' + response.status);
  const issue = await response.json();
  return issue.pull_request ? null : issue;
}

async function searchIssues(query) {
  const url = new URL(api + '/search/issues');
  url.searchParams.set('q', query);
  url.searchParams.set('per_page', '100');
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error('Issue search: HTTP ' + response.status);
  return { items: (await response.json()).items || [] };
}

const cases = [
  { source: 234, expected: 338, related: true, note: 'Z+H/J/K/L arrow-input feature' },
  { source: 873, expected: 874, related: true, note: 'Brave/PWA IME input failure; later grouped in #878' },
  { source: 316, expected: 261, related: true, note: 'explicit reference; recall when keyword search misses' },
  { source: 717, expected: 725, related: false, note: 'same form/category but different defect' },
];

const results = [];
for (const item of cases) {
  const source = await getIssue(item.source);
  if (!source) throw new Error('Could not fetch source Issue #' + item.source);
  const candidates = await findRelatedIssues(source, { repo, search: searchIssues, getIssue });
  const numbers = candidates.map(candidate => candidate.issue.number);
  const found = numbers.includes(item.expected);
  results.push({
    source: item.source, expected: item.expected, related: item.related,
    pass: item.related ? found : !found, found,
    candidates: candidates.map(candidate => ({ number: candidate.issue.number, score: candidate.score, reasons: candidate.reasons })),
    note: item.note,
  });
}

const positives = results.filter(result => result.related);
const negatives = results.filter(result => !result.related);
console.log(JSON.stringify({
  mode: 'live GitHub Issue API + candidate search/scoring pipeline',
  boundedRequests: '4 source Issues, 4 Issue searches, plus explicit-reference lookups only',
  summary: {
    cases: results.length,
    passed: results.filter(result => result.pass).length,
    failed: results.filter(result => !result.pass).length,
    positiveRecallOnSample: positives.filter(result => result.found).length / positives.length,
    hardNegativeRejectionOnSample: negatives.filter(result => !result.found).length / negatives.length,
  },
  results,
}, null, 2));
if (results.some(result => !result.pass)) process.exitCode = 1;
