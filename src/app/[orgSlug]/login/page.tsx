'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/logo';
import { useFirebase } from '@/firebase';
import { useTranslations } from '@/i18n';
import { useToast } from '@/hooks/use-toast';
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, Building2, AlertCircle, Clock } from 'lucide-react';
import { isDemoEnv } from '@/lib/demo/isDemoOrg';
import { processLoginInviteFlow } from '@/lib/invitations/login-invite-flow';

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
}

interface ResolvedInvitation {
  invitationId: string;
  organizationId: string;
  organizationName: string | null;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  expiresAt: string | null;
}

function resolveAuthLanguage(language: string): string {
  const supported = new Set(['ca', 'es', 'fr', 'pt', 'en']);
  return supported.has(language) ? language : 'en';
}

function OrgLoginContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const orgSlug = params.orgSlug as string;
  const reason = searchParams.get('reason');
  const nextPath = searchParams.get('next');
  const inviteToken = searchParams.get('inviteToken');
  const { auth, firestore, user, isUserLoading } = useFirebase();
  const { tr, language } = useTranslations();
  const { toast } = useToast();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [resetInfo, setResetInfo] = React.useState('');
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [isSendingReset, setIsSendingReset] = React.useState(false);
  const [nextResetAllowedAt, setNextResetAllowedAt] = React.useState(0);
  const [inviteGate, setInviteGate] = React.useState<'idle' | 'processing' | 'passed' | 'failed'>(
    inviteToken ? 'idle' : 'passed'
  );
  // DEMO: Bypass per /demo/login — no cal carregar org abans de login
  const isDemoLogin = isDemoEnv() && orgSlug === 'demo';

  const [organization, setOrganization] = React.useState<OrgInfo | null>(
    // En DEMO, crear org dummy per evitar fetch a Firestore
    isDemoLogin ? { id: 'demo-org', name: 'Demo', slug: 'demo' } : null
  );
  const [isLoadingOrg, setIsLoadingOrg] = React.useState(!isDemoLogin);
  const [orgNotFound, setOrgNotFound] = React.useState(false);

  // Carregar informació de l'organització pel slug
  // DEMO: Skip si és /demo/login (ja tenim org dummy)
  React.useEffect(() => {
    // DEMO: No carregar org, ja tenim dummy
    if (isDemoLogin) return;

    const loadOrganization = async () => {
      if (!orgSlug) return;

      try {
        const slugRef = doc(firestore, 'slugs', orgSlug);
        const slugSnap = await getDoc(slugRef);

        if (slugSnap.exists()) {
          const slugData = slugSnap.data();
          setOrganization({
            id: slugData.orgId,
            name: slugData.orgName || 'Organización',
            slug: orgSlug
          });
        } else {
          setOrgNotFound(true);
        }
      } catch (err) {
        console.error('Error loading organization:', err);
        setOrgNotFound(true);
      } finally {
        setIsLoadingOrg(false);
      }
    };

    loadOrganization();
  }, [orgSlug, firestore, isDemoLogin]);

  // Si l'usuari ja està autenticat, redirigir al dashboard (o nextPath si ve de inactivitat)
  React.useEffect(() => {
    if (user && !isUserLoading && organization && (!inviteToken || inviteGate === 'passed')) {
      const destination = nextPath || `/${orgSlug}/dashboard`;
      router.push(destination);
    }
  }, [user, isUserLoading, organization, orgSlug, router, nextPath, inviteGate, inviteToken]);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Todos los campos son obligatorios');
      return;
    }

    setError('');
    setIsLoggingIn(true);

    try {
      // Sessió de navegador: es tanca en tancar el navegador
      await setPersistence(auth, browserSessionPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const loggedInUser = userCredential.user;

      // Si hi ha inviteToken, completar l'acceptació de la invitació
      if (inviteToken && organization) {
        setInviteGate('processing');
        try {
          const inviteResult = await processLoginInviteFlow(
            {
              resolveInvitation: async () => {
                const resolveRes = await fetch(`/api/invitations/resolve?token=${encodeURIComponent(inviteToken)}`);
                const resolveBody = await resolveRes.json().catch(() => ({} as { error?: string }));
                if (!resolveRes.ok) {
                  return { ok: false as const, error: resolveBody.error || 'resolve_failed' };
                }
                return { ok: true as const, invitation: resolveBody as ResolvedInvitation };
              },
              getIdToken: async () => loggedInUser.getIdToken(),
              acceptInvitation: async (idToken, invitationData) => {
                const acceptRes = await fetch('/api/invitations/accept', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                  },
                  body: JSON.stringify({
                    invitationId: invitationData.invitationId,
                    organizationId: invitationData.organizationId,
                    displayName: loggedInUser.displayName || email.split('@')[0],
                    email: loggedInUser.email || email,
                    role: invitationData.role,
                  }),
                });

                if (acceptRes.ok) {
                  return { ok: true };
                }

                const acceptBody = await acceptRes.json().catch(() => ({} as { error?: string }));
                return { ok: false, error: acceptBody.error || 'accept_failed' };
              },
              signOut: async () => {
                await auth.signOut();
              },
            },
            {
              organizationId: organization.id,
              loginEmail: email,
              user: {
                email: loggedInUser.email,
                displayName: loggedInUser.displayName,
              },
            }
          );

          if (!inviteResult.ok) {
            setInviteGate('failed');
            setIsLoggingIn(false);

            let inviteError = 'No s\'ha pogut acceptar la invitació. Torna-ho a provar.';
            switch (inviteResult.error) {
              case 'expired':
              case 'invitation_expired':
                inviteError = 'Aquesta invitació ha expirat. Demana\'n una de nova a l\'administrador.';
                break;
              case 'already_used':
                inviteError = 'Aquesta invitació ja s\'ha utilitzat. Si encara necessites accés, demana una nova invitació.';
                break;
              case 'already_member':
                inviteError = 'Aquest compte ja és membre d’aquesta organització. Entra sense l’enllaç d’invitació.';
                break;
              case 'org_mismatch':
                inviteError = 'Aquesta invitació no correspon a aquesta organització.';
                break;
              case 'email_mismatch':
                inviteError = 'El compte amb què has iniciat sessió no coincideix amb l’email de la invitació.';
                break;
            }

            setError(inviteError);
            toast({
              variant: 'destructive',
              title: 'Invitació no acceptada',
              description: inviteError,
            });
            return;
          }

          setInviteGate('passed');
          toast({
            title: 'Invitació acceptada!',
            description: `T'has unit a ${organization.name}`,
          });
        } catch (inviteErr) {
          console.error('Error processant invitació:', inviteErr);
          setInviteGate('failed');
          setIsLoggingIn(false);
          setError('No s\'ha pogut completar l\'accés amb la invitació. Torna-ho a provar.');
          await auth.signOut().catch(() => undefined);
          toast({
            variant: 'destructive',
            title: 'Invitació no acceptada',
            description: 'No s\'ha pogut completar l\'accés amb la invitació. Torna-ho a provar.',
          });
          return;
        }
      }

      toast({
        title: 'Sesión iniciada',
        description: 'Bienvenido de nuevo',
      });

      // Redirigir a nextPath si existeix, sinó al dashboard
      const destination = nextPath || `/${orgSlug}/dashboard`;
      setInviteGate('passed');
      router.push(destination);
    } catch (err: any) {
      console.error('Error de login:', err);
      setIsLoggingIn(false);

      let friendlyError = 'Error al iniciar sesión';
      switch (err.code) {
        case 'auth/invalid-email':
          friendlyError = 'El correo electrónico no es válido';
          break;
        case 'auth/user-not-found':
          friendlyError = 'No existe ningún usuario con este correo';
          break;
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          friendlyError = 'Contraseña incorrecta';
          break;
        case 'auth/too-many-requests':
          friendlyError = 'Demasiados intentos. Espera unos minutos';
          break;
        default:
          friendlyError = err.message || friendlyError;
      }
      setError(friendlyError);
      toast({ variant: 'destructive', title: 'Error', description: friendlyError });
    }
  };

  const handlePasswordReset = async () => {
    if (isSendingReset) return;

    if (Date.now() < nextResetAllowedAt) {
      setResetInfo('');
      setError(
        tr(
          'login.resetWaitBeforeRetry',
          "Ja hem enviat un correu fa poc. Revisa l'ultim missatge rebut abans de demanar-ne un de nou."
        )
      );
      return;
    }

    if (!email.trim()) {
      setResetInfo('');
      setError(tr('login.resetRequiresEmail', 'Introdueix el teu correu electrònic primer.'));
      return;
    }

    setError('');
    const trimmedEmail = email.trim();
    const neutralMessage = tr(
      'login.resetEmailSentNeutral',
      'Si el correu existeix, rebràs un email amb instruccions per restablir la contrasenya.'
    );
    const latestEmailMessage = tr(
      'login.resetUseLatestEmail',
      "Per seguretat, nomes es valid l'ultim correu de restabliment enviat."
    );

    setIsSendingReset(true);
    try {
      auth.languageCode = resolveAuthLanguage(language);
      // Sense continueUrl: evita el bug del widget hosted de Firebase
      // en entorns App Hosting on /__/firebase/init.json no està disponible.
      await sendPasswordResetEmail(auth, trimmedEmail);
    } catch (resetError) {
      console.error('Password reset error (silenced):', resetError);
    } finally {
      // Sempre missatge neutre per evitar enumeració d'usuaris.
      setResetInfo(`${neutralMessage} ${latestEmailMessage}`);
      setNextResetAllowedAt(Date.now() + 60_000);
      setIsSendingReset(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  // Loading state
  if (isUserLoading || isLoadingOrg) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Cargando...</p>
      </main>
    );
  }

  // Organització no trobada
  if (orgNotFound) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
          <AlertCircle className="h-16 w-16 text-destructive" />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Organización no encontrada
            </h1>
            <p className="text-muted-foreground">
              No existe ninguna organización con la URL <span className="font-mono text-primary">{orgSlug}</span>
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push('/')}>
            Volver al inicio
          </Button>
        </div>
      </main>
    );
  }

  // Si l'usuari ja està autenticat, mostrar loading mentre redirigeix
  if (user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Redirigiendo...</p>
      </main>
    );
  }

  // Formulari de login
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <Logo className="h-16 w-16 text-primary" />

        {/* Nom de l'organització */}
        {organization && (
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{organization.name}</span>
          </div>
        )}

        {/* Missatge de sessió tancada per inactivitat */}
        {reason === 'idle' && (
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-lg px-4 py-3 w-full">
            <Clock className="h-5 w-5 shrink-0" />
            <span className="text-sm">
              Sessió tancada per inactivitat. Torna a iniciar sessió per continuar.
            </span>
          </div>
        )}
        {reason === 'max_session' && (
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-lg px-4 py-3 w-full">
            <Clock className="h-5 w-5 shrink-0" />
            <span className="text-sm">
              Per seguretat, cal tornar a iniciar sessió cada 12 hores.
            </span>
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Iniciar sesión</h1>
          <p className="text-muted-foreground mt-2">
            Accede a tu cuenta para continuar
          </p>
        </div>

        <div className="w-full space-y-4 text-left">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              type="email"
              id="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
                setResetInfo('');
                setNextResetAllowedAt(0);
              }}
              onKeyPress={handleKeyPress}
              placeholder="nombre@ejemplo.com"
              disabled={isLoggingIn}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              type="password"
              id="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
                setResetInfo('');
              }}
              onKeyPress={handleKeyPress}
              placeholder="••••••••"
              disabled={isLoggingIn}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 p-2 rounded-md">
              {error}
            </p>
          )}

          {resetInfo && (
            <p className="text-sm text-emerald-700 bg-emerald-50 p-2 rounded-md">
              {resetInfo}
            </p>
          )}

          <button
            type="button"
            onClick={handlePasswordReset}
            className="text-sm text-primary underline"
            disabled={isLoggingIn || isSendingReset}
          >
            {tr('login.forgotPassword', 'Has oblidat la contrasenya?')}
          </button>
        </div>

        <Button
          onClick={handleLogin}
          className="w-full"
          disabled={isLoggingIn}
        >
          {isLoggingIn ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Accediendo...
            </>
          ) : (
            'Acceder'
          )}
        </Button>
      </div>
    </main>
  );
}

export default function OrgLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </main>
      }
    >
      <OrgLoginContent />
    </Suspense>
  );
}
