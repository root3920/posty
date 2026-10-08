'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, BedDouble, Calendar, Link2, UserPlus, ExternalLink, Search, Plus, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateOnly } from '@/lib/dates';
import { useLinkGuestToThread } from '@/hooks/use-email-inbox';
import { useProfile } from '@/hooks/use-profile';
import { toast } from 'sonner';

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

function useGuestSearchByQuery(query: string) {
  return useQuery({
    queryKey: ['guest_search_email_panel', query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];
      const supabase = createClient();
      const q = `%${query}%`;
      const { data } = await supabase
        .from('guests')
        .select('id, first_name, last_name, email')
        .is('archived_at', null)
        .or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q}`)
        .limit(5);
      return data ?? [];
    },
    enabled: query.length >= 2,
    staleTime: 10_000,
  });
}

export function EmailGuestPanel({ guestId, threadId, senderAddress }: EmailGuestPanelProps) {
  const { data, isLoading } = useGuestContext(guestId);
  const linkGuest = useLinkGuestToThread();
  const [searchQuery, setSearchQuery] = useState('');
  const { data: searchResults = [] } = useGuestSearchByQuery(searchQuery);
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  const handleCreateGuest = async () => {
    if (!senderAddress) return;
    setCreating(true);
    try {
      const supabase = createClient();
      // Extract name guess from email local part
      const localPart = senderAddress.split('@')[0] || '';
      const nameParts = localPart.replace(/[._-]/g, ' ').split(' ').filter(Boolean);
      const firstName = nameParts[0]
        ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1)
        : senderAddress.split('@')[0];
      const lastName = nameParts.length > 1
        ? nameParts.slice(1).map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' ')
        : '';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: guest, error } = await (supabase as any)
        .from('guests')
        .insert({
          organization_id: profile?.organization_id,
          first_name: firstName,
          last_name: lastName || '',
          email: senderAddress.toLowerCase(),
        })
        .select('id')
        .single();

      if (error) {
        toast.error(error.message.includes('duplicate')
          ? 'Ya existe un huésped con ese correo'
          : 'Error al crear huésped');
        return;
      }

      if (guest) {
        linkGuest.mutate({ threadId, guestId: guest.id });
        queryClient.invalidateQueries({ queryKey: ['guest_search_email_panel'] });
      }
    } catch {
      toast.error('Error al crear huésped');
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    );
  }

  // No guest linked
  if (!guestId || !data?.guest) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Huésped</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Sin huésped vinculado
            </p>
          </div>

          {/* Search for existing guest */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar huésped..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-7 text-xs"
              />
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-1">
                {searchResults.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      linkGuest.mutate({ threadId, guestId: g.id });
                      setSearchQuery('');
                    }}
                    className="flex w-full items-center gap-2 rounded-lg border p-2 text-left text-xs transition-colors hover:bg-muted/50"
                  >
                    <UserPlus className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="font-medium">{g.first_name} {g.last_name}</p>
                      {g.email && <p className="truncate text-muted-foreground">{g.email}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchQuery.length >= 2 && searchResults.length === 0 && (
              <p className="text-center text-[11px] text-muted-foreground py-2">
                No se encontraron huéspedes
              </p>
            )}
          </div>

          {/* Create new guest from sender email */}
          {senderAddress && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs"
              onClick={handleCreateGuest}
              disabled={creating}
            >
              {creating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              Crear huésped con {senderAddress}
            </Button>
          )}
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
