import { normalizeIBAN } from '@/lib/normalize';
import type { SepaSequenceType } from '@/lib/data';

export interface Pain008CollectionItem {
  amount: number;
  debtorName: string;
  debtorIban: string;
  mandateId?: string;
  signatureDate?: string;
  sequenceType?: SepaSequenceType;
  endToEndId?: string;
  remittanceInfo?: string;
}

export interface Pain008ParseResult {
  collections: Pain008CollectionItem[];
  creditorName: string;
  creditorId: string;
  creditorIban: string;
  collectionDate: string;
  totalAmount: number;
  transactionCount: number;
  messageId: string;
  warnings: string[];
}

export function parsePain008(xmlContent: string): Pain008ParseResult {
  const warnings: string[] = [];
  const collections: Pain008CollectionItem[] = [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`Error parsejant XML: ${parseError.textContent}`);
  }

  const root = doc.documentElement;
  const ns = root.namespaceURI || '';

  const getText = (parent: Element, tagName: string): string => {
    const elem = parent.getElementsByTagNameNS(ns, tagName)[0]
      || parent.getElementsByTagName(tagName)[0];
    return elem?.textContent?.trim() || '';
  };

  const getAll = (parent: Element, tagName: string): Element[] => {
    const withNs = Array.from(parent.getElementsByTagNameNS(ns, tagName));
    if (withNs.length > 0) return withNs;
    return Array.from(parent.getElementsByTagName(tagName));
  };

  const grpHdr = getAll(root, 'GrpHdr')[0];
  if (!grpHdr) {
    throw new Error("No s'ha trobat GrpHdr (capçalera del grup)");
  }

  const headerNbOfTxs = parseInt(getText(grpHdr, 'NbOfTxs'), 10) || 0;
  const headerCtrlSum = parseFloat(getText(grpHdr, 'CtrlSum')) || 0;
  const messageId = getText(grpHdr, 'MsgId');

  const initgPty = getAll(grpHdr, 'InitgPty')[0];
  const creditorName = initgPty ? getText(initgPty, 'Nm') : '';
  const creditorOther = initgPty ? getAll(initgPty, 'Othr')[0] : undefined;
  const creditorId = creditorOther ? getText(creditorOther, 'Id') : (initgPty ? getText(initgPty, 'Id') : '');

  const pmtInfs = getAll(root, 'PmtInf');
  if (pmtInfs.length === 0) {
    throw new Error("No s'ha trobat cap bloc PmtInf (informacio de cobrament)");
  }

  let collectionDate = '';
  let creditorIban = '';

  for (const pmtInf of pmtInfs) {
    const paymentCollectionDate = getText(pmtInf, 'ReqdColltnDt');
    if (paymentCollectionDate && !collectionDate) {
      collectionDate = paymentCollectionDate;
    } else if (paymentCollectionDate && collectionDate && paymentCollectionDate !== collectionDate) {
      warnings.push(`Data de cobrament inconsistent entre blocs PmtInf (${paymentCollectionDate})`);
    }

    const pmtTpInf = getAll(pmtInf, 'PmtTpInf')[0];
    const sequenceType = (pmtTpInf ? getText(pmtTpInf, 'SeqTp') : '') as SepaSequenceType | '';

    const cdtrAcct = getAll(pmtInf, 'CdtrAcct')[0];
    if (cdtrAcct && !creditorIban) {
      creditorIban = normalizeIBAN(getText(cdtrAcct, 'IBAN'));
    }

    const drctDbtTxInfs = getAll(pmtInf, 'DrctDbtTxInf');
    for (const txInf of drctDbtTxInfs) {
      try {
        const amt = getAll(txInf, 'InstdAmt')[0];
        const amountStr = amt?.textContent?.trim() || '';
        const amount = parseFloat(amountStr);

        if (!amount || amount <= 0) {
          warnings.push(`Cobrament ignorat: import invalid (${amountStr})`);
          continue;
        }

        const dbtr = getAll(txInf, 'Dbtr')[0];
        const debtorName = dbtr ? getText(dbtr, 'Nm') : '';

        const dbtrAcct = getAll(txInf, 'DbtrAcct')[0];
        const debtorIban = dbtrAcct ? normalizeIBAN(getText(dbtrAcct, 'IBAN')) : '';

        const drctDbtTx = getAll(txInf, 'DrctDbtTx')[0];
        const mandateInfo = drctDbtTx ? getAll(drctDbtTx, 'MndtRltdInf')[0] : undefined;
        const mandateId = mandateInfo ? getText(mandateInfo, 'MndtId') : '';
        const signatureDate = mandateInfo ? getText(mandateInfo, 'DtOfSgntr') : '';

        const pmtId = getAll(txInf, 'PmtId')[0];
        const endToEndId = pmtId ? getText(pmtId, 'EndToEndId') : '';

        const rmtInf = getAll(txInf, 'RmtInf')[0];
        const remittanceInfo = rmtInf ? getText(rmtInf, 'Ustrd') : '';

        if (!debtorName && !debtorIban) {
          warnings.push('Cobrament ignorat: sense deutor ni IBAN');
          continue;
        }

        collections.push({
          amount: Math.round(amount * 100) / 100,
          debtorName: debtorName || 'Desconegut',
          debtorIban,
          mandateId: mandateId || undefined,
          signatureDate: signatureDate || undefined,
          sequenceType: sequenceType || undefined,
          endToEndId: endToEndId && endToEndId !== 'NOTPROVIDED' ? endToEndId : undefined,
          remittanceInfo: remittanceInfo || undefined,
        });
      } catch (error) {
        warnings.push(`Error processant cobrament: ${error}`);
      }
    }
  }

  const totalAmount = collections.reduce((sum, item) => sum + item.amount, 0);
  const transactionCount = collections.length;

  if (headerNbOfTxs > 0 && headerNbOfTxs !== transactionCount) {
    warnings.push(`El nombre de cobraments (${transactionCount}) no coincideix amb el header (${headerNbOfTxs})`);
  }

  if (headerCtrlSum > 0 && Math.abs(headerCtrlSum - totalAmount) > 0.02) {
    warnings.push(`L'import total (${totalAmount.toFixed(2)}) no coincideix amb el header (${headerCtrlSum.toFixed(2)})`);
  }

  return {
    collections,
    creditorName,
    creditorId,
    creditorIban,
    collectionDate,
    totalAmount: Math.round(totalAmount * 100) / 100,
    transactionCount,
    messageId,
    warnings,
  };
}

export function isPain008File(content: string): boolean {
  const lowerContent = content.toLowerCase();
  return (
    lowerContent.includes('pain.008') ||
    lowerContent.includes('drctdbttxinf') ||
    lowerContent.includes('drctdbt') ||
    (lowerContent.includes('<pmtmtd>dd') && lowerContent.includes('<dbtracct'))
  );
}
