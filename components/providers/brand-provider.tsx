'use client';

import { useEffect, useRef } from 'react';
import { useProfile } from '@/hooks/use-profile';
import { generateBrandPalette, POSTY_DEFAULT_COLOR } from '@/lib/brand-colors';

/**
 * Injects brand color CSS variables into the document.
 * Reads brand_color from the user's organization profile and
 * applies the generated palette as CSS custom properties on <html>.
 *
 * Updates instantly when brand_color changes (no reload needed).
 * Falls back to POSTY default if no color is set.
 */
export function BrandProvider() {
  const { data: profile } = useProfile();
  const lastColor = useRef<string | null>(null);

  const brandColor = profile?.organization?.brand_color || POSTY_DEFAULT_COLOR;

  useEffect(() => {
    // Skip if color hasn't changed
    if (brandColor === lastColor.current) return;
    lastColor.current = brandColor;

    const palette = generateBrandPalette(brandColor);
    const root = document.documentElement;

    for (const [key, value] of Object.entries(palette)) {
      root.style.setProperty(key, value);
    }
  }, [brandColor]);

  return null;
}
