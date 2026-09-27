'use client';
import { BedDouble } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface RoomBadgeProps {
  number: string;
  typeName?: string;
  floor?: string;
  className?: string;
}

export function RoomBadge({ number, typeName, floor, className }: RoomBadgeProps) {
  const badge = (
    <span className={`inline-flex items-center gap-1 rounded-[10px] bg-muted px-2 py-0.5 text-xs font-medium ${className ?? ''}`}>
      <BedDouble className="h-3 w-3 shrink-0" />
      Hab. {number}
    </span>
  );

  if (typeName || floor) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span />}>{badge}</TooltipTrigger>
        <TooltipContent side="top">
          {typeName && <span>{typeName}</span>}
          {floor && <span> · Piso {floor}</span>}
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}
