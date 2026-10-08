'use client';

import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { useComposeEmail } from '@/hooks/use-email-inbox';

interface ComposeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill recipient (e.g., from guest detail page) */
  defaultTo?: string;
  /** Pre-fill guest ID for linking */
  guestId?: string;
}

export function ComposeEmailDialog({
  open,
  onOpenChange,
  defaultTo,
  guestId,
}: ComposeEmailDialogProps) {
  const [to, setTo] = useState(defaultTo ?? '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const compose = useComposeEmail();

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) return;

    compose.mutate(
      { to: to.trim(), subject: subject.trim(), body: body.trim(), guestId },
      {
        onSuccess: () => {
          setTo(defaultTo ?? '');
          setSubject('');
          setBody('');
          onOpenChange(false);
        },
      },
    );
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setTo(defaultTo ?? '');
      setSubject('');
      setBody('');
    }
    onOpenChange(open);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Redactar correo"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={!to.trim() || !subject.trim() || !body.trim() || compose.isPending}
          >
            {compose.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-4 w-4" />
            )}
            Enviar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="compose-to">Para</Label>
          <Input
            id="compose-to"
            type="email"
            placeholder="correo@ejemplo.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="compose-subject">Asunto</Label>
          <Input
            id="compose-subject"
            placeholder="Asunto del correo"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="compose-body">Mensaje</Label>
          <Textarea
            id="compose-body"
            placeholder="Escribe tu mensaje..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="min-h-[120px] resize-none"
          />
        </div>
      </div>
    </ResponsiveDialog>
  );
}
