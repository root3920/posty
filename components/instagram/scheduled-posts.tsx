'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MoreHorizontal,
  Play,
  Copy,
  FileText,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Layers,
  CheckCircle2,
  Loader2,
  XCircle,
} from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { SchedulePicker } from '@/components/instagram/schedule-picker';
import { cn } from '@/lib/utils';
import { utcToHotelLocal } from '@/lib/datetime-tz';
import {
  useInstagramPosts,
  usePostAction,
  usePublishNow,
  useDeletePost,
  useDuplicatePost,
  usePublisherHeartbeat,
  type InstagramPost,
} from '@/hooks/use-instagram';

// -------------------------------------------------------
// Publisher health indicator
// -------------------------------------------------------

function PublisherHealthIndicator() {
  const { data: heartbeat } = usePublisherHeartbeat();

  if (!heartbeat) return null;

  const relativeTime = heartbeat.secondsAgo < 60
    ? `hace ${heartbeat.secondsAgo} s`
    : heartbeat.secondsAgo < 3600
    ? `hace ${Math.floor(heartbeat.secondsAgo / 60)} min`
    : `hace ${Math.floor(heartbeat.secondsAgo / 3600)} h`;

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
      heartbeat.active
        ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400'
        : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400',
    )}>
      <span className={cn(
        'h-2 w-2 rounded-full',
        heartbeat.active ? 'bg-green-500 animate-pulse' : 'bg-red-500',
      )} />
      <span>
        {heartbeat.active
          ? `Publicador automático: activo · último chequeo ${relativeTime}`
          : 'El publicador no está corriendo'}
      </span>
    </div>
  );
}

// -------------------------------------------------------
// Status badge
// -------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon: typeof Clock }> = {
    scheduled: { label: 'Programado', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400', icon: Clock },
    processing: { label: 'Publicando...', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400', icon: Loader2 },
    published: { label: 'Publicado', className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400', icon: CheckCircle2 },
    failed: { label: 'Fallido', className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400', icon: XCircle },
    draft: { label: 'Borrador', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', icon: FileText },
  };

  const c = config[status] ?? config.draft;
  const Icon = c.icon;

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', c.className)}>
      <Icon className={cn('h-3 w-3', status === 'processing' && 'animate-spin')} />
      {c.label}
    </span>
  );
}

// -------------------------------------------------------
// Post card
// -------------------------------------------------------

interface PostCardProps {
  post: InstagramPost;
  timezone: string;
  onEdit: (post: InstagramPost) => void;
}

function PostCard({ post, timezone, onEdit }: PostCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<string | null>(post.scheduled_at);

  const postAction = usePostAction();
  const publishNow = usePublishNow();
  const deletePost = useDeletePost();
  const duplicatePost = useDuplicatePost();

  const isBusy = postAction.isPending || publishNow.isPending || deletePost.isPending || duplicatePost.isPending;

  const media = post.media as Array<{ publicUrl: string; altText?: string }>;
  const thumb = media?.[0]?.publicUrl;
  const isCarousel = media && media.length > 1;

  const localTime = post.scheduled_at
    ? utcToHotelLocal(post.scheduled_at, timezone)
    : null;

  // Countdown — stored in state to avoid impure Date.now() during render
  const [countdownText, setCountdownText] = useState('');
  useEffect(() => {
    function compute() {
      if (!post.scheduled_at) { setCountdownText(''); return; }
      const diffMs = new Date(post.scheduled_at).getTime() - Date.now();
      if (diffMs < 0) { setCountdownText('pendiente'); return; }
      const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const mins = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
      if (days > 0) { setCountdownText(`en ${days} día${days > 1 ? 's' : ''}`); return; }
      if (hours > 0) { setCountdownText(`en ${hours} h ${mins} min`); return; }
      setCountdownText(`en ${mins} min`);
    }
    compute();
    const interval = setInterval(compute, 60_000);
    return () => clearInterval(interval);
  }, [post.scheduled_at]);

  const captionPreview = post.caption
    ? post.caption.length > 80
      ? post.caption.slice(0, 80) + '...'
      : post.caption
    : 'Sin descripción';

  const authorName = post.profiles
    ? [post.profiles.first_name, post.profiles.last_name].filter(Boolean).join(' ')
    : '';

  return (
    <>
      <div className={cn(
        'flex gap-3 rounded-xl border bg-card p-3 transition-colors',
        post.status === 'failed' && 'border-red-200 dark:border-red-900',
      )}>
        {/* Thumbnail */}
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="Miniatura" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <FileText className="h-6 w-6" />
            </div>
          )}
          {isCarousel && (
            <div className="absolute right-0.5 top-0.5 rounded-sm bg-black/60 p-0.5 text-white">
              <Layers className="h-3 w-3" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {localTime && (
                <p className="font-heading text-lg font-bold tabular-nums leading-tight">
                  {localTime.time}
                </p>
              )}
              <p className="truncate text-xs text-muted-foreground">{captionPreview}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <StatusBadge status={post.status} />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={isBusy} />
                  }
                >
                  <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {['draft', 'scheduled', 'failed'].includes(post.status) && (
                    <DropdownMenuItem onClick={() => onEdit(post)}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                  )}
                  {['draft', 'scheduled', 'failed'].includes(post.status) && (
                    <DropdownMenuItem onClick={() => setRescheduleOpen(true)}>
                      <Clock className="mr-2 h-4 w-4" />
                      Cambiar fecha/hora
                    </DropdownMenuItem>
                  )}
                  {['draft', 'scheduled', 'failed'].includes(post.status) && (
                    <DropdownMenuItem onClick={() => publishNow.mutate(post.id)}>
                      <Play className="mr-2 h-4 w-4" />
                      Publicar ahora
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => duplicatePost.mutate(post)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicar
                  </DropdownMenuItem>
                  {['scheduled', 'failed'].includes(post.status) && (
                    <DropdownMenuItem onClick={() => postAction.mutate({ id: post.id, action: 'to_draft' })}>
                      <FileText className="mr-2 h-4 w-4" />
                      Pasar a borrador
                    </DropdownMenuItem>
                  )}
                  {post.status === 'failed' && (
                    <DropdownMenuItem onClick={() => postAction.mutate({ id: post.id, action: 'retry' })}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reintentar
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {['draft', 'scheduled', 'failed', 'canceled'].includes(post.status) && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Bottom row */}
          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
            {authorName && <span>{authorName}</span>}
            {countdownText && post.status === 'scheduled' && (
              <>
                <span>·</span>
                <span className="tabular-nums">{countdownText}</span>
              </>
            )}
          </div>

          {/* Error message */}
          {post.status === 'failed' && post.error && (
            <div className="mt-1.5 flex items-start gap-1 rounded-md bg-red-50 px-2 py-1 text-[10px] text-red-700 dark:bg-red-950 dark:text-red-400">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{post.error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <ResponsiveDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar post"
        description="¿Estás seguro? Esta acción no se puede deshacer."
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { deletePost.mutate(post.id); setDeleteOpen(false); }}
            >
              Eliminar
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          Se eliminará permanentemente este post y no se publicará en Instagram.
        </p>
      </ResponsiveDialog>

      {/* Reschedule dialog */}
      <ResponsiveDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        title="Cambiar fecha y hora"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setRescheduleOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!rescheduleDate}
              onClick={() => {
                if (rescheduleDate) {
                  postAction.mutate({ id: post.id, action: 'reschedule', scheduled_at: rescheduleDate });
                  setRescheduleOpen(false);
                }
              }}
            >
              Reprogramar
            </Button>
          </div>
        }
      >
        <SchedulePicker
          value={rescheduleDate}
          onChange={setRescheduleDate}
          timezone={timezone}
        />
      </ResponsiveDialog>
    </>
  );
}

// -------------------------------------------------------
// Day group header
// -------------------------------------------------------

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  if (isToday(d)) return 'Hoy';
  if (isTomorrow(d)) return 'Mañana';
  return format(d, "EEEE d 'de' MMMM", { locale: es });
}

// -------------------------------------------------------
// Filter tabs
// -------------------------------------------------------

type PostFilter = 'scheduled' | 'publishing' | 'published' | 'failed' | 'draft';

const FILTER_OPTIONS: { value: PostFilter; label: string }[] = [
  { value: 'scheduled', label: 'Programados' },
  { value: 'publishing', label: 'Publicando' },
  { value: 'published', label: 'Publicados' },
  { value: 'failed', label: 'Fallidos' },
  { value: 'draft', label: 'Borradores' },
];

// -------------------------------------------------------
// Main component
// -------------------------------------------------------

interface ScheduledPostsProps {
  timezone: string;
  onEdit: (post: InstagramPost) => void;
}

export function ScheduledPosts({ timezone, onEdit }: ScheduledPostsProps) {
  const [filter, setFilter] = useState<PostFilter>('scheduled');
  const statusMap: Record<PostFilter, string[]> = {
    scheduled: ['scheduled'],
    publishing: ['processing'],
    published: ['published'],
    failed: ['failed'],
    draft: ['draft'],
  };
  const { data: posts = [], isLoading, error } = useInstagramPosts(statusMap[filter]);

  // Group by day (hotel-local)
  const grouped = useMemo(() => {
    const groups: Record<string, InstagramPost[]> = {};
    for (const post of posts) {
      const dateKey = post.scheduled_at
        ? utcToHotelLocal(post.scheduled_at, timezone).date
        : post.created_at
        ? utcToHotelLocal(post.created_at, timezone).date
        : 'sin-fecha';

      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(post);
    }

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [posts, timezone]);

  // Summary for scheduled filter
  const scheduledCount = filter === 'scheduled' ? posts.length : 0;
  const nextPost = filter === 'scheduled' && posts.length > 0 ? posts[0] : null;
  const [nextPostCountdown, setNextPostCountdown] = useState('');
  useEffect(() => {
    function compute() {
      if (!nextPost?.scheduled_at) { setNextPostCountdown(''); return; }
      const diffMs = new Date(nextPost.scheduled_at).getTime() - Date.now();
      if (diffMs < 0) { setNextPostCountdown('pendiente'); return; }
      const hours = Math.floor(diffMs / (60 * 60 * 1000));
      const mins = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
      if (hours > 0) { setNextPostCountdown(`${hours} h ${mins} min`); return; }
      setNextPostCountdown(`${mins} min`);
    }
    compute();
    const interval = setInterval(compute, 60_000);
    return () => clearInterval(interval);
  }, [nextPost?.scheduled_at]);

  // Failed posts for banner
  const { data: failedPosts = [] } = useInstagramPosts(['failed']);

  return (
    <div className="space-y-4">
      {/* Publisher health */}
      <PublisherHealthIndicator />

      {/* Failed banner (always visible when there are failed posts) */}
      {failedPosts.length > 0 && filter !== 'failed' && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm dark:border-red-900 dark:bg-red-950">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <span>{failedPosts.length} post{failedPosts.length > 1 ? 's' : ''} fallido{failedPosts.length > 1 ? 's' : ''}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setFilter('failed')}>
            Ver fallidos
          </Button>
        </div>
      )}

      {/* Summary */}
      {filter === 'scheduled' && scheduledCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {scheduledCount} programado{scheduledCount > 1 ? 's' : ''}
          {nextPostCountdown && ` · próximo en ${nextPostCountdown}`}
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
              filter === f.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Posts list */}
      {error ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : 'Error al cargar posts'}
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {filter === 'scheduled' ? 'No hay posts programados' :
           filter === 'failed' ? 'No hay posts fallidos' :
           filter === 'draft' ? 'No hay borradores' :
           filter === 'published' ? 'No hay posts publicados' :
           'No hay posts'}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([dateKey, dayPosts]) => (
            <div key={dateKey} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {dateKey === 'sin-fecha' ? 'Sin fecha' : formatDayHeader(dateKey)}
              </h3>
              <div className="space-y-2">
                {dayPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    timezone={timezone}
                    onEdit={onEdit}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
