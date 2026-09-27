'use client';

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface EntityOption {
  value: string;
  label: string;
  color?: string;
}

interface EntitySelectProps {
  options: EntityOption[];
  value: string | undefined | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  emptyMessage?: string;
  emptyHref?: string;
  allowClear?: boolean;
  clearLabel?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  size?: 'sm' | 'default';
}

/**
 * Reusable select that always shows the label instead of the UUID.
 * Works with Base UI's Select which doesn't resolve labels automatically.
 */
export function EntitySelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  emptyMessage,
  emptyHref,
  allowClear = false,
  clearLabel = 'Sin especificar',
  disabled = false,
  className,
  triggerClassName,
  size = 'default',
}: EntitySelectProps) {
  // Resolve the display label for the current value
  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption?.label ?? placeholder;
  const isPlaceholder = !selectedOption;

  // If no options and an empty message is provided, show it
  if (options.length === 0 && emptyMessage) {
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
      disabled={disabled}
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
          <SelectItem key={opt.value} value={opt.value}>
            {opt.color && (
              <span
                className="mr-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: opt.color }}
              />
            )}
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
