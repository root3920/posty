'use client';

import { useState, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { parseRoomNumbers, type ParsedRoom } from '@/lib/room-number-parser';
import { X } from 'lucide-react';

interface RoomNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  existingNumbers?: Set<string>;
  parsedRooms: ParsedRoom[];
  onParsedChange: (rooms: ParsedRoom[]) => void;
}

export function RoomNumberInput({
  value,
  onChange,
  existingNumbers,
  parsedRooms,
  onParsedChange,
}: RoomNumberInputProps) {
  const result = useMemo(
    () => parseRoomNumbers(value, existingNumbers),
    [value, existingNumbers],
  );

  // Sync parsed rooms up
  const prevCount = parsedRooms.length;
  if (result.rooms.length !== prevCount) {
    // Use a microtask to avoid setState during render
    queueMicrotask(() => onParsedChange(result.rooms));
  }

  const removeRoom = useCallback(
    (num: string) => {
      // Remove from the input string
      const segments = value.split(',').map((s) => s.trim()).filter(Boolean);
      const filtered = segments.filter((seg) => {
        if (seg.includes('-')) return true; // Keep ranges, user can edit manually
        return parseInt(seg, 10).toString() !== num;
      });
      onChange(filtered.join(', '));
    },
    [value, onChange],
  );

  return (
    <div className="space-y-2">
      <Label className="text-xs">Números de habitación *</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="101-110, 205, 509, 1911"
      />
      <p className="text-[11px] text-muted-foreground">
        Usa guion para rangos y coma para separar
      </p>

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="space-y-0.5">
          {result.errors.map((err, i) => (
            <p key={i} className="text-xs text-destructive">{err}</p>
          ))}
        </div>
      )}

      {/* Preview chips */}
      {result.rooms.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium">
            {result.rooms.length} habitación{result.rooms.length !== 1 ? 'es' : ''}
          </p>
          <div className="flex flex-wrap gap-1">
            {result.rooms.map((r) => (
              <Badge key={r.number} variant="secondary" className="gap-1 pr-1 text-xs">
                {r.number}
                <span className="text-[9px] text-muted-foreground">P{r.floor}</span>
                <button
                  type="button"
                  onClick={() => removeRoom(r.number)}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
