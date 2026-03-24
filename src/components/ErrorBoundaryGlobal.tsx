// src/components/ErrorBoundaryGlobal.tsx
// Captura errors globals (window.onerror, unhandledrejection) i errors React i els envia a systemIncidents

'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { OrganizationContext } from '@/hooks/organization-provider';
import {
  reportSystemIncident,
  shouldIgnoreError,
} from '@/lib/system-incidents';
import type { Firestore } from 'firebase/firestore';

// ═══════════════════════════════════════════════════════════════════════════
// REACT ERROR BOUNDARY (Class component - requerit per componentDidCatch)
// ═══════════════════════════════════════════════════════════════════════════

interface ErrorBoundaryProps {
  children: React.ReactNode;
  firestore: Firestore | null;
  pathname: string | null;
  canReportIncident: boolean;
  orgId?: string;
  orgSlug?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ReactErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { firestore, pathname, canReportIncident, orgId, orgSlug } = this.props;

    // Filtrar soroll
    if (shouldIgnoreError(error.message)) {
      return;
    }

    if (firestore && canReportIncident) {
      reportSystemIncident({
        firestore,
        type: 'CLIENT_CRASH',
        message: error.message || 'React render error',
        route: pathname || undefined,
        stack: error.stack,
        orgId: orgId || undefined,
        orgSlug: orgSlug || undefined,
        meta: {
          componentStack: errorInfo.componentStack?.slice(0, 500), // Limitar mida
        },
      });
    }
  }

  render() {
    if (this.state.hasError) {
      // UI de fallback quan hi ha error
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold mb-4">Hi ha hagut un error</h1>
            <p className="text-muted-foreground mb-4">
              S&apos;ha produït un error inesperat. L&apos;equip tècnic ha estat notificat.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
            >
              Recarregar pàgina
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLERS (window.onerror, unhandledrejection)
// ═══════════════════════════════════════════════════════════════════════════

export function ErrorBoundaryGlobal({
  children,
}: {
  children: React.ReactNode;
}) {
  const { firestore, isUserLoading } = useFirebase();
  const pathname = usePathname();
  // useContext retorna undefined si no hi ha provider (no llança error)
  const org = React.useContext(OrganizationContext);
  const orgId = org?.organizationId;
  const orgSlug = org?.orgSlug;
  const canReportIncident = Boolean(orgId && org?.member);

  // Guardar referència estable per als handlers
  const contextRef = React.useRef({ firestore, pathname, canReportIncident, orgId, orgSlug });
  React.useEffect(() => {
    contextRef.current = { firestore, pathname, canReportIncident, orgId, orgSlug };
  }, [firestore, pathname, canReportIncident, orgId, orgSlug]);

  React.useEffect(() => {
    // No activar fins que Firebase estigui llest
    if (isUserLoading || !firestore) return;

    // Handler per window.onerror (errors síncrons)
    const handleError = (event: ErrorEvent) => {
      const { message, filename, lineno, colno, error } = event;

      // Filtrar soroll
      if (shouldIgnoreError(message)) {
        return;
      }

      const { firestore: fs, pathname: route, canReportIncident: allowed, orgId: oid, orgSlug: slug } = contextRef.current;
      if (!fs || !allowed) {
        return;
      }

      reportSystemIncident({
        firestore: fs,
        type: 'CLIENT_CRASH',
        message: message || 'Unknown error',
        route: route || undefined,
        stack: error?.stack,
        orgId: oid || undefined,
        orgSlug: slug || undefined,
        meta: {
          filename,
          lineno,
          colno,
        },
      });
    };

    // Handler per unhandledrejection (promises rebutjades)
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      let message = 'Unhandled Promise Rejection';
      let stack: string | undefined;

      if (reason instanceof Error) {
        message = reason.message;
        stack = reason.stack;
      } else if (typeof reason === 'string') {
        message = reason;
      }

      // Filtrar soroll
      if (shouldIgnoreError(message)) {
        return;
      }

      // Detectar errors de permisos de Firestore
      const isPermissionsError =
        message.includes('Missing or insufficient permissions') ||
        message.includes('permission-denied') ||
        message.includes('PERMISSION_DENIED');

      const { firestore: fs, pathname: route, canReportIncident: allowed, orgId: oid, orgSlug: slug } = contextRef.current;
      if (!fs || !allowed) return;

      reportSystemIncident({
        firestore: fs,
        type: isPermissionsError ? 'PERMISSIONS' : 'CLIENT_CRASH',
        message,
        route: route || undefined,
        stack,
        orgId: oid || undefined,
        orgSlug: slug || undefined,
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [firestore, isUserLoading]);

  return (
    <ReactErrorBoundary
      firestore={firestore}
      pathname={pathname}
      canReportIncident={canReportIncident}
      orgId={orgId ?? undefined}
      orgSlug={orgSlug ?? undefined}
    >
      {children}
    </ReactErrorBoundary>
  );
}
