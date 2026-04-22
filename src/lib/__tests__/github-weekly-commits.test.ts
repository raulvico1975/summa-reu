import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectCommitAreas,
  isMergeCommitMessage,
  isRelevantCommitMessage,
  selectRelevantCommits,
} from '../../../functions/src/product-updates/github-weekly-commits';

test('selectRelevantCommits inclou feat, fix, perf i refactor', () => {
  const commits = selectRelevantCommits([
    {
      sha: '1',
      message: 'feat: nou resum del dashboard',
      committedAt: '2026-04-01T10:00:00.000Z',
      url: 'https://example.com/1',
    },
    {
      sha: '2',
      message: 'fix: error en moviments',
      committedAt: '2026-04-02T10:00:00.000Z',
      url: 'https://example.com/2',
    },
    {
      sha: '3',
      message: 'perf: càrrega més ràpida',
      committedAt: '2026-04-03T10:00:00.000Z',
      url: 'https://example.com/3',
    },
    {
      sha: '4',
      message: 'refactor: simplifica permisos',
      committedAt: '2026-04-04T10:00:00.000Z',
      url: 'https://example.com/4',
    },
    {
      sha: '5',
      message: 'docs: actualitza ajuda',
      committedAt: '2026-04-05T10:00:00.000Z',
      url: 'https://example.com/5',
    },
    {
      sha: '6',
      message: 'Merge pull request #123 from feature/test',
      committedAt: '2026-04-05T12:00:00.000Z',
      url: 'https://example.com/6',
    },
  ]);

  assert.deepEqual(commits.map((commit) => commit.sha), ['1', '2', '3', '4']);
});

test('helpers de commits detecten merge, prefixos rellevants i àrees', () => {
  assert.equal(isMergeCommitMessage('Merge branch main into feature'), true);
  assert.equal(isMergeCommitMessage('feat: resum'), false);
  assert.equal(isRelevantCommitMessage('feat(admin): resum setmanal'), true);
  assert.equal(isRelevantCommitMessage('chore: neteja'), false);
  assert.deepEqual(
    detectCommitAreas([
      'src/app/dashboard/page.tsx',
      'src/components/admin/product-updates-section.tsx',
      'src/lib/transactions/normalize.ts',
    ]),
    ['dashboard', 'admin', 'moviments']
  );
});
