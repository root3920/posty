'use client';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type StayBadge as StayBadgeType, BADGE_STYLES } from '@/lib/stays/badges';

interface StayBadgeProps {
  badge: StayBadgeType | null;
}

export function StayBadge({ badge }: StayBadgeProps) {
  if (!badge) return null;

  const element = (
    <Badge variant="outline" className={`text-[10px] ${BADGE_STYLES[badge.variant]}`}>
      {badge.label}
    </Badge>
  );

  if (badge.tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span />}>{element}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs">{badge.tooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return element;
}
