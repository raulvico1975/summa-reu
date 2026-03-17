'use client';

import { Badge } from '@/components/ui/badge';
import { CreditCard } from 'lucide-react';

interface ContactDonationsProps {
  source?: string | null;
}

export function ContactDonations({ source }: ContactDonationsProps) {
  if (source !== 'stripe') return null;

  return (
    <Badge variant="outline" className="ml-2 text-sky-700 border-sky-300">
      <CreditCard className="h-3 w-3 mr-1" />
      Stripe
    </Badge>
  );
}

