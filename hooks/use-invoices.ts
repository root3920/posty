'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { getSupabaseErrorMessage } from '@/lib/supabase/errors';

export interface Invoice {
  id: string;
  organization_id: string;
  invoice_number: string;
  prefix: string | null;
  invoice_date: string;
  customer_name: string;
  customer_nit: string | null;
  stay_id: string | null;
  contract_id: string | null;
  event_booking_id: string | null;
  subtotal: number;
  iva_amount: number;
  total: number;
  cufe: string | null;
  dian_status: string;
  pdf_path: string | null;
  created_at: string;
}

export interface InvoiceLine {
  id: string;
  line_number: number;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
}

export function useInvoices(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['invoices', dateFrom, dateTo],
    queryFn: async () => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any).from('invoices').select('*').order('invoice_date', { ascending: false });
      if (dateFrom) q = q.gte('invoice_date', dateFrom);
      if (dateTo) q = q.lte('invoice_date', dateTo);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
    staleTime: 30_000,
  });
}

export function useCreateInvoiceFromStay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stayId: string) => {
      const supabase = createClient();
      const { data, error } = await (supabase as any).rpc('create_invoice_from_stay', { p_stay_id: stayId });
      if (error) throw error;
      return data as { success: boolean; invoice_id: string; invoice_number: string; total: number };
    },
    onSuccess: (data) => {
      toast.success(`Factura ${data.invoice_number} creada · Total: $${data.total.toLocaleString()}`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error) => toast.error(getSupabaseErrorMessage(error, 'crear factura')),
  });
}

export function useInvoiceDetail(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['invoice_detail', invoiceId],
    queryFn: async () => {
      const supabase = createClient();
      const [invRes, linesRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('invoices').select('*').eq('id', invoiceId).single(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('invoice_lines').select('*').eq('invoice_id', invoiceId).order('line_number'),
      ]);
      if (invRes.error) throw invRes.error;
      return { invoice: invRes.data as Invoice, lines: (linesRes.data ?? []) as InvoiceLine[] };
    },
    enabled: !!invoiceId,
    staleTime: 30_000,
  });
}
