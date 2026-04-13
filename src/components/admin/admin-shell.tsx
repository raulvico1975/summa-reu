'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  browserLocalPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import {
  AlertCircle,
  Building2,
  FileText,
  Inbox,
  LayoutDashboard,
  Loader2,
  Lock,
  Shield,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'

import { useFirebase } from '@/firebase'
import { useTranslations } from '@/i18n'
import { isAllowlistedSuperAdmin } from '@/lib/admin/superadmin-allowlist'
import { ensureSuperAdminRegistry } from '@/lib/admin/ensure-superadmin-registry'
import { broadcastLogoutSync } from '@/lib/session-sync'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function SidebarLink({
  href,
  icon,
  label,
  active,
  badge,
  muted,
}: {
  href?: string
  icon: React.ReactNode
  label: string
  active?: boolean
  badge?: number
  muted?: boolean
}) {
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-3">
        <span className={active ? 'text-orange-400' : 'text-slate-400'}>{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      {typeof badge === 'number' && badge > 0 ? (
        <span
          className={[
            'inline-flex min-w-8 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
            active ? 'bg-orange-400 text-slate-950 shadow-sm' : 'bg-slate-700 text-slate-200',
          ].join(' ')}
        >
          {badge}
        </span>
      ) : null}
    </>
  )

  const className = [
    'flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
    active ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white',
    muted ? 'opacity-55' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (!href) {
    return (
      <button className={`${className} cursor-not-allowed hover:bg-transparent hover:text-slate-300`} disabled type="button">
        {content}
      </button>
    )
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  )
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, firestore, auth, isUserLoading } = useFirebase()
  const { tr } = useTranslations()

  const [isSuperAdmin, setIsSuperAdmin] = React.useState<boolean | null>(null)
  const [superAdminCheckDone, setSuperAdminCheckDone] = React.useState(false)
  const [registryError, setRegistryError] = React.useState<string | null>(null)
  const [loginEmail, setLoginEmail] = React.useState('')
  const [loginPassword, setLoginPassword] = React.useState('')
  const [loginError, setLoginError] = React.useState('')
  const [isLoggingIn, setIsLoggingIn] = React.useState(false)
  const [reason, setReason] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    setReason(new URLSearchParams(window.location.search).get('reason'))
  }, [])

  React.useEffect(() => {
    if (!user) {
      setIsSuperAdmin(null)
      setSuperAdminCheckDone(false)
      setRegistryError(null)
      return
    }

    const isAllowed = isAllowlistedSuperAdmin(user.email)
    if (!isAllowed) {
      setIsSuperAdmin(false)
      setSuperAdminCheckDone(true)
      return
    }

    const setupAccess = async () => {
      try {
        const result = await ensureSuperAdminRegistry(firestore, user.uid, user.email!)
        if (!result.success) {
          setRegistryError(result.error || 'No s’ha pogut preparar l’accés')
        }
        setIsSuperAdmin(true)
      } catch (error) {
        console.error('[admin] unexpected access error:', error)
        setRegistryError((error as Error).message)
        setIsSuperAdmin(true)
      } finally {
        setSuperAdminCheckDone(true)
      }
    }

    void setupAccess()
  }, [firestore, user])

  const handleLogin = React.useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      if (!loginEmail.trim() || !loginPassword) return

      setIsLoggingIn(true)
      setLoginError('')
      try {
        await setPersistence(auth, browserLocalPersistence)
        await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword)
      } catch (error) {
        console.error('[admin] login error:', error)
        setLoginError(tr('admin.shell.loginError', 'Credencials incorrectes'))
      } finally {
        setIsLoggingIn(false)
      }
    },
    [auth, loginEmail, loginPassword, tr]
  )

  const handleLogout = React.useCallback(async () => {
    broadcastLogoutSync('manual')
    try {
      await signOut(auth)
    } catch (error) {
      console.error('[admin] logout error:', error)
    }
  }, [auth])

  if (isUserLoading || (user && !superAdminCheckDone)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-700" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>{tr('admin.shell.loginTitle', 'Panell SuperAdmin')}</CardTitle>
            <CardDescription>{tr('admin.access.restricted', 'Accés restringit')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {reason === 'idle' ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  {tr('admin.access.idleMessage', 'Sessió tancada per inactivitat. Torna a iniciar sessió.')}
                </p>
              ) : null}
              {reason === 'max_session' ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  {tr('admin.access.maxSessionMessage', 'Per seguretat, cal tornar a iniciar sessió cada 12 hores.')}
                </p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="email">{tr('admin.shell.emailLabel', 'Email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  placeholder={tr('admin.shell.emailPlaceholder', 'admin@exemple.com')}
                  autoComplete="email"
                  disabled={isLoggingIn}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{tr('admin.shell.passwordLabel', 'Contrasenya')}</Label>
                <Input
                  id="password"
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  autoComplete="current-password"
                  disabled={isLoggingIn}
                />
              </div>
              {loginError ? <p className="text-sm text-destructive">{loginError}</p> : null}
              <Button type="submit" className="w-full" disabled={isLoggingIn || !loginEmail.trim() || !loginPassword}>
                {isLoggingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                {tr('admin.shell.loginButton', 'Entrar')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isSuperAdmin !== true) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-semibold">{tr('admin.access.deniedTitle', 'Accés denegat')}</h1>
        <p className="text-muted-foreground">
          {tr('admin.access.deniedDescription', "No tens permisos per accedir al panell d'administració.")}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void handleLogout()}>
            {tr('admin.access.logout', 'Tancar sessió')}
          </Button>
          <Button onClick={() => router.push('/dashboard')}>{tr('admin.access.backToDashboard', 'Tornar al dashboard')}</Button>
        </div>
      </div>
    )
  }

  const isGrowth = pathname.startsWith('/admin/growth')

  return (
    <div className="flex min-h-screen overflow-hidden bg-slate-50 text-slate-950">
      <aside className="flex w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-white">
        <div className="px-5 pt-6">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-400/15 text-orange-400 ring-1 ring-inset ring-orange-400/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-[-0.03em] text-orange-400">SummaAdmin</p>
              <p className="text-xs text-slate-400">Routing operatiu</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Producte</p>
            <SidebarLink href="/admin" icon={<LayoutDashboard className="h-4 w-4" />} label="Vista general" active={pathname === '/admin'} muted={isGrowth} />
            <SidebarLink href="/admin/contingut" icon={<FileText className="h-4 w-4" />} label="Blog i Novetats" active={pathname.startsWith('/admin/contingut')} muted={isGrowth} />
            <SidebarLink href="/admin/entitats" icon={<Building2 className="h-4 w-4" />} label="Entitats" active={pathname === '/admin/entitats'} muted={isGrowth} />
            <SidebarLink href="/admin/manteniment" icon={<TriangleAlert className="h-4 w-4" />} label="Incidències" active={pathname === '/admin/manteniment'} muted={isGrowth} />
          </div>

          <div className="my-6 border-t border-slate-800" />

          <div className="space-y-2">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Operativa (Growth)</p>
            <SidebarLink href="/admin/growth/leads" icon={<Inbox className="h-4 w-4" />} label="CRM / Leads" active={pathname.startsWith('/admin/growth/leads')} />
          </div>
        </div>

        <div className="mt-auto space-y-3 border-t border-slate-800 px-5 py-4">
          <div className="rounded-2xl bg-slate-800/70 px-3 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-400 text-sm font-bold text-slate-950">
                R
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">Raül (SuperAdmin)</p>
                <p className="text-xs text-slate-400">Control total</p>
              </div>
            </div>
          </div>
          <Button variant="outline" className="w-full border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" onClick={() => void handleLogout()}>
            {tr('admin.access.logout', 'Tancar sessió')}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {registryError ? (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-800">
            {tr('admin.health.reloadIfNeeded', '{error}. Recarrega la pàgina si cal.').replace('{error}', registryError)}
          </div>
        ) : null}
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
