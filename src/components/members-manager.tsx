'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { useTranslations } from '@/i18n';
import { collection, doc, deleteDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { Users, UserPlus, MoreHorizontal, Trash2, Shield, User, Eye, Clock, Loader2, Download, Upload, MoreVertical } from 'lucide-react';
import type { OrganizationMember, OrganizationRole, Invitation } from '@/lib/data';
import { InviteMemberDialog } from './invite-member-dialog';
import { MemberInviterImporter } from './member-inviter-importer';
import { exportMembersToExcel, downloadMembersInviteTemplate } from '@/lib/members-export';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { MobileListItem } from '@/components/mobile/mobile-list-item';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { MOBILE_ACTIONS_BAR, MOBILE_CTA_PRIMARY } from '@/lib/ui/mobile-actions';
import { MembersUserPermissionsDialog } from '@/components/members-user-permissions-dialog';
import { isUserPermissionsCustomized } from '@/lib/permissions';

export function MembersManager() {
  const { firestore, user } = useFirebase();
  const { organizationId, userRole } = useCurrentOrganization();
  const { toast } = useToast();
  const { t, tr, language } = useTranslations();
  const isMobile = useIsMobile();

  // Col·leccions
  const membersCollection = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'members') : null,
    [firestore, organizationId]
  );

  const { data: members, isLoading: membersLoading } = useCollection<OrganizationMember>(membersCollection);

  // Invitacions pendents
  // NOTA: Només admins de l'org poden llistar invitacions (via Firestore Rules).
  // useCollection pot fallar amb permission-denied si l'usuari no és admin.
  // El hook useCollection ha de capturar l'error i no trencar la UI.
  const invitationsQuery = useMemoFirebase(
    // Només fer la query si l'usuari és admin (evitem errors permission-denied)
    () => (organizationId && userRole === 'admin') ? query(
      collection(firestore, 'invitations'),
      where('organizationId', '==', organizationId)
    ) : null,
    [firestore, organizationId, userRole]
  );

  const { data: allInvitations } = useCollection<Invitation>(invitationsQuery);

  // Filtrar només les invitacions pendents (no usades i no expirades)
  const pendingInvitations = React.useMemo(() => {
    if (!allInvitations) return [];
    const now = new Date();
    return allInvitations.filter(inv => 
      !inv.usedAt && new Date(inv.expiresAt) > now
    );
  }, [allInvitations]);

  // Estats
  const [isInviteDialogOpen, setIsInviteDialogOpen] = React.useState(false);
  const [isImporterOpen, setIsImporterOpen] = React.useState(false);
  const [memberToDelete, setMemberToDelete] = React.useState<OrganizationMember | null>(null);
  const [memberToEditPermissions, setMemberToEditPermissions] = React.useState<OrganizationMember | null>(null);
  const [invitationToDelete, setInvitationToDelete] = React.useState<Invitation | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const isAdmin = userRole === 'admin';

  const openUserPermissionsDialog = React.useCallback((target: OrganizationMember) => {
    // Patró Radix intern: quan obrim una modal des d'un menú, fem blur + defer
    // per evitar bloquejos de focus/overlay en tancar.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.setTimeout(() => {
      setMemberToEditPermissions(target);
    }, 0);
  }, []);

  const getRoleBadge = (role: OrganizationRole) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-300"><Shield className="w-3 h-3 mr-1" />{t.members.roleAdmin}</Badge>;
      case 'user':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300"><User className="w-3 h-3 mr-1" />{t.members.roleUser}</Badge>;
      case 'viewer':
        return <Badge variant="secondary"><Eye className="w-3 h-3 mr-1" />{t.members.roleViewer}</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getUserRoleStatusLabel = (member: OrganizationMember): string | null => {
    if (member.role !== 'user') return null;
    return isUserPermissionsCustomized(member.userOverrides, member.userGrants)
      ? t.members.roleUserCustomized
      : t.members.roleUserDefault;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ca-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const handleChangeRole = async (member: OrganizationMember, newRole: OrganizationRole) => {
    if (!membersCollection || member.userId === user?.uid) return;

    setIsProcessing(true);
    try {
      await updateDoc(doc(membersCollection, member.userId), {
        role: newRole,
        updatedAt: new Date().toISOString(),
      });

      // També actualitzar el perfil d'usuari
      await updateDoc(doc(firestore, 'users', member.userId), {
        role: newRole,
      });

      toast({
        title: t.members.roleUpdated,
        description: t.members.roleUpdatedDescription(member.displayName || member.email, t.members[`role${newRole.charAt(0).toUpperCase() + newRole.slice(1)}` as keyof typeof t.members] as string),
      });
    } catch (error) {
      console.error('Error updating role:', error);
      toast({ variant: 'destructive', title: t.common.error, description: t.members.errorUpdatingRole });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete || !membersCollection) return;

    setIsProcessing(true);
    try {
      await deleteDoc(doc(membersCollection, memberToDelete.userId));

      toast({
        title: t.members.memberRemoved,
        description: t.members.memberRemovedDescription(memberToDelete.displayName || memberToDelete.email),
      });
    } catch (error) {
      console.error('Error deleting member:', error);
      toast({ variant: 'destructive', title: t.common.error, description: t.members.errorRemovingMember });
    } finally {
      setIsProcessing(false);
      setMemberToDelete(null);
    }
  };

  const handleDeleteInvitation = async () => {
    if (!invitationToDelete) return;

    setIsProcessing(true);
    try {
      await deleteDoc(doc(firestore, 'invitations', invitationToDelete.id));

      toast({
        title: t.members.invitationCancelled,
        description: t.members.invitationCancelledDescription(invitationToDelete.email || ''),
      });
    } catch (error) {
      console.error('Error deleting invitation:', error);
      toast({ variant: 'destructive', title: t.common.error, description: t.members.errorCancellingInvitation });
    } finally {
      setIsProcessing(false);
      setInvitationToDelete(null);
    }
  };

  if (membersLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className={cn("flex flex-col gap-4", "sm:flex-row sm:items-center sm:justify-between")}>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t.members.title}
            </CardTitle>
            <CardDescription>
              {t.members.description}
            </CardDescription>
          </div>
          {isAdmin && (
            <div className={cn(MOBILE_ACTIONS_BAR, "sm:justify-end")}>
              {/* Convidar membre individual */}
              <Button onClick={() => setIsInviteDialogOpen(true)} className={MOBILE_CTA_PRIMARY}>
                <UserPlus className="mr-2 h-4 w-4" />
                {t.members.inviteMember}
              </Button>
              <div className="flex gap-2">
                {/* Importar invitacions massives */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsImporterOpen(true)}
                  title={tr('members.importInvitations')}
                >
                  <Upload className="h-4 w-4" />
                </Button>
                {/* Exportar membres */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => exportMembersToExcel(members || [], undefined, language)}
                  disabled={!members || members.length === 0}
                  title={tr('members.exportMembers')}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Membres actius */}
          <div>
            <h3 className="text-sm font-medium mb-3">{t.members.activeMembers} ({members?.length || 0})</h3>
            {isMobile ? (
              <div className="flex flex-col gap-2">
                {membersLoading && (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={`skeleton-${i}`} className="border border-border/50 rounded-lg p-3">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  ))
                )}
                {members && members.length > 0 ? (
                  members.map((member) => {
                    const userRoleStatusLabel = getUserRoleStatusLabel(member);
                    return (
                      <MobileListItem
                        key={member.id || member.userId}
                        title={
                          <div>
                            <span>{member.displayName || t.members.noName}</span>
                            {member.userId === user?.uid && (
                              <span className="text-xs text-muted-foreground ml-1">({t.members.you})</span>
                            )}
                          </div>
                        }
                        leadingIcon={<User className="h-4 w-4" />}
                        badges={[getRoleBadge(member.role)]}
                        meta={[
                          { value: member.email },
                          ...(userRoleStatusLabel ? [{ value: userRoleStatusLabel }] : []),
                          { label: t.members.joinedAt, value: formatDate(member.joinedAt) },
                        ]}
                        actions={
                          isAdmin && member.userId !== user?.uid ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleChangeRole(member, 'admin')}>
                                  <Shield className="mr-2 h-4 w-4" />
                                  {t.members.roleAdmin}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleChangeRole(member, 'user')}>
                                  <User className="mr-2 h-4 w-4" />
                                  {t.members.roleUser}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleChangeRole(member, 'viewer')}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  {t.members.roleViewer}
                                </DropdownMenuItem>
                                {member.role === 'user' && (
                                  <DropdownMenuItem onClick={() => openUserPermissionsDialog(member)}>
                                    <Shield className="mr-2 h-4 w-4" />
                                    {tr('members.permissions')}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setMemberToDelete(member)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {t.members.removeMember}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : undefined
                        }
                      />
                    );
                  })
                ) : (
                  <div className="text-center text-muted-foreground py-12">
                    {t.members.noMembers}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.members.member}</TableHead>
                      <TableHead>{t.members.role}</TableHead>
                      <TableHead>{t.members.joinedAt}</TableHead>
                      {isAdmin && <TableHead className="w-[80px]">{t.members.actions}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members && members.length > 0 ? (
                      members.map((member) => {
                        const userRoleStatusLabel = getUserRoleStatusLabel(member);
                        return (
                          <TableRow key={member.id || member.userId}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{member.displayName || t.members.noName}</div>
                                <div className="text-sm text-muted-foreground">{member.email}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {isAdmin && member.userId !== user?.uid ? (
                                <div className="space-y-1">
                                  <Select
                                    value={member.role}
                                    onValueChange={(value) => handleChangeRole(member, value as OrganizationRole)}
                                    disabled={isProcessing}
                                  >
                                    <SelectTrigger className="w-[140px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="admin">{t.members.roleAdmin}</SelectItem>
                                      <SelectItem value="user">{t.members.roleUser}</SelectItem>
                                      <SelectItem value="viewer">{t.members.roleViewer}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {userRoleStatusLabel && (
                                    <p className="text-xs text-muted-foreground">{userRoleStatusLabel}</p>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  {getRoleBadge(member.role)}
                                  {userRoleStatusLabel && (
                                    <span className="text-xs text-muted-foreground">{userRoleStatusLabel}</span>
                                  )}
                                  {member.userId === user?.uid && (
                                    <span className="text-xs text-muted-foreground">({t.members.you})</span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(member.joinedAt)}
                            </TableCell>
                            {isAdmin && (
                              <TableCell>
                                {member.userId !== user?.uid && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {member.role === 'user' && (
                                        <DropdownMenuItem onClick={() => openUserPermissionsDialog(member)}>
                                          <Shield className="mr-2 h-4 w-4" />
                                          {tr('members.permissions')}
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem
                                        onClick={() => setMemberToDelete(member)}
                                        className="text-destructive"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        {t.members.removeMember}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 4 : 3} className="text-center text-muted-foreground h-24">
                          {t.members.noMembers}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Invitacions pendents */}
          {isAdmin && pendingInvitations.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t.members.pendingInvitations} ({pendingInvitations.length})
              </h3>
              {isMobile ? (
                <div className="flex flex-col gap-2">
                  {pendingInvitations.map((invitation) => (
                    <MobileListItem
                      key={invitation.id}
                      title={invitation.email}
                      leadingIcon={<Clock className="h-4 w-4 text-amber-500" />}
                      badges={[getRoleBadge(invitation.role)]}
                      meta={[
                        { label: t.members.expiresAt, value: formatDate(invitation.expiresAt) },
                      ]}
                      actions={
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setInvitationToDelete(invitation)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.members.email}</TableHead>
                        <TableHead>{t.members.role}</TableHead>
                        <TableHead>{t.members.expiresAt}</TableHead>
                        <TableHead className="w-[80px]">{t.members.actions}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingInvitations.map((invitation) => (
                        <TableRow key={invitation.id}>
                          <TableCell className="font-medium">{invitation.email}</TableCell>
                          <TableCell>{getRoleBadge(invitation.role)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(invitation.expiresAt)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setInvitationToDelete(invitation)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diàleg d'invitació */}
      <InviteMemberDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
      />

      {/* Confirmació eliminar membre */}
      <AlertDialog open={!!memberToDelete} onOpenChange={() => setMemberToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.members.confirmRemoveTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.members.confirmRemoveDescription(memberToDelete?.displayName || memberToDelete?.email || '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMember}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.members.removeMember}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmació cancel·lar invitació */}
      <AlertDialog open={!!invitationToDelete} onOpenChange={() => setInvitationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.members.confirmCancelInvitationTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.members.confirmCancelInvitationDescription(invitationToDelete?.email || '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteInvitation}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.members.cancelInvitation}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Importador d'invitacions massives */}
      <MemberInviterImporter
        open={isImporterOpen}
        onOpenChange={setIsImporterOpen}
      />

      <MembersUserPermissionsDialog
        open={!!memberToEditPermissions}
        onOpenChange={(open) => {
          if (!open) setMemberToEditPermissions(null);
        }}
        member={memberToEditPermissions}
      />
    </>
  );
}
