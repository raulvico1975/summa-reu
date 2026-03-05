'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  LayoutDashboard,
  Settings,
  LogOut,
  FileText,
  FolderKanban,
  AreaChart,
  Shield,
  Heart,
  Building2,
  UserCog,
  ClipboardList,
  ChevronRight,
  Lightbulb,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/i18n';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { useCurrentOrganization, useOrgUrl } from '@/hooks/organization-provider';
import { usePermissions } from '@/hooks/use-permissions';
import type { PermissionKey } from '@/lib/permissions';

const SUPER_ADMIN_UID = 'f2AHJqjXiOZkYajwkOnZ8RY6h2k2';

export function DashboardSidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const { auth: firebaseAuth } = useFirebase();
  const { t } = useTranslations();
  const { toast } = useToast();
  const { state: sidebarState, isMobile, setOpenMobile } = useSidebar();
  const { can, canAccessProjectsArea } = usePermissions();

  // Obtenir dades de l'organització i el helper per construir URLs
  const { userProfile, firebaseUser, organization, orgSlug } = useCurrentOrganization();

  // Handler per tancar el sidebar en mòbil després de navegar
  const handleNavClick = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, setOpenMobile]);
  const { buildUrl } = useOrgUrl();

  const isSuperAdmin = firebaseUser?.uid === SUPER_ADMIN_UID;
  // En mòbil, el sidebar sempre es mostra expandit (dins d'un Sheet)
  // Només considerem col·lapsat en desktop quan state === 'collapsed'
  const isSidebarCollapsed = !isMobile && sidebarState === 'collapsed';

  const handleSignOut = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    try {
      // Guardar el slug abans de tancar sessió per poder redirigir després
      const savedOrgSlug = orgSlug;

      // Netejar sessionStorage si el Super Admin estava veient una altra org
      sessionStorage.removeItem('adminViewingOrgId');

      await firebaseSignOut(firebaseAuth);

      toast({ title: t.sidebar.logoutToastTitle, description: t.sidebar.logoutToastDescription });

      // Redirigir al login de l'organització, no a la home pública
      if (savedOrgSlug) {
        router.push(`/${savedOrgSlug}/login`);
      } else {
        router.push('/login');
      }
      router.refresh();

    } catch (error) {
       console.error("Error signing out: ", error);
       toast({ variant: 'destructive', title: t.common.error, description: t.sidebar.logoutError });
    }
  };

  // Feature flag: Mòdul Projectes
  const isProjectModuleEnabled = organization?.features?.projectModule ?? false;

  // ═══════════════════════════════════════════════════════════════════════════
  // CANVI PRINCIPAL: Construir URLs amb el slug de l'organització
  // ═══════════════════════════════════════════════════════════════════════════

  // Items del submenú Projectes (Mòdul)
  const projectModuleItems = React.useMemo(() => {
    if (!isProjectModuleEnabled || !canAccessProjectsArea) return [];

    const items = [];
    if (can('projectes.manage')) {
      items.push({
        path: '/dashboard/project-module/projects',
        label: t.sidebar.projectModuleManage ?? 'Gestió de projectes',
        icon: FolderKanban,
      });
    }
    items.push({
      path: '/dashboard/project-module/expenses',
      label: t.sidebar.projectModuleExpenses ?? 'Assignació de despeses',
      icon: ClipboardList,
    });

    return items.map(item => ({
      ...item,
      href: buildUrl(item.path),
    }));
  }, [t, isProjectModuleEnabled, canAccessProjectsArea, can, buildUrl]);

  // Comprovar si estem en una ruta del mòdul projectes
  const isProjectModuleActive = React.useMemo(() => {
    return pathname.includes('/project-module');
  }, [pathname]);

  const menuItems = React.useMemo(() => {
    const baseItems = [
      {
        path: '/dashboard',
        label: t.sidebar.dashboard,
        icon: LayoutDashboard,
      },
      {
        path: '/dashboard/movimientos',
        label: t.sidebar.movements,
        icon: FileText,
      },
      {
        path: '/dashboard/projectes',
        label: t.sidebar.projects,
        icon: FolderKanban,
      },
      {
        path: '/dashboard/donants',
        label: t.sidebar.donors,
        icon: Heart,
        className: 'text-red-500',
      },
     {
        path: '/dashboard/proveidors',
        label: t.sidebar.suppliers,
        icon: Building2,
        className: 'text-blue-500',
      },
      {
        path: '/dashboard/treballadors',
        label: t.sidebar.employees,
        icon: UserCog,
        className: 'text-purple-500',
      },
      {
        path: '/dashboard/informes',
        label: t.sidebar.reports,
        icon: AreaChart,
      },
    ];

    // Afegir guies
    baseItems.push({
      path: '/dashboard/guides',
      label: t.sidebar.guides ?? 'Guies',
      icon: Lightbulb,
      className: 'text-amber-500',
    });

    // Afegir configuració
    baseItems.push({
      path: '/dashboard/configuracion',
      label: t.sidebar.settings,
      icon: Settings,
    });

    // Afegir opció Super Admin si l'usuari ho és
    if (isSuperAdmin) {
      baseItems.push({
        path: '/dashboard/super-admin',
        label: t.sidebar.superAdmin,
        icon: Shield,
        className: 'text-purple-500',
      });
    }

    const sectionByPath: Partial<Record<string, PermissionKey>> = {
      '/dashboard/movimientos': 'sections.moviments',
      '/dashboard/projectes': 'sections.projectes',
      '/dashboard/donants': 'sections.donants',
      '/dashboard/proveidors': 'sections.proveidors',
      '/dashboard/treballadors': 'sections.treballadors',
      '/dashboard/informes': 'sections.informes',
      '/dashboard/configuracion': 'sections.configuracio',
      '/dashboard/guides': 'sections.guides',
    };

    const visibleItems = baseItems.filter(item => {
      if (item.path === '/dashboard/projectes') {
        return canAccessProjectsArea;
      }
      const requiredSection = sectionByPath[item.path];
      if (!requiredSection) return true;
      return can(requiredSection);
    });

    // Construir URLs amb el slug
    return visibleItems.map(item => ({
      ...item,
      href: buildUrl(item.path),
    }));
  }, [t, isSuperAdmin, can, canAccessProjectsArea, buildUrl]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Helper per comprovar si una ruta està activa
  // Ara funciona amb URLs que inclouen el slug
  // ═══════════════════════════════════════════════════════════════════════════
  const isActive = React.useCallback((href: string, path: string) => {
    // Si estem a la pàgina principal del dashboard
    if (path === '/dashboard') {
      // Comprovar si el pathname acaba amb /dashboard (amb o sense slug)
      return pathname.endsWith('/dashboard') && !pathname.includes('/dashboard/');
    }
    
    // Per altres pàgines, comprovar si el pathname conté el path
    const pathSuffix = path.replace('/dashboard', '');
    return pathname.includes(pathSuffix) && pathSuffix !== '';
  }, [pathname]);

  const getInitials = (name: string | null | undefined): string => {
    if (!name || name === t.sidebar.anonymousUser) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length > 1 && parts[0] && parts[1]) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    if (parts[0] && parts[0].length > 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };
  
  // Obtenir el nom de l'usuari
  const userName = React.useMemo(() => {
    if (userProfile?.displayName) {
      return userProfile.displayName;
    }
    if (firebaseUser?.displayName) {
      return firebaseUser.displayName;
    }
    if (firebaseUser?.email) {
      return firebaseUser.email.split('@')[0];
    }
    return t.sidebar.anonymousUser;
  }, [userProfile, firebaseUser, t.sidebar.anonymousUser]);

  const userInitials = getInitials(userName);

  // No renderitzar el menú fins que orgSlug estigui disponible
  // per evitar que Cmd+click generi URLs sense slug
  if (!orgSlug) {
    return (
      <>
        <SidebarHeader className="border-b">
          <div className="flex items-center gap-2 p-2 group-data-[collapsible=icon]:justify-center">
            <Logo className="h-8 w-8 text-primary" />
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <span className="text-lg font-semibold font-headline">Summa Social</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="flex-1 p-2" />
        <SidebarFooter className="border-t p-2" />
      </>
    );
  }

  return (
    <>
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 p-2 group-data-[collapsible=icon]:justify-center">
          <Logo className="h-8 w-8 text-primary" />
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-lg font-semibold font-headline">Summa Social</span>
            {/* ═══════════════════════════════════════════════════════════════
                NOU: Mostrar el nom de l'organització actual
                ═══════════════════════════════════════════════════════════════ */}
            {organization && (
              <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                {organization.name}
              </span>
            )}
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="flex-1 p-2">
        <SidebarMenu>
          {menuItems.map((item) => {
            // Inserir el submenú Projectes després d'Informes
            if (item.path === '/dashboard/configuracion' && projectModuleItems.length > 0) {
              // Quan sidebar col·lapsada: link directe (no collapsible)
              // Quan sidebar expandida: submenú desplegable
              const projectModuleMainHref = projectModuleItems[0]?.href ?? buildUrl('/dashboard/project-module/expenses');

              return (
                <React.Fragment key={item.href}>
                  {/* Submenú Projectes (Mòdul) */}
                  {isSidebarCollapsed ? (
                    // Mode col·lapsat: link directe a la pàgina principal del mòdul
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        tooltip={{ children: t.sidebar.projectModule ?? 'Projectes' }}
                        isActive={isProjectModuleActive}
                      >
                        <Link href={projectModuleMainHref} onClick={handleNavClick}>
                          <FolderKanban className="text-emerald-600" />
                          <span>{t.sidebar.projectModule ?? 'Projectes'}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ) : (
                    // Mode expandit: submenú desplegable
                    <Collapsible
                      asChild
                      defaultOpen={isProjectModuleActive}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            tooltip={{ children: t.sidebar.projectModule ?? 'Projectes' }}
                            isActive={isProjectModuleActive}
                          >
                            <FolderKanban className="text-emerald-600" />
                            <span>{t.sidebar.projectModule ?? 'Projectes'}</span>
                            <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {projectModuleItems.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.href}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname.includes(subItem.path.replace('/dashboard', ''))}
                                >
                                  <Link href={subItem.href} onClick={handleNavClick}>
                                    <subItem.icon className="h-4 w-4" />
                                    <span>{subItem.label}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )}

                  {/* Configuració */}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href, item.path)}
                      tooltip={{ children: item.label }}
                    >
                      <Link href={item.href} onClick={handleNavClick}>
                        <item.icon className={item.className} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </React.Fragment>
              );
            }

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.href, item.path)}
                  tooltip={{ children: item.label }}
                >
                  <Link href={item.href} onClick={handleNavClick}>
                    <item.icon className={item.className} />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="#">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={firebaseUser?.photoURL ?? undefined} alt="User Avatar" data-ai-hint="user avatar" />
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
                <span>{userName}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {isSuperAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === '/admin'}
                tooltip={{children: t.sidebar.adminPanel}}
              >
                <Link href="/admin" onClick={handleNavClick}>
                  <Shield className="text-amber-500" />
                  <span>{t.sidebar.adminPanel}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={{children: t.sidebar.privacy}}>
              <a href="/privacy" target="_blank" rel="noopener noreferrer">
                <Shield className="h-4 w-4" />
                <span>{t.sidebar.privacy}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
             <SidebarMenuButton asChild tooltip={{children: t.sidebar.logout}}>
                <Link href="/" onClick={handleSignOut}>
                  <LogOut />
                  <span>{t.sidebar.logout}</span>
                </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
