export type PublishedUpdateEditSource = {
  title: string;
  description: string;
  link: string | null;
  contentLong?: string | null;
  isActive?: boolean;
  locale?: 'ca' | 'es';
  web?: {
    enabled: boolean;
    slug: string;
    locale?: 'ca' | 'es';
    title?: string | null;
    excerpt?: string | null;
    content?: string | null;
    publishedAt?: Date;
    locales?: Partial<Record<'es', {
      title?: string | null;
      excerpt?: string | null;
      content?: string | null;
    }>>;
  } | null;
};

export interface PublishedUpdateEditState {
  title: string;
  description: string;
  link: string;
  contentLong: string;
  webExcerpt: string;
  webContent: string;
  webEnabled: boolean;
  isActive: boolean;
}

function trimToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function createPublishedUpdateEditState(update: PublishedUpdateEditSource): PublishedUpdateEditState {
  return {
    title: update.title,
    description: update.description,
    link: update.link ?? '',
    contentLong: update.contentLong ?? '',
    webExcerpt: update.web?.excerpt ?? '',
    webContent: update.web?.content ?? '',
    webEnabled: update.web?.enabled === true,
    isActive: update.isActive !== false,
  };
}

export function buildPublishedUpdatePatch(
  update: PublishedUpdateEditSource,
  state: PublishedUpdateEditState
) {
  const nextWebEnabled = state.webEnabled && !!update.web?.slug;

  return {
    title: state.title.trim(),
    description: state.description.trim(),
    link: trimToNull(state.link),
    contentLong: trimToNull(state.contentLong),
    isActive: state.isActive,
    web: update.web
      ? {
          ...update.web,
          enabled: nextWebEnabled,
          locale: update.web.locale ?? update.locale ?? 'ca',
          title: state.title.trim(),
          excerpt: trimToNull(state.webExcerpt),
          content: trimToNull(state.webContent),
        }
      : null,
  };
}
