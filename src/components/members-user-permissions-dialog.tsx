'use client';

import * as React from 'react';
import type { OrganizationMember } from '@/lib/data';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  applyOverrides,
  getProjectCapability,
  getRoleDefaults,
  isUserPermissionsCustomized,
  sanitizePermissionList,
  sanitizeUserGrants,
  type PermissionKey,
} from '@/lib/permissions';

interface MembersUserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: OrganizationMember | null;
}

const SECTION_TOGGLES: PermissionKey[] = [
  'sections.moviments',
  'sections.projectes',
  'sections.informes',
  'sections.donants',
  'sections.proveidors',
  'sections.treballadors',
  'sections.configuracio',
];

const CRITICAL_ACTION_TOGGLES: PermissionKey[] = [
  'moviments.read',
  'moviments.importarExtractes',
  'moviments.editar',
  'informes.exportar',
  'fiscal.model182.generar',
  'fiscal.model347.generar',
  'fiscal.certificats.generar',
];

const SECTION_LABEL_KEYS: Partial<Record<PermissionKey, string>> = {
  'sections.moviments': 'sidebar.movements',
  'sections.projectes': 'sidebar.projects',
  'sections.informes': 'sidebar.reports',
  'sections.donants': 'sidebar.donors',
  'sections.proveidors': 'sidebar.suppliers',
  'sections.treballadors': 'sidebar.employees',
  'sections.configuracio': 'sidebar.settings',
};

const ACTION_LABEL_KEYS: Partial<Record<PermissionKey, string>> = {
  'moviments.read': 'permissionsDialog.actions.movimentsRead',
  'moviments.importarExtractes': 'permissionsDialog.actions.movimentsImportarExtractes',
  'moviments.editar': 'permissionsDialog.actions.movimentsEditar',
  'informes.exportar': 'permissionsDialog.actions.informesExportar',
  'fiscal.model182.generar': 'permissionsDialog.actions.fiscalModel182Generar',
  'fiscal.model347.generar': 'permissionsDialog.actions.fiscalModel347Generar',
  'fiscal.certificats.generar': 'permissionsDialog.actions.fiscalCertificatsGenerar',
};

export function MembersUserPermissionsDialog({
  open,
  onOpenChange,
  member,
}: MembersUserPermissionsDialogProps) {
  const { organizationId } = useCurrentOrganization();
  const { user } = useFirebase();
  const { toast } = useToast();
  const { tr } = useTranslations();

  const [denied, setDenied] = React.useState<Set<PermissionKey>>(new Set());
  const [grants, setGrants] = React.useState<Set<PermissionKey>>(new Set());
  const [isSaving, setIsSaving] = React.useState(false);
  const lastFocusedElementRef = React.useRef<HTMLElement | null>(null);

  const roleDefaults = React.useMemo(() => getRoleDefaults(member?.role ?? null), [member?.role]);

  React.useEffect(() => {
    if (open && document.activeElement instanceof HTMLElement) {
      lastFocusedElementRef.current = document.activeElement;
    }
  }, [open]);

  React.useEffect(() => {
    if (!open || !member) return;
    const deniedPermissions = sanitizePermissionList(member.userOverrides?.deny);
    const grantedPermissions = sanitizeUserGrants(member.userGrants);
    setDenied(new Set(deniedPermissions));
    setGrants(new Set(grantedPermissions));
  }, [open, member]);

  const effectivePermissions = React.useMemo(
    () => applyOverrides(roleDefaults, { deny: Array.from(denied) }, Array.from(grants)),
    [roleDefaults, denied, grants]
  );

  const projectCapability = React.useMemo(
    () => getProjectCapability(effectivePermissions),
    [effectivePermissions]
  );

  const togglePermission = React.useCallback((permission: PermissionKey, enabled: boolean) => {
    setDenied((prev) => {
      const next = new Set(prev);
      if (enabled) {
        next.delete(permission);
      } else {
        next.add(permission);
      }
      return next;
    });
  }, []);

  const closeDialog = React.useCallback(() => {
    // Evita que un estat de "saving" bloquegi la modal després de tancar-la.
    setIsSaving(false);
    onOpenChange(false);
    requestAnimationFrame(() => {
      const previous = lastFocusedElementRef.current;
      if (previous && document.contains(previous)) {
        previous.focus();
        return;
      }
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
  }, [onOpenChange]);

  const handleDialogOpenChange = React.useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      closeDialog();
      return;
    }
    onOpenChange(true);
  }, [closeDialog, onOpenChange]);

  const handleProjectCapabilityChange = React.useCallback((value: 'manage' | 'expenseInput' | 'none') => {
    setDenied((prev) => {
      const next = new Set(prev);
      if (value === 'none') {
        next.add('sections.projectes');
        next.add('projectes.manage');
        next.add('projectes.expenseInput');
      } else if (value === 'manage') {
        next.delete('projectes.manage');
        next.delete('projectes.expenseInput');
      } else {
        next.add('projectes.manage');
        next.delete('projectes.expenseInput');
      }
      return next;
    });

    setGrants((prev) => {
      const next = new Set(prev);
      if (value === 'expenseInput') {
        next.add('projectes.expenseInput');
      } else {
        next.delete('projectes.expenseInput');
      }
      return next;
    });
  }, []);

  const handleRestoreDefaults = React.useCallback(() => {
    setDenied(new Set());
    setGrants(new Set());
  }, []);

  const handleSave = React.useCallback(async () => {
    if (!organizationId || !member || !user) return;

    setIsSaving(true);
    try {
      const deniedList = Array.from(denied).sort();
      const grantsList = Array.from(grants).sort();

      const idToken = await user.getIdToken();
      const response = await fetch('/api/members/user-permissions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orgId: organizationId,
          userId: member.userId,
          userOverrides: { deny: deniedList },
          userGrants: grantsList,
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? tr('permissionsDialog.saveError', 'No s han pogut desar els permisos.'));
      }

      toast({
        title: tr('permissionsDialog.saved', 'Permisos actualitzats'),
        description: member.displayName || member.email,
      });
      closeDialog();
    } catch (error) {
      console.error('Error actualitzant permisos d usuari:', error);
      toast({
        variant: 'destructive',
        title: tr('common.error', 'Error'),
        description: tr('permissionsDialog.saveError', 'No s han pogut desar els permisos.'),
      });
    } finally {
      setIsSaving(false);
    }
  }, [closeDialog, denied, grants, member, organizationId, toast, tr, user]);

  if (!member || member.role !== 'user') {
    return null;
  }

  const userPermissionsStatusLabel = isUserPermissionsCustomized(member.userOverrides, member.userGrants)
    ? tr('members.roleUserCustomized', 'User (personalitzat)')
    : tr('members.roleUserDefault', 'User (per defecte)');

  const permissionLabel = (permission: PermissionKey, group: 'section' | 'action'): string => {
    const translationKey =
      group === 'section'
        ? SECTION_LABEL_KEYS[permission]
        : ACTION_LABEL_KEYS[permission];

    if (!translationKey) {
      return tr('permissionsDialog.unknownPermission', 'Permis desconegut');
    }
    return tr(translationKey, tr('permissionsDialog.unknownPermission', 'Permis desconegut'));
  };

  const projectCapabilityValue = projectCapability;
  const isProjectsSectionLocked = projectCapabilityValue === 'none';
  const canRestoreDefaults = denied.size > 0 || grants.size > 0;

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className="flex max-h-[min(92vh,980px)] !w-[min(calc(100vw-1.5rem),82rem)] !max-w-[82rem] flex-col overflow-hidden p-0 sm:!w-[min(calc(100vw-3rem),82rem)]"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const previous = lastFocusedElementRef.current;
          if (previous && document.contains(previous)) {
            previous.focus();
          }
        }}
      >
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 sm:px-6">
          <DialogTitle>{tr('permissionsDialog.title', 'Permisos d usuari')}</DialogTitle>
          <DialogDescription>
            {`${tr('permissionsDialog.description', 'Configura seccions, accions critiques i capacitat de Projectes per a')} ${member.displayName || member.email}.`}
          </DialogDescription>
          <p className="text-xs text-muted-foreground">{userPermissionsStatusLabel}</p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border bg-muted/10 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{tr('permissionsDialog.sectionsTitle', 'Seccions')}</p>
                <p className="mt-1 text-2xl font-semibold">{SECTION_TOGGLES.filter((section) => effectivePermissions[section]).length}</p>
              </div>
              <div className="rounded-xl border bg-muted/10 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{tr('permissionsDialog.actionsTitle', 'Accions critiques')}</p>
                <p className="mt-1 text-2xl font-semibold">{CRITICAL_ACTION_TOGGLES.filter((action) => effectivePermissions[action]).length}</p>
              </div>
              <div className="rounded-xl border bg-muted/10 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{tr('permissionsDialog.projectsTitle', 'Projectes')}</p>
                <p className="mt-1 text-sm font-semibold">{projectCapabilityValue === 'manage'
                  ? tr('permissionsDialog.projects.manage', 'Gestio de projectes')
                  : projectCapabilityValue === 'expenseInput'
                    ? tr('permissionsDialog.projects.expenseInput', 'Entrada de despeses')
                    : tr('permissionsDialog.projects.none', 'Sense accés a projectes')}</p>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
            <div className="space-y-2 rounded-xl border bg-background p-4 shadow-sm">
              <h3 className="text-sm font-semibold">{tr('permissionsDialog.sectionsTitle', 'Seccions')}</h3>
              <div className="grid gap-3">
                {SECTION_TOGGLES.map((section) => (
                  <div key={section} className="flex min-h-12 items-start justify-between gap-3 rounded-lg border bg-background px-3 py-2 sm:items-center">
                    <Label htmlFor={`section-${section}`} className="min-w-0 cursor-pointer text-sm leading-tight break-words">{permissionLabel(section, 'section')}</Label>
                    <Switch
                      id={`section-${section}`}
                      checked={effectivePermissions[section]}
                      disabled={isProjectsSectionLocked && section === 'sections.projectes'}
                      onCheckedChange={(checked) => togglePermission(section, checked === true)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-5">
            <div className="space-y-2 rounded-xl border bg-background p-4 shadow-sm">
              <h3 className="text-sm font-semibold">{tr('permissionsDialog.actionsTitle', 'Accions critiques')}</h3>
              <div className="grid gap-3">
                {CRITICAL_ACTION_TOGGLES.map((action) => (
                  <div key={action} className="flex min-h-12 items-start justify-between gap-3 rounded-lg border bg-background px-3 py-2 sm:items-center">
                    <Label htmlFor={`action-${action}`} className="min-w-0 cursor-pointer text-sm leading-tight break-words">{permissionLabel(action, 'action')}</Label>
                    <Switch
                      id={`action-${action}`}
                      checked={effectivePermissions[action]}
                      onCheckedChange={(checked) => togglePermission(action, checked === true)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-xl border bg-background p-4 shadow-sm">
              <h3 className="text-sm font-semibold">{tr('permissionsDialog.projectsTitle', 'Projectes')}</h3>
              <RadioGroup
                value={projectCapabilityValue}
                onValueChange={(value) => handleProjectCapabilityChange(value as 'manage' | 'expenseInput' | 'none')}
                className="grid gap-2"
              >
                <div className="flex items-center gap-2 rounded-lg border bg-background p-3">
                  <RadioGroupItem value="manage" id="projects-manage" />
                  <Label htmlFor="projects-manage" className="cursor-pointer text-sm leading-tight break-words">{tr('permissionsDialog.projects.manage', 'Gestio de projectes')}</Label>
                </div>
                <div className="flex items-center gap-2 rounded-lg border bg-background p-3">
                  <RadioGroupItem value="expenseInput" id="projects-expense-input" />
                  <Label htmlFor="projects-expense-input" className="cursor-pointer text-sm leading-tight break-words">{tr('permissionsDialog.projects.expenseInput', 'Entrada de despeses')}</Label>
                </div>
                <div className="flex items-center gap-2 rounded-lg border bg-background p-3 sm:col-span-2">
                  <RadioGroupItem value="none" id="projects-none" />
                  <Label htmlFor="projects-none" className="cursor-pointer text-sm leading-tight break-words">{tr('permissionsDialog.projects.none', 'Sense accés a projectes')}</Label>
                </div>
              </RadioGroup>
            </div>
            </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t bg-background px-5 py-4 sm:px-6">
          <DialogFooter>
            <Button
              variant="ghost"
              className="sm:mr-auto"
              onClick={handleRestoreDefaults}
              disabled={isSaving || !canRestoreDefaults}
            >
              {tr('permissionsDialog.restoreDefaults', 'Restaurar per defecte')}
            </Button>
            <Button variant="outline" onClick={closeDialog} disabled={isSaving}>{tr('permissionsDialog.cancel', 'Cancel lar')}</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving
                ? tr('permissionsDialog.saving', 'Desant...')
                : tr('permissionsDialog.save', 'Desar permisos')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
