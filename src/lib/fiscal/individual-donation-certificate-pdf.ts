import { jsPDF } from 'jspdf';
import type { OrganizationLanguage } from '@/lib/data';

export interface IndividualDonationCertificatePdfInput {
  language: OrganizationLanguage;
  issueDate: Date;
  organization: {
    name: string;
    taxId: string;
    address: string;
    zipCode: string;
    city: string;
    province?: string | null;
    signatoryName: string;
    signatoryRole: string;
  };
  donor: {
    name: string;
    taxId: string;
    address?: string | null;
    zipCode: string;
    city?: string | null;
    province?: string | null;
    donorType?: 'individual' | 'company' | null;
  };
  movement: {
    date: string;
    amount: number;
  };
  logoDataUrl?: string | null;
  signatureDataUrl?: string | null;
}

const COPY = {
  ca: {
    title: 'CERTIFICAT DE DONACIÓ', inRepresentationOf: 'en representació de', withCif: 'amb CIF',
    domiciledAt: 'amb domicili a', certifies: 'CERTIFICA', thatDonor: 'Que', withNifCif: 'amb DNI/CIF',
    andDomicile: 'i domicili a', donatedAmount: 'va donar la quantitat de', onDate: 'en data',
    toTheEntity: 'a aquesta entitat.',
    irrevocableClause: "Que aquesta quantitat va ser lliurada amb caràcter irrevocable i va ser emprada per l'Entitat per al compliment dels seus fins socials.",
    issuedIn: 'I perquè així consti, expedeixo el present certificat a', issuedOn: 'a',
    legalNote: "Aquesta entitat està acollida al règim fiscal establert a la Llei 49/2002, de 23 de desembre, de règim fiscal de les entitats sense fins lucratius i dels incentius fiscals al mecenatge. Aquest donatiu dóna dret a les deduccions previstes a l'article 19 de l'esmentada Llei.",
    months: ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'],
    locale: 'ca-ES',
  },
  es: {
    title: 'CERTIFICADO DE DONACIÓN', inRepresentationOf: 'en representación de', withCif: 'con CIF',
    domiciledAt: 'con domicilio en', certifies: 'CERTIFICA', thatDonor: 'Que', withNifCif: 'con DNI/CIF',
    andDomicile: 'y domicilio en', donatedAmount: 'donó la cantidad de', onDate: 'a fecha',
    toTheEntity: 'a esta entidad.',
    irrevocableClause: 'Que dicha cantidad fue entregada con carácter irrevocable y fue empleada por la Entidad para el cumplimiento de sus fines sociales.',
    issuedIn: 'Y para que así conste, expido el presente certificado en', issuedOn: 'a',
    legalNote: 'Esta entidad está acogida al régimen fiscal establecido en la Ley 49/2002, de 23 de diciembre, de régimen fiscal de las entidades sin fines lucrativos y de los incentivos fiscales al mecenazgo. Este donativo da derecho a las deducciones previstas en el artículo 19 de dicha Ley.',
    months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    locale: 'es-ES',
  },
} as const;

function joinAddress(parts: Array<string | null | undefined>): string {
  return parts.map((part) => part?.trim()).filter(Boolean).join(', ');
}

function location(parts: Array<string | null | undefined>): string {
  return parts.map((part) => part?.trim()).filter(Boolean).join(' ');
}

export function sanitizeCertificateFilenamePart(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'donant';
}

export function individualDonationCertificateFilename(input: Pick<IndividualDonationCertificatePdfInput, 'language' | 'donor' | 'movement'>): string {
  const prefix = input.language === 'ca' ? 'Certificat_Donacio' : 'Certificado_Donacion';
  return `${prefix}_${input.movement.date.slice(0, 10)}_${sanitizeCertificateFilenamePart(input.donor.name)}.pdf`;
}

export function buildIndividualDonationCertificatePdf(input: IndividualDonationCertificatePdfInput): jsPDF {
  const copy = COPY[input.language];
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const lineHeight = 7;
  let y = margin;
  const orgAddress = joinAddress([
    input.organization.address,
    location([input.organization.zipCode, input.organization.city, input.organization.province]),
  ]);
  const donorAddress = joinAddress([
    input.donor.address,
    location([input.donor.zipCode, input.donor.city, input.donor.province]),
  ]);

  if (input.logoDataUrl) {
    try {
      doc.addImage(input.logoDataUrl, 'PNG', margin, y, 30, 30);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text(input.organization.name, margin + 35, y + 10);
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(`CIF: ${input.organization.taxId}`, margin + 35, y + 16);
      doc.setFontSize(9);
      doc.text(doc.splitTextToSize(orgAddress, contentWidth - 35), margin + 35, y + 22);
      y += 38;
    } catch {
      // El logo no és una dada fiscal: el certificat continua sense imatge.
    }
  }
  if (!input.logoDataUrl || y === margin) {
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(input.organization.name, pageWidth / 2, y, { align: 'center' }); y += 6;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`CIF: ${input.organization.taxId}`, pageWidth / 2, y, { align: 'center' }); y += 5;
    doc.setFontSize(9); doc.text(orgAddress, pageWidth / 2, y, { align: 'center' }); y += 10;
  }
  doc.setDrawColor(180); doc.line(margin, y, pageWidth - margin, y); y += 15;
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text(copy.title, pageWidth / 2, y, { align: 'center' }); y += 18;
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  const prefix = input.donor.donorType === 'company' ? '' : 'D./Dª ';
  const line1 = `${prefix}${input.organization.signatoryName}, ${copy.inRepresentationOf} ${input.organization.name},`;
  const line1Lines = doc.splitTextToSize(line1, contentWidth); doc.text(line1Lines, margin, y); y += line1Lines.length * lineHeight;
  const line2 = `${copy.withCif} ${input.organization.taxId}, ${copy.domiciledAt} ${orgAddress},`;
  const line2Lines = doc.splitTextToSize(line2, contentWidth); doc.text(line2Lines, margin, y); y += line2Lines.length * lineHeight + 8;
  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text(copy.certifies, pageWidth / 2, y, { align: 'center' }); y += 12;
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  const amount = new Intl.NumberFormat(copy.locale, { style: 'currency', currency: 'EUR' }).format(input.movement.amount);
  const movementDate = new Date(input.movement.date).toLocaleDateString(copy.locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
  const paragraph1 = `${copy.thatDonor} ${input.donor.name} ${copy.withNifCif} ${input.donor.taxId} ${copy.andDomicile} ${donorAddress}, ${copy.donatedAmount} ${amount} ${copy.onDate} ${movementDate} ${copy.toTheEntity}`;
  const p1 = doc.splitTextToSize(paragraph1, contentWidth); doc.text(p1, margin, y); y += p1.length * lineHeight + 6;
  const p2 = doc.splitTextToSize(copy.irrevocableClause, contentWidth); doc.text(p2, margin, y); y += p2.length * lineHeight + 6;
  const d = input.issueDate;
  const paragraph3 = `${copy.issuedIn} ${input.organization.city} ${copy.issuedOn} ${d.getUTCDate()} de ${copy.months[d.getUTCMonth()]} de ${d.getUTCFullYear()}.`;
  const p3 = doc.splitTextToSize(paragraph3, contentWidth); doc.text(p3, margin, y); y += p3.length * lineHeight + 15;
  doc.setFontSize(9); doc.setFont('helvetica', 'italic');
  const legal = doc.splitTextToSize(copy.legalNote, contentWidth); doc.text(legal, margin, y); y += legal.length * 4 + 15;
  const signatureX = pageWidth - margin - 60;
  if (input.signatureDataUrl) {
    try { doc.addImage(input.signatureDataUrl, 'PNG', signatureX, y, 50, 25); y += 28; } catch { /* continua amb signant textual */ }
  }
  doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text(input.organization.signatoryName, signatureX + 25, y, { align: 'center' }); y += 5;
  doc.setFont('helvetica', 'normal'); doc.text(input.organization.signatoryRole, signatureX + 25, y, { align: 'center' });
  return doc;
}

export function individualDonationCertificatePdfBytes(input: IndividualDonationCertificatePdfInput): Uint8Array {
  return new Uint8Array(buildIndividualDonationCertificatePdf(input).output('arraybuffer'));
}
