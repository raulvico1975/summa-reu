'use client';

import { Button } from '@/components/ui/button';
import {
  clearPublicAnalyticsConsent,
  isValidGaMeasurementId,
} from '@/lib/public-analytics';

interface PublicAnalyticsPreferencesButtonProps {
  label: string;
  measurementId?: string;
}

export function PublicAnalyticsPreferencesButton({
  label,
  measurementId = '',
}: PublicAnalyticsPreferencesButtonProps) {
  if (!isValidGaMeasurementId(measurementId)) return null;

  function reopenPreferences() {
    clearPublicAnalyticsConsent();
    window.location.reload();
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={reopenPreferences}>
      {label}
    </Button>
  );
}
