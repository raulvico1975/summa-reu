export interface RemittanceChildLike {
  archivedAt?: unknown;
}

export function isActiveRemittanceChild<T extends RemittanceChildLike>(
  child: T | null | undefined
): child is T {
  return !child?.archivedAt;
}

export function filterActiveRemittanceChildren<T extends RemittanceChildLike>(
  children: T[]
): T[] {
  return children.filter(isActiveRemittanceChild);
}
