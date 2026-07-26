'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { trackPublicAnalyticsEvent } from '@/lib/public-analytics';

const NAME_MIN_LENGTH = 2;
const MESSAGE_MIN_LENGTH = 10;
const ORGANIZATION_MAX_LENGTH = 160;
const MESSAGE_MAX_LENGTH = 5000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PublicContactFormProps {
  locale: 'ca' | 'es' | 'fr' | 'pt';
  labels: {
    nameLabel: string;
    emailLabel: string;
    organizationLabel: string;
    messageLabel: string;
    submit: string;
    sending: string;
    success: string;
    error: string;
    invalidName: string;
    invalidEmail: string;
    invalidMessage: string;
    helper: string;
    messagePlaceholder: string;
  };
  initialMessage?: string;
}

type SubmitStatus = 'idle' | 'sending' | 'success' | 'error';

export function PublicContactForm({ locale, labels, initialMessage = '' }: PublicContactFormProps) {
  const [name, setName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [message, setMessage] = useState(initialMessage);
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [feedback, setFeedback] = useState('');
  const websiteLabel =
    locale === 'es' ? 'Página web' :
    locale === 'fr' ? 'Site web' :
    locale === 'pt' ? 'Website' :
    'Pàgina web';

  function resetFeedback() {
    if (status !== 'idle') {
      setStatus('idle');
      setFeedback('');
    }
  }

  function validateForm() {
    if (name.trim().length < NAME_MIN_LENGTH) {
      return labels.invalidName;
    }

    if (!EMAIL_REGEX.test(senderEmail.trim())) {
      return labels.invalidEmail;
    }

    if (message.trim().length < MESSAGE_MIN_LENGTH) {
      return labels.invalidMessage;
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setStatus('error');
      setFeedback(validationError);
      return;
    }

    setStatus('sending');
    setFeedback(labels.sending);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: senderEmail.trim(),
          organization: organization.trim(),
          message: message.trim(),
          website,
          language: locale,
        }),
      });

      if (!response.ok) {
        throw new Error(`CONTACT_FORM_FAILED_${response.status}`);
      }

      trackPublicAnalyticsEvent('generate_lead', {
        form_id: 'public_contact',
        locale,
      });
      setStatus('success');
      setFeedback(labels.success);
      setName('');
      setSenderEmail('');
      setOrganization('');
      setMessage('');
      setWebsite('');
    } catch (error) {
      console.error('[PublicContactForm] submit failed', error);
      setStatus('error');
      setFeedback(labels.error);
    }
  }

  return (
    <form className="space-y-4 text-left" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="contact-name">{labels.nameLabel}</Label>
        <Input
          id="contact-name"
          value={name}
          onChange={(event) => {
            resetFeedback();
            setName(event.target.value);
          }}
          minLength={NAME_MIN_LENGTH}
          maxLength={120}
          disabled={status === 'sending'}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-email">{labels.emailLabel}</Label>
        <Input
          id="contact-email"
          type="email"
          value={senderEmail}
          onChange={(event) => {
            resetFeedback();
            setSenderEmail(event.target.value);
          }}
          maxLength={320}
          disabled={status === 'sending'}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-organization">{labels.organizationLabel}</Label>
        <Input
          id="contact-organization"
          value={organization}
          onChange={(event) => {
            resetFeedback();
            setOrganization(event.target.value);
          }}
          maxLength={ORGANIZATION_MAX_LENGTH}
          disabled={status === 'sending'}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-message">{labels.messageLabel}</Label>
        <Textarea
          id="contact-message"
          value={message}
          placeholder={labels.messagePlaceholder}
          onChange={(event) => {
            resetFeedback();
            setMessage(event.target.value);
          }}
          rows={6}
          minLength={MESSAGE_MIN_LENGTH}
          maxLength={MESSAGE_MAX_LENGTH}
          disabled={status === 'sending'}
          required
        />
      </div>

      <div className="sr-only" aria-hidden="true">
        <Label htmlFor="contact-website">{websiteLabel}</Label>
        <Input
          id="contact-website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          disabled={status === 'sending'}
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={status === 'sending'}>
        {status === 'sending' ? labels.sending : labels.submit}
      </Button>

      <p
        className={
          status === 'success'
            ? 'text-sm text-green-700'
            : status === 'error'
              ? 'text-sm text-red-600'
              : 'text-sm text-muted-foreground'
        }
        aria-live="polite"
      >
        {feedback || labels.helper}
      </p>
    </form>
  );
}
