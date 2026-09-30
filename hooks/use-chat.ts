'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface WhatsAppConnectionData {
  connectionId: string;
  status: string;
  connected: boolean;
  phone: string | null;
  displayName: string | null;
  profilePic: string | null;
  connectedAt: string | null;
}

export interface ChatConversation {
  id: string;
  organization_id: string;
  connection_id: string;
  contact_id: string | null;
  contact_phone_e164: string;
  contact_name: string | null;
  contact_pic_url: string | null;
  contact_lid: string | null;
  guest_id: string | null;
  assigned_to: string | null;
  status: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  is_hidden: boolean;
  tags: string[];
  last_inbound_at: string | null;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  external_id: string | null;
  direction: 'in' | 'out';
  type: string;
  body: string | null;
  media_path: string | null;
  media_mime: string | null;
  reply_to_id: string | null;
  status: string;
  error: string | null;
  sent_by: string | null;
  sent_from: string | null;
  created_at: string;
}

export interface ChatNote {
  id: string;
  conversation_id: string;
  author_id: string;
  body: string;
  created_at: string;
  // Joined
  author_name?: string;
}

// -------------------------------------------------------
// Connection hook (polls status API which syncs with Evolution)
// -------------------------------------------------------

export function useWhatsAppConnection() {
  return useQuery({
    queryKey: ['whatsapp_connection'],
    queryFn: async (): Promise<WhatsAppConnectionData | null> => {
      const res = await fetch('/api/whatsapp/status');
      if (res.status === 404 || res.status === 503) return null;
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.connectionId) return null;
      return data;
    },
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}

// -------------------------------------------------------
// Unread count (for sidebar badge)
// -------------------------------------------------------

export function useChatUnreadCount() {
  return useQuery({
    queryKey: ['chat_unread_count'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_chat_unread_count');
      if (error) return 0;
      return (data as number) ?? 0;
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

// -------------------------------------------------------
// Conversations (with Realtime)
// -------------------------------------------------------

export function useChatConversations(filter?: {
  status?: string;
  assignedToMe?: boolean;
  unreadOnly?: boolean;
  showHidden?: boolean;
}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['chat_conversations', filter],
    queryFn: async () => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from('chat_conversations')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (!filter?.showHidden) q = q.eq('is_hidden', false);
      if (filter?.status) q = q.eq('status', filter.status);
      if (filter?.unreadOnly) q = q.gt('unread_count', 0);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ChatConversation[];
    },
    staleTime: 5_000,
  });

  return query;
}

// -------------------------------------------------------
// Messages for a conversation (with Realtime)
// -------------------------------------------------------

/**
 * Single Realtime subscription for all chat_conversations changes.
 * Call this ONCE at the top level of the chat page — not inside each hook.
 */
export function useChatRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('posty_chat_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_conversations' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat_conversations'] });
          queryClient.invalidateQueries({ queryKey: ['chat_unread_count'] });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);
}

export function useChatMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['chat_messages', conversationId],
    queryFn: async () => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
    enabled: !!conversationId,
    staleTime: 5_000,
  });

  // Realtime: only for the selected conversation
  useEffect(() => {
    if (!conversationId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`chat_messages_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat_messages', conversationId] });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);

  return query;
}

// -------------------------------------------------------
// Notes for a conversation
// -------------------------------------------------------

export function useChatNotes(conversationId: string | null) {
  return useQuery({
    queryKey: ['chat_notes', conversationId],
    queryFn: async () => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('chat_notes')
        .select('*, author:profiles!chat_notes_author_id_fkey(full_name)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((n: any) => ({
        ...n,
        author_name: n.author?.full_name ?? null,
      })) as ChatNote[];
    },
    enabled: !!conversationId,
    staleTime: 30_000,
  });
}

// -------------------------------------------------------
// Mutations
// -------------------------------------------------------

export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const supabase = createClient();
      await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat_conversations'] });
      queryClient.invalidateQueries({ queryKey: ['chat_unread_count'] });
    },
  });
}

export function useAssignConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, profileId }: { conversationId: string; profileId: string | null }) => {
      const supabase = createClient();
      await supabase.rpc('assign_conversation', { p_conversation_id: conversationId, p_profile_id: profileId ?? undefined });
    },
    onSuccess: () => {
      toast.success('Conversación asignada');
      queryClient.invalidateQueries({ queryKey: ['chat_conversations'] });
    },
    onError: () => toast.error('Error al asignar'),
  });
}

export function useSetConversationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, status }: { conversationId: string; status: string }) => {
      const supabase = createClient();
      await supabase.rpc('set_conversation_status', { p_conversation_id: conversationId, p_status: status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat_conversations'] });
    },
  });
}

export function useAddChatNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, body }: { conversationId: string; body: string }) => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No auth');
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('chat_notes').insert({
        organization_id: profile?.organization_id,
        conversation_id: conversationId,
        author_id: user.id,
        body,
      });
    },
    onSuccess: (_, vars) => {
      toast.success('Nota guardada');
      queryClient.invalidateQueries({ queryKey: ['chat_notes', vars.conversationId] });
    },
    onError: () => toast.error('Error al guardar nota'),
  });
}

// -------------------------------------------------------
// Quick replies
// -------------------------------------------------------

export function useChatQuickReplies() {
  return useQuery({
    queryKey: ['chat_quick_replies'],
    queryFn: async () => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('chat_quick_replies')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; title: string; body: string; shortcut: string | null }>;
    },
    staleTime: 60_000,
  });
}

// -------------------------------------------------------
// Visibility control
// -------------------------------------------------------

export function useSetContactVisibility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contactId, visibility }: { contactId: string; visibility: 'auto' | 'visible' | 'hidden' }) => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc('set_contact_visibility', { p_contact_id: contactId, p_visibility: visibility });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat_conversations'] });
    },
  });
}

// -------------------------------------------------------
// Rename contact
// -------------------------------------------------------

export function useRenameContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contactId, customName }: { contactId: string; customName: string }) => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc('rename_chat_contact', { p_contact_id: contactId, p_custom_name: customName });
    },
    onSuccess: () => {
      toast.success('Nombre actualizado');
      queryClient.invalidateQueries({ queryKey: ['chat_conversations'] });
    },
    onError: () => toast.error('Error al renombrar'),
  });
}
