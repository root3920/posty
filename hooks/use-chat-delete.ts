'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { getSupabaseErrorMessage, logSupabaseError } from '@/lib/supabase/errors';

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('delete_chat_conversation', {
        p_conversation_id: conversationId,
      });
      if (error) throw error;
      return data as { success: boolean; messages_deleted: number; contact_deleted: boolean; media_paths: string[] };
    },
    onSuccess: () => {
      toast.success('Conversación eliminada');
      queryClient.invalidateQueries({ queryKey: ['chat_conversations'] });
      queryClient.invalidateQueries({ queryKey: ['chat_unread_count'] });
    },
    onError: (err) => {
      logSupabaseError(err, 'deleteConversation');
      toast.error(getSupabaseErrorMessage(err, 'Eliminar conversación'));
    },
  });
}

export function useDeleteConversationsBulk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationIds: string[]) => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('delete_chat_conversations_bulk', {
        p_conversation_ids: conversationIds,
      });
      if (error) throw error;
      return data as { success: boolean; conversations_deleted: number; total_messages_deleted: number };
    },
    onSuccess: (data) => {
      toast.success(`${data.conversations_deleted} conversación${data.conversations_deleted !== 1 ? 'es' : ''} eliminada${data.conversations_deleted !== 1 ? 's' : ''}`);
      queryClient.invalidateQueries({ queryKey: ['chat_conversations'] });
      queryClient.invalidateQueries({ queryKey: ['chat_unread_count'] });
    },
    onError: (err) => {
      logSupabaseError(err, 'deleteConversationsBulk');
      toast.error(getSupabaseErrorMessage(err, 'Eliminar conversaciones'));
    },
  });
}
