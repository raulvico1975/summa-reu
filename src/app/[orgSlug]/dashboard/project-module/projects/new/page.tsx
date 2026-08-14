// src/app/[orgSlug]/dashboard/project-module/projects/new/page.tsx
// Crear nou projecte

'use client';

import { ProjectForm } from '@/components/project-module/project-form';
import { useProjectCommercialAccess } from '@/hooks/use-project-module';

export default function NewProjectPage() {
  const { canMutateProjects } = useProjectCommercialAccess();
  if (!canMutateProjects) return <p className="text-muted-foreground">Mode de lectura: el pla actual no permet crear projectes.</p>;
  return <ProjectForm mode="create" />;
}
