'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { getSupabaseErrorMessage } from '@/lib/supabase/errors';

// TRA submissions for a stay
export function useTraSubmissions(stayId: string | undefined) {
  return useQuery({
    queryKey: ['tra_submissions', stayId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await (supabase as any)
        .from('tra_submissions')
        .select('*')
        .eq('stay_id', stayId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Array<{ id: string; status: string; tra_api_id: string | null; error_message: string | null; submitted_at: string | null; created_at: string }>;
    },
    enabled: !!stayId,
    staleTime: 30_000,
  });
}

// Submit TRA
export function useSubmitTra() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stayId: string) => {
      const supabase = createClient();
      const { data, error } = await (supabase as any).rpc('submit_tra', { p_stay_id: stayId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('TRA generada correctamente');
      queryClient.invalidateQueries({ queryKey: ['tra_submissions'] });
    },
    onError: (error) => toast.error(getSupabaseErrorMessage(error, 'enviar TRA')),
  });
}

// Generate SIRE record
export function useGenerateSire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ stayId, type }: { stayId: string; type?: string }) => {
      const supabase = createClient();
      const { data, error } = await (supabase as any).rpc('generate_sire_record', {
        p_stay_id: stayId,
        p_type: type ?? 'check_in',
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.skipped) {
        toast.info(data.reason);
      } else {
        toast.success('Registro SIRE generado');
      }
      queryClient.invalidateQueries({ queryKey: ['sire_submissions'] });
    },
    onError: (error) => toast.error(getSupabaseErrorMessage(error, 'generar SIRE')),
  });
}

// SIRE submissions list
export function useSireSubmissions(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['sire_submissions', dateFrom, dateTo],
    queryFn: async () => {
      const supabase = createClient();
      let q = (supabase as any)
        .from('sire_submissions')
        .select('*, guest:guests(first_name, last_name, nationality)')
        .order('created_at', { ascending: false });
      if (dateFrom) q = q.gte('created_at', dateFrom);
      if (dateTo) q = q.lte('created_at', dateTo + 'T23:59:59');
      const { data, error } = await q;
      if (error) throw error;
      return data as Array<{ id: string; submission_type: string; status: string; file_content: string | null; guest: { first_name: string; last_name: string; nationality: string | null } | null; created_at: string }>;
    },
    staleTime: 30_000,
  });
}

// Export SIRE file
export function useExportSireFile() {
  return useMutation({
    mutationFn: async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
      const supabase = createClient();
      const { data, error } = await (supabase as any).rpc('export_sire_file', {
        p_date_from: dateFrom,
        p_date_to: dateTo,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (data) => {
      if (!data) {
        toast.info('No hay registros SIRE en este período');
        return;
      }
      // Download as .txt file
      const blob = new Blob([data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sire_export.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Archivo SIRE descargado');
    },
    onError: () => toast.error('Error al exportar SIRE'),
  });
}
