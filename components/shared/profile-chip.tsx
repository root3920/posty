'use client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ProfileChipProps {
  fullName: string;
  avatarUrl?: string | null;
  className?: string;
  size?: 'sm' | 'md';
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

export function ProfileChip({ fullName, avatarUrl, className, size = 'sm' }: ProfileChipProps) {
  const avatarSize = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
      <Avatar className={avatarSize}>
        {avatarUrl && <AvatarImage src={avatarUrl} />}
        <AvatarFallback className="text-[9px]">{getInitials(fullName)}</AvatarFallback>
      </Avatar>
      <span className={textSize}>{fullName}</span>
    </span>
  );
}
