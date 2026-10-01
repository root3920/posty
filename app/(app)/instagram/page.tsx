'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Camera,
  Layers,
  Play,
  Heart,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plus,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { cn } from '@/lib/utils';
import {
  useInstagramConnection,
  useInstagramMedia,
  type InstagramMediaItem,
} from '@/hooks/use-instagram';
import { PostComposer } from '@/components/instagram/post-composer';

// -------------------------------------------------------
// No connection empty state
// -------------------------------------------------------

function NoConnectionEmptyState() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400">
        <Camera className="h-10 w-10 text-white" />
      </div>
      <div className="max-w-sm space-y-2">
        <h2 className="font-heading text-xl font-semibold">Conecta tu cuenta de Instagram</h2>
        <p className="text-sm text-muted-foreground">
          Vincula tu cuenta profesional de Instagram para ver y gestionar tus publicaciones desde POSTY.
        </p>
      </div>
      <div className="w-full max-w-sm rounded-xl border bg-muted/40 p-4 text-left">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Requisitos
        </p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-primary">•</span>
            Tu cuenta debe ser profesional (Empresa o Creador)
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-primary">•</span>
            Mientras POSTY esta en revision con Meta, solo se pueden conectar cuentas autorizadas como prueba
          </li>
        </ul>
      </div>
      <Button onClick={() => router.push('/configuracion/instagram')}>
        Conectar Instagram
      </Button>
    </div>
  );
}

// -------------------------------------------------------
// Media cell image with error handling
// -------------------------------------------------------

function MediaCellImage({ src, alt }: { src: string | null; alt: string }) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        <p className="px-2 text-center text-[10px] text-muted-foreground">Imagen no disponible</p>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover"
      onError={() => setError(true)}
    />
  );
}

// -------------------------------------------------------
// Media detail modal
// -------------------------------------------------------

interface MediaDetailModalProps {
  item: InstagramMediaItem | null;
  onClose: () => void;
}

function MediaDetailModal({ item, onClose }: MediaDetailModalProps) {
  const [childIndex, setChildIndex] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);

  if (!item) return null;

  const children = item.children ?? [];
  const hasChildren = children.length > 0;
  const currentChild = hasChildren ? children[childIndex] : null;

  const displayUrl = hasChildren
    ? (currentChild?.media_url ?? item.media_url)
    : item.media_type === 'VIDEO'
    ? (item.thumbnail_url ?? item.media_url)
    : item.media_url;

  const captionLimit = 150;
  const caption = item.caption ?? '';
  const isTruncated = caption.length > captionLimit;
  const displayCaption = captionExpanded ? caption : caption.slice(0, captionLimit);

  const formattedDate = item.timestamp
    ? format(new Date(item.timestamp), "d 'de' MMMM yyyy", { locale: es })
    : null;

  return (
    <ResponsiveDialog
      open={!!item}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Publicacion"
      size="lg"
    >
      <div className="space-y-4">
        {/* Image / carousel */}
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
          <MediaCellImage
            src={displayUrl ?? null}
            alt={caption || 'Publicacion de Instagram'}
          />
          {hasChildren && children.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Anterior"
                onClick={() => setChildIndex((i) => Math.max(0, i - 1))}
                disabled={childIndex === 0}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white disabled:opacity-30 hover:bg-black/70"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Siguiente"
                onClick={() => setChildIndex((i) => Math.min(children.length - 1, i + 1))}
                disabled={childIndex === children.length - 1}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white disabled:opacity-30 hover:bg-black/70"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {/* Dots */}
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                {children.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Imagen ${i + 1}`}
                    onClick={() => setChildIndex(i)}
                    className={cn(
                      'h-1.5 w-1.5 rounded-full transition-all',
                      i === childIndex ? 'scale-125 bg-white' : 'bg-white/50',
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Stats + date */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Heart className="h-4 w-4" />
            {item.like_count.toLocaleString('es')}
          </span>
          <span className="flex items-center gap-1.5">
            <MessageCircle className="h-4 w-4" />
            {item.comments_count.toLocaleString('es')}
          </span>
          {formattedDate && (
            <span className="ml-auto text-xs">{formattedDate}</span>
          )}
        </div>

        {/* Caption */}
        {caption && (
          <div className="text-sm">
            <p className="whitespace-pre-wrap break-words text-foreground">
              {displayCaption}
              {isTruncated && !captionExpanded && (
                <button
                  type="button"
                  onClick={() => setCaptionExpanded(true)}
                  className="ml-1 text-muted-foreground hover:text-foreground"
                >
                  ... mas
                </button>
              )}
            </p>
          </div>
        )}

        {/* Ver en Instagram link */}
        {item.permalink && (
          <a
            href={item.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-center')}
          >
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Ver en Instagram
          </a>
        )}
      </div>
    </ResponsiveDialog>
  );
}

// -------------------------------------------------------
// Media grid cell
// -------------------------------------------------------

function MediaCell({ item, onClick }: { item: InstagramMediaItem; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  const thumbSrc =
    item.media_type === 'VIDEO'
      ? (item.thumbnail_url ?? item.media_url)
      : item.media_url;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative aspect-square cursor-pointer overflow-hidden"
    >
      <MediaCellImage
        src={thumbSrc ?? null}
        alt={item.caption?.slice(0, 80) ?? 'Publicacion'}
      />

      {/* Hover overlay */}
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center gap-4 bg-black/40 transition-opacity',
          hovered ? 'opacity-100' : 'opacity-0',
        )}
      >
        <span className="flex items-center gap-1 text-sm font-semibold text-white">
          <Heart className="h-4 w-4" />
          {item.like_count.toLocaleString('es')}
        </span>
        <span className="flex items-center gap-1 text-sm font-semibold text-white">
          <MessageCircle className="h-4 w-4" />
          {item.comments_count.toLocaleString('es')}
        </span>
      </div>

      {/* Type indicator */}
      {item.media_type === 'CAROUSEL_ALBUM' && (
        <div className="absolute right-1.5 top-1.5 rounded-sm bg-black/60 p-0.5 text-white">
          <Layers className="h-3.5 w-3.5" />
        </div>
      )}
      {item.media_type === 'VIDEO' && (
        <div className="absolute right-1.5 top-1.5 rounded-sm bg-black/60 p-0.5 text-white">
          <Play className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------
// Connected view
// -------------------------------------------------------

function ConnectedInstagramView() {
  const { data: connection } = useInstagramConnection();
  const { data: firstPage, isLoading: isLoadingFirst } = useInstagramMedia(undefined);
  const [displayedItems, setDisplayedItems] = useState<InstagramMediaItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [initialized, setInitialized] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InstagramMediaItem | null>(null);
  const [profileImgError, setProfileImgError] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  // Sync first page once
  if (!initialized && firstPage) {
    setInitialized(true);
    setDisplayedItems(firstPage.media);
    setNextCursor(firstPage.nextCursor);
  }

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/instagram/media?cursor=${nextCursor}`);
      if (res.ok) {
        const data = await res.json();
        setDisplayedItems((prev) => [...prev, ...(data.media ?? [])]);
        setNextCursor(data.nextCursor);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  if (!connection) return null;

  return (
    <div className="space-y-6">
      {/* Profile header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        {/* Avatar */}
        <div className="shrink-0">
          {connection.profile_picture_url && !profileImgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={connection.profile_picture_url}
              alt={connection.username ?? 'Perfil'}
              className="h-20 w-20 rounded-full object-cover ring-2 ring-border"
              onError={() => setProfileImgError(true)}
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400">
              <Camera className="h-10 w-10 text-white" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col gap-3">
          <div>
            {connection.username && (
              <p className="font-heading text-lg font-semibold">@{connection.username}</p>
            )}
            {connection.name && (
              <p className="text-sm text-muted-foreground">{connection.name}</p>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-6">
            <div className="text-center">
              <p className="font-heading text-lg font-bold tabular-nums">
                {connection.media_count.toLocaleString('es')}
              </p>
              <p className="text-xs text-muted-foreground">publicaciones</p>
            </div>
            <div className="text-center">
              <p className="font-heading text-lg font-bold tabular-nums">
                {connection.followers_count.toLocaleString('es')}
              </p>
              <p className="text-xs text-muted-foreground">seguidores</p>
            </div>
            <div className="text-center">
              <p className="font-heading text-lg font-bold tabular-nums">
                {connection.follows_count.toLocaleString('es')}
              </p>
              <p className="text-xs text-muted-foreground">siguiendo</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {connection.username && (
              <a
                href={`https://www.instagram.com/${connection.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Ver en Instagram
              </a>
            )}
            <Button size="sm" onClick={() => setComposerOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nuevo post
            </Button>
          </div>
        </div>
      </div>

      {/* Grid */}
      {isLoadingFirst ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No hay publicaciones aun
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1">
            {displayedItems.map((item) => (
              <MediaCell
                key={item.id}
                item={item}
                onClick={() => setSelectedItem(item)}
              />
            ))}
          </div>

          {nextCursor && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Cargar mas
              </Button>
            </div>
          )}
        </>
      )}

      {/* Detail modal */}
      <MediaDetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />

      {/* Post composer */}
      <PostComposer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        connection={{
          username: connection.username ?? '',
          profile_picture_url: connection.profile_picture_url,
        }}
      />
    </div>
  );
}

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function InstagramPage() {
  const { data: connection, isLoading } = useInstagramConnection();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="space-y-6">
        <PageHeader title="Instagram" />
        <NoConnectionEmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Instagram" />
      <ConnectedInstagramView />
    </div>
  );
}
