'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Heart, Building2, UserPlus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SummaTooltip } from '@/components/ui/summa-tooltip';
import { useTranslations } from '@/i18n';
import type { ContactRoles, ContactType } from '@/lib/data';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  buildContactRoleOptions,
  resolveContactRoleOption,
  type ContactRoleOption,
} from '@/lib/contacts/contact-role-options';
import { getContactTypeLabel } from '@/lib/ui/display-labels';

/**
 * Helper: middle ellipsis per a noms llargs
 * Mostra primers 18 caràcters + … + últims 10
 */
function middleEllipsis(s: string, head = 18, tail = 10): string {
  if (!s) return s;
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export interface Contact {
  id: string;
  name: string;
  type: ContactType;
  roles?: ContactRoles;
}

interface ContactComboboxProps {
  contacts: Contact[];
  value: string | null;
  valueContactType?: ContactType | null;
  onSelect: (contactId: string | null, contactType: ContactType | null) => void;
  onCreateNew: (type: 'donor' | 'supplier') => void;
  disabled?: boolean;
  placeholder?: string;
  emptyText?: string;
  createDonorText?: string;
  createSupplierText?: string;
  unlinkText?: string;
  searchPlaceholder?: string;
}

export const ContactCombobox = React.memo(function ContactCombobox({
  contacts,
  value,
  valueContactType = null,
  onSelect,
  onCreateNew,
  disabled = false,
  placeholder,
  emptyText,
  createDonorText,
  createSupplierText,
  unlinkText,
  searchPlaceholder,
}: ContactComboboxProps) {
  const { t } = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  // Use translations with fallback to prop values
  const placeholderText = placeholder || t.movements.table.assign;
  const emptyTextValue = emptyText || t.contactCombobox.emptyText;
  const createDonorTextValue = createDonorText || t.contactCombobox.newDonor;
  const createSupplierTextValue = createSupplierText || t.contactCombobox.newSupplier;
  const unlinkTextValue = unlinkText || t.contactCombobox.unlink;
  const searchPlaceholderValue = searchPlaceholder || t.contactCombobox.searchPlaceholder;

  const roleOptions = React.useMemo(() => buildContactRoleOptions(contacts), [contacts]);

  const selectedOption = React.useMemo(
    () => resolveContactRoleOption(contacts, value, valueContactType),
    [contacts, value, valueContactType]
  );

  const getOptionLabel = React.useCallback((option: ContactRoleOption) => {
    const roleLabel = getContactTypeLabel(option.contactType, t.common ?? {});
    return option.isMultiRole ? `${option.contactName} · ${roleLabel}` : option.contactName;
  }, [t.common]);

  const filteredDonors = roleOptions.filter((option) =>
    option.contactType === 'donor' &&
    getOptionLabel(option).toLowerCase().includes(search.toLowerCase())
  );
  const filteredSuppliers = roleOptions.filter((option) =>
    option.contactType === 'supplier' &&
    getOptionLabel(option).toLowerCase().includes(search.toLowerCase())
  );
  const filteredWorkers = roleOptions.filter((option) =>
    option.contactType === 'employee' &&
    getOptionLabel(option).toLowerCase().includes(search.toLowerCase())
  );

  const hasResults = filteredDonors.length > 0 || filteredSuppliers.length > 0 || filteredWorkers.length > 0;

  const handleSelect = (option: ContactRoleOption) => {
    if (disabled) return;
    const shouldClear = option.contactId === value && option.contactType === valueContactType;
    onSelect(shouldClear ? null : option.contactId, shouldClear ? null : option.contactType);
    setOpen(false);
    setSearch('');
  };

  const handleUnlink = () => {
    if (disabled) return;
    onSelect(null, null);
    setOpen(false);
    setSearch('');
  };

  const handleCreateNew = (type: 'donor' | 'supplier') => {
    setOpen(false);
    setSearch('');
    onCreateNew(type);
  };

  const renderRoleIcon = React.useCallback((contactType: ContactType, className?: string) => {
    if (contactType === 'donor') {
      return <Heart className={cn('text-red-500', className)} />;
    }

    if (contactType === 'employee') {
      return <Users className={cn('text-green-600', className)} />;
    }

    return <Building2 className={cn('text-blue-500', className)} />;
  }, []);

  return (
    <Popover open={open} onOpenChange={(nextOpen) => {
      if (disabled && nextOpen) return;
      setOpen(nextOpen);
    }}>
      <PopoverTrigger asChild>
        {selectedOption ? (
          <Button
            variant="ghost"
            className="flex h-auto w-full min-w-0 items-center gap-1 overflow-hidden p-0 text-left font-normal"
            disabled={disabled}
          >
            {renderRoleIcon(selectedOption.contactType, 'h-3 w-3 shrink-0')}
            <SummaTooltip content={getOptionLabel(selectedOption)}>
              <span className="min-w-0 flex-1 truncate text-[13px]">
                {middleEllipsis(getOptionLabel(selectedOption))}
              </span>
            </SummaTooltip>
            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 text-muted-foreground" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="flex w-full min-w-0 items-center justify-start overflow-hidden px-0 text-[13px] text-muted-foreground"
            disabled={disabled}
          >
            <UserPlus className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{placeholderText}</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholderValue}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{emptyTextValue}</CommandEmpty>

            {/* Donors */}
            {filteredDonors.length > 0 && (
              <CommandGroup heading={t.contactCombobox.donors}>
                {filteredDonors.map((donor) => (
                  <CommandItem
                    key={donor.key}
                    value={donor.key}
                    onSelect={() => handleSelect(donor)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === donor.contactId && valueContactType === donor.contactType ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <Heart className="mr-2 h-3 w-3 text-red-500" />
                    {getOptionLabel(donor)}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Suppliers */}
            {filteredSuppliers.length > 0 && (
              <>
                {filteredDonors.length > 0 && <CommandSeparator />}
                <CommandGroup heading={t.contactCombobox.suppliers}>
                {filteredSuppliers.map((supplier) => (
                  <CommandItem
                    key={supplier.key}
                    value={supplier.key}
                    onSelect={() => handleSelect(supplier)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === supplier.contactId && valueContactType === supplier.contactType ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <Building2 className="mr-2 h-3 w-3 text-blue-500" />
                    {getOptionLabel(supplier)}
                  </CommandItem>
                ))}
              </CommandGroup>
              </>
            )}

            {/* Workers */}
            {filteredWorkers.length > 0 && (
              <>
                {(filteredDonors.length > 0 || filteredSuppliers.length > 0) && <CommandSeparator />}
                <CommandGroup heading={t.contactCombobox.employees}>
                {filteredWorkers.map((worker) => (
                  <CommandItem
                    key={worker.key}
                    value={worker.key}
                    onSelect={() => handleSelect(worker)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === worker.contactId && valueContactType === worker.contactType ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <Users className="mr-2 h-3 w-3 text-green-600" />
                    {getOptionLabel(worker)}
                  </CommandItem>
                ))}
                </CommandGroup>
              </>
            )}

            {/* Create new options - only shown after results */}
            {hasResults && <CommandSeparator />}
            <CommandGroup heading={t.contactCombobox.createNew}>
              <CommandItem onSelect={() => handleCreateNew('donor')}>
                <Heart className="mr-2 h-4 w-4 text-red-500" />
                {createDonorTextValue}
              </CommandItem>
              <CommandItem onSelect={() => handleCreateNew('supplier')}>
                <Building2 className="mr-2 h-4 w-4 text-blue-500" />
                {createSupplierTextValue}
              </CommandItem>
            </CommandGroup>

            {/* Unlink option */}
            {value && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={handleUnlink}>
                    {unlinkTextValue}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// DONOR SELECTOR (només donants)
// ═══════════════════════════════════════════════════════════════════════════

interface DonorSelectorProps {
  donors: Contact[];
  value: string | null;
  onSelect: (contactId: string | null) => void;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
}

export const DonorSelector = React.memo(function DonorSelector({
  donors,
  value,
  onSelect,
  placeholder,
  emptyText,
  searchPlaceholder,
}: DonorSelectorProps) {
  const { t } = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const placeholderText = placeholder || t.movements.table.assign;
  const emptyTextValue = emptyText || t.contactCombobox.emptyText;
  const searchPlaceholderValue = searchPlaceholder || t.contactCombobox.searchPlaceholder;

  const selectedDonor = donors.find((donor) => donor.id === value);

  const filteredDonors = donors.filter((donor) =>
    donor.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (donorId: string) => {
    onSelect(donorId === value ? null : donorId);
    setOpen(false);
    setSearch('');
  };

  const handleUnlink = () => {
    onSelect(null);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {selectedDonor ? (
          <Button
            variant="ghost"
            className="h-auto p-0 text-left font-normal flex items-center gap-1"
          >
            <Heart className="h-3 w-3 text-red-500 shrink-0" />
            <span className="text-[13px] truncate max-w-[90px]" title={selectedDonor.name}>
              {selectedDonor.name}
            </span>
            <ChevronsUpDown className="h-3 w-3 text-muted-foreground ml-1" />
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="text-muted-foreground h-7 text-xs px-2">
            <UserPlus className="mr-1 h-3 w-3" />
            {placeholderText}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholderValue}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{emptyTextValue}</CommandEmpty>

            {/* Donors */}
            {filteredDonors.length > 0 && (
              <CommandGroup heading={t.contactCombobox.donors}>
                {filteredDonors.map((donor) => (
                  <CommandItem
                    key={donor.id}
                    value={donor.id}
                    onSelect={() => handleSelect(donor.id)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === donor.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <Heart className="mr-2 h-3 w-3 text-red-500" />
                    {donor.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Unlink option */}
            {value && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={handleUnlink}>
                    Desvincular
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});
