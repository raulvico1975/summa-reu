import { renderReturnEmailTemplate } from '@/lib/returns/render-return-email-template';

export type ReturnEmailDraftLanguage = 'ca' | 'es' | 'fr' | 'pt';

const SYSTEM_DEFAULT_RETURN_EMAIL_TEMPLATE: Record<ReturnEmailDraftLanguage, string> = {
  ca: `Bon dia {{name}},

Hem rebut la devolució de la quota corresponent a {{month}} per un import de {{amount}}.

Quan us sigui possible, us agrairem que reviseu si hi ha algun problema amb el compte o el saldo. Si tot està correcte, ens ho podeu confirmar i tornarem a intentar el cobrament en la propera remesa.

Moltes gràcies pel vostre suport.

Una salutació,
L’equip`,
  es: `Buenos días {{name}},

Hemos recibido la devolución de la cuota correspondiente a {{month}} por un importe de {{amount}}.

Cuando os vaya bien, os agradeceremos que reviséis si hay algún problema con la cuenta o el saldo. Si todo está correcto, podéis confirmárnoslo y volveremos a intentar el cobro en la próxima remesa.

Muchas gracias por vuestro apoyo.

Un saludo,
El equipo`,
  fr: `Bonjour {{name}},

Nous avons reçu le retour de la cotisation correspondant à {{month}} pour un montant de {{amount}}.

Quand vous le pourrez, merci de vérifier s’il y a un problème avec le compte ou le solde. Si tout est correct, vous pouvez nous le confirmer et nous réessaierons l’encaissement lors du prochain prélèvement.

Merci beaucoup pour votre soutien.

Cordialement,
L’équipe`,
  pt: `Bom dia {{name}},

Recebemos a devolução da quota referente a {{month}} no valor de {{amount}}.

Quando vos for possível, agradecemos que verifiquem se existe algum problema com a conta ou com o saldo. Se estiver tudo correto, podem confirmar-nos e voltaremos a tentar a cobrança na próxima remessa.

Muito obrigado pelo vosso apoio.

Cumprimentos,
A equipa`,
};

const LOCALE_BY_LANGUAGE: Record<ReturnEmailDraftLanguage, string> = {
  ca: 'ca-ES',
  es: 'es-ES',
  fr: 'fr-FR',
  pt: 'pt-PT',
};

function toMonthYear(txDate: string, language: ReturnEmailDraftLanguage): string {
  const isoDate = txDate.slice(0, 10);
  const parsedDate = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return txDate;
  }
  return new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[language], {
    month: 'long',
    year: 'numeric',
  }).format(parsedDate);
}

function toAmount(amount: number, language: ReturnEmailDraftLanguage): string {
  return new Intl.NumberFormat(LOCALE_BY_LANGUAGE[language], {
    style: 'currency',
    currency: 'EUR',
  }).format(Math.abs(amount));
}

export function buildReturnEmailDraft(input: {
  contactName?: string | null;
  txDate: string;
  amount: number;
  language: ReturnEmailDraftLanguage;
  organizationReturnTemplate?: string | null;
}): string {
  const normalizedName = input.contactName?.trim() ?? '';
  const template = input.organizationReturnTemplate?.trim()
    ? input.organizationReturnTemplate
    : SYSTEM_DEFAULT_RETURN_EMAIL_TEMPLATE[input.language] ?? SYSTEM_DEFAULT_RETURN_EMAIL_TEMPLATE.ca;

  const rendered = renderReturnEmailTemplate(template, {
    name: normalizedName,
    month: toMonthYear(input.txDate, input.language),
    amount: toAmount(input.amount, input.language),
  });

  if (!normalizedName) {
    return rendered.replace(/^([^\n,]+?)\s+,/m, '$1,');
  }

  return rendered;
}
