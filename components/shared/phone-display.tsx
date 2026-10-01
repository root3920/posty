'use client';

import * as React from 'react';
import { formatPhoneNumberIntl, parsePhoneNumber } from 'react-phone-number-input';
import type { CountryCode } from 'libphonenumber-js';
import { cn } from '@/lib/utils';
import { ContactActions } from './contact-actions';

function getFlagEmoji(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

interface PhoneDisplayProps {
  /** E.164 formatted phone number (e.g. +573248239884) */
  value: string | null | undefined;
  showActions?: boolean;
  className?: string;
}

export function PhoneDisplay({ value, showActions = true, className }: PhoneDisplayProps) {
  if (!value) return <span className="text-muted-foreground">—</span>;

  // Skip LID identifiers
  if (value.startsWith('lid:') || value.startsWith('contact:')) {
    return <span className="text-muted-foreground text-xs">Contacto de WhatsApp</span>;
  }

  let flag = '';
  let formatted = value;

  try {
    const parsed = parsePhoneNumber(value);
    if (parsed) {
      const country = parsed.country as CountryCode | undefined;
      if (country) flag = getFlagEmoji(country);
      formatted = formatPhoneNumberIntl(value) || value;
    }
  } catch {
    // Fallback: display raw value
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {flag && <span aria-hidden className="text-base leading-none">{flag}</span>}
      <span className="tabular-nums text-sm">{formatted}</span>
      {showActions && <ContactActions phone={value} size="sm" />}
    </span>
  );
}
