'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/hooks/use-profile';
import { toast } from 'sonner';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Guest email history ────────────────────────────────────────────────

export function useGuestEmails(guestId: string | null) {
  return useQuery({
    queryKey: ['guest_emails', guestId],
    queryFn: async () => {
      const supabase = createClient() as any;
      const { data, error } = await supabase
        .from('email_messages')
        .select('id, to, subject, template, status, error, created_at, sent_by, source, thread_id')
        .eq('guest_id', guestId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; to: string; subject: string; template: string;
        status: string; error: string | null; created_at: string;
        sent_by: string | null; source: string | null; thread_id: string | null;
      }>;
    },
    enabled: !!guestId,
    staleTime: 30_000,
  });
}

// ─── Email suppression check ────────────────────────────────────────────

export function useEmailSuppression(email: string | null | undefined, orgId: string | null) {
  return useQuery({
    queryKey: ['email_suppression', orgId, email],
    queryFn: async () => {
      if (!email) return null;
      const supabase = createClient() as any;
      const { data } = await supabase
        .from('email_suppressions')
        .select('id, reason, created_at')
        .eq('organization_id', orgId!)
        .eq('email', email.toLowerCase())
        .maybeSingle();
      return data as { id: string; reason: string; created_at: string } | null;
    },
    enabled: !!email && !!orgId,
    staleTime: 60_000,
  });
}

// ─── Send email mutation ────────────────────────────────────────────────

interface SendEmailInput {
  guestId: string;
  to: string;
  subject: string;
  body: string;
  guestName: string;
  source?: string;
}

interface SendEmailResult {
  id: string;
  threadId: string;
  providerId: string;
  status: string;
}

export function useSendEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SendEmailInput): Promise<SendEmailResult> => {
      const idempotencyKey = `${input.guestId}-${Date.now()}`;
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...input,
          source: input.source || 'guest_profile',
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al enviar correo');
      return data;
    },
    onSuccess: (_data: SendEmailResult, variables: SendEmailInput) => {
      queryClient.invalidateQueries({ queryKey: ['guest_emails', variables.guestId] });
      queryClient.invalidateQueries({ queryKey: ['email_threads'] });
      queryClient.invalidateQueries({ queryKey: ['guest_email_threads', variables.guestId] });
      queryClient.invalidateQueries({ queryKey: ['email_unread_count'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─── Send test email mutation ───────────────────────────────────────────

export function useSendTestEmail() {
  return useMutation({
    mutationFn: async (to: string) => {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al enviar correo de prueba');
      return data;
    },
    onSuccess: () => {
      toast.success('Correo de prueba enviado — revisa tu bandeja de entrada');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─── Organization contact email mutation ────────────────────────────────

export function useUpdateContactEmail() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async (contactEmail: string | null) => {
      const supabase = createClient() as any;
      const { error } = await supabase
        .from('organizations')
        .update({ contact_email: contactEmail })
        .eq('id', profile!.organization_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Correo de contacto actualizado');
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error: Error) => {
      toast.error(`Error al guardar el correo de contacto: ${error.message}`);
    },
  });
}
