'use client';

import * as React from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/i18n';
import {
  Shield,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  UserPlus,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface SuperAdminDoc {
  id: string; // uid
  email?: string;
  createdAt?: { toDate: () => Date } | string;
  createdBy?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SuperAdminsManager() {
  const { user, firestore } = useFirebase();
  const { t } = useTranslations();
  const { toast } = useToast();

  // State
  const [newUid, setNewUid] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');
  const [isAdding, setIsAdding] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<SuperAdminDoc | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Carregar superadmins (col·lecció top-level per evitar path invàlid)
  const superAdminsQuery = useMemoFirebase(
    () => query(collection(firestore, 'systemSuperAdmins'), orderBy('createdAt', 'desc')),
    [firestore]
  );
  const { data: superAdmins, isLoading } = useCollection<SuperAdminDoc>(superAdminsQuery);

  // Handlers
  const handleAdd = async () => {
    if (!newUid.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'L\'UID és obligatori.' });
      return;
    }

    // Validar format UID (alfanumèric, 20-30 chars típic de Firebase Auth)
    if (!/^[a-zA-Z0-9]{20,40}$/.test(newUid.trim())) {
      toast({ variant: 'destructive', title: 'Error', description: 'Format d\'UID invàlid.' });
      return;
    }

    setIsAdding(true);
    try {
      const docRef = doc(firestore, 'systemSuperAdmins', newUid.trim());
      await setDoc(docRef, {
        email: newEmail.trim() || null,
        createdAt: serverTimestamp(),
        createdBy: user?.uid,
      });

      toast({ title: 'SuperAdmin afegit', description: `UID: ${newUid.trim()}` });
      setNewUid('');
      setNewEmail('');
    } catch (error) {
      console.error('Error adding superadmin:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No s\'ha pogut afegir el superadmin.' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    // No permetre eliminar-se a si mateix si és l'últim
    if (superAdmins && superAdmins.length === 1 && deleteTarget.id === user?.uid) {
      toast({
        variant: 'destructive',
        title: 'No permès',
        description: 'No pots eliminar l\'últim superadmin.',
      });
      setDeleteTarget(null);
      return;
    }

    setIsDeleting(true);
    try {
      await deleteDoc(doc(firestore, 'systemSuperAdmins', deleteTarget.id));
      toast({ title: 'SuperAdmin eliminat', description: `UID: ${deleteTarget.id}` });
    } catch (error) {
      console.error('Error deleting superadmin:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No s\'ha pogut eliminar el superadmin.' });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const formatDate = (timestamp: SuperAdminDoc['createdAt']) => {
    if (!timestamp) return '-';
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp.toDate();
    return date.toLocaleDateString('ca-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4" />
          Gestionar SuperAdmins
        </CardTitle>
        <CardDescription>
          Controla qui pot accedir a aquesta zona sensible. Si et quedes sense superadmins, perdràs accés.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Afegir nou superadmin */}
        <div className="flex flex-col gap-3 p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-2 text-sm font-medium">
            <UserPlus className="h-4 w-4" />
            Afegir SuperAdmin
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="new-uid" className="text-xs">UID (obligatori)</Label>
              <Input
                id="new-uid"
                placeholder="f2AHJqjXiOZkYajwkOnZ8RY6h2k2"
                value={newUid}
                onChange={(e) => setNewUid(e.target.value)}
                disabled={isAdding}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-email" className="text-xs">Email (opcional, per referència)</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="admin@exemple.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={isAdding}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleAdd}
              disabled={isAdding || !newUid.trim()}
              size="sm"
            >
              {isAdding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Afegir
            </Button>
          </div>
        </div>

        {/* Llista de superadmins */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregant...
          </div>
        ) : !superAdmins || superAdmins.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-amber-600 py-4">
            <AlertTriangle className="h-4 w-4" />
            Cap superadmin registrat. Afegeix-ne un per poder canviar a les noves rules.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>UID</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Creat</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {superAdmins.map((sa) => (
                <TableRow key={sa.id}>
                  <TableCell className="font-mono text-xs">
                    {sa.id}
                    {sa.id === user?.uid && (
                      <span className="ml-2 text-xs text-muted-foreground">(tu)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{sa.email || '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(sa.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(sa)}
                      disabled={superAdmins.length === 1 && sa.id === user?.uid}
                      title={superAdmins.length === 1 && sa.id === user?.uid ? 'No pots eliminar l\'últim superadmin' : 'Eliminar'}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Diàleg confirmar eliminació */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.admin.superAdmins.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              L'usuari amb UID <code className="font-mono bg-muted px-1 rounded">{deleteTarget?.id}</code> {t.admin.superAdmins.deleteDescription}
              {deleteTarget?.id === user?.uid && (
                <span className="block mt-2 text-destructive font-medium">
                  {t.admin.superAdmins.deleteSelfWarning}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
