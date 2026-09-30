'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock } from 'lucide-react';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface AuditLogEntry {
  id: string;
  action: string;
  actor_name: string | null;
  created_at: string;
  reason: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
}

// -------------------------------------------------------
// Action label map
// -------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  create: 'Creado',
  update: 'Editado',
  merge_guest: 'Fusionado',
  change_titular: 'Titular cambiado',
  convert_modality: 'Modalidad cambiada',
};

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

// -------------------------------------------------------
// Diff renderer
// -------------------------------------------------------

function DiffView({
  before,
  after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  if (!before && !after) return null;

  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);

  const changed: { key: string; prev: string; next: string }[] = [];
  for (const key of keys) {
    const prev = (before ?? {})[key];
    const next = (after ?? {})[key];
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      changed.push({
        key,
        prev: prev != null ? String(prev) : '—',
        next: next != null ? String(next) : '—',
      });
    }
  }

  if (changed.length === 0) return null;

  return (
    <div className="mt-1.5 space-y-0.5">
      {changed.map(({ key, prev, next }) => (
        <p key={key} className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/70">{key}:</span>{' '}
          <span className="line-through">{prev}</span>
          {' → '}
          <span>{next}</span>
        </p>
      ))}
    </div>
  );
}

// -------------------------------------------------------
// Hook
// -------------------------------------------------------

function useAuditLog(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ['audit_log', entityType, entityId],
    queryFn: async () => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_audit_log', {
        p_entity_type: entityType,
        p_entity_id: entityId,
      });
      if (error) throw error;
      return (data ?? []) as AuditLogEntry[];
    },
    enabled: !!entityType && !!entityId,
    staleTime: 30_000,
  });
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function AuditLogTimeline({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const { data: entries = [], isLoading } = useAuditLog(entityType, entityId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Sin cambios registrados</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-3.5 top-4 bottom-4 w-px bg-border" aria-hidden />

      {entries.map((entry, idx) => (
        <div key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
          {/* Dot */}
          <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-card text-[10px] font-bold text-muted-foreground">
            {(idx + 1)}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{getActionLabel(entry.action)}</span>
              {entry.actor_name && (
                <span className="text-xs text-muted-foreground">por {entry.actor_name}</span>
              )}
              <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                {format(new Date(entry.created_at), "d MMM · HH:mm", { locale: es })}
              </span>
            </div>

            {entry.reason && (
              <p className="mt-0.5 text-xs text-muted-foreground italic">&ldquo;{entry.reason}&rdquo;</p>
            )}

            <DiffView before={entry.before_data} after={entry.after_data} />
          </div>
        </div>
      ))}
    </div>
  );
}
