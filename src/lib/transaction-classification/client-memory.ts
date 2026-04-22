export interface ClassificationMemoryConfirmationInput {
  orgId: string;
  description: string;
  contactId?: string | null;
  categoryId?: string | null;
}

interface AuthLike {
  getIdToken: () => Promise<string>;
}

export async function confirmClassificationMemory(
  authUser: AuthLike | null | undefined,
  input: ClassificationMemoryConfirmationInput
): Promise<void> {
  if (!authUser) return;
  if (!input.contactId && !input.categoryId) return;

  const idToken = await authUser.getIdToken();
  await fetch('/api/transactions/classification-memory', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(input),
  });
}
