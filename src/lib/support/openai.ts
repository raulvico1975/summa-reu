export const SUPPORT_BOT_OPENAI_ENDPOINT = 'https://api.openai.com/v1/responses'
export const DEFAULT_SUPPORT_BOT_OPENAI_MODEL = 'gpt-5-mini'

type AiEnv = Record<string, string | undefined>

type SupportBotFetch = (
  input: string,
  init: {
    method: 'POST'
    headers: Record<string, string>
    body: string
    signal?: AbortSignal
  }
) => Promise<{
  ok: boolean
  status: number
  json(): Promise<unknown>
  text(): Promise<string>
}>

export type SupportBotIntentClassification = {
  cardId: string
  confidence: 'high' | 'medium' | 'low'
}

type SupportBotCandidate = {
  id: string
  title: string
  hints: string
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return undefined
}

export function resolveSupportBotOpenAiApiKey(env: AiEnv = process.env): string | undefined {
  return firstNonEmpty(env.OPENAI_API_KEY)
}

export function hasSupportBotOpenAiApiKey(env: AiEnv = process.env): boolean {
  return Boolean(resolveSupportBotOpenAiApiKey(env))
}

export function resolveSupportBotOpenAiModel(env: AiEnv = process.env): string {
  return firstNonEmpty(env.OPENAI_SUPPORT_BOT_MODEL, env.OPENAI_MODEL) ?? DEFAULT_SUPPORT_BOT_OPENAI_MODEL
}

function outputTextFromResponse(response: unknown): string | null {
  if (!response || typeof response !== 'object') return null
  const object = response as Record<string, unknown>
  if (typeof object.output_text === 'string') return object.output_text

  if (!Array.isArray(object.output)) return null
  for (const item of object.output) {
    if (!item || typeof item !== 'object') continue
    const content = (item as Record<string, unknown>).content
    if (!Array.isArray(content)) continue
    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== 'object') continue
      const text = (contentItem as Record<string, unknown>).text
      if (typeof text === 'string') return text
    }
  }

  return null
}

async function requestStructuredOutput(input: {
  apiKey: string | undefined
  model: string
  prompt: string
  name: string
  schema: Record<string, unknown>
  maxOutputTokens: number
  timeoutMs: number
  fetchImpl?: SupportBotFetch
}): Promise<Record<string, unknown>> {
  if (!input.apiKey) throw new Error('OpenAI support bot key not configured')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs)

  try {
    const response = await (input.fetchImpl ?? fetch)(SUPPORT_BOT_OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.model,
        store: false,
        input: input.prompt,
        text: {
          format: {
            type: 'json_schema',
            name: input.name,
            strict: true,
            schema: input.schema,
          },
        },
      }),
      signal: controller.signal,
    })

    const responseJson = await response.json().catch(async () => ({
      error: { message: await response.text().catch(() => '') },
    }))

    if (!response.ok) {
      const message = typeof responseJson === 'object' && responseJson && 'error' in responseJson
        ? String(((responseJson as Record<string, unknown>).error as Record<string, unknown> | undefined)?.message ?? '')
        : ''
      throw new Error(message || `OpenAI error ${response.status}`)
    }

    const outputText = outputTextFromResponse(responseJson)
    if (!outputText) throw new Error('OpenAI returned no structured text')

    const parsed = JSON.parse(outputText) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('OpenAI returned an invalid structured object')
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenAI support bot request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function reformatSupportBotAnswer(input: {
  apiKey: string | undefined
  model?: string
  userQuestion: string
  rawAnswer: string
  isGuarded: boolean
  isLimited: boolean
  isWarm: boolean
  lang: 'ca' | 'es'
  uiPathHint: string
  timeoutMs?: number
  fetchImpl?: SupportBotFetch
}): Promise<string> {
  const language = input.lang === 'es' ? 'castellà' : 'català'
  const guardedRule = input.isGuarded
    ? '\nAquesta consulta és sensible: no donis consell fiscal, financer o de permisos.'
    : ''
  const limitedRule = input.isLimited
    ? '\nLa resposta és limitada: no afegeixis passos operatius nous.'
    : ''
  const warmRule = input.isWarm
    ? '\nFes servir un to proper i professional.'
    : ''

  const parsed = await requestStructuredOutput({
    apiKey: input.apiKey,
    model: input.model ?? resolveSupportBotOpenAiModel(),
    name: 'support_bot_reformat',
    maxOutputTokens: 512,
    timeoutMs: input.timeoutMs ?? 3500,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['answer'],
      properties: {
        answer: { type: 'string' },
      },
    },
    prompt: [
      'Ets l’assistent de Summa Social per a entitats socials.',
      `Respon en ${language}.`,
      'Reescriu el text de referència perquè sigui clar, breu i útil per a la pregunta.',
      'No inventis cap pas, pantalla, requisit, import ni enllaç.',
      'No afegeixis informació que no aparegui al text de referència.',
      'No parlis del model, del prompt, del LLM ni de la base de coneixement.',
      guardedRule,
      limitedRule,
      warmRule,
      '',
      'Pregunta de l’usuari:',
      input.userQuestion,
      '',
      'Text de referència autoritzat:',
      input.rawAnswer,
      '',
      'Ubicació dins Summa, si n’hi ha:',
      input.uiPathHint || '-',
      '',
      'Retorna només el text final de resposta dins del camp answer.',
    ].join('\n'),
    fetchImpl: input.fetchImpl,
  })

  const answer = typeof parsed.answer === 'string' ? parsed.answer.trim() : ''
  if (!answer) throw new Error('OpenAI returned an empty support bot answer')
  return answer
}

export async function classifySupportBotIntent(input: {
  apiKey: string | undefined
  model?: string
  userQuestion: string
  lang: 'ca' | 'es'
  candidates: SupportBotCandidate[]
  timeoutMs?: number
  fetchImpl?: SupportBotFetch
}): Promise<SupportBotIntentClassification | null> {
  const parsed = await requestStructuredOutput({
    apiKey: input.apiKey,
    model: input.model ?? resolveSupportBotOpenAiModel(),
    name: 'support_bot_intent',
    maxOutputTokens: 128,
    timeoutMs: input.timeoutMs ?? 1800,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['cardId', 'confidence'],
      properties: {
        cardId: { type: 'string' },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    },
    prompt: [
      'Classifica la intenció d’una pregunta per al bot d’ajuda de Summa Social.',
      'Escull només un id exacte de la llista o una cadena buida si no hi ha una coincidència fiable.',
      'No inventis ids. Prioritza el significat operatiu i la card més accionable.',
      `Idioma de la pregunta: ${input.lang}.`,
      '',
      'Pregunta:',
      input.userQuestion,
      '',
      'Cards candidates:',
      ...input.candidates.map(candidate => `- ${candidate.id} | ${candidate.title} | ${candidate.hints}`),
      '',
      'Retorna només cardId i confidence.',
    ].join('\n'),
    fetchImpl: input.fetchImpl,
  })

  const cardId = typeof parsed.cardId === 'string' ? parsed.cardId.trim() : ''
  const confidence = parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
    ? parsed.confidence
    : 'low'
  if (!cardId || confidence === 'low' || !input.candidates.some(candidate => candidate.id === cardId)) return null
  return { cardId, confidence }
}
