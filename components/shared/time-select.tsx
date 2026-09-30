'use client';

import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface TimeSelectProps {
  value: string;
  onChange: (value: string) => void;
  /** Earliest selectable time, e.g. '08:00' */
  minTime?: string;
  /** Latest selectable time, e.g. '22:00' */
  maxTime?: string;
  /** Interval in minutes (default 30) */
  interval?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Blocked time ranges to show as unavailable */
  blockedRanges?: { start: string; end: string; label?: string }[];
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function TimeSelect({
  value,
  onChange,
  minTime = '00:00',
  maxTime = '23:30',
  interval = 30,
  placeholder = 'Hora',
  disabled = false,
  className,
  blockedRanges = [],
}: TimeSelectProps) {
  const options = useMemo(() => {
    const minMins = timeToMinutes(minTime);
    const maxMins = timeToMinutes(maxTime);
    const result: { value: string; label: string; blocked: boolean; blockLabel?: string }[] = [];

    for (let m = minMins; m <= maxMins; m += interval) {
      const timeStr = minutesToTime(m);
      const blocked = blockedRanges.some(
        (r) => m >= timeToMinutes(r.start) && m < timeToMinutes(r.end),
      );
      const blockLabel = blocked
        ? blockedRanges.find((r) => m >= timeToMinutes(r.start) && m < timeToMinutes(r.end))?.label
        : undefined;

      result.push({
        value: timeStr,
        label: timeStr,
        blocked,
        blockLabel,
      });
    }
    return result;
  }, [minTime, maxTime, interval, blockedRanges]);

  // Find the label for current value to render manually (avoids SelectValue UUID issue)
  const selectedLabel = value || placeholder;

  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? '')} disabled={disabled}>
      <SelectTrigger className={cn('w-full tabular-nums', className)}>
        <span className={!value ? 'text-muted-foreground' : ''}>
          {selectedLabel}
        </span>
      </SelectTrigger>
      <SelectContent className="max-h-60">
        {options.map((opt) => (
          <SelectItem
            key={opt.value}
            value={opt.value}
            disabled={opt.blocked}
            className={cn(
              'tabular-nums',
              opt.blocked && 'text-muted-foreground line-through',
            )}
          >
            {opt.label}
            {opt.blocked && opt.blockLabel && (
              <span className="ml-2 text-[10px] text-red-500">{opt.blockLabel}</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
