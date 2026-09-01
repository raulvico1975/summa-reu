'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface ConsentManifest {
  client: { id: string; name: string; description?: string };
  scopes: Array<{ scope: string; description?: string; isGrantable: boolean }>;
}

const SCOPE_LABELS: Record<string, string> = {
  'mcp.session.read': 'Veure el context de la sessió connectada',
  'bank_accounts.search': 'Cercar comptes bancaris amb dades emmascarades',
  'contacts.search': 'Cercar contactes amb dades personals emmascarades',
  'transactions.search': 'Consultar moviments i resums operatius',
};

function OAuthConsentContent() {
  const searchParams = useSearchParams();
  const query = useMemo(() => searchParams.toString(), [searchParams]);
  const { user, isUserLoading } = useFirebase();
  const [manifest, setManifest] = useState<ConsentManifest | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const callAuthorizationApi = useCallback(async (
    path: 'start' | 'submit',
    consentGranted?: boolean
  ) => {
    if (!user) throw new Error('NOT_AUTHENTICATED');
    const idToken = await user.getIdToken();
    const response = await fetch(`/api/mcp/oauth/authorize/${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${idToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        query,
        ...(typeof consentGranted === 'boolean' ? { consentGranted } : {}),
      }),
      cache: 'no-store',
    });
    const body = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'AUTHORIZATION_FAILED');
    return body;
  }, [query, user]);

  useEffect(() => {
    if (isUserLoading || !user || !query) return;
    let cancelled = false;
    setError('');
    void callAuthorizationApi('start')
      .then((body) => {
        if (!cancelled) setManifest(body.manifest as ConsentManifest);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'AUTHORIZATION_FAILED');
        }
      });
    return () => { cancelled = true; };
  }, [callAuthorizationApi, isUserLoading, query, user]);

  const submitConsent = async (consentGranted: boolean) => {
    setIsSubmitting(true);
    setError('');
    try {
      const body = await callAuthorizationApi('submit', consentGranted);
      if (typeof body.redirectUri !== 'string') throw new Error('AUTHORIZATION_FAILED');
      window.location.assign(body.redirectUri);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'AUTHORIZATION_FAILED');
      setIsSubmitting(false);
    }
  };

  if (isUserLoading) {
    return <LoadingCard text="Comprovant la sessió de Summa Social…" />;
  }

  if (!user) {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-amber-600" />
          <CardTitle className="mt-3">Inicia sessió a Summa Social</CardTitle>
          <CardDescription>
            Obre la teva organització de Summa Social, inicia-hi sessió i torna a provar la connexió des de ChatGPT o Claude.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground">
            El pilot no demana ni comparteix la teva contrasenya amb el client de xat.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
          <CardTitle className="mt-3">No s’ha pogut autoritzar la connexió</CardTitle>
          <CardDescription>
            La petició no és vàlida, el pilot encara no està configurat o aquest usuari no hi té accés.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-xs text-muted-foreground">Referència: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!manifest) return <LoadingCard text="Preparant els permisos de la connexió…" />;

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="text-center">
        <ShieldCheck className="mx-auto h-11 w-11 text-primary" />
        <CardTitle className="mt-3">Connectar {manifest.client.name} amb Summa Social?</CardTitle>
        <CardDescription>
          {manifest.client.description || 'Aquest client podrà consultar només la informació indicada i amb els teus permisos actuals.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="mb-3 text-sm font-medium">Permisos sol·licitats</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {manifest.scopes.map((item) => (
              <li key={item.scope} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>{item.description || SCOPE_LABELS[item.scope] || item.scope}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Connexió només de lectura. No pot crear moviments, fer pagaments, enviar correus ni executar accions fiscals.
        </p>
      </CardContent>
      <CardFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => void submitConsent(false)}
        >
          Cancel·lar
        </Button>
        <Button
          type="button"
          disabled={isSubmitting}
          onClick={() => void submitConsent(true)}
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Autoritzar connexió
        </Button>
      </CardFooter>
    </Card>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <Card className="w-full max-w-lg">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}

export default function PublicMcpAuthorizationPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
      <div className="flex w-full flex-col items-center gap-6">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Logo className="h-7 w-7" />
          <span>Summa Social</span>
        </div>
        <Suspense fallback={<LoadingCard text="Carregant l’autorització…" />}>
          <OAuthConsentContent />
        </Suspense>
      </div>
    </main>
  );
}
