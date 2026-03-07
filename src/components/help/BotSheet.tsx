'use client';

import * as React from 'react';
import { Send, Loader2, Bot, User, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslations } from '@/i18n';
import { useFirebase } from '@/firebase';
import { trackUX } from '@/lib/ux/trackUX';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface BotMessage {
  role: 'user' | 'bot';
  text: string;
  uiPaths?: string[];
  cardId?: string;
  mode?: 'card' | 'fallback';
  questionText?: string;
  clarifyOptions?: Array<{
    index: 1 | 2;
    cardId: string;
    label: string;
  }>;
}

interface BotSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function normalizePathText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getDashboardBasePath(pathname: string): string {
  const clean = (pathname ?? '').split('?')[0]?.split('#')[0] ?? ''
  const parts = clean.split('/').filter(Boolean)
  const dashboardIndex = parts.indexOf('dashboard')

  if (dashboardIndex >= 0) {
    return `/${parts.slice(0, dashboardIndex + 1).join('/')}`
  }

  return '/dashboard'
}

function resolveUiPathHref(rawPath: string, pathname: string): string | null {
  const path = normalizePathText(rawPath)
  const base = getDashboardBasePath(pathname)

  if (!path) return null
  if (path.includes('manual')) return `${base}/manual`
  if (path.includes('hub de guies') || path.includes('hub de guias') || path.includes('guies') || path.includes('guias') || path.includes('guides')) return `${base}/guides`
  if (path.includes('moviments') || path.includes('movimientos')) return `${base}/movimientos`
  if (path.includes('donants') || path.includes('donantes')) return `${base}/donants`
  if (path.includes('informes')) return `${base}/informes`
  if (path.includes('configuracio') || path.includes('configuracion')) return `${base}/configuracion`
  if (path.includes('project') || path.includes('projecte')) return `${base}/project-module`
  if (path.includes('proveidor') || path.includes('proveedor')) return `${base}/proveidors`
  if (path.includes('treballador') || path.includes('trabajador')) return `${base}/treballadors`
  if (path.includes('dashboard')) return base

  return null
}

function stripInlineUiPathFooter(text: string): string {
  const lines = (text ?? '').split('\n')
  const cleaned = lines.filter((line) => {
    const normalized = normalizePathText(line)
    return (
      !normalized.startsWith('on anar a summa:') &&
      !normalized.startsWith('donde ir en summa:') &&
      !normalized.startsWith('donde ir a summa:')
    )
  })

  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

export function BotSheet({ open, onOpenChange }: BotSheetProps) {
  const { language, tr } = useTranslations();
  const { user } = useFirebase();
  const pathname = usePathname();

  const [messages, setMessages] = React.useState<BotMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [pendingClarifyOptionIds, setPendingClarifyOptionIds] = React.useState<string[]>([]);
  const [feedbackByMessage, setFeedbackByMessage] = React.useState<Record<string, 'up' | 'down'>>({});

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // i18n strings
  const title = tr('bot.title', language === 'es' ? 'Asistente' : 'Assistent');
  const placeholder = tr('bot.placeholder', language === 'es' ? 'Escribe tu pregunta...' : 'Escriu la teva pregunta...');
  const thinking = tr('bot.thinking', language === 'es' ? 'Pensando...' : 'Pensant...');
  const errorGeneric = tr('bot.errorGeneric', language === 'es' ? 'No he podido procesar la pregunta. Vuelve a intentarlo.' : 'No he pogut processar la pregunta. Torna-ho a provar.');
  const helpfulQuestion = tr('bot.helpfulQuestion', language === 'es' ? '¿Te ha ayudado esta respuesta?' : 'T’ha ajudat aquesta resposta?');
  const helpfulYes = tr('bot.helpfulYes', language === 'es' ? 'Sí' : 'Sí');
  const helpfulNo = tr('bot.helpfulNo', language === 'es' ? 'No' : 'No');

  // Auto-scroll to bottom
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus input when sheet opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = React.useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text || loading || !user) return;

    const previousBotMessage = [...messages].reverse().find(
      (msg): msg is BotMessage => msg.role === 'bot'
    );

    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);

    const lang = language;

    trackUX('bot.send', { lang });

    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/support/bot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          message: text,
          lang,
          clarifyOptionIds: pendingClarifyOptionIds.length ? pendingClarifyOptionIds : undefined,
          previousQuestion: previousBotMessage?.questionText,
          previousCardId: previousBotMessage?.cardId,
          previousMode: previousBotMessage?.mode,
          previousClarifyOptionIds: previousBotMessage?.clarifyOptions?.map(option => option.cardId),
          previousWasClarify: previousBotMessage?.cardId === 'clarify-disambiguation',
        }),
      });

      const data = await res.json();

      if (data.ok) {
        const clarifyOptions = Array.isArray(data.clarifyOptions) ? data.clarifyOptions : undefined;

        setMessages(prev => [...prev, {
          role: 'bot',
          text: data.answer,
          uiPaths: data.uiPaths,
          cardId: data.cardId,
          mode: data.mode,
          questionText: text,
          clarifyOptions,
        }]);

        if (data.cardId === 'clarify-disambiguation' && clarifyOptions?.length) {
          setPendingClarifyOptionIds(
            clarifyOptions
              .map((option: { cardId?: string }) => option.cardId)
              .filter((id: unknown): id is string => typeof id === 'string')
              .slice(0, 2)
          );
        } else {
          setPendingClarifyOptionIds([]);
        }

        if (data.mode === 'fallback') {
          trackUX('bot.fallback', { cardId: data.cardId, lang });
        }
      } else {
        setPendingClarifyOptionIds([]);
        setMessages(prev => [...prev, { role: 'bot', text: errorGeneric, questionText: text }]);
      }
    } catch {
      setPendingClarifyOptionIds([]);
      setMessages(prev => [...prev, { role: 'bot', text: errorGeneric, questionText: text }]);
    } finally {
      setLoading(false);
    }
  }, [loading, user, language, errorGeneric, messages, pendingClarifyOptionIds]);

  const handleSend = React.useCallback(() => {
    void sendMessage(input);
  }, [input, sendMessage]);

  const handleClarifyClick = React.useCallback((index: 1 | 2) => {
    trackUX('bot.clarify.select', { option: index, lang: language });
    void sendMessage(String(index));
  }, [sendMessage, language]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleUiPathClick = React.useCallback((path: string, href: string) => {
    trackUX('bot.ui_path_click', { path, href, lang: language })
    onOpenChange(false)
  }, [language, onOpenChange])

  const handleFeedback = React.useCallback(async (messageKey: string, msg: BotMessage, helpful: boolean) => {
    if (!user || !msg.questionText || !msg.cardId) return
    const vote = helpful ? 'up' : 'down'
    setFeedbackByMessage(prev => ({ ...prev, [messageKey]: vote }))
    trackUX('bot.feedback', { helpful, cardId: msg.cardId, lang: language })

    try {
      const idToken = await user.getIdToken()
      await fetch('/api/support/bot-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          question: msg.questionText,
          lang: language,
          helpful,
          cardId: msg.cardId,
          mode: msg.mode ?? 'fallback',
        }),
      })
    } catch {
      // Ignore network failures: UX must stay smooth.
    }
  }, [language, user])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-[100dvh] flex-col w-[400px] sm:w-[480px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-[#0da2e7]" />
            {title}
          </SheetTitle>
        </SheetHeader>

        {/* Messages area */}
        <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
          <div className="space-y-4 pr-2 pb-4">
            {messages.map((msg, i) => {
              const messageKey = String(i)
              const vote = feedbackByMessage[messageKey]
              const canVote = msg.role === 'bot' && !!msg.questionText && !!msg.cardId && msg.cardId !== 'clarify-disambiguation'
              const visibleText = msg.role === 'bot' ? stripInlineUiPathFooter(msg.text) : msg.text
              return (
              <div
                key={messageKey}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'bot' && (
                  <div className="h-7 w-7 rounded-full bg-[#0da2e7]/10 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="h-4 w-4 text-[#0da2e7]" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {visibleText}
                  {msg.uiPaths && msg.uiPaths.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {msg.uiPaths.map((path, j) => {
                        const href = resolveUiPathHref(path, pathname)
                        if (!href) {
                          return (
                            <Badge key={j} variant="secondary" className="text-xs">
                              {path}
                            </Badge>
                          )
                        }

                        return (
                          <Link
                            key={j}
                            href={href}
                            onClick={() => handleUiPathClick(path, href)}
                            className="inline-flex"
                          >
                            <Badge variant="secondary" className="text-xs hover:bg-secondary/80 cursor-pointer">
                              {path}
                            </Badge>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                  {msg.role === 'bot' && msg.cardId === 'clarify-disambiguation' && msg.clarifyOptions?.length ? (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {msg.clarifyOptions.map((option) => (
                        <Button
                          key={`${option.cardId}-${option.index}`}
                          variant="outline"
                          size="sm"
                          className="justify-start h-auto py-1.5 px-2 text-left whitespace-normal"
                          onClick={() => handleClarifyClick(option.index)}
                          disabled={loading}
                        >
                          {option.index}. {option.label}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                  {canVote ? (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">{helpfulQuestion}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant={vote === 'up' ? 'secondary' : 'ghost'}
                        className="h-6 px-2 text-[11px]"
                        onClick={() => void handleFeedback(messageKey, msg, true)}
                        disabled={!!vote}
                      >
                        <ThumbsUp className="h-3 w-3 mr-1" />
                        {helpfulYes}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={vote === 'down' ? 'secondary' : 'ghost'}
                        className="h-6 px-2 text-[11px]"
                        onClick={() => void handleFeedback(messageKey, msg, false)}
                        disabled={!!vote}
                      >
                        <ThumbsDown className="h-3 w-3 mr-1" />
                        {helpfulNo}
                      </Button>
                    </div>
                  ) : null}
                </div>
                {msg.role === 'user' && (
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                )}
              </div>
              )
            })}

            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="h-7 w-7 rounded-full bg-[#0da2e7]/10 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="h-4 w-4 text-[#0da2e7]" />
                </div>
                <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {thinking}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="pt-3 border-t shrink-0">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="bg-[#0da2e7] hover:bg-[#0b8dcc] text-white shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
