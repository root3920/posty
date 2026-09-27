'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Search, Plus, User, Mail, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EntitySelect } from '@/components/shared/entity-select';
import { PhoneInput } from '@/components/shared/phone-input';
import { PhoneDisplay } from '@/components/shared/phone-display';
import { useDefaultCountry } from '@/components/providers/geo-provider';
import type { Country } from 'react-phone-number-input';

import { createClient } from '@/lib/supabase/client';
import { guestSchema, type GuestInput } from '@/lib/validations/hotel';
import { useGuests, useDocumentTypes } from '@/hooks/use-hotel';
import type { Tables } from '@/types/database';

// -------------------------------------------------------
// Guest form dialog
// -------------------------------------------------------

interface GuestFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editGuest?: Tables<'guests'> | null;
}

function GuestFormDialog({ open, onOpenChange, editGuest }: GuestFormDialogProps) {
  const queryClient = useQueryClient();
  const { data: documentTypes = [] } = useDocumentTypes();
  const orgDefaultCountry = useDefaultCountry();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [phoneCountry, setPhoneCountry] = useState<Country>(orgDefaultCountry as Country);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<GuestInput>({
    resolver: zodResolver(guestSchema) as any,
    defaultValues: {},
  });

  // Reset form data when editGuest changes (fix: modal opened empty)
  useEffect(() => {
    if (editGuest) {
      reset({
        firstName: editGuest.first_name,
        lastName: editGuest.last_name,
        documentTypeId: editGuest.document_type_id ?? undefined,
        documentNumber: editGuest.document_number ?? undefined,
        nationality: editGuest.nationality ?? undefined,
        birthDate: editGuest.birth_date ?? undefined,
        phone: editGuest.phone ?? undefined,
        email: editGuest.email ?? undefined,
        address: editGuest.address ?? undefined,
        cityOfOrigin: editGuest.city_of_origin ?? undefined,
        countryOfOrigin: editGuest.country_of_origin ?? undefined,
        notes: editGuest.notes ?? undefined,
      });
    } else {
      reset({});
    }
  }, [editGuest, reset]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    setServerError(null);

    const supabase = createClient();

    const payload = {
      first_name: data.firstName,
      last_name: data.lastName,
      document_type_id: data.documentTypeId ?? null,
      document_number: data.documentNumber ?? null,
      nationality: data.nationality ?? null,
      birth_date: data.birthDate ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
      city_of_origin: data.cityOfOrigin ?? null,
      country_of_origin: data.countryOfOrigin ?? null,
      notes: data.notes ?? null,
    };

    let error;
    if (editGuest) {
      const res = await supabase.from('guests').update(payload).eq('id', editGuest.id);
      error = res.error;
    } else {
      // Get org id from profile
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setServerError('No autenticado');
        setIsSubmitting(false);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();
      if (!profile) {
        setServerError('Perfil no encontrado');
        setIsSubmitting(false);
        return;
      }
      const res = await supabase
        .from('guests')
        .insert({ ...payload, organization_id: profile.organization_id });
      error = res.error;
    }

    setIsSubmitting(false);

    if (error) {
      setServerError('Error al guardar el huésped');
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['hotel_guests'] });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editGuest ? 'Editar huésped' : 'Nuevo huésped'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nombre *</Label>
              <Input {...register('firstName')} placeholder="Nombre" />
              {errors.firstName && (
                <p className="mt-0.5 text-xs text-danger">{errors.firstName.message}</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Apellido *</Label>
              <Input {...register('lastName')} placeholder="Apellido" />
              {errors.lastName && (
                <p className="mt-0.5 text-xs text-danger">{errors.lastName.message}</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Tipo de documento</Label>
              <EntitySelect
                options={documentTypes.map((dt) => ({ value: dt.id, label: dt.name }))}
                value={watch('documentTypeId') ?? null}
                onChange={(v) => setValue('documentTypeId', v ?? undefined)}
                placeholder="Seleccionar..."
                allowClear
                clearLabel="Sin especificar"
              />
            </div>
            <div>
              <Label className="text-xs">Número de documento</Label>
              <Input {...register('documentNumber')} placeholder="123456789" />
            </div>
            <div>
              <Label className="text-xs">Teléfono</Label>
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <PhoneInput
                    value={field.value ?? ''}
                    onChange={(v) => field.onChange(v ?? '')}
                    defaultCountry={phoneCountry}
                    onCountryChange={(c) => setPhoneCountry(c)}
                    error={errors.phone?.message}
                  />
                )}
              />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input {...register('email')} type="email" placeholder="correo@ejemplo.com" />
              {errors.email && (
                <p className="mt-0.5 text-xs text-danger">{errors.email.message}</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Fecha de nacimiento</Label>
              <Input {...register('birthDate')} type="date" />
            </div>
            <div>
              <Label className="text-xs">Nacionalidad</Label>
              <Input {...register('nationality')} placeholder="Colombiana" />
            </div>
            <div>
              <Label className="text-xs">Ciudad de origen</Label>
              <Input {...register('cityOfOrigin')} placeholder="Bogotá" />
            </div>
            <div>
              <Label className="text-xs">País de origen</Label>
              <Input {...register('countryOfOrigin')} placeholder="Colombia" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Dirección</Label>
              <Input {...register('address')} placeholder="Calle 123 # 45-67" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Notas</Label>
              <Input {...register('notes')} placeholder="Observaciones..." />
            </div>
          </div>

          {serverError && (
            <p className="rounded bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editGuest ? (
                'Guardar cambios'
              ) : (
                'Crear huésped'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------
// Main content
// -------------------------------------------------------

function HuespedesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get('q') ?? '';
  const [createOpen, setCreateOpen] = useState(false);
  const [editGuest, setEditGuest] = useState<Tables<'guests'> | null>(null);

  const { data: guests = [], isLoading } = useGuests(search);

  function updateSearch(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('q', value);
    else params.delete('q');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Huéspedes</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Registro de huéspedes del establecimiento
            </p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nuevo huésped
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="border-b px-6 py-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o documento..."
            value={search}
            onChange={(e) => updateSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : guests.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <User className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">
              {search ? 'No se encontraron huéspedes.' : 'No hay huéspedes registrados.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Nombre</th>
                  <th className="px-4 py-3 text-left">Documento</th>
                  <th className="px-4 py-3 text-left">Teléfono</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Origen</th>
                  <th className="px-4 py-3 text-left">Registrado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {guests.map((guest) => (
                  <tr key={guest.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {guest.first_name[0]}
                          {guest.last_name[0]}
                        </div>
                        <Link href={`/hotel/huespedes/${guest.id}`} className="font-medium hover:underline">
                          {guest.first_name} {guest.last_name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {guest.document_number ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <PhoneDisplay value={guest.phone} showActions={false} />
                    </td>
                    <td className="px-4 py-3">
                      {guest.email ? (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {guest.email}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[guest.city_of_origin, guest.country_of_origin]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {format(new Date(guest.created_at), "d MMM yyyy", { locale: es })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setEditGuest(guest)}
                      >
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <GuestFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      <GuestFormDialog
        open={!!editGuest}
        onOpenChange={(v) => !v && setEditGuest(null)}
        editGuest={editGuest}
      />
    </div>
  );
}

// -------------------------------------------------------
// Page export
// -------------------------------------------------------

export default function HuespedesPage() {
  return (
    <Suspense>
      <HuespedesContent />
    </Suspense>
  );
}
