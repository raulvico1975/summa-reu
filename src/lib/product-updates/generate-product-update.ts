import { ai } from '@/ai/genkit';
import { generateSpanishProductUpdateVariant } from '@/lib/product-updates/server-localization';

export interface GenerateProductUpdateRequest {
  title: string;
  description: string;
  aiInput?: {
    changeBrief?: string;
    problemReal?: string;
    affects?: string;
    userAction?: string;
  };
  webEnabled?: boolean;
  socialEnabled?: boolean;
}

export interface GenerateProductUpdateResponse {
  contentLong: string;
  web?: {
    excerpt: string;
    content: string;
  };
  locales?: {
    es?: {
      title: string;
      description: string;
      contentLong: string;
      web?: {
        title: string;
        excerpt: string;
        content: string;
      } | null;
    };
  };
  social?: {
    xText: string;
    linkedinText: string;
  };
  image?: {
    prompt: string;
    altText: string;
  };
  analysis: {
    clarityScore: number;
    techRisk: 'low' | 'medium' | 'high';
    recommendation: 'PUBLICAR' | 'REVISAR' | 'NO_PUBLICAR';
    notes: string;
  };
}

interface GenerateProductUpdateDeps {
  generateText?: (prompt: string) => Promise<string>;
  localizeSpanish?: typeof generateSpanishProductUpdateVariant;
}

export function buildGenerateProductUpdatePrompt(req: GenerateProductUpdateRequest): string {
  const { title, description, aiInput, webEnabled, socialEnabled } = req;

  let prompt = `Ets un redactor de novetats de producte per a una aplicació de gestió econòmica d'entitats socials (Summa Social).

REGLA CRÍTICA: Tot el contingut ha de ser TEXT PLA. NO HTML, NO markdown amb links, NO etiquetes.
Format de llistes: usa "- " al principi de línia.

Genera contingut per a la següent novetat:

TÍTOL: ${title}
DESCRIPCIÓ BREU: ${description}
`;

  if (aiInput?.changeBrief) {
    prompt += `\nQUÈ HA CANVIAT: ${aiInput.changeBrief}`;
  }
  if (aiInput?.problemReal) {
    prompt += `\nPROBLEMA QUE RESOL: ${aiInput.problemReal}`;
  }
  if (aiInput?.affects) {
    prompt += `\nA QUI AFECTA: ${aiInput.affects}`;
  }
  if (aiInput?.userAction) {
    prompt += `\nACCIÓ DE L'USUARI: ${aiInput.userAction}`;
  }

  prompt += `

GENERA (en JSON vàlid):

{
  "contentLong": "Text pla estructurat (3-5 línies). Usa '- ' per llistes. Explica el canvi de forma clara i concisa.",
`;

  if (webEnabled) {
    prompt += `  "web": {
    "excerpt": "Resum d'1-2 frases per SEO (màx 160 chars)",
    "content": "Text pla estructurat més detallat per la pàgina web (5-8 línies)"
  },
`;
  }

  if (socialEnabled) {
    prompt += `  "social": {
    "xText": "Copy per X/Twitter (màx 280 chars). Directe, sense hashtags",
    "linkedinText": "Copy per LinkedIn (màx 500 chars). Professional però proper"
  },
`;
  }

  prompt += `  "image": {
    "prompt": "Prompt per generar imatge amb IA (DALL-E/Midjourney style). Descriu una il·lustració minimalista, colors corporatius blau i blanc, estil flat/modern, sense text",
    "altText": "Text alternatiu descriptiu per accessibilitat (màx 125 chars)"
  },
  "analysis": {
    "clarityScore": 1-10,
    "techRisk": "low" | "medium" | "high",
    "recommendation": "PUBLICAR" | "REVISAR" | "NO_PUBLICAR",
    "notes": "Observacions breus sobre la qualitat del contingut"
  }
}

IMPORTANT:
- Tot en català
- Text pla sempre (NO HTML, NO markdown links)
- Llistes amb "- " al principi
- Enfocament pràctic i orientat a l'usuari
- Evita tecnicismes innecessaris`;

  return prompt;
}

function parseGeneratedResponse(text: string): GenerateProductUpdateResponse {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No s\'ha pogut generar contingut vàlid');
  }

  const generated = JSON.parse(jsonMatch[0]) as GenerateProductUpdateResponse;
  if (!generated.contentLong || !generated.analysis) {
    throw new Error('Resposta incompleta de la IA');
  }

  return generated;
}

export async function generateProductUpdateContent(
  input: GenerateProductUpdateRequest,
  deps: GenerateProductUpdateDeps = {}
): Promise<GenerateProductUpdateResponse> {
  if (!input.title?.trim() || !input.description?.trim()) {
    throw new Error('Títol i descripció són obligatoris');
  }

  const prompt = buildGenerateProductUpdatePrompt(input);
  const generateText = deps.generateText ?? (async (runtimePrompt: string) => {
    const result = await ai.generate({
      prompt: runtimePrompt,
      config: {
        temperature: 0.7,
      },
    });

    return result.text;
  });

  const generated = parseGeneratedResponse(await generateText(prompt));
  const localizeSpanish = deps.localizeSpanish ?? generateSpanishProductUpdateVariant;

  const spanishVariant = await localizeSpanish({
    title: input.title,
    description: input.description,
    contentLong: generated.contentLong,
    web: input.webEnabled
      ? {
          title: input.title,
          excerpt: generated.web?.excerpt ?? input.description,
          content: generated.web?.content ?? generated.contentLong,
        }
      : null,
  });

  generated.locales = {
    es: {
      title: spanishVariant.title,
      description: spanishVariant.description,
      contentLong: spanishVariant.contentLong,
      web: spanishVariant.web
        ? {
            title: spanishVariant.web.title,
            excerpt: spanishVariant.web.excerpt ?? spanishVariant.description,
            content: spanishVariant.web.content ?? spanishVariant.contentLong,
          }
        : null,
    },
  };

  return generated;
}
