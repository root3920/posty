'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { getSupabaseErrorMessage } from '@/lib/supabase/errors';
import type { Enums } from '@/types/database';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface EventVenue {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  pricing_type: Enums<'venue_pricing_type'>;
  price: number;
  deposit: number;
  max_capacity: number;
  open_time: string;
  close_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventBookingView {
  id: string;
  organization_id: string;
  code: string;
  venue_id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  guest_count: number;
  client_name: string;
  client_document: string | null;
  client_phone: string;
  client_email: string | null;
  is_hotel_guest: boolean;
  room_number: string | null;
  rental_total: number;
  rental_paid: boolean;
  deposit_required: number;
  deposit_received: number;
  deposit_method_id: string | null;
  deposit_status: Enums<'event_deposit_status'>;
  deposit_retained_reason: string | null;
  status: Enums<'event_booking_status'>;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // View columns
  venue_name: string;
  venue_pricing_type: string;
  venue_max_capacity: number;
  venue_price: number;
  venue_deposit: number;
  creator_name: string | null;
}

export interface EventBookingHistory {
  id: string;
  booking_id: string;
  actor_id: string | null;
  action: string;
  detail: Record<string, unknown> | null;
  created_at: string;
  actor_name?: string;
}

export interface EventKpis {
  events_today: number;
  bookings_this_week: number;
  guests_this_week: number;
  pending_deposits_count: number;
  pending_deposits_amount: number;
  rental_income_this_week: number;
}

export interface VenueBookingSlot {
  id: string;
  code: string;
  client_name: string;
  start_time: string;
  end_time: string;
  status: string;
}

// -------------------------------------------------------
// Fetch functions
// -------------------------------------------------------

async function fetchEventVenues(): Promise<EventVenue[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('event_venues')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as EventVenue[];
}

async function fetchAllEventVenues(): Promise<EventVenue[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('event_venues')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as EventVenue[];
}

async function fetchEventBookings(): Promise<EventBookingView[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('event_bookings_view')
    .select('*')
    .order('event_date', { ascending: false })
    .order('start_time', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as EventBookingView[];
}

async function fetchEventBookingDetail(id: string) {
  const supabase = createClient();

  const [bookingRes, historyRes] = await Promise.all([
    supabase.from('event_bookings_view').select('*').eq('id', id).single(),
    supabase
      .from('event_booking_history')
      .select('*, actor:profiles(full_name)')
      .eq('booking_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (bookingRes.error) throw bookingRes.error;
  if (historyRes.error) throw historyRes.error;

  const history = ((historyRes.data ?? []) as unknown as Array<
    Omit<EventBookingHistory, 'actor_name'> & { actor: { full_name: string } | null }
  >).map(({ actor, ...row }) => ({
    ...row,
    actor_name: actor?.full_name ?? undefined,
  })) as EventBookingHistory[];

  return {
    booking: bookingRes.data as unknown as EventBookingView,
    history,
  };
}

async function fetchEventKpis(): Promise<EventKpis> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_event_kpis');
  if (error) throw error;
  return data as unknown as EventKpis;
}

async function fetchVenueBookingsForDate(
  venueId: string,
  date: string,
): Promise<VenueBookingSlot[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_venue_bookings_for_date', {
    p_venue_id: venueId,
    p_date: date,
  });
  if (error) throw error;
  return (data ?? []) as unknown as VenueBookingSlot[];
}

// -------------------------------------------------------
// Query hooks
// -------------------------------------------------------

export function useEventVenues() {
  return useQuery({
    queryKey: ['event_venues', 'active'],
    queryFn: fetchEventVenues,
    staleTime: 5 * 60_000,
  });
}

export function useAllEventVenues() {
  return useQuery({
    queryKey: ['event_venues', 'all'],
    queryFn: fetchAllEventVenues,
    staleTime: 5 * 60_000,
  });
}

export function useEventBookings() {
  return useQuery({
    queryKey: ['event_bookings'],
    queryFn: fetchEventBookings,
    staleTime: 30_000,
  });
}

export function useEventBookingDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['event_booking_detail', id],
    queryFn: () => fetchEventBookingDetail(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useEventKpis() {
  return useQuery({
    queryKey: ['event_kpis'],
    queryFn: fetchEventKpis,
    staleTime: 60_000,
  });
}

export function useVenueBookingsForDate(
  venueId: string | undefined,
  date: string | undefined,
) {
  return useQuery({
    queryKey: ['venue_bookings_for_date', venueId, date],
    queryFn: () => fetchVenueBookingsForDate(venueId!, date!),
    enabled: !!venueId && !!date,
    staleTime: 30_000,
  });
}

// -------------------------------------------------------
// Mutation hooks
// -------------------------------------------------------

interface CreateEventBookingParams {
  venue_id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  guest_count: number;
  client_name: string;
  client_phone: string;
  client_document?: string;
  client_email?: string;
  is_hotel_guest?: boolean;
  room_number?: string;
  deposit_received?: number;
  deposit_method_id?: string;
  notes?: string;
  idempotency_key?: string;
}

export function useCreateEventBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateEventBookingParams) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('create_event_booking', {
        p_venue_id: params.venue_id,
        p_event_date: params.event_date,
        p_start_time: params.start_time,
        p_end_time: params.end_time,
        p_guest_count: params.guest_count,
        p_client_name: params.client_name,
        p_client_phone: params.client_phone,
        p_client_document: params.client_document,
        p_client_email: params.client_email,
        p_is_hotel_guest: params.is_hotel_guest,
        p_room_number: params.room_number,
        p_deposit_received: params.deposit_received,
        p_deposit_method_id: params.deposit_method_id,
        p_notes: params.notes,
        p_idempotency_key: params.idempotency_key,
      });
      if (error) throw error;
      return data as unknown as { booking_id: string; code: string; venue_name: string };
    },
    onSuccess: (data) => {
      toast.success(`Reserva ${data.code} creada — ${data.venue_name}`);
      queryClient.invalidateQueries({ queryKey: ['event_bookings'] });
      queryClient.invalidateQueries({ queryKey: ['event_kpis'] });
    },
    onError: (error) => {
      toast.error(getSupabaseErrorMessage(error, 'crear reserva de evento'));
    },
  });
}

interface CancelEventBookingParams {
  booking_id: string;
  reason?: string;
}

export function useCancelEventBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CancelEventBookingParams) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('cancel_event_booking', {
        p_booking_id: params.booking_id,
        p_reason: params.reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Reserva cancelada');
      queryClient.invalidateQueries({ queryKey: ['event_bookings'] });
      queryClient.invalidateQueries({ queryKey: ['event_kpis'] });
    },
    onError: (error) => {
      toast.error(getSupabaseErrorMessage(error, 'cancelar reserva'));
    },
  });
}

interface RegisterEventDepositParams {
  booking_id: string;
  amount: number;
  method_id: string;
}

export function useRegisterEventDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RegisterEventDepositParams) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('register_event_deposit', {
        p_booking_id: params.booking_id,
        p_amount: params.amount,
        p_method_id: params.method_id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Depósito registrado');
      queryClient.invalidateQueries({ queryKey: ['event_bookings'] });
      queryClient.invalidateQueries({ queryKey: ['event_kpis'] });
    },
    onError: (error) => {
      toast.error(getSupabaseErrorMessage(error, 'registrar depósito'));
    },
  });
}

interface MarkRentalPaidParams {
  booking_id: string;
}

export function useMarkRentalPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: MarkRentalPaidParams) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('mark_event_rental_paid', {
        p_booking_id: params.booking_id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Alquiler marcado como pagado');
      queryClient.invalidateQueries({ queryKey: ['event_bookings'] });
      queryClient.invalidateQueries({ queryKey: ['event_kpis'] });
    },
    onError: (error) => {
      toast.error(getSupabaseErrorMessage(error, 'marcar alquiler pagado'));
    },
  });
}

interface FinalizeEventParams {
  booking_id: string;
}

export function useFinalizeEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: FinalizeEventParams) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('finalize_event_booking', {
        p_booking_id: params.booking_id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Evento finalizado');
      queryClient.invalidateQueries({ queryKey: ['event_bookings'] });
      queryClient.invalidateQueries({ queryKey: ['event_kpis'] });
    },
    onError: (error) => {
      toast.error(getSupabaseErrorMessage(error, 'finalizar evento'));
    },
  });
}

interface ReturnEventDepositParams {
  booking_id: string;
}

export function useReturnEventDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ReturnEventDepositParams) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('return_event_deposit', {
        p_booking_id: params.booking_id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Depósito devuelto');
      queryClient.invalidateQueries({ queryKey: ['event_bookings'] });
      queryClient.invalidateQueries({ queryKey: ['event_kpis'] });
    },
    onError: (error) => {
      toast.error(getSupabaseErrorMessage(error, 'devolver depósito'));
    },
  });
}

interface RetainEventDepositParams {
  booking_id: string;
  reason: string;
}

export function useRetainEventDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RetainEventDepositParams) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('retain_event_deposit', {
        p_booking_id: params.booking_id,
        p_reason: params.reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Depósito retenido');
      queryClient.invalidateQueries({ queryKey: ['event_bookings'] });
      queryClient.invalidateQueries({ queryKey: ['event_kpis'] });
    },
    onError: (error) => {
      toast.error(getSupabaseErrorMessage(error, 'retener depósito'));
    },
  });
}

interface CreateVenueParams {
  name: string;
  description?: string;
  pricing_type: Enums<'venue_pricing_type'>;
  price: number;
  deposit: number;
  max_capacity: number;
  open_time: string;
  close_time: string;
}

export function useCreateVenue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateVenueParams) => {
      const supabase = createClient();
      // Get org_id from profile
      const { data: profile } = await supabase.rpc('get_my_profile');
      const orgId = (profile as unknown as { organization_id: string })?.organization_id;
      if (!orgId) throw new Error('Perfil no encontrado');

      const { data, error } = await supabase
        .from('event_venues')
        .insert({
          organization_id: orgId,
          name: params.name,
          description: params.description ?? null,
          pricing_type: params.pricing_type,
          price: params.price,
          deposit: params.deposit,
          max_capacity: params.max_capacity,
          open_time: params.open_time,
          close_time: params.close_time,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as EventVenue;
    },
    onSuccess: (data) => {
      toast.success(`Espacio "${data.name}" creado`);
      queryClient.invalidateQueries({ queryKey: ['event_venues'] });
      queryClient.invalidateQueries({ queryKey: ['event_bookings'] });
      queryClient.invalidateQueries({ queryKey: ['event_kpis'] });
    },
    onError: (error) => {
      toast.error(getSupabaseErrorMessage(error, 'crear espacio'));
    },
  });
}

interface UpdateVenueParams {
  id: string;
  name?: string;
  description?: string | null;
  pricing_type?: Enums<'venue_pricing_type'>;
  price?: number;
  deposit?: number;
  max_capacity?: number;
  open_time?: string;
  close_time?: string;
  is_active?: boolean;
}

export function useUpdateVenue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...fields }: UpdateVenueParams) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('event_venues')
        .update(fields)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as EventVenue;
    },
    onSuccess: (data) => {
      toast.success(`Espacio "${data.name}" actualizado`);
      queryClient.invalidateQueries({ queryKey: ['event_venues'] });
      queryClient.invalidateQueries({ queryKey: ['event_bookings'] });
      queryClient.invalidateQueries({ queryKey: ['event_kpis'] });
    },
    onError: (error) => {
      toast.error(getSupabaseErrorMessage(error, 'actualizar espacio'));
    },
  });
}
