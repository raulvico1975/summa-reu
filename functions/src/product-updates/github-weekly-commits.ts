type GitHubListCommitItem = {
  sha: string;
  url: string;
  html_url: string;
  commit: {
    message: string;
    committer?: {
      date?: string;
    };
  };
};

type GitHubCommitDetail = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    committer?: {
      date?: string;
    };
  };
  files?: Array<{
    filename?: string;
  }>;
};

export interface WeeklyRelevantCommitRecord {
  sha: string;
  message: string;
  committedAt: string;
  files: string[];
  url: string;
  areas: string[];
}

interface FetchWeeklyRelevantCommitsArgs {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  since: string;
  until: string;
}

const RELEVANT_PREFIXES = ['feat', 'fix', 'perf', 'refactor'] as const;
const AREA_PATTERNS: Array<{ area: string; pattern: RegExp }> = [
  { area: 'dashboard', pattern: /dashboard|admin-control-tower|analytics/i },
  { area: 'moviments', pattern: /movimientos|transactions/i },
  { area: 'remeses', pattern: /remittance|remittances|sepa|pain00/i },
  { area: 'projectes', pattern: /project|budget|justification/i },
  { area: 'donants', pattern: /donor|donation|member/i },
  { area: 'configuracio', pattern: /configuracion|settings|permissions|rules/i },
  { area: 'integracions', pattern: /integrations|stripe|api\//i },
  { area: 'admin', pattern: /admin/i },
  { area: 'informes', pattern: /report|closing-bundle|model-182|model-347/i },
  { area: 'suport', pattern: /support|help|manual|kb/i },
];

function buildGitHubHeaders(token: string): Headers {
  return new Headers({
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'summa-social-weekly-product-updates',
  });
}

async function fetchGitHubJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: buildGitHubHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`GitHub request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

function getHeadline(message: string): string {
  return message.split('\n')[0]?.trim() ?? '';
}

export function isMergeCommitMessage(message: string): boolean {
  return /^merge\b/i.test(getHeadline(message));
}

export function isRelevantCommitMessage(message: string): boolean {
  const headline = getHeadline(message).toLowerCase();
  return RELEVANT_PREFIXES.some((prefix) =>
    headline.startsWith(`${prefix}:`) || headline.startsWith(`${prefix}(`)
  );
}

export function detectCommitAreas(files: string[]): string[] {
  const detected: string[] = [];

  for (const file of files) {
    for (const candidate of AREA_PATTERNS) {
      if (candidate.pattern.test(file) && !detected.includes(candidate.area)) {
        detected.push(candidate.area);
      }
    }
  }

  return detected.length > 0 ? detected : ['general'];
}

export function selectRelevantCommits(
  commits: Array<{
    sha: string;
    message: string;
    committedAt: string;
    url: string;
  }>
): Array<{
  sha: string;
  message: string;
  committedAt: string;
  url: string;
}> {
  return commits.filter((commit) =>
    !isMergeCommitMessage(commit.message) && isRelevantCommitMessage(commit.message)
  );
}

export async function fetchWeeklyRelevantCommits(
  args: FetchWeeklyRelevantCommitsArgs
): Promise<WeeklyRelevantCommitRecord[]> {
  const allCommits: GitHubListCommitItem[] = [];

  for (let page = 1; page <= 10; page += 1) {
    const url = new URL(`https://api.github.com/repos/${args.owner}/${args.repo}/commits`);
    url.searchParams.set('sha', args.branch);
    url.searchParams.set('since', args.since);
    url.searchParams.set('until', args.until);
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));

    const pageItems = await fetchGitHubJson<GitHubListCommitItem[]>(url.toString(), args.token);
    if (!Array.isArray(pageItems) || pageItems.length === 0) {
      break;
    }

    allCommits.push(...pageItems);
    if (pageItems.length < 100) {
      break;
    }
  }

  const relevantCommits = selectRelevantCommits(
    allCommits.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      committedAt: commit.commit.committer?.date ?? '',
      url: commit.html_url,
    }))
  );

  const detailBySha = new Map(allCommits.map((commit) => [commit.sha, commit]));
  const details = await Promise.all(
    relevantCommits.map(async (commit) => {
      const baseDetail = detailBySha.get(commit.sha);
      const detail = await fetchGitHubJson<GitHubCommitDetail>(
        baseDetail?.url ?? `https://api.github.com/repos/${args.owner}/${args.repo}/commits/${commit.sha}`,
        args.token
      );
      const files = (detail.files ?? [])
        .map((file) => file.filename?.trim() ?? '')
        .filter(Boolean);

      return {
        sha: commit.sha,
        message: detail.commit.message,
        committedAt: detail.commit.committer?.date ?? commit.committedAt,
        files,
        url: detail.html_url || commit.url,
        areas: detectCommitAreas(files),
      };
    })
  );

  return details;
}
