'use client';

import * as React from 'react';
import PhoneInputCore, {
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  type Value as PhoneValue,
} from 'react-phone-number-input/input';
import {
  getExampleNumber,
  AsYouType,
} from 'libphonenumber-js';
import examples from 'libphonenumber-js/mobile/examples';
import type { Country } from 'react-phone-number-input';
import esLabels from 'react-phone-number-input/locale/es.json';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { ChevronDown } from 'lucide-react';

// -------------------------------------------------------
// Country list configuration
// -------------------------------------------------------

const FREQUENT_COUNTRIES: Country[] = ['CO', 'US', 'MX', 'ES', 'VE', 'EC', 'PE', 'AR', 'CL', 'BR', 'PA'];

const ALL_COUNTRIES = getCountries();

// Country label map from Spanish locale
const countryLabels = esLabels as Record<string, string>;

function getCountryLabel(country: Country): string {
  return countryLabels[country] ?? country;
}

// Get a local example number for a country (without the country code prefix)
function getLocalExample(country: Country): string {
  try {
    const example = getExampleNumber(country, examples);
    if (!example) return '';
    // Format as national (local) — strip the country code
    const formatted = new AsYouType(country).input(example.nationalNumber);
    return formatted;
  } catch {
    return '';
  }
}

// Flag emoji from country code (ISO 3166-1 alpha-2)
function getFlagEmoji(countryCode: Country): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// -------------------------------------------------------
// Country selector
// -------------------------------------------------------

interface CountrySelectorProps {
  value: Country;
  onChange: (country: Country) => void;
  disabled?: boolean;
}

function CountrySelector({ value, onChange, disabled }: CountrySelectorProps) {
  const [open, setOpen] = React.useState(false);

  const frequentOptions = FREQUENT_COUNTRIES.map((c) => ({
    code: c,
    label: getCountryLabel(c),
    flag: getFlagEmoji(c),
    callingCode: getCountryCallingCode(c),
  }));

  const restOptions = ALL_COUNTRIES
    .filter((c) => !FREQUENT_COUNTRIES.includes(c))
    .map((c) => ({
      code: c,
      label: getCountryLabel(c),
      flag: getFlagEmoji(c),
      callingCode: getCountryCallingCode(c),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        aria-label={`País: ${getCountryLabel(value)}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex h-full w-14 shrink-0 items-center justify-center gap-0.5 rounded-l-[10px] border-r border-input bg-muted/40 transition-colors',
          'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span aria-hidden className="text-lg leading-none">{getFlagEmoji(value)}</span>
        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-[280px] p-0"
      >
        <Command>
          <CommandInput placeholder="Buscar país..." />
          <CommandList>
            <CommandEmpty>No se encontró el país.</CommandEmpty>

            {/* Frequent countries */}
            <CommandGroup heading="Frecuentes">
              {frequentOptions.map((country) => (
                <CommandItem
                  key={country.code}
                  value={`${country.label} ${country.code}`}
                  onSelect={() => {
                    onChange(country.code as Country);
                    setOpen(false);
                  }}
                  data-checked={value === country.code}
                  aria-selected={value === country.code}
                >
                  <span aria-hidden className="mr-2 text-base">{country.flag}</span>
                  <span className="flex-1 truncate">{country.label}</span>
                  <span className="ml-2 tabular-nums text-xs text-muted-foreground">
                    +{country.callingCode}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            {/* All other countries alphabetically */}
            <CommandGroup heading="Todos los países">
              {restOptions.map((country) => (
                <CommandItem
                  key={country.code}
                  value={`${country.label} ${country.code}`}
                  onSelect={() => {
                    onChange(country.code as Country);
                    setOpen(false);
                  }}
                  data-checked={value === country.code}
                  aria-selected={value === country.code}
                >
                  <span aria-hidden className="mr-2 text-base">{country.flag}</span>
                  <span className="flex-1 truncate">{country.label}</span>
                  <span className="ml-2 tabular-nums text-xs text-muted-foreground">
                    +{country.callingCode}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// -------------------------------------------------------
// PhoneInput props
// -------------------------------------------------------

export interface PhoneInputProps {
  value?: string;
  onChange?: (value: string | undefined) => void;
  defaultCountry?: Country;
  onCountryChange?: (country: Country) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Error message from react-hook-form or parent */
  error?: string;
  className?: string;
}

// -------------------------------------------------------
// PhoneInput component
// -------------------------------------------------------

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  function PhoneInput(
    {
      value,
      onChange,
      defaultCountry = 'CO',
      onCountryChange,
      disabled = false,
      placeholder: placeholderProp,
      error,
      className,
    },
    ref,
  ) {
    const [country, setCountry] = React.useState<Country>(defaultCountry);
    const [blurred, setBlurred] = React.useState(false);
    const [internalError, setInternalError] = React.useState<string | null>(null);

    // Sync defaultCountry when parent changes it (e.g. nationality change)
    React.useEffect(() => {
      setCountry(defaultCountry);
    }, [defaultCountry]);

    function handleCountryChange(c: Country) {
      setCountry(c);
      onCountryChange?.(c);
      // Re-validate on country change if already blurred
      if (blurred && value) {
        try {
          const valid = isValidPhoneNumber(value, c);
          setInternalError(valid ? null : `Número inválido para ${getCountryLabel(c)}`);
        } catch {
          setInternalError(`Número inválido para ${getCountryLabel(c)}`);
        }
      }
    }

    function handleBlur() {
      setBlurred(true);
      if (!value || value.trim() === '') {
        setInternalError(null);
        return;
      }
      try {
        const valid = isValidPhoneNumber(value, country);
        setInternalError(valid ? null : `Número inválido para ${getCountryLabel(country)}`);
      } catch {
        setInternalError(`Número inválido para ${getCountryLabel(country)}`);
      }
    }

    const displayError = error ?? internalError ?? null;
    const hasError = !!displayError;

    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <div
          className={cn(
            'flex h-9 w-full overflow-hidden rounded-[10px] border bg-background shadow-xs',
            'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0',
            hasError ? 'border-destructive focus-within:ring-destructive' : 'border-input',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          {/* Country selector */}
          <CountrySelector
            value={country}
            onChange={handleCountryChange}
            disabled={disabled}
          />

          {/* Calling code prefix */}
          <span className="flex shrink-0 items-center pl-2.5 text-sm tabular-nums text-muted-foreground select-none">
            +{getCountryCallingCode(country)}
          </span>

          {/* Phone number input */}
          <PhoneInputCore
            ref={ref}
            country={country}
            value={(value as PhoneValue) ?? undefined}
            onChange={(v) => onChange?.(v as string | undefined)}
            onBlur={handleBlur}
            disabled={disabled}
            placeholder={placeholderProp ?? getLocalExample(country)}
            aria-invalid={hasError}
            aria-label="Número de teléfono"
            className={cn(
              'min-w-0 flex-1 bg-transparent px-1.5 py-1.5 text-[16px] tabular-nums outline-none placeholder:text-muted-foreground sm:text-sm',
              'disabled:cursor-not-allowed',
            )}
          />
        </div>

        {displayError && (
          <p className="text-xs text-destructive">{displayError}</p>
        )}
      </div>
    );
  },
);

PhoneInput.displayName = 'PhoneInput';
