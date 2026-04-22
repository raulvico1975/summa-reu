import type { WeeklyWindow } from './weekly-window';

export function buildWeeklyProductUpdateExternalId(window: Pick<WeeklyWindow, 'weekStartLabel' | 'weekEndLabel'>): string {
  return `weekly-product-update-${window.weekStartLabel}_${window.weekEndLabel}`;
}

export function buildWeeklyProductUpdateSlug(window: Pick<WeeklyWindow, 'weekStartLabel' | 'weekEndLabel'>): string {
  return `novetats-setmanals-${window.weekStartLabel}-${window.weekEndLabel}`;
}
