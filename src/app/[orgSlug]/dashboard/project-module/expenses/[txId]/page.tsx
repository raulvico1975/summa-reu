// src/app/[orgSlug]/dashboard/project-module/expenses/[txId]/page.tsx
// Detall d'una despesa amb assignació a projectes

'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useExpenseDetail, useProjects, useSaveExpenseLink } from '@/hooks/use-project-module';
import { useOrgUrl } from '@/hooks/organization-provider';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Building2,
  Tag,
  FileText,
  ExternalLink,
  Edit,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Save,
  X,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AssignmentEditor } from '@/components/project-module/assignment-editor';
import { formatDateDMY } from '@/lib/normalize';
import { useTranslations } from '@/i18n';
import type { ExpenseAssignment, ExpenseJustification } from '@/lib/project-module-types';
import { isExpenseCategoryPending } from '@/lib/project-module/expense-category-pending';

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('ca-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export default function ExpenseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const txId = params.txId as string;
  const { buildUrl } = useOrgUrl();
  const { toast } = useToast();

  const { tr } = useTranslations();
  const { expense, link, isLoading, error, refresh } = useExpenseDetail(txId);
  const { projects, isLoading: projectsLoading, error: projectsError } = useProjects(true);
  const { save, remove, isSaving } = useSaveExpenseLink();

  const [isEditing, setIsEditing] = React.useState(false);
  const [hasAutoOpened, setHasAutoOpened] = React.useState(false);

  // Estat per justificació
  const [justificationOpen, setJustificationOpen] = React.useState(false);
  const [isEditingJustification, setIsEditingJustification] = React.useState(false);
  const [invoiceNumber, setInvoiceNumber] = React.useState('');
  const [issuerTaxId, setIssuerTaxId] = React.useState('');
  const [invoiceDate, setInvoiceDate] = React.useState('');
  const [paymentDate, setPaymentDate] = React.useState('');
  const [supportDocNumber, setSupportDocNumber] = React.useState('');

  // Inicialitzar camps de justificació quan es carrega el link
  React.useEffect(() => {
    if (link?.justification) {
      setInvoiceNumber(link.justification.invoiceNumber ?? '');
      setIssuerTaxId(link.justification.issuerTaxId ?? '');
      setInvoiceDate(link.justification.invoiceDate ?? '');
      setPaymentDate(link.justification.paymentDate ?? '');
      setSupportDocNumber(link.justification.supportDocNumber ?? '');
      // Obrir secció si hi ha dades
      if (link.justification.invoiceNumber || link.justification.issuerTaxId) {
        setJustificationOpen(true);
      }
    }
  }, [link]);

  // Obrir editor automàticament si la despesa no està completament assignada
  React.useEffect(() => {
    if (!isLoading && expense && !hasAutoOpened) {
      if (isExpenseCategoryPending({ source: 'bank', categoryName: expense.categoryName })) {
        setHasAutoOpened(true);
        return;
      }

      const assignedAmt = link
        ? link.assignments.reduce((sum, a) => sum + (a.amountEUR != null ? Math.abs(a.amountEUR) : 0), 0)
        : 0;
      const totalAmt = Math.abs(expense.amountEUR);
      const fullyAssigned = (totalAmt - assignedAmt) <= 0.01;

      if (!fullyAssigned) {
        setIsEditing(true);
        setHasAutoOpened(true);
      }
    }
  }, [isLoading, expense, link, hasAutoOpened]);

  const handleSave = async (assignments: ExpenseAssignment[], note: string | null) => {
    if (categoryPending) {
      toast({
        variant: 'destructive',
        title: categoryPendingLabel,
        description: categoryPendingHelp,
      });
      return;
    }

    try {
      // Mantenir la justificació existent
      await save(txId, assignments, note, link?.justification);
      await refresh();
      setIsEditing(false);
      toast({
        title: tr('projectModule.assignment.savedTitle'),
        description: tr('projectModule.assignment.savedDesc'),
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: tr('common.error'),
        description: err instanceof Error ? err.message : tr('projectModule.assignment.saveError'),
      });
    }
  };

  const handleSaveJustification = async () => {
    if (!link) return;

    const justification: ExpenseJustification = {
      invoiceNumber: invoiceNumber.trim() || null,
      issuerTaxId: issuerTaxId.trim() || null,
      invoiceDate: invoiceDate || null,
      paymentDate: paymentDate || null,
      supportDocNumber: supportDocNumber.trim() || null,
    };

    try {
      await save(txId, link.assignments, link.note, justification);
      await refresh();
      setIsEditingJustification(false);
      toast({
        title: tr('projectModule.justification.savedTitle'),
        description: tr('projectModule.justification.savedDesc'),
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: tr('common.error'),
        description: err instanceof Error ? err.message : tr('projectModule.justification.saveError'),
      });
    }
  };

  const handleCancelJustification = () => {
    // Restaurar valors originals
    if (link?.justification) {
      setInvoiceNumber(link.justification.invoiceNumber ?? '');
      setIssuerTaxId(link.justification.issuerTaxId ?? '');
      setInvoiceDate(link.justification.invoiceDate ?? '');
      setPaymentDate(link.justification.paymentDate ?? '');
      setSupportDocNumber(link.justification.supportDocNumber ?? '');
    } else {
      setInvoiceNumber('');
      setIssuerTaxId('');
      setInvoiceDate('');
      setPaymentDate('');
      setSupportDocNumber('');
    }
    setIsEditingJustification(false);
  };

  const handleRemove = async () => {
    if (!confirm(tr('projectModule.assignment.confirmRemove'))) return;

    try {
      await remove(txId);
      await refresh();
      toast({
        title: tr('projectModule.assignment.removedTitle'),
        description: tr('projectModule.assignment.removedDesc'),
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: tr('common.error'),
        description: err instanceof Error ? err.message : tr('projectModule.assignment.removeError'),
      });
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive font-medium">{tr('projectModule.expensesPage.loadError')}</p>
        <p className="text-muted-foreground text-sm">{error.message}</p>
        <Button onClick={() => router.back()} variant="outline">
          {tr('common.back')}
        </Button>
      </div>
    );
  }

  if (isLoading || !expense) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const assignedAmount = link
    ? link.assignments.reduce((sum, a) => sum + (a.amountEUR != null ? Math.abs(a.amountEUR) : 0), 0)
    : 0;
  const totalAmount = Math.abs(expense.amountEUR);
  const remainingAmount = totalAmount - assignedAmount;
  const isFullyAssigned = remainingAmount <= 0.01;
  const categoryPending = isExpenseCategoryPending({
    source: 'bank',
    categoryName: expense.categoryName,
  });
  const categoryPendingLabel = tr('projectModule.expensesPage.statusCategoryPending', 'Categoria pendent');
  const categoryPendingHelp = tr(
    'projectModule.expensesPage.pendingCategoryHelp',
    "Classifica aquest moviment a Moviments abans d'imputar-lo a un projecte."
  );

  return (
    <div className="space-y-6">
      {/* Header amb navegació */}
      <div className="flex items-center gap-4">
        <Link href={buildUrl('/dashboard/project-module/expenses')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{tr('projectModule.expenseDetail.title')}</h1>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Informació de la despesa */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {tr('projectModule.expenseDetail.infoTitle')}
            </CardTitle>
            <CardDescription>
              {tr('projectModule.expenseDetail.infoDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {tr('projectModule.expenseDetail.dateLabel')}
              </span>
              <span className="font-medium">{formatDateDMY(expense.date)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{tr('projectModule.expenseDetail.amountLabel')}</span>
              <span className="font-mono font-bold text-lg text-red-600">
                {formatAmount(expense.amountEUR)}
              </span>
            </div>

            <Separator />

            <div className="space-y-2">
              <span className="text-muted-foreground text-sm">{tr('projectModule.expenseDetail.descriptionLabel')}</span>
              <p className="text-sm">{expense.description || '-'}</p>
            </div>

            {(expense.categoryName || categoryPending) && (
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <Badge
                  variant="outline"
                  className={categoryPending ? 'bg-amber-50 text-amber-700 border-amber-200' : undefined}
                >
                  {categoryPending ? categoryPendingLabel : expense.categoryName}
                </Badge>
              </div>
            )}

            {expense.counterpartyName && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{expense.counterpartyName}</span>
                {expense.counterpartyType && (
                  <Badge variant="outline" className="text-xs">
                    {expense.counterpartyType}
                  </Badge>
                )}
              </div>
            )}

            {expense.documents.length > 0 && (
              <div className="space-y-2">
                <span className="text-muted-foreground text-sm">{tr('projectModule.expenseDetail.documentsLabel')}</span>
                {expense.documents.map((doc, i) => (
                  <a
                    key={i}
                    href={doc.fileUrl ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {doc.name || 'Document'}
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assignació a projectes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{tr('projectModule.expenseDetail.assignmentTitle')}</CardTitle>
                <CardDescription>
                  {tr('projectModule.expenseDetail.assignmentDesc')}
                </CardDescription>
              </div>
              {!isEditing && (
                <div className="flex gap-2">
                  {link && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleRemove}
                      disabled={isSaving}
                      title={tr('projectModule.expenseDetail.deleteAssignment')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="default"
                    size="icon"
                    onClick={() => setIsEditing(true)}
                    disabled={categoryPending}
                    title={link ? tr('projectModule.expenseDetail.editAssignment') : tr('projectModule.expenseDetail.assignToProject')}
                  >
                    {link ? (
                      <Edit className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {categoryPending && (
              <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{categoryPendingLabel}</AlertTitle>
                <AlertDescription>{categoryPendingHelp}</AlertDescription>
              </Alert>
            )}

            {isEditing && !categoryPending ? (
              <AssignmentEditor
                projects={projects}
                projectsLoading={projectsLoading}
                projectsError={projectsError}
                currentAssignments={link?.assignments ?? []}
                currentNote={link?.note ?? null}
                totalAmount={totalAmount}
                onSave={handleSave}
                onCancel={() => setIsEditing(false)}
                isSaving={isSaving}
                createProjectUrl={buildUrl('/dashboard/project-module/projects/new')}
              />
            ) : link && link.assignments.length > 0 ? (
              <div className="space-y-4">
                {/* Pendent d'assignar (si no complet) */}
                {!isFullyAssigned && (
                  <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <span className="text-yellow-800 font-medium">{tr('projectModule.expenseDetail.pendingAssign')}</span>
                    <span className="font-mono font-medium text-yellow-700">
                      {formatAmount(-remainingAmount)}
                    </span>
                  </div>
                )}

                {/* Assignacions existents */}
                {link.assignments.map((assignment, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{assignment.projectName}</p>
                    </div>
                    <span className="font-mono font-medium text-red-600">
                      {assignment.amountEUR != null ? formatAmount(assignment.amountEUR) : '—'}
                    </span>
                  </div>
                ))}

                <Separator />

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{tr('projectModule.expenseDetail.totalAssigned')}</span>
                  <span className="font-mono font-medium">
                    {formatAmount(-assignedAmount)}
                  </span>
                </div>

                {isFullyAssigned && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-600 font-medium">{tr('projectModule.expenseDetail.fullyAssigned')}</span>
                  </div>
                )}

                {link.note && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-sm">{tr('projectModule.expenseDetail.noteLabel')}</span>
                      <p className="text-sm">{link.note}</p>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>{tr('projectModule.expenseDetail.noAssignment')}</p>
                <p className="text-sm mt-1">
                  {tr('projectModule.expenseDetail.noAssignmentHint')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Secció Justificació (només si hi ha assignació) */}
      {link && link.assignments.length > 0 && (
        <Card>
          <Collapsible open={justificationOpen} onOpenChange={setJustificationOpen}>
            <CardHeader className="pb-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {tr('projectModule.justificationData')}
                  </CardTitle>
                  {justificationOpen ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CardDescription>
                {tr('projectModule.justificationDesc')}
              </CardDescription>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                {isEditingJustification ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="invoiceNumber" className="text-sm">{tr('projectModule.invoiceNumber')}</Label>
                        <Input
                          id="invoiceNumber"
                          type="text"
                          placeholder="F-2024-001"
                          value={invoiceNumber}
                          onChange={(e) => setInvoiceNumber(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="issuerTaxId" className="text-sm">{tr('projectModule.issuerTaxId')}</Label>
                        <Input
                          id="issuerTaxId"
                          type="text"
                          placeholder="B12345678"
                          value={issuerTaxId}
                          onChange={(e) => setIssuerTaxId(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="invoiceDate" className="text-sm">{tr('projectModule.invoiceDate')}</Label>
                        <Input
                          id="invoiceDate"
                          type="date"
                          value={invoiceDate}
                          onChange={(e) => setInvoiceDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="paymentDate" className="text-sm">{tr('projectModule.paymentDate')}</Label>
                        <Input
                          id="paymentDate"
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="supportDocNumber" className="text-sm">{tr('projectModule.expenseDetail.supportDocNumber')}</Label>
                      <Input
                        id="supportDocNumber"
                        type="text"
                        placeholder="J-001"
                        value={supportDocNumber}
                        onChange={(e) => setSupportDocNumber(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelJustification}
                        disabled={isSaving}
                      >
                        <X className="h-4 w-4 mr-1" />
                        {tr('projectModule.expenseDetail.cancel')}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveJustification}
                        disabled={isSaving}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        {tr('projectModule.expenseDetail.save')}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">{tr('projectModule.invoiceNumber')}</span>
                        <p className="font-medium">{link.justification?.invoiceNumber || '-'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{tr('projectModule.issuerTaxId')}</span>
                        <p className="font-medium">{link.justification?.issuerTaxId || '-'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{tr('projectModule.invoiceDate')}</span>
                        <p className="font-medium">{link.justification?.invoiceDate ? formatDateDMY(link.justification.invoiceDate) : '-'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{tr('projectModule.paymentDate')}</span>
                        <p className="font-medium">{link.justification?.paymentDate ? formatDateDMY(link.justification.paymentDate) : '-'}</p>
                      </div>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">{tr('projectModule.expenseDetail.supportDocNumber')}</span>
                      <p className="font-medium">{link.justification?.supportDocNumber || '-'}</p>
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingJustification(true)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        {tr('projectModule.expenseDetail.edit')}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}
    </div>
  );
}
