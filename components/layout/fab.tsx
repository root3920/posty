import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FabProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  className?: string;
}

export function Fab({ icon: Icon, label, onClick, className }: FabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        // Only show on mobile
        'md:hidden',
        // Positioning: fixed bottom-right, above safe-area-bottom
        'fixed bottom-4 right-4 z-30',
        'safe-bottom',
        // Size and shape
        'flex h-14 w-14 items-center justify-center rounded-full',
        // Brand colors
        'bg-primary text-primary-foreground',
        // Shadow
        'shadow-brand',
        // Hover/active states
        'transition-all duration-150 hover:shadow-brand-hover active:scale-95',
        // Touch target already satisfied by 56px
        className,
      )}
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <Icon className="h-6 w-6" />
    </button>
  );
}
