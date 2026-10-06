'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, Trash2, RefreshCw, Loader2, ImageIcon } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024;

interface LogoUploadCardProps {
  currentLogoUrl: string | null;
}

export function LogoUploadCard({ currentLogoUrl }: LogoUploadCardProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [imgError, setImgError] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error('Formato no permitido. Usa PNG, JPG o WEBP');
      }
      if (file.size > MAX_SIZE) {
        throw new Error('El archivo es muy grande. Máximo 2 MB');
      }
      const formData = new FormData();
      formData.append('logo', file);
      const res = await fetch('/api/settings/logo', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Error al subir el logo');
      }
      return res.json() as Promise<{ logoUrl: string }>;
    },
    onSuccess: () => {
      toast.success('Logo actualizado');
      setImgError(false);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al subir'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/settings/logo', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Error al quitar el logo');
      }
    },
    onSuccess: () => {
      toast.success('Logo eliminado');
      setImgError(false);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error'),
  });

  const handleFile = useCallback((file: File) => {
    uploadMutation.mutate(file);
  }, [uploadMutation]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  const isPending = uploadMutation.isPending || deleteMutation.isPending;
  const hasLogo = currentLogoUrl && !imgError;

  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <h2 className="text-sm font-semibold">Logo del hotel</h2>

      <div className="flex items-center gap-4">
        {/* Preview / drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !isPending && inputRef.current?.click()}
          className={cn(
            'flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed transition-colors',
            dragOver ? 'border-primary bg-primary/5' : 'bg-muted',
            isPending && 'pointer-events-none opacity-60',
          )}
        >
          {isPending ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentLogoUrl}
              alt="Logo del hotel"
              className="h-full w-full rounded-xl object-contain p-1"
              onError={() => setImgError(true)}
            />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
          )}
        </div>

        {/* Actions */}
        <div className="space-y-1.5">
          {hasLogo ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => inputRef.current?.click()}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Cambiar logo
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm('¿Quitar el logo del hotel?')) deleteMutation.mutate();
                }}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Quitar
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Subir logo
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            PNG, JPG o WEBP · máx. 2 MB · recomendado: cuadrado, fondo transparente
          </p>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
