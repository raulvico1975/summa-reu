// src/app/api/ai/generate-product-update/route.ts
// Endpoint per generar contingut de novetats del producte amb IA
// Output sempre TEXT PLA estructurat (NO HTML)

import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';

// ─────────────────────────────────────────────────────────────────────────────
// Tipus
// ─────────────────────────────────────────────────────────────────────────────

interface GenerateRequest {
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

interface GenerateResponse {
  contentLong: string;
  web?: {
    excerpt: string;
    content: string;
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

// ─────────────────────────────────────────────────────────────────────────────
// Prompt
// ─────────────────────────────────────────────────────────────────────────────

function buildPrompt(req: GenerateRequest): string {
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

  // Sempre generar prompt d'imatge (útil per crear visualment)
  prompt += `  "image": {
    "prompt": "Prompt per generar imatge amb IA (DALL-E/Midjourney style). Descriu una il·lustració minimalista, colors corporatius blau i blanc, estil flat/modern, sense text",
    "altText": "Text alternatiu descriptiu per accessibilitat (màx 125 chars)"
  },
`;

  prompt += `  "analysis": {
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

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as GenerateRequest;

    // Validar camps requerits
    if (!body.title || !body.description) {
      return NextResponse.json(
        { error: 'Títol i descripció són obligatoris' },
        { status: 400 }
      );
    }

    const prompt = buildPrompt(body);

    // Generar amb el runtime compartit de Genkit
    const result = await ai.generate({
      prompt,
      config: {
        temperature: 0.7,
      },
    });

    const text = result.text;

    // Extreure JSON de la resposta
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[ai/generate-product-update] No JSON found in response:', text);
      return NextResponse.json(
        { error: 'No s\'ha pogut generar contingut vàlid' },
        { status: 500 }
      );
    }

    const generated = JSON.parse(jsonMatch[0]) as GenerateResponse;

    // Validar estructura mínima
    if (!generated.contentLong || !generated.analysis) {
      return NextResponse.json(
        { error: 'Resposta incompleta de la IA' },
        { status: 500 }
      );
    }

    return NextResponse.json(generated);
  } catch (error) {
    console.error('[ai/generate-product-update] Error:', error);
    return NextResponse.json(
      { error: 'Error intern generant contingut' },
      { status: 500 }
    );
  }
}
