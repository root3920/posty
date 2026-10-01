'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { useInstagramConnection } from '@/hooks/use-instagram';
import { formatDateOnly } from '@/lib/dates';
import { cn } from '@/lib/utils';

// -------------------------------------------------------
// Token expiry check
// -------------------------------------------------------

function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

// -------------------------------------------------------
// Not connected view
// -------------------------------------------------------

function NotConnectedView() {
  const [isConnecting, setIsConnecting] = useState(false);

  async function handleConnect() {
    setIsConnecting(true);
    try {
      // This API redirects to Instagram OAuth flow
      window.location.href = '/api/instagram/authorize';
    } catch {
      toast.error('No se pudo iniciar la conexion con Instagram');
      setIsConnecting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conectar Instagram"
        description="Vincula tu cuenta profesional de Instagram para gestionar tus publicaciones"
      />

      <div className="mx-auto max-w-md space-y-6">
        {/* Requirements card */}
        <div className="rounded-xl border bg-muted/30 p-5 space-y-3">
          <p className="text-sm font-semibold">Requisitos</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-primary/15 text-center text-[10px] font-bold leading-4 text-primary">1</span>
              Tu cuenta debe ser profesional (Empresa o Creador)
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-primary/15 text-center text-[10px] font-bold leading-4 text-primary">2</span>
              Mientras POSTY esta en revision con Meta, solo se pueden conectar cuentas autorizadas como prueba
            </li>
          </ul>
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={handleConnect}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Camera className="mr-2 h-4 w-4" />
          )}
          Conectar Instagram
        </Button>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Connected view
// -------------------------------------------------------

function ConnectedView() {
  const { data: connection, isLoading } = useInstagramConnection();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [profileImgError, setProfileImgError] = useState(false);

  if (isLoading || !connection) return null;

  const expired = isTokenExpired(connection.token_expires_at);

  async function handleDisconnect() {
    setIsDisconnecting(true);
    try {
      const res = await fetch('/api/instagram/disconnect', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'No se pudo desconectar');
      }
      toast.success('Cuenta de Instagram desconectada');
      queryClient.invalidateQueries({ queryKey: ['instagram_connection'] });
      queryClient.invalidateQueries({ queryKey: ['instagram_media'] });
      setDisconnectOpen(false);
      router.push('/configuracion');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al desconectar');
    } finally {
      setIsDisconnecting(false);
    }
  }

  async function handleReconnect() {
    setIsReconnecting(true);
    try {
      window.location.href = '/api/instagram/authorize';
    } catch {
      toast.error('No se pudo iniciar la reconexion');
      setIsReconnecting(false);
    }
  }

  const profilePicUrl = connection.profile_picture_url;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Instagram"
        description="Gestiona la conexion con tu cuenta de Instagram"
      />

      <div className="mx-auto max-w-md space-y-5">
        {/* Profile card */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            {profilePicUrl && !profileImgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profilePicUrl}
                alt={connection.username ?? 'Perfil'}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-border"
                onError={() => setProfileImgError(true)}
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400">
                <Camera className="h-7 w-7 text-white" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              {connection.username && (
                <p className="font-semibold">@{connection.username}</p>
              )}
              {connection.name && (
                <p className="text-sm text-muted-foreground">{connection.name}</p>
              )}
              {connection.account_type && (
                <p className="text-xs text-muted-foreground capitalize">
                  {connection.account_type === 'BUSINESS' ? 'Empresa' : connection.account_type === 'CREATOR' ? 'Creador' : connection.account_type}
                </p>
              )}
            </div>
            {connection.username && (
              <a
                href={`https://www.instagram.com/${connection.username}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ver en Instagram"
                className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3">
            <div className="text-center">
              <p className="font-heading text-base font-bold tabular-nums">
                {connection.media_count.toLocaleString('es')}
              </p>
              <p className="text-[11px] text-muted-foreground">publicaciones</p>
            </div>
            <div className="text-center">
              <p className="font-heading text-base font-bold tabular-nums">
                {connection.followers_count.toLocaleString('es')}
              </p>
              <p className="text-[11px] text-muted-foreground">seguidores</p>
            </div>
            <div className="text-center">
              <p className="font-heading text-base font-bold tabular-nums">
                {connection.follows_count.toLocaleString('es')}
              </p>
              <p className="text-[11px] text-muted-foreground">siguiendo</p>
            </div>
          </div>
        </div>

        {/* Token status */}
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl border p-4',
            expired
              ? 'border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-950/20'
              : 'border-green-200 bg-green-50 dark:border-green-800/40 dark:bg-green-950/20',
          )}
        >
          {expired ? (
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
          )}
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'text-sm font-medium',
                expired
                  ? 'text-red-700 dark:text-red-400'
                  : 'text-green-700 dark:text-green-400',
              )}
            >
              {expired ? 'Token expirado' : `Vigente hasta ${formatDateOnly(connection.token_expires_at)}`}
            </p>
            {!expired && (
              <p className="text-xs text-muted-foreground">El token se renueva automaticamente</p>
            )}
          </div>
          {expired && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleReconnect}
              disabled={isReconnecting}
              className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-400"
            >
              {isReconnecting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Reconectar
            </Button>
          )}
        </div>

        {/* Disconnect */}
        <div className="pt-2">
          <Button
            variant="outline"
            className="w-full text-destructive hover:border-destructive hover:bg-destructive/5"
            onClick={() => setDisconnectOpen(true)}
          >
            Desconectar cuenta
          </Button>
        </div>
      </div>

      {/* Disconnect confirmation */}
      <ResponsiveDialog
        open={disconnectOpen}
        onOpenChange={(open) => { if (!open) setDisconnectOpen(false); }}
        title="Desconectar Instagram"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDisconnectOpen(false)} disabled={isDisconnecting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Desconectar
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          Al desconectar tu cuenta de Instagram, ya no podras ver tus publicaciones desde POSTY. Podras volver a conectar tu cuenta en cualquier momento.
        </p>
      </ResponsiveDialog>
    </div>
  );
}

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function InstagramConfigPage() {
  const { data: connection, isLoading } = useInstagramConnection();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!connection) {
    return <NotConnectedView />;
  }

  return <ConnectedView />;
}
