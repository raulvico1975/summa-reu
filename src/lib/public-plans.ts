export const PUBLIC_PLAN_IDS = ['control', 'management', 'complete'] as const;

export type PublicPlanId = (typeof PUBLIC_PLAN_IDS)[number];

export function parsePublicPlanId(value: string | null | undefined): PublicPlanId | null {
  return typeof value === 'string' && PUBLIC_PLAN_IDS.includes(value as PublicPlanId)
    ? value as PublicPlanId
    : null;
}
