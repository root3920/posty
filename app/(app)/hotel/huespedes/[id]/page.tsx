'use client';

import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  Globe,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PhoneDisplay } from '@/components/shared/phone-display';
import { useGuestDetail, useGuestStays } from '@/hooks/use-hotel';
import { useProfile } from '@/hooks/use-profile';
import { formatCurrency } from '@/lib/format';

// -------------------------------------------------------
// Status display
// -------------------------------------------------------

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  reserved: { label: 'Reservado', variant: 'default' },
  checked_in: { label: 'Hospedado', variant: 'default' },
  checked_out: { label: 'Check-out', variant: 'secondary' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
  no_show: { label: 'No-show', variant: 'outline' },
};

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function GuestDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const guestId = params.id;

  const { data: guest, isLoading: guestLoading } = useGuestDetail(guestId);
  const { data: stays = [], isLoading: staysLoading } = useGuestStays(guestId);
  const { data: profile } = useProfile();

  const currency = profile?.organization?.currency ?? 'COP';
  const locale = profile?.organization?.locale ?? 'es-CO';

  if (guestLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-60 w-full rounded-xl" />
      </div>
    );
  }

  if (!guest) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">Huésped no encontrado</p>
        <Button variant="link" onClick={() => router.push('/hotel/huespedes')}>
          Volver a huéspedes
        </Button>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docType = guest.document_type as any;
  const totalStays = stays.length;
  const isRecurrent = totalStays > 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {guest.first_name?.[0]}{guest.last_name?.[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold">
                {guest.first_name} {guest.last_name}
              </h1>
              <p className="text-xs text-muted-foreground">
                {docType?.code ? `${docType.code} ${guest.document_number}` : guest.document_number ?? 'Sin documento'}
              </p>
            </div>
          </div>
          {isRecurrent && (
            <Badge variant="secondary" className="text-xs">Recurrente · {totalStays} estancias</Badge>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Profile card */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold">Información personal</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm">
            <InfoField icon={<User className="h-4 w-4" />} label="Nombre completo" value={`${guest.first_name} ${guest.last_name}`} />
            <InfoField icon={<FileText className="h-4 w-4" />} label="Documento" value={docType ? `${docType.code} ${guest.document_number ?? ''}` : guest.document_number ?? '—'} />
            <InfoField icon={<Globe className="h-4 w-4" />} label="Nacionalidad" value={guest.nationality ?? '—'} />
            <InfoField icon={<Calendar className="h-4 w-4" />} label="Fecha de nacimiento" value={guest.birth_date ? format(new Date(guest.birth_date), 'd MMM yyyy', { locale: es }) : '—'} />
            <div className="space-y-0.5">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-4 w-4" /> Teléfono
              </span>
              <PhoneDisplay value={guest.phone} />
            </div>
            <InfoField icon={<Mail className="h-4 w-4" />} label="Email" value={guest.email ?? '—'} />
            <InfoField icon={<MapPin className="h-4 w-4" />} label="Dirección" value={guest.address ?? '—'} />
            <InfoField icon={<MapPin className="h-4 w-4" />} label="Ciudad de origen" value={guest.city_of_origin ?? '—'} />
            <InfoField icon={<Globe className="h-4 w-4" />} label="País de origen" value={guest.country_of_origin ?? '—'} />
          </div>
          {guest.notes && (
            <div className="pt-2 border-t">
              <span className="text-xs text-muted-foreground">Notas</span>
              <p className="text-sm">{guest.notes}</p>
            </div>
          )}
        </div>

        {/* Stays list */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Historial de estancias ({totalStays})</h2>
          {staysLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : stays.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sin estancias registradas.
            </p>
          ) : (
            <div className="space-y-2">
              {stays.map((stay) => {
                const statusCfg = STATUS_LABELS[stay.status] ?? STATUS_LABELS.reserved;
                return (
                  <Link
                    key={stay.id}
                    href={`/hotel/reservas/${stay.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{stay.code}</span>
                        <Badge variant={statusCfg.variant} className="text-[10px]">
                          {statusCfg.label}
                        </Badge>
                      </div>
                      <p className="text-sm mt-0.5">
                        Hab. {stay.room_number ?? '—'} · {stay.room_type_name ?? '—'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">
                        {format(new Date(stay.check_in_date), 'd MMM', { locale: es })}
                        {' → '}
                        {format(new Date(stay.check_out_date), 'd MMM yyyy', { locale: es })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stay.nights} noche{stay.nights !== 1 ? 's' : ''} · {formatCurrency(stay.rate_per_night * stay.nights, currency, locale)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Helper
// -------------------------------------------------------

function InfoField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </span>
      <p className="font-medium">{value}</p>
    </div>
  );
}
