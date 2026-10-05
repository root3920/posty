'use client';

import { useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Name(s) of the contact(s) being deleted */
  contactNames: string[];
  /** Number of conversations to delete */
  count: number;
  /** Whether any conversation is linked to a guest */
  hasGuestLink: boolean;
  /** Guest name if linked */
  guestName?: string;
  /** Loading state */
  isPending: boolean;
  /** Called when the user confirms deletion */
  onConfirm: () => void;
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  contactNames,
  count,
  hasGuestLink,
  guestName,
  isPending,
  onConfirm,
}: DeleteConfirmationDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const needsTyping = count > 10;
  const canConfirm = needsTyping ? confirmText === 'ELIMINAR' : true;

  const title = count === 1
    ? `¿Eliminar la conversación con ${contactNames[0] || 'este contacto'}?`
    : `¿Eliminar ${count} conversaciones?`;

  function handleConfirm() {
    if (!canConfirm || isPending) return;
    onConfirm();
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(v) => { if (!v) setConfirmText(''); onOpenChange(v); }}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={!canConfirm || isPending}
          >
            {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Eliminar
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="text-sm">
            <p>
              Se borrarán todos los mensajes y archivos de POSTY.
              No se borra nada de WhatsApp en tu celular.
            </p>
            <p className="mt-1 font-medium text-destructive">
              Esta acción no se puede deshacer.
            </p>
          </div>
        </div>

        {hasGuestLink && guestName && (
          <p className="text-xs text-muted-foreground">
            Esta conversación está vinculada al huésped <strong>{guestName}</strong>.
            El huésped se conservará.
          </p>
        )}

        {count > 1 && (
          <p className="text-xs text-muted-foreground">
            Se eliminarán {count} conversaciones y todos sus mensajes.
          </p>
        )}

        {needsTyping && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Escribe <strong>ELIMINAR</strong> para confirmar:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="ELIMINAR"
              className="text-sm"
              autoFocus
            />
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
}
