import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { summarizeShadowDecisions, type ShadowDecisionRecord } from '../../src/lib/entitlements/shadow-report';

const inputIndex = process.argv.indexOf('--input');
const inputPath = inputIndex >= 0 ? process.argv[inputIndex + 1] : null;
if (!inputPath) throw new Error('Cal --input <jsonl-local>. No es consulta Firebase.');

const lines = (await readFile(resolve(inputPath), 'utf8')).split(/\r?\n/).filter(Boolean);
const records = lines.map((line) => JSON.parse(line) as ShadowDecisionRecord);
process.stdout.write(`${JSON.stringify(summarizeShadowDecisions(records), null, 2)}\n`);
