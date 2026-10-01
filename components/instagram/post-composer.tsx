'use client';

import { useRef, useState } from 'react';
import {
  Loader2,
  Plus,
  X,
  Image as ImageIcon,
  Smile,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { DialogFooterBar } from '@/components/shared/dialog-footer-bar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useUploadImage, usePublishPost } from '@/hooks/use-instagram';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

type PostType = 'IMAGE' | 'CAROUSEL';
type AspectRatio = '1:1' | '4:5' | '1.91:1';

interface MediaItem {
  path: string;
  publicUrl: string;
  altText: string;
}

// -------------------------------------------------------
// Constants
// -------------------------------------------------------

const ASPECT_RATIO_OPTIONS: { value: AspectRatio; label: string; recommended?: boolean }[] = [
  { value: '4:5', label: '4:5 Vertical', recommended: true },
  { value: '1:1', label: '1:1 Cuadrado' },
  { value: '1.91:1', label: '1.91:1 Horizontal' },
];

const QUICK_EMOJIS = ['❤️', '🔥', '✨', '🏨', '☀️', '🌊', '🍽️', '🎉', '👏', '💯'];

const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/heic';

const MAX_CAPTION_LENGTH = 2200;
const MAX_HASHTAGS = 30;
const MAX_CAROUSEL_ITEMS = 10;

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function countHashtags(text: string): number {
  return (text.match(/#\w+/g) ?? []).length;
}

function aspectRatioCssClass(ratio: AspectRatio): string {
  switch (ratio) {
    case '4:5':
      return 'aspect-[4/5]';
    case '1.91:1':
      return 'aspect-[1.91/1]';
    default:
      return 'aspect-square';
  }
}

// -------------------------------------------------------
// Single image drop zone
// -------------------------------------------------------

interface SingleDropZoneProps {
  item: MediaItem | null;
  isUploading: boolean;
  onClick: () => void;
  aspectRatio: AspectRatio;
  onAltChange: (alt: string) => void;
}

function SingleDropZone({ item, isUploading, onClick, aspectRatio, onAltChange }: SingleDropZoneProps) {
  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
        className={cn(
          'relative w-full overflow-hidden rounded-xl border-2 border-dashed transition-colors cursor-pointer',
          aspectRatioCssClass(aspectRatio),
          item ? 'border-border' : 'border-muted-foreground/30 hover:border-muted-foreground/60 bg-muted/30',
        )}
      >
        {isUploading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        {item ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.publicUrl}
            alt={item.altText || 'Imagen del post'}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Arrastra una imagen o haz clic
            </p>
            <p className="text-xs text-muted-foreground/70">JPG, PNG, WEBP, HEIC</p>
          </div>
        )}
      </div>
      {item && (
        <Input
          placeholder="Texto alternativo (opcional, para accesibilidad)"
          value={item.altText}
          onChange={(e) => onAltChange(e.target.value)}
          className="text-sm"
        />
      )}
    </div>
  );
}

// -------------------------------------------------------
// Carousel slots row
// -------------------------------------------------------

interface CarouselSlotsProps {
  items: MediaItem[];
  isUploading: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onAltChange: (index: number, alt: string) => void;
  selectedIndex: number;
  onSelect: (index: number) => void;
}

function CarouselSlots({
  items,
  isUploading,
  onAdd,
  onRemove,
  onAltChange,
  selectedIndex,
  onSelect,
}: CarouselSlotsProps) {
  return (
    <div className="space-y-3">
      {/* Thumbnails row */}
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <div
            key={item.path}
            className={cn(
              'relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition-colors',
              i === selectedIndex ? 'border-primary' : 'border-transparent',
            )}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(i)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(i); }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.publicUrl} alt={`Imagen ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label="Eliminar imagen"
              onClick={(e) => { e.stopPropagation(); onRemove(i); }}
              className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}

        {/* Add more button */}
        {items.length < MAX_CAROUSEL_ITEMS && (
          <button
            type="button"
            aria-label="Agregar imagen"
            onClick={onAdd}
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground transition-colors"
          >
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Plus className="h-5 w-5" />
            )}
          </button>
        )}
      </div>

      {/* Selected image preview */}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={items[selectedIndex]?.publicUrl}
              alt={`Imagen ${selectedIndex + 1}`}
              className="h-full w-full object-cover"
            />
            {/* Dots */}
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
          </div>
          <Input
            placeholder="Texto alternativo (opcional, para accesibilidad)"
            value={items[selectedIndex]?.altText ?? ''}
            onChange={(e) => onAltChange(selectedIndex, e.target.value)}
            className="text-sm"
          />
        </div>
      )}

      {items.length === 0 && (
        <div className="flex h-32 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/30 text-sm text-muted-foreground">
          Agrega al menos 2 imágenes para el carrusel
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------
// Instagram feed preview
// -------------------------------------------------------

interface FeedPreviewProps {
  username: string;
  profilePictureUrl: string | null;
  mediaItems: MediaItem[];
  caption: string;
  aspectRatio: AspectRatio;
  postType: PostType;
}

function FeedPreview({
  username,
  profilePictureUrl,
  mediaItems,
  caption,
  aspectRatio,
  postType,
}: FeedPreviewProps) {
  const [previewIndex, setPreviewIndex] = useState(0);
  const [profileImgError, setProfileImgError] = useState(false);

  const displayCaption = caption.length > 125
    ? caption.slice(0, 125) + '...'
    : caption;

  const currentMedia = postType === 'CAROUSEL'
    ? (mediaItems[previewIndex] ?? null)
    : (mediaItems[0] ?? null);

  return (
    <div className="rounded-xl border bg-card overflow-hidden max-w-[320px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        {profilePictureUrl && !profileImgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profilePictureUrl}
            alt={username}
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

      {/* Image area */}
      <div className={cn('relative w-full overflow-hidden bg-muted', aspectRatioCssClass(aspectRatio))}>
        {currentMedia ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentMedia.publicUrl}
            alt={currentMedia.altText || 'Preview'}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}

        {/* Carousel dots */}
        {postType === 'CAROUSEL' && mediaItems.length > 1 && (
          <>
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
              {mediaItems.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Imagen ${i + 1}`}
                  onClick={() => setPreviewIndex(i)}
                  className={cn(
                    'h-1.5 w-1.5 rounded-full transition-all',
                    i === previewIndex ? 'scale-125 bg-white' : 'bg-white/50',
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Actions row */}
      <div className="flex gap-3 px-3 py-2 text-base">
        <span>❤️</span>
        <span>💬</span>
        <span>✈️</span>
      </div>

      {/* Caption */}
      <div className="px-3 pb-3">
        <p className="text-xs text-foreground leading-relaxed">
          {caption ? (
            <>
              <span className="font-semibold">@{username} </span>
              {displayCaption}
              {caption.length > 125 && (
                <span className="text-muted-foreground"> ... más</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground italic">Sin descripción...</span>
          )}
        </p>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Grid preview (small square thumbnail)
// -------------------------------------------------------

function GridPreview({ mediaItems }: { mediaItems: MediaItem[] }) {
  const thumb = mediaItems[0] ?? null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Vista en cuadrícula</p>
      <div className="h-20 w-20 overflow-hidden rounded-md border bg-muted">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb.publicUrl} alt="Grid preview" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Post Composer (main export)
// -------------------------------------------------------

interface PostComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: {
    username: string;
    profile_picture_url: string | null;
  };
}

export function PostComposer({ open, onOpenChange, connection }: PostComposerProps) {
  // State
  const [postType, setPostType] = useState<PostType>('IMAGE');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [caption, setCaption] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [carouselSelectedIndex, setCarouselSelectedIndex] = useState(0);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Hooks
  const uploadImage = useUploadImage();
  const publishPost = usePublishPost();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUploading = uploadImage.isPending;
  const isPublishing = publishPost.isPending;

  const hashtagCount = countHashtags(caption);
  const captionLength = caption.length;

  // -------------------------------------------------------
  // File upload handler
  // -------------------------------------------------------

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = '';

    try {
      const result = await uploadImage.mutateAsync({ file, aspectRatio });
      const newItem: MediaItem = { path: result.path, publicUrl: result.publicUrl, altText: '' };

      if (postType === 'IMAGE') {
        setMediaItems([newItem]);
      } else {
        setMediaItems((prev) => {
          const updated = [...prev, newItem];
          setCarouselSelectedIndex(updated.length - 1);
          return updated;
        });
      }
    } catch {
      // Error already toasted by the hook
    }
  }

  function triggerFileInput() {
    fileInputRef.current?.click();
  }

  // -------------------------------------------------------
  // Media management
  // -------------------------------------------------------

  function removeCarouselItem(index: number) {
    setMediaItems((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (carouselSelectedIndex >= updated.length) {
        setCarouselSelectedIndex(Math.max(0, updated.length - 1));
      }
      return updated;
    });
  }

  function updateAltText(index: number, alt: string) {
    setMediaItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, altText: alt } : item)),
    );
  }

  function updateSingleAlt(alt: string) {
    updateAltText(0, alt);
  }

  // -------------------------------------------------------
  // Type switch — reset media on switch
  // -------------------------------------------------------

  function switchPostType(type: PostType) {
    setPostType(type);
    setMediaItems([]);
    setCarouselSelectedIndex(0);
    setValidationErrors([]);
  }

  // -------------------------------------------------------
  // Validation
  // -------------------------------------------------------

  function validate(): boolean {
    const errors: string[] = [];
    if (mediaItems.length === 0) {
      errors.push('Debes subir al menos una imagen.');
    }
    if (postType === 'CAROUSEL' && mediaItems.length < 2) {
      errors.push('El carrusel requiere al menos 2 imágenes.');
    }
    if (captionLength > MAX_CAPTION_LENGTH) {
      errors.push(`La descripción supera los ${MAX_CAPTION_LENGTH} caracteres.`);
    }
    if (hashtagCount > MAX_HASHTAGS) {
      errors.push(`Tienes más de ${MAX_HASHTAGS} hashtags (${hashtagCount}).`);
    }
    setValidationErrors(errors);
    return errors.length === 0;
  }

  // -------------------------------------------------------
  // Publish
  // -------------------------------------------------------

  async function handlePublish() {
    setPublishError(null);
    if (!validate()) return;

    try {
      await publishPost.mutateAsync({
        type: postType,
        caption,
        media: mediaItems.map((m) => ({ publicUrl: m.publicUrl, altText: m.altText })),
      });
      // Success toast is shown by the hook
      handleClose();
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Error al publicar. Intenta de nuevo.');
    }
  }

  function handleClose() {
    if (isPublishing || isUploading) return;
    onOpenChange(false);
    // Reset state after close animation
    setTimeout(() => {
      setPostType('IMAGE');
      setMediaItems([]);
      setCaption('');
      setAspectRatio('1:1');
      setCarouselSelectedIndex(0);
      setPublishError(null);
      setValidationErrors([]);
    }, 300);
  }

  // -------------------------------------------------------
  // Footer
  // -------------------------------------------------------

  const footer = (
    <DialogFooterBar
      summary={
        (validationErrors.length > 0 || publishError) ? (
          <div className="w-full space-y-0.5">
            {validationErrors.map((err) => (
              <p key={err} className="text-xs text-destructive">{err}</p>
            ))}
            {publishError && (
              <p className="text-xs text-destructive">{publishError}</p>
            )}
          </div>
        ) : undefined
      }
      secondary={
        <Button
          variant="outline"
          size="sm"
          disabled
        >
          Guardar borrador
        </Button>
      }
      primary={
        <Button
          size="sm"
          onClick={handlePublish}
          disabled={isPublishing || isUploading}
        >
          {isPublishing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Publicar ahora
        </Button>
      }
    />
  );

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        className="hidden"
        onChange={handleFileSelect}
      />

      <ResponsiveDialog
        open={open}
        onOpenChange={handleClose}
        title="Nuevo post de Instagram"
        description="Crea y publica una nueva publicación en tu cuenta conectada"
        size="lg"
        footer={footer}
      >
        {/* Two-column layout on desktop */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* ---------------------------------------- */}
          {/* LEFT: Content */}
          {/* ---------------------------------------- */}
          <div className="min-w-0 space-y-4">
            {/* Post type selector */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Tipo de publicación</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={postType === 'IMAGE' ? 'default' : 'outline'}
                  onClick={() => switchPostType('IMAGE')}
                >
                  Imagen
                </Button>
                <Button
                  size="sm"
                  variant={postType === 'CAROUSEL' ? 'default' : 'outline'}
                  onClick={() => switchPostType('CAROUSEL')}
                >
                  Carrusel
                </Button>
              </div>
            </div>

            {/* Image upload */}
            {postType === 'IMAGE' ? (
              <SingleDropZone
                item={mediaItems[0] ?? null}
                isUploading={isUploading}
                onClick={triggerFileInput}
                aspectRatio={aspectRatio}
                onAltChange={updateSingleAlt}
              />
            ) : (
              <CarouselSlots
                items={mediaItems}
                isUploading={isUploading}
                onAdd={triggerFileInput}
                onRemove={removeCarouselItem}
                onAltChange={updateAltText}
                selectedIndex={carouselSelectedIndex}
                onSelect={setCarouselSelectedIndex}
              />
            )}

            {/* Aspect ratio (only when image loaded or always for IMAGE type) */}
            {postType === 'IMAGE' && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Relación de aspecto</p>
                <div className="flex flex-wrap gap-1.5">
                  {ASPECT_RATIO_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAspectRatio(opt.value)}
                      className={cn(
                        'relative rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                        aspectRatio === opt.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground',
                      )}
                    >
                      {opt.label}
                      {opt.recommended && (
                        <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] text-primary">
                          recomendado
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Caption editor */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Descripción</p>
                {/* Emoji picker */}
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
                          onClick={() => setCaption((prev) => prev + emoji)}
                          className="rounded p-1.5 text-lg hover:bg-muted transition-colors"
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
                placeholder="Escribe tu descripción aquí..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={5}
                className={cn(
                  'resize-none text-sm',
                  captionLength > MAX_CAPTION_LENGTH && 'border-destructive focus-visible:ring-destructive',
                )}
              />

              {/* Counters */}
              <div className="flex justify-between text-xs">
                <span className={cn('text-muted-foreground', hashtagCount > MAX_HASHTAGS && 'text-destructive')}>
                  {hashtagCount} / {MAX_HASHTAGS} hashtags
                </span>
                <span className={cn('tabular-nums text-muted-foreground', captionLength > MAX_CAPTION_LENGTH && 'text-destructive')}>
                  {captionLength.toLocaleString('es')} / {MAX_CAPTION_LENGTH.toLocaleString('es')}
                </span>
              </div>
            </div>
          </div>

          {/* ---------------------------------------- */}
          {/* RIGHT: Preview */}
          {/* ---------------------------------------- */}
          <div className="min-w-0 space-y-4">
            <p className="text-xs font-medium text-muted-foreground">Vista previa</p>

            <FeedPreview
              username={connection.username}
              profilePictureUrl={connection.profile_picture_url}
              mediaItems={mediaItems}
              caption={caption}
              aspectRatio={aspectRatio}
              postType={postType}
            />

            <GridPreview mediaItems={mediaItems} />
          </div>
        </div>
      </ResponsiveDialog>
    </>
  );
}
