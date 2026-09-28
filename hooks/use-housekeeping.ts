'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CleaningRow = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CleaningStatusRow = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CleaningTypeRow = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HousekeepingConfigRow = Record<string, any>;

// -------------------------------------------------------
// Today's cleanings
// -------------------------------------------------------

async function fetchTodayCleanings(): Promise<CleaningRow[]> {
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from as any)('room_cleanings')
    .select(`
      *,
      room:rooms(number, floor, room_type_id),
      cleaning_type:cleaning_types(name, color, system_key, estimated_minutes),
      assigned_profile:profiles!room_cleanings_assigned_to_fkey(full_name),
      completed_profile:profiles!room_cleanings_completed_by_fkey(full_name)
    `)
    .gte('scheduled_for', today)
    .lt('scheduled_for', tomorrow)
    .neq('status', 'cancelled')
    .order('scheduled_for', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export function useTodayCleanings() {
  return useQuery({
    queryKey: ['today_cleanings'],
    queryFn: fetchTodayCleanings,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
}

// -------------------------------------------------------
// Room cleaning status (view)
// -------------------------------------------------------

async function fetchRoomCleaningStatus(): Promise<CleaningStatusRow[]> {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from as any)('room_cleaning_status_view')
    .select('*')
    .order('floor', { ascending: true })
    .order('room_number', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export function useRoomCleaningStatus() {
  return useQuery({
    queryKey: ['room_cleaning_status'],
    queryFn: fetchRoomCleaningStatus,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

// -------------------------------------------------------
// Cleaning types (catalog)
// -------------------------------------------------------

async function fetchCleaningTypes(): Promise<CleaningTypeRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('cleaning_types')
    .select('*')
    .eq('is_active', true)
    .is('archived_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export function useCleaningTypes() {
  return useQuery({
    queryKey: ['cleaning_types'],
    queryFn: fetchCleaningTypes,
    staleTime: 5 * 60 * 1000,
  });
}

// -------------------------------------------------------
// Housekeeping config
// -------------------------------------------------------

async function fetchHousekeepingConfig(): Promise<HousekeepingConfigRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('housekeeping_config')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function useHousekeepingConfig() {
  return useQuery({
    queryKey: ['housekeeping_config'],
    queryFn: fetchHousekeepingConfig,
    staleTime: 5 * 60 * 1000,
  });
}

// -------------------------------------------------------
// Housekeeping KPIs (computed from today's cleanings)
// -------------------------------------------------------

export interface HousekeepingKPIs {
  scheduled: number;
  inProgress: number;
  completed: number;
  pendingInspection: number;
  overdue: number;
  overdueRooms: number;
}

export function useHousekeepingKPIs() {
  const { data: cleanings = [] } = useTodayCleanings();
  const { data: roomStatus = [] } = useRoomCleaningStatus();

  const kpis: HousekeepingKPIs = {
    scheduled: cleanings.filter((c) => c.status === 'scheduled').length,
    inProgress: cleanings.filter((c) => c.status === 'in_progress').length,
    completed: cleanings.filter((c) => c.status === 'completed').length,
    pendingInspection: cleanings.filter((c) => c.inspection_status === 'pending').length,
    overdue: cleanings.filter((c) =>
      c.status === 'scheduled' && new Date(c.scheduled_for) < new Date(),
    ).length,
    overdueRooms: roomStatus.filter((r) => r.is_overdue).length,
  };

  return kpis;
}

// -------------------------------------------------------
// Cleaning history (with filters)
// -------------------------------------------------------

interface CleaningHistoryFilters {
  roomId?: string;
  cleaningTypeId?: string;
  dateFrom?: string;
  dateTo?: string;
}

async function fetchCleaningHistory(filters: CleaningHistoryFilters): Promise<CleaningRow[]> {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from as any)('room_cleanings')
    .select(`
      *,
      room:rooms(number, floor),
      cleaning_type:cleaning_types(name, color),
      completed_profile:profiles!room_cleanings_completed_by_fkey(full_name),
      inspected_profile:profiles!room_cleanings_inspected_by_fkey(full_name)
    `)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(200);

  if (filters.roomId) query = query.eq('room_id', filters.roomId);
  if (filters.cleaningTypeId) query = query.eq('cleaning_type_id', filters.cleaningTypeId);
  if (filters.dateFrom) query = query.gte('completed_at', filters.dateFrom);
  if (filters.dateTo) query = query.lte('completed_at', filters.dateTo + 'T23:59:59');

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export function useCleaningHistory(filters: CleaningHistoryFilters) {
  return useQuery({
    queryKey: ['cleaning_history', filters],
    queryFn: () => fetchCleaningHistory(filters),
    staleTime: 30 * 1000,
  });
}

// -------------------------------------------------------
// Stay cleanings (for the stay detail tab)
// -------------------------------------------------------

async function fetchStayCleanings(stayId: string): Promise<CleaningRow[]> {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from as any)('room_cleanings')
    .select(`
      *,
      cleaning_type:cleaning_types(name, color),
      completed_profile:profiles!room_cleanings_completed_by_fkey(full_name)
    `)
    .eq('stay_id', stayId)
    .order('scheduled_for', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export function useStayCleanings(stayId: string | null) {
  return useQuery({
    queryKey: ['stay_cleanings', stayId],
    queryFn: () => fetchStayCleanings(stayId!),
    enabled: !!stayId,
    staleTime: 30 * 1000,
  });
}
