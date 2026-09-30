'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { User, BedDouble, Calendar, ClipboardList, Plus, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';
import { formatDateOnly } from '@/lib/dates';
import { useOrganization } from '@/hooks/use-organization';

interface GuestContextPanelProps {
  guestId: string | null;
  contactPhone: string;
  contactName: string | null;
}

function useGuestContext(guestId: string | null) {
  return useQuery({
    queryKey: ['guest_context', guestId],
    queryFn: async () => {
      if (!guestId) return null;
      const supabase = createClient();

      // Fetch guest + active stay + tasks
      const [guestRes, staysRes, tasksRes] = await Promise.all([
        supabase.from('guests').select('*, document_type:document_types(code)').eq('id', guestId).single(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('stays_view').select('*').eq('primary_guest_id', guestId).in('status', ['reserved', 'checked_in']).order('check_in_date', { ascending: false }).limit(3),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('tasks_view').select('id, title, status_name, due_date, priority').eq('stay_id', guestId).in('status_type', ['open', 'in_progress']).order('due_date', { ascending: true }).limit(5),
      ]);

      return {
        guest: guestRes.data,
        stays: staysRes.data ?? [],
        tasks: tasksRes.data ?? [],
      };
    },
    enabled: !!guestId,
    staleTime: 30_000,
  });
}

export function GuestContextPanel({ guestId, contactPhone, contactName }: GuestContextPanelProps) {
  const { currency, locale } = useOrganization();
  const { data, isLoading } = useGuestContext(guestId);

  if (!guestId) {
    // Not linked to a guest
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm text-muted-foreground">
        <User className="h-10 w-10 opacity-30" />
        <p>Este contacto no está vinculado a un huésped</p>
        <div className="flex flex-col gap-2">
          <Link href={`/hotel/huespedes?search=${encodeURIComponent(contactPhone)}`}>
            <Button variant="outline" size="sm" className="w-full text-xs">
              Vincular a un huésped
            </Button>
          </Link>
          <Link href={`/hotel/huespedes?new=1&phone=${encodeURIComponent(contactPhone)}&name=${encodeURIComponent(contactName ?? '')}`}>
            <Button variant="outline" size="sm" className="w-full text-xs">
              <Plus className="mr-1 h-3 w-3" />
              Crear huésped
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const guest = data?.guest;
  const stays = data?.stays ?? [];
  const tasks = data?.tasks ?? [];

  if (!guest) return null;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Guest info */}
      <div className="border-b p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{guest.first_name} {guest.last_name}</p>
            {guest.document_number && (
              <p className="text-xs text-muted-foreground">
                {guest.document_type?.code ?? ''} {guest.document_number}
              </p>
            )}
          </div>
        </div>
        <div className="mt-2">
          <Link href={`/hotel/huespedes/${guest.id}`} className="text-xs text-primary hover:underline">
            Ver ficha completa →
          </Link>
        </div>
      </div>

      {/* Active stays */}
      {stays.length > 0 && (
        <div className="border-b p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Estancias activas
          </p>
          <div className="space-y-2">
            {stays.map((stay: Record<string, unknown>) => (
              <Link
                key={stay.id as string}
                href={`/hotel/reservas/${stay.id}`}
                className="block rounded-lg border p-2.5 text-xs hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-muted-foreground">{stay.code as string}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {stay.status === 'checked_in' ? 'Hospedado' : 'Reservado'}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                  <BedDouble className="h-3 w-3" />
                  <span>Hab. {stay.room_number as string}</span>
                  <Calendar className="h-3 w-3 ml-1" />
                  <span>{formatDateOnly(stay.check_in_date as string)} – {formatDateOnly(stay.check_out_date as string)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Open tasks */}
      {tasks.length > 0 && (
        <div className="border-b p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tareas abiertas
          </p>
          <div className="space-y-1.5">
            {tasks.map((task: Record<string, unknown>) => (
              <div key={task.id as string} className="flex items-center gap-2 text-xs">
                <ClipboardList className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{task.title as string}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Acciones rápidas
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Link href="/hotel/reservas?new=1">
            <Button variant="outline" size="xs" className="text-[10px]">
              <Plus className="mr-0.5 h-2.5 w-2.5" />
              Reserva
            </Button>
          </Link>
          <Link href="/tareas?new=1">
            <Button variant="outline" size="xs" className="text-[10px]">
              <Plus className="mr-0.5 h-2.5 w-2.5" />
              Tarea
            </Button>
          </Link>
          <Link href="/limpieza">
            <Button variant="outline" size="xs" className="text-[10px]">
              <Sparkles className="mr-0.5 h-2.5 w-2.5" />
              Limpieza
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
