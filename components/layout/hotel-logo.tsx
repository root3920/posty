'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useProfile } from '@/hooks/use-profile';
import { cn } from '@/lib/utils';

interface HotelLogoProps {
  /** Size of the cat fallback */
  catSize?: number;
  /** Whether to show "POSTY" text */
  withText?: boolean;
  /** Whether we're on a dark/wine background (sidebar) */
  onDark?: boolean;
  /** Whether the sidebar is collapsed (icon-only mode) */
  collapsed?: boolean;
}

/**
 * Renders the hotel logo if available, with POSTY branding.
 *
 * With hotel logo:  [LOGO] | POSTY
 * Without:          [CAT]  POSTY
 *
 * Collapsed: just [LOGO] or [CAT], no text.
 */
export function HotelLogo({ catSize = 30, withText = true, onDark = true, collapsed = false }: HotelLogoProps) {
  const { data: profile } = useProfile();
  const [imgError, setImgError] = useState(false);

  const logoUrl = profile?.organization?.logo_url;
  const hotelName = profile?.organization?.name ?? 'Hotel';
  const hasLogo = logoUrl && !imgError;

  const textClass = onDark ? 'text-white' : 'text-foreground';

  return (
    <div className="flex items-center gap-2.5">
      {hasLogo ? (
        <>
          {/* Hotel logo in a white box for contrast on wine background */}
          <div
            className={cn(
              'flex shrink-0 items-center justify-center rounded-lg p-1',
              onDark ? 'bg-white' : 'bg-muted',
            )}
            style={{ width: catSize + 6, height: catSize + 6 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={`Logo de ${hotelName}`}
              className="h-full w-full object-contain"
              style={{ maxWidth: catSize, maxHeight: catSize }}
              onError={() => setImgError(true)}
            />
          </div>

          {/* Separator + POSTY (when expanded) */}
          {withText && !collapsed && (
            <>
              <div
                className="h-6 w-px shrink-0"
                style={{ backgroundColor: onDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)' }}
              />
              <span className={cn('font-heading text-[17px] font-bold tracking-tight', textClass)}>
                POSTY
              </span>
            </>
          )}
        </>
      ) : (
        <>
          {/* Default: cat logo — theme-aware when not on dark background */}
          {onDark ? (
            <Image
              src="/brand/posty-cat-white.png"
              alt="POSTY"
              width={catSize}
              height={catSize}
              className="shrink-0"
              priority
            />
          ) : (
            <>
              <Image
                src="/brand/posty-cat-black.png"
                alt="POSTY"
                width={catSize}
                height={catSize}
                className="shrink-0 dark:hidden"
                priority
              />
              <Image
                src="/brand/posty-cat-white.png"
                alt="POSTY"
                width={catSize}
                height={catSize}
                className="hidden shrink-0 dark:block"
                priority
              />
            </>
          )}
          {withText && !collapsed && (
            <span className={cn('font-heading text-[17px] font-bold tracking-tight', textClass)}>
              POSTY
            </span>
          )}
        </>
      )}
    </div>
  );
}
