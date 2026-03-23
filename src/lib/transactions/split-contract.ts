export const MAX_SPLIT_CHILDREN = 49;
export const SPLIT_TOO_LARGE_CODE = 'SPLIT_TOO_LARGE';

export function getSplitTooLargeMessage(maxChildren: number = MAX_SPLIT_CHILDREN): string {
  return `Aquest desglossament admet com a màxim ${maxChildren} línies.`;
}
