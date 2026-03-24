'use client';

import * as React from 'react';
import { Check, Heart, Search, UserPlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslations } from '@/i18n';
import type { Donor } from '@/lib/data';

interface DonorSearchCreateAction {
  key: string;
  label: string;
  onSelect: () => void;
}

interface DonorSearchComboboxProps {
  donors: Donor[];
  value: string | null;
  onSelect: (donorId: string | null) => void;
  placeholder?: string;
  className?: string;
  badgesByDonorId?: Record<string, string>;
  createActions?: DonorSearchCreateAction[];
  presentation?: 'dropdown' | 'dialog';
  dialogTitle?: string;
}

export function DonorSearchCombobox({
  donors,
  value,
  onSelect,
  placeholder,
  className,
  badgesByDonorId = {},
  createActions = [],
  presentation = 'dropdown',
  dialogTitle,
}: DonorSearchComboboxProps) {
  const { t } = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);

  const placeholderText = placeholder || t.movements.table.selectDonor;
  const selectedDonor = donors.find((donor) => donor.id === value);

  const normalizedSearch = search.toLowerCase().trim();

  // Filtra donants per nom, DNI o email
  const filteredDonors = React.useMemo(() => {
    if (!normalizedSearch) return donors;
    return donors.filter((donor) =>
      donor.name.toLowerCase().includes(normalizedSearch) ||
      (donor.taxId && donor.taxId.toLowerCase().includes(normalizedSearch)) ||
      (donor.email && donor.email.toLowerCase().includes(normalizedSearch))
    );
  }, [donors, normalizedSearch]);

  React.useEffect(() => {
    if (presentation !== 'dropdown') return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, presentation]);

  const handleSelect = (donorId: string) => {
    onSelect(donorId === value ? null : donorId);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
    setSearch('');
  };

  const handleCreateAction = (action: DonorSearchCreateAction) => {
    setOpen(false);
    setSearch('');
    action.onSelect();
  };

  const trigger = (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      onClick={() => setOpen((current) => !current)}
      className={cn('w-full min-w-0 justify-between overflow-hidden', className)}
    >
      {selectedDonor ? (
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Heart className="h-4 w-4 shrink-0 text-red-500" />
          <span className="truncate">{selectedDonor.name}</span>
          {badgesByDonorId[selectedDonor.id] && (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
              {badgesByDonorId[selectedDonor.id]}
            </span>
          )}
          {selectedDonor.taxId && (
            <span className="truncate text-xs text-muted-foreground">({selectedDonor.taxId})</span>
          )}
        </span>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2 text-muted-foreground">
          <Search className="h-4 w-4" />
          <span className="truncate">{placeholderText}</span>
        </span>
      )}
      {selectedDonor ? (
        <X
          className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
          onClick={handleClear}
        />
      ) : (
        <Search className="h-4 w-4 shrink-0 opacity-50" />
      )}
    </Button>
  );

  const donorList = (
    <>
      <div className="border-b p-2">
        <Input
          placeholder={t.donorSearchCombobox?.searchPlaceholder || 'Cerca per nom, DNI o email...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 min-w-0"
          autoFocus
        />
      </div>

      <ScrollArea className="max-h-[22rem]">
        <div className="p-1">
          {filteredDonors.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t.donorSearchCombobox?.noResults || 'Cap resultat'}
            </div>
          ) : (
            <>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {t.donorSearchCombobox?.donors || 'Donants'} ({filteredDonors.length})
              </div>
              {filteredDonors.map((donor) => (
                <button
                  key={donor.id}
                  type="button"
                  onClick={() => handleSelect(donor.id)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-sm px-2 py-2 text-sm',
                    'hover:bg-accent hover:text-accent-foreground',
                    'focus:bg-accent focus:text-accent-foreground focus:outline-none',
                    value === donor.id && 'bg-accent'
                  )}
                >
                  <Check
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      value === donor.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <Heart className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
                  <div className="min-w-0 flex-1 text-left">
                    <span className="flex items-center gap-2 truncate">
                      <span className="truncate">{donor.name}</span>
                      {badgesByDonorId[donor.id] && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
                          {badgesByDonorId[donor.id]}
                        </span>
                      )}
                    </span>
                    {(donor.taxId || donor.email) && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {[donor.taxId, donor.email].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}

          {createActions.length > 0 && (
            <div className="mt-2 border-t pt-2">
              {createActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => handleCreateAction(action)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm font-medium',
                    'text-emerald-700 hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none'
                  )}
                >
                  <UserPlus className="h-4 w-4 shrink-0" />
                  <span className="truncate">{action.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );

  if (presentation === 'dialog') {
    return (
      <>
        {trigger}
        <Dialog
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (!nextOpen) {
              setSearch('');
            }
          }}
        >
          <DialogContent className="max-h-[85vh] w-[min(92vw,40rem)] max-w-[40rem] overflow-hidden p-0">
            <DialogHeader className="border-b px-6 py-4 pr-12">
              <DialogTitle>{dialogTitle || 'Selecciona donant o soci'}</DialogTitle>
            </DialogHeader>
            {donorList}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full min-w-0">
      {trigger}

      {open && (
        <div className="absolute left-0 right-0 top-full z-[120] mt-1 min-w-0 rounded-md border bg-popover shadow-lg">
          {donorList}
        </div>
      )}
    </div>
  );
}
