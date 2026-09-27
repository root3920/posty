'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Tables } from '@/types/database';

// -------------------------------------------------------
// Enriched types
// -------------------------------------------------------

export interface RoomWithDetails extends Tables<'rooms'> {
  room_type: Tables<'room_types'>;
  room_status: Tables<'room_statuses'>;
  current_stay: StayWithGuest | null;
  active_stays: Tables<'stays'>[];
}

export interface StayWithGuest extends Tables<'stays'> {
  guest: Tables<'guests'>;
}

export interface StayDetail extends Tables<'stays'> {
  guest: Tables<'guests'>;
  room: Tables<'rooms'> & { room_type: Tables<'room_types'> };
  folio_charges: (Tables<'folio_charges'> & {
    revenue_center: Tables<'revenue_centers'>;
  })[];
  payments: (Tables<'payments'> & {
    method: Tables<'payment_methods'>;
  })[];
  balance: {
    total_charges: number;
    total_payments: number;
    balance: number;
  };
}

export interface HotelKPIs {
  totalRooms: number;
  availableRooms: number;
  occupiedRooms: number;
  dirtyRooms: number;
  outOfServiceRooms: number;
  occupancyPct: number;
  arrivalsToday: number;
  departuresToday: number;
  guestsInHouse: number;
}

// -------------------------------------------------------
// Fetch functions
// -------------------------------------------------------

async function fetchRooms(): Promise<RoomWithDetails[]> {
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: rooms, error } = await supabase
    .from('rooms')
    .select(
      `
      *,
      room_type:room_types(*),
      room_status:room_statuses(*)
      `,
    )
    .eq('is_active', true)
    .order('floor', { ascending: true })
    .order('number', { ascending: true });

  if (error) throw error;

  const roomIds = (rooms ?? []).map((r) => r.id);

  // Fetch active stays for these rooms (both checked_in and reserved)
  let activeStays: (Tables<'stays'> & { guest: Tables<'guests'> })[] = [];
  if (roomIds.length > 0) {
    const { data: staysData } = await supabase
      .from('stays')
      .select(
        `
        *,
        guest:guests(*)
        `,
      )
      .in('room_id', roomIds)
      .in('status', ['checked_in', 'reserved']);

    if (staysData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      activeStays = staysData as any[];
    }
  }

  // Map current checked_in stay per room (for display)
  const staysByRoom = new Map<string, (typeof activeStays)[0]>();
  for (const stay of activeStays) {
    if (stay.status === 'checked_in') {
      staysByRoom.set(stay.room_id, stay);
    }
  }

  // Group all active stays (checked_in + reserved) by room
  const allStaysByRoom = new Map<string, Tables<'stays'>[]>();
  for (const stay of activeStays) {
    const list = allStaysByRoom.get(stay.room_id) ?? [];
    list.push(stay);
    allStaysByRoom.set(stay.room_id, list);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((rooms ?? []) as any[]).map((room) => ({
    ...room,
    room_type: room.room_type,
    room_status: room.room_status,
    current_stay: staysByRoom.get(room.id) ?? null,
    active_stays: allStaysByRoom.get(room.id) ?? [],
  })) as RoomWithDetails[];
}

async function fetchGuests(search: string): Promise<Tables<'guests'>[]> {
  const supabase = createClient();

  let query = supabase
    .from('guests')
    .select('*')
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })
    .limit(50);

  if (search.trim()) {
    query = query.or(
      `last_name.ilike.%${search}%,first_name.ilike.%${search}%,document_number.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function fetchStayDetail(stayId: string): Promise<StayDetail | null> {
  const supabase = createClient();

  const [stayRes, chargesRes, paymentsRes, balanceRes] = await Promise.all([
    supabase
      .from('stays')
      .select(
        `
        *,
        guest:guests(*),
        room:rooms(*, room_type:room_types(*))
        `,
      )
      .eq('id', stayId)
      .single(),

    supabase
      .from('folio_charges')
      .select(
        `
        *,
        revenue_center:revenue_centers(*)
        `,
      )
      .eq('stay_id', stayId)
      .order('posted_at', { ascending: true }),

    supabase
      .from('payments')
      .select(
        `
        *,
        method:payment_methods(*)
        `,
      )
      .eq('stay_id', stayId)
      .order('paid_at', { ascending: true }),

    supabase.from('stay_balances').select('*').eq('stay_id', stayId).maybeSingle(),
  ]);

  if (stayRes.error) throw stayRes.error;
  if (!stayRes.data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = stayRes.data as any;

  return {
    ...raw,
    guest: raw.guest,
    room: raw.room,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    folio_charges: (chargesRes.data ?? []) as any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payments: (paymentsRes.data ?? []) as any[],
    balance: balanceRes.data ?? { total_charges: 0, total_payments: 0, balance: 0 },
  } as StayDetail;
}

async function fetchHotelKPIs(): Promise<HotelKPIs> {
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];

  const [roomsRes, staysRes, arrivalsRes, departuresRes] = await Promise.all([
    supabase
      .from('rooms')
      .select('id, room_status:room_statuses(counts_as_available, counts_as_out_of_order), housekeeping_status')
      .eq('is_active', true),

    supabase
      .from('stays')
      .select('id')
      .eq('status', 'checked_in'),

    supabase
      .from('stays')
      .select('id')
      .eq('check_in_date', today)
      .in('status', ['reserved', 'checked_in']),

    supabase
      .from('stays')
      .select('id')
      .eq('check_out_date', today)
      .eq('status', 'checked_in'),
  ]);

  const rooms = roomsRes.data ?? [];
  const totalRooms = rooms.length;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const availableRooms = rooms.filter((r: any) => r.room_status?.counts_as_available).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outOfServiceRooms = rooms.filter((r: any) => r.room_status?.counts_as_out_of_order).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dirtyRooms = rooms.filter((r: any) => (r as Tables<'rooms'>).housekeeping_status === 'dirty').length;

  const occupiedRooms = (staysRes.data ?? []).length;
  const occupancyPct = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  return {
    totalRooms,
    availableRooms,
    occupiedRooms,
    dirtyRooms,
    outOfServiceRooms,
    occupancyPct,
    arrivalsToday: (arrivalsRes.data ?? []).length,
    departuresToday: (departuresRes.data ?? []).length,
    guestsInHouse: occupiedRooms,
  };
}

// -------------------------------------------------------
// Availability by type (for check-in / reservation forms)
// -------------------------------------------------------

export interface RoomTypeAvailability {
  id: string;
  name: string;
  base_rate: number;
  max_adults: number;
  max_children: number;
  available_count: number;
}

async function fetchAvailableRoomsByType(
  checkIn: string,
  checkOut: string,
): Promise<RoomTypeAvailability[]> {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('available_rooms_by_type', {
    p_check_in: checkIn,
    p_check_out: checkOut,
  });
  if (error) throw error;
  return (data ?? []) as RoomTypeAvailability[];
}

export function useAvailableRoomsByType(checkIn: string, checkOut: string) {
  return useQuery({
    queryKey: ['available_rooms_by_type', checkIn, checkOut],
    queryFn: () => fetchAvailableRoomsByType(checkIn, checkOut),
    enabled: !!checkIn && !!checkOut && checkIn < checkOut,
    staleTime: 15 * 1000,
  });
}

// -------------------------------------------------------
// Catalogs
// -------------------------------------------------------

async function fetchRoomStatuses(): Promise<Tables<'room_statuses'>[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('room_statuses')
    .select('*')
    .eq('is_active', true)
    .is('archived_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function fetchRoomTypes(): Promise<Tables<'room_types'>[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('room_types')
    .select('*')
    .eq('is_active', true)
    .is('archived_at', null)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function fetchBookingChannels(): Promise<Tables<'booking_channels'>[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('booking_channels')
    .select('*')
    .eq('is_active', true)
    .is('archived_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function fetchTravelReasons(): Promise<Tables<'travel_reasons'>[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('travel_reasons')
    .select('*')
    .eq('is_active', true)
    .is('archived_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function fetchPaymentMethods(): Promise<Tables<'payment_methods'>[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('is_active', true)
    .is('archived_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function fetchRevenueCenters(): Promise<Tables<'revenue_centers'>[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('revenue_centers')
    .select('*')
    .eq('is_active', true)
    .is('archived_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function fetchDocumentTypes(): Promise<Tables<'document_types'>[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('document_types')
    .select('*')
    .eq('is_active', true)
    .is('archived_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function fetchReservations(): Promise<StayWithGuest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stays')
    .select(
      `
      *,
      guest:guests(*)
      `,
    )
    .in('status', ['reserved', 'checked_in'])
    .order('check_in_date', { ascending: true });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []) as any[];
}

// -------------------------------------------------------
// Hooks
// -------------------------------------------------------

export function useRooms() {
  return useQuery({
    queryKey: ['hotel_rooms'],
    queryFn: fetchRooms,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useAllRooms() {
  return useQuery<Tables<'rooms'>[]>({
    queryKey: ['hotel_all_rooms'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('floor', { ascending: true })
        .order('number', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30 * 1000,
  });
}

export function useGuests(search: string = '') {
  return useQuery({
    queryKey: ['hotel_guests', search],
    queryFn: () => fetchGuests(search),
    staleTime: 30 * 1000,
  });
}

export function useStayDetail(stayId: string | null) {
  return useQuery({
    queryKey: ['hotel_stay_detail', stayId],
    queryFn: () => fetchStayDetail(stayId!),
    enabled: !!stayId,
    staleTime: 15 * 1000,
  });
}

export function useHotelKPIs() {
  return useQuery({
    queryKey: ['hotel_kpis'],
    queryFn: fetchHotelKPIs,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useRoomStatuses() {
  return useQuery({
    queryKey: ['room_statuses'],
    queryFn: fetchRoomStatuses,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRoomTypes() {
  return useQuery({
    queryKey: ['room_types'],
    queryFn: fetchRoomTypes,
    staleTime: 5 * 60 * 1000,
  });
}

export function useBookingChannels() {
  return useQuery({
    queryKey: ['booking_channels'],
    queryFn: fetchBookingChannels,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTravelReasons() {
  return useQuery({
    queryKey: ['travel_reasons'],
    queryFn: fetchTravelReasons,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ['payment_methods'],
    queryFn: fetchPaymentMethods,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRevenueCenters() {
  return useQuery({
    queryKey: ['revenue_centers'],
    queryFn: fetchRevenueCenters,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDocumentTypes() {
  return useQuery({
    queryKey: ['document_types'],
    queryFn: fetchDocumentTypes,
    staleTime: 5 * 60 * 1000,
  });
}

export function useReservations() {
  return useQuery({
    queryKey: ['hotel_reservations'],
    queryFn: fetchReservations,
    staleTime: 30 * 1000,
  });
}
