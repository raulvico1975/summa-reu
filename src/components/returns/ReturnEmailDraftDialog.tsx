'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/i18n';

interface ReturnEmailDraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialBody: string;
}

export function ReturnEmailDraftDialog({ open, onOpenChange, initialBody }: ReturnEmailDraftDialogProps) {
  const { tr } = useTranslations();
  const { toast } = useToast();
  const [body, setBody] = React.useState(initialBody);

  React.useEffect(() => {
    if (open) {
      setBody(initialBody);
    }
  }, [initialBody, open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      toast({
        title: tr('returns.emailDraft.copied'),
      });
    } catch {
      toast({
        variant: 'destructive',
        title: tr('returns.emailDraft.copyError'),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[min(96vw,60rem)] overflow-y-auto sm:w-[min(calc(100vw-3rem),60rem)]">
        <DialogHeader>
          <DialogTitle>{tr('returns.emailDraft.title')}</DialogTitle>
          <DialogDescription>{tr('returns.emailDraft.description')}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="min-h-64"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tr('returns.emailDraft.close')}
          </Button>
          <Button onClick={handleCopy}>
            {tr('returns.emailDraft.copy')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
