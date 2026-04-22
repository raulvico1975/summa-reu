import {
  buildWeeklyProductUpdateSlug,
} from './weekly-external-id';
import type { WeeklyWindow } from './weekly-window';

export interface WeeklyRelevantCommit {
  sha: string;
  message: string;
  committedAt: string;
  files: string[];
  url: string;
  areas: string[];
}

export interface WeeklyGeneratedSeed {
  title: string;
  description: string;
  slug: string;
  aiInput: {
    title: string;
    description: string;
    aiInput: {
      changeBrief: string;
      problemReal: string;
      affects: string;
      userAction: string;
    };
    webEnabled: true;
    socialEnabled: false;
  };
}

const AREA_LABELS: Record<string, string> = {
  dashboard: 'dashboard',
  moviments: 'moviments',
  remeses: 'remeses',
  projectes: 'projectes',
  donants: 'donants',
  configuracio: 'configuració',
  integracions: 'integracions',
  admin: 'gestió interna',
  informes: 'informes',
  suport: 'ajuda i suport',
  general: 'fluxos clau de l’app',
};

const AREA_TITLES: Record<string, string> = {
  dashboard: 'Millores setmanals al dashboard',
  moviments: 'Millores setmanals a moviments',
  remeses: 'Millores setmanals a remeses',
  projectes: 'Millores setmanals a projectes',
  donants: 'Millores setmanals a donants',
  configuracio: 'Millores setmanals a configuració',
  integracions: 'Millores setmanals a integracions',
  admin: 'Millores setmanals a Summa Social',
  informes: 'Millores setmanals a informes',
  suport: 'Millores setmanals a ajuda i suport',
  general: 'Millores setmanals a Summa Social',
};

function uniqueAreas(commits: WeeklyRelevantCommit[]): string[] {
  const ordered = commits.flatMap((commit) => commit.areas);
  return Array.from(new Set(ordered.length > 0 ? ordered : ['general']));
}

function cleanCommitMessage(message: string): string {
  return message
    .split('\n')[0]
    .replace(/^(\w+)(\([^)]+\))?:\s*/u, '')
    .replace(/\s+\[[^\]]+\]\s*$/u, '')
    .trim();
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 1).trimEnd()}…`;
}

function buildShortDescription(areas: string[]): string {
  if (areas.length === 1) {
    const areaLabel = AREA_LABELS[areas[0]] ?? AREA_LABELS.general;
    return truncate(
      `Aquesta setmana arriben millores pràctiques en ${areaLabel} perquè treballis amb més claredat i menys friccions.`,
      140
    );
  }

  return 'Aquesta setmana arriben millores pràctiques en fluxos clau de Summa Social perquè treballis amb més claredat i menys friccions.';
}

function buildAffects(areas: string[]): string {
  if (areas.includes('remeses')) {
    return 'equips administratius i persones que gestionen remeses, cobraments o seguiment econòmic';
  }
  if (areas.includes('projectes')) {
    return 'equips que gestionen projectes, justificacions i seguiment econòmic';
  }
  if (areas.includes('moviments')) {
    return 'persones que treballen amb moviments, conciliació i revisió diària';
  }
  if (areas.includes('dashboard')) {
    return 'persones que fan seguiment del resum i control del dia a dia';
  }

  return 'equips administratius i persones que fan servir Summa Social en l’operativa del dia a dia';
}

function buildChangeBrief(commits: WeeklyRelevantCommit[]): string {
  const lines = commits.slice(0, 12).map((commit) => {
    const primaryArea = commit.areas[0] ?? 'general';
    const areaLabel = AREA_LABELS[primaryArea] ?? AREA_LABELS.general;
    return `- ${areaLabel}: ${cleanCommitMessage(commit.message)}`;
  });

  if (commits.length > 12) {
    lines.push(`- Altres ajustos complementaris en ${commits.length - 12} canvis més de la mateixa setmana.`);
  }

  return lines.join('\n');
}

export function buildWeeklyGeneratedSeed(args: {
  window: WeeklyWindow;
  commits: WeeklyRelevantCommit[];
}): WeeklyGeneratedSeed {
  const areas = uniqueAreas(args.commits);
  const primaryArea = areas[0] ?? 'general';
  const title = truncate(AREA_TITLES[primaryArea] ?? AREA_TITLES.general, 60);
  const description = buildShortDescription(areas);

  return {
    title,
    description,
    slug: buildWeeklyProductUpdateSlug(args.window),
    aiInput: {
      title,
      description,
      aiInput: {
        changeBrief: buildChangeBrief(args.commits),
        problemReal: 'Els canvis útils de la setmana s’han de convertir en una explicació clara per a usuari final, sense jerga tècnica ni format de changelog.',
        affects: buildAffects(areas),
        userAction: 'No cal configurar res. Si aquest flux et toca, ho notaràs directament quan facis servir Summa Social.',
      },
      webEnabled: true,
      socialEnabled: false,
    },
  };
}
