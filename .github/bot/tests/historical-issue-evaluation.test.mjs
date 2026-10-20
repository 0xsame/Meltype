// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Akatuki1121
// Historical evaluation set from public Meltype issues. This file is a regression
// sample, not a claim of exhaustive precision/recall measurement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { findRelatedIssues, scoreCandidate } from '../issue-relation-candidates.mjs';
import { historical } from '../fixtures/historical-issues.mjs';

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

test('historical recall: explicit relation from #316 retrieves #261 even when keyword search returns no results', async () => {
  const calls = [];
  const found = await findRelatedIssues(historical[316], {
    repo: 'yksr-melt/Meltype',
    search: async query => {
      calls.push(query);
      return { items: [] };
    },
    getIssue: async number => number === 261 ? historical[261] : null,
  });
  assert.ok(calls.length >= 1 && calls.length <= 2, 'search stays within the bounded query budget');
  assert.ok(found.some(candidate => candidate.issue.number === 261), 'explicitly referenced #261 must not be missed');
});

test('historical end-to-end candidate flow: search results rank #338 and suppress unrelated #717/#725', async () => {
  const calls = [];
  const found = await findRelatedIssues(historical[234], {
    repo: 'yksr-melt/Meltype',
    search: async query => {
      calls.push(query);
      return { items: [historical[717], historical[725], historical[338]] };
    },
    getIssue: async () => null,
  });

  assert.ok(calls.length >= 1 && calls.length <= 2, 'candidate discovery stays within the bounded query budget');
  assert.match(calls[0], /^repo:yksr-melt\/Meltype is:issue/);
  assert.ok((calls[0].match(/ OR /g) ?? []).length <= 4, 'query must stay within GitHub OR limits');
  assert.deepEqual(found.map(candidate => candidate.issue.number), [338]);
  assert.match(found[0].reasons.join(' '), /特徴語が一致/);
});
