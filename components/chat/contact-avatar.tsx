'use client';

import { useState } from 'react';
import { User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

// -------------------------------------------------------
// ContactAvatar — unified avatar for all chat views
// -------------------------------------------------------

interface ContactAvatarProps {
  /** Contact display name (for initials fallback) */
  name: string | null;
  /** Signed avatar URL (from useAvatarUrls hook) */
  avatarUrl: string | null | undefined;
  /** Whether this is a group chat */
  isGroup?: boolean;
  /** Whether this is a LID contact (hidden number) */
  isLid?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class names */
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
} as const;

const ICON_SIZES = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
} as const;

export function ContactAvatar({
  name,
  avatarUrl,
  isGroup = false,
  isLid = false,
  size = 'md',
  className,
}: ContactAvatarProps) {
  const [imgError, setImgError] = useState(false);

  // Compute initials for fallback
  const initial = name && name.replace(/[\s.·\-_]/g, '').length > 0
    ? name.charAt(0).toUpperCase()
    : isLid ? '?' : '#';

  const showImage = avatarUrl && !imgError;

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full',
        showImage ? '' : 'bg-primary/15 font-semibold text-primary',
        SIZE_CLASSES[size],
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name ?? 'Contacto'}
          loading="lazy"
          className={cn('rounded-full object-cover', SIZE_CLASSES[size])}
          onError={() => setImgError(true)}
        />
      ) : isGroup ? (
        <Users className={ICON_SIZES[size]} />
      ) : initial === '?' || initial === '#' ? (
        <User className={ICON_SIZES[size]} />
      ) : (
        initial
      )}
    </div>
  );
}
