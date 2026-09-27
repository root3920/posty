'use client';

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// -------------------------------------------------------
// UUID detection for development guard
// -------------------------------------------------------

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

function isUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface EntityOption {
  value: string;
  label: string;
  description?: string;
  color?: string;
  disabled?: boolean;
  disabledReason?: string;
}

interface EntitySelectProps {
  options: EntityOption[];
  value: string | undefined | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  loadingPlaceholder?: string;
  emptyMessage?: string;
  emptyHref?: string;
  allowClear?: boolean;
  clearLabel?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  size?: 'sm' | 'default';
  isLoading?: boolean;
}

/**
 * Reusable select that always shows the label instead of the UUID.
 * Works with Base UI's Select which doesn't resolve labels automatically.
 *
 * RULE: All dropdowns that use IDs as values MUST use this component.
 * Never use <Select>/<SelectValue> directly for ID-based selections.
 */
export function EntitySelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  loadingPlaceholder = 'Cargando…',
  emptyMessage,
  emptyHref,
  allowClear = false,
  clearLabel = 'Sin especificar',
  disabled = false,
  className,
  triggerClassName,
  size = 'default',
  isLoading = false,
}: EntitySelectProps) {
  // Resolve the display label for the current value
  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption?.label ?? (isLoading ? loadingPlaceholder : placeholder);
  const isPlaceholder = !selectedOption;

  // Development guard: warn if we're about to display a UUID
  if (process.env.NODE_ENV === 'development' && value && !selectedOption && isUUID(value)) {
    console.error(
      `[EntitySelect] Displaying UUID "${value}" as label. ` +
      `This means the options array doesn't contain a matching entry. ` +
      `Check that data has loaded before rendering.`,
    );
  }

  // If no options and an empty message is provided, show it
  if (options.length === 0 && !isLoading && emptyMessage) {
    return (
      <div className={cn('flex items-center rounded-lg border px-3 py-2 text-sm text-muted-foreground', className)}>
        <span className="flex-1 truncate">{emptyMessage}</span>
        {emptyHref && (
          <a href={emptyHref} className="ml-2 shrink-0 text-xs text-primary hover:underline">
            Configurar
          </a>
        )}
      </div>
    );
  }

  return (
    <Select
      value={value ?? ''}
      onValueChange={(v) => onChange(v === '' ? null : v)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger
        className={cn(
          'w-full min-w-0',
          size === 'sm' ? 'h-7 text-xs' : 'h-9 text-sm',
          triggerClassName,
        )}
      >
        <span className={cn(
          'flex-1 truncate text-left min-w-0',
          isPlaceholder && 'text-muted-foreground',
        )}>
          {selectedOption?.color && (
            <span
              className="mr-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full align-middle"
              style={{ backgroundColor: selectedOption.color }}
            />
          )}
          {displayLabel}
        </span>
      </SelectTrigger>
      <SelectContent>
        {allowClear && (
          <SelectItem value="">{clearLabel}</SelectItem>
        )}
        {options.map((opt) => (
          <SelectItem
            key={opt.value}
            value={opt.value}
            disabled={opt.disabled}
          >
            <span className={cn('flex flex-col', opt.disabled && 'text-muted-foreground')}>
              <span className="flex items-center gap-1.5">
                {opt.color && (
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: opt.color }}
                  />
                )}
                {opt.label}
              </span>
              {(opt.description || (opt.disabled && opt.disabledReason)) && (
                <span className="text-[11px] text-muted-foreground leading-tight">
                  {opt.disabled && opt.disabledReason ? opt.disabledReason : opt.description}
                </span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { type EntitySelectProps };
