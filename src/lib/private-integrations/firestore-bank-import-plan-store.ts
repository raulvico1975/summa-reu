import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { BATCH_SIZE } from '@/lib/api/admin-sdk';
import { safeSet, safeUpdate } from '@/lib/safe-write';
import {
  validateBankImportPlanClaim,
  type BankImportPlan,
  type BankImportPlanStore,
  type PlannedBankImportRow,
} from './bank-import-plan';

const COLLECTION = 'integrationActionPlans';

type PlanHeader = Omit<BankImportPlan, 'selectedRows'> & { selectedRowsCount: number };

function headerFor(plan: BankImportPlan): PlanHeader {
  const { selectedRows, ...header } = plan;
  return { ...header, selectedRowsCount: selectedRows.length };
}

function asHeader(planId: string, raw: FirebaseFirestore.DocumentData | undefined): PlanHeader | null {
  if (!raw || raw.planId !== planId || raw.type !== 'bank_import') return null;
  if (!Array.isArray(raw.selectedRowIndexes) || !Number.isInteger(raw.selectedRowsCount)) return null;
  return raw as PlanHeader;
}

export function createFirestoreBankImportPlanStore(db: Firestore): BankImportPlanStore {
  const planRef = (planId: string) => db.doc(`${COLLECTION}/${planId}`);

  return {
    async create(plan) {
      const ref = planRef(plan.planId);
      for (let index = 0; index < plan.selectedRows.length; index += BATCH_SIZE) {
        const batch = db.batch();
        for (const row of plan.selectedRows.slice(index, index + BATCH_SIZE)) {
          const rowRef = ref.collection('rows').doc(String(row.rowIndex).padStart(8, '0'));
          await safeSet({
            data: row as unknown as Record<string, unknown>,
            context: {
              updatedBy: plan.tokenId,
              source: 'system',
              updatedAtFactory: () => FieldValue.serverTimestamp(),
              requiredFields: ['rowIndex', 'tx.date', 'tx.description', 'tx.amount', 'tx.bankAccountId'],
              amountFields: ['tx.amount'],
            },
            write: (payload) => batch.set(rowRef, payload),
          });
        }
        await batch.commit();
      }
      await safeSet({
        data: headerFor(plan) as unknown as Record<string, unknown>,
        context: {
          updatedBy: plan.tokenId,
          source: 'system',
          updatedAtFactory: () => FieldValue.serverTimestamp(),
          requiredFields: [
            'planId', 'type', 'status', 'orgId', 'tokenId', 'bankAccountId',
            'fileSha256', 'inputHash', 'selectionHash', 'confirmationText', 'expiresAt',
          ],
        },
        write: (payload) => ref.create(payload),
      });
    },

    async get(planId) {
      const ref = planRef(planId);
      const [headerSnapshot, rowsSnapshot] = await Promise.all([
        ref.get(),
        ref.collection('rows').orderBy('rowIndex', 'asc').get(),
      ]);
      const header = asHeader(planId, headerSnapshot.data());
      if (!header || rowsSnapshot.size !== header.selectedRowsCount) return null;
      const rows = rowsSnapshot.docs.map((doc) => doc.data() as PlannedBankImportRow);
      const { selectedRowsCount: _discarded, ...plan } = header;
      return { ...plan, selectedRows: rows };
    },

    async claim(args) {
      const ref = planRef(args.planId);
      const claimed = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        const plan = asHeader(args.planId, snapshot.data());
        if (!plan) return { ok: false as const, code: 'PLAN_NOT_FOUND' };
        const validationCode = validateBankImportPlanClaim(plan, args);
        if (validationCode) return { ok: false as const, code: validationCode };
        transaction.update(ref, {
          status: 'processing',
          processingAt: args.now,
          confirmationRecorded: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { ok: true as const };
      });
      if (!claimed.ok) return claimed;
      const plan = await this.get(args.planId);
      return plan ? { ok: true, plan } : { ok: false, code: 'PLAN_INTEGRITY_FAILED' };
    },

    async complete(args) {
      await safeUpdate({
        data: {
          status: 'consumed',
          consumedAt: args.now,
          blockedAt: null,
          blockedReason: null,
          importRunId: args.importRunId,
          importedIds: args.importedIds,
        },
        context: {
          source: 'system',
          updatedAtFactory: () => FieldValue.serverTimestamp(),
          requiredFields: ['status', 'consumedAt', 'importRunId'],
        },
        write: (payload) => planRef(args.planId).set(payload, { merge: true }),
      });
    },

    async block(args) {
      await safeUpdate({
        data: {
          status: 'blocked',
          blockedAt: args.now,
          blockedReason: args.reason,
        },
        context: {
          source: 'system',
          updatedAtFactory: () => FieldValue.serverTimestamp(),
          requiredFields: ['status', 'blockedAt', 'blockedReason'],
        },
        write: (payload) => planRef(args.planId).set(payload, { merge: true }),
      });
    },
  };
}
