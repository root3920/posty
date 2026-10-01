'use client';

import { useState, useMemo, useEffect } from 'react';
import { addDays, nextSaturday, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TimeSelect } from '@/components/shared/time-select';
import {
  hotelLocalToUtc,
  utcToHotelLocal,
  formatScheduledAt,
  getTimezoneCity,
  nowInTz,
} from '@/lib/datetime-tz';
import { cn } from '@/lib/utils';

interface SchedulePickerProps {
  /** UTC ISO string or null */
  value: string | null;
  onChange: (utcIso: string) => void;
  timezone: string;
}

export function SchedulePicker({ value, onChange, timezone }: SchedulePickerProps) {
  const now = nowInTz(timezone);

  // Parse value or default to "today" in hotel's timezone
  const initial = value ? utcToHotelLocal(value, timezone) : { date: now.date, time: '19:00' };
  const [selectedDate, setSelectedDate] = useState(initial.date);
  const [selectedTime, setSelectedTime] = useState(initial.time);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const minDate = new Date(now.date + 'T00:00:00');
  const maxDate = addDays(minDate, 180);

  // Compute quick shortcuts based on hotel timezone "now"
  const shortcuts = useMemo(() => {
    const today = now.date;
    const tomorrow = format(addDays(new Date(today + 'T12:00:00'), 1), 'yyyy-MM-dd');
    const in3Days = format(addDays(new Date(today + 'T12:00:00'), 3), 'yyyy-MM-dd');
    const nextSat = format(nextSaturday(new Date(today + 'T12:00:00')), 'yyyy-MM-dd');

    return [
      { label: 'Hoy 19:00', date: today, time: '19:00' },
      { label: 'Mañana 12:00', date: tomorrow, time: '12:00' },
      { label: 'En 3 días 18:00', date: in3Days, time: '18:00' },
      { label: `Próximo sábado 10:00`, date: nextSat, time: '10:00' },
    ];
  }, [now.date]);

  function handleShortcut(date: string, time: string) {
    setSelectedDate(date);
    setSelectedTime(time);
    onChange(hotelLocalToUtc(date, time, timezone));
  }

  function handleDateChange(date: Date | undefined) {
    if (!date) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    setSelectedDate(dateStr);
    setCalendarOpen(false);
    onChange(hotelLocalToUtc(dateStr, selectedTime, timezone));
  }

  function handleTimeChange(time: string) {
    setSelectedTime(time);
    onChange(hotelLocalToUtc(selectedDate, time, timezone));
  }

  // Relative countdown — stored in state to avoid impure Date.now() during render
  const [countdownText, setCountdownText] = useState('');
  useEffect(() => {
    function compute() {
      if (!value) { setCountdownText(''); return; }
      const diffMs = new Date(value).getTime() - Date.now();
      if (diffMs < 0) { setCountdownText('ya pasó'); return; }
      const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
      if (days > 0) { setCountdownText(`en ${days} día${days > 1 ? 's' : ''}`); return; }
      if (hours > 0) { setCountdownText(`en ${hours} h ${minutes} min`); return; }
      setCountdownText(`en ${minutes} min`);
    }
    compute();
    const interval = setInterval(compute, 60_000);
    return () => clearInterval(interval);
  }, [value]);

  return (
    <div className="space-y-3">
      {/* Quick shortcuts */}
      <div className="flex flex-wrap gap-1.5">
        {shortcuts.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => handleShortcut(s.date, s.time)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
              selectedDate === s.date && selectedTime === s.time
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Date + Time row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        {/* Date picker */}
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Fecha</label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger
              render={
                <Button variant="outline" size="sm" className="w-full justify-start font-normal" />
              }
            >
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {format(new Date(selectedDate + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={new Date(selectedDate + 'T12:00:00')}
                onSelect={handleDateChange}
                disabled={(date) => date < minDate || date > maxDate}
                locale={es}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Time picker */}
        <div className="w-32 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Hora</label>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <TimeSelect
              value={selectedTime}
              onChange={handleTimeChange}
              interval={5}
              minTime="00:00"
              maxTime="23:55"
            />
          </div>
        </div>
      </div>

      {/* Summary line */}
      {value && (
        <p className="text-xs text-muted-foreground">
          Se publicará el{' '}
          <span className="font-medium text-foreground">
            {formatScheduledAt(value, timezone)}
          </span>{' '}
          (hora del hotel · {getTimezoneCity(timezone)}) ·{' '}
          <span className="tabular-nums">{countdownText}</span>
        </p>
      )}
    </div>
  );
}
