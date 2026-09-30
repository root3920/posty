'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { getSupabaseErrorMessage } from '@/lib/supabase/errors';
import type { Enums } from '@/types/database';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface ContractViewRow {
  id: string;
  organization_id: string;
  code: string;
  guest_id: string;
  payer_business_name: string | null;
  payer_tax_id: string | null;
  room_id: string;
  room_type_id: string;
  start_date: string;
  end_date: string;
  monthly_rate: number;
  original_rate: number;
  billing_cycle: Enums<'billing_cycle'>;
  payment_day: number;
  tax_rate: number;
  deposit_amount: number;
  deposit_status: string;
  deposit_paid_amount: number;
  included_services: string[];
  cleaning_frequency_days: number;
  status: Enums<'contract_status'>;
  stay_id: string | null;
  notes: string | null;
  provisional_until: string | null;
  signed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // View columns
  room_number: string;
  room_floor: string | null;
  room_type_name: string;
  guest_first_name: string;
  guest_last_name: string;
  guest_full_name: string;
  guest_document_type_code: string | null;
  guest_document_number: string | null;
  guest_phone: string | null;
  guest_email: string | null;
  total_installments: number;
  paid_installments: number;
  overdue_installments: number;
  total_billed: number;
  total_paid: number;
  next_due_date: string | null;
  next_due_amount: number | null;
  next_due_status: string | null;
}

export interface ContractInstallment {
  id: string;
  organization_id: string;
  contract_id: string;
  number: number;
  period_start: string;
  period_end: string;
  due_date: string;
  amount: number;
  tax_amount: number;
  total: number;
  paid_amount: number;
  status: Enums<'installment_status'>;
  paid_at: string | null;
  is_prorated: boolean;
  prorated_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface ContractPayment {
  id: string;
  organization_id: string;
  contract_id: string;
  installment_id: string | null;
  amount: number;
  method_id: string;
  reference: string | null;
  is_deposit: boolean;
  paid_at: string;
  received_by: string | null;
  created_at: string;
  method?: { name: string };
}

export interface ContractKpis {
  active_contracts: number;
  expiring_soon: number;
  overdue_installments_count: number;
  overdue_installments_amount: number;
  monthly_recurring_income: number;
  total_deposits: number;
  long_stay_rooms: number;
  total_rooms: number;
}

export interface AvailableRoomType {
  id: string;
  name: string;
  base_rate: number;
  monthly_rate: number | null;
  weekly_rate: number | null;
  biweekly_rate: number | null;
  max_adults: number;
  max_children: number;
  available_count: number;
  total_rooms: number;
  first_available_date: string | null;
}

export interface AvailableRoom {
  id: string;
  number: string;
  floor: string | null;
  rate_override: number | null;
}

// -------------------------------------------------------
// Fetch functions
// -------------------------------------------------------

async function fetchContracts(): Promise<ContractViewRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('contracts_view')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as ContractViewRow[];
}

async function fetchContractDetail(id: string) {
  const supabase = createClient();

  const [contractRes, installmentsRes, paymentsRes] = await Promise.all([
    supabase.from('contracts_view').select('*').eq('id', id).single(),
    supabase
      .from('contract_installments')
      .select('*')
      .eq('contract_id', id)
      .order('number', { ascending: true }),
    supabase
      .from('contract_payments')
      .select('*, method:payment_methods(name)')
      .eq('contract_id', id)
      .order('paid_at', { ascending: false }),
  ]);

  if (contractRes.error) throw contractRes.error;
  if (installmentsRes.error) throw installmentsRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  return {
    contract: contractRes.data as unknown as ContractViewRow,
    installments: (installmentsRes.data ?? []) as unknown as ContractInstallment[],
    payments: (paymentsRes.data ?? []) as unknown as ContractPayment[],
  };
}

async function fetchContractKpis(): Promise<ContractKpis> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_contract_kpis');
  if (error) throw error;
  return data as unknown as ContractKpis;
}

async function fetchAvailableRoomTypes(
  startDate: string,
  endDate: string,
): Promise<AvailableRoomType[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('available_rooms_for_contract', {
    p_start_date: startDate,
    p_end_date: endDate,
  });
  if (error) throw error;
  return (data ?? []) as unknown as AvailableRoomType[];
}

async function fetchAvailableRooms(
  roomTypeId: string,
  startDate: string,
  endDate: string,
): Promise<AvailableRoom[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'available_rooms_of_type_for_period',
    {
      p_room_type_id: roomTypeId,
      p_start_date: startDate,
      p_end_date: endDate,
    },
  );
  if (error) throw error;
  return (data ?? []) as unknown as AvailableRoom[];
}

// -------------------------------------------------------
// Query hooks
// -------------------------------------------------------

export function useContracts() {
  return useQuery({
    queryKey: ['contracts'],
    queryFn: fetchContracts,
    staleTime: 60_000,
  });
}

export function useContractDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['contract_detail', id],
    queryFn: () => fetchContractDetail(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useContractKpis() {
  return useQuery({
    queryKey: ['contract_kpis'],
    queryFn: fetchContractKpis,
    staleTime: 60_000,
  });
}

export function useAvailableRoomTypesForContract(
  startDate: string | undefined,
  endDate: string | undefined,
) {
  return useQuery({
    queryKey: ['available_room_types_contract', startDate, endDate],
    queryFn: () => fetchAvailableRoomTypes(startDate!, endDate!),
    enabled: !!startDate && !!endDate,
    staleTime: 30_000,
  });
}

export function useAvailableRoomsForContract(
  roomTypeId: string | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
) {
  return useQuery({
    queryKey: ['available_rooms_contract', roomTypeId, startDate, endDate],
    queryFn: () => fetchAvailableRooms(roomTypeId!, startDate!, endDate!),
    enabled: !!roomTypeId && !!startDate && !!endDate,
    staleTime: 30_000,
  });
}

// -------------------------------------------------------
// Mutation hooks
// -------------------------------------------------------

interface CreateContractParams {
  guest_id: string;
  payer_business_name?: string;
  payer_tax_id?: string;
  room_type_id: string;
  room_id?: string;
  start_date: string;
  end_date: string;
  monthly_rate: number;
  billing_cycle?: string;
  payment_day?: number;
  tax_rate?: number;
  deposit_amount?: number;
  included_services?: string[];
  cleaning_frequency_days?: number;
  notes?: string;
  additional_guests?: string[];
}

export function useCreateContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateContractParams) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('create_contract_with_stay', {
        p_guest_id: params.guest_id,
        p_payer_business_name: params.payer_business_name,
        p_payer_tax_id: params.payer_tax_id,
        p_room_type_id: params.room_type_id,
        p_room_id: params.room_id,
        p_start_date: params.start_date,
        p_end_date: params.end_date,
        p_monthly_rate: params.monthly_rate,
        p_billing_cycle: params.billing_cycle ?? 'monthly',
        p_payment_day: params.payment_day ?? 1,
        p_tax_rate: params.tax_rate ?? 0,
        p_deposit_amount: params.deposit_amount ?? 0,
        p_included_services: params.included_services ?? [],
        p_cleaning_frequency_days: params.cleaning_frequency_days ?? 7,
        p_notes: params.notes,
        p_additional_guests: params.additional_guests ?? [],
      });
      if (error) throw error;
      return data as unknown as {
        contract_id: string;
        contract_code: string;
        stay_id: string;
        stay_code: string;
        room_id: string;
        room_number: string;
      };
    },
    onSuccess: (data) => {
      toast.success(`Contrato ${data.contract_code} creado — Hab. ${data.room_number}`);
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract_kpis'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_rooms'] });
      queryClient.invalidateQueries({ queryKey: ['stays_view'] });
    },
    onError: (error) => {
      toast.error(getSupabaseErrorMessage(error, 'crear contrato'));
    },
  });
}

interface RegisterPaymentParams {
  installment_id: string;
  amount: number;
  method_id: string;
  reference?: string;
}

export function useRegisterContractPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RegisterPaymentParams) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('register_contract_payment', {
        p_installment_id: params.installment_id,
        p_amount: params.amount,
        p_method_id: params.method_id,
        p_reference: params.reference,
      });
      if (error) throw error;
      return data as unknown as {
        payment_id: string;
        applied: number;
        remaining: number;
      };
    },
    onSuccess: () => {
      toast.success('Pago registrado');
      queryClient.invalidateQueries({ queryKey: ['contract_detail'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract_kpis'] });
    },
    onError: (error) => {
      toast.error(getSupabaseErrorMessage(error, 'registrar pago'));
    },
  });
}

interface RegisterDepositParams {
  contract_id: string;
  amount: number;
  method_id: string;
  reference?: string;
}

export function useRegisterDepositPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RegisterDepositParams) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('register_deposit_payment', {
        p_contract_id: params.contract_id,
        p_amount: params.amount,
        p_method_id: params.method_id,
        p_reference: params.reference,
      });
      if (error) throw error;
      return data as unknown as {
        payment_id: string;
        deposit_paid: number;
        deposit_total: number;
      };
    },
    onSuccess: () => {
      toast.success('Pago de depósito registrado');
      queryClient.invalidateQueries({ queryKey: ['contract_detail'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract_kpis'] });
    },
    onError: (error) => {
      toast.error(getSupabaseErrorMessage(error, 'registrar depósito'));
    },
  });
}

// Terminate contract
export function useTerminateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { contract_id: string; termination_date: string; reason?: string; penalty?: number }) => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('terminate_contract', {
        p_contract_id: params.contract_id,
        p_termination_date: params.termination_date,
        p_reason: params.reason,
        p_penalty: params.penalty ?? 0,
      });
      if (error) throw error;
      return data as unknown as { success: boolean; pending_amount: number; penalty: number; deposit_to_return: number };
    },
    onSuccess: () => {
      toast.success('Contrato terminado');
      queryClient.invalidateQueries({ queryKey: ['contract_detail'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract_kpis'] });
    },
    onError: (error) => toast.error(getSupabaseErrorMessage(error, 'terminar contrato')),
  });
}

// Renew contract
export function useRenewContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { contract_id: string; new_end_date: string; new_rate?: number }) => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('renew_contract', {
        p_contract_id: params.contract_id,
        p_new_end_date: params.new_end_date,
        p_new_rate: params.new_rate,
      });
      if (error) throw error;
      return data as unknown as { success: boolean; new_contract_id: string; new_code: string };
    },
    onSuccess: (data) => {
      toast.success(`Contrato renovado: ${data.new_code}`);
      queryClient.invalidateQueries({ queryKey: ['contract_detail'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
    onError: (error) => toast.error(getSupabaseErrorMessage(error, 'renovar contrato')),
  });
}

// Create amendment (otrosí)
export function useCreateAmendment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { contract_id: string; changes: Record<string, unknown>; effective_date: string; reason?: string }) => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('create_contract_amendment', {
        p_contract_id: params.contract_id,
        p_changes: params.changes,
        p_effective_date: params.effective_date,
        p_reason: params.reason,
      });
      if (error) throw error;
      return data as unknown as { success: boolean; amendment_id: string; amendment_number: number };
    },
    onSuccess: (data) => {
      toast.success(`Otrosí #${data.amendment_number} creado`);
      queryClient.invalidateQueries({ queryKey: ['contract_detail'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
    onError: (error) => toast.error(getSupabaseErrorMessage(error, 'crear otrosí')),
  });
}

// Send for signature
export function useSendForSignature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contractId: string) => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('send_contract_for_signature', { p_contract_id: contractId });
      if (error) throw error;
      return data as unknown as { success: boolean; token: string };
    },
    onSuccess: () => {
      toast.success('Contrato enviado para firma');
      queryClient.invalidateQueries({ queryKey: ['contract_detail'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
    onError: (error) => toast.error(getSupabaseErrorMessage(error, 'enviar para firma')),
  });
}

// Fetch amendments for a contract
export function useContractAmendments(contractId: string | undefined) {
  return useQuery({
    queryKey: ['contract_amendments', contractId],
    queryFn: async () => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('contract_amendments')
        .select('*')
        .eq('contract_id', contractId)
        .order('amendment_number', { ascending: true });
      if (error) throw error;
      return data as Array<{ id: string; amendment_number: number; changes: Record<string, unknown>; previous_values: Record<string, unknown>; reason: string | null; effective_date: string; created_at: string }>;
    },
    enabled: !!contractId,
    staleTime: 30_000,
  });
}

// Convert short stay to long stay
export function useConvertToLongStay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      stay_id: string; end_date: string; monthly_rate: number;
      billing_cycle?: string; payment_day?: number; tax_rate?: number;
      deposit_amount?: number; included_services?: string[];
      cleaning_frequency_days?: number; apply_retroactive?: boolean;
    }) => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('convert_short_to_long_stay', {
        p_stay_id: params.stay_id,
        p_end_date: params.end_date,
        p_monthly_rate: params.monthly_rate,
        p_billing_cycle: params.billing_cycle ?? 'monthly',
        p_payment_day: params.payment_day ?? 1,
        p_tax_rate: params.tax_rate ?? 0,
        p_deposit_amount: params.deposit_amount ?? 0,
        p_included_services: params.included_services ?? [],
        p_cleaning_frequency_days: params.cleaning_frequency_days ?? 7,
        p_apply_retroactive: params.apply_retroactive ?? false,
      });
      if (error) throw error;
      return data as unknown as { success: boolean; contract_id: string; contract_code: string; mode: string };
    },
    onSuccess: (data) => {
      toast.success(`Convertido a larga estadía: ${data.contract_code}`);
      queryClient.invalidateQueries({ queryKey: ['stays_view'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_rooms'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract_kpis'] });
    },
    onError: (error) => toast.error(getSupabaseErrorMessage(error, 'convertir estancia')),
  });
}

// Convert long stay to short stay
export function useConvertToShortStay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { contract_id: string; rate_per_night: number; new_check_out: string }) => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('convert_long_to_short_stay', {
        p_contract_id: params.contract_id,
        p_rate_per_night: params.rate_per_night,
        p_new_check_out: params.new_check_out,
      });
      if (error) throw error;
      return data as unknown as { success: boolean; new_stay_id: string; new_stay_code: string };
    },
    onSuccess: (data) => {
      toast.success(`Convertido a estancia corta: ${data.new_stay_code}`);
      queryClient.invalidateQueries({ queryKey: ['stays_view'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_rooms'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
    onError: (error) => toast.error(getSupabaseErrorMessage(error, 'convertir estancia')),
  });
}

// Fetch documents for a contract
export function useContractDocuments(contractId: string | undefined) {
  return useQuery({
    queryKey: ['contract_documents', contractId],
    queryFn: async () => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('contract_documents')
        .select('*')
        .eq('contract_id', contractId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Array<{ id: string; doc_type: string; pdf_path: string | null; sign_token: string | null; signed_at: string | null; signer_name: string | null; created_at: string }>;
    },
    enabled: !!contractId,
    staleTime: 30_000,
  });
}
