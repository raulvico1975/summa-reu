'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface PublicContactFormProps {
  email: string;
  labels: {
    nameLabel: string;
    emailLabel: string;
    organizationLabel: string;
    messageLabel: string;
    submit: string;
    helper: string;
  };
}

export function PublicContactForm({ email, labels }: PublicContactFormProps) {
  const [name, setName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [message, setMessage] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const subject = organization
      ? `Contacte web - ${organization}`
      : 'Contacte web - Summa Social';
    const body = [
      `${labels.nameLabel}: ${name}`,
      `${labels.emailLabel}: ${senderEmail}`,
      `${labels.organizationLabel}: ${organization || '-'}`,
      '',
      `${labels.messageLabel}:`,
      message,
    ].join('\n');

    window.location.href =
      `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <form className="space-y-4 text-left" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="contact-name">{labels.nameLabel}</Label>
        <Input
          id="contact-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-email">{labels.emailLabel}</Label>
        <Input
          id="contact-email"
          type="email"
          value={senderEmail}
          onChange={(event) => setSenderEmail(event.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-organization">{labels.organizationLabel}</Label>
        <Input
          id="contact-organization"
          value={organization}
          onChange={(event) => setOrganization(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-message">{labels.messageLabel}</Label>
        <Textarea
          id="contact-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={6}
          required
        />
      </div>

      <Button type="submit" size="lg" className="w-full">
        {labels.submit}
      </Button>
      <p className="text-sm text-muted-foreground">{labels.helper}</p>
    </form>
  );
}
