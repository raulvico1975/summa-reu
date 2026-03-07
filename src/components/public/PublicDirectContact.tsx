import Link from 'next/link';
import { MessageCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PublicLocale } from '@/lib/public-locale';

const CONTACT_PHONE = '684 765 359';
const CONTACT_PHONE_HREF = 'tel:+34684765359';
const CONTACT_WHATSAPP_HREF = 'https://wa.me/34684765359';

const CONTACT_COPY: Record<
  PublicLocale,
  {
    title: string;
    callLabel: string;
    whatsappLabel: string;
  }
> = {
  ca: {
    title: 'Telèfon o WhatsApp: 684 765 359',
    callLabel: 'Truca',
    whatsappLabel: 'WhatsApp',
  },
  es: {
    title: 'Telefono o WhatsApp: 684 765 359',
    callLabel: 'Llamar',
    whatsappLabel: 'WhatsApp',
  },
  fr: {
    title: 'Telephone ou WhatsApp : 684 765 359',
    callLabel: 'Appeler',
    whatsappLabel: 'WhatsApp',
  },
  pt: {
    title: 'Telefone ou WhatsApp: 684 765 359',
    callLabel: 'Ligar',
    whatsappLabel: 'WhatsApp',
  },
};

interface PublicDirectContactProps {
  locale: PublicLocale;
  className?: string;
}

export function PublicDirectContact({ locale, className }: PublicDirectContactProps) {
  const copy = CONTACT_COPY[locale];

  return (
    <div className={className}>
      <p className="text-sm font-medium text-foreground">{copy.title}</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="outline">
          <Link href={CONTACT_PHONE_HREF}>
            <Phone className="mr-2 h-4 w-4" />
            {copy.callLabel}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={CONTACT_WHATSAPP_HREF} target="_blank" rel="noreferrer">
            <MessageCircle className="mr-2 h-4 w-4" />
            {copy.whatsappLabel}
          </Link>
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{CONTACT_PHONE}</p>
    </div>
  );
}
