'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useTranslations } from '@/i18n';
import { browserLocalPersistence, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Shield,
  Building2,
  MoreHorizontal,
  Pause,
  Play,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Mail,
  ExternalLink,
  FileText,
  Lock,
  History,
  Download,
  RefreshCw,
  Copy,
  Megaphone,
  Wrench,
  Scale,
  Send,
  BrainCircuit,
  Languages,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { MobileListItem } from '@/components/mobile/mobile-list-item';
import { CreateOrganizationDialog } from '@/components/admin/create-organization-dialog';
import { SystemHealth } from '@/components/admin/system-health';
import { ProductUpdatesSection } from '@/components/admin/product-updates-section';
import { I18nManager } from '@/components/super-admin/i18n-manager';
import { broadcastLogoutSync } from '@/lib/session-sync';
import { HelpAuditSection } from '@/components/admin/help-audit-section';
import { SuperAdminsManager } from '@/components/admin/super-admins-manager';
import { EditorialCenter } from '@/components/admin/editorial-center';
import { migrateExistingSlugs } from '@/lib/slugs';
import { logAdminAction, getRecentAuditLogs, formatAuditAction, type AdminAuditLog } from '@/lib/admin-audit';
import { isDemoEnv } from '@/lib/demo/isDemoOrg';
import { isAllowlistedSuperAdmin } from '@/lib/admin/superadmin-allowlist';
import { ensureSuperAdminRegistry } from '@/lib/admin/ensure-superadmin-registry';
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

type AdminArea = 'system' | 'entities' | 'content' | 'settings'
type ContentModule = 'help' | 'bot' | 'updates' | 'translations'
type AdminNavigationDetail = {
  area?: AdminArea
  contentModule?: ContentModule
  section?: string
}

function combineStatuses(...statuses: Array<ControlStatus | null | undefined>): ControlStatus {
  if (statuses.includes('critical')) return 'critical'
  if (statuses.includes('warning')) return 'warning'
  return 'ok'
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

function AdminPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, firestore, auth, isUserLoading } = useFirebase();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { t, tr, language } = useTranslations();
  const reason = searchParams.get('reason');

  const [isSuperAdmin, setIsSuperAdmin] = React.useState<boolean | null>(null);
  const [superAdminCheckDone, setSuperAdminCheckDone] = React.useState(false);
  const [registryError, setRegistryError] = React.useState<string | null>(null);

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

  const [loginEmail, setLoginEmail] = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [loginError, setLoginError] = React.useState('');

  const [auditLogs, setAuditLogs] = React.useState<AdminAuditLog[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = React.useState(false);

  const [isSeedingDemo, setIsSeedingDemo] = React.useState(false);
  const [seedResult, setSeedResult] = React.useState<{ ok: boolean; demoMode?: string; counts?: Record<string, number>; error?: string } | null>(null);
  const [showSeedConfirm, setShowSeedConfirm] = React.useState(false);
  const [selectedDemoMode, setSelectedDemoMode] = React.useState<'short' | 'work'>('short');

  const [backupOrgId, setBackupOrgId] = React.useState<string | null>(null);
  const [notifyingOrgId, setNotifyingOrgId] = React.useState<string | null>(null);
  const [activeArea, setActiveArea] = React.useState<AdminArea>('system');
  const [activeContentModule, setActiveContentModule] = React.useState<ContentModule>('help');
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

  React.useEffect(() => {
    if (!user) {
      setIsSuperAdmin(null);
      setSuperAdminCheckDone(false);
      setRegistryError(null);
      return;
    }

    const isAllowed = isAllowlistedSuperAdmin(user.email);

    if (!isAllowed) {
      setIsSuperAdmin(false);
      setSuperAdminCheckDone(true);
      return;
    }

    const setupAccess = async () => {
      try {
        const result = await ensureSuperAdminRegistry(firestore, user.uid, user.email!);
        if (!result.success) {
          setRegistryError(result.error || 'No s\'ha pogut preparar l\'accés');
          console.warn('[admin] Error alineant registre, però allowlisted:', result.error);
        }
        setIsSuperAdmin(true);
      } catch (error) {
        console.error('[admin] Error inesperat:', error);
        setRegistryError((error as Error).message);
        setIsSuperAdmin(true);
      } finally {
        setSuperAdminCheckDone(true);
      }
    };

    setupAccess();
  }, [user, firestore]);

  const refreshSummary = React.useCallback(() => {
    setSummaryRefreshToken((prev) => prev + 1)
  }, [])

  const openArea = React.useCallback((area: AdminArea) => {
    setActiveArea(area)
  }, [])

  const openContentModule = React.useCallback((module: ContentModule) => {
    setActiveArea('content')
    setActiveContentModule(module)
  }, [])

  React.useEffect(() => {
    const handleAdminNavigate = (event: Event) => {
      const customEvent = event as CustomEvent<AdminNavigationDetail>
      const detail = customEvent.detail
      if (!detail) return

      if (detail.area) {
        setActiveArea(detail.area)
      }
      if (detail.contentModule) {
        setActiveContentModule(detail.contentModule)
      }
      if (detail.section) {
        pendingSectionScrollRef.current = detail.section
      }
    }

    window.addEventListener('admin:navigate', handleAdminNavigate as EventListener)
    return () => {
      window.removeEventListener('admin:navigate', handleAdminNavigate as EventListener)
    }
  }, [])

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
  }, [activeArea, activeContentModule])

  React.useEffect(() => {
    if (isSuperAdmin !== true || !user) return

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
  }, [isSuperAdmin, user, summaryRefreshToken])

  React.useEffect(() => {
    if (isSuperAdmin !== true) return;
    setIsLoadingAudit(true);
    getRecentAuditLogs(firestore, 15)
      .then(setAuditLogs)
      .catch(console.error)
      .finally(() => setIsLoadingAudit(false));
  }, [firestore, isSuperAdmin, summaryRefreshToken]);

  React.useEffect(() => {
    if (!isCreateDialogOpen && isSuperAdmin === true) {
      refreshSummary()
    }
  }, [isCreateDialogOpen, isSuperAdmin, refreshSummary])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) return;
    setIsLoggingIn(true);
    setLoginError('');
    try {
      // Persistència local: comparteix autenticació entre pestanyes del mateix navegador.
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
    } catch (error: unknown) {
      console.error('Login error:', error);
      setLoginError(t.admin?.shell?.loginError ?? 'Credencials incorrectes');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEnterOrganization = (org: AdminControlTowerSummary['entities'][number]) => {
    sessionStorage.setItem('adminViewingOrgId', org.id);
    router.push('/dashboard');
  };

  const handleCopyOrganization = async (org: AdminControlTowerSummary['entities'][number]) => {
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : 'https://summasocial.app'
      await navigator.clipboard.writeText(`${base}/${org.slug}`)
      toast({
        title: 'Enllaç copiat',
        description: `S\'ha copiat /${org.slug}`,
      })
    } catch (error) {
      console.error('Copy error:', error)
      toast({
        variant: 'destructive',
        title: t.common?.error ?? 'Error',
        description: 'No s\'ha pogut copiar l\'enllaç',
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
          ? (t.admin?.shell?.orgSuspended ?? 'Organització suspesa')
          : (t.admin?.shell?.orgReactivated ?? 'Organització reactivada'),
        description: newStatus === 'suspended'
          ? t.admin?.shell?.orgNowSuspended?.({ org: org.name }) ?? `${org.name} ara està suspesa.`
          : t.admin?.shell?.orgNowActive?.({ org: org.name }) ?? `${org.name} ara està activa.`,
      });

      refreshSummary()
    } catch (error) {
      console.error('Error updating organization:', error);
      toast({ variant: 'destructive', title: t.common?.error ?? 'Error', description: t.admin?.shell?.updateError ?? 'No s\'ha pogut actualitzar l\'organització.' });
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
        title: t.admin?.migrations?.completed ?? 'Migració completada',
        description: `${t.admin?.migrations?.migrated?.({ count: result.migrated }) ?? `${result.migrated} organitzacions migrades`}. ${result.errors.length > 0 ? (t.admin?.migrations?.errors?.({ count: result.errors.length }) ?? `Errors: ${result.errors.length}`) : ''}`,
      });
      if (result.errors.length > 0) {
        console.error('Errors de migració:', result.errors);
      }
      refreshSummary()
    } catch (error) {
      console.error('Error durant la migració:', error);
      toast({
        variant: 'destructive',
        title: t.common?.error ?? 'Error',
        description: t.admin?.migrations?.failed ?? 'No s\'ha pogut completar la migració.',
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
        title: t.admin?.resetPassword?.sent ?? 'Correu enviat',
        description: t.admin?.resetPassword?.sentDescription ?? 'Si l\'adreça existeix, rebrà un correu per restablir la contrasenya.',
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
          title: t.admin?.health?.demoRegenerated ?? 'Demo regenerada',
          description: t.admin?.health?.demoRegeneratedDesc?.({ mode: data.demoMode, counts: countsStr }) ?? `Mode: ${data.demoMode}. Dades creades: ${countsStr}`,
        });
      } else {
        setSeedResult({ ok: false, error: data.error || (t.common?.unknownError ?? 'Error desconegut') });
        toast({
          variant: 'destructive',
          title: t.common?.error ?? 'Error',
          description: data.error || (t.admin?.health?.demoError ?? 'No s\'ha pogut regenerar la demo'),
        });
      }
      refreshSummary()
    } catch (error) {
      console.error('Error regenerant demo:', error);
      setSeedResult({ ok: false, error: (error as Error).message });
      toast({
        variant: 'destructive',
        title: t.common?.error ?? 'Error',
        description: t.admin?.health?.demoConnectionError ?? 'Error de connexió regenerant la demo',
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
        title: t.admin?.shell?.backupDownloaded ?? 'Backup descarregat',
        description: t.admin?.shell?.backupDownloadedDesc?.({ org: orgName }) ?? `S'ha descarregat el backup de ${orgName}.`,
      });
    } catch (error) {
      console.error('Error descarregant backup:', error);
      toast({
        variant: 'destructive',
        title: t.common?.error ?? 'Error',
        description: (error as Error).message || (t.admin?.shell?.backupError ?? 'No s\'ha pogut descarregar el backup.'),
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
        title: tr('admin.s9.notifyOrgSent', 'Avís enviat a l\'entitat'),
      });
      refreshSummary();
    } catch (error) {
      console.error('[admin] notify org fiscal alert error:', error);
      toast({
        variant: 'destructive',
        title: t.common?.error ?? 'Error',
        description: (error as Error).message || 'No s\'ha pogut enviar l\'avís',
      });
    } finally {
      setNotifyingOrgId(null);
    }
  };

  const getStatusBadge = (status: AdminControlTowerSummary['entities'][number]['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 border-green-300">{t.admin?.orgStatus?.active ?? 'Activa'}</Badge>;
      case 'suspended':
        return <Badge variant="destructive">{t.admin?.orgStatus?.suspended ?? 'Suspesa'}</Badge>;
      case 'pending':
        return <Badge variant="secondary">{t.admin?.orgStatus?.pending ?? 'Pendent'}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAlertStatusBadge = (status: 'open' | 'read' | 'expired' | null) => {
    if (status === 'open') {
      return <Badge className="bg-green-100 text-green-800 border-green-300">open</Badge>;
    }
    if (status === 'read') {
      return <Badge variant="secondary">read</Badge>;
    }
    if (status === 'expired') {
      return <Badge variant="outline">expired</Badge>;
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  };

  const handleLogout = async () => {
    broadcastLogoutSync('manual');
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error logout:', error);
    }
  };

  const cards = summary?.globalStatus.cards ?? []
  const entities = summary?.entities ?? []
  const kbSummary = summary?.kbBotSummary
  const communication = summary?.communicationSummary
  const systemCard = cards.find((card) => card.id === 'system')
  const incidentsCard = cards.find((card) => card.id === 'incidents')
  const contentCard = cards.find((card) => card.id === 'content')
  const translationsCard = cards.find((card) => card.id === 'translations')
  const openIncidentCount = incidentsCard?.count ?? 0
  const activeEntitiesCount = entities.filter((org) => org.status === 'active').length
  const suspendedEntitiesCount = entities.filter((org) => org.status === 'suspended').length
  const pendingEntitiesCount = entities.filter((org) => org.status === 'pending').length
  const contentPendingCount = communication?.pendingDrafts ?? 0
  const entitiesAreaStatus: ControlStatus =
    suspendedEntitiesCount > 0 || pendingEntitiesCount > 0 ? 'warning' : 'ok'
  const contentAreaStatus = combineStatuses(contentCard?.status, translationsCard?.status, communication?.status)
  const summaryIsReady = Boolean(summary)
  const filteredEntities = entitySearch.trim()
    ? entities.filter((org) => {
        const term = entitySearch.trim().toLowerCase()
        return [org.name, org.slug, org.taxId]
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .some((value) => value.toLowerCase().includes(term))
      })
    : entities

  const areaCards: Array<{
    id: AdminArea
    title: string
    summary: string
    status: ControlStatus
    badgeLabel: string
  }> = [
    {
      id: 'system',
      title: 'Sistema',
      summary: !summaryIsReady && isSummaryLoading
        ? 'Carregant resum'
        : openIncidentCount > 0
          ? `${openIncidentCount} incidència${openIncidentCount === 1 ? '' : 's'} oberta${openIncidentCount === 1 ? '' : 's'}`
          : 'Tot estable',
      status: systemCard?.status ?? 'ok',
      badgeLabel:
        systemCard?.status === 'critical'
          ? 'Revisar'
          : systemCard?.status === 'warning'
            ? 'Atenció'
            : 'Estable',
    },
    {
      id: 'entities',
      title: 'Entitats',
      summary: !summaryIsReady && isSummaryLoading
        ? 'Carregant entitats'
        : activeEntitiesCount > 0
          ? `${activeEntitiesCount} actives`
          : `${entities.length} registrades`,
      status: entitiesAreaStatus,
      badgeLabel: entitiesAreaStatus === 'warning' ? 'Seguiment' : 'Operatiu',
    },
    {
      id: 'content',
      title: 'Contingut',
      summary: !summaryIsReady && isSummaryLoading
        ? 'Carregant contingut'
        : contentPendingCount > 0
          ? `${contentPendingCount} pendents`
          : 'Tot al dia',
      status: contentAreaStatus,
      badgeLabel:
        contentAreaStatus === 'critical'
          ? 'Urgent'
          : contentAreaStatus === 'warning'
            ? 'Pendent'
            : 'Al dia',
    },
    {
      id: 'settings',
      title: 'Configuració',
      summary: isDemoEnv() ? 'Accessos, entitats i entorn DEMO' : 'Accessos i canvis sensibles',
      status: 'warning',
      badgeLabel: 'Sensible',
    },
  ]

  const contentEntryCards: Array<{
    id: ContentModule
    title: string
    summary: string
    icon: React.ReactNode
  }> = [
    {
      id: 'help',
      title: 'Ajuda del producte',
      summary: 'Guies i ajudes que veu l’equip',
      icon: <FileText className="h-4 w-4" />,
    },
    {
      id: 'bot',
      title: 'Estat del bot',
      summary: kbSummary?.botTodayQuestions
        ? `${kbSummary.botTodayQuestions} consultes avui`
        : 'Activitat i base de coneixement',
      icon: <BrainCircuit className="h-4 w-4" />,
    },
    {
      id: 'updates',
      title: 'Novetats',
      summary: contentPendingCount > 0 ? `${contentPendingCount} pendents` : 'Publicació al dia',
      icon: <Megaphone className="h-4 w-4" />,
    },
    {
      id: 'translations',
      title: 'Traduccions',
      summary: translationsCard?.headline ?? 'Textos per idioma',
      icon: <Languages className="h-4 w-4" />,
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
          Copiar URL pública
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
          Backup local JSON
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setSuspendDialogOrg(org)}
          className={org.status === 'suspended' ? 'text-green-600' : 'text-destructive'}
        >
          {org.status === 'suspended' ? (
            <>
              <Play className="mr-2 h-4 w-4" />
              Reactivar
            </>
          ) : (
            <>
              <Pause className="mr-2 h-4 w-4" />
              Suspendre
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>{t.admin?.shell?.loginTitle ?? 'Panell SuperAdmin'}</CardTitle>
            <CardDescription>{t.admin?.access?.restricted ?? 'Accés restringit'}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {reason === 'idle' && (
                <p className="text-sm rounded-md px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200">
                  Sessió tancada per inactivitat. Torna a iniciar sessió.
                </p>
              )}
              {reason === 'max_session' && (
                <p className="text-sm rounded-md px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200">
                  Per seguretat, cal tornar a iniciar sessió cada 12 hores.
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@exemple.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  disabled={isLoggingIn}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contrasenya</Label>
                <Input
                  id="password"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  disabled={isLoggingIn}
                  autoComplete="current-password"
                />
              </div>
              {loginError && (
                <p className="text-sm text-destructive">{loginError}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoggingIn || !loginEmail.trim() || !loginPassword}
              >
                {isLoggingIn ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="mr-2 h-4 w-4" />
                )}
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!superAdminCheckDone) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isSuperAdmin !== true) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-semibold">{t.admin?.access?.deniedTitle ?? 'Accés denegat'}</h1>
        <p className="text-muted-foreground">{t.admin?.access?.deniedDescription ?? 'No tens permisos per accedir al panell d\'administració.'}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleLogout}>
            {t.admin?.access?.logout ?? 'Tancar sessió'}
          </Button>
          <Button onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t.admin?.access?.backToDashboard ?? 'Tornar al dashboard'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {registryError && (
        <div className="bg-amber-500 text-white px-4 py-3">
          <div className="container mx-auto flex items-center gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <div>
              <span className="font-semibold">{t.admin?.health?.registryWarning ?? 'Atenció'}</span>
              <span className="ml-2 text-amber-100">
                {t.admin?.health?.reloadIfNeeded?.({ error: registryError }) ?? `${registryError}. Recarrega la pàgina si cal.`}
              </span>
            </div>
          </div>
        </div>
      )}

      <header className="border-b bg-card/95">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border bg-muted/50">
                  <Shield className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight">Centre de control</h1>
                  <p className="text-sm text-muted-foreground">Vista global de Summa Social</p>
                </div>
              </div>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Entra per àrees clares i actua sense haver de recórrer tot el panell.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button onClick={() => setIsCreateDialogOpen(true)}>Nova entitat</Button>
              <Button variant="outline" onClick={() => openArea('entities')}>
                Entrar a una entitat
              </Button>
              <Button variant="outline" onClick={() => openArea('system')}>
                Revisar sistema
              </Button>
              <Button variant="outline" onClick={() => openArea('settings')}>
                Reset contrasenya
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {summaryError && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="pt-6 text-sm text-red-700">
              {summaryError}
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <AreaSectionHeader
            title="Portada"
            description="Les quatre àrees principals del panell perquè sàpigues on entrar de seguida."
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {areaCards.map((card) => (
              <Card
                key={card.id}
                className={`${statusClasses(card.status)} ${activeArea === card.id ? 'ring-1 ring-foreground/15' : ''}`}
              >
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{card.title}</CardTitle>
                      <CardDescription className="mt-1 text-sm text-foreground/75">
                        {card.summary}
                      </CardDescription>
                    </div>
                    <Badge variant={statusBadgeVariant(card.status)}>{card.badgeLabel}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button variant="ghost" className="px-0 text-sm" onClick={() => openArea(card.id)}>
                    Veure
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Tabs
          value={activeArea}
          onValueChange={(value) => setActiveArea(value as AdminArea)}
          className="space-y-6"
        >
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-xl bg-muted/70 p-1 md:grid-cols-4">
            <TabsTrigger value="system" className="rounded-lg px-4 py-3 text-sm font-semibold">
              Sistema
            </TabsTrigger>
            <TabsTrigger value="entities" className="rounded-lg px-4 py-3 text-sm font-semibold">
              Entitats
            </TabsTrigger>
            <TabsTrigger value="content" className="rounded-lg px-4 py-3 text-sm font-semibold">
              Contingut
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-lg px-4 py-3 text-sm font-semibold">
              Configuració
            </TabsTrigger>
          </TabsList>

          <TabsContent value="system" className="space-y-8">
            <AreaSectionHeader
              title="Sistema"
              description="Estat general, incidències, semàfor de producció i eines tècniques."
              action={
                <Button variant="outline" onClick={refreshSummary} disabled={isSummaryLoading}>
                  {isSummaryLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Actualitzar dades
                </Button>
              }
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className={statusClasses(systemCard?.status ?? 'ok')}>
                <CardHeader>
                  <CardTitle className="text-base">Estat del sistema</CardTitle>
                  <CardDescription>Vista curta abans d’entrar al detall tècnic.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-lg font-semibold">{systemCard?.headline ?? 'Sense resum disponible'}</p>
                  <p className="text-sm text-muted-foreground">{systemCard?.detail ?? 'No hi ha avisos addicionals.'}</p>
                </CardContent>
              </Card>

              <Card className={statusClasses(incidentsCard?.status ?? 'ok')}>
                <CardHeader>
                  <CardTitle className="text-base">Incidències</CardTitle>
                  <CardDescription>Seguiment de problemes oberts i impacte operatiu.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-lg font-semibold">
                    {openIncidentCount} oberta{openIncidentCount === 1 ? '' : 's'}
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant={statusBadgeVariant(incidentsCard?.status ?? 'ok')}>
                      {incidentsCard?.status ?? 'ok'}
                    </Badge>
                    <span className="text-muted-foreground">
                      {incidentsCard?.headline ?? 'Sense incidències destacades'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            <div className="space-y-4">
              <AreaSectionHeader
                title="Incidències i semàfor"
                description="Detall del seguiment del sistema, amb sentinelles, incidències reals i comprovacions de producció."
              />
              <SystemHealth />
            </div>

            <Separator />

            <div className="space-y-4">
              <AreaSectionHeader
                title="Eines tècniques"
                description="Accés ràpid a la consola i als registres quan cal investigar una incidència."
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
                    Firebase Console
                  </a>
                  <a
                    href="https://console.cloud.google.com/logs/query?project=summa-social"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-muted/50"
                  >
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    Cloud Logging
                  </a>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-lg border px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50"
                    onClick={() => {
                      navigator.clipboard.writeText('docs/DEV-SOLO-MANUAL.md');
                      toast({ title: t.admin?.health?.copiedToClipboard ?? 'Copiat al porta-retalls' });
                    }}
                  >
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    Manual de suport
                  </button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="entities" className="space-y-8">
            <AreaSectionHeader
              title="Entitats"
              description="Resum d’organitzacions, cerca, llistat i accions operatives."
              action={<Button onClick={() => setIsCreateDialogOpen(true)}>Nova entitat</Button>}
            />

            <Card>
              <CardContent className="flex flex-col gap-4 pt-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-lg font-semibold">{entities.length} entitat{entities.length === 1 ? '' : 's'} registrades</p>
                  <p className="text-sm text-muted-foreground">
                    {activeEntitiesCount} actives · {suspendedEntitiesCount} suspeses · {pendingEntitiesCount} pendents
                  </p>
                </div>
                <div className="w-full lg:max-w-sm">
                  <Input
                    value={entitySearch}
                    onChange={(e) => setEntitySearch(e.target.value)}
                    placeholder="Cerca per nom, slug o CIF"
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
                            { label: 'Alta', value: formatDateForAdmin(org.createdAt) },
                            { label: 'Activitat', value: formatRelativeActivity(org.lastActivityAt) },
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
                        {entitySearch.trim() ? 'No hi ha cap entitat que coincideixi amb la cerca.' : 'Sense entitats disponibles.'}
                      </p>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Estat</TableHead>
                        <TableHead>Alta</TableHead>
                        <TableHead>Última activitat</TableHead>
                        <TableHead>Accions</TableHead>
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
                                  Entrar
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
                                  Moviments
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
                                  Configuració
                                </Button>
                                {renderEntityMoreMenu(
                                  org,
                                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                                    <MoreHorizontal className="mr-1 h-3.5 w-3.5" />
                                    Més
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                            {entitySearch.trim() ? 'No hi ha cap entitat que coincideixi amb la cerca.' : 'Sense entitats disponibles.'}
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
                title="Revisions fiscals per entitat"
                description="Ingressos assignats que no estan comptant fiscalment aquest any."
              />
              <Card>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Entitat</TableHead>
                          <TableHead>Pendents fiscals</TableHead>
                          <TableHead>Diagnòstic</TableHead>
                          <TableHead>Accions</TableHead>
                          <TableHead>Avís</TableHead>
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
                                  <p className="text-sm">{s9?.diagnosisTextCa ?? 'Sense diagnòstic'}</p>
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
                              Sense entitats disponibles.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-8">
            <AreaSectionHeader
              title="Contingut"
              description="Ajuda del producte, estat del bot, novetats i traduccions."
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                      Obrir
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {activeContentModule === 'help' && (
              <div className="space-y-6">
                <AreaSectionHeader
                  title="Ajuda del producte"
                  description="Guies i ajudes textuals que acompanyen l’equip dins de l’aplicació."
                />
                <EditorialCenter />
                <HelpAuditSection />
              </div>
            )}

            {activeContentModule === 'bot' && (
              <div className="space-y-6">
                <AreaSectionHeader
                  title="Estat del bot"
                  description="Activitat recent i base activa que està fent servir ara mateix."
                />
                <Card>
                  <CardContent className="grid grid-cols-1 gap-4 pt-6 md:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Base activa</p>
                      <p className="mt-1 text-sm font-semibold">
                        Darrera actualització: {formatDateForAdmin(kbSummary?.kbUpdatedAt ?? null)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Activitat</p>
                      <p className="mt-1 text-sm font-semibold">{kbSummary?.botTotalQuestions ?? 0} preguntes totals</p>
                      <p className="text-sm text-muted-foreground">{kbSummary?.botTodayQuestions ?? 0} avui</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Temes freqüents</p>
                      <ul className="mt-1 space-y-1 text-sm">
                        {(kbSummary?.topTopics ?? []).length > 0 ? (
                          (kbSummary?.topTopics ?? []).map((topic) => (
                            <li key={topic.topic}>• {topic.topic}</li>
                          ))
                        ) : (
                          <li className="text-muted-foreground">Sense dades</li>
                        )}
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Base activa del bot</CardTitle>
                    <CardDescription>Referència ràpida del que està en ús ara mateix.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-2 pl-5 text-sm">
                      <li>
                        Runtime del bot: <code>docs/kb/_fallbacks.json</code> + <code>docs/kb/cards/**/*.json</code>.
                      </li>
                      <li>
                        No es consumeix <code>docs/generated/help-bot.json</code> al runtime del bot.
                      </li>
                      <li>
                        No hi ha draft, publish ni Storage KB dins del producte actiu.
                      </li>
                      <li>
                        Si cal canviar la KB, s&apos;ha de fer amb canvis versionats a Git.
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeContentModule === 'updates' && (
              <div className="space-y-6">
                <AreaSectionHeader
                  title="Novetats"
                  description="Missatges i publicacions visibles per als usuaris."
                />
                <ProductUpdatesSection isSuperAdmin={isSuperAdmin === true} />
              </div>
            )}

            {activeContentModule === 'translations' && (
              <div className="space-y-6">
                <AreaSectionHeader
                  title="Traduccions"
                  description="Textos de l’aplicació per idioma."
                />
                <div data-section="i18n">
                  <I18nManager />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-8">
            <AreaSectionHeader
              title="Configuració"
              description="Operacions sensibles. Revisa bé l’impacte abans d’actuar."
            />

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Operacions sensibles: aquesta àrea concentra canvis d’accés, entitats i govern del sistema.
            </div>

            <div className="space-y-4">
              <AreaSectionHeader
                title="Organitzacions"
                description="Crear entitats i canvis estructurals."
              />
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setIsCreateDialogOpen(true)}>Crear entitat</Button>
                    <Button variant="outline" onClick={handleMigrateSlugs} disabled={isMigrating}>
                      {isMigrating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Migrar slug
                    </Button>
                  </div>

                  {isDemoEnv() && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-amber-900">{t.admin?.health?.demoEnv ?? 'Entorn DEMO'}</p>
                        <p className="text-sm text-amber-800">
                          {t.admin?.health?.demoDescription ?? 'Estàs treballant amb dades de demostració. Les accions aquí no afecten producció.'}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant={selectedDemoMode === 'short' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedDemoMode('short')}
                            disabled={isSeedingDemo}
                          >
                            Short
                          </Button>
                          <Button
                            variant={selectedDemoMode === 'work' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedDemoMode('work')}
                            disabled={isSeedingDemo}
                          >
                            Work
                          </Button>
                          <span className="text-xs text-amber-700">
                            {selectedDemoMode === 'short'
                              ? (t.admin?.health?.demoShort ?? 'Dades netes per vídeos/pitch')
                              : (t.admin?.health?.demoWork ?? 'Dades amb anomalies per validar workflows')}
                          </span>
                        </div>
                        <Button onClick={handleRegenerateDemo} disabled={isSeedingDemo} variant="outline">
                          {isSeedingDemo ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t.admin?.health?.regenerating ?? 'Regenerant...'}
                            </>
                          ) : (
                            <>
                              <Play className="mr-2 h-4 w-4" />
                              {t.admin?.health?.regenerateDemo ?? 'Regenerar demo'}
                            </>
                          )}
                        </Button>
                        {seedResult && (
                          <div className={`rounded-lg p-3 text-sm ${seedResult.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {seedResult.ok ? (
                              <span>Seed completat ({seedResult.demoMode})</span>
                            ) : (
                              <span>Error: {seedResult.error}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <AreaSectionHeader
                title="Usuaris"
                description="Reset de contrasenya i gestió de SuperAdmins."
              />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Mail className="h-4 w-4" />
                    Reset contrasenya
                  </CardTitle>
                  <CardDescription>
                    Envia un correu per restablir la contrasenya d&apos;un usuari.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="email"
                      placeholder={t.admin?.resetPassword?.placeholder ?? 'email@exemple.com'}
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      disabled={isResetting}
                    />
                    <Button onClick={handlePasswordReset} disabled={isResetting || !resetEmail.trim()}>
                      {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t.admin?.resetPassword?.send ?? 'Enviar correu'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <SuperAdminsManager />
            </div>

            <div className="space-y-4">
              <AreaSectionHeader
                title="Activitat"
                description="Registre recent de canvis fets des de SuperAdmin."
              />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="h-4 w-4" />
                    Activitat recent
                  </CardTitle>
                  <CardDescription>
                    {t.admin?.updates?.description ?? 'Últimes accions registrades'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingAudit ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t.common?.loading ?? 'Carregant...'}
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t.admin?.updates?.noActions ?? 'Cap acció registrada encara.'}</p>
                  ) : (
                    <div className="space-y-2">
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
                ? (t.admin?.shell?.reactivateTitle ?? 'Reactivar organització?')
                : (t.admin?.shell?.suspendTitle ?? 'Suspendre organització?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {suspendDialogOrg?.status === 'suspended'
                ? (t.admin?.shell?.reactivateDesc?.({ org: suspendDialogOrg?.name ?? '' }) ?? `L'organització "${suspendDialogOrg?.name}" tornarà a estar activa i els seus membres podran accedir-hi.`)
                : (t.admin?.shell?.suspendDesc?.({ org: suspendDialogOrg?.name ?? '' }) ?? `L'organització "${suspendDialogOrg?.name}" quedarà suspesa i els seus membres no podran accedir-hi.`)
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>{t.common?.cancel ?? 'Cancel·lar'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => suspendDialogOrg && handleToggleSuspend(suspendDialogOrg)}
              disabled={isProcessing}
              className={suspendDialogOrg?.status === 'suspended' ? '' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'}
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {suspendDialogOrg?.status === 'suspended' ? (t.admin?.shell?.reactivate ?? 'Reactivar') : (t.admin?.shell?.suspend ?? 'Suspendre')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showSeedConfirm} onOpenChange={setShowSeedConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-amber-800">
              {t.admin?.health?.confirmRegenTitle?.({ mode: selectedDemoMode }) ?? `Regenerar dades demo (${selectedDemoMode})?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.admin?.health?.confirmRegenDesc ?? 'Aquesta acció esborrarà totes les dades de demostració existents i en crearà de noves.'}
              <br /><br />
              <strong>{t.admin?.health?.selectedMode ?? 'Mode seleccionat:'}</strong>{' '}
              {selectedDemoMode === 'short'
                ? (t.admin?.health?.shortModeDesc ?? 'Short — Dades netes per vídeos i pitch')
                : (t.admin?.health?.workModeDesc ?? 'Work — Dades amb anomalies per validar workflows reals')}
              <br /><br />
              <strong>{t.admin?.health?.onlyDemo ?? "Només afecta l'organització demo (slug: demo). Cap dada de producció serà modificada."}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common?.cancel ?? 'Cancel·lar'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeRegenerateDemo}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {t.admin?.health?.regenerateDemo ?? 'Regenerar demo'} ({selectedDemoMode})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AdminPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregant...</div>}>
      <AdminPageContent />
    </React.Suspense>
  );
}
