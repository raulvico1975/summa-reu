import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

test('C3a UI: suggerir amb IA queda ocult i el gate precedeix qualsevol decisio automatica', () => {
  const hook = source('src/components/transactions/hooks/useTransactionCategorization.ts');
  const row = source('src/components/transactions/components/TransactionRow.tsx');
  const table = source('src/components/transactions-table.tsx');

  assert.match(hook, /canUseCapability\('aiCategorization\.execute',\s*\{\s*userAllowed: can\('moviments\.editar'\)/m);
  const singleHandler = hook.slice(
    hook.indexOf('const handleCategorize ='),
    hook.indexOf('// BATCH CATEGORIZE ALL UNCATEGORIZED')
  );
  assert.ok(singleHandler.indexOf('if (!canExecuteAiCategorization)') >= 0);
  assert.ok(singleHandler.indexOf('if (!canExecuteAiCategorization)') < singleHandler.indexOf('resolveAutomaticCategoryDecision('));

  assert.match(row, /canCategorizeWithAi && <CommandGroup>/);
  assert.match(table, /canCategorizeWithAi=\{canExecuteAiCategorization\}/);
  assert.match(table, /canExecuteAiCategorization=\{canExecuteAiCategorization\}/);
});

test('C3a UI: import bancari conserva el flux i nomes invoca IA amb pla i permís', () => {
  const importer = source('src/components/transaction-importer.tsx');
  assert.doesNotMatch(importer, /from ['"]@\/ai\/flows\/infer-contact['"]/);
  assert.match(importer, /canUseCapability\('aiCategorization\.execute',\s*\{\s*userAllowed: can\('moviments\.editar'\)/m);
  assert.match(importer, /if \(canExecuteAiCategorization && availableContacts/);
  assert.match(importer, /fetch\('\/api\/ai\/infer-contact'/);
  assert.match(importer, /if \(canExecuteAiCategorization && availableCategories/);
  assert.match(importer, /fetch\('\/api\/ai\/categorize-transaction'/);
});

test('import bancari no consulta ni suggereix documents pendents fora de Complete', () => {
  const importer = source('src/components/transaction-importer.tsx');
  assert.match(
    importer,
    /canSuggestPendingDocumentMatches = canUseCapability\('pendingDocuments\.match',\s*\{\s*operationalEnabled: organization\?\.features\?\.pendingDocs \?\? false,\s*userAllowed: can\('moviments\.editar'\)/m,
  );
  const suggestionCall = importer.indexOf('await suggestPendingDocumentMatches(');
  const guardedBlock = importer.lastIndexOf('if (canSuggestPendingDocumentMatches', suggestionCall);
  assert.ok(suggestionCall >= 0);
  assert.ok(guardedBlock >= 0 && guardedBlock < suggestionCall);
});

test('C3a UI: Model 347 no consulta dades en Control i separa lectura d export', () => {
  const report = source('src/components/suppliers-report-generator.tsx');
  assert.match(report, /canUseCapability\('model347\.read'/);
  assert.match(report, /canUseCapability\('model347\.export'/);
  assert.match(report, /organizationId && canReadModel347 \? collection\(firestore, 'organizations', organizationId, 'transactions'\) : null/);
  assert.match(report, /if \(!canReadModel347\) \{/);
  assert.match(report, /disabled=\{!hasData \|\| !canExportModel347\}/);
});

test('C3b UI: paquet de tancament queda bloquejat abans de qualsevol fetch sense Complete', () => {
  const card = source('src/components/reports/closing-bundle-card.tsx');
  const dialog = source('src/components/reports/closing-bundle-dialog.tsx');

  assert.match(card, /canUseCapability\('closingBundle\.export',\s*\{\s*userAllowed: canExportReports/m);
  assert.match(card, /disabled=\{!canExportClosingBundle\}/);
  assert.match(dialog, /canUseCapability\('closingBundle\.export',\s*\{\s*userAllowed: canExportReports/m);

  const handler = dialog.slice(
    dialog.indexOf('const handleGenerate ='),
    dialog.indexOf('return (')
  );
  assert.ok(handler.indexOf('if (!canExportClosingBundle)') >= 0);
  assert.ok(handler.indexOf('if (!canExportClosingBundle)') < handler.indexOf("fetch('/api/exports/closing-bundle-zip'"));
});

test('C3b UI: downgrade conserva historics pending i projectes pero bloqueja mutacions', () => {
  const pending = source('src/app/[orgSlug]/dashboard/movimientos/pendents/page.tsx');
  const projectLayout = source('src/app/[orgSlug]/dashboard/project-module/layout.tsx');

  assert.match(pending, /canUseCapability\('pendingDocuments\.readHistorical',\s*\{\s*userAllowed: can\('moviments\.read'\)/m);
  assert.match(pending, /canUseCapability\('pendingDocuments\.mutate',\s*\{\s*operationalEnabled: isPendingDocsEnabled/m);
  assert.match(pending, /canUseCapability\('pendingDocuments\.match',\s*\{\s*operationalEnabled: isPendingDocsEnabled/m);
  assert.doesNotMatch(pending, /router\.replace\([^\n]*movimientos/);
  assert.doesNotMatch(pending, /!organizationId \|\| !firestore \|\| !isPendingDocsEnabled/);

  assert.match(projectLayout, /canUseCapability\('projects\.readHistorical'/);
  assert.match(projectLayout, /canUseCapability\('projects\.mutate',\s*\{\s*operationalEnabled: isProjectModuleEnabled/m);
  assert.doesNotMatch(projectLayout, /if \(!isProjectModuleEnabled\) \{/);
});

test('C3b UI: XLSX usa endpoint Complete i ZIP continua com a portabilitat historica', () => {
  const budgetPage = source('src/app/[orgSlug]/dashboard/project-module/projects/[projectId]/budget/page.tsx');
  assert.match(budgetPage, /fetch\('\/api\/project-module\/grant-justification\/export'/);
  assert.match(budgetPage, /kind: 'funding-xlsx'/);
  assert.match(budgetPage, /kind: 'multi-funding-xlsx'/);
  assert.match(budgetPage, /const handleExportZip = async \(\) => \{[\s\S]*?if \(!canUseProjectModule\) return;/);
  assert.doesNotMatch(budgetPage, /const handleExportZip = async \(\) => \{[\s\S]*?if \(!canExportGrantJustification\) return;/);
});

test('C3b UI: sense lectura de pendents no obre consultes auxiliars', () => {
  const pending = source('src/app/[orgSlug]/dashboard/movimientos/pendents/page.tsx');
  const supportQueries = pending.slice(
    pending.indexOf('// Carregar contactes'),
    pending.indexOf('const sortedPendingDocs')
  );

  assert.match(
    supportQueries,
    /organizationId && firestore && canReadPendingDocuments\s*\? collection\(firestore, 'organizations', organizationId, 'contacts'\)/
  );
  assert.match(
    supportQueries,
    /organizationId && firestore && canReadPendingDocuments\s*\? collection\(firestore, 'organizations', organizationId, 'categories'\)/
  );
  assert.match(
    supportQueries,
    /organizationId && firestore && canMatch\s*\? collection\(firestore, 'organizations', organizationId, 'transactions'\)/
  );
});

test('C3b UI: liquidacio i modals de projecte queden read-only abans de side effects', () => {
  const detailPage = source('src/app/[orgSlug]/dashboard/movimientos/liquidacions/[id]/page.tsx');
  const detail = source('src/components/expense-reports/expense-report-detail.tsx');
  const inbox = source('src/components/expense-reports/tickets-inbox.tsx');
  const budget = source('src/app/[orgSlug]/dashboard/project-module/projects/[projectId]/budget/page.tsx');
  const balance = source('src/components/project-module/balance-project-modal.tsx');
  const budgetImport = source('src/components/project-module/budget-import-wizard.tsx');
  const offBank = source('src/components/project-module/add-off-bank-expense-modal.tsx');

  assert.match(detailPage, /canUseCapability\('projects\.readHistorical'/);
  assert.match(detailPage, /canOperate=\{canMutateProjects && can\('sections\.moviments'\) && can\('moviments\.editar'\)\}/);
  for (const handler of ['handleSave', 'handleAddReceipts', 'handleRemoveReceipt', 'handleGeneratePdf']) {
    assert.match(detail, new RegExp(`const ${handler} = async \\(.*?[\\s\\S]{0,160}if \\(!canOperate`));
  }
  assert.match(detail, /onGenerate=\{async \(bankAccountId, executionDate\) => \{\s*if \(!canOperate/);
  for (const handler of ['handleAssignToReport', 'handleSaveEdit', 'handleTicketImageUpload']) {
    assert.match(inbox, new RegExp(`const ${handler} = async \\(.*?[\\s\\S]{0,180}if \\(!canOperate`));
  }
  assert.match(budget, /canCompleteOffBankDocuments=\{canMutateProjects\}/);
  assert.match(budget, /canAnalyzeDocuments=\{canMutateProjects\}/);
  assert.match(balance, /const applyChanges = async \(\) => \{\s*if \(!canMutateProjects\) return;/);
  assert.match(budgetImport, /const handleImport = async \(\) => \{\s*if \(!canMutateBudgets/);
  assert.match(offBank, /const handleSubmit = async \(e: React\.FormEvent\) => \{\s*e\.preventDefault\(\);\s*if \(!canMutateProjects\) return;/);
});

test('C3b UI: dialogs oberts i callbacks de fitxers revaliden downgrade abans de side effects', () => {
  const projects = source('src/app/[orgSlug]/dashboard/project-module/projects/page.tsx');
  const dropzone = source('src/components/project-module/expense-attachments-dropzone.tsx');
  const completion = source('src/components/project-module/off-bank-document-completion-dialog.tsx');
  const quickExpense = source('src/components/project-module/quick-expense-screen.tsx');

  assert.match(projects, /if \(canMutateProjects\) return;\s*setProjectToClose\(null\);\s*setProjectToDelete\(null\)/);
  assert.match(projects, /const handleConfirmClose = React\.useCallback\(async \(\) => \{\s*if \(!canMutateProjects \|\| !projectToClose\) return;/);
  assert.match(projects, /const handleConfirmDelete = React\.useCallback\(async \(\) => \{\s*if \(!canMutateProjects \|\| !projectToDelete\) return;/);
  assert.match(projects, /open=\{canMutateProjects && !!projectToClose\}/);
  assert.match(projects, /open=\{canMutateProjects && !!projectToDelete\}/);

  assert.match(dropzone, /if \(disabledRef\.current\) return;/);
  assert.match(dropzone, /if \(uploadedByThisAttempt\) \{\s*await deleteObject\(storageRef\)/);
  assert.match(completion, /if \(!canUploadRef\.current \|\| !organizationId \|\| !expenseId \|\| !row\) return;/);
  assert.match(completion, /if \(!persisted\) \{\s*await Promise\.all\(uploadedByThisAttempt/);
  assert.match(completion, /await update\(expenseId,[\s\S]{0,160}persisted = true;\s*await onSaved\(\);/);
  assert.match(quickExpense, /extractWithAI, storage, syncDraftExpense/);
});

test('C3b governanca: import de pressupost talla tots els batches a 50 operacions', () => {
  const budgetImport = source('src/components/project-module/budget-import-wizard.tsx');
  assert.doesNotMatch(budgetImport, /batchCount\s*>=\s*450/);
  assert.equal((budgetImport.match(/batchCount\s*>=\s*50/g) ?? []).length, 2);
});
