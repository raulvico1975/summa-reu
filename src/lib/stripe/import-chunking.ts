export const STRIPE_IMPORT_CHILD_CHUNK_SIZE = 49;

export function planStripeImportChunkSizes(totalChildWrites: number): number[] {
  if (totalChildWrites <= 0) return [];

  const sizes: number[] = [];

  for (let cursor = 0; cursor < totalChildWrites; cursor += STRIPE_IMPORT_CHILD_CHUNK_SIZE) {
    sizes.push(Math.min(STRIPE_IMPORT_CHILD_CHUNK_SIZE, totalChildWrites - cursor));
  }

  return sizes;
}
