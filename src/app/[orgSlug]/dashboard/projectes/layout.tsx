'use client';

import * as React from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePermissions } from '@/hooks/use-permissions';

interface ProjectesLayoutProps {
  children: React.ReactNode;
}

export default function ProjectesLayout({ children }: ProjectesLayoutProps) {
  const { canAccessProjectsArea } = usePermissions();

  if (!canAccessProjectsArea) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Acces restringit</CardTitle>
            <CardDescription>
              No tens permisos per accedir a la seccio de Projectes.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
