import {
  buildWeeklyProductUpdateExternalId,
} from './weekly-external-id';
import {
  buildWeeklyGeneratedSeed,
  type WeeklyRelevantCommit,
} from './generate-weekly-update';
import { buildPreviousWeeklyWindow } from './weekly-window';

interface WeeklyGeneratedContent {
  contentLong: string;
  web?: {
    excerpt: string;
    content: string;
  };
  locales?: {
    es?: {
      title: string;
      description: string;
      contentLong: string;
      web?: {
        title: string;
        excerpt: string;
        content: string;
      } | null;
    };
  };
}

export interface PublishProductUpdateRequest {
  externalId: string;
  locale: 'ca' | 'es';
  title: string;
  description: string;
  link?: string | null;
  contentLong: string;
  guideUrl?: string | null;
  videoUrl?: string | null;
  web?: {
    enabled: boolean;
    slug: string;
    excerpt?: string | null;
    content?: string | null;
  } | null;
  locales?: WeeklyGeneratedContent['locales'] | null;
  isActive?: boolean;
}

export interface WeeklyProductUpdateRunnerDeps {
  now?: () => Date;
  timeZone?: string;
  listRelevantCommits: (args: { weekStart: string; weekEnd: string }) => Promise<WeeklyRelevantCommit[]>;
  hasExistingExternalId: (externalId: string) => Promise<boolean>;
  generateContent: (input: {
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
  }) => Promise<WeeklyGeneratedContent>;
  publishProductUpdate: (payload: PublishProductUpdateRequest) => Promise<
    | { status: 'success' }
    | { status: 'duplicate' }
    | { status: 'error'; errorMessage: string }
  >;
  logger?: {
    info: (event: string, payload: Record<string, unknown>) => void;
    error: (event: string, payload: Record<string, unknown>) => void;
  };
}

export type WeeklyProductUpdateRunnerResult =
  | { status: 'no_changes'; externalId: string; relevantCommitCount: number }
  | { status: 'duplicate'; externalId: string; relevantCommitCount: number }
  | { status: 'success'; externalId: string; relevantCommitCount: number };

function logInfo(
  deps: WeeklyProductUpdateRunnerDeps,
  event: string,
  payload: Record<string, unknown>
) {
  deps.logger?.info(event, payload);
}

function logError(
  deps: WeeklyProductUpdateRunnerDeps,
  event: string,
  payload: Record<string, unknown>
) {
  deps.logger?.error(event, payload);
}

export async function runWeeklyProductUpdateJob(
  deps: WeeklyProductUpdateRunnerDeps
): Promise<WeeklyProductUpdateRunnerResult> {
  const timeZone = deps.timeZone ?? 'Europe/Madrid';
  const window = buildPreviousWeeklyWindow(deps.now?.() ?? new Date(), timeZone);
  const externalId = buildWeeklyProductUpdateExternalId(window);

  logInfo(deps, 'weekly_product_updates.start', {
    weekStart: window.weekStartLabel,
    weekEnd: window.weekEndLabel,
    relevantCommitCount: 0,
    externalId,
    status: 'start',
  });

  let relevantCommitCount = 0;

  try {
    const commits = await deps.listRelevantCommits({
      weekStart: window.weekStart,
      weekEnd: window.weekEnd,
    });
    relevantCommitCount = commits.length;

    if (commits.length === 0) {
      logInfo(deps, 'weekly_product_updates.no_changes', {
        weekStart: window.weekStartLabel,
        weekEnd: window.weekEndLabel,
        relevantCommitCount,
        externalId,
        status: 'no_changes',
      });
      return {
        status: 'no_changes',
        externalId,
        relevantCommitCount,
      };
    }

    const alreadyExists = await deps.hasExistingExternalId(externalId);
    if (alreadyExists) {
      logInfo(deps, 'weekly_product_updates.duplicate', {
        weekStart: window.weekStartLabel,
        weekEnd: window.weekEndLabel,
        relevantCommitCount,
        externalId,
        status: 'duplicate',
      });
      return {
        status: 'duplicate',
        externalId,
        relevantCommitCount,
      };
    }

    const seed = buildWeeklyGeneratedSeed({
      window,
      commits,
    });
    const generated = await deps.generateContent(seed.aiInput);

    const publishPayload: PublishProductUpdateRequest = {
      externalId,
      locale: 'ca',
      title: seed.title,
      description: seed.description,
      link: null,
      contentLong: generated.contentLong,
      guideUrl: null,
      videoUrl: null,
      web: {
        enabled: true,
        slug: seed.slug,
        excerpt: generated.web?.excerpt ?? seed.description,
        content: generated.web?.content ?? generated.contentLong,
      },
      locales: generated.locales ?? null,
      isActive: true,
    };

    logInfo(deps, 'weekly_product_updates.publish_attempt', {
      weekStart: window.weekStartLabel,
      weekEnd: window.weekEndLabel,
      relevantCommitCount,
      externalId,
      status: 'publish_attempt',
    });

    const publishResult = await deps.publishProductUpdate(publishPayload);
    if (publishResult.status === 'duplicate') {
      logInfo(deps, 'weekly_product_updates.duplicate', {
        weekStart: window.weekStartLabel,
        weekEnd: window.weekEndLabel,
        relevantCommitCount,
        externalId,
        status: 'duplicate',
      });
      return {
        status: 'duplicate',
        externalId,
        relevantCommitCount,
      };
    }

    if (publishResult.status === 'error') {
      throw new Error(publishResult.errorMessage);
    }

    logInfo(deps, 'weekly_product_updates.success', {
      weekStart: window.weekStartLabel,
      weekEnd: window.weekEndLabel,
      relevantCommitCount,
      externalId,
      status: 'success',
    });
    return {
      status: 'success',
      externalId,
      relevantCommitCount,
    };
  } catch (error) {
    logError(deps, 'weekly_product_updates.error', {
      weekStart: window.weekStartLabel,
      weekEnd: window.weekEndLabel,
      relevantCommitCount,
      externalId,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
