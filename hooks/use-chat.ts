'use client';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// Connection — calls the status API which runs sync (queries Evolution + updates DB)
export function useWhatsAppConnection() {
  return useQuery({
    queryKey: ['whatsapp_connection'],
    queryFn: async () => {
      const res = await fetch('/api/whatsapp/status');
      if (res.status === 404 || res.status === 503) return null;
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.connectionId) return null;
      return data as {
        connectionId: string;
        status: string;
        connected: boolean;
        phone: string | null;
        displayName: string | null;
        profilePic: string | null;
        connectedAt: string | null;
      };
    },
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}

// Conversations
export function useChatConversations() {
  return useQuery({
    queryKey: ['chat_conversations'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await (supabase as any)
        .from('chat_conversations')
        .select('*')
        .eq('is_hidden', false)
        .order('last_message_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        contact_phone_e164: string;
        contact_name: string | null;
        last_message_at: string | null;
        last_message_preview: string | null;
        unread_count: number;
        status: string;
      }>;
    },
    staleTime: 3_000,
    refetchInterval: 3_000,
  });
}

// Messages for a conversation
export function useChatMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['chat_messages', conversationId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await (supabase as any)
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        direction: 'in' | 'out';
        type: string;
        body: string | null;
        status: string;
        sent_from: string | null;
        created_at: string;
        external_id: string | null;
      }>;
    },
    enabled: !!conversationId,
    staleTime: 2_000,
    refetchInterval: 3_000,
  });
}
