import { retrieveCard, type KbLang } from '../bot-retrieval'
import { extractOperationalSteps } from '../engine/policy'
import { loadGuideContent, type KBCard } from '../load-kb'

export type SupportCoverageExpectation = 'covered' | 'weak' | 'absent'

export type TopSupportQuestionCase = {
  id: string
  section: string
  domain: string
  question: string
  lang: KbLang
  expectedAnyOfCardIds: string[]
  coverage: SupportCoverageExpectation
  critical?: boolean
}

export type TopSupportQuestionsMetrics = {
  total: number
  positiveCount: number
  positiveRate: number
  criticalTotal: number
  criticalPositiveCount: number
  criticalPositiveRate: number
  coveredTotal: number
  coveredPositiveCount: number
  coveredPositiveRate: number
  weakTotal: number
  weakPositiveCount: number
  weakPositiveRate: number
  absentTotal: number
  absentPositiveCount: number
  absentPositiveRate: number
  clarifyCount: number
  fallbackCount: number
  cardMatchCount: number
  safeFallbackCount: number
  unresolvedInScopeCount: number
  trustedOperationalCount: number
}

export type TopSupportQuestionsMismatch = {
  id: string
  question: string
  expectedAnyOfCardIds: string[]
  actualCardId: string
  actualMode: 'card' | 'fallback'
  coverage: SupportCoverageExpectation
  confidence?: 'high' | 'medium' | 'low'
  trustedOperational: boolean
}

export type TopSupportQuestionsEval = {
  metrics: TopSupportQuestionsMetrics
  mismatches: TopSupportQuestionsMismatch[]
}

function buildCase(
  id: string,
  section: string,
  domain: string,
  question: string,
  expectedAnyOfCardIds: string[],
  coverage: SupportCoverageExpectation,
  critical = false
): TopSupportQuestionCase {
  return {
    id,
    section,
    domain,
    question,
    lang: 'ca',
    expectedAnyOfCardIds,
    coverage,
    critical,
  }
}

export const TOP_SUPPORT_USER_QUESTIONS_CA: TopSupportQuestionCase[] = [
  buildCase('moviments-01', 'Moviments i conciliació', 'transactions', "Tinc 200 moviments sense categoritzar. M'he de posar a fer-los un per un?", ['howto-movement-unassigned-alerts'], 'covered', true),
  buildCase('moviments-02', 'Moviments i conciliació', 'transactions', 'He categoritzat un moviment malament. Com el corregeixo?', ['guide-edit-movement'], 'covered', true),
  buildCase('moviments-03', 'Moviments i conciliació', 'transactions', 'Hi ha un moviment que no sé què és. Puc deixar-lo sense categoritzar?', ['howto-movement-unassigned-alerts'], 'covered'),
  buildCase('moviments-04', 'Moviments i conciliació', 'documents', "Vull guardar la factura d'una despesa. On la poso?", ['guide-attach-document'], 'covered', true),
  buildCase('moviments-05', 'Moviments i conciliació', 'transactions', 'Què vol dir que un moviment està "sense contacte"?', ['manual-movement-no-contact'], 'covered'),
  buildCase('moviments-06', 'Moviments i conciliació', 'transactions', 'Puc crear un moviment a mà, sense importar-lo del banc?', ['howto-enter-expense', 'fallback-no-answer'], 'weak'),
  buildCase('moviments-07', 'Moviments i conciliació', 'transactions', 'Com filtro per veure només els moviments d’un mes concret?', ['guide-movement-filters'], 'covered'),
  buildCase('moviments-08', 'Moviments i conciliació', 'transactions', "Tinc una transferència interna entre comptes de l'entitat. Com la categorizo?", ['manual-internal-transfer'], 'covered'),
  buildCase('moviments-09', 'Moviments i conciliació', 'transactions', 'Com divideixo un moviment?', ['howto-movement-split-amount'], 'covered', true),
  buildCase('moviments-10', 'Moviments i conciliació', 'general', "Com veig els ingressos d'un període?", ['howto-dashboard-income-period'], 'covered'),

  buildCase('donants-01', 'Donants i contactes', 'donors', 'Com dono d’alta un nou soci?', ['howto-member-create'], 'covered', true),
  buildCase('donants-02', 'Donants i contactes', 'donors', "Com edito les dades d'un donant?", ['howto-donor-update-details'], 'covered', true),
  buildCase('donants-03', 'Donants i contactes', 'donors', "Com modifico l'IBAN d'un soci?", ['howto-donor-update-iban'], 'covered'),
  buildCase('donants-04', 'Donants i contactes', 'donors', "Com canvio la quota d'un soci?", ['howto-donor-update-fee'], 'covered'),
  buildCase('donants-05', 'Donants i contactes', 'donors', 'Puc posar una quota en pausa?', ['howto-donor-pause-fee'], 'covered'),
  buildCase('donants-06', 'Donants i contactes', 'donors', 'Com dono de baixa un soci sense perdre’n l’historial?', ['guide-donor-inactive'], 'covered'),
  buildCase('donants-07', 'Donants i contactes', 'donors', 'Com reactivar un soci donat de baixa?', ['guide-donor-reactivate'], 'covered'),
  buildCase('donants-08', 'Donants i contactes', 'donors', 'On veig el resum i l’historial d’un soci?', ['howto-donor-history-summary'], 'covered'),
  buildCase('donants-09', 'Donants i contactes', 'donors', 'Com reviso les dades fiscals d’un donant si li falta DNI o codi postal?', ['howto-donor-fiscal-review', 'ts-donor-incomplete-data'], 'covered'),
  buildCase('donants-10', 'Donants i contactes', 'donors', 'Com canvio la categoria per defecte d’un donant?', ['howto-donor-default-category'], 'covered'),

  buildCase('remeses-01', 'Remeses i SEPA', 'remittances', 'Què és una remesa de quotes?', ['guide-remittances'], 'covered'),
  buildCase('remeses-02', 'Remeses i SEPA', 'sepa', 'Com creo una remesa SEPA de quotes?', ['howto-remittance-create-sepa'], 'covered', true),
  buildCase('remeses-03', 'Remeses i SEPA', 'sepa', 'Com reviso una remesa abans d’enviar-la?', ['howto-remittance-review-before-send'], 'covered', true),
  buildCase('remeses-04', 'Remeses i SEPA', 'remittances', 'Quina diferència hi ha entre dividir una remesa i generar una remesa SEPA?', ['guide-split-remittance', 'howto-remittance-create-sepa', 'fallback-remittances-unclear'], 'weak'),
  buildCase('remeses-05', 'Remeses i SEPA', 'remittances', 'La remesa té menys socis del que esperava. Què passa?', ['guide-remittance-low-members'], 'covered'),
  buildCase('remeses-06', 'Remeses i SEPA', 'remittances', 'He dividit una remesa i m’he equivocat. Es pot desfer?', ['guide-split-remittance'], 'covered'),
  buildCase('remeses-07', 'Remeses i SEPA', 'remittances', 'Apareixen socis que haurien d’estar de baixa. Per què passa?', ['guide-remittance-low-members', 'guide-donor-inactive'], 'covered'),
  buildCase('remeses-08', 'Remeses i SEPA', 'remittances', 'Un soci no apareix identificat a la remesa. Per què?', ['ts-remittance-member-not-identified'], 'covered'),
  buildCase('remeses-09', 'Remeses i SEPA', 'remittances', 'Alguns socis no tenen la periodicitat informada. Què faig?', ['guide-remittance-low-members', 'fallback-remittances-unclear'], 'weak'),
  buildCase('remeses-10', 'Remeses i SEPA', 'remittances', 'Un soci apareix com "No toca encara" però sí que el vull cobrar. Puc incloure’l?', ['guide-remittance-low-members', 'howto-remittance-review-before-send'], 'covered'),

  buildCase('devolucions-01', 'Devolucions i Stripe', 'remittances', 'Tinc devolucions pendents però no sé de qui són. Què faig?', ['guide-returns'], 'covered', true),
  buildCase('devolucions-02', 'Devolucions i Stripe', 'remittances', 'Si no assigno les devolucions, què passa exactament?', ['guide-returns'], 'covered'),
  buildCase('devolucions-03', 'Devolucions i Stripe', 'remittances', 'Un soci té moltes devolucions. Hauria de donar-lo de baixa?', ['guide-returns'], 'covered'),
  buildCase('devolucions-04', 'Devolucions i Stripe', 'remittances', 'El banc m’ha retornat una remesa sencera. Com ho registro?', ['howto-import-bank-returns', 'guide-returns'], 'covered'),
  buildCase('devolucions-05', 'Devolucions i Stripe', 'fiscal', 'Les devolucions afecten el certificat de donació?', ['guide-donor-certificate', 'guide-returns'], 'covered'),
  buildCase('devolucions-06', 'Devolucions i Stripe', 'transactions', 'Rebem donacions per Stripe però al banc només veig un ingrés. Com ho desgloso?', ['guide-stripe-donations'], 'covered', true),
  buildCase('devolucions-07', 'Devolucions i Stripe', 'transactions', 'Un donant de Stripe no apareix identificat. Per què?', ['guide-stripe-donations'], 'covered'),
  buildCase('devolucions-08', 'Devolucions i Stripe', 'transactions', 'On descarrego el CSV de Stripe?', ['guide-stripe-donations'], 'covered'),
  buildCase('devolucions-09', 'Devolucions i Stripe', 'documents', 'Les comissions de Stripe on queden registrades?', ['manual-stripe-best-practices', 'guide-stripe-donations'], 'covered'),
  buildCase('devolucions-10', 'Devolucions i Stripe', 'transactions', 'Un donant ha fet una donació a Stripe i després l’ha retornada. Com ho gestiono?', ['guide-stripe-donations', 'guide-returns'], 'covered'),

  buildCase('fiscal-01', 'Fiscalitat i certificats', 'fiscal', 'Quan haig de tenir el Model 182 preparat?', ['guide-reports', 'guide-year-end-fiscal'], 'covered'),
  buildCase('fiscal-02', 'Fiscalitat i certificats', 'fiscal', 'El Model 182 em mostra errors. Estic fent algo malament?', ['guide-model-182'], 'covered', true),
  buildCase('fiscal-03', 'Fiscalitat i certificats', 'fiscal', 'Un donant no surt al Model 182. Per què?', ['ts-model-182-donor-missing'], 'covered', true),
  buildCase('fiscal-04', 'Fiscalitat i certificats', 'fiscal', 'Què vol dir "recurrent" al Model 182?', ['guide-model-182'], 'covered'),
  buildCase('fiscal-05', 'Fiscalitat i certificats', 'fiscal', 'Puc generar el Model 182 diverses vegades per revisar-lo?', ['guide-model-182-generate'], 'covered'),
  buildCase('fiscal-06', 'Fiscalitat i certificats', 'fiscal', 'Puc presentar el Model 182 directament a l’AEAT sense passar per la gestoria?', ['fallback-fiscal-unclear'], 'covered'),
  buildCase('fiscal-07', 'Fiscalitat i certificats', 'fiscal', 'Què és el Model 347 i m’afecta?', ['guide-model-347'], 'covered'),
  buildCase('fiscal-08', 'Fiscalitat i certificats', 'fiscal', 'Un donant em demana el certificat de donació i estem a març. Puc fer-lo?', ['guide-donor-certificate'], 'covered'),
  buildCase('fiscal-09', 'Fiscalitat i certificats', 'fiscal', "Puc generar certificats de donació d'anys anteriors?", ['guide-donor-certificate'], 'covered'),
  buildCase('fiscal-10', 'Fiscalitat i certificats', 'fiscal', 'Com envio els certificats als donants? Els puc enviar per email des de Summa Social?', ['guide-donor-certificate'], 'covered'),

  buildCase('importacio-01', 'Importació i càrrega inicial', 'donors', 'Tinc tots els donants en un Excel molt antic i desendreçat. Puc importar-lo igualment?', ['guide-import-donors'], 'covered'),
  buildCase('importacio-02', 'Importació i càrrega inicial', 'donors', 'Què és això de la "plantilla oficial" que veig als importadors?', ['guide-import-donors'], 'covered'),
  buildCase('importacio-03', 'Importació i càrrega inicial', 'transactions', 'He importat l’extracte del banc dues vegades sense voler. Ara tinc tot duplicat?', ['howto-import-safe-duplicates'], 'covered', true),
  buildCase('importacio-04', 'Importació i càrrega inicial', 'transactions', 'El meu banc em dóna l’extracte en un format molt estrany. Funcionarà?', ['ts-import-invalid-format', 'guide-import-movements'], 'covered'),
  buildCase('importacio-05', 'Importació i càrrega inicial', 'transactions', "Puc importar moviments de tot l'any passat o només del mes actual?", ['guide-import-movements', 'guide-initial-load'], 'covered'),
  buildCase('importacio-06', 'Importació i càrrega inicial', 'donors', 'L’Excel que tinc té columnes amb noms diferents als que demana Summa Social. Com ho faig?', ['ts-import-missing-columns', 'guide-import-donors'], 'covered'),
  buildCase('importacio-07', 'Importació i càrrega inicial', 'donors', 'Què passa si l’Excel té files buides o dades mal formatejades?', ['guide-import-donors', 'ts-import-missing-columns', 'ts-import-invalid-format'], 'covered'),
  buildCase('importacio-08', 'Importació i càrrega inicial', 'general', "Puc importar dades d'un altre programa de comptabilitat?", ['guide-initial-load', 'fallback-no-answer'], 'weak'),
  buildCase('importacio-09', 'Importació i càrrega inicial', 'transactions', 'Com sé quants moviments s’han importat correctament?', ['guide-import-movements'], 'covered'),
  buildCase('importacio-10', 'Importació i càrrega inicial', 'transactions', 'Com detecto duplicats en importar?', ['howto-import-safe-duplicates'], 'covered'),

  buildCase('projectes-01', 'Projectes i liquidacions', 'projects', 'Necessito fer servir els projectes o puc ignorar-los?', ['guide-projects'], 'covered'),
  buildCase('projectes-02', 'Projectes i liquidacions', 'projects', 'Com obro un projecte?', ['project-open'], 'covered', true),
  buildCase('projectes-03', 'Projectes i liquidacions', 'projects', 'Com assigno una despesa a un projecte?', ['guide-projects'], 'covered', true),
  buildCase('projectes-04', 'Projectes i liquidacions', 'projects', 'Puc veure quant hem gastat en un projecte concret?', ['guide-projects'], 'covered'),
  buildCase('projectes-05', 'Projectes i liquidacions', 'projects', 'Per què no em surten totes les despeses de la seu al llistat de despeses per imputar?', ['manual-project-expenses-filtered-feed'], 'covered'),
  buildCase('projectes-06', 'Projectes i liquidacions', 'projects', 'Què passa si una despesa va a diversos projectes?', ['guide-projects'], 'covered'),
  buildCase('projectes-07', 'Projectes i liquidacions', 'projects', 'Què és el "mode quadrar justificació"?', ['guide-projects'], 'covered'),
  buildCase('projectes-08', 'Projectes i liquidacions', 'projects', "Puc importar el pressupost d'un projecte des d'Excel?", ['guide-projects', 'fallback-no-answer'], 'weak'),
  buildCase('projectes-09', 'Projectes i liquidacions', 'documents', 'Què són les liquidacions de despeses de viatge?', ['guide-travel-receipts'], 'covered'),
  buildCase('projectes-10', 'Projectes i liquidacions', 'documents', 'Com afegeixo tiquets i quilometratge a una liquidació?', ['guide-travel-receipts'], 'covered'),

  buildCase('equip-01', 'Equip, permisos i multi-org', 'config', 'Com accedeixo a l’aplicació?', ['manual-login-access'], 'covered'),
  buildCase('equip-02', 'Equip, permisos i multi-org', 'config', 'Com recupero la contrasenya?', ['guide-reset-password'], 'covered', true),
  buildCase('equip-03', 'Equip, permisos i multi-org', 'config', 'Com convido un nou usuari?', ['howto-member-invite'], 'covered', true),
  buildCase('equip-04', 'Equip, permisos i multi-org', 'config', 'Com canvio els permisos d’un usuari?', ['howto-member-user-permissions'], 'covered', true),
  buildCase('equip-05', 'Equip, permisos i multi-org', 'config', 'Puc fer que algú només entri en lectura?', ['howto-member-user-permissions'], 'covered'),
  buildCase('equip-06', 'Equip, permisos i multi-org', 'config', 'Puc canviar el meu email d’accés?', ['manual-access-email'], 'weak'),
  buildCase('equip-07', 'Equip, permisos i multi-org', 'config', 'Com sé quin rol tinc?', ['guide-access-security', 'fallback-no-answer'], 'weak'),
  buildCase('equip-08', 'Equip, permisos i multi-org', 'config', 'Com canvio les dades fiscals de l’entitat?', ['howto-organization-fiscal-data'], 'covered'),
  buildCase('equip-09', 'Equip, permisos i multi-org', 'transactions', 'Tenim dos comptes bancaris. Com els gestiono?', ['guide-select-bank-account'], 'covered'),
  buildCase('equip-10', 'Equip, permisos i multi-org', 'config', 'Puc tenir diverses organitzacions?', ['manual-multi-organization'], 'covered'),

  buildCase('errors-01', 'Errors i incidències', 'general', 'Acabo d’entrar per primera vegada i veig molts números vermells. M’hauria d’espantar?', ['guide-first-day', 'manual-common-errors'], 'covered'),
  buildCase('errors-02', 'Errors i incidències', 'config', 'La sessió se’m tanca cada dos per tres. És normal?', ['manual-login-access'], 'covered'),
  buildCase('errors-03', 'Errors i incidències', 'general', 'L’aplicació va molt lenta. Què puc fer?', ['ts-slow-app', 'manual-common-errors'], 'covered'),
  buildCase('errors-04', 'Errors i incidències', 'general', 'M’apareix un missatge d’error que no entenc.', ['manual-common-errors'], 'covered'),
  buildCase('errors-05', 'Errors i incidències', 'general', 'La pàgina es queda en blanc.', ['manual-common-errors', 'fallback-no-answer'], 'weak'),
  buildCase('errors-06', 'Errors i incidències', 'general', 'He fet un canvi i no es guarda.', ['manual-common-errors', 'fallback-no-answer'], 'weak'),
  buildCase('errors-07', 'Errors i incidències', 'general', 'He esborrat algo sense voler. Es pot recuperar?', ['manual-danger-zone', 'fallback-no-answer'], 'weak'),
  buildCase('errors-08', 'Errors i incidències', 'general', 'Error: sense connexió.', ['ts-offline-error'], 'covered'),
  buildCase('errors-09', 'Errors i incidències', 'general', 'No trobo la resposta a cap lloc. Amb qui parlo?', ['manual-guides-hub', 'fallback-no-answer'], 'covered'),
  buildCase('errors-10', 'Errors i incidències', 'sepa', "Tinc un error de validació SEPA o d'import i no sé interpretar-lo.", ['ts-sepa-validation-error', 'ts-import-invalid-format'], 'covered'),

  buildCase('orientacio-01', 'Inici i orientació', 'general', 'Què vol dir cada secció del menú lateral?', ['manual-menu-sections'], 'covered'),
  buildCase('orientacio-02', 'Inici i orientació', 'general', 'Com entenc el Dashboard i què he de mirar primer?', ['guide-first-day'], 'covered'),
  buildCase('orientacio-03', 'Inici i orientació', 'general', 'Com em puc assabentar de les novetats i millores de Summa Social?', ['manual-product-updates'], 'covered'),
  buildCase('orientacio-04', 'Inici i orientació', 'general', 'Tinc un dubte i no trobo la resposta a cap lloc. On puc buscar ajuda dins l’app?', ['manual-guides-hub'], 'covered'),
  buildCase('orientacio-05', 'Inici i orientació', 'general', 'Puc fer servir Summa Social des del mòbil?', ['manual-mobile-usage'], 'covered'),
  buildCase('orientacio-06', 'Inici i orientació', 'general', 'Quant de temps em portarà això cada mes?', ['guide-monthly-flow', 'guide-first-month'], 'covered'),
  buildCase('orientacio-07', 'Inici i orientació', 'general', 'Per on començo si és la primera vegada que entro?', ['guide-first-day'], 'covered'),
  buildCase('orientacio-08', 'Inici i orientació', 'general', 'He tancat la pestanya sense voler. He perdut el que estava fent?', ['manual-closed-tab'], 'weak'),
  buildCase('orientacio-09', 'Inici i orientació', 'config', 'L’aplicació està en castellà i la vull en català. Com ho canvio?', ['guide-change-language'], 'covered'),
  buildCase('orientacio-10', 'Inici i orientació', 'general', 'Què és la Zona de Perill?', ['manual-danger-zone'], 'covered'),
]

function getRenderableStepCount(card: KBCard, lang: KbLang): number {
  const raw = card.guideId
    ? loadGuideContent(card.guideId, lang)
    : (card.answer?.[lang] ?? card.answer?.ca ?? card.answer?.es ?? '')
  return extractOperationalSteps(raw).length
}

function toRate(part: number, total: number): number {
  return total > 0 ? part / total : 0
}

export function evaluateTopSupportQuestionsBenchmark(
  cards: KBCard[],
  cases: TopSupportQuestionCase[] = TOP_SUPPORT_USER_QUESTIONS_CA
): TopSupportQuestionsEval {
  let positiveCount = 0
  let criticalPositiveCount = 0
  let criticalTotal = 0
  let coveredPositiveCount = 0
  let coveredTotal = 0
  let weakPositiveCount = 0
  let weakTotal = 0
  let absentPositiveCount = 0
  let absentTotal = 0
  let clarifyCount = 0
  let fallbackCount = 0
  let cardMatchCount = 0
  let safeFallbackCount = 0
  let unresolvedInScopeCount = 0
  let trustedOperationalCount = 0

  const mismatches: TopSupportQuestionsMismatch[] = []

  for (const testCase of cases) {
    const result = retrieveCard(testCase.question, testCase.lang, cards)
    const actualCardId = result.clarifyOptions?.length ? 'clarify-disambiguation' : result.card.id
    const trustedOperational = result.mode === 'card' && getRenderableStepCount(result.card, testCase.lang) > 0

    if (result.mode === 'fallback') fallbackCount += 1
    if (actualCardId === 'clarify-disambiguation') clarifyCount += 1
    if (trustedOperational) trustedOperationalCount += 1

    const accepted = testCase.expectedAnyOfCardIds.includes(actualCardId)
    const positive = accepted

    if (result.mode === 'fallback') {
      if (accepted) safeFallbackCount += 1
      else unresolvedInScopeCount += 1
    } else if (actualCardId !== 'clarify-disambiguation' && accepted) {
      cardMatchCount += 1
    }

    if (testCase.critical) {
      criticalTotal += 1
      if (positive) criticalPositiveCount += 1
    }

    if (testCase.coverage === 'covered') {
      coveredTotal += 1
      if (positive) coveredPositiveCount += 1
    } else if (testCase.coverage === 'weak') {
      weakTotal += 1
      if (positive) weakPositiveCount += 1
    } else {
      absentTotal += 1
      if (positive) absentPositiveCount += 1
    }

    if (positive) {
      positiveCount += 1
      continue
    }

    mismatches.push({
      id: testCase.id,
      question: testCase.question,
      expectedAnyOfCardIds: testCase.expectedAnyOfCardIds,
      actualCardId,
      actualMode: result.mode,
      coverage: testCase.coverage,
      confidence: result.confidence,
      trustedOperational,
    })
  }

  return {
    metrics: {
      total: cases.length,
      positiveCount,
      positiveRate: toRate(positiveCount, cases.length),
      criticalTotal,
      criticalPositiveCount,
      criticalPositiveRate: toRate(criticalPositiveCount, criticalTotal),
      coveredTotal,
      coveredPositiveCount,
      coveredPositiveRate: toRate(coveredPositiveCount, coveredTotal),
      weakTotal,
      weakPositiveCount,
      weakPositiveRate: toRate(weakPositiveCount, weakTotal),
      absentTotal,
      absentPositiveCount,
      absentPositiveRate: toRate(absentPositiveCount, absentTotal),
      clarifyCount,
      fallbackCount,
      cardMatchCount,
      safeFallbackCount,
      unresolvedInScopeCount,
      trustedOperationalCount,
    },
    mismatches,
  }
}
