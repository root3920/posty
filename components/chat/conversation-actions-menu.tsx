'use client';

import { useState } from 'react';
import { MoreVertical, EyeOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePermissions } from '@/hooks/use-permissions';
import { useSetContactVisibility, type ChatConversation } from '@/hooks/use-chat';
import { useDeleteConversation } from '@/hooks/use-chat-delete';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';

interface ConversationActionsMenuProps {
  conversation: ChatConversation;
  /** Called after deletion (e.g. to clear selectedId) */
  onDeleted?: () => void;
  /** Size variant for the trigger button */
  size?: 'sm' | 'md';
}

export function ConversationActionsMenu({ conversation, onDeleted, size = 'md' }: ConversationActionsMenuProps) {
  const { has } = usePermissions();
  const canDelete = has('chat.delete_conversations');
  const setVisibility = useSetContactVisibility();
  const deleteConversation = useDeleteConversation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isHidden = conversation.is_hidden;
  const contactName = conversation.contact_name || conversation.contact_phone_e164;

  function handleHide() {
    if (!conversation.contact_id) return;
    setVisibility.mutate({
      contactId: conversation.contact_id,
      visibility: isHidden ? 'auto' : 'hidden',
    });
  }

  function handleDelete() {
    setConfirmOpen(true);
  }

  function handleConfirmDelete() {
    deleteConversation.mutate(conversation.id, {
      onSuccess: () => {
        setConfirmOpen(false);
        onDeleted?.();
      },
    });
  }

  // Nothing to show if no actions available
  if (!canDelete && !conversation.contact_id) return null;

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const btnSize = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className={`${btnSize} shrink-0 text-muted-foreground`}
              aria-label="Acciones de conversación"
            />
          }
        >
          <MoreVertical className={iconSize} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {conversation.contact_id && (
            <DropdownMenuItem onClick={handleHide}>
              <EyeOff className="mr-2 h-4 w-4" />
              {isHidden ? 'Mostrar conversación' : 'Ocultar conversación'}
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar conversación
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        contactNames={[contactName]}
        count={1}
        hasGuestLink={!!conversation.guest_id}
        isPending={deleteConversation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
