import { ai } from '@/ai/genkit'
import {
  hasGoogleGenAiApiKey,
  resolveGoogleGenAiModelLabel,
} from '@/ai/config'
import {
  buildExcerptFromMarkdown,
  buildMetaDescriptionFromMarkdown,
  normalizeTagList,
  renderEditorialMarkdownToHtml,
  slugifyDraftTitle,
} from '@/lib/editorial-native/markdown'
import { resolveNativeBlogKbContext } from '@/lib/editorial-native/kb'
import type {
  NativeBlogContext,
  NativeBlogDraft,
  NativeBlogDraftTranslation,
  NativeBlogGenerateInput,
  NativeBlogValidationStatus,
  NativeBlogValidationVerdict,
} from '@/lib/editorial-native/types'

type GenerationPayload = {
  title?: unknown
  seoTitle?: unknown
  metaDescription?: unknown
  excerpt?: unknown
  slug?: unknown
  category?: unknown
  tags?: unknown
  contentMarkdown?: unknown
  imagePrompt?: unknown
  coverImageAlt?: unknown
}

type ReviewPayload = {
  validationStatus?: unknown
  validationVerdict?: unknown
  notes?: unknown
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("La IA no ha retornat un JSON vàlid.")
  }

  return trimmed.slice(start, end + 1)
}

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return normalizeTagList(value.filter((item): item is string => typeof item === 'string'))
}

function ensureAiReady() {
  if (!hasGoogleGenAiApiKey()) {
    throw new Error("Falta la clau de Gemini per generar drafts natius del blog.")
  }
}

function inferFallbackCategory(input: NativeBlogGenerateInput): string {
  const normalized = [input.prompt, input.problem, input.objective]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (/(182|347|fiscal|donaci|quota|hisenda)/.test(normalized)) return 'fiscal'
  if (/(remes|devoluci|sepa|cobrament|tresorer)/.test(normalized)) return 'operativa'
  return 'criteri-operatiu'
}

type FallbackTopicProfile = {
  key: 'stripe' | 'remeses' | 'fiscal' | 'subvencions' | 'general'
  title: string
  intro: string
  riskSectionTitle: string
  riskParagraph: string
  criteriaTitle: string
  criteriaBullets: string[]
  exampleTitle?: string
  exampleParagraph?: string
  avoidTitle: string
  avoidBullets: string[]
}

function firstSentence(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  const match = normalized.match(/.+?[.!?](?:\s|$)/)
  return (match?.[0] ?? normalized).trim()
}

function extractKbPrinciples(kbSnippets: string[]): string[] {
  const principles = kbSnippets
    .map((snippet) => {
      const compact = snippet.replace(/\s+/g, ' ').trim()
      const bulletSegments = compact
        .split(/\s-\s+/)
        .slice(1)
        .map((segment) => segment.trim())
        .filter(Boolean)

      const candidate = bulletSegments[0] ?? compact
      const normalized = firstSentence(
        candidate
          .replace(/^kb:[^·]+ ·\s*/i, '')
          .replace(/^[^:]+:\s*/i, '')
          .replace(/^\d+\.\s*/, '')
          .replace(/^[-*]\s*/, '')
          .replace(/\s+/g, ' ')
          .trim()
      )
        .replace(/^kb:[^\s]+/i, '')
        .replace(/^[^:]+:\s*/i, '')
        .replace(/^\d+\.\s*/, '')
        .trim()

      if (!normalized) return null
      if (normalized.length < 32) return null
      if (/^[\d.\s·-]+$/.test(normalized)) return null

      return normalized
    })
    .filter((value): value is string => Boolean(value))

  return [...new Set(principles)].slice(0, 2)
}

function detectFallbackTopicProfile(input: NativeBlogGenerateInput, kbSnippets: string[]): FallbackTopicProfile {
  const normalized = [input.prompt, input.problem, input.objective, ...kbSnippets]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (normalized.includes('stripe')) {
    return {
      key: 'stripe',
      title: 'Com conciliar els cobraments de Stripe sense perdre el detall de cada aportació',
      intro:
        'Quan Stripe liquida diversos cobraments en un únic moviment bancari, l’entitat pot perdre el detall real de cada quota, donació o aportació si tot queda registrat com un sol apunt.',
      riskSectionTitle: 'Per què aquest punt genera tants errors',
      riskParagraph:
        'El problema no és només comptable. Si no es conserva el detall intern de cada cobrament, després costa reconciliar impagats, devolucions, quotes recurrents i justificacions davant de junta o tresoreria.',
      criteriaTitle: 'Criteri operatiu que convé aplicar',
      criteriaBullets: [
        'conservar el moviment bancari agregat com a liquidació, però desglossar internament cada aportació',
        'separar imports cobrats, comissions i devolucions per no confondre ingressos reals amb moviments de passarel·la',
        'poder traçar cada apunt intern fins al soci, donant o concepte original',
      ],
      exampleTitle: 'Un exemple molt habitual',
      exampleParagraph:
        'Si Stripe liquida en un únic abonament les quotes de diversos socis, el banc només mostrarà l’import net. El control intern, en canvi, hauria de permetre veure quines quotes s’han cobrat, quines comissions s’han descomptat i si hi ha devolucions o incidències pendents.',
      avoidTitle: 'Què convé evitar',
      avoidBullets: [
        'registrar tota la liquidació com si fos un únic cobrament sense detall intern',
        'barrejar comissions de Stripe amb quotes o donacions',
        'deixar la conciliació per al tancament mensual sense criteri previ',
      ],
    }
  }

  if (/(remes|devoluci|sepa|cobrament)/.test(normalized)) {
    return {
      key: 'remeses',
      title: 'Com revisar remeses i devolucions sense perdre el fil operatiu',
      intro:
        'Les remeses no acostumen a fallar per una sola causa. Quan falta criteri comú, qualsevol devolució acaba generant dubtes de tresoreria, seguiment i relació amb les persones que aporten quotes.',
      riskSectionTitle: 'On es complica de veritat',
      riskParagraph:
        'La fricció acostuma a aparèixer quan l’equip sap que hi ha impagats o devolucions, però no pot veure ràpidament què s’ha cobrat, què s’ha retornat i què queda pendent de regularitzar.',
      criteriaTitle: 'Criteri mínim per ordenar la remesa',
      criteriaBullets: [
        'mantenir el detall per persona o rebut encara que el banc mostri només el moviment agregat',
        'registrar devolucions amb motiu i data per no perdre context',
        'diferenciar clarament entre cobrament previst, cobrament efectiu i import retornat',
      ],
      exampleTitle: 'On ajuda molt tenir criteri',
      exampleParagraph:
        'Quan una remesa retorna diversos rebuts, el problema no és només saber quin import ha tornat. El que realment estalvia temps és saber a quines persones afecta, per quin motiu i quin pas toca fer després.',
      avoidTitle: 'Què convé evitar',
      avoidBullets: [
        'gestionar devolucions només des del banc, sense traslladar-les al control intern',
        'reconciliar a posteriori sense una relació clara de rebuts',
        'fer ajustos manuals sense deixar rastre del criteri aplicat',
      ],
    }
  }

  if (/(182|347|fiscal|hisenda|donaci|quota)/.test(normalized)) {
    return {
      key: 'fiscal',
      title: 'Com preparar millor la informació fiscal sense improvisar al final',
      intro:
        'En l’àmbit fiscal, el problema no sol ser la presentació final del model, sinó la manca de criteri durant l’any per saber què s’ha de conservar, com s’ha de classificar i amb quina evidència.',
      riskSectionTitle: 'Per què es complica tant al tancament',
      riskParagraph:
        'Quan les dades s’han anat registrant sense un criteri estable, al final cal reconstruir contactes, imports, justificants i naturalesa de cada aportació o operació.',
      criteriaTitle: 'Criteri que ajuda abans del tancament',
      criteriaBullets: [
        'identificar durant l’any quines operacions tindran impacte fiscal',
        'mantenir la relació entre import, persona o entitat i document justificatiu',
        'separar bé els casos que requereixen revisió manual abans de presentar res',
      ],
      exampleTitle: 'El punt pràctic',
      exampleParagraph:
        'Si la informació fiscal només es revisa quan s’acosta la presentació, l’equip acaba reconstruint dades massa tard. El criteri útil és deixar preparades durant l’any les relacions bàsiques entre import, persona i suport justificatiu.',
      avoidTitle: 'Què convé evitar',
      avoidBullets: [
        'esperar al tancament per decidir què és fiscalment rellevant',
        'barrejar donacions, quotes i altres ingressos sense criteri clar',
        'confiar només en extractes bancaris sense el detall relacional',
      ],
    }
  }

  if (/(subvenci|justificac|aecid|accd)/.test(normalized)) {
    return {
      key: 'subvencions',
      title: 'Com arribar a una justificació econòmica amb menys fricció',
      intro:
        'La justificació econòmica no es resol al final del projecte. Es construeix durant l’execució, quan l’entitat decideix com ordena les despeses, les evidències i la relació amb les bases de la convocatòria.',
      riskSectionTitle: 'On acostuma a aparèixer el bloqueig',
      riskParagraph:
        'Quan la documentació existeix però no està organitzada segons el criteri de la convocatòria, cada revisió obliga a tornar a obrir carpetes, extractes i factures sense una relació clara.',
      criteriaTitle: 'Criteri operatiu útil',
      criteriaBullets: [
        'ordenar la informació segons les bases i no només segons el banc o la comptabilitat',
        'mantenir una relació classificada de despeses viva, no reconstruïda al final',
        'guardar l’evidència amb un criteri que permeti traçar cada partida',
      ],
      exampleTitle: 'Què acostuma a desbloquejar la feina',
      exampleParagraph:
        'Quan la documentació ja està recollida però no segueix el criteri de la convocatòria, la revisió es fa lenta. Una relació classificada mantinguda durant l’execució evita haver de reconstruir el projecte al final.',
      avoidTitle: 'Què convé evitar',
      avoidBullets: [
        'treballar només amb extractes bancaris bruts',
        'deixar la revisió de coherència per al moment de lliurar',
        'tenir la documentació dispersa entre persones o carpetes sense criteri únic',
      ],
    }
  }

  return {
    key: 'general',
    title: input.prompt.trim() || 'Nou article del blog',
    intro:
      'Quan una entitat petita treballa amb pocs recursos administratius, la dificultat gairebé mai és un sol tràmit. El problema real acostuma a ser la falta de criteri compartit per ordenar la feina.',
    riskSectionTitle: 'On es nota aquesta fricció',
    riskParagraph:
      'Les incidències no acostumen a aparèixer perquè falti voluntat, sinó perquè la informació arriba dispersa, els processos no estan prou aterrats i cada cas s’acaba resolent de manera diferent.',
    criteriaTitle: 'Criteri operatiu de base',
    criteriaBullets: [
      'identificar quin punt del procés fa perdre més context',
      'definir un criteri únic abans de tocar eines o automatismes',
      'deixar escrit què es fa, quan i amb quina evidència',
    ],
    exampleTitle: 'Un patró que es repeteix sovint',
    exampleParagraph:
      'Quan la informació està repartida entre correus, fulls de càlcul i memòria informal, qualsevol revisió es fa pesada. El canvi útil acostuma a ser menys tecnològic del que sembla: primer cal un criteri compartit i després un suport senzill per seguir-lo.',
    avoidTitle: 'Què convé evitar',
    avoidBullets: [
      'fer ajustos puntuals sense canviar el criteri de fons',
      'confiar en memòria informal o missatges dispersos',
      'barrejar operativa, fiscalitat i justificació sense separar capes',
    ],
  }
}

function inferFallbackTags(input: NativeBlogGenerateInput, kbSnippets: string[]): string[] {
  const seed = [input.prompt, input.problem, input.objective, ...kbSnippets.slice(0, 2)].join(' ').toLowerCase()
  const tags: string[] = []

  if (/(remes|sepa)/.test(seed)) tags.push('remeses')
  if (/(347)/.test(seed)) tags.push('model-347')
  if (/(182)/.test(seed)) tags.push('model-182')
  if (/(donaci)/.test(seed)) tags.push('donacions')
  if (/(quota)/.test(seed)) tags.push('quotes')
  if (/(subvenci)/.test(seed)) tags.push('subvencions')
  if (tags.length === 0) tags.push('criteri-operatiu')

  return normalizeTagList(tags)
}

function buildTopicSpecificInstructions(input: NativeBlogGenerateInput): string[] {
  const normalized = [input.prompt, input.problem, input.objective]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (normalized.includes('stripe')) {
    return [
      "Si el tema és Stripe, el text ha de ser clarament Stripe-first.",
      'El títol i l\'obertura han de parlar de conciliació, traçabilitat o desglossament de cobraments de Stripe.',
      'Els dos primers paràgrafs han d\'explicar el problema operatiu concret: Stripe agrupa operacions i el banc mostra un únic ingrés.',
      'Model 182, justificacions o subvencions només poden aparèixer com a conseqüència secundària, no com a tesi principal.',
      'Inclou almenys un exemple pràctic de com separar cobrament brut, comissió i import liquidat.',
      'No converteixis la peça en un article general de fiscalitat o subvencions.',
    ]
  }

  return []
}

function buildFallbackMarkdown(input: NativeBlogGenerateInput, kbSnippets: string[]): string {
  const audience = input.audience?.trim() || 'entitats socials petites o mitjanes'
  const objective = input.objective?.trim() || 'aportar criteri operatiu concret'
  const profile = detectFallbackTopicProfile(input, kbSnippets)
  const kbPrinciples = extractKbPrinciples(kbSnippets)

  return `# ${profile.title}

${profile.intro} Aquesta peça està pensada per a ${audience} i busca ${objective}.

## ${profile.riskSectionTitle}

${profile.riskParagraph}

## ${profile.criteriaTitle}

${profile.criteriaBullets.map((bullet) => `- ${bullet}`).join('\n')}

${profile.exampleTitle && profile.exampleParagraph ? `## ${profile.exampleTitle}

${profile.exampleParagraph}

` : ''}${kbPrinciples.length > 0 ? `## Criteri sectorial que convé tenir present

${kbPrinciples.map((principle) => `- ${principle}`).join('\n')}
` : ''}
## Com començar sense complicar-ho

- decidir quin és el nivell mínim de detall que l'entitat necessita conservar
- separar el registre bancari del criteri intern de seguiment, si no són el mateix
- deixar preparat un control simple perquè qualsevol persona de l'equip entengui què ha passat

## ${profile.avoidTitle}

${profile.avoidBullets.map((bullet) => `- ${bullet}`).join('\n')}`
}

function buildFallbackDraft(input: NativeBlogGenerateInput, kbSnippets: string[]): NativeBlogDraft {
  const title = detectFallbackTopicProfile(input, kbSnippets).title
  const contentMarkdown = buildFallbackMarkdown(input, kbSnippets)

  return {
    title,
    slug: slugifyDraftTitle(title),
    seoTitle: `${title} | Summa Social`,
    metaDescription: buildMetaDescriptionFromMarkdown(contentMarkdown),
    excerpt: buildExcerptFromMarkdown(contentMarkdown),
    contentMarkdown,
    contentHtml: renderEditorialMarkdownToHtml(contentMarkdown),
    tags: inferFallbackTags(input, kbSnippets),
    category: inferFallbackCategory(input),
    coverImageUrl: null,
    coverImageAlt: `Portada editorial per a: ${title}`,
    imagePrompt: `Editorial illustration, sober nonprofit operations scene, ${title}`,
    translations: null,
  }
}

function buildGenerationPrompt(input: NativeBlogGenerateInput, kbSnippets: string[]): string {
  const kbPrinciples = extractKbPrinciples(kbSnippets)
  const topicInstructions = buildTopicSpecificInstructions(input)
  const contextBlock =
    kbPrinciples.length > 0
      ? kbPrinciples.map((principle) => `- ${principle}`).join('\n')
      : '- No hi ha criteris sectorials rellevants recuperats de la KB.'

  return `Ets editor senior del blog de Summa Social.

Has d'escriure per a fundacions, associacions i ONG petites o mitjanes.

Normes editorials:
- to madur i concret
- res de llenguatge SaaS, "growth", "quick wins", "pipeline de vendes" o promeses màgiques
- parla de dolor operatiu real: remeses, justificació, tresoreria, model 182, model 347, subvencions, donacions, quotes
- no inventis dades, clients ni resultats
- no aboquis la KB en brut; usa-la només per orientar criteri i llenguatge
- el contingut ha d'estar en català
- retorna text en markdown senzill: headings #/##, paràgrafs i llistes amb "- "
${topicInstructions.length > 0 ? `- instruccions específiques del tema:\n${topicInstructions.map((instruction) => `  - ${instruction}`).join('\n')}` : ''}

Input editorial:
- prompt: ${input.prompt}
- audience: ${input.audience ?? 'entitats socials petites o mitjanes'}
- problem: ${input.problem ?? 'no especificat'}
- objective: ${input.objective ?? 'aportar criteri operatiu clar'}

Principis rellevants de la KB:
${contextBlock}

Retorna només JSON amb aquest format:
{
  "title": "títol del post",
  "seoTitle": "títol SEO",
  "metaDescription": "meta description breu",
  "excerpt": "resum curt del post",
  "slug": "slug-url-safe",
  "category": "criteri-operatiu | fiscal | operativa",
  "tags": ["tag1", "tag2"],
  "contentMarkdown": "# Títol\\n\\nParàgrafs...\\n\\n## Apartat\\n- punt",
  "imagePrompt": "prompt en català o anglès útil per una portada editorial sobria",
  "coverImageAlt": "alt text de la portada"
}`
}

function buildReviewPrompt(draft: NativeBlogDraft, kbSnippets: string[]): string {
  const kbPrinciples = extractKbPrinciples(kbSnippets)
  const contextBlock =
    kbPrinciples.length > 0 ? kbPrinciples.map((principle) => `- ${principle}`).join('\n') : '- Sense principis sectorials'
  const topicHint = `${draft.title ?? ''} ${draft.excerpt ?? ''}`.toLowerCase().includes('stripe')
    ? '- si la peça tracta Stripe, comprova que Stripe i la conciliació siguin la tesi principal i que la fiscalitat quedi com a context secundari'
    : '- comprova que la tesi principal no derivi cap a altres temes no demanats'

  return `Fes una QA editorial curta per a un post del blog de Summa Social.

Criteri:
- lector real d'entitat social petita o mitjana
- to no comercial i no SaaS
- dolor operatiu real
- no fer grans promeses
- el text ha de sonar específic del sector
${topicHint}

Principis de referència de KB:
${contextBlock}

Draft actual:
- title: ${draft.title ?? ''}
- excerpt: ${draft.excerpt ?? ''}
- category: ${draft.category ?? ''}
- tags: ${(draft.tags ?? []).join(', ')}
- contentMarkdown:
${draft.contentMarkdown ?? ''}

Retorna només JSON:
{
  "validationStatus": "OK | NEEDS_FIX | REJECT",
  "validationVerdict": "publishable | publishable_with_edits | not_publishable",
  "notes": ["nota curta 1", "nota curta 2"]
}`
}

function buildTranslationPrompt(draft: NativeBlogDraft): string {
  return `Tradueix aquest draft de blog del català al castellà mantenint to, estructura i significat.

Normes:
- text pla en markdown senzill
- sense afegir idees noves
- mantén Summa Social i noms propis

Draft:
- title: ${draft.title ?? ''}
- seoTitle: ${draft.seoTitle ?? ''}
- metaDescription: ${draft.metaDescription ?? ''}
- excerpt: ${draft.excerpt ?? ''}
- contentMarkdown:
${draft.contentMarkdown ?? ''}
- coverImageAlt: ${draft.coverImageAlt ?? ''}

Retorna només JSON:
{
  "title": "traducció",
  "seoTitle": "traducció",
  "metaDescription": "traducció",
  "excerpt": "traducció",
  "contentMarkdown": "# ...",
  "coverImageAlt": "traducció"
}`
}

function normalizeGeneratedDraft(parsed: GenerationPayload): NativeBlogDraft {
  const title = asNonEmptyString(parsed.title) ?? 'Nou article del blog'
  const contentMarkdown =
    asNonEmptyString(parsed.contentMarkdown) ??
    `# ${title}\n\nAquest tema necessita una redacció manual abans de publicar-lo.`

  return {
    title,
    slug: slugifyDraftTitle(asNonEmptyString(parsed.slug) ?? title),
    seoTitle: asNonEmptyString(parsed.seoTitle) ?? `${title} | Summa Social`,
    metaDescription: asNonEmptyString(parsed.metaDescription) ?? buildMetaDescriptionFromMarkdown(contentMarkdown),
    excerpt: asNonEmptyString(parsed.excerpt) ?? buildExcerptFromMarkdown(contentMarkdown),
    contentMarkdown,
    contentHtml: renderEditorialMarkdownToHtml(contentMarkdown),
    tags: parseTags(parsed.tags),
    category: asNonEmptyString(parsed.category) ?? 'criteri-operatiu',
    coverImageUrl: null,
    coverImageAlt: asNonEmptyString(parsed.coverImageAlt),
    imagePrompt: asNonEmptyString(parsed.imagePrompt),
    translations: null,
  }
}

function normalizeReview(parsed: ReviewPayload): {
  validationStatus: NativeBlogValidationStatus
  validationVerdict: NativeBlogValidationVerdict
  reviewNotes: string[]
} {
  const status = asNonEmptyString(parsed.validationStatus)
  const verdict = asNonEmptyString(parsed.validationVerdict)
  const rawNotes = Array.isArray(parsed.notes) ? parsed.notes : []

  return {
    validationStatus:
      status === 'OK' || status === 'NEEDS_FIX' || status === 'REJECT'
        ? status
        : 'NEEDS_FIX',
    validationVerdict:
      verdict === 'publishable' || verdict === 'publishable_with_edits' || verdict === 'not_publishable'
        ? verdict
        : 'publishable_with_edits',
    reviewNotes: rawNotes
      .filter((note): note is string => typeof note === 'string' && note.trim().length > 0)
      .slice(0, 4),
  }
}

function normalizeTranslation(parsed: Record<string, unknown>, fallback: NativeBlogDraft): NativeBlogDraftTranslation {
  const contentMarkdown = asNonEmptyString(parsed.contentMarkdown) ?? fallback.contentMarkdown ?? ''

  return {
    title: asNonEmptyString(parsed.title) ?? fallback.title ?? '',
    seoTitle: asNonEmptyString(parsed.seoTitle) ?? fallback.seoTitle ?? '',
    metaDescription:
      asNonEmptyString(parsed.metaDescription) ?? fallback.metaDescription ?? buildMetaDescriptionFromMarkdown(contentMarkdown),
    excerpt: asNonEmptyString(parsed.excerpt) ?? fallback.excerpt ?? buildExcerptFromMarkdown(contentMarkdown),
    contentMarkdown,
    contentHtml: renderEditorialMarkdownToHtml(contentMarkdown),
  }
}

export async function translateNativeBlogDraftToEs(
  draft: NativeBlogDraft
): Promise<NativeBlogDraftTranslation> {
  ensureAiReady()

  const result = await ai.generate({
    prompt: buildTranslationPrompt(draft),
    config: { temperature: 0.2 },
  })

  const parsed = JSON.parse(extractJsonObject(result.text)) as Record<string, unknown>
  return normalizeTranslation(parsed, draft)
}

export async function generateNativeBlogDraft(input: NativeBlogGenerateInput): Promise<{
  draft: NativeBlogDraft
  context: NativeBlogContext
}> {
  const kb = await resolveNativeBlogKbContext(
    [input.prompt, input.problem, input.objective, input.audience].filter(Boolean).join(' ')
  )

  try {
    ensureAiReady()

    const generation = await ai.generate({
      prompt: buildGenerationPrompt(input, kb.snippets),
      config: { temperature: 0.55 },
    })

    const parsedDraft = JSON.parse(extractJsonObject(generation.text)) as GenerationPayload
    const draft = normalizeGeneratedDraft(parsedDraft)

    const reviewResult = await ai.generate({
      prompt: buildReviewPrompt(draft, kb.snippets),
      config: { temperature: 0.2 },
    })
    const reviewParsed = JSON.parse(extractJsonObject(reviewResult.text)) as ReviewPayload
    const review = normalizeReview(reviewParsed)
    let translatedAt: string | null = null

    try {
      const translation = await translateNativeBlogDraftToEs(draft)
      draft.translations = { es: translation }
      translatedAt = new Date().toISOString()
    } catch {
      draft.translations = null
    }

    const reviewNotes = [...review.reviewNotes]
    if (!kb.available) {
      reviewNotes.unshift("La peça s'ha generat sense KB disponible; cal revisar el criteri sectorial abans d'aprovar-la.")
    }

    return {
      draft,
      context: {
        kbPath: kb.path,
        kbAvailable: kb.available,
        kbRefs: kb.refs,
        kbSnippets: kb.snippets,
        model: resolveGoogleGenAiModelLabel(),
        llmApplied: true,
        validationStatus: review.validationStatus,
        validationVerdict: review.validationVerdict,
        reviewNotes: reviewNotes.slice(0, 4),
        generatedAt: new Date().toISOString(),
        translatedAt,
      },
    }
  } catch (error: unknown) {
    const draft = buildFallbackDraft(input, kb.snippets)
    const reviewNotes = ["S'ha creat una base editable que convé revisar abans d'aprovar-la."]
    if (!kb.available) {
      reviewNotes.push("La base de coneixement no estava disponible en aquesta execució.")
    }

    return {
      draft,
      context: {
        kbPath: kb.path,
        kbAvailable: kb.available,
        kbRefs: kb.refs,
        kbSnippets: kb.snippets,
        model: null,
        llmApplied: false,
        validationStatus: 'NEEDS_FIX',
        validationVerdict: 'publishable_with_edits',
        reviewNotes,
        generatedAt: new Date().toISOString(),
        translatedAt: null,
      },
    }
  }
}
