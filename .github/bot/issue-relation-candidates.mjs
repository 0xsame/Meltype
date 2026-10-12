// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Akatuki1121

const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'when', 'where', 'what', 'which',
  'would', 'could', 'should', 'there', 'their', 'about', 'into', 'issue',
  'meltype', 'windows', 'linux', 'mac', 'version', 'expected', 'actual',
  '報告', '問題', '機能', '提案', '確認', '結果', '期待', '具体例', '利用シーン',
  '困っていること', '解決したい問題', '期待できる効果', 'メリット', 'こうなってほしい',
]);
const CATEGORY_LABELS = new Set(['bug', '誤判定', '提案', '機能提案']);
const IGNORED_HEADINGS = /ログ|実行環境|前後の文|スクリーンショット/i;

function searchableBody(body = '') {
  const withoutFences = body.replace(/\x60{3}[\s\S]*?\x60{3}/g, ' ');
  const sections = withoutFences.split(/^###\s+/m);
  const kept = [sections[0] ?? ''];
  for (const section of sections.slice(1)) {
    const newline = section.indexOf('\n');
    const heading = (newline < 0 ? section : section.slice(0, newline)).trim();
    if (!IGNORED_HEADINGS.test(heading)) kept.push(newline < 0 ? '' : section.slice(newline + 1));
  }
  return kept.join('\n').replace(/<!--[^]*?-->/g, ' ').replace(/https?:\/\/\S+/g, ' ');
}
function extractIdentifiers(text) {
  return [...new Set([
    ...(text.match(/\b0x[0-9a-f]{4,}\b/gi) ?? []),
    ...(text.match(/\b[A-Z][A-Za-z0-9_.-]*(?:Exception|Error|Failure)\b/g) ?? []),
    ...(text.match(/\b(?:E_FAIL|HRESULT|Win32Error|HTTP\s*[45]\d\d)\b/gi) ?? []),
  ].map(value => value.toLowerCase()))];
}
function extractTerms(text) {
  const terms = new Map();
  const add = (value, weight = 1) => {
    const term = value.trim().toLowerCase();
    if (term.length < 2 || STOPWORDS.has(term) || /^\d+$/.test(term)) return;
    terms.set(term, Math.max(terms.get(term) ?? 0, weight));
  };
  for (const word of text.match(/[A-Za-z][A-Za-z0-9_.:-]{3,}/g) ?? []) add(word, 4);
  for (const run of text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{2,}/gu) ?? []) {
    if (run.length <= 12) add(run, Math.min(run.length, 6));
    for (let size = Math.min(4, run.length); size >= 2; size--) {
      for (let i = 0; i <= run.length - size; i++) add(run.slice(i, i + size), size);
    }
  }
  return [...terms].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
}
export function extractIssueSignals(issue) {
  const title = String(issue?.title ?? '').replace(/^\[[^\]]+\]\s*/, '');
  const body = searchableBody(issue?.body ?? '');
  const text = title + '\n' + body;
  const references = [...new Set([...text.matchAll(/(?:^|[^\w])#(\d+)\b/g)].map(match => Number(match[1])))];
  const identifiers = extractIdentifiers(text);
  const terms = extractTerms(text).slice(0, 80);
  const labels = new Set((issue?.labels ?? []).map(label => typeof label === 'string' ? label : label.name).filter(Boolean));
  return { title, text: text.toLowerCase(), references, identifiers, terms, labels };
}
export function buildSearchQuery(repo, terms) {
  const usable = terms.map(entry => Array.isArray(entry) ? entry[0] : entry)
    .filter(term => typeof term === 'string' && term.length >= 2).slice(0, 8);
  if (usable.length === 0) return null;
  const alternatives = usable.map(term => '"' + term.replace(/["\\]/g, '') + '"').join(' OR ');
  return 'repo:' + repo + ' is:issue (' + alternatives + ')';
}
export function scoreCandidate(currentIssue, candidate) {
  if (!candidate || candidate.pull_request || candidate.number === currentIssue.number) return null;
  const current = extractIssueSignals(currentIssue);
  const other = extractIssueSignals(candidate);
  const score = { value: 0, reasons: [], matchedTerms: [] };
  if (current.references.includes(candidate.number)) {
    score.value += 20;
    score.reasons.push('本文で #' + candidate.number + ' を明示的に参照');
  }
  const sharedIds = current.identifiers.filter(id => other.identifiers.includes(id));
  if (sharedIds.length) {
    score.value += 12 * sharedIds.length;
    score.reasons.push('エラー識別子が一致: ' + sharedIds.slice(0, 3).join(', '));
  }
  for (const [term, weight] of current.terms) {
    if (term.length < 3 || STOPWORDS.has(term)) continue;
    if (other.text.includes(term)) {
      score.matchedTerms.push({ term, weight });
      score.value += other.title.toLowerCase().includes(term) ? 2 : 1;
    }
  }
  score.matchedTerms.sort((a, b) => b.weight - a.weight || b.term.length - a.term.length);
  if (score.matchedTerms.length >= 2) score.reasons.push('特徴語が一致: ' + score.matchedTerms.slice(0, 3).map(item => item.term).join('、'));
  const sharedLabels = [...current.labels].filter(label => other.labels.has(label) && CATEGORY_LABELS.has(label));
  if (sharedLabels.length) {
    score.value += sharedLabels.length;
    if (score.matchedTerms.length >= 2) score.reasons.push('分類ラベルも一致: ' + sharedLabels.join('、'));
  }
  if (!score.reasons.length || (score.value < 4 && !current.references.includes(candidate.number) && sharedIds.length === 0)) return null;
  if (!current.references.includes(candidate.number) && sharedIds.length === 0 && score.matchedTerms.length < 2) return null;
  return { issue: candidate, score: score.value, reasons: score.reasons };
}
export async function findRelatedIssues(issue, { repo, search, getIssue, maxCandidates = 5 }) {
  if (!issue || issue.pull_request || !repo) return [];
  const current = extractIssueSignals(issue);
  const candidates = new Map();
  for (const number of current.references) {
    if (number === issue.number || candidates.has(number)) continue;
    try {
      const found = await getIssue(number);
      if (found) candidates.set(found.number, found);
    } catch {
      // References to deleted or inaccessible issues are ignored.
    }
  }
  const query = buildSearchQuery(repo, current.terms);
  if (query) {
    const result = await search(query);
    for (const candidate of (result?.items ?? result ?? [])) {
      if (candidate?.number && !candidate.pull_request) candidates.set(candidate.number, candidate);
    }
  }
  return [...candidates.values()].map(candidate => scoreCandidate(issue, candidate)).filter(Boolean)
    .sort((a, b) => b.score - a.score || b.issue.number - a.issue.number).slice(0, maxCandidates);
}
function safeTitle(title) {
  return String(title ?? '').replace(/[\r\n]+/g, ' ').replace(/[<>]/g, '')
    .replace(/([\\\x60*_{}\[\]()#+.!|])/g, '\\$1').slice(0, 180);
}
export function formatRelatedIssueComment(issue, candidates, repo = '') {
  const lines = [
    '関連Issueの候補（自動検出）', '',
    '文章の一致だけでは関連性を確定できません。リンク先の本文を確認して判断してください。', '',
  ];
  if (!candidates.length) lines.push('今回の検索では、十分な根拠がある候補は見つかりませんでした。');
  else for (const candidate of candidates) {
    const number = candidate.issue.number;
    const url = candidate.issue.html_url ?? 'https://github.com/' + repo + '/issues/' + number;
    lines.push('- [#' + number + ' ' + safeTitle(candidate.issue.title) + '](' + url + ')');
    for (const reason of candidate.reasons) lines.push('  - ' + reason);
  }
  lines.push('', '<sub>候補の提示のみを行います。Issueのラベルや状態は変更しません。</sub>');
  return lines.join('\n');
}