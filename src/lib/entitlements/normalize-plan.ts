import type { CanonicalPlanId } from './types';

const PLAN_ALIASES: Readonly<Record<string, CanonicalPlanId>> = {
  control: 'control',
  management: 'management',
  complete: 'complete',
  initial: 'control',
  fiscal_documents: 'complete',
};

export function normalizePlanId(value: unknown): CanonicalPlanId | null {
  if (typeof value !== 'string') return null;
  return PLAN_ALIASES[value] ?? null;
}
