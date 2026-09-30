'use client';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// Connection
export function useWhatsAppConnection() {
  return useQuery({
    queryKey: ['whatsapp_connection'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await (supabase as any)
        .from('whatsapp_connections')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        status: string;
        instance_name: string;
        phone_e164: string | null;
        display_name: string | null;
        profile_pic_url: string | null;
        account_type: string;
      } | null;
    },
    staleTime: 10_000,
    refetchInterval: 5_000,
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
