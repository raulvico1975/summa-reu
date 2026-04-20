// src/hooks/organization-provider.tsx

'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collectionGroup, query, where, getDocs, doc, getDoc, limit } from 'firebase/firestore';
import { generateUniqueSlug, reserveSlug } from '@/lib/slugs';
import type { Organization, OrganizationRole, UserProfile, OrganizationMember } from '@/lib/data';
import { normalizeOrganizationMember } from '@/lib/organization-member-normalization';
import { Loader2, AlertCircle, LogOut } from 'lucide-react';
import { User, signOut } from 'firebase/auth';
import { isDemoEnv } from '@/lib/demo/isDemoOrg';
import { broadcastLogoutSync } from '@/lib/session-sync';

interface OrganizationContextType {
  organization: Organization | null;
  organizationId: string | null;
  orgSlug: string | null;
  userProfile: UserProfile | null;
  member: OrganizationMember | null;
  userRole: OrganizationRole | null;
  firebaseUser: User | null;
  isLoading: boolean;
  error: Error | null;
}

export const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

interface OrganizationProviderProps {
  children: ReactNode;
  orgSlug?: string; // Slug opcional - si no es passa, es carrega la primera org de l'usuari
}

/**
 * Detecta si un error és un error de permisos de Firestore/Firebase
 */
function isPermissionDenied(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  // Check Firebase error code first (més fiable)
  const code = (err as any)?.code;
  if (code === 'permission-denied') return true;
  return msg.includes('permission') || msg.includes('permission-denied') || msg.includes('missing or insufficient');
}

/**
 * Classe d'error específica per accés denegat per Firestore Rules
 * (diferent d'errors tècnics com network, unavailable, etc.)
 */
class AccessDeniedError extends Error {
  constructor(message: string = 'No tens accés a aquesta organització') {
    super(message);
    this.name = 'AccessDeniedError';
  }
}

/**
 * Hook intern per carregar l'organització pel slug o per l'usuari
 */
function useOrganizationBySlug(orgSlug?: string) {
  const { firestore, user, isUserLoading } = useFirebase();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextPath = React.useMemo(() => {
    const currentQuery = searchParams.toString();
    return currentQuery ? `${pathname}?${currentQuery}` : pathname;
  }, [pathname, searchParams]);

  const [organization, setOrganization] = React.useState<Organization | null>(null);
  const [organizationId, setOrganizationId] = React.useState<string | null>(null);
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [member, setMember] = React.useState<OrganizationMember | null>(null);
  const [userRole, setUserRole] = React.useState<OrganizationRole | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (isUserLoading || user) {
      return;
    }

    // Si no hi ha usuari autenticat, redirigim a login preservant la ruta actual.
    // Mantenim el spinner i no reinicialitzem l'organització en cada canvi de pestanya.
    const nextParam = encodeURIComponent(nextPath);
    const loginPath = orgSlug ? `/${orgSlug}/login` : '/login';
    router.replace(`${loginPath}?next=${nextParam}`);
  }, [isUserLoading, nextPath, orgSlug, router, user]);

  React.useEffect(() => {
    if (isUserLoading || !user) {
      return;
    }

    let isCancelled = false;

    const runIfActive = (callback: () => void) => {
      if (!isCancelled) {
        callback();
      }
    };

    const resetOrganizationState = () => {
      runIfActive(() => setIsLoading(true));
      runIfActive(() => setError(null));
      runIfActive(() => setOrganization(null));
      runIfActive(() => setOrganizationId(null));
      runIfActive(() => setUserProfile(null));
      runIfActive(() => setMember(null));
      // Evita rols stale entre canvis d'organització (important per queries protegides)
      runIfActive(() => setUserRole(null));
    };

    const loadOrganization = async () => {
      resetOrganizationState();

      try {
        let orgDoc: Organization | null = null;
        let orgId: string | null = null;

        if (orgSlug) {
          // ═══════════════════════════════════════════════════════════════════
          // CARREGA PER SLUG (via /slugs/{slug} → orgId → /organizations/{orgId})
          // Això evita fer query amb where() que requereix permisos de lectura global
          // ═══════════════════════════════════════════════════════════════════

          // 1. Llegir el document de slug (públic, allow read: if true)
          const slugRef = doc(firestore, 'slugs', orgSlug);
          const slugSnap = await getDoc(slugRef);

          if (!slugSnap.exists()) {
            throw new Error(`No s'ha trobat l'organització "${orgSlug}"`);
          }

          const slugData = slugSnap.data();
          orgId = slugData.orgId;

          if (!orgId) {
            throw new Error(`Slug "${orgSlug}" no té organització associada`);
          }

          // ═══════════════════════════════════════════════════════════════════
          // 2. CANARY READ: Llegir l'organització directament pel seu ID
          // Si Firestore permet la lectura, l'usuari té accés (via rules).
          // Si retorna permission-denied, no té accés.
          // El client NO decideix permisos — les rules són l'autoritat.
          // ═══════════════════════════════════════════════════════════════════
          const orgRef = doc(firestore, 'organizations', orgId);
          let orgSnap;
          try {
            orgSnap = await getDoc(orgRef);
          } catch (readErr) {
            // Si és permission-denied, convertir a AccessDeniedError
            if (isPermissionDenied(readErr)) {
              console.log('[ORG_PROVIDER] Canary read failed: permission-denied for org', orgId);
              throw new AccessDeniedError();
            }
            // Altres errors (network, unavailable) es propaguen
            throw readErr;
          }

          if (!orgSnap.exists()) {
            throw new Error(`No s'ha trobat l'organització amb ID "${orgId}"`);
          }

          orgDoc = { id: orgId, ...orgSnap.data() } as Organization;

          // ═══════════════════════════════════════════════════════════════════
          // 3. Carregar rol de l'usuari (per UI, no per decidir accés)
          // L'accés ja està validat pel canary read anterior.
          // ═══════════════════════════════════════════════════════════════════
          const memberRef = doc(firestore, 'organizations', orgId, 'members', user.uid);
          try {
            const memberSnap = await getDoc(memberRef);
            if (memberSnap.exists()) {
              const normalizedMember = normalizeOrganizationMember(memberSnap.data(), {
                userId: user.uid,
                email: user.email ?? '',
                displayName: user.displayName ?? '',
              });
              runIfActive(() => setUserRole(normalizedMember.role));
            } else {
              // No és membre directe, però té accés (SuperAdmin o hasOrgInProfile via rules)
              // Comportament esperat per SuperAdmins: poden accedir a qualsevol org sense membership.
              // Per UI, assignem rol admin (SuperAdmin) o viewer (altres casos edge).
              if (!isDemoEnv()) {
                const saRef = doc(firestore, 'systemSuperAdmins', user.uid);
                const saSnap = await getDoc(saRef);
                const isSuperAdmin = saSnap.exists();
                if (process.env.NODE_ENV !== 'production') {
                  console.debug('[ORG_PROVIDER] Access without membership:', isSuperAdmin ? 'SuperAdmin' : 'hasOrgInProfile', 'uid=', user.uid);
                }
                runIfActive(() => setUserRole(isSuperAdmin ? 'admin' : 'viewer'));
              } else {
                // DEMO: assignar admin a tots
                runIfActive(() => setUserRole('admin'));
              }
            }
          } catch {
            // Si falla la lectura del membre (permission-denied), assumim viewer
            // (l'accés a l'org ja està validat pel canary)
            if (process.env.NODE_ENV !== 'production') {
              console.debug('[ORG_PROVIDER] Member read failed, assuming viewer role');
            }
            runIfActive(() => setUserRole('viewer'));
          }

        } else {
          // ═══════════════════════════════════════════════════════════════════
          // CARREGA PER USUARI (comportament antic - per compatibilitat)
          // ═══════════════════════════════════════════════════════════════════

          // 1. Primer intentar carregar organització per defecte del perfil
          const userProfileRef = doc(firestore, 'users', user.uid);
          const userProfileSnap = await getDoc(userProfileRef);

          if (userProfileSnap.exists()) {
            const profileData = userProfileSnap.data();
            if (profileData.defaultOrganizationId) {
              orgId = profileData.defaultOrganizationId;
            }
          }

          // 2. Si no té organització per defecte, usar collectionGroup query
          // Això és molt més eficient que iterar per totes les organitzacions
          if (!orgId) {
            // Query directa a totes les subcol·leccions "members" on l'usuari és membre
            // Nota: No podem usar __name__ amb collectionGroup, cal usar el camp userId
            const membersQuery = query(
              collectionGroup(firestore, 'members'),
              where('userId', '==', user.uid),
              limit(1)
            );
            const membersSnapshot = await getDocs(membersQuery);

            if (!membersSnapshot.empty) {
              const memberDoc = membersSnapshot.docs[0];
              const normalizedMember = normalizeOrganizationMember(memberDoc.data(), {
                userId: user.uid,
                email: user.email ?? '',
                displayName: user.displayName ?? '',
              });
              // Extreure l'orgId del path: organizations/{orgId}/members/{userId}
              const pathParts = memberDoc.ref.path.split('/');
              orgId = pathParts[1]; // organizations/{orgId}/members/{userId}
              runIfActive(() => setUserRole(normalizedMember.role));
            }
          }

          // 3. Carregar les dades de l'organització
          if (orgId) {
            const orgRef = doc(firestore, 'organizations', orgId);
            const orgSnap = await getDoc(orgRef);
            if (orgSnap.exists()) {
              orgDoc = { id: orgId, ...orgSnap.data() } as Organization;
            }
          }
        }

        if (!orgDoc || !orgId) {
          throw new Error('No s\'ha trobat cap organització');
        }

        // ═══════════════════════════════════════════════════════════════════
        // GENERACIÓ AUTOMÀTICA DE SLUG
        // Si l'organització no té slug, el generem i reservem
        // ═══════════════════════════════════════════════════════════════════
        if (!orgDoc.slug) {
          console.log(`Organització "${orgDoc.name}" no té slug, generant...`);
          const newSlug = await generateUniqueSlug(firestore, orgDoc.name, orgId);

          // Reservar el slug (crea a /slugs i actualitza l'organització)
          await reserveSlug(firestore, orgId, newSlug, orgDoc.name);

          // Actualitzar l'objecte local
          orgDoc = { ...orgDoc, slug: newSlug };
          console.log(`Slug generat i reservat: "${newSlug}"`);
        }

        if (isCancelled) {
          return;
        }

        runIfActive(() => setOrganization(orgDoc));
        runIfActive(() => setOrganizationId(orgId));

        // Carregar perfil + dades de membre (permisos granulars)
        const profileRef = doc(firestore, 'organizations', orgId, 'members', user.uid);
        try {
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            const profileData = profileSnap.data();
            const normalizedMember = normalizeOrganizationMember(profileData, {
              userId: user.uid,
              email: user.email ?? '',
              displayName: user.displayName ?? '',
            });

            runIfActive(() => setUserProfile({
              organizationId: profileData.organizationId ?? orgId,
              role: normalizedMember.role,
              displayName: normalizedMember.displayName,
              email: normalizedMember.email || user.email || undefined,
              organizations: profileData.organizations,
            }));

            runIfActive(() => setMember(normalizedMember));
            runIfActive(() => setUserRole(normalizedMember.role));
          } else {
            runIfActive(() => setUserProfile(null));
            runIfActive(() => setMember(null));
          }
        } catch {
          if (process.env.NODE_ENV !== 'production') {
            console.debug('[ORG_PROVIDER] Member profile read failed');
          }
          runIfActive(() => setUserProfile(null));
          runIfActive(() => setMember(null));
        }

      } catch (err) {
        if (isCancelled) {
          return;
        }

        // AccessDeniedError: accés denegat per Firestore Rules (canary read failed)
        if (err instanceof AccessDeniedError) {
          console.log('[ORG_PROVIDER] Access denied by Firestore Rules');
          runIfActive(() => setError(err));
        } else if (isPermissionDenied(err)) {
          // Error de permisos genèric de Firestore
          console.log('[ORG_PROVIDER] Permission denied error:', (err as any)?.code || err);
          runIfActive(() => setError(new AccessDeniedError()));
        } else {
          // Altres errors (network, not found, etc.)
          if (!isDemoEnv()) {
            console.error('[ORG_PROVIDER] Error loading organization:', err);
          }
          runIfActive(() => setError(err instanceof Error ? err : new Error('Error desconegut')));
        }
      } finally {
        runIfActive(() => setIsLoading(false));
      }
    };

    loadOrganization();
    return () => {
      isCancelled = true;
    };
  }, [firestore, isUserLoading, orgSlug, user]);

  return {
    organization,
    organizationId,
    orgSlug: organization?.slug || orgSlug || null,
    userProfile,
    member,
    userRole,
    firebaseUser: user,
    isLoading: isLoading || isUserLoading,
    error,
  };
}

/**
 * Provider que gestiona l'organització actual i la fa disponible a tots els components.
 * Ara accepta un orgSlug opcional per carregar l'organització des de la URL.
 */
export function OrganizationProvider({ children, orgSlug }: OrganizationProviderProps) {
  const organizationData = useOrganizationBySlug(orgSlug);
  const { auth } = useFirebase();
  const router = useRouter();

  // Handler per tancar sessió
  // HARD REDIRECT: Usem window.location.assign per desmuntar tota l'app
  // immediatament i evitar que el dashboard es mostri buit durant la transició.
  const handleLogout = async () => {
    const loginUrl = orgSlug ? `/${orgSlug}/login` : '/';
    broadcastLogoutSync('access_denied');
    try {
      await signOut(auth);
    } catch (err) {
      console.error('[ORG_PROVIDER] Error signing out:', err);
    }
    // Hard redirect sempre, fins i tot si signOut falla
    window.location.assign(loginUrl);
  };

  // Mentre es carrega, mostrar un indicador
  if (organizationData.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregant organització...</p>
        </div>
      </div>
    );
  }

  // Si hi ha error, mostrar-lo
  if (organizationData.error) {
    const isAccessDenied = organizationData.error instanceof AccessDeniedError
      || organizationData.error.message.includes('No tens accés');

    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center p-4 max-w-md">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-destructive font-semibold text-lg">
            {isAccessDenied ? 'Accés denegat' : 'Error carregant l\'organització'}
          </p>
          <p className="text-muted-foreground">
            {isAccessDenied
              ? 'Aquest usuari no té accés a aquesta organització. Contacta amb l\'administrador o inicia sessió amb un altre compte.'
              : organizationData.error.message}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 mt-4 w-full sm:w-auto">
            {/* Botó principal: Tancar sessió (per errors d'accés) o Anar al panell (altres) */}
            {isAccessDenied ? (
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90"
              >
                <LogOut className="h-4 w-4" />
                Tancar sessió
              </button>
            ) : (
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Anar al panell
              </button>
            )}
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
            >
              Tornar a l'inici
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Si no hi ha organització (estat transitori, ex: redirect en curs), mostrar spinner
  // Això evita pàgina en blanc en cas de race condition
  if (!organizationData.organization) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregant...</p>
        </div>
      </div>
    );
  }

  return (
    <OrganizationContext.Provider value={organizationData}>
      {children}
    </OrganizationContext.Provider>
  );
}

/**
 * Hook per accedir a l'organització actual des de qualsevol component.
 * Ara també proporciona el slug de l'organització per construir URLs.
 *
 * Ús:
 * ```typescript
 * const { organizationId, orgSlug, userRole } = useCurrentOrganization();
 *
 * // Construir enllaços:
 * const dashboardUrl = `/${orgSlug}/dashboard`;
 * const movimentsUrl = `/${orgSlug}/dashboard/movimientos`;
 * ```
 */
export function useCurrentOrganization(): OrganizationContextType {
  const context = useContext(OrganizationContext);

  if (context === undefined) {
    throw new Error('useCurrentOrganization must be used within an OrganizationProvider');
  }

  return context;
}

/**
 * Hook helper per construir URLs amb el slug de l'organització actual.
 *
 * Ús:
 * ```typescript
 * const { buildUrl } = useOrgUrl();
 *
 * // Retorna: "/flores-kiskeya/dashboard/movimientos"
 * const url = buildUrl('/dashboard/movimientos');
 * ```
 */
export function useOrgUrl() {
  const { orgSlug } = useCurrentOrganization();

  const buildUrl = React.useCallback((path: string): string => {
    if (!orgSlug) {
      // Fallback a URLs sense slug (no s'hauria d'arribar aquí si el component
      // comprova orgSlug abans de renderitzar links)
      return path;
    }

    // Eliminar /dashboard del principi si existeix, perquè l'afegirem amb el slug
    const cleanPath = path.startsWith('/dashboard')
      ? path
      : `/dashboard${path.startsWith('/') ? path : '/' + path}`;

    return `/${orgSlug}${cleanPath}`;
  }, [orgSlug]);

  return { orgSlug, buildUrl };
}
