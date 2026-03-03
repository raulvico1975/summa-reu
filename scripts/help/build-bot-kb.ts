import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { firstSentence, loadTopicPairs, validateTopicPair, type ParsedTopic, type TopicArea, type RiskPolicy } from './topic-utils'

type BotDomain =
  | 'general'
  | 'config'
  | 'donors'
  | 'transactions'
  | 'remittances'
  | 'sepa'
  | 'fiscal'
  | 'documents'
  | 'projects'
  | 'superadmin'

type BotRisk = 'safe' | 'guarded'
type BotGuardrail = 'none' | 'b1_fiscal' | 'b1_sepa' | 'b1_remittances' | 'b1_danger'
type BotAnswerMode = 'full' | 'limited'

type GeneratedBotCard = {
  id: string
  title: { ca: string; es: string }
  domain: BotDomain
  risk: BotRisk
  guardrail: BotGuardrail
  answerMode: BotAnswerMode
  uiPaths: string[]
  keywords: string[]
  intents: { ca: string[]; es: string[] }
  answer: { ca: string; es: string }
}

const DOMAIN_BY_AREA: Record<TopicArea, BotDomain> = {
  moviments: 'transactions',
  remeses: 'remittances',
  devolucions: 'remittances',
  stripe: 'transactions',
  fiscal: 'fiscal',
  donants: 'donors',
  sepa: 'sepa',
  config: 'config',
  projectes: 'projects',
  documents: 'documents',
}

const POLICY_MAP: Record<RiskPolicy, { risk: BotRisk; guardrail: BotGuardrail; answerMode: BotAnswerMode }> = {
  safe: { risk: 'safe', guardrail: 'none', answerMode: 'full' },
  fiscal: { risk: 'guarded', guardrail: 'b1_fiscal', answerMode: 'full' },
  sepa: { risk: 'guarded', guardrail: 'b1_sepa', answerMode: 'full' },
  remittances: { risk: 'guarded', guardrail: 'b1_remittances', answerMode: 'full' },
  danger: { risk: 'guarded', guardrail: 'b1_danger', answerMode: 'limited' },
}

function unique(items: string[], max = 20): string[] {
  return Array.from(new Set(items.map(item => item.trim()).filter(Boolean))).slice(0, max)
}

function composeAnswer(topic: ParsedTopic, lang: 'ca' | 'es'): string {
  const routeLabel = lang === 'es' ? 'Ruta en Summa' : 'Ruta dins Summa'
  const stepsLabel = lang === 'es' ? 'Pasos exactos' : 'Passos exactes'
  const checkLabel = lang === 'es' ? 'Comprobacion final' : 'Comprovacio final'
  const errorLabel = lang === 'es' ? 'Error tipico' : 'Error tipic'

  const numberedSteps = topic.sections.steps.map((step, index) => `${index + 1}. ${step}`)

  return [
    `${routeLabel}: ${topic.frontmatter.route}`,
    '',
    `${stepsLabel}:`,
    ...numberedSteps,
    '',
    `${checkLabel}: ${firstSentence(topic.sections.check)}`,
    `${errorLabel}: ${firstSentence(topic.sections.error)}`,
  ].join('\n').trim()
}

function buildIntents(topic: ParsedTopic, lang: 'ca' | 'es'): string[] {
  const explicit = topic.frontmatter.intents ?? []
  const genericOpen = lang === 'es' ? `como ${topic.frontmatter.title.toLowerCase()}` : `com ${topic.frontmatter.title.toLowerCase()}`

  return unique([
    ...explicit,
    topic.frontmatter.title,
    topic.sections.problem,
    firstSentence(topic.sections.problem),
    genericOpen,
  ], 12)
}

function buildCard(ca: ParsedTopic, es: ParsedTopic): GeneratedBotCard {
  const domain = DOMAIN_BY_AREA[ca.frontmatter.area]
  const policy = POLICY_MAP[ca.frontmatter.riskPolicy]
  const keywords = unique([...ca.frontmatter.keywords, ...es.frontmatter.keywords], 24)
  const uiPaths = unique([ca.frontmatter.route, es.frontmatter.route], 4)

  return {
    id: ca.frontmatter.id,
    title: {
      ca: ca.frontmatter.title,
      es: es.frontmatter.title,
    },
    domain,
    risk: policy.risk,
    guardrail: policy.guardrail,
    answerMode: policy.answerMode,
    uiPaths,
    keywords,
    intents: {
      ca: buildIntents(ca, 'ca'),
      es: buildIntents(es, 'es'),
    },
    answer: {
      ca: composeAnswer(ca, 'ca'),
      es: composeAnswer(es, 'es'),
    },
  }
}

function main(): void {
  const pairs = loadTopicPairs('help/topics')
  const validationErrors: string[] = []

  for (const pair of pairs) {
    const result = validateTopicPair(pair)
    validationErrors.push(...result.errors)
  }

  if (validationErrors.length > 0) {
    console.error('[help:build-bot-kb] Validation failed before generation:')
    for (const error of validationErrors) {
      console.error(`  - ${error}`)
    }
    process.exit(1)
  }

  const cards = pairs
    .map(pair => buildCard(pair.ca, pair.es))
    .sort((a, b) => a.id.localeCompare(b.id))

  const outPath = resolve(process.cwd(), 'docs/generated/help-bot.json')
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, `${JSON.stringify(cards, null, 2)}\n`, 'utf8')

  console.log(`[help:build-bot-kb] Generated ${cards.length} cards -> ${outPath}`)
}

main()
