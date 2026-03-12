'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Heart, Building2, UserPlus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SummaTooltip } from '@/components/ui/summa-tooltip';
import { useTranslations } from '@/i18n';
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
  type: 'donor' | 'supplier' | 'employee';
}

interface ContactComboboxProps {
  contacts: Contact[];
  value: string | null;
  onSelect: (contactId: string | null) => void;
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

  const selectedContact = contacts.find((contact) => contact.id === value);

  const donors = contacts.filter((c) => c.type === 'donor');
  const suppliers = contacts.filter((c) => c.type === 'supplier');
  const workers = contacts.filter((c) => c.type === 'employee');

  const filteredDonors = donors.filter((donor) =>
    donor.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredSuppliers = suppliers.filter((supplier) =>
    supplier.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredWorkers = workers.filter((worker) =>
    worker.name.toLowerCase().includes(search.toLowerCase())
  );

  const hasResults = filteredDonors.length > 0 || filteredSuppliers.length > 0 || filteredWorkers.length > 0;

  const handleSelect = (contactId: string) => {
    if (disabled) return;
    onSelect(contactId === value ? null : contactId);
    setOpen(false);
    setSearch('');
  };

  const handleUnlink = () => {
    if (disabled) return;
    onSelect(null);
    setOpen(false);
    setSearch('');
  };

  const handleCreateNew = (type: 'donor' | 'supplier') => {
    setOpen(false);
    setSearch('');
    onCreateNew(type);
  };

  return (
    <Popover open={open} onOpenChange={(nextOpen) => {
      if (disabled && nextOpen) return;
      setOpen(nextOpen);
    }}>
      <PopoverTrigger asChild>
        {selectedContact ? (
          <Button
            variant="ghost"
            className="h-auto p-0 text-left font-normal flex items-center gap-1"
            disabled={disabled}
          >
            {selectedContact.type === 'donor' ? (
              <Heart className="h-3 w-3 text-red-500 shrink-0" />
            ) : selectedContact.type === 'employee' ? (
              <Users className="h-3 w-3 text-green-600 shrink-0" />
            ) : (
              <Building2 className="h-3 w-3 text-blue-500 shrink-0" />
            )}
            <SummaTooltip content={selectedContact.name}>
              <span className="text-[13px] max-w-[220px]">
                {middleEllipsis(selectedContact.name)}
              </span>
            </SummaTooltip>
            <ChevronsUpDown className="h-3 w-3 text-muted-foreground ml-1" />
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="text-muted-foreground text-[13px]" disabled={disabled}>
            <UserPlus className="mr-2 h-4 w-4" />
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

            {/* Suppliers */}
            {filteredSuppliers.length > 0 && (
              <>
                {filteredDonors.length > 0 && <CommandSeparator />}
                <CommandGroup heading={t.contactCombobox.suppliers}>
                  {filteredSuppliers.map((supplier) => (
                    <CommandItem
                      key={supplier.id}
                      value={supplier.id}
                      onSelect={() => handleSelect(supplier.id)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === supplier.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <Building2 className="mr-2 h-3 w-3 text-blue-500" />
                      {supplier.name}
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
                      key={worker.id}
                      value={worker.id}
                      onSelect={() => handleSelect(worker.id)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === worker.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <Users className="mr-2 h-3 w-3 text-green-600" />
                      {worker.name}
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
