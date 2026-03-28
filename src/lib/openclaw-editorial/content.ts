import type {
  BlogDraftArtifact,
  EditorialCalendarPost,
  EditorialCriteriaContext,
  LinkedInArtifact,
  LinkedInVariant,
} from './types'

const BANNED_TONE_TERMS = [
  'saas',
  'scale',
  'growth',
  'pipeline de vendes',
  'lead magnet',
  'quick win',
  'roi',
  'disrupció',
  'frictionless',
]

type SectorProfile = {
  requiredTerms: string[]
  intro: string
  reviewPoints: string[]
  closing: string
}

type BlogSection = {
  heading: string
  paragraphs?: string[]
  bullets?: string[]
}

function stripHtml(text: string) {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function sentenceCase(value: string) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function trimTerminalPunctuation(value: string) {
  return value.trim().replace(/[.!?]+$/, '')
}

function ensureSentence(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

function compactParagraphs(paragraphs: string[]) {
  return paragraphs.map((paragraph) => paragraph.trim()).filter(Boolean)
}

function buildSectorProfile(post: EditorialCalendarPost): SectorProfile {
  const primary = post.sectorPrimary.toLowerCase()

  if (primary.includes('fiscal')) {
    return {
      requiredTerms: ['obligació fiscal', 'traçabilitat', 'tercers', 'donants'],
      intro:
        'Quan una entitat arriba a la fase d\'exportació fiscal, gairebé sempre és massa tard per detectar un criteri mal resolt.',
      reviewPoints: [
        'revisar si la base de tercers i donants està completa abans de generar l\'exportació',
        'validar que devolucions, regularitzacions i moviments excepcionals no distorsionen el resultat final',
        'documentar el criteri aplicat perquè administració, tresoreria i gestoria treballin sobre la mateixa lectura',
      ],
      closing:
        'La feina útil no és només exportar; és poder explicar per què l\'exportació reflecteix la realitat econòmica de l\'entitat.',
    }
  }

  if (primary.includes('remes')) {
    return {
      requiredTerms: ['remeses', 'IBAN', 'devolucions', 'donants'],
      intro:
        'En una remesa, l\'error rarament és al fitxer final: normalment comença dies abans, quan les dades de base encara arrosseguen incoherències.',
      reviewPoints: [
        'verificar IBAN, mandat i estat real de la persona donant abans del tancament de la remesa',
        'distingir clarament cobraments, devolucions i reprocessats per no contaminar el recompte',
        'guardar traçabilitat de la decisió operativa quan hi ha excepcions o tractament manual',
      ],
      closing:
        'Una remesa sòlida és la que es pot defensar després, tant davant del banc com davant de l\'equip intern.',
    }
  }

  if (primary.includes('subvenc') || primary.includes('project')) {
    return {
      requiredTerms: ['subvencions', 'projectes', 'justificació', 'traçabilitat'],
      intro:
        'La justificació no es construeix al final del projecte. Es construeix cada vegada que un moviment queda ben classificat i ben documentat.',
      reviewPoints: [
        'ordenar factures, comprovants i imputacions amb criteri consistent',
        'separar despesa operativa interna de despesa vinculada a projecte o finançador',
        'tenir una lectura entenedora per a qui revisa, no només per a qui va entrar el moviment',
      ],
      closing:
        'Quan la traçabilitat és clara, la justificació deixa de ser una carrera d\'última hora.',
    }
  }

  return {
    requiredTerms: ['entitats', 'criteri operatiu', 'traçabilitat', 'tresoreria'],
    intro:
      'En la gestió econòmica d\'entitats, els problemes persistents gairebé mai són espectaculars: són petits desajustos que s\'acumulen.',
    reviewPoints: [
      'acordar un criteri comú abans que cada persona treballi amb excepcions pròpies',
      'mantenir la traçabilitat documental perquè qualsevol revisió posterior tingui context',
      'pensar el procés des de la tresoreria, la fiscalitat i el seguiment quotidià alhora',
    ],
    closing:
      'El valor d\'un procés ordenat és que redueix dubtes interns i evita correccions innecessàries al final.',
  }
}

export function validateEditorialLanguage(text: string, requiredTerms: string[]) {
  const normalized = text.toLowerCase()
  const issues: string[] = []

  for (const bannedTerm of BANNED_TONE_TERMS) {
    if (normalized.includes(bannedTerm)) {
      issues.push(`Text contains banned tone term: ${bannedTerm}`)
    }
  }

  for (const term of requiredTerms) {
    if (!normalized.includes(term.toLowerCase())) {
      issues.push(`Text should mention required sector term: ${term}`)
    }
  }

  return issues
}

function buildHtmlParagraphs(paragraphs: string[]) {
  return compactParagraphs(paragraphs)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join('\n')
}

function buildHtmlList(items: string[]) {
  return `<ul>\n${items.map((item) => `  <li>${item}</li>`).join('\n')}\n</ul>`
}

function buildMarkdownList(items: string[]) {
  return items.map((item) => `- ${item}`).join('\n')
}

function buildMarkdownSection(section: BlogSection) {
  const blocks: string[] = [`## ${section.heading}`]
  const paragraphs = compactParagraphs(section.paragraphs ?? [])

  if (paragraphs.length > 0) {
    blocks.push('', paragraphs.join('\n\n'))
  }

  if (section.bullets?.length) {
    blocks.push('', buildMarkdownList(section.bullets))
  }

  return blocks.join('\n')
}

function buildHtmlSection(section: BlogSection) {
  const blocks = [`<h2>${section.heading}</h2>`]
  const paragraphs = compactParagraphs(section.paragraphs ?? [])

  if (paragraphs.length > 0) {
    blocks.push(buildHtmlParagraphs(paragraphs))
  }

  if (section.bullets?.length) {
    blocks.push(buildHtmlList(section.bullets))
  }

  return blocks.join('\n')
}

export function buildBlogDraft(
  post: EditorialCalendarPost,
  criteriaContext: EditorialCriteriaContext,
  _derivativesPerPost: number,
  language: string
): BlogDraftArtifact {
  const profile = buildSectorProfile(post)
  const criteriaWarnings = [...criteriaContext.warnings]

  const intro = `${profile.intro} ${ensureSentence(post.brief)}`
  const contextParagraph =
    "En aquest tema, el valor no és repetir un procés estàndard, sinó deixar clar quin criteri convé compartir abans que arribi l'urgència."
  const objectiveParagraph = `L'objectiu és ${trimTerminalPunctuation(post.objective)}. Sense promeses comercials ni receptes genèriques.`
  const sectorTermsParagraph = `Convé parlar amb naturalitat de ${profile.requiredTerms.join(', ')}, i explicar-los sense donar-los per sabuts.`
  const alignmentParagraph =
    "Si això queda clar, el text ajuda a coordinar qui revisa, qui executa i qui haurà d'entendre el cas després."
  const reviewLead =
    'Abans de donar el tema per ben tancat, val la pena revisar com a mínim aquests punts:'
  const riskParagraph =
    "El risc més habitual és deixar una peça correcta en forma però massa genèrica en criteri. En entitats, això passa quan es parla de processos sense concretar què s'ha de comprovar de debò."
  const nextStepParagraph = `Un bon punt de partida acostuma a ser ${trimTerminalPunctuation(profile.reviewPoints[0] ?? 'acordar un criteri compartit')}.`

  const sections: BlogSection[] = [
    {
      heading: 'Què cal entendre abans d’actuar',
      paragraphs: [contextParagraph, objectiveParagraph, sectorTermsParagraph, alignmentParagraph],
    },
    {
      heading: 'Què revisar abans de donar-ho per bo',
      paragraphs: [reviewLead],
      bullets: profile.reviewPoints,
    },
    {
      heading: 'Per on començar sense perdre context',
      paragraphs: [riskParagraph, profile.closing, nextStepParagraph],
    },
  ]

  const markdown = [
    `# ${post.title}`,
    '',
    intro,
    '',
    ...sections.flatMap((section, index) =>
      index === sections.length - 1
        ? [buildMarkdownSection(section)]
        : [buildMarkdownSection(section), '']
    ),
  ].join('\n')

  const html = [
    `<h1>${post.title}</h1>`,
    buildHtmlParagraphs([intro]),
    ...sections.map((section) => buildHtmlSection(section)),
  ].join('\n')

  const plainText = stripHtml(html)
  const issues = validateEditorialLanguage(plainText, profile.requiredTerms)
  if (issues.length > 0) {
    criteriaWarnings.push(...issues)
  }

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    seoTitle: `${post.title} | Summa Social`,
    metaDescription: sentenceCase(post.brief).slice(0, 160),
    excerpt: sentenceCase(post.brief),
    category: post.category,
    tags: post.tags,
    publishedAt: post.publishedAt,
    language,
    sectorPrimary: post.sectorPrimary,
    sectorSecondary: post.sectorSecondary,
    objective: post.objective,
    brief: post.brief,
    criteriaWarnings,
    contentMarkdown: markdown,
    contentHtml: html,
  }
}

function shortenBody(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}…`
}

export function buildLinkedInArtifact(
  draft: BlogDraftArtifact,
  mode: 'live' | 'mock',
  derivativesPerPost: number
): LinkedInArtifact {
  const baseLead = `En entitats, ${draft.brief.toLowerCase()}`

  const variants: LinkedInVariant[] = [
    {
      id: `${draft.id}-li-1`,
      angle: 'observació operativa',
      body: shortenBody(
        `${baseLead}. El criteri útil no és "publicar més", sinó saber què s'ha de revisar perquè la traçabilitat aguanti quan arribi fiscalitat, tresoreria o justificació. Si el procés no es pot explicar amb claredat, encara no està prou resolt.`,
        620
      ),
    },
    {
      id: `${draft.id}-li-2`,
      angle: 'checklist curt',
      body: shortenBody(
        `En entitats, tres comprovacions prèvies per a aquest tema:\n1. dades de base completes\n2. criteri documental compartit\n3. excepcions registrades\n\nSense això, la incidència acostuma a aparèixer més tard, quan el marge per corregir-la és pitjor.`,
        620
      ),
    },
    {
      id: `${draft.id}-li-3`,
      angle: 'criteri de govern',
      body: shortenBody(
        `En entitats, una bona peça editorial per a Summa no ha de sonar a promesa tecnològica buida. Ha de sonar a criteri de gestió: menys promesa, més context operatiu, més precisió sobre què revisar ara i qui ha de poder entendre el cas després.`,
        620
      ),
    },
  ].slice(0, derivativesPerPost)

  const issues = variants.flatMap((variant) =>
    validateEditorialLanguage(
      variant.body,
      ['entitats', draft.sectorPrimary.toLowerCase().includes('fiscal') ? 'criteri' : 'traçabilitat']
    )
  )

  return {
    id: `${draft.id}-linkedin`,
    postId: draft.id,
    sourceTitle: draft.title,
    mode,
    variants,
    criteriaWarnings: [...draft.criteriaWarnings, ...issues],
  }
}
