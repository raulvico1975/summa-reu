// src/app/[orgSlug]/dashboard/project-module/projects/page.tsx
// Llistat de projectes del mòdul

'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProjectCommercialAccess, useProjectLifecycle, useProjects } from '@/hooks/use-project-module';
import { useOrgUrl, useCurrentOrganization } from '@/hooks/organization-provider';
import { useFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Plus, FolderKanban, Calendar, Euro, Eye, Pencil, Archive, Trash2, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { trackUX } from '@/lib/ux/trackUX';
import { useTranslations } from '@/i18n';
import { collection, getDocs } from 'firebase/firestore';
import type { Project, ExpenseAssignment } from '@/lib/project-module-types';
import type { ProjectDeletePolicy, ProjectDeleteUsage } from '@/lib/project-module/project-lifecycle-policy';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function formatAmount(amount: number | null): string {
  if (amount === null) return '-';
  return new Intl.NumberFormat('ca-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

/** Format compacte sense símbol: "24.107,00" */
function formatAmountCompact(amount: number): string {
  return new Intl.NumberFormat('ca-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

interface ProjectCardProps {
  project: Project;
  executedAmount: number;
  isMutating: boolean;
  canMutate: boolean;
  onRequestClose: (project: Project) => void;
  onRequestDelete: (project: Project) => void;
}

function ProjectCard({
  project,
  executedAmount,
  isMutating,
  canMutate,
  onRequestClose,
  onRequestDelete,
}: ProjectCardProps) {
  const { t, tr } = useTranslations();
  const { buildUrl } = useOrgUrl();
  const router = useRouter();

  // Càlculs econòmics (pressupost del projecte, sense carregar partides al llistat)
  const budgeted = project.budgetEUR ?? 0;
  const pending = budgeted - executedAmount;

  // Click en el card → navega a Gestió Econòmica
  const handleCardClick = () => {
    trackUX('projects.card.click', { projectId: project.id, projectName: project.name });
    router.push(buildUrl(`/dashboard/project-module/projects/${project.id}/budget`));
  };

  // Click en botó Gestió Econòmica
  const handleBudgetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    trackUX('projects.budget.click', { projectId: project.id, projectName: project.name });
  };

  // Click en botó Veure despeses
  const handleViewExpensesClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    trackUX('projects.viewExpenses.click', { projectId: project.id, projectName: project.name });
  };

  // Click en botó Editar
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    trackUX('projects.edit.click', { projectId: project.id, projectName: project.name });
  };

  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    trackUX('projects.close.request', { projectId: project.id, projectName: project.name });
    onRequestClose(project);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    trackUX('projects.delete.request', { projectId: project.id, projectName: project.name });
    onRequestDelete(project);
  };

  return (
    <Card
      className="hover:border-primary/50 transition-colors cursor-pointer"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {project.code && (
              <div className="text-xs font-mono text-muted-foreground">
                {project.code}
              </div>
            )}
            <CardTitle className="mt-0.5 text-sm font-medium truncate" title={project.name}>
              {project.name}
            </CardTitle>
          </div>
          <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
            {project.status === 'active' ? tr('projectModule.form.statusActive') : tr('projectModule.form.statusClosed')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Dates — línia compacta */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span>{formatDate(project.startDate)} – {formatDate(project.endDate)}</span>
        </div>

        {/* Info econòmica — llista vertical etiqueta/valor */}
        <div className="border-t pt-3 space-y-1">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground">{tr('projectModule.budget')}</span>
            <span className="text-sm font-medium tabular-nums">{formatAmountCompact(budgeted)} €</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground">{tr('projectModule.executed')}</span>
            <span className="text-sm font-medium tabular-nums">{formatAmountCompact(executedAmount)} €</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground">{tr('projectModule.pending')}</span>
            <span className={`text-sm font-medium tabular-nums ${pending < 0 ? 'text-red-600' : ''}`}>
              {formatAmountCompact(pending)} €
            </span>
          </div>
        </div>

        <div className="pt-2 flex gap-2">
          <Link
            href={buildUrl(`/dashboard/project-module/projects/${project.id}/budget`)}
            className="flex-1"
            onClick={handleBudgetClick}
          >
            <Button variant="outline" size="sm" className="w-full">
              <Euro className="h-4 w-4 mr-1" />
              {tr('projectModule.budgetManagement')}
            </Button>
          </Link>
          <Link
            href={buildUrl(`/dashboard/project-module/expenses?projectId=${project.id}`)}
            onClick={handleViewExpensesClick}
          >
            <Button variant="ghost" size="sm" title={tr('projectModule.viewProjectExpenses')}>
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
          {canMutate && (
            <Link
              href={buildUrl(`/dashboard/project-module/projects/${project.id}/edit`)}
              onClick={handleEditClick}
            >
              <Button variant="ghost" size="sm" title={tr('projectModule.editProject')}>
                <Pencil className="h-4 w-4" />
              </Button>
            </Link>
          )}
          {canMutate && project.status === 'active' && (
            <Button
              variant="ghost"
              size="sm"
              title={tr('projectModule.projects.closeAction', 'Tancar projecte')}
              onClick={handleCloseClick}
              disabled={isMutating}
              className="text-muted-foreground hover:text-foreground"
            >
              <Archive className="h-4 w-4" />
            </Button>
          )}
          {canMutate && (
            <Button
              variant="ghost"
              size="sm"
              title={tr('projectModule.projects.deleteAction', 'Eliminar projecte buit')}
              onClick={handleDeleteClick}
              disabled={isMutating}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDeleteBlockers(
  blockers: ProjectDeletePolicy['blockers'],
  tr: (key: string, fallback?: string) => string
): string {
  const labels = blockers.map((blocker) => {
    if (blocker === 'assignments') return tr('projectModule.projects.deleteBlockerAssignments', 'imputacions de despeses');
    if (blocker === 'budgetLines') return tr('projectModule.projects.deleteBlockerBudgetLines', 'partides pressupostaries');
    if (blocker === 'fxTransfers') return tr('projectModule.projects.deleteBlockerFxTransfers', 'transferencies FX');
    return tr('projectModule.projects.deleteBlockerTransactions', 'moviments vinculats');
  });

  return labels.join(', ');
}

function formatDeleteUsage(usage: ProjectDeleteUsage): string {
  return [
    `imputacions: ${usage.assignmentCount}`,
    `partides: ${usage.budgetLineCount}`,
    `FX: ${usage.fxTransferCount}`,
    `moviments: ${usage.transactionCount}`,
  ].join(' · ');
}

export default function ProjectsListPage() {
  const { projects, isLoading, error, refresh } = useProjects();
  const { closeProject, inspectDeleteProject, deleteProject, isMutating } = useProjectLifecycle();
  const { buildUrl } = useOrgUrl();
  const { firestore } = useFirebase();
  const { organizationId } = useCurrentOrganization();
  const { toast } = useToast();
  const { t, tr } = useTranslations();
  const { canMutateProjects } = useProjectCommercialAccess();

  // Carregar tots els expenseLinks per calcular execució per projecte
  const [executionByProject, setExecutionByProject] = React.useState<Map<string, number>>(new Map());
  const [linksLoading, setLinksLoading] = React.useState(true);
  const [projectToClose, setProjectToClose] = React.useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = React.useState<Project | null>(null);
  const [deleteInspection, setDeleteInspection] = React.useState<(ProjectDeletePolicy & { usage: ProjectDeleteUsage }) | null>(null);

  React.useEffect(() => {
    if (canMutateProjects) return;
    setProjectToClose(null);
    setProjectToDelete(null);
    setDeleteInspection(null);
  }, [canMutateProjects]);
  const [isInspectingDelete, setIsInspectingDelete] = React.useState(false);

  React.useEffect(() => {
    if (!organizationId) return;

    const loadLinks = async () => {
      setLinksLoading(true);
      try {
        const linksRef = collection(
          firestore,
          'organizations',
          organizationId,
          'projectModule',
          '_',
          'expenseLinks'
        );
        const snapshot = await getDocs(linksRef);

        const map = new Map<string, number>();
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const assignments = data.assignments as ExpenseAssignment[] ?? [];
          for (const assignment of assignments) {
            const current = map.get(assignment.projectId) ?? 0;
            map.set(assignment.projectId, current + (assignment.amountEUR != null ? Math.abs(assignment.amountEUR) : 0));
          }
        }
        setExecutionByProject(map);
      } catch (err) {
        console.error('Error loading expense links:', err);
      } finally {
        setLinksLoading(false);
      }
    };

    loadLinks();
  }, [firestore, organizationId]);

  // Track page open
  React.useEffect(() => {
    trackUX('projects.open', { projectCount: projects.length });
  }, [projects.length]);

  const handleRequestDelete = React.useCallback(async (project: Project) => {
    if (!canMutateProjects) return;
    setProjectToDelete(project);
    setDeleteInspection(null);
    setIsInspectingDelete(true);

    try {
      const inspection = await inspectDeleteProject(project.id);
      setDeleteInspection(inspection);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: tr('projectModule.projects.deleteInspectErrorTitle', 'No s’ha pogut revisar el projecte'),
        description: err instanceof Error ? err.message : tr('projectModule.projects.deleteInspectErrorBody', 'Torna-ho a provar.'),
      });
      setProjectToDelete(null);
    } finally {
      setIsInspectingDelete(false);
    }
  }, [canMutateProjects, inspectDeleteProject, toast, tr]);

  const handleConfirmClose = React.useCallback(async () => {
    if (!canMutateProjects || !projectToClose) return;

    try {
      await closeProject(projectToClose.id);
      toast({
        title: tr('projectModule.projects.closeSuccessTitle', 'Projecte tancat'),
        description: tr('projectModule.projects.closeSuccessBody', 'El projecte queda preservat i deixa d’aparèixer com a projecte actiu.'),
      });
      trackUX('projects.close.success', { projectId: projectToClose.id, projectName: projectToClose.name });
      setProjectToClose(null);
      await refresh();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: tr('projectModule.projects.closeErrorTitle', 'No s’ha pogut tancar'),
        description: err instanceof Error ? err.message : tr('projectModule.projects.closeErrorBody', 'Torna-ho a provar.'),
      });
    }
  }, [canMutateProjects, closeProject, projectToClose, refresh, toast, tr]);

  const handleConfirmDelete = React.useCallback(async () => {
    if (!canMutateProjects || !projectToDelete) return;

    try {
      await deleteProject(projectToDelete.id);
      toast({
        title: tr('projectModule.projects.deleteSuccessTitle', 'Projecte eliminat'),
        description: tr('projectModule.projects.deleteSuccessBody', 'El projecte no tenia dades vinculades i s’ha eliminat.'),
      });
      trackUX('projects.delete.success', { projectId: projectToDelete.id, projectName: projectToDelete.name });
      setProjectToDelete(null);
      setDeleteInspection(null);
      await refresh();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: tr('projectModule.projects.deleteErrorTitle', 'No s’ha pogut eliminar'),
        description: err instanceof Error ? err.message : tr('projectModule.projects.deleteErrorBody', 'Tanca el projecte si cal conservar-ne la traçabilitat.'),
      });
    }
  }, [canMutateProjects, deleteProject, projectToDelete, refresh, toast, tr]);

  const handleCloseFromDeleteBlock = React.useCallback(async () => {
    if (!canMutateProjects || !projectToDelete) return;

    setProjectToClose(projectToDelete);
    setProjectToDelete(null);
    setDeleteInspection(null);
  }, [canMutateProjects, projectToDelete]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive font-medium">{tr('projectModule.errorLoadingProjects')}</p>
        <p className="text-muted-foreground text-sm">{error.message}</p>
        <Button onClick={refresh} variant="outline">
          {tr('projectModule.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tr('projectModule.projectsTitle')}</h1>
          <p className="text-muted-foreground">
            {tr('projectModule.projectsDescription')}
          </p>
        </div>
        {canMutateProjects && (
          <Link href={buildUrl('/dashboard/project-module/projects/new')}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {tr('projectModule.newProject')}
            </Button>
          </Link>
        )}
      </div>

      {/* Llistat */}
      {isLoading || linksLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={tr('emptyStates.projects.noData')}
          description={tr('emptyStates.projects.noDataDesc')}
        >
          {canMutateProjects && (
            <Link href={buildUrl('/dashboard/project-module/projects/new')}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {tr('emptyStates.projects.addNew')}
              </Button>
            </Link>
          )}
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              executedAmount={executionByProject.get(project.id) ?? 0}
              isMutating={isMutating}
              canMutate={canMutateProjects}
              onRequestClose={setProjectToClose}
              onRequestDelete={handleRequestDelete}
            />
          ))}
        </div>
      )}

      <AlertDialog open={canMutateProjects && !!projectToClose} onOpenChange={(open) => !open && setProjectToClose(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr('projectModule.projects.closeDialogTitle', 'Tancar projecte')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr('projectModule.projects.closeDialogBody', 'El projecte es marcarà com a tancat. No s’eliminaran pressupost, imputacions, partides ni transferències.')}
              {projectToClose ? ` ${projectToClose.name}` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose} disabled={!canMutateProjects || isMutating}>
              {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr('projectModule.projects.closeConfirm', 'Tancar projecte')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={canMutateProjects && !!projectToDelete} onOpenChange={(open) => {
        if (!open) {
          setProjectToDelete(null);
          setDeleteInspection(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr('projectModule.projects.deleteDialogTitle', 'Eliminar projecte')}</AlertDialogTitle>
            <AlertDialogDescription>
              {isInspectingDelete ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tr('projectModule.projects.deleteInspecting', 'Revisant si el projecte té dades vinculades...')}
                </span>
              ) : deleteInspection?.canDelete ? (
                <>
                  {tr('projectModule.projects.deleteDialogBody', 'Aquest projecte no té dades vinculades. Si l’elimines, desapareixerà definitivament. Aquesta acció no afecta moviments ni justificacions perquè no hi ha dades associades.')}
                  {projectToDelete ? ` ${projectToDelete.name}` : ''}
                </>
              ) : deleteInspection ? (
                <>
                  {tr('projectModule.projects.deleteBlockedBody', 'Aquest projecte té dades vinculades i no es pot eliminar. Pots tancar-lo perquè deixi d’aparèixer en noves imputacions, mantenint l’històric intacte. Dades vinculades:')}
                  {' '}
                  {formatDeleteBlockers(deleteInspection.blockers, tr)}.
                  <br />
                  <span className="text-xs text-muted-foreground">{formatDeleteUsage(deleteInspection.usage)}</span>
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            {deleteInspection?.canDelete ? (
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={!canMutateProjects || isMutating}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tr('projectModule.projects.deleteConfirm', 'Eliminar definitivament')}
              </AlertDialogAction>
            ) : deleteInspection && projectToDelete?.status === 'active' ? (
              <AlertDialogAction onClick={handleCloseFromDeleteBlock} disabled={!canMutateProjects}>
                {tr('projectModule.projects.closeInstead', 'Tancar projecte')}
              </AlertDialogAction>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
