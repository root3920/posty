'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  Loader2,
  Plus,
  X,
  Image as ImageIcon,
  Smile,
  Upload,
  Layers,
  Send,
  CalendarClock,
  Square,
  RectangleVertical,
  RectangleHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DialogFooterBar } from '@/components/shared/dialog-footer-bar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
// eslint-disable-next-line no-restricted-imports -- custom wide modal, not a standard form
import { Dialog, DialogContent } from '@/components/ui/dialog';
// eslint-disable-next-line no-restricted-imports -- custom full-screen sheet layout
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-media-query';
import { useUploadImage, usePublishPost, useSavePost } from '@/hooks/use-instagram';
import { SchedulePicker } from '@/components/instagram/schedule-picker';

// -------------------------------------------------------
// Types & constants
// -------------------------------------------------------

type AspectRatio = '1:1' | '4:5' | '1.91:1';
type PublishWhen = 'now' | 'schedule';

interface MediaItem {
  path: string;
  publicUrl: string;
  altText: string;
}

const ASPECT_RATIOS: { value: AspectRatio; label: string; icon: typeof Square; recommended?: boolean }[] = [
  { value: '4:5', label: '4:5 Vertical', icon: RectangleVertical, recommended: true },
  { value: '1:1', label: '1:1 Cuadrado', icon: Square },
  { value: '1.91:1', label: '1.91:1 Horizontal', icon: RectangleHorizontal },
];

const QUICK_EMOJIS = ['❤️', '🔥', '✨', '🏨', '☀️', '🌊', '🍽️', '🎉', '👏', '💯'];
const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/heic';
const MAX_CAPTION = 2200;
const MAX_HASHTAGS = 30;
const MAX_IMAGES = 10;

function countHashtags(text: string): number {
  return (text.match(/#\w+/g) ?? []).length;
}

function aspectClass(r: AspectRatio): string {
  return r === '4:5' ? 'aspect-[4/5]' : r === '1.91:1' ? 'aspect-[1.91/1]' : 'aspect-square';
}

// -------------------------------------------------------
// Section heading
// -------------------------------------------------------

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold tabular-nums text-muted-foreground">
        {n}
      </span>
      <span className="text-xs font-semibold text-foreground">{children}</span>
    </div>
  );
}

// -------------------------------------------------------
// Drop zone (unified for 1 or many images)
// -------------------------------------------------------

interface DropZoneProps {
  items: MediaItem[];
  isUploading: boolean;
  onClickUpload: () => void;
  onRemove: (index: number) => void;
  selectedIndex: number;
  onSelect: (index: number) => void;
  aspectRatio: AspectRatio;
}

function DropZone({ items, isUploading, onClickUpload, onRemove, selectedIndex, onSelect, aspectRatio }: DropZoneProps) {
  if (items.length === 0) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClickUpload}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClickUpload(); }}
        className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 transition-colors hover:border-muted-foreground/60 hover:bg-muted/40"
      >
        {isUploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Arrastra tus fotos aquí o haz clic para elegir
            </p>
            <p className="text-xs text-muted-foreground/60">
              JPG, PNG, WEBP o HEIC · hasta 10 fotos
            </p>
          </>
        )}
      </div>
    );
  }

  const current = items[selectedIndex];
  return (
    <div className="space-y-2">
      {/* Main image */}
      <div className={cn('relative w-full overflow-hidden rounded-xl bg-muted', aspectClass(aspectRatio))}>
        {current && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.publicUrl} alt={current.altText || 'Foto'} className="h-full w-full object-cover" />
        )}
        {isUploading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        {/* Carousel dots */}
        {items.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Imagen ${i + 1}`}
                onClick={() => onSelect(i)}
                className={cn(
                  'h-1.5 w-1.5 rounded-full transition-all',
                  i === selectedIndex ? 'scale-125 bg-white' : 'bg-white/50',
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <div
            key={item.publicUrl}
            className={cn(
              'group relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition-colors',
              i === selectedIndex ? 'border-primary' : 'border-transparent hover:border-border',
            )}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(i)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(i); }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.publicUrl} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label={`Quitar foto ${i + 1}`}
              onClick={(e) => { e.stopPropagation(); onRemove(i); }}
              className="absolute right-0 top-0 rounded-bl-md bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
        {items.length < MAX_IMAGES && (
          <button
            type="button"
            aria-label="Agregar foto"
            onClick={onClickUpload}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition-colors hover:border-muted-foreground/60 hover:text-foreground"
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
        )}
        {/* Carousel label */}
        {items.length > 1 && (
          <span className="ml-1 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Layers className="h-3 w-3" />
            Carrusel de {items.length} fotos
          </span>
        )}
      </div>

      {/* Alt text */}
      <Input
        placeholder="Texto alternativo (opcional, para accesibilidad)"
        value={current?.altText ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          // Update alt for selected item — parent handles this via onAltChange
          // We access setMediaItems through the parent's callback
        }}
        className="text-sm"
        aria-label="Texto alternativo"
        readOnly // alt text is set via parent — see below
        style={{ display: 'none' }}
      />
    </div>
  );
}

// -------------------------------------------------------
// Feed preview
// -------------------------------------------------------

function FeedPreview({
  username,
  profilePictureUrl,
  mediaItems,
  caption,
  aspectRatio,
}: {
  username: string;
  profilePictureUrl: string | null;
  mediaItems: MediaItem[];
  caption: string;
  aspectRatio: AspectRatio;
}) {
  const [previewIndex, setPreviewIndex] = useState(0);
  const [profileImgError, setProfileImgError] = useState(false);
  const current = mediaItems.length > 1 ? mediaItems[previewIndex] : mediaItems[0] ?? null;
  const truncated = caption.length > 125;

  return (
    <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-xl border bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        {profilePictureUrl && !profileImgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profilePictureUrl} alt={username}
            className="h-7 w-7 rounded-full object-cover"
            onError={() => setProfileImgError(true)}
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400">
            <ImageIcon className="h-3.5 w-3.5 text-white" />
          </div>
        )}
        <span className="text-xs font-semibold">@{username}</span>
      </div>
      {/* Image */}
      <div className={cn('relative w-full overflow-hidden bg-muted', aspectClass(aspectRatio))}>
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.publicUrl} alt={current.altText || 'Preview'} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
          </div>
        )}
        {mediaItems.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {mediaItems.map((_, i) => (
              <button key={i} type="button" aria-label={`Foto ${i + 1}`} onClick={() => setPreviewIndex(i)}
                className={cn('h-1.5 w-1.5 rounded-full transition-all', i === previewIndex ? 'scale-125 bg-white' : 'bg-white/50')} />
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-3 px-3 py-2 text-base"><span>❤️</span><span>💬</span><span>✈️</span></div>
      <div className="px-3 pb-3">
        <p className="text-xs leading-relaxed text-foreground">
          {caption ? (
            <>
              <span className="font-semibold">@{username} </span>
              {truncated ? caption.slice(0, 125) : caption}
              {truncated && <span className="text-muted-foreground"> … más</span>}
            </>
          ) : (
            <span className="italic text-muted-foreground">Sin descripción…</span>
          )}
        </p>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Grid preview (3 × 3 with the new post first)
// -------------------------------------------------------

function GridPreview({ mediaItems }: { mediaItems: MediaItem[] }) {
  const thumb = mediaItems[0] ?? null;
  const placeholders = Array.from({ length: 5 });

  return (
    <div className="mx-auto grid w-full max-w-[340px] grid-cols-3 gap-0.5 overflow-hidden rounded-lg">
      {/* New post */}
      <div className="relative aspect-square overflow-hidden border-2 border-dashed border-primary/40 bg-muted">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb.publicUrl} alt="Nuevo" className="h-full w-full object-cover opacity-80" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-5 w-5 text-muted-foreground/30" />
          </div>
        )}
        {mediaItems.length > 1 && (
          <div className="absolute right-0.5 top-0.5"><Layers className="h-3 w-3 text-white drop-shadow" /></div>
        )}
      </div>
      {/* Placeholder cells */}
      {placeholders.map((_, i) => (
        <div key={i} className="aspect-square bg-muted/60" />
      ))}
    </div>
  );
}

// -------------------------------------------------------
// Preview panel with Feed / Grid toggle
// -------------------------------------------------------

function PreviewPanel({
  username,
  profilePictureUrl,
  mediaItems,
  caption,
  aspectRatio,
}: {
  username: string;
  profilePictureUrl: string | null;
  mediaItems: MediaItem[];
  caption: string;
  aspectRatio: AspectRatio;
}) {
  const [previewMode, setPreviewMode] = useState<'feed' | 'grid'>('feed');

  if (mediaItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/20 bg-muted/10 px-4 py-16 text-center">
        <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Aquí verás cómo quedará tu post</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex gap-1 rounded-lg border bg-muted/50 p-0.5">
        {(['feed', 'grid'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setPreviewMode(m)}
            className={cn(
              'flex-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              previewMode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m === 'feed' ? 'Feed' : 'Cuadrícula'}
          </button>
        ))}
      </div>
      {previewMode === 'feed' ? (
        <FeedPreview
          username={username}
          profilePictureUrl={profilePictureUrl}
          mediaItems={mediaItems}
          caption={caption}
          aspectRatio={aspectRatio}
        />
      ) : (
        <GridPreview mediaItems={mediaItems} />
      )}
    </div>
  );
}

// -------------------------------------------------------
// Discard confirmation
// -------------------------------------------------------

function DiscardDialog({ open, onDiscard, onDraft, onCancel }: {
  open: boolean;
  onDiscard: () => void;
  onDraft: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent showCloseButton={false} className="max-w-xs">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold">¿Descartar este post?</p>
          <p className="text-xs text-muted-foreground">Los cambios sin guardar se perderán.</p>
          <div className="flex flex-col gap-2">
            <Button size="sm" variant="outline" onClick={onDraft}>Guardar borrador</Button>
            <Button size="sm" variant="destructive" onClick={onDiscard}>Descartar</Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>Seguir editando</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------
// Main export
// -------------------------------------------------------

interface PostComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: {
    username: string;
    profile_picture_url: string | null;
  };
  timezone: string;
  editPost?: {
    id: string;
    type: string;
    caption: string | null;
    media: Array<{ publicUrl: string; altText?: string }>;
    aspect_ratio: string | null;
    status: string;
    scheduled_at: string | null;
  } | null;
}

export function PostComposer({ open, onOpenChange, connection, timezone, editPost }: PostComposerProps) {
  const isMobile = useIsMobile();

  // State
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(
    editPost?.media?.map(m => ({ path: '', publicUrl: m.publicUrl, altText: m.altText ?? '' })) ?? [],
  );
  const [caption, setCaption] = useState(editPost?.caption ?? '');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    (editPost?.aspect_ratio as AspectRatio) ?? '4:5',
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [publishWhen, setPublishWhen] = useState<PublishWhen>(
    editPost?.status === 'scheduled' ? 'schedule' : 'now',
  );
  const [scheduledAt, setScheduledAt] = useState<string | null>(editPost?.scheduled_at ?? null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'content' | 'preview'>('content');

  // Hooks
  const uploadImage = useUploadImage();
  const publishPost = usePublishPost();
  const savePost = useSavePost();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUploading = uploadImage.isPending;
  const isPublishing = publishPost.isPending || savePost.isPending;
  const hashtagCount = countHashtags(caption);
  const captionLength = caption.length;
  const postType = mediaItems.length > 1 ? 'CAROUSEL_ALBUM' : 'IMAGE';

  // "Dirty" check
  const isDirty = mediaItems.length > 0 || caption.length > 0;

  // -------------------------------------------------------
  // File upload
  // -------------------------------------------------------

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    for (const file of files) {
      if (mediaItems.length >= MAX_IMAGES) break;
      try {
        const result = await uploadImage.mutateAsync({ file, aspectRatio });
        const newItem: MediaItem = { path: result.path, publicUrl: result.publicUrl, altText: '' };
        setMediaItems(prev => {
          const updated = [...prev, newItem];
          setSelectedIndex(updated.length - 1);
          return updated;
        });
      } catch {
        // Error toasted by the hook
      }
    }
  }

  function triggerFileInput() { fileInputRef.current?.click(); }

  function removeItem(index: number) {
    setMediaItems(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (selectedIndex >= updated.length) setSelectedIndex(Math.max(0, updated.length - 1));
      return updated;
    });
  }

  function updateAltText(index: number, alt: string) {
    setMediaItems(prev => prev.map((item, i) => i === index ? { ...item, altText: alt } : item));
  }

  // -------------------------------------------------------
  // Validation
  // -------------------------------------------------------

  // Validation hint — uses effect for Date.now() to avoid impure render
  const [scheduleTimeError, setScheduleTimeError] = useState<string | null>(null);
  useEffect(() => {
    if (publishWhen !== 'schedule' || !scheduledAt) { setScheduleTimeError(null); return; }
    function check() {
      const diff = new Date(scheduledAt!).getTime() - Date.now();
      if (diff < 5 * 60 * 1000) setScheduleTimeError('La hora debe ser al menos 5 min en el futuro');
      else if (diff > 180 * 24 * 60 * 60 * 1000) setScheduleTimeError('Máximo 6 meses adelante');
      else setScheduleTimeError(null);
    }
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [publishWhen, scheduledAt]);

  const validationHint: string | null =
    mediaItems.length === 0 ? 'Sube una foto para continuar'
    : captionLength > MAX_CAPTION ? `La descripción supera los ${MAX_CAPTION.toLocaleString('es')} caracteres`
    : hashtagCount > MAX_HASHTAGS ? `Máximo ${MAX_HASHTAGS} hashtags`
    : publishWhen === 'schedule' && !scheduledAt ? 'Elige fecha y hora'
    : scheduleTimeError;
  const canSubmit = !validationHint && !isPublishing && !isUploading;

  // -------------------------------------------------------
  // Submit
  // -------------------------------------------------------

  async function handleSubmit() {
    setPublishError(null);
    if (validationHint) return;
    const media = mediaItems.map(m => ({ publicUrl: m.publicUrl, altText: m.altText }));
    try {
      if (publishWhen === 'now') {
        await publishPost.mutateAsync({ type: postType, caption, media });
      } else {
        await savePost.mutateAsync({
          id: editPost?.id,
          type: postType,
          caption,
          media,
          aspect_ratio: aspectRatio,
          status: 'scheduled',
          scheduled_at: scheduledAt!,
        });
      }
      forceClose();
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Error. Intenta de nuevo.');
    }
  }

  async function handleSaveDraft() {
    if (mediaItems.length === 0) return;
    const media = mediaItems.map(m => ({ publicUrl: m.publicUrl, altText: m.altText }));
    try {
      await savePost.mutateAsync({
        id: editPost?.id,
        type: postType,
        caption,
        media,
        aspect_ratio: aspectRatio,
        status: 'draft',
      });
      forceClose();
    } catch {
      // toasted by hook
    }
  }

  // -------------------------------------------------------
  // Close / Discard
  // -------------------------------------------------------

  function handleCloseAttempt() {
    if (isPublishing || isUploading) return;
    if (isDirty && !editPost) {
      setDiscardOpen(true);
    } else {
      forceClose();
    }
  }

  const forceClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(() => {
      setMediaItems([]);
      setCaption('');
      setAspectRatio('4:5');
      setSelectedIndex(0);
      setPublishWhen('now');
      setScheduledAt(null);
      setPublishError(null);
      setMobileTab('content');
    }, 300);
  }, [onOpenChange]);

  // -------------------------------------------------------
  // Primary button label
  // -------------------------------------------------------

  const primaryLabel = isPublishing
    ? 'Publicando…'
    : publishWhen === 'now'
      ? 'Publicar ahora'
      : 'Programar publicación';

  // -------------------------------------------------------
  // Content column
  // -------------------------------------------------------

  const contentColumn = (
    <div className="min-w-0 space-y-5">
      {/* 1. Fotos */}
      <div className="space-y-2">
        <SectionTitle n={1}>Fotos</SectionTitle>
        <DropZone
          items={mediaItems}
          isUploading={isUploading}
          onClickUpload={triggerFileInput}
          onRemove={removeItem}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          aspectRatio={aspectRatio}
        />
        {/* Alt text for selected image */}
        {mediaItems.length > 0 && (
          <Input
            placeholder="Texto alternativo (opcional, para accesibilidad)"
            value={mediaItems[selectedIndex]?.altText ?? ''}
            onChange={(e) => updateAltText(selectedIndex, e.target.value)}
            className="text-sm"
            aria-label="Texto alternativo de la imagen seleccionada"
          />
        )}
      </div>

      {/* 2. Formato */}
      <div className="space-y-2">
        <SectionTitle n={2}>Formato</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {ASPECT_RATIOS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={mediaItems.length === 0}
                onClick={() => setAspectRatio(opt.value)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-[10px] border px-2 py-2.5 text-xs font-medium transition-colors',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  aspectRatio === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{opt.label}</span>
                {opt.recommended && (
                  <span className="text-[9px] text-primary/70">recomendado</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Descripción */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <SectionTitle n={3}>Descripción</SectionTitle>
          <Popover>
            <PopoverTrigger
              type="button"
              aria-label="Insertar emoji"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Smile className="h-4 w-4" />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="end">
              <div className="grid grid-cols-5 gap-1">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setCaption(prev => prev + emoji)}
                    className="rounded p-1.5 text-lg transition-colors hover:bg-muted"
                    aria-label={`Insertar ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Textarea
          placeholder="Escribe tu descripción aquí…"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={5}
          className={cn(
            'min-h-[120px] max-h-[240px] resize-none text-sm',
            captionLength > MAX_CAPTION && 'border-destructive focus-visible:ring-destructive',
          )}
          aria-label="Descripción del post"
        />

        <div className="flex justify-end gap-2 text-xs tabular-nums">
          <span className={cn(
            'text-muted-foreground',
            hashtagCount > MAX_HASHTAGS * 0.9 && hashtagCount <= MAX_HASHTAGS && 'text-amber-600 dark:text-amber-500',
            hashtagCount > MAX_HASHTAGS && 'text-destructive font-medium',
          )}>
            {hashtagCount}/{MAX_HASHTAGS} hashtags
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className={cn(
            'text-muted-foreground',
            captionLength > MAX_CAPTION * 0.9 && captionLength <= MAX_CAPTION && 'text-amber-600 dark:text-amber-500',
            captionLength > MAX_CAPTION && 'text-destructive font-medium',
          )}>
            {captionLength.toLocaleString('es')}/{MAX_CAPTION.toLocaleString('es')}
          </span>
        </div>
      </div>

      {/* 4. Cuándo publicar */}
      <div className="space-y-2">
        <SectionTitle n={4}>Cuándo publicar</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'now' as const, label: 'Ahora', icon: Send, desc: 'Publicar inmediatamente' },
            { value: 'schedule' as const, label: 'Programar', icon: CalendarClock, desc: 'Elegir fecha y hora' },
          ]).map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPublishWhen(opt.value)}
                className={cn(
                  'flex items-start gap-2.5 rounded-[10px] border px-3 py-2.5 text-left transition-colors',
                  publishWhen === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground',
                )}
              >
                <div className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                  publishWhen === opt.value ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                )}>
                  {publishWhen === opt.value && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
        {publishWhen === 'schedule' && (
          <div className="rounded-[10px] border bg-muted/30 p-3">
            <SchedulePicker value={scheduledAt} onChange={setScheduledAt} timezone={timezone} />
          </div>
        )}
      </div>
    </div>
  );

  // -------------------------------------------------------
  // Preview column
  // -------------------------------------------------------

  const previewColumn = (
    <div className="min-w-0">
      <PreviewPanel
        username={connection.username}
        profilePictureUrl={connection.profile_picture_url}
        mediaItems={mediaItems}
        caption={caption}
        aspectRatio={aspectRatio}
      />
    </div>
  );

  // -------------------------------------------------------
  // Header
  // -------------------------------------------------------

  const headerContent = (
    <div className="flex items-center justify-between">
      <h2 className="text-base font-semibold">Nuevo post</h2>
      <div className="flex items-center gap-2">
        {/* Account chip */}
        <div className="flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1">
          {connection.profile_picture_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={connection.profile_picture_url} alt="" className="h-4 w-4 rounded-full object-cover" />
          ) : (
            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400">
              <ImageIcon className="h-2 w-2 text-white" />
            </div>
          )}
          <span className="text-[11px] font-medium text-muted-foreground">@{connection.username}</span>
        </div>
      </div>
    </div>
  );

  // -------------------------------------------------------
  // Footer
  // -------------------------------------------------------

  const footerContent = (
    <div className="space-y-1.5">
      {(publishError) && (
        <p className="text-xs text-destructive">{publishError}</p>
      )}
      <DialogFooterBar
        secondary={
          <button
            type="button"
            disabled={mediaItems.length === 0 || isPublishing}
            onClick={handleSaveDraft}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            Guardar borrador
          </button>
        }
        primary={
          <div className="flex items-center gap-2">
            {validationHint && !isPublishing && (
              <span className="hidden text-xs text-muted-foreground sm:inline">{validationHint}</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseAttempt}
              disabled={isPublishing}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {isPublishing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {primaryLabel}
            </Button>
          </div>
        }
      />
    </div>
  );

  // -------------------------------------------------------
  // Render — Mobile (Sheet) or Desktop (Dialog)
  // -------------------------------------------------------

  const hiddenInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept={ACCEPTED_IMAGE_TYPES}
      multiple
      className="hidden"
      onChange={handleFileSelect}
    />
  );

  if (isMobile) {
    return (
      <>
        {hiddenInput}
        <DiscardDialog
          open={discardOpen}
          onDiscard={forceClose}
          onDraft={() => { handleSaveDraft(); setDiscardOpen(false); }}
          onCancel={() => setDiscardOpen(false)}
        />
        <Sheet open={open} onOpenChange={(v) => { if (!v) handleCloseAttempt(); }}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="flex max-h-[100dvh] flex-col gap-0 rounded-t-2xl p-0"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 border-b bg-popover px-4 py-3">
              <div className="flex items-center justify-between">
                {headerContent}
                <SheetClose
                  render={<Button variant="ghost" size="icon-sm" className="shrink-0 ml-2" aria-label="Cerrar" />}
                >
                  <X className="h-4 w-4" />
                </SheetClose>
              </div>
              {/* Mobile tabs */}
              <div className="mt-2 flex gap-1 rounded-lg border bg-muted/50 p-0.5">
                {(['content', 'preview'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setMobileTab(tab)}
                    className={cn(
                      'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                      mobileTab === tab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
                    )}
                  >
                    {tab === 'content' ? 'Contenido' : 'Vista previa'}
                  </button>
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-4">
              {mobileTab === 'content' ? contentColumn : previewColumn}
            </div>

            {/* Footer */}
            <div
              className="sticky bottom-0 border-t bg-popover px-4 py-3"
              style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}
            >
              {footerContent}
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // Desktop / Tablet
  return (
    <>
      {hiddenInput}
      <DiscardDialog
        open={discardOpen}
        onDiscard={forceClose}
        onDraft={() => { handleSaveDraft(); setDiscardOpen(false); }}
        onCancel={() => setDiscardOpen(false)}
      />
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleCloseAttempt(); }}>
        <DialogContent
          showCloseButton
          className="flex max-h-[90vh] w-[94vw] sm:max-w-[1000px] flex-col gap-0 p-0"
        >
          {/* Header */}
          <div className="shrink-0 border-b px-5 py-3">
            {headerContent}
          </div>

          {/* Body — two columns on desktop, single on tablet */}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Left: content */}
            <div className="flex-[58] overflow-y-auto border-r px-5 py-4">
              {contentColumn}
            </div>
            {/* Right: preview — hidden on narrow screens, shown as sticky */}
            <div className="hidden flex-[42] overflow-y-auto px-5 py-4 lg:block">
              <p className="mb-3 text-xs font-semibold text-muted-foreground">Vista previa</p>
              {previewColumn}
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t bg-muted/50 px-5 py-3">
            {footerContent}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
