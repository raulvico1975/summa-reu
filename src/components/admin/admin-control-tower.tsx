'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useTranslations } from '@/i18n';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Building2,
  MoreHorizontal,
  Pause,
  Play,
  Loader2,
  Mail,
  ExternalLink,
  Download,
  RefreshCw,
  Copy,
  Megaphone,
  BookOpenText,
  Wrench,
  Scale,
  Send,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { MobileListItem } from '@/components/mobile/mobile-list-item';
import { CreateOrganizationDialog } from '@/components/admin/create-organization-dialog';
import { SuperAdminsManager } from '@/components/admin/super-admins-manager';
import { migrateExistingSlugs } from '@/lib/slugs';
import { logAdminAction, getRecentAuditLogs, formatAuditAction, type AdminAuditLog } from '@/lib/admin-audit';
import { isDemoEnv } from '@/lib/demo/isDemoOrg';
import {
  formatDateForAdmin,
  formatRelativeActivity,
} from '@/lib/admin/control-tower-format';
import type {
  AdminControlTowerSummary,
  ControlStatus,
} from '@/lib/admin/control-tower-summary';

function statusClasses(status: ControlStatus): string {
  if (status === 'critical') return 'border-red-300 bg-red-50'
  if (status === 'warning') return 'border-amber-300 bg-amber-50'
  return 'border-green-300 bg-green-50'
}

function statusBadgeVariant(status: ControlStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'critical') return 'destructive'
  if (status === 'warning') return 'secondary'
  return 'default'
}

function resolveAuthLanguage(language: string): string {
  const supported = new Set(['ca', 'es', 'fr', 'pt', 'en'])
  return supported.has(language) ? language : 'en'
}

export type AdminArea = 'overview' | 'entities' | 'content' | 'technical'
type ContentModule = 'blog' | 'novetats'

type OverviewAction = {
  id: string
  title: string
  description: string
  cta: string
  area: AdminArea
  tone: ControlStatus
  contentModule?: ContentModule
  section?: string
}

function combineStatuses(...statuses: Array<ControlStatus | null | undefined>): ControlStatus {
  if (statuses.includes('critical')) return 'critical'
  if (statuses.includes('warning')) return 'warning'
  return 'ok'
}

function humanStatusLabel(status: ControlStatus, trFn: (key: string, fallback?: string) => string): string {
  if (status === 'critical') return trFn('admin.status.critical', 'Requereix atencio ara')
  if (status === 'warning') return trFn('admin.status.warning', 'Conve revisar-ho')
  return trFn('admin.status.ok', 'Tot en ordre')
}

function AreaSectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function AdminControlTower({ area }: { area: AdminArea }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, firestore, auth } = useFirebase();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { tr, language } = useTranslations();
  const requestedModule = searchParams.get('module');

  const [summary, setSummary] = React.useState<AdminControlTowerSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = React.useState(false);
  const [summaryError, setSummaryError] = React.useState<string | null>(null);
  const [summaryRefreshToken, setSummaryRefreshToken] = React.useState(0);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [suspendDialogOrg, setSuspendDialogOrg] = React.useState<AdminControlTowerSummary['entities'][number] | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isMigrating, setIsMigrating] = React.useState(false);

  const [resetEmail, setResetEmail] = React.useState('');
  const [isResetting, setIsResetting] = React.useState(false);

  const [auditLogs, setAuditLogs] = React.useState<AdminAuditLog[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = React.useState(false);

  const [isSeedingDemo, setIsSeedingDemo] = React.useState(false);
  const [seedResult, setSeedResult] = React.useState<{ ok: boolean; demoMode?: string; counts?: Record<string, number>; error?: string } | null>(null);
  const [showSeedConfirm, setShowSeedConfirm] = React.useState(false);
  const [selectedDemoMode, setSelectedDemoMode] = React.useState<'short' | 'work'>('short');

  const [backupOrgId, setBackupOrgId] = React.useState<string | null>(null);
  const [notifyingOrgId, setNotifyingOrgId] = React.useState<string | null>(null);
  const [activeContentModule, setActiveContentModule] = React.useState<ContentModule>(
    requestedModule === 'novetats' ? 'novetats' : 'blog'
  );
  const [entitySearch, setEntitySearch] = React.useState('');
  const pendingSectionScrollRef = React.useRef<string | null>(null);

  const tri = React.useCallback(
    (key: string, params: Record<string, string | number>) =>
      tr(key).replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`)),
    [tr]
  );

  const currencyFormatter = React.useMemo(
    () =>
      new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'ca-ES', {
        style: 'currency',
        currency: 'EUR',
      }),
    [language]
  );

  const refreshSummary = React.useCallback(() => {
    setSummaryRefreshToken((prev) => prev + 1)
  }, [])

  const openArea = React.useCallback((area: AdminArea, section?: string) => {
    const path =
      area === 'overview'
        ? '/admin'
        : area === 'entities'
          ? '/admin/entitats'
          : area === 'content'
            ? '/admin/contingut'
            : '/admin/manteniment'

    const params = new URLSearchParams()
    if (section) {
      params.set('section', section)
    }

    const next = params.toString() ? `${path}?${params.toString()}` : path
    router.push(next)
  }, [router])

  const openContentModule = React.useCallback((module: ContentModule, section?: string) => {
    setActiveContentModule(module)
    const params = new URLSearchParams()
    params.set('module', module)
    if (section) {
      params.set('section', section)
    }
    router.push(`/admin/contingut?${params.toString()}`)
  }, [router])

  React.useEffect(() => {
    const section = searchParams.get('section')
    if (section) {
      pendingSectionScrollRef.current = section
    }
    if (area === 'content') {
      setActiveContentModule(requestedModule === 'novetats' ? 'novetats' : 'blog')
    }
  }, [area, requestedModule, searchParams])

  React.useEffect(() => {
    if (!pendingSectionScrollRef.current) return

    const section = pendingSectionScrollRef.current
    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector(`[data-section="${section}"]`)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        pendingSectionScrollRef.current = null
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [activeContentModule, area])

  React.useEffect(() => {
    if (!user) return

    let active = true

    const loadSummary = async () => {
      setIsSummaryLoading(true)
      setSummaryError(null)

      try {
        const idToken = await user.getIdToken()
        const response = await fetch('/api/admin/control-tower/summary', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        })

        const data = await response.json()
        if (!response.ok || !data.ok) {
          throw new Error(data.error || 'No s\'ha pogut carregar el resum')
        }

        if (!active) return
        setSummary(data.summary)
      } catch (error) {
        if (!active) return
        const message = (error as Error).message
        setSummaryError(message)
        console.error('[admin] control tower summary error:', error)
      } finally {
        if (active) {
          setIsSummaryLoading(false)
        }
      }
    }

    loadSummary()

    return () => {
      active = false
    }
  }, [user, summaryRefreshToken])

  React.useEffect(() => {
    if (!user) return;
    setIsLoadingAudit(true);
    getRecentAuditLogs(firestore, 15)
      .then(setAuditLogs)
      .catch(console.error)
      .finally(() => setIsLoadingAudit(false));
  }, [firestore, user, summaryRefreshToken]);

  React.useEffect(() => {
    if (!isCreateDialogOpen && user) {
      refreshSummary()
    }
  }, [isCreateDialogOpen, refreshSummary, user])

  const handleEnterOrganization = (org: AdminControlTowerSummary['entities'][number]) => {
    sessionStorage.setItem('adminViewingOrgId', org.id);
    router.push('/dashboard');
  };

  const handleCopyOrganization = async (org: AdminControlTowerSummary['entities'][number]) => {
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : 'https://summasocial.app'
      await navigator.clipboard.writeText(`${base}/${org.slug}`)
      toast({
        title: tr('admin.copy.orgLinkCopied', 'Enllaç copiat'),
        description: tr('admin.copy.orgLinkCopiedDesc', 'S\'ha copiat /{slug}').replace('{slug}', org.slug),
      })
    } catch (error) {
      console.error('Copy error:', error)
      toast({
        variant: 'destructive',
        title: tr('common.error', 'Error'),
        description: tr('admin.copy.orgLinkCopyError', 'No s\'ha pogut copiar l\'enllaç'),
      })
    }
  }

  const handleToggleSuspend = async (org: AdminControlTowerSummary['entities'][number]) => {
    setIsProcessing(true);
    try {
      const newStatus = org.status === 'suspended' ? 'active' : 'suspended';
      await updateDoc(doc(firestore, 'organizations', org.id), {
        status: newStatus,
        ...(newStatus === 'suspended' ? { suspendedAt: new Date().toISOString() } : { suspendedAt: null, suspendedReason: null }),
        updatedAt: new Date().toISOString(),
      });

      logAdminAction(
        firestore,
        newStatus === 'suspended' ? 'SUSPEND_ORG' : 'REACTIVATE_ORG',
        user!.uid,
        org.slug || org.id
      );

      toast({
        title: newStatus === 'suspended'
          ? tr('admin.shell.orgSuspended', 'Organització suspesa')
          : tr('admin.shell.orgReactivated', 'Organització reactivada'),
        description: newStatus === 'suspended'
          ? tr('admin.shell.orgNowSuspended', '{org} ara està suspesa.').replace('{org}', org.name)
          : tr('admin.shell.orgNowActive', '{org} ara està activa.').replace('{org}', org.name),
      });

      refreshSummary()
    } catch (error) {
      console.error('Error updating organization:', error);
      toast({ variant: 'destructive', title: tr('common.error', 'Error'), description: tr('admin.shell.updateError', 'No s\'ha pogut actualitzar l\'organització.') });
    } finally {
      setIsProcessing(false);
      setSuspendDialogOrg(null);
    }
  };

  const handleMigrateSlugs = async () => {
    setIsMigrating(true);
    try {
      const result = await migrateExistingSlugs(firestore);
      toast({
        title: tr('admin.migrations.completed', 'Migració completada'),
        description: `${tr('admin.migrations.migrated', '{count} organitzacions migrades').replace('{count}', String(result.migrated))}. ${result.errors.length > 0 ? tr('admin.migrations.errors', 'Errors: {count}').replace('{count}', String(result.errors.length)) : ''}`,
      });
      if (result.errors.length > 0) {
        console.error('Errors de migració:', result.errors);
      }
      refreshSummary()
    } catch (error) {
      console.error('Error durant la migració:', error);
      toast({
        variant: 'destructive',
        title: tr('common.error', 'Error'),
        description: tr('admin.migrations.failed', 'No s\'ha pogut completar la migració.'),
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!resetEmail.trim()) return;
    setIsResetting(true);
    try {
      auth.languageCode = resolveAuthLanguage(language);
      await sendPasswordResetEmail(auth, resetEmail.trim());
      logAdminAction(firestore, 'RESET_PASSWORD_SENT', user!.uid, resetEmail.trim());
      refreshSummary()
    } catch (error) {
      console.error('Password reset error (silenced):', error);
    } finally {
      toast({
        title: tr('admin.resetPassword.sent', 'Correu enviat'),
        description: tr('admin.resetPassword.sentDescription', 'Si l\'adreça existeix, rebrà un correu per restablir la contrasenya.'),
      });
      setResetEmail('');
      setIsResetting(false);
    }
  };

  const executeRegenerateDemo = async () => {
    if (!user) return;
    setShowSeedConfirm(false);
    setIsSeedingDemo(true);
    setSeedResult(null);

    try {
      const idToken = await user.getIdToken();

      const response = await fetch('/api/internal/demo/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ demoMode: selectedDemoMode }),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        setSeedResult({ ok: true, demoMode: data.demoMode, counts: data.counts });
        const countsStr = Object.entries(data.counts || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
        toast({
          title: tr('admin.health.demoRegenerated', 'Demo regenerada'),
          description: tr('admin.health.demoRegeneratedDesc', 'Mode: {mode}. Dades creades: {counts}')
            .replace('{mode}', data.demoMode)
            .replace('{counts}', countsStr),
        });
      } else {
        setSeedResult({ ok: false, error: data.error || tr('common.unknownError', 'Error desconegut') });
        toast({
          variant: 'destructive',
          title: tr('common.error', 'Error'),
          description: data.error || tr('admin.health.demoError', 'No s\'ha pogut regenerar la demo'),
        });
      }
      refreshSummary()
    } catch (error) {
      console.error('Error regenerant demo:', error);
      setSeedResult({ ok: false, error: (error as Error).message });
      toast({
        variant: 'destructive',
        title: tr('common.error', 'Error'),
        description: tr('admin.health.demoConnectionError', 'Error de connexió regenerant la demo'),
      });
    } finally {
      setIsSeedingDemo(false);
    }
  };

  const handleRegenerateDemo = () => {
    setShowSeedConfirm(true);
  };

  const handleDownloadBackup = async (orgId: string, orgName: string) => {
    if (!user) return;
    setBackupOrgId(orgId);

    try {
      const idToken = await user.getIdToken();

      const response = await fetch(`/api/admin/orgs/${orgId}/backup/local`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error descarregant backup');
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `backup_${orgId}.json`;

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: tr('admin.shell.backupDownloaded', 'Backup descarregat'),
        description: tr('admin.shell.backupDownloadedDesc', "S'ha descarregat el backup de {org}.").replace('{org}', orgName),
      });
    } catch (error) {
      console.error('Error descarregant backup:', error);
      toast({
        variant: 'destructive',
        title: tr('common.error', 'Error'),
        description: (error as Error).message || tr('admin.shell.backupError', 'No s\'ha pogut descarregar el backup.'),
      });
    } finally {
      setBackupOrgId(null);
    }
  };

  const handleViewFiscalPending = (org: AdminControlTowerSummary['entities'][number]) => {
    sessionStorage.setItem('adminViewingOrgId', org.id);
    const currentYear = new Date().getFullYear();
    router.push(`/${org.slug}/dashboard/movimientos?fiscal=pending&year=${currentYear}`);
  };

  const handleNotifyOrganization = async (org: AdminControlTowerSummary['entities'][number]) => {
    if (!user) return;

    const s9 = org.s9;
    if (!s9 || s9.pendingCount < 5) return;

    setNotifyingOrgId(org.id);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin-alerts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          orgId: org.id,
          type: 'fiscal_pending_review',
          payload: {
            pendingCount: s9.pendingCount,
            pendingAmountCents: s9.pendingAmountCents,
            year: s9.year,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No s\'ha pogut crear l\'avís');
      }

      toast({
        title: tr('admin.s9.notifyOrgSent', "Avís enviat a l'entitat"),
      });
      refreshSummary();
    } catch (error) {
      console.error('[admin] notify org fiscal alert error:', error);
      toast({
        variant: 'destructive',
        title: tr('common.error', 'Error'),
        description: (error as Error).message || tr('admin.s9.notifyOrgError', 'No s\'ha pogut enviar l\'avís'),
      });
    } finally {
      setNotifyingOrgId(null);
    }
  };

  const getStatusBadge = (status: AdminControlTowerSummary['entities'][number]['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 border-green-300">{tr('admin.orgStatus.active', 'Activa')}</Badge>;
      case 'suspended':
        return <Badge variant="destructive">{tr('admin.orgStatus.suspended', 'Suspesa')}</Badge>;
      case 'pending':
        return <Badge variant="secondary">{tr('admin.orgStatus.pending', 'Pendent')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAlertStatusBadge = (status: 'open' | 'read' | 'expired' | null) => {
    if (status === 'open') {
      return <Badge className="bg-green-100 text-green-800 border-green-300">{tr('admin.alertStatus.open', 'Obert')}</Badge>;
    }
    if (status === 'read') {
      return <Badge variant="secondary">{tr('admin.alertStatus.read', 'Llegit')}</Badge>;
    }
    if (status === 'expired') {
      return <Badge variant="outline">{tr('admin.alertStatus.expired', 'Caducat')}</Badge>;
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  };

  const cards = summary?.globalStatus.cards ?? []
  const entities = summary?.entities ?? []
  const kbSummary = summary?.kbBotSummary
  const communication = summary?.communicationSummary
  const blogSummary = summary?.blogSummary
  const incidentsCard = cards.find((card) => card.id === 'incidents')
  const contentCard = cards.find((card) => card.id === 'content')
  const openIncidentCount = incidentsCard?.count ?? 0
  const activeEntitiesCount = entities.filter((org) => org.status === 'active').length
  const suspendedEntitiesCount = entities.filter((org) => org.status === 'suspended').length
  const pendingEntitiesCount = entities.filter((org) => org.status === 'pending').length
  const contentPendingCount = communication?.pendingDrafts ?? 0
  const entitiesAreaStatus: ControlStatus =
    suspendedEntitiesCount > 0 || pendingEntitiesCount > 0 ? 'warning' : 'ok'
  const contentAreaStatus = combineStatuses(contentCard?.status, communication?.status)
  const summaryIsReady = Boolean(summary)
  const filteredEntities = entitySearch.trim()
    ? entities.filter((org) => {
        const term = entitySearch.trim().toLowerCase()
        return [org.name, org.slug, org.taxId]
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .some((value) => value.toLowerCase().includes(term))
      })
    : entities

  const overviewStatus: ControlStatus = combineStatuses(contentAreaStatus, entitiesAreaStatus)

  const overviewHeadline = !summaryIsReady && isSummaryLoading
    ? tr('admin.overview.loadingHeadline', 'Carregant visió general')
    : overviewStatus === 'warning'
        ? tr('admin.overview.warningHeadline', 'Hi ha alguns punts que convé revisar')
        : openIncidentCount > 0
          ? tr('admin.overview.stableWithIncidentsHeadline', 'La part visible està estable')
        : tr('admin.overview.stableHeadline', 'Tot està estable')

  const overviewDescription = !summaryIsReady && isSummaryLoading
    ? tr('admin.overview.loadingDescription', 'Estic preparant el resum del panell.')
    : overviewStatus === 'ok' && openIncidentCount > 0
      ? tr('admin.overview.okWithIncidentsDescription', 'No hi ha cap bloqueig visible important. A banda, hi ha {count} avís{countPlural} tècnic{techPlural} intern{internalPlural} per revisar, però no els estic tractant com una urgència des d’aquest resum.')
        .replace('{count}', String(openIncidentCount))
        .replace('{countPlural}', openIncidentCount === 1 ? '' : 'os')
        .replace('{techPlural}', openIncidentCount === 1 ? '' : 's')
        .replace('{internalPlural}', openIncidentCount === 1 ? '' : 's')
      : overviewStatus === 'ok'
        ? tr('admin.overview.okDescription', 'No hi ha cap bloqueig greu ni cap revisió urgent. Si vols, pots fer una repassada tranquil·la de contingut o entitats.')
      : tr('admin.overview.warningDescription', '{contentCount} punt{contentPlural} de contingut pendent{contentPendingPlural}, {entityCount} entitat{entityPlural} pendent{entityPendingPlural} i {suspendedCount} aturada{suspendedPlural} per revisar.')
        .replace('{contentCount}', String(contentPendingCount))
        .replace('{contentPlural}', contentPendingCount === 1 ? '' : 's')
        .replace('{contentPendingPlural}', contentPendingCount === 1 ? '' : 's')
        .replace('{entityCount}', String(pendingEntitiesCount))
        .replace('{entityPlural}', pendingEntitiesCount === 1 ? '' : 's')
        .replace('{entityPendingPlural}', pendingEntitiesCount === 1 ? '' : 's')
        .replace('{suspendedCount}', String(suspendedEntitiesCount))
        .replace('{suspendedPlural}', suspendedEntitiesCount === 1 ? '' : 's')

  const pendingReviewCount =
    contentPendingCount +
    pendingEntitiesCount +
    suspendedEntitiesCount

  const latestPublishedEntry = communication?.latestPublished?.[0] ?? null
  const latestPublishedLabel = latestPublishedEntry?.title ?? tr('admin.overview.noRecentUpdate', 'Cap novetat recent')

  const overviewActions: OverviewAction[] = []

  if (contentPendingCount > 0) {
    overviewActions.push({
      id: 'content-pending',
      title: tr('admin.overview.actions.contentPending.title', 'Revisar blog i novetats'),
      description: tr('admin.overview.actions.contentPending.description', 'Hi ha propostes o peces editorials pendents de tancar.'),
      cta: tr('admin.overview.actions.contentPending.cta', 'Obrir blog i novetats'),
      area: 'content',
      tone: contentAreaStatus,
      contentModule: 'novetats',
      section: 'novetats',
    })
  }

  if (pendingEntitiesCount > 0 || suspendedEntitiesCount > 0) {
    overviewActions.push({
      id: 'entities-followup',
      title: tr('admin.overview.actions.entities.title', 'Revisar entitats'),
      description: tr('admin.overview.actions.entities.description', 'Hi ha entitats pendents o aturades que poden requerir una decisió teva.'),
      cta: tr('admin.overview.actions.entities.cta', 'Obrir entitats'),
      area: 'entities',
      tone: entitiesAreaStatus,
    })
  }

  if (openIncidentCount > 0) {
    overviewActions.push({
      id: 'open-incidents',
      title: tr('admin.overview.actions.incidents.title', 'Revisar avisos tècnics'),
      description: tr('admin.overview.actions.incidents.description', 'Hi ha avisos interns o de manteniment. Revisa’ls quan et vagi bé, sense barrejar-los amb la part visible.'),
      cta: tr('admin.overview.actions.incidents.cta', 'Obrir incidències i manteniment'),
      area: 'technical',
      tone: 'warning',
      section: 'incidents',
    })
  }

  if (overviewActions.length === 0) {
    overviewActions.push({
      id: 'all-good',
      title: tr('admin.overview.actions.allGood.title', 'No hi ha cap punt urgent'),
      description: tr('admin.overview.actions.allGood.description', 'Pots entrar a blog i novetats o entitats si vols fer una revisió tranquil·la.'),
      cta: tr('admin.overview.actions.allGood.cta', 'Veure blog i novetats'),
      area: 'content',
      tone: 'ok',
      contentModule: 'blog',
    })
  }

  const contentEntryCards: Array<{
    id: ContentModule
    title: string
    summary: string
    icon: React.ReactNode
  }> = [
    {
      id: 'blog',
      title: tr('admin.content.blogTitle', 'Blog'),
      summary: blogSummary?.latestPublished?.[0]?.title ?? tr('admin.content.blogSummary', 'Articles i cua editorial del blog'),
      icon: <BookOpenText className="h-4 w-4" />,
    },
    {
      id: 'novetats',
      title: tr('admin.content.updatesTitle', 'Novetats'),
      summary: latestPublishedEntry ? latestPublishedEntry.title : tr('admin.content.updatesSummary', 'Historial visible per als usuaris'),
      icon: <Megaphone className="h-4 w-4" />,
    },
  ]

  const guidedEntries: Array<{
    id: string
    title: string
    description: string
    cta: string
    area: AdminArea
    contentModule?: ContentModule
    section?: string
  }> = [
    {
      id: 'guided-blog',
      title: tr('admin.guided.blog.title', 'Vull revisar el blog'),
      description: tr('admin.guided.blog.description', 'Entra aquí si vols veure esborranys, cua editorial o últims articles publicats.'),
      cta: tr('admin.guided.blog.cta', 'Obrir blog'),
      area: 'content',
      contentModule: 'blog',
      section: 'blog',
    },
    {
      id: 'guided-bot',
      title: tr('admin.guided.bot.title', 'El bot no respon bé'),
      description: tr('admin.guided.bot.description', 'Aquí pots veure si hi ha consultes repetides o si el bot està mostrant mancances d’ajuda.'),
      cta: tr('admin.guided.bot.cta', 'Obrir bot i manteniment'),
      area: 'technical',
      section: 'bot-support',
    },
    {
      id: 'guided-incidents',
      title: tr('admin.guided.incidents.title', 'Tinc un problema tècnic'),
      description: tr('admin.guided.incidents.description', 'Entra només si hi ha una incidència real o un bloqueig que cal seguir.'),
      cta: tr('admin.guided.incidents.cta', 'Obrir incidències'),
      area: 'technical',
      section: 'incidents',
    },
    {
      id: 'guided-updates',
      title: tr('admin.guided.updates.title', 'Vull revisar una novetat'),
      description: tr('admin.guided.updates.description', 'Primer mira quines novetats ja són visibles i si hi ha propostes pendents.'),
      cta: tr('admin.guided.updates.cta', 'Veure novetats'),
      area: 'content',
      contentModule: 'novetats',
      section: 'novetats',
    },
  ]

  const renderEntityMoreMenu = (
    org: AdminControlTowerSummary['entities'][number],
    trigger: React.ReactNode
  ) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleCopyOrganization(org)}>
          <Copy className="mr-2 h-4 w-4" />
          {tr('admin.entities.copyPublicUrl', 'Copiar URL pública')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleDownloadBackup(org.id, org.name)}
          disabled={backupOrgId === org.id}
        >
          {backupOrgId === org.id ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {tr('admin.entities.localBackup', 'Backup local JSON')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setSuspendDialogOrg(org)}
          className={org.status === 'suspended' ? 'text-green-600' : 'text-destructive'}
        >
          {org.status === 'suspended' ? (
            <>
              <Play className="mr-2 h-4 w-4" />
              {tr('admin.shell.reactivate', 'Reactivar')}
            </>
          ) : (
            <>
              <Pause className="mr-2 h-4 w-4" />
              {tr('admin.shell.suspend', 'Suspendre')}
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1580px] px-5 py-6 sm:px-6 lg:px-8">
      <main className="space-y-8">
        {summaryError && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="pt-6 text-sm text-red-700">
              {summaryError}
            </CardContent>
          </Card>
        )}

        <Tabs
          value={area}
          className="space-y-6"
        >
          <TabsContent value="overview" className="space-y-8">
            <Card className={statusClasses(overviewStatus)}>
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={statusBadgeVariant(overviewStatus)}>{humanStatusLabel(overviewStatus, tr)}</Badge>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{tr('admin.overview.todaySummary', 'Resum d’avui')}</span>
                    </div>
                    <CardTitle className="text-2xl">{overviewHeadline}</CardTitle>
                    <CardDescription className="max-w-3xl text-sm text-foreground/75">
                      {overviewDescription}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>{tr('admin.overview.activeEntitiesCard', 'Entitats actives')}</CardDescription>
                  <CardTitle className="text-2xl">{activeEntitiesCount}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  {tr('admin.overview.activeEntitiesCardDesc', '{count} registrades en total.').replace('{count}', String(entities.length))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>{tr('admin.overview.pendingCard', 'Pendents visibles')}</CardDescription>
                  <CardTitle className="text-2xl">{pendingReviewCount}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  {tr('admin.overview.pendingCardDesc', 'Contingut i entitats que convé revisar.')}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>{tr('admin.overview.latestUpdateCard', 'Última novetat publicada')}</CardDescription>
                  <CardTitle className="text-xl leading-tight">{latestPublishedLabel}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  {formatDateForAdmin(communication?.latestPublishedAt ?? null)}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>{tr('admin.overview.incidentsCard', 'Avisos tècnics')}</CardDescription>
                  <CardTitle className="text-2xl">{openIncidentCount}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  {tr('admin.overview.incidentsCardDesc', 'Revisió interna. No sempre implica un problema real.')}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <AreaSectionHeader
                title={tr('admin.overview.actionsSectionTitle', 'Què cal fer ara')}
                description={tr('admin.overview.actionsSectionDescription', 'Accions prioritzades per evitar que hagis d’interpretar tot el panell.')}
              />
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {overviewActions.map((action) => (
                  <Card key={action.id} className={statusClasses(action.tone)}>
                    <CardHeader className="space-y-2">
                      <CardTitle className="text-base">{action.title}</CardTitle>
                      <CardDescription className="text-sm text-foreground/75">
                        {action.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Button
                        variant="ghost"
                        className="px-0 text-sm"
                        onClick={() => {
                          if (action.contentModule) {
                            openContentModule(action.contentModule, action.section)
                            return
                          }
                          openArea(action.area, action.section)
                        }}
                      >
                        {action.cta}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <AreaSectionHeader
                  title={tr('admin.overview.guidedSectionTitle', 'On haig d’entrar?')}
                  description={tr('admin.overview.guidedSectionDescription', 'Accessos directes per quan tens un dubte concret i no vols pensar on toca anar.')}
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {guidedEntries.map((entry) => (
                    <Card key={entry.id}>
                      <CardHeader className="space-y-2">
                        <CardTitle className="text-base">{entry.title}</CardTitle>
                        <CardDescription>{entry.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Button
                          variant="ghost"
                          className="px-0 text-sm"
                          onClick={() => {
                            if (entry.contentModule) {
                              openContentModule(entry.contentModule, entry.section)
                              return
                            }
                            openArea(entry.area, entry.section)
                          }}
                        >
                          {entry.cta}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <AreaSectionHeader
                  title={tr('admin.content.latestChangesTitle', 'Últims canvis visibles')}
                  description={tr('admin.content.latestChangesDescription', 'El que ja està publicat o visible per als usuaris.')}
                />
                <Card>
                  <CardContent className="space-y-3 pt-6">
                    {(communication?.latestPublished ?? []).length > 0 ? (
                      communication?.latestPublished.map((item) => (
                        <div key={item.id} className="rounded-lg border px-4 py-3">
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Publicada el {formatDateForAdmin(item.publishedAt)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Encara no hi ha novetats publicades per mostrar aqui.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="entities" className="space-y-8">
            <AreaSectionHeader
              title={tr('admin.entities.title', 'Entitats')}
              description={tr('admin.entities.description', 'Aquí veus quines entitats requereixen una acció teva i pots entrar-hi sense voltar per opcions tècniques.')}
              action={<Button onClick={() => setIsCreateDialogOpen(true)}>{tr('admin.entities.new', 'Nova entitat')}</Button>}
            />

            <Card>
              <CardContent className="flex flex-col gap-4 pt-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-lg font-semibold">{tr('admin.entities.registeredCount', '{count} entitat{plural} registrades').replace('{count}', String(entities.length)).replace('{plural}', entities.length === 1 ? '' : 's')}</p>
                  <p className="text-sm text-muted-foreground">
                    {tr('admin.entities.statusSummary', '{active} actives · {suspended} suspeses · {pending} pendents')
                      .replace('{active}', String(activeEntitiesCount))
                      .replace('{suspended}', String(suspendedEntitiesCount))
                      .replace('{pending}', String(pendingEntitiesCount))}
                  </p>
                </div>
                <div className="w-full lg:max-w-sm">
                  <Input
                    value={entitySearch}
                    onChange={(e) => setEntitySearch(e.target.value)}
                    placeholder={tr('admin.entities.searchPlaceholder', 'Cerca per nom, slug o CIF')}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                {isMobile ? (
                  <div className="flex flex-col gap-2">
                    {filteredEntities.length > 0 ? (
                      filteredEntities.map((org) => (
                        <MobileListItem
                          key={org.id}
                          title={org.name}
                          leadingIcon={<Building2 className="h-4 w-4" />}
                          badges={[getStatusBadge(org.status)]}
                          meta={[
                            { label: tr('admin.entities.createdLabel', 'Alta'), value: formatDateForAdmin(org.createdAt) },
                            { label: tr('admin.entities.activityLabel', 'Activitat'), value: formatRelativeActivity(org.lastActivityAt) },
                          ]}
                          actions={renderEntityMoreMenu(
                            org,
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          )}
                          onClick={() => handleEnterOrganization(org)}
                        />
                      ))
                    ) : (
                      <p className="py-12 text-center text-muted-foreground">
                        {entitySearch.trim() ? tr('admin.entities.noSearchResults', 'No hi ha cap entitat que coincideixi amb la cerca.') : tr('admin.entities.empty', 'Sense entitats disponibles.')}
                      </p>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tr('admin.entities.table.name', 'Nom')}</TableHead>
                        <TableHead>{tr('admin.entities.table.status', 'Estat')}</TableHead>
                        <TableHead>{tr('admin.entities.table.created', 'Alta')}</TableHead>
                        <TableHead>{tr('admin.entities.table.lastActivity', 'Última activitat')}</TableHead>
                        <TableHead>{tr('admin.entities.table.actions', 'Accions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntities.length > 0 ? (
                        filteredEntities.map((org) => (
                          <TableRow key={org.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <div className="font-medium">{org.name}</div>
                                  <div className="text-xs text-muted-foreground">/{org.slug}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(org.status)}</TableCell>
                            <TableCell>{formatDateForAdmin(org.createdAt)}</TableCell>
                            <TableCell>{formatRelativeActivity(org.lastActivityAt)}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-1">
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleEnterOrganization(org)}>
                                  {tr('admin.entities.enter', 'Entrar')}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => {
                                    sessionStorage.setItem('adminViewingOrgId', org.id);
                                    router.push(`/${org.slug}/dashboard/movimientos`);
                                  }}
                                >
                                  {tr('admin.entities.movements', 'Moviments')}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => {
                                    sessionStorage.setItem('adminViewingOrgId', org.id);
                                    router.push(`/${org.slug}/dashboard/configuracion`);
                                  }}
                                >
                                  {tr('admin.entities.config', 'Configuració')}
                                </Button>
                                {renderEntityMoreMenu(
                                  org,
                                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                                    <MoreHorizontal className="mr-1 h-3.5 w-3.5" />
                                    {tr('admin.entities.more', 'Més')}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                            {entitySearch.trim() ? tr('admin.entities.noSearchResults', 'No hi ha cap entitat que coincideixi amb la cerca.') : tr('admin.entities.empty', 'Sense entitats disponibles.')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Separator />

            <div className="space-y-4">
              <AreaSectionHeader
                title={tr('admin.s9.title', 'Coherència fiscal real (S9)')}
                description={tr('admin.s9.description', 'Ingressos assignats que no estan comptant fiscalment aquest any.')}
              />
              <Card>
                <CardContent className="pt-6">
                  {isMobile ? (
                    <div className="space-y-3">
                      {entities.length > 0 ? (
                        entities.map((org) => {
                          const s9 = org.s9;
                          const amountLabel = currencyFormatter.format((s9?.pendingAmountCents ?? 0) / 100);
                          const pendingSummary = tri('admin.s9.pendingSummary', {
                            count: s9?.pendingCount ?? 0,
                            amount: amountLabel,
                            year: s9?.year ?? new Date().getFullYear(),
                          });

                          return (
                            <Card key={`s9-mobile-${org.id}`}>
                              <CardContent className="space-y-3 pt-4">
                                <div className="flex items-center gap-2">
                                  <Scale className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <div className="font-medium">{org.name}</div>
                                    <div className="text-xs text-muted-foreground">/{org.slug}</div>
                                  </div>
                                </div>
                                <p className="text-sm font-medium">{pendingSummary}</p>
                                <div className="space-y-1">
                                  <p className="text-sm">{s9?.diagnosisTextCa ?? tr('admin.s9.noDiagnosis', 'Sense diagnòstic')}</p>
                                  <p className="text-xs text-muted-foreground">{s9?.actionTextCa ?? ''}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => handleViewFiscalPending(org)}
                                  >
                                    {tr('admin.s9.viewPendingCta', 'Veure ingressos que no compten fiscalment')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    disabled={(s9?.pendingCount ?? 0) < 5 || notifyingOrgId === org.id}
                                    onClick={() => handleNotifyOrganization(org)}
                                  >
                                    {notifyingOrgId === org.id ? (
                                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Send className="mr-1.5 h-3.5 w-3.5" />
                                    )}
                                    {tr('admin.s9.notifyOrgCta', 'Enviar avís a l’entitat')}
                                  </Button>
                                </div>
                                <div>{getAlertStatusBadge(s9?.alertStatus ?? null)}</div>
                              </CardContent>
                            </Card>
                          );
                        })
                      ) : (
                        <p className="py-12 text-center text-muted-foreground">{tr('admin.entities.empty', 'Sense entitats disponibles.')}</p>
                      )}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tr('admin.s9.table.entity', 'Entitat')}</TableHead>
                          <TableHead>{tr('admin.s9.table.pending', 'Pendents fiscals')}</TableHead>
                          <TableHead>{tr('admin.s9.table.diagnosis', 'Diagnòstic')}</TableHead>
                          <TableHead>{tr('admin.s9.table.actions', 'Accions')}</TableHead>
                          <TableHead>{tr('admin.s9.table.alert', 'Avís')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entities.length > 0 ? (
                          entities.map((org) => {
                            const s9 = org.s9;
                            const amountLabel = currencyFormatter.format((s9?.pendingAmountCents ?? 0) / 100);
                            const pendingSummary = tri('admin.s9.pendingSummary', {
                              count: s9?.pendingCount ?? 0,
                              amount: amountLabel,
                              year: s9?.year ?? new Date().getFullYear(),
                            });

                            return (
                              <TableRow key={`s9-${org.id}`}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Scale className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                      <div className="font-medium">{org.name}</div>
                                      <div className="text-xs text-muted-foreground">/{org.slug}</div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">{pendingSummary}</TableCell>
                                <TableCell>
                                  <p className="text-sm">{s9?.diagnosisTextCa ?? tr('admin.s9.noDiagnosis', 'Sense diagnòstic')}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">{s9?.actionTextCa ?? ''}</p>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col items-start gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => handleViewFiscalPending(org)}
                                    >
                                      {tr('admin.s9.viewPendingCta', 'Veure ingressos que no compten fiscalment')}
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      disabled={(s9?.pendingCount ?? 0) < 5 || notifyingOrgId === org.id}
                                      onClick={() => handleNotifyOrganization(org)}
                                    >
                                      {notifyingOrgId === org.id ? (
                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Send className="mr-1.5 h-3.5 w-3.5" />
                                      )}
                                      {tr('admin.s9.notifyOrgCta', 'Enviar avís a l’entitat')}
                                    </Button>
                                  </div>
                                </TableCell>
                                <TableCell>{getAlertStatusBadge(s9?.alertStatus ?? null)}</TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                              {tr('admin.entities.empty', 'Sense entitats disponibles.')}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-8">
                <AreaSectionHeader
                  title={tr('admin.content.title', 'Blog i Novetats')}
                  description={tr('admin.content.description', 'Aquí gestiones el blog públic i les novetats visibles.')}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {contentEntryCards.map((card) => (
                <Card key={card.id} className={activeContentModule === card.id ? 'ring-1 ring-foreground/15' : ''}>
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-base">
                          {card.icon}
                          {card.title}
                        </CardTitle>
                        <CardDescription>{card.summary}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button variant="ghost" className="px-0 text-sm" onClick={() => openContentModule(card.id)}>
                      {tr('admin.content.open', 'Obrir')}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {activeContentModule === 'blog' && (
              <div className="space-y-6">
                <AreaSectionHeader
                  title={tr('admin.content.blogHeaderTitle', 'Blog')}
                  description={tr('admin.content.blogHeaderDescription', 'Articles, esborranys i cua editorial del blog.')}
                />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{tr('admin.content.blogQueueTitle', 'Cua editorial del blog')}</CardTitle>
                      <CardDescription>{tr('admin.content.blogQueueDescription', 'Resum del que hi ha en preparació o pendent de validació.')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="rounded-lg border px-4 py-3">
                        <p className="text-sm font-medium text-foreground">
                          {blogSummary?.queue?.available
                            ? `${blogSummary.queue.draftReady} preparat${blogSummary.queue.draftReady === 1 ? '' : 's'} per revisar`
                            : tr('admin.content.blogQueueMissing', 'Cua editorial no connectada en aquest entorn')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {blogSummary?.queue?.available
                            ? `${blogSummary.queue.pendingApproval} pendent${blogSummary.queue.pendingApproval === 1 ? '' : 's'} d’aprovació · ${blogSummary.queue.approved} aprovat${blogSummary.queue.approved === 1 ? '' : 's'}`
                            : tr('admin.content.blogQueueMissingDetail', 'Quan la cua runtime existeixi, aquí veuràs l’estat real.')}
                        </p>
                      </div>
                      <Button variant="ghost" className="px-0 text-sm" onClick={() => openContentModule('blog')}>
                        {tr('admin.content.blogOpen', 'Obrir blog')}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{tr('admin.content.blogRecentTitle', 'Últims articles del blog')}</CardTitle>
                      <CardDescription>{tr('admin.content.blogRecentDescription', 'Els últims publicats o preparats dins del pipeline editorial.')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {(blogSummary?.latestPublished ?? []).length > 0 ? (
                        blogSummary?.latestPublished.map((item) => (
                          <div key={item.id} className="rounded-lg border px-4 py-3">
                            <p className="font-medium">{item.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {tr('admin.content.blogPublishedOn', 'Publicat el {date}').replace('{date}', formatDateForAdmin(item.publishedAt))}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {tr('admin.content.blogNoPublished', 'Encara no hi ha articles publicats.')}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeContentModule === 'novetats' && (
              <div className="space-y-6">
                <AreaSectionHeader
                  title={tr('admin.content.updatesHeaderTitle', 'Novetats')}
                  description={tr('admin.content.updatesHeaderDescription', 'Vista de les novetats visibles per als usuaris.')}
                />
                <Card>
                  <CardContent className="pt-6 text-sm text-muted-foreground">
                    {tr('admin.content.updatesHint', 'Utilitza aquest espai per entendre què està publicat i revisar casos especials.')}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{tr('admin.content.updatesVisibleNowTitle', 'Novetats visibles ara mateix')}</CardTitle>
                    <CardDescription>{tr('admin.content.updatesVisibleNowDescription', 'El que ja s’està mostrant als usuaris o s’ha publicat fa poc.')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(communication?.latestPublished ?? []).length > 0 ? (
                      communication?.latestPublished.map((item) => (
                        <div key={item.id} className="rounded-lg border px-4 py-3">
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {tr('admin.content.publishedOn', 'Publicada el {date}').replace('{date}', formatDateForAdmin(item.publishedAt))}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {tr('admin.content.noPublishedUpdates', 'Encara no hi ha novetats publicades.')}
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-sm text-muted-foreground">
                    {tr('admin.content.updatesFooter', 'Aquest espai es queda només com a lectura del que ja es veu publicat.')}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="technical" className="space-y-8">
            <AreaSectionHeader
              title={tr('admin.technical.title', 'Incidències i manteniment')}
              description={tr('admin.technical.description', 'Aquesta part és només per problemes tècnics, comprovacions i accions sensibles. No cal entrar-hi si la vista general no t’ho demana.')}
              action={
                <Button variant="outline" onClick={refreshSummary} disabled={isSummaryLoading}>
                  {isSummaryLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {tr('admin.technical.refresh', 'Actualitzar dades')}
                </Button>
              }
            />

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {tr('admin.technical.warningBanner', 'Entra aquí només quan hi ha un bloqueig real, un dubte amb el bot o una operació sensible.')}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className={statusClasses(incidentsCard?.status ?? 'ok')} data-section="incidents">
                <CardHeader>
                  <CardTitle className="text-base">{tr('admin.technical.incidentsTitle', 'Avisos tècnics')}</CardTitle>
                  <CardDescription>{tr('admin.technical.incidentsDescription', 'Aquests avisos poden ser interns o de manteniment, no sempre incidències reals.')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-lg font-semibold">
                    {tr('admin.technical.incidentsCount', '{count} avís{plural}').replace('{count}', String(openIncidentCount)).replace('{plural}', openIncidentCount === 1 ? '' : 'os')}
                  </p>
                  <Badge variant={statusBadgeVariant(incidentsCard?.status ?? 'ok')}>
                    {humanStatusLabel(incidentsCard?.status ?? 'ok', tr)}
                  </Badge>
                </CardContent>
              </Card>

              <Card data-section="bot-support">
                <CardHeader>
                  <CardTitle className="text-base">{tr('admin.technical.botTitle', 'Bot')}</CardTitle>
                  <CardDescription>{tr('admin.technical.botDescription', 'Activitat i temes que poden indicar mancances d’ajuda.')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-lg font-semibold">{tr('admin.technical.botTotal', '{count} preguntes totals').replace('{count}', String(kbSummary?.botTotalQuestions ?? 0))}</p>
                  <p className="text-sm text-muted-foreground">{tr('admin.technical.botToday', '{count} avui').replace('{count}', String(kbSummary?.botTodayQuestions ?? 0))}</p>
                  <p className="text-xs text-muted-foreground">
                    {tr('admin.technical.kbUpdatedAt', 'Darrera actualització coneguda: {date}').replace('{date}', formatDateForAdmin(kbSummary?.kbUpdatedAt ?? null))}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <AreaSectionHeader
                title={tr('admin.technical.botQueriesTitle', 'Bot i consultes')}
                description={tr('admin.technical.botQueriesDescription', 'Quan sospites que el bot no ajuda prou, mira primer l’activitat i els temes repetits abans d’anar al detall intern.')}
              />
              <Card>
                <CardContent className="grid grid-cols-1 gap-4 pt-6 md:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{tr('admin.technical.recentActivityLabel', 'Activitat recent')}</p>
                    <p className="mt-1 text-sm font-semibold">{tr('admin.technical.todayQuestions', '{count} consultes avui').replace('{count}', String(kbSummary?.botTodayQuestions ?? 0))}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{tr('admin.technical.frequentTopicsLabel', 'Temes freqüents')}</p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {(kbSummary?.topTopics ?? []).length > 0 ? (
                        (kbSummary?.topTopics ?? []).map((topic) => (
                          <li key={topic.topic}>• {topic.topic}</li>
                        ))
                      ) : (
                        <li className="text-muted-foreground">{tr('admin.technical.noData', 'Sense dades')}</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{tr('admin.technical.internalContractLabel', 'Contracte intern')}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {tr('admin.technical.internalContractDescription', 'El bot opera amb la KB versionada del repositori. Aquest detall es manté aquí per no contaminar la vista principal.')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <AreaSectionHeader
                title={tr('admin.technical.internalAdminTitle', 'Administració interna')}
                description={tr('admin.technical.internalAdminDescription', 'Accessos i operacions internes que poden tenir impacte estructural.')}
              />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Mail className="h-4 w-4" />
                    {tr('admin.resetPassword.title', 'Reset contrasenya')}
                  </CardTitle>
                  <CardDescription>
                    {tr('admin.resetPassword.description', "Envia un correu per restablir la contrasenya d'un usuari")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="email"
                      placeholder={tr('admin.resetPassword.placeholder', 'email@exemple.com')}
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      disabled={isResetting}
                    />
                    <Button onClick={handlePasswordReset} disabled={isResetting || !resetEmail.trim()}>
                      {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {tr('admin.resetPassword.send', 'Enviar correu')}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-4 pt-6">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={handleMigrateSlugs} disabled={isMigrating}>
                      {isMigrating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {tr('admin.migrations.slugs', 'Migrar slugs')}
                    </Button>
                  </div>

                  {isDemoEnv() && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-amber-900">{tr('admin.health.demoEnv', 'Entorn DEMO')}</p>
                        <p className="text-sm text-amber-800">
                          {tr('admin.health.demoDescription', 'Estàs treballant amb dades de demostració. Les accions aquí no afecten producció.')}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant={selectedDemoMode === 'short' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedDemoMode('short')}
                            disabled={isSeedingDemo}
                          >
                            {tr('admin.health.demoShortMode', 'Short')}
                          </Button>
                          <Button
                            variant={selectedDemoMode === 'work' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedDemoMode('work')}
                            disabled={isSeedingDemo}
                          >
                            {tr('admin.health.demoWorkMode', 'Work')}
                          </Button>
                          <span className="text-xs text-amber-700">
                            {selectedDemoMode === 'short'
                              ? tr('admin.health.demoShort', 'Dades netes per vídeos i pitch')
                              : tr('admin.health.demoWork', 'Dades amb anomalies per validar workflows')}
                          </span>
                        </div>
                        <Button onClick={handleRegenerateDemo} disabled={isSeedingDemo} variant="outline">
                          {isSeedingDemo ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {tr('admin.health.regenerating', 'Regenerant...')}
                            </>
                          ) : (
                            <>
                              <Play className="mr-2 h-4 w-4" />
                              {tr('admin.health.regenerateDemo', 'Regenerar demo')}
                            </>
                          )}
                        </Button>
                        {seedResult && (
                          <div className={`rounded-lg p-3 text-sm ${seedResult.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {seedResult.ok ? (
                              <span>{tr('admin.health.seedCompleted', 'Seed completat ({mode})').replace('{mode}', String(seedResult.demoMode ?? ''))}</span>
                            ) : (
                              <span>{tr('admin.health.seedError', 'Error: {error}').replace('{error}', seedResult.error ?? '')}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
              <SuperAdminsManager />
            </div>

            <div className="space-y-4">
              <AreaSectionHeader
                title={tr('admin.technical.toolsTitle', 'Eines tècniques')}
                description={tr('admin.technical.toolsDescription', 'Accessos ràpids a consola, logs i documentació de suport.')}
              />
              <Card>
                <CardContent className="grid gap-3 pt-6 md:grid-cols-3">
                  <a
                    href="https://console.firebase.google.com/project/summa-social/overview"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-muted/50"
                  >
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    {tr('admin.technical.firebaseConsole', 'Firebase Console')}
                  </a>
                  <a
                    href="https://console.cloud.google.com/logs/query?project=summa-social"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-muted/50"
                  >
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    {tr('admin.technical.cloudLogging', 'Cloud Logging')}
                  </a>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-lg border px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50"
                    onClick={() => {
                      navigator.clipboard.writeText('docs/DEV-SOLO-MANUAL.md');
                      toast({ title: tr('admin.health.copiedToClipboard', 'Copiat al porta-retalls') });
                    }}
                  >
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    {tr('admin.technical.supportManual', 'Manual de suport')}
                  </button>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <AreaSectionHeader
                title={tr('admin.updates.title', 'Activitat SuperAdmin')}
                description={tr('admin.updates.description', 'Últimes accions registrades')}
              />
              <Card>
                <CardContent>
                  {isLoadingAudit ? (
                    <div className="flex items-center gap-2 pt-6 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {tr('common.loading', 'Carregant...')}
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <p className="pt-6 text-sm text-muted-foreground">{tr('admin.updates.noActions', 'Cap acció registrada encara.')}</p>
                  ) : (
                    <div className="space-y-2 pt-6">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between border-b pb-2 text-sm last:border-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs font-mono">
                              {formatAuditAction(log.action)}
                            </Badge>
                            {log.target && (
                              <span className="font-mono text-xs text-muted-foreground">{log.target}</span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {log.timestamp.toLocaleDateString('ca-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <CreateOrganizationDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      <AlertDialog open={!!suspendDialogOrg} onOpenChange={() => setSuspendDialogOrg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {suspendDialogOrg?.status === 'suspended'
                ? tr('admin.shell.reactivateTitle', 'Reactivar organització?')
                : tr('admin.shell.suspendTitle', 'Suspendre organització?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {suspendDialogOrg?.status === 'suspended'
                ? tr('admin.shell.reactivateDesc', 'L\'organització "{org}" tornarà a estar activa i els seus membres podran accedir-hi.').replace('{org}', suspendDialogOrg?.name ?? '')
                : tr('admin.shell.suspendDesc', 'L\'organització "{org}" quedarà suspesa i els seus membres no podran accedir-hi.').replace('{org}', suspendDialogOrg?.name ?? '')
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>{tr('common.cancel', 'Cancel·lar')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => suspendDialogOrg && handleToggleSuspend(suspendDialogOrg)}
              disabled={isProcessing}
              className={suspendDialogOrg?.status === 'suspended' ? '' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'}
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {suspendDialogOrg?.status === 'suspended' ? tr('admin.shell.reactivate', 'Reactivar') : tr('admin.shell.suspend', 'Suspendre')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showSeedConfirm} onOpenChange={setShowSeedConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-amber-800">
              {tr('admin.health.confirmRegenTitle', 'Regenerar dades demo ({mode})?').replace('{mode}', selectedDemoMode)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tr('admin.health.confirmRegenDesc', 'Aquesta acció esborrarà totes les dades de demostració existents i en crearà de noves.')}
              <br /><br />
              <strong>{tr('admin.health.selectedMode', 'Mode seleccionat:')}</strong>{' '}
              {selectedDemoMode === 'short'
                ? tr('admin.health.shortModeDesc', 'Short — Dades netes per vídeos i pitch')
                : tr('admin.health.workModeDesc', 'Work — Dades amb anomalies per validar workflows reals')}
              <br /><br />
              <strong>{tr('admin.health.onlyDemo', "Només afecta l'organització demo (slug: demo). Cap dada de producció serà modificada.")}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr('common.cancel', 'Cancel·lar')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeRegenerateDemo}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {tr('admin.health.regenerateDemo', 'Regenerar demo')} ({selectedDemoMode})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
