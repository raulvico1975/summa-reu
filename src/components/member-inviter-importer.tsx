'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Ban, Download, AlertTriangle, Shield, User, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useCurrentOrganization } from '@/hooks/organization-provider';
import { useTranslations } from '@/i18n';
import { collection, doc, setDoc, query, where } from 'firebase/firestore';
import {
  readInvitesExcel,
  generateInviteImportPreview,
  prepareInvitationData,
  type InviteImportResult,
  type InviteImportPreview,
} from '@/lib/members-import';
import { downloadMembersInviteTemplate } from '@/lib/members-export';
import type { OrganizationMember, OrganizationRole, Invitation } from '@/lib/data';

// ═══════════════════════════════════════════════════════════════════════════
// TIPUS
// ═══════════════════════════════════════════════════════════════════════════

type ImportStep = 'upload' | 'preview' | 'importing' | 'done';

interface MemberInviterImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function MemberInviterImporter({ open, onOpenChange, onComplete }: MemberInviterImporterProps) {
  const { toast } = useToast();
  const { firestore, user } = useFirebase();
  const { organization, organizationId, userRole } = useCurrentOrganization();
  const { t, tr, language } = useTranslations();

  // Membres existents
  const membersCollection = useMemoFirebase(
    () => organizationId ? collection(firestore, 'organizations', organizationId, 'members') : null,
    [firestore, organizationId]
  );
  const { data: members } = useCollection<OrganizationMember>(membersCollection);

  // Invitacions pendents
  // NOTA: Només admins de l'org poden llistar invitacions (via Firestore Rules).
  // Només fem la query si l'usuari és admin per evitar errors permission-denied.
  const invitationsQuery = useMemoFirebase(
    () => (organizationId && userRole === 'admin') ? query(
      collection(firestore, 'invitations'),
      where('organizationId', '==', organizationId)
    ) : null,
    [firestore, organizationId, userRole]
  );
  const { data: allInvitations } = useCollection<Invitation>(invitationsQuery);

  // Filtrar només pendents (no usades i no expirades)
  const pendingInvitations = React.useMemo(() => {
    if (!allInvitations) return [];
    const now = new Date();
    return allInvitations.filter(inv =>
      !inv.usedAt && new Date(inv.expiresAt) > now
    );
  }, [allInvitations]);

  // State
  const [step, setStep] = React.useState<ImportStep>('upload');
  const [importResult, setImportResult] = React.useState<InviteImportResult | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [parseWarnings, setParseWarnings] = React.useState<string[]>([]);
  const [parseErrors, setParseErrors] = React.useState<string[]>([]);

  // Ref per input file
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Reset quan es tanca
  React.useEffect(() => {
    if (!open) {
      setStep('upload');
      setImportResult(null);
      setParseWarnings([]);
      setParseErrors([]);
      setIsProcessing(false);
    }
  }, [open]);

  // Handler: Seleccionar fitxer
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setParseWarnings([]);
    setParseErrors([]);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const { rows, warnings, errors } = readInvitesExcel(arrayBuffer);

      // Si hi ha errors de parsing, no continuar
      if (errors.length > 0) {
        setParseErrors(errors);
        setIsProcessing(false);
        return;
      }

      if (rows.length === 0) {
        toast({
          variant: 'destructive',
          title: tr('memberInviterImporter.emptyFileTitle', t.importers.common.emptyFile),
          description: tr('memberInviterImporter.emptyFileDescription', "No s'han trobat dades d'invitacions al fitxer."),
        });
        setIsProcessing(false);
        return;
      }

      setParseWarnings(warnings);

      // Generar preview comparant amb existents
      const result = generateInviteImportPreview(
        rows,
        members || [],
        pendingInvitations
      );

      setImportResult(result);
      setStep('preview');
    } catch (error) {
      console.error('Error llegint fitxer:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: tr('memberInviterImporter.readError', "No s'ha pogut llegir el fitxer Excel."),
      });
    } finally {
      setIsProcessing(false);
      // Reset input per permetre tornar a seleccionar el mateix fitxer
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handler: Aplicar importació (crear invitacions)
  const handleApplyImport = async () => {
    if (!importResult || !organizationId || !organization || !user) return;

    setStep('importing');
    setIsProcessing(true);

    const toCreate = importResult.previews.filter(p => p.action === 'create');

    try {
      let created = 0;

      for (const preview of toCreate) {
        const invitationRef = doc(collection(firestore, 'invitations'));
        const invitationData = prepareInvitationData(
          preview.parsed,
          organizationId,
          organization.name,
          user.uid
        );

        await setDoc(invitationRef, { ...invitationData, id: invitationRef.id });
        created++;
      }

      setStep('done');
      toast({
        presentation: 'centered-success',
        title: tr('memberInviterImporter.importCompleteTitle', 'Invitacions creades'),
        description: tr('memberInviterImporter.importCompleteDescription', "S'han creat {count} invitacions.").replace('{count}', String(created)),
      });

      onComplete?.();
    } catch (error) {
      console.error('Error creant invitacions:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: tr('memberInviterImporter.importError', "S'ha produït un error durant la creació d'invitacions."),
      });
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  // Renderitzar badge segons acció
  const renderActionBadge = (action: InviteImportPreview['action']) => {
    switch (action) {
      case 'create':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {tr('memberInviterImporter.actionCreate', 'Nova invitació')}
          </Badge>
        );
      case 'skip':
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-600">
            <Ban className="h-3 w-3 mr-1" />
            {tr('memberInviterImporter.actionSkip', 'Ometre')}
          </Badge>
        );
    }
  };

  // Renderitzar badge de rol
  const getRoleBadge = (role: OrganizationRole) => {
    switch (role) {
      case 'admin':
        return (
          <Badge className="bg-purple-100 text-purple-800 border-purple-300">
            <Shield className="w-3 h-3 mr-1" />
            {t.members.roleAdmin}
          </Badge>
        );
      case 'user':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">
            <User className="w-3 h-3 mr-1" />
            {t.members.roleUser}
          </Badge>
        );
      case 'viewer':
        return (
          <Badge variant="secondary">
            <Eye className="w-3 h-3 mr-1" />
            {t.members.roleViewer}
          </Badge>
        );
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[min(96vw,78rem)] flex-col overflow-hidden sm:w-[min(calc(100vw-3rem),78rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-500" />
            {tr('memberInviterImporter.title', 'Importar invitacions massives')}
          </DialogTitle>
          <DialogDescription>
            {tr('memberInviterImporter.description', "Crea múltiples invitacions des d'un fitxer Excel (.xlsx)")}
          </DialogDescription>
        </DialogHeader>

        {/* STEP: Upload */}
        {step === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center py-8 gap-6">
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                <Upload className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="font-medium">{tr('memberInviterImporter.uploadTitle', 'Selecciona un fitxer Excel')}</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {tr('memberInviterImporter.uploadDescription', 'El fitxer ha de contenir columnes: Email (obligatori), Rol (admin/user/viewer), Nom (opcional)')}
              </p>
            </div>

            {/* Errors de parsing */}
            {parseErrors.length > 0 && (
              <Alert variant="destructive" className="max-w-md">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{tr('memberInviterImporter.fileErrorsTitle', 'Errors al fitxer')}</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 space-y-1 text-sm">
                    {parseErrors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => downloadMembersInviteTemplate(language)}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {t.importers.common.downloadTemplate}
              </Button>

              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {isProcessing ? t.importers.common.importing : tr('memberInviterImporter.selectFile', 'Seleccionar fitxer')}
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Microcopy sobre funcionament */}
            <Alert className="max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {tr('memberInviterImporter.mergingHelp', 'Les invitacions es deduplicaran automàticament. Es saltaran emails que ja siguin membres o que ja tinguin invitació pendent.')}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* STEP: Preview */}
        {step === 'preview' && importResult && (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {/* Resum */}
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>{tr('memberInviterImporter.summaryNew', '{count} invitacions noves').replace('{count}', String(importResult.summary.toCreate))}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span>{tr('memberInviterImporter.summarySkipped', '{count} omesos').replace('{count}', String(importResult.summary.toSkip))}</span>
              </div>
            </div>

            {/* Avisos de parsing */}
            {(parseWarnings.length > 0 || importResult.warnings.length > 0) && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <details className="text-xs">
                    <summary className="cursor-pointer">
                      {tr('memberInviterImporter.warningsCount', '{count} avís(os)').replace('{count}', String(parseWarnings.length + importResult.warnings.length))}
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {[...parseWarnings, ...importResult.warnings].map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </details>
                </AlertDescription>
              </Alert>
            )}

            {/* Taula de preview */}
            <ScrollArea className="flex-1 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">{tr('memberInviterImporter.table.action', 'Acció')}</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>{tr('memberInviterImporter.table.role', 'Rol')}</TableHead>
                    <TableHead>{t.importers.common.name}</TableHead>
                    <TableHead className="w-48">{tr('memberInviterImporter.table.details', 'Detalls')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importResult.previews.map((preview, idx) => (
                    <TableRow
                      key={idx}
                      className={preview.action === 'skip' ? 'opacity-50' : ''}
                    >
                      <TableCell>{renderActionBadge(preview.action)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {preview.parsed.email}
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(preview.parsed.role)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {preview.parsed.displayName || '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {preview.action === 'skip' && preview.reason && (
                          <span>{preview.reason}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {/* STEP: Importing */}
        {step === 'importing' && (
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            <div className="animate-pulse text-center space-y-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                <FileSpreadsheet className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="font-medium">{tr('memberInviterImporter.importingTitle', 'Creant invitacions...')}</h3>
              <p className="text-sm text-muted-foreground">{tr('memberInviterImporter.importingDescription', 'Això pot trigar uns segons')}</p>
            </div>
          </div>
        )}

        {/* STEP: Done */}
        {step === 'done' && (
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="font-medium">{tr('memberInviterImporter.doneTitle', 'Invitacions creades')}</h3>
              <p className="text-sm text-muted-foreground">
                {tr('memberInviterImporter.doneDescription', "Les persones invitades rebran un enllaç per registrar-se. Recorda enviar-los l'enllaç corresponent.")}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          {step === 'upload' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t.importers.common.close}
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                {t.importers.common.back}
              </Button>
              <Button
                onClick={handleApplyImport}
                disabled={isProcessing || importResult?.summary.toCreate === 0}
              >
                {tr('memberInviterImporter.createButton', 'Crear {count} invitacions').replace('{count}', String(importResult?.summary.toCreate ?? 0))}
              </Button>
            </>
          )}

          {step === 'done' && (
            <Button onClick={() => onOpenChange(false)}>
              {t.importers.common.close}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
