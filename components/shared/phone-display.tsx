'use client';

import * as React from 'react';
import { formatPhoneNumberIntl, parsePhoneNumber } from 'react-phone-number-input';
import type { CountryCode } from 'libphonenumber-js';
import { cn } from '@/lib/utils';

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function getFlagEmoji(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// -------------------------------------------------------
// Props
// -------------------------------------------------------

interface PhoneDisplayProps {
  /** E.164 formatted phone number (e.g. +573248239884) */
  value: string | null | undefined;
  showActions?: boolean;
  className?: string;
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function PhoneDisplay({ value, showActions = true, className }: PhoneDisplayProps) {
  if (!value) return <span className="text-muted-foreground">—</span>;

  let flag = '';
  let formatted = value;

  try {
    const parsed = parsePhoneNumber(value);
    if (parsed) {
      const country = parsed.country as CountryCode | undefined;
      if (country) {
        flag = getFlagEmoji(country);
      }
      formatted = formatPhoneNumberIntl(value) || value;
    }
  } catch {
    // Fallback: display raw value
  }

  const waUrl = `https://wa.me/${value.replace(/\D/g, '')}`;
  const telUrl = `tel:${value}`;

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {flag && <span aria-hidden className="text-base leading-none">{flag}</span>}
      <span className="tabular-nums text-sm">{formatted}</span>
      {showActions && (
        <span className="inline-flex items-center gap-1 ml-1">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir en WhatsApp"
            title="WhatsApp"
            className="rounded p-0.5 text-[#25D366] hover:bg-[#25D366]/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* WhatsApp icon (inline SVG) */}
            <svg
              aria-hidden
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-3.5 w-3.5"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
            </svg>
          </a>
          <a
            href={telUrl}
            aria-label="Llamar"
            title="Llamar"
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* Phone icon */}
            <svg
              aria-hidden
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.63 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </a>
        </span>
      )}
    </span>
  );
}
