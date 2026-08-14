import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  auditTransactionDocumentRegistry,
  type TransactionDocumentAuditRecord,
} from '../../src/lib/entitlements/transaction-document-audit';

const inputIndex = process.argv.indexOf('--input');
const inputPath = inputIndex >= 0 ? process.argv[inputIndex + 1] : null;
if (!inputPath) throw new Error('Cal --input <fitxer-json>. No es consulta Firebase.');
if (process.argv.includes('--apply')) {
  throw new Error('WRITE_DISABLED: la reparació és només dry-run en aquest paquet.');
}

const parsed = JSON.parse(await readFile(resolve(inputPath), 'utf8')) as TransactionDocumentAuditRecord[];
if (!Array.isArray(parsed)) throw new Error('L’entrada ha de ser un array JSON.');
process.stdout.write(`${JSON.stringify(auditTransactionDocumentRegistry(parsed), null, 2)}\n`);
