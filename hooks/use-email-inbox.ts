'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { StoredAttachment } from '@/lib/email/types';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface EmailThread {
  id: string;
  organization_id: string;
  guest_id: string | null;
  subject: string;
  status: 'open' | 'closed';
  assigned_to: string | null;
  last_message_at: string | null;
  unread_count: number;
  token: string;
  sender_address: string | null;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailMessage {
  id: string;
  organization_id: string;
  thread_id: string | null;
  guest_id: string | null;
  direction: 'in' | 'out';
  to: string;
  from_address: string | null;
  cc: string[] | null;
  subject: string;
  template: string;
  body_text: string | null;
  html_sanitized: string | null;
  message_id: string | null;
  in_reply_to: string | null;
  attachments: StoredAttachment[];
  status: string;
  error: string | null;
  provider_id: string | null;
  sent_by: string | null;
  created_at: string;
}

// -------------------------------------------------------
// Unread count (for sidebar badge)
// -------------------------------------------------------

export function useEmailUnreadCount() {
  return useQuery({
    queryKey: ['email_unread_count'],
    queryFn: async () => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_email_unread_count');
      if (error) return 0;
      return (data as number) ?? 0;
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

// -------------------------------------------------------
// Threads (with client-side filtering)
// -------------------------------------------------------

export function useEmailThreads() {
  return useQuery({
    queryKey: ['email_threads'],
    queryFn: async () => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('email_threads')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return (data ?? []) as EmailThread[];
    },
    staleTime: 5_000,
  });
}

// -------------------------------------------------------
// Messages for a thread
// -------------------------------------------------------

export function useEmailMessages(threadId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['email_messages', threadId],
    queryFn: async () => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('email_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) throw error;
      return (data ?? []) as EmailMessage[];
    },
    enabled: !!threadId,
    staleTime: 5_000,
  });

  // Realtime: subscribe to messages for the active thread
  useEffect(() => {
    if (!threadId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`email_messages_${threadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['email_messages', threadId] });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [threadId, queryClient]);

  return query;
}

// -------------------------------------------------------
// Realtime (single centralized subscription)
// -------------------------------------------------------

/**
 * Single Realtime subscription for all email_threads changes.
 * Call this ONCE at the top level of the email inbox page.
 */
export function useEmailRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('posty_email_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'email_threads' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['email_threads'] });
          queryClient.invalidateQueries({ queryKey: ['email_unread_count'] });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);
}

// -------------------------------------------------------
// Mutations
// -------------------------------------------------------

/** Reply to an existing thread */
export function useReplyToThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId, body }: { threadId: string; body: string }) => {
      const res = await fetch('/api/email/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al enviar respuesta');
      return data as { id: string; providerId: string; status: string };
    },
    onSuccess: (_, vars) => {
      toast.success('Respuesta enviada');
      queryClient.invalidateQueries({ queryKey: ['email_messages', vars.threadId] });
      queryClient.invalidateQueries({ queryKey: ['email_threads'] });
      queryClient.invalidateQueries({ queryKey: ['email_unread_count'] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

/** Compose a new email (creates a new thread) */
export function useComposeEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      to: string;
      subject: string;
      body: string;
      guestId?: string;
    }) => {
      const res = await fetch('/api/email/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al enviar correo');
      return data as { id: string; threadId: string; providerId: string; status: string };
    },
    onSuccess: () => {
      toast.success('Correo enviado');
      queryClient.invalidateQueries({ queryKey: ['email_threads'] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

/** Mark a thread as read */
export function useMarkEmailThreadRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('mark_email_thread_read', {
        p_thread_id: threadId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_threads'] });
      queryClient.invalidateQueries({ queryKey: ['email_unread_count'] });
    },
  });
}

/** Assign a thread to a team member */
export function useAssignEmailThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      threadId,
      profileId,
    }: {
      threadId: string;
      profileId: string | null;
    }) => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('assign_email_thread', {
        p_thread_id: threadId,
        p_profile_id: profileId ?? undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Hilo asignado');
      queryClient.invalidateQueries({ queryKey: ['email_threads'] });
    },
    onError: () => toast.error('Error al asignar'),
  });
}

/** Open or close a thread */
export function useSetEmailThreadStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      threadId,
      status,
    }: {
      threadId: string;
      status: 'open' | 'closed';
    }) => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('set_email_thread_status', {
        p_thread_id: threadId,
        p_status: status,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.status === 'closed' ? 'Hilo cerrado' : 'Hilo reabierto');
      queryClient.invalidateQueries({ queryKey: ['email_threads'] });
    },
    onError: () => toast.error('Error al cambiar estado'),
  });
}

/** Link a guest to a thread */
export function useLinkGuestToThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      threadId,
      guestId,
    }: {
      threadId: string;
      guestId: string | null;
    }) => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('email_threads')
        .update({ guest_id: guestId })
        .eq('id', threadId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.guestId ? 'Huésped vinculado' : 'Huésped desvinculado');
      queryClient.invalidateQueries({ queryKey: ['email_threads'] });
    },
    onError: () => toast.error('Error al vincular huésped'),
  });
}

// -------------------------------------------------------
// Alias management
// -------------------------------------------------------

export function useEmailAlias() {
  return useQuery({
    queryKey: ['email_alias'],
    queryFn: async () => {
      const res = await fetch('/api/email/alias');
      if (!res.ok) return null;
      return res.json() as Promise<{
        alias: string | null;
        domain: string;
        fullAddress: string | null;
        createdAt: string | null;
      }>;
    },
    staleTime: 60_000,
  });
}

export function useUpdateEmailAlias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (alias: string) => {
      const res = await fetch('/api/email/alias', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al actualizar alias');
      return data as { alias: string; domain: string; fullAddress: string };
    },
    onSuccess: () => {
      toast.success('Alias de correo actualizado');
      queryClient.invalidateQueries({ queryKey: ['email_alias'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

export function useGenerateEmailAlias() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/email/alias', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al generar alias');
      return data as { alias: string; alreadyExists: boolean };
    },
  });
}

// -------------------------------------------------------
// Guest email threads (for guest detail page)
// -------------------------------------------------------

export function useGuestEmailThreads(guestId: string | null) {
  return useQuery({
    queryKey: ['guest_email_threads', guestId],
    queryFn: async () => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('email_threads')
        .select('id, subject, status, last_message_at, unread_count, sender_address')
        .eq('guest_id', guestId)
        .order('last_message_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        subject: string;
        status: string;
        last_message_at: string | null;
        unread_count: number;
        sender_address: string | null;
      }>;
    },
    enabled: !!guestId,
    staleTime: 30_000,
  });
}
