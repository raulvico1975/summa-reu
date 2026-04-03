'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { useTranslations } from '@/i18n';
import { Loader2, Mail, Copy, Check, UserPlus } from 'lucide-react';
import type { OrganizationRole } from '@/lib/data';
import {
  applyOverrides,
  getProjectCapability,
  getRoleDefaults,
  isUserPermissionsCustomized,
  type PermissionKey,
} from '@/lib/permissions';
import { validateAndCanonicalizeUserPermissionWrite } from '@/lib/permissions-write';

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInviteCreated?: () => void;
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

export function InviteMemberDialog({ open, onOpenChange, onInviteCreated }: InviteMemberDialogProps) {
  const { user } = useFirebase();
  const { organization, organizationId } = useCurrentOrganization();
  const { toast } = useToast();
  const { t, tr } = useTranslations();

  // Formulari
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<OrganizationRole>('user');
  const [denied, setDenied] = React.useState<Set<PermissionKey>>(new Set());
  const [grants, setGrants] = React.useState<Set<PermissionKey>>(new Set());

  // Estat
  const [isCreating, setIsCreating] = React.useState(false);
  const [createdInviteUrl, setCreatedInviteUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState('');

  // Ref per seleccionar l'input
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Refs per gestionar timeouts i evitar memory leaks
  const selectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const copyTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeouts quan component es desmunta
  React.useEffect(() => {
    return () => {
      if (selectTimeoutRef.current) clearTimeout(selectTimeoutRef.current);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // Reset quan es tanca
  React.useEffect(() => {
    if (!open) {
      setEmail('');
      setRole('user');
      setDenied(new Set());
      setGrants(new Set());
      setError('');
      setCreatedInviteUrl(null);
      setCopied(false);
    }
  }, [open]);

  // Seleccionar l'enllaç quan es crea
  React.useEffect(() => {
    if (createdInviteUrl && inputRef.current) {
      if (selectTimeoutRef.current) clearTimeout(selectTimeoutRef.current);
      selectTimeoutRef.current = setTimeout(() => {
        inputRef.current?.select();
      }, 100);
    }
  }, [createdInviteUrl]);

  const roleDefaults = React.useMemo(() => getRoleDefaults('user'), []);

  const effectivePermissions = React.useMemo(
    () => applyOverrides(roleDefaults, { deny: Array.from(denied) }, Array.from(grants)),
    [denied, grants, roleDefaults]
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

  const handleCreate = async () => {
    // Validacions
    if (!email.trim()) {
      setError(t.members.errorEmailRequired);
      return;
    }

    if (!email.includes('@')) {
      setError(t.members.errorInvalidEmail);
      return;
    }

    if (!organizationId || !organization) {
      setError(t.common.error);
      return;
    }

    setError('');
    setIsCreating(true);

    try {
      let canonicalDeny: PermissionKey[] = [];
      let canonicalGrants: PermissionKey[] = [];

      if (role === 'user') {
        const validation = validateAndCanonicalizeUserPermissionWrite({
          deny: Array.from(denied),
          grants: Array.from(grants),
        });

        if (!validation.ok) {
          setError(t.members.errorCreatingInvitation);
          return;
        }

        canonicalDeny = validation.value.deny;
        canonicalGrants = validation.value.grants;
      }

      const idToken = await user!.getIdToken();
      const createRes = await fetch('/api/invitations/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          organizationId,
          email,
          role,
          ...(role === 'user' && canonicalDeny.length > 0 ? { userOverrides: { deny: canonicalDeny } } : {}),
          ...(role === 'user' && canonicalGrants.length > 0 ? { userGrants: canonicalGrants } : {}),
        }),
      });

      const createBody = await createRes.json().catch(() => ({} as { error?: string; token?: string; reused?: boolean }));

      if (!createRes.ok) {
        switch (createBody.error) {
          case 'member_already_exists':
            setError('Aquest email ja és membre de l’organització.');
            return;
          default:
            setError(t.members.errorCreatingInvitation);
            return;
        }
      }

      const createdToken = createBody.token;
      if (!createdToken) {
        setError(t.members.errorCreatingInvitation);
        return;
      }

      // Generar URL d'invitació
      const baseUrl = window.location.origin;
      const inviteUrl = `${baseUrl}/registre?token=${createdToken}`;
      setCreatedInviteUrl(inviteUrl);

      toast({
        title: createBody.reused ? t.members.invitationReady : t.members.invitationCreated,
        description: createBody.reused
          ? 'Ja existia una invitació pendent per aquest email. Hem reutilitzat l’enllaç actiu.'
          : t.members.invitationCreatedDescription(email),
      });

      onInviteCreated?.();

    } catch (err: any) {
      console.error('Error creating invitation:', err);
      setError(t.members.errorCreatingInvitation);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyUrl = async () => {
    if (createdInviteUrl) {
      try {
        await navigator.clipboard.writeText(createdInviteUrl);
        setCopied(true);
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
        toast({ title: t.members.linkCopied });
      } catch (err) {
        // Si falla el clipboard API, seleccionem el text per copiar manualment
        inputRef.current?.select();
        toast({
          title: t.members.selectAndCopy,
          description: t.members.selectAndCopyDescription,
        });
      }
    }
  };

  const handleSelectAll = () => {
    inputRef.current?.select();
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const getRoleDescription = (r: OrganizationRole): string => {
    switch (r) {
      case 'admin': return t.members.roleAdminDescription;
      case 'user': return t.members.roleUserDescription;
      case 'viewer': return t.members.roleViewerDescription;
      default: return '';
    }
  };

  const permissionLabel = (permission: PermissionKey, group: 'section' | 'action'): string => {
    const translationKey =
      group === 'section'
        ? SECTION_LABEL_KEYS[permission]
        : ACTION_LABEL_KEYS[permission];

    if (!translationKey) {
      return tr('permissionsDialog.unknownPermission', 'Permís desconegut');
    }
    return tr(translationKey, tr('permissionsDialog.unknownPermission', 'Permís desconegut'));
  };

  const projectCapabilityValue = projectCapability;
  const isProjectsSectionLocked = projectCapabilityValue === 'none';
  const isUserCustomized = isUserPermissionsCustomized(
    { deny: Array.from(denied) },
    Array.from(grants)
  );
  const canRestoreDefaults = denied.size > 0 || grants.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,980px)] !w-[min(calc(100vw-1.5rem),82rem)] !max-w-[82rem] flex-col overflow-hidden p-0 sm:!w-[min(calc(100vw-3rem),82rem)]">
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {createdInviteUrl ? t.members.invitationReady : t.members.inviteMember}
          </DialogTitle>
          <DialogDescription>
            {createdInviteUrl 
              ? t.members.invitationReadyDescription
              : t.members.inviteMemberDescription
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
          {createdInviteUrl ? (
            // Pantalla d'èxit amb l'enllaç
            <div className="space-y-5">
              <Alert className="items-start">
                <Mail className="mt-0.5 h-4 w-4" />
                <AlertDescription className="break-words leading-relaxed">
                  {t.members.sendLinkTo} <strong>{email}</strong>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>{t.members.invitationLink}</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    ref={inputRef}
                    value={createdInviteUrl}
                    readOnly
                    className="min-w-0 flex-1 font-mono text-xs"
                    onClick={handleSelectAll}
                  />
                  <Button variant="outline" size="icon" onClick={handleCopyUrl} className="self-start sm:self-auto">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.members.linkExpires} • Clica l'enllaç per seleccionar-lo i copia amb Cmd+C
                </p>
              </div>

            </div>
          ) : (
            // Formulari
            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.18fr)]">
              <div className="space-y-5 rounded-xl border bg-background p-4 shadow-sm sm:p-5">
                <div className="space-y-2">
                  <Label htmlFor="email">{t.members.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@exemple.com"
                    disabled={isCreating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">{t.members.role}</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as OrganizationRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{t.members.roleAdmin}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="user">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{t.members.roleUser}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="viewer">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{t.members.roleViewer}</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground break-words leading-relaxed">
                    {getRoleDescription(role)}
                  </p>
                </div>
              </div>

              {role === 'user' && (
                <div className="space-y-5 rounded-xl border bg-muted/20 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {tr('permissionsDialog.title', 'Permisos d usuari')}
                      </p>
                      <p className="text-xs text-muted-foreground break-words leading-relaxed">
                        {tr(
                          'permissionsDialog.inviteHint',
                          'Defineix permisos inicials perquè el membre entri amb accés coherent des del primer login.'
                        )}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isUserCustomized
                        ? t.members.roleUserCustomized
                        : t.members.roleUserDefault}
                    </p>
                  </div>

                  <div className="grid gap-5 xl:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">{tr('permissionsDialog.sectionsTitle', 'Seccions')}</p>
                      <div className="grid gap-2">
                        {SECTION_TOGGLES.map((section) => (
                          <div key={section} className="flex min-h-12 items-start justify-between gap-3 rounded-lg border bg-background px-3 py-2 sm:items-center">
                            <Label htmlFor={`invite-section-${section}`} className="min-w-0 cursor-pointer text-sm leading-tight break-words">
                              {permissionLabel(section, 'section')}
                            </Label>
                            <Switch
                              id={`invite-section-${section}`}
                              checked={effectivePermissions[section]}
                              disabled={isProjectsSectionLocked && section === 'sections.projectes'}
                              onCheckedChange={(checked) => togglePermission(section, checked === true)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">{tr('permissionsDialog.actionsTitle', 'Accions crítiques')}</p>
                        <div className="grid gap-2">
                          {CRITICAL_ACTION_TOGGLES.map((action) => (
                            <div key={action} className="flex min-h-12 items-start justify-between gap-3 rounded-lg border bg-background px-3 py-2 sm:items-center">
                              <Label htmlFor={`invite-action-${action}`} className="min-w-0 cursor-pointer text-sm leading-tight break-words">
                                {permissionLabel(action, 'action')}
                              </Label>
                              <Switch
                                id={`invite-action-${action}`}
                                checked={effectivePermissions[action]}
                                onCheckedChange={(checked) => togglePermission(action, checked === true)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <p className="text-sm font-semibold">{tr('permissionsDialog.projectsTitle', 'Projectes')}</p>
                        <RadioGroup
                          value={projectCapabilityValue}
                          onValueChange={(value) => handleProjectCapabilityChange(value as 'manage' | 'expenseInput' | 'none')}
                          className="grid gap-2"
                        >
                          <div className="flex items-center gap-2 rounded-lg border bg-background p-3">
                            <RadioGroupItem value="manage" id="invite-projects-manage" />
                            <Label htmlFor="invite-projects-manage" className="cursor-pointer text-sm leading-tight break-words">
                              {tr('permissionsDialog.projects.manage', 'Gestió de projectes')}
                            </Label>
                          </div>
                          <div className="flex items-center gap-2 rounded-lg border bg-background p-3">
                            <RadioGroupItem value="expenseInput" id="invite-projects-expense-input" />
                            <Label htmlFor="invite-projects-expense-input" className="cursor-pointer text-sm leading-tight break-words">
                              {tr('permissionsDialog.projects.expenseInput', 'Entrada de despeses')}
                            </Label>
                          </div>
                          <div className="flex items-center gap-2 rounded-lg border bg-background p-3">
                            <RadioGroupItem value="none" id="invite-projects-none" />
                            <Label htmlFor="invite-projects-none" className="cursor-pointer text-sm leading-tight break-words">
                              {tr('permissionsDialog.projects.none', 'Sense accés a projectes')}
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleRestoreDefaults}
                    disabled={!canRestoreDefaults}
                    className="h-8 justify-start px-0 text-sm"
                  >
                    {tr('permissionsDialog.restoreDefaults', 'Restaurar per defecte')}
                  </Button>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription className="break-words leading-relaxed">{error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t bg-background px-5 py-4 sm:px-6">
          <DialogFooter>
            {createdInviteUrl ? (
              <Button onClick={handleClose}>
                {t.common.close}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleClose} disabled={isCreating}>
                  {t.common.cancel}
                </Button>
                <Button onClick={handleCreate} disabled={isCreating}>
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t.members.createInvitation}
                </Button>
              </>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
