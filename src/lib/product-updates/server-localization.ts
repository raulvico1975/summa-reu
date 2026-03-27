import { ai } from '@/ai/genkit';

export interface ProductUpdateLocalizationInput {
  title: string;
  description: string;
  contentLong: string;
  web?: {
    title?: string | null;
    excerpt?: string | null;
    content?: string | null;
  } | null;
}

export interface ProductUpdateLocalizedVariant {
  title: string;
  description: string;
  contentLong: string;
  web?: {
    title: string;
    excerpt: string | null;
    content: string | null;
  } | null;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function generateSpanishProductUpdateVariant(
  input: ProductUpdateLocalizationInput
): Promise<ProductUpdateLocalizedVariant> {
  const hasWeb = !!input.web;

  const prompt = `Ets un traductor editorial de producte.

Tradueix del català al castellà mantenint:
- el mateix significat
- el mateix to pràctic i directe
- text pla sempre
- sense HTML
- sense afegir funcionalitats noves
- sense canviar "Summa" ni noms de seccions si ja són noms propis

Text base de l'app:
- title: ${input.title}
- description: ${input.description}
- contentLong:
${input.contentLong}
${hasWeb ? `
Text base de la web:
- web.title: ${input.web?.title ?? input.title}
- web.excerpt: ${input.web?.excerpt ?? input.description}
- web.content:
${input.web?.content ?? input.contentLong}
` : ''}

Retorna només JSON vàlid amb aquest format:
{
  "title": "traducció al castellà",
  "description": "traducció al castellà",
  "contentLong": "traducció al castellà",
  "web": ${hasWeb ? `{
    "title": "traducció al castellà",
    "excerpt": "traducció al castellà",
    "content": "traducció al castellà"
  }` : 'null'}
}

IMPORTANT:
- Tot en castellà
- Text pla, sense markdown ni HTML
- Mantén salts de línia si ajuden a la lectura
- No inventis res`;

  const result = await ai.generate({
    prompt,
    config: {
      temperature: 0.2,
    },
  });

  const text = result.text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No s\'ha pogut generar la traducció al castellà');
  }

  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  const title = asNonEmptyString(parsed.title);
  const description = asNonEmptyString(parsed.description);
  const contentLong = asNonEmptyString(parsed.contentLong);

  if (!title || !description || !contentLong) {
    throw new Error('La traducció al castellà ha quedat incompleta');
  }

  const parsedWeb =
    typeof parsed.web === 'object' && parsed.web !== null && !Array.isArray(parsed.web)
      ? parsed.web as Record<string, unknown>
      : null;

  return {
    title,
    description,
    contentLong,
    web: hasWeb
      ? {
          title: asNonEmptyString(parsedWeb?.title) ?? title,
          excerpt: asNonEmptyString(parsedWeb?.excerpt) ?? description,
          content: asNonEmptyString(parsedWeb?.content) ?? contentLong,
        }
      : null,
  };
}
