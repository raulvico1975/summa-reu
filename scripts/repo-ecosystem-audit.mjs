#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_ROOT = path.join(os.homedir(), 'Documents');
const auditRoot = path.resolve(process.argv[2] || process.env.SUMMA_REPO_AUDIT_ROOT || DEFAULT_ROOT);

const REPO_NAMES = new Set(['within-app']);
const REPO_PREFIXES = ['summa-'];

function runGit(repoPath, args) {
  return execFileSync('git', ['-C', repoPath, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function tryGit(repoPath, args) {
  try {
    return runGit(repoPath, args);
  } catch {
    return null;
  }
}

function isCandidateRepo(direntName) {
  if (REPO_NAMES.has(direntName)) return true;
  return REPO_PREFIXES.some((prefix) => direntName.startsWith(prefix));
}

function listCandidateDirectories(rootDir) {
  if (!existsSync(rootDir)) {
    throw new Error(`No existeix el directori arrel: ${rootDir}`);
  }

  return readdirSync(rootDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && isCandidateRepo(dirent.name))
    .map((dirent) => path.join(rootDir, dirent.name))
    .sort((a, b) => a.localeCompare(b));
}

function isGitRepo(repoPath) {
  return Boolean(tryGit(repoPath, ['rev-parse', '--git-dir']));
}

function classifyRepoRole(repoPath, originUrl) {
  const base = path.basename(repoPath);

  if (base === 'summa-social') return 'canonic';
  if (base === 'summa-board') return 'canonic';
  if (base.endsWith('-mirror')) return 'mirror';
  if (base.includes('worktrees')) return 'worktree-pool';
  if (base.includes('deploy-run')) return 'deploy-snapshot';
  if (base.includes('release-')) return 'release-snapshot';
  if (base.includes('control-clean')) return 'duplicate-control';
  if (/summa-social-control-\d{8}/.test(base)) return 'duplicate-control';
  if (originUrl && originUrl.includes('summa-social.git')) return 'duplicate-social';
  if (originUrl && originUrl.includes('summa-board.git')) return 'duplicate-board';
  return 'other';
}

function preferredCanonicalPath(originUrl, rootDir) {
  if (!originUrl) return null;
  if (originUrl.includes('summa-social.git')) return path.join(rootDir, 'summa-social');
  if (originUrl.includes('summa-board.git')) return path.join(rootDir, 'summa-board');
  if (originUrl.includes('summa-board-mirror.git')) return path.join(rootDir, 'summa-board-mirror');
  return null;
}

function aheadBehind(repoPath, leftRef, rightRef) {
  const output = tryGit(repoPath, ['rev-list', '--left-right', '--count', `${leftRef}...${rightRef}`]);
  if (!output) return null;
  const [left, right] = output.split(/\s+/).map((value) => Number.parseInt(value, 10));
  if (!Number.isInteger(left) || !Number.isInteger(right)) return null;
  return { left, right };
}

function collectRepoInfo(repoPath, rootDir) {
  const branch = tryGit(repoPath, ['branch', '--show-current']) || '(detached)';
  const statusShort = tryGit(repoPath, ['status', '--short']) || '';
  const originUrl = tryGit(repoPath, ['remote', 'get-url', 'origin']);
  const headSha = tryGit(repoPath, ['rev-parse', '--short', 'HEAD']);
  const hasMain = Boolean(tryGit(repoPath, ['rev-parse', '--verify', 'main']));
  const hasProd = Boolean(tryGit(repoPath, ['rev-parse', '--verify', 'prod']));
  const mainVsProd = hasMain && hasProd ? aheadBehind(repoPath, 'prod', 'main') : null;
  const canonicalPath = preferredCanonicalPath(originUrl, rootDir);
  const role = classifyRepoRole(repoPath, originUrl);

  return {
    repoPath,
    baseName: path.basename(repoPath),
    branch,
    statusShort,
    dirty: statusShort.length > 0,
    originUrl,
    headSha,
    hasMain,
    hasProd,
    mainVsProd,
    canonicalPath,
    role,
  };
}

function buildRepoGroups(repos) {
  const groups = new Map();
  for (const repo of repos) {
    const key = repo.originUrl || `no-remote:${repo.baseName}`;
    const bucket = groups.get(key) || [];
    bucket.push(repo);
    groups.set(key, bucket);
  }
  return groups;
}

function summarizeBlockingIssues(repos, groups) {
  const issues = [];

  for (const repo of repos) {
    if (repo.role === 'canonic' && repo.dirty) {
      issues.push(`${repo.baseName}: repo canònic brut (${repo.statusShort.split('\n')[0]})`);
    }
    if (repo.role === 'canonic' && repo.hasProd && repo.mainVsProd && repo.mainVsProd.right > 0) {
      issues.push(`${repo.baseName}: prod va ${repo.mainVsProd.right} commits per darrere de main`);
    }
  }

  for (const [originUrl, bucket] of groups.entries()) {
    if (originUrl.startsWith('no-remote:')) continue;
    if (bucket.length < 2) continue;
    const dirtyDuplicates = bucket.filter((repo) => repo.repoPath !== repo.canonicalPath && repo.dirty);
    if (dirtyDuplicates.length > 0) {
      issues.push(
        `${originUrl}: hi ha ${dirtyDuplicates.length} clon${dirtyDuplicates.length > 1 ? 's' : ''} duplicat${dirtyDuplicates.length > 1 ? 's' : ''} amb canvis locals`
      );
    }
  }

  return issues;
}

function printSection(title) {
  console.log(`\n${title}`);
}

function printRepo(repo, groupSize) {
  const dirtyLabel = repo.dirty ? 'BRUT' : 'NET';
  const branchLabel = repo.branch || '(sense branca)';
  const duplicateLabel = groupSize > 1 ? `duplicat x${groupSize}` : 'unic';
  const canonicalHint =
    repo.canonicalPath && repo.repoPath !== repo.canonicalPath
      ? ` -> canonic recomanat: ${repo.canonicalPath}`
      : '';

  console.log(`- ${repo.repoPath}`);
  console.log(`  rol: ${repo.role} | branca: ${branchLabel} | estat: ${dirtyLabel} | remot: ${duplicateLabel}`);
  if (repo.headSha) {
    console.log(`  head: ${repo.headSha}`);
  }
  if (repo.hasMain && repo.hasProd && repo.mainVsProd) {
    console.log(
      `  prod...main: prod ahead ${repo.mainVsProd.left}, main ahead ${repo.mainVsProd.right}`
    );
  }
  if (repo.statusShort) {
    const firstLines = repo.statusShort.split('\n').slice(0, 4);
    for (const line of firstLines) {
      console.log(`  canvi: ${line}`);
    }
    if (repo.statusShort.split('\n').length > 4) {
      console.log('  canvi: ...');
    }
  }
  if (canonicalHint) {
    console.log(`  nota:${canonicalHint}`);
  }
}

function printRecommendedActions(repos, groups) {
  printSection('Accions Recomanades');

  const canonicRepos = repos.filter((repo) => repo.role === 'canonic');
  for (const repo of canonicRepos) {
    if (repo.dirty) {
      console.log(`1. Netejar ${repo.repoPath} abans d'integrar o publicar.`);
      break;
    }
  }

  for (const repo of canonicRepos) {
    if (repo.hasProd && repo.mainVsProd && repo.mainVsProd.right > 0) {
      console.log(
        `2. Sincronitzar ${repo.baseName}: main té ${repo.mainVsProd.right} commit(s) pendents d'arribar a prod.`
      );
      break;
    }
  }

  const duplicateBuckets = [...groups.values()].filter((bucket) => bucket.length > 1);
  if (duplicateBuckets.length > 0) {
    console.log('3. Arxivar o etiquetar com a snapshots les còpies duplicades fora dels repos canònics.');
  }

  console.log("4. Fer servir només els repos canònics per integrar i desplegar.");
  console.log("5. Executar `npm run repos:audit` i després `npm run status` abans de qualsevol deploy.");
}

function main() {
  const candidates = listCandidateDirectories(auditRoot);
  const repos = candidates.filter(isGitRepo).map((repoPath) => collectRepoInfo(repoPath, auditRoot));
  const groups = buildRepoGroups(repos);
  const blockingIssues = summarizeBlockingIssues(repos, groups);

  console.log(`Audit local de repos Summa`);
  console.log(`Arrel auditada: ${auditRoot}`);
  console.log(`Repos detectats: ${repos.length}`);

  printSection('Repos');
  for (const repo of repos) {
    const groupKey = repo.originUrl || `no-remote:${repo.baseName}`;
    const groupSize = groups.get(groupKey)?.length ?? 1;
    printRepo(repo, groupSize);
  }

  printSection('Bloquejos');
  if (blockingIssues.length === 0) {
    console.log('- cap bloqueig detectat a nivell d\'ecosistema');
  } else {
    for (const issue of blockingIssues) {
      console.log(`- ${issue}`);
    }
  }

  printRecommendedActions(repos, groups);

  process.exitCode = blockingIssues.length === 0 ? 0 : 2;
}

main();
