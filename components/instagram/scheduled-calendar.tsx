'use client';

import { useMemo, useState } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks,
  isSameMonth, isToday, format,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { utcToHotelLocal } from '@/lib/datetime-tz';
import { useInstagramPosts, type InstagramPost } from '@/hooks/use-instagram';

type CalendarView = 'month' | 'week';

interface ScheduledCalendarProps {
  timezone: string;
  onNewPost: (date: string) => void;
  onEditPost: (post: InstagramPost) => void;
}

export function ScheduledCalendar({ timezone, onNewPost, onEditPost }: ScheduledCalendarProps) {
  const [view, setView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: posts = [] } = useInstagramPosts(['scheduled', 'processing', 'published']);

  // Map posts by local date
  const postsByDate = useMemo(() => {
    const map: Record<string, Array<InstagramPost & { localTime: string }>> = {};
    for (const post of posts) {
      const dateStr = post.scheduled_at ?? post.published_at;
      if (!dateStr) continue;
      const local = utcToHotelLocal(dateStr, timezone);
      if (!map[local.date]) map[local.date] = [];
      map[local.date].push({ ...post, localTime: local.time });
    }
    // Sort each day by time
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.localTime.localeCompare(b.localTime));
    }
    return map;
  }, [posts, timezone]);

  // Days to render
  const days = useMemo(() => {
    if (view === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: calStart, end: calEnd });
    }
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [view, currentDate]);

  function navigate(direction: 'prev' | 'next') {
    if (view === 'month') {
      setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    } else {
      setCurrentDate(direction === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    }
  }

  const headerLabel = view === 'month'
    ? format(currentDate, 'MMMM yyyy', { locale: es })
    : `Semana del ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d 'de' MMMM", { locale: es })}`;

  const weekDayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-heading text-sm font-semibold capitalize min-w-[160px] text-center">
            {headerLabel}
          </h3>
          <Button variant="ghost" size="sm" onClick={() => navigate('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-1 rounded-lg border bg-muted/50 p-0.5">
          {(['month', 'week'] as CalendarView[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                view === v
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {v === 'month' ? 'Mes' : 'Semana'}
            </button>
          ))}
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px">
        {weekDayNames.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-px rounded-xl border bg-border overflow-hidden">
        {days.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayPosts = postsByDate[dateKey] ?? [];
          const inCurrentMonth = isSameMonth(day, currentDate);
          const today = isToday(day);

          return (
            <div
              key={dateKey}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (dayPosts.length === 0) onNewPost(dateKey);
              }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && dayPosts.length === 0) onNewPost(dateKey);
              }}
              className={cn(
                'flex flex-col bg-card p-1.5 transition-colors',
                view === 'month' ? 'min-h-[80px] sm:min-h-[100px]' : 'min-h-[120px]',
                !inCurrentMonth && view === 'month' && 'opacity-40',
                dayPosts.length === 0 && 'cursor-pointer hover:bg-muted/50',
              )}
            >
              {/* Day number */}
              <span className={cn(
                'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium tabular-nums',
                today && 'bg-primary text-primary-foreground',
              )}>
                {format(day, 'd')}
              </span>

              {/* Post entries */}
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayPosts.slice(0, view === 'month' ? 2 : 5).map((post) => {
                  const media = post.media as Array<{ publicUrl: string }>;
                  const thumb = media?.[0]?.publicUrl;
                  const isCarousel = media && media.length > 1;

                  return (
                    <button
                      key={post.id}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onEditPost(post); }}
                      className={cn(
                        'flex items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] transition-colors hover:bg-muted',
                        post.status === 'scheduled' && 'bg-blue-50 dark:bg-blue-950/50',
                        post.status === 'published' && 'bg-green-50 dark:bg-green-950/50',
                      )}
                    >
                      {thumb && (
                        <div className="relative h-4 w-4 shrink-0 overflow-hidden rounded-sm">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={thumb} alt="" className="h-full w-full object-cover" />
                          {isCarousel && (
                            <Layers className="absolute bottom-0 right-0 h-2 w-2 text-white drop-shadow" />
                          )}
                        </div>
                      )}
                      <span className="truncate font-medium tabular-nums">{post.localTime}</span>
                    </button>
                  );
                })}
                {dayPosts.length > (view === 'month' ? 2 : 5) && (
                  <span className="px-1 text-[9px] text-muted-foreground">
                    +{dayPosts.length - (view === 'month' ? 2 : 5)} más
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
