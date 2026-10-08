'use client';

import Link from 'next/link';
import { User, BedDouble, Calendar, Mail, Link2, UserPlus, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateOnly } from '@/lib/dates';
import { useLinkGuestToThread } from '@/hooks/use-email-inbox';

interface EmailGuestPanelProps {
  guestId: string | null;
  threadId: string;
  senderAddress: string | null;
}

function useGuestContext(guestId: string | null) {
  return useQuery({
    queryKey: ['guest_context', guestId],
    queryFn: async () => {
      if (!guestId) return null;
      const supabase = createClient();

      const [guestRes, staysRes] = await Promise.all([
        supabase
          .from('guests')
          .select('id, first_name, last_name, email, phone')
          .eq('id', guestId)
          .single(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from('stays_view')
          .select('id, code, status, check_in_date, check_out_date, room_name')
          .eq('primary_guest_id', guestId)
          .in('status', ['reserved', 'checked_in'])
          .order('check_in_date', { ascending: false })
          .limit(3),
      ]);

      return {
        guest: guestRes.data,
        stays: staysRes.data ?? [],
      };
    },
    enabled: !!guestId,
    staleTime: 30_000,
  });
}

function useGuestSearch(email: string | null) {
  return useQuery({
    queryKey: ['guest_by_email', email],
    queryFn: async () => {
      if (!email) return [];
      const supabase = createClient();
      const { data } = await supabase
        .from('guests')
        .select('id, first_name, last_name, email')
        .ilike('email', email.toLowerCase())
        .is('archived_at', null)
        .limit(5);
      return data ?? [];
    },
    enabled: !!email && email.includes('@'),
    staleTime: 60_000,
  });
}

export function EmailGuestPanel({ guestId, threadId, senderAddress }: EmailGuestPanelProps) {
  const { data, isLoading } = useGuestContext(guestId);
  const { data: suggestedGuests = [] } = useGuestSearch(!guestId ? senderAddress : null);
  const linkGuest = useLinkGuestToThread();

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    );
  }

  // No guest linked — show link suggestions
  if (!guestId || !data?.guest) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Huésped</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Este hilo no está vinculado a ningún huésped
            </p>

            {/* Suggest guests matching the sender email */}
            {suggestedGuests.length > 0 && (
              <div className="w-full space-y-2 pt-2">
                <p className="text-xs font-medium text-muted-foreground">Sugerencias:</p>
                {suggestedGuests.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => linkGuest.mutate({ threadId, guestId: g.id })}
                    className="flex w-full items-center gap-2 rounded-lg border p-2.5 text-left text-xs transition-colors hover:bg-muted/50"
                  >
                    <UserPlus className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="font-medium">{g.first_name} {g.last_name}</p>
                      <p className="truncate text-muted-foreground">{g.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const { guest, stays } = data;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Huésped</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Guest card */}
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {guest.first_name} {guest.last_name}
              </p>
              {guest.email && (
                <p className="truncate text-xs text-muted-foreground">{guest.email}</p>
              )}
            </div>
          </div>
          <Link
            href={`/hotel/huespedes/${guest.id}`}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            Ver ficha completa
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {/* Active stays */}
        {stays.length > 0 && (
          <div className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <BedDouble className="h-3.5 w-3.5" />
              Estancias activas
            </h4>
            {stays.map((stay: { id: string; code: string; status: string; check_in_date: string; check_out_date: string; room_name: string }) => (
              <Link
                key={stay.id}
                href={`/hotel/reservas/${stay.id}`}
                className="block rounded-lg border p-2.5 text-xs transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{stay.room_name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {stay.status === 'checked_in' ? 'Hospedado' : 'Reservado'}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatDateOnly(stay.check_in_date)} — {formatDateOnly(stay.check_out_date)}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Unlink button */}
        <button
          type="button"
          onClick={() => linkGuest.mutate({ threadId, guestId: null })}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
        >
          <Link2 className="h-3 w-3" />
          Desvincular huésped
        </button>
      </div>
    </div>
  );
}
