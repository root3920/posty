'use client';

import Image from 'next/image';
import { useTheme } from 'next-themes';

interface PostyLogoProps {
  variant?: 'auto' | 'white' | 'black';
  withText?: boolean;
  size?: number;
  className?: string;
}

export function PostyLogo({ variant = 'auto', withText = false, size = 32, className = '' }: PostyLogoProps) {
  const { resolvedTheme } = useTheme();

  const useWhite =
    variant === 'white' ||
    (variant === 'auto' && resolvedTheme === 'dark');

  const src = useWhite
    ? '/brand/posty-cat-white.png'
    : '/brand/posty-cat-black.png';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Image
        src={src}
        alt="POSTY"
        width={size}
        height={size}
        className="shrink-0 object-contain"
        priority
      />
      {withText && (
        <span
          className="font-heading text-lg font-bold tracking-tight"
          style={{ color: useWhite ? '#ffffff' : 'var(--foreground)' }}
        >
          POSTY
        </span>
      )}
    </div>
  );
}
