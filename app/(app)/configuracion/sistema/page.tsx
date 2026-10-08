'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Server, CheckCircle2, XCircle, Clock, RefreshCw, Mail, AlertTriangle, Pause, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/format';
import { toast } from 'sonner';
import type { OrgEmailStats, FailedWebhookEvent } from '@/app/api/email/admin/route';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  command: string;
  active: boolean;
}

interface CronRunDetail {
  runid: number;
  jobid: number;
  status: string;
  start_time: string;
  end_time: string | null;
  return_message: string | null;
}

// -------------------------------------------------------
// Fetch cron data
// -------------------------------------------------------

async function fetchCronStatus(): Promise<{
  jobs: CronJob[];
  recentRuns: CronRunDetail[];
}> {
  const supabase = createClient();

  // Fetch jobs from cron.job
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: jobs, error: jobsError } = await (supabase.rpc as any)('get_cron_jobs');

  // Fetch recent runs from cron.job_run_details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: runs, error: runsError } = await (supabase.rpc as any)('get_cron_run_details');

  if (jobsError) throw jobsError;

  return {
    jobs: (jobs ?? []) as CronJob[],
    recentRuns: (runs ?? []) as CronRunDetail[],
  };
}

// -------------------------------------------------------
// Schedule labels
// -------------------------------------------------------

function describeSchedule(cron: string): string {
  const map: Record<string, string> = {
    '* * * * *': 'Cada minuto',
    '*/5 * * * *': 'Cada 5 minutos',
    '*/15 * * * *': 'Cada 15 minutos',
    '*/30 * * * *': 'Cada 30 minutos',
    '0 * * * *': 'Cada hora',
    '0 6 * * *': 'Todos los días a las 06:00',
    '0 23 * * *': 'Todos los días a las 23:00',
    '55 23 * * *': 'Todos los días a las 23:55',
    '0 8 * * 1': 'Cada lunes a las 08:00',
  };
  return map[cron] ?? cron;
}

function describeCommand(cmd: string): { name: string; description: string } {
  if (cmd.includes('backfill_housekeeping_cleanings'))
    return { name: 'Limpieza: programación automática', description: 'Programa limpiezas para reservas nuevas, estancias activas y habitaciones sucias' };
  if (cmd.includes('process_recurring_tasks'))
    return { name: 'Tareas recurrentes', description: 'Crea tareas programadas según las reglas de repetición configuradas' };
  return { name: cmd.slice(0, 60), description: '' };
}

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function SistemaPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['cron_status'],
    queryFn: fetchCronStatus,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const jobs = data?.jobs ?? [];
  const recentRuns = data?.recentRuns ?? [];

  // If the RPC doesn't exist yet, show a fallback
  const rpcNotAvailable = error && String(error).includes('function');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procesos automáticos"
        description="Tareas programadas que se ejecutan en la base de datos"
      />

      {rpcNotAvailable ? (
        <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground space-y-2">
          <Server className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p>Las funciones de monitoreo de cron se configurarán pronto.</p>
          <p className="text-xs">pg_cron y pg_net están habilitados. Los procesos están corriendo.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          <Server className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p>No hay procesos programados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const info = describeCommand(job.command);
            const jobRuns = recentRuns
              .filter((r) => r.jobid === job.jobid)
              .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
            const lastRun = jobRuns[0];
            const lastSuccess = lastRun?.status === 'succeeded';
            const lastFailed = lastRun?.status === 'failed';

            return (
              <div key={job.jobid} className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{info.name}</h3>
                      <Badge variant={job.active ? 'default' : 'secondary'} className="text-[10px]">
                        {job.active ? 'Activo' : 'Pausado'}
                      </Badge>
                    </div>
                    {info.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{info.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {lastSuccess && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    {lastFailed && <XCircle className="h-4 w-4 text-destructive" />}
                    {!lastRun && <Clock className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" />
                    {describeSchedule(job.schedule)}
                  </span>
                  {lastRun && (
                    <span>
                      Última: {formatDate(lastRun.start_time, "d MMM HH:mm:ss")}
                      {lastFailed && lastRun.return_message && (
                        <span className="text-destructive ml-1">· {lastRun.return_message.slice(0, 80)}</span>
                      )}
                    </span>
                  )}
                  {!lastRun && <span>Sin ejecuciones aún</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inventory table */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Inventario de procesos programados</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-1.5">Proceso</th>
                <th className="px-2 py-1.5">Frecuencia</th>
                <th className="px-2 py-1.5">Descripción</th>
                <th className="px-2 py-1.5">Estado</th>
              </tr>
            </thead>
            <tbody>
              <ProcessRow name="Programación de limpiezas" freq="Cada 5 min" logic="Crea limpiezas para nuevas estancias automáticamente" status="activo" />
              <ProcessRow name="Repaso de habitaciones vacías" freq="Diario 06:00" logic="Por implementar" status="pendiente" />
              <ProcessRow name="Tareas recurrentes" freq="Cada minuto" logic="Genera tareas programadas según la configuración" status="activo" />
              <ProcessRow name="Alertas de limpieza vencida" freq="Cada hora" logic="Por implementar" status="pendiente" />
              <ProcessRow name="Pre-check-in automático" freq="Cada hora" logic="Por implementar" status="pendiente" />
              <ProcessRow name="Auditoría nocturna" freq="Diario 23:55" logic="Por implementar" status="pendiente" />
              <ProcessRow name="Reservas web vencidas (15 min)" freq="Cada 5 min" logic="Por implementar" status="pendiente" />
              <ProcessRow name="Resumen semanal del Gestor" freq="Lunes 08:00" logic="Por implementar" status="pendiente" />
              <ProcessRow name="Correos automáticos" freq="Cada hora" logic="Por implementar" status="pendiente" />
              <ProcessRow name="Escalamiento de incidencias SLA" freq="Cada 5 min" logic="Por implementar" status="pendiente" />
            </tbody>
          </table>
        </div>
      </div>
      {/* Email platform stats */}
      <EmailPlatformStats />
    </div>
  );
}

// -------------------------------------------------------
// Email Platform Stats (admin panel — A8)
// -------------------------------------------------------

function EmailPlatformStats() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['email_platform_stats'],
    queryFn: async () => {
      const res = await fetch('/api/email/admin');
      if (!res.ok) return null;
      const json = await res.json();
      return {
        stats: json.stats as OrgEmailStats[],
        failedEvents: (json.failedEvents ?? []) as FailedWebhookEvent[],
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const handleTogglePause = async (orgId: string, pause: boolean) => {
    const res = await fetch('/api/email/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, paused: pause }),
    });
    if (res.ok) {
      toast.success(pause ? 'Correo pausado' : 'Correo reactivado');
      queryClient.invalidateQueries({ queryKey: ['email_platform_stats'] });
    } else {
      toast.error('Error al actualizar');
    }
  };

  if (error) return null;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Correo electrónico — Estado por hotel</h3>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      ) : !data?.stats || data.stats.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Sin datos de correo</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-1.5">Hotel</th>
                <th className="px-2 py-1.5">Alias</th>
                <th className="px-2 py-1.5 text-right">Hoy</th>
                <th className="px-2 py-1.5 text-right">Mes</th>
                <th className="px-2 py-1.5 text-right">Rebotes</th>
                <th className="px-2 py-1.5 text-right">Quejas</th>
                <th className="px-2 py-1.5 text-right">Hilos</th>
                <th className="px-2 py-1.5">Estado</th>
                <th className="px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {data.stats.map((org) => {
                const hasWarning = org.bounce_rate >= 3 || org.complaint_rate >= 0.05;
                const hasDanger = org.bounce_rate >= 5 || org.complaint_rate >= 0.1;
                return (
                  <tr key={org.org_id} className="border-b last:border-0">
                    <td className="px-2 py-2 font-medium">{org.org_name}</td>
                    <td className="px-2 py-2 font-mono text-muted-foreground">
                      {org.alias || '—'}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{org.sent_today}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{org.sent_month}</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${hasDanger ? 'text-red-600 font-semibold' : hasWarning ? 'text-amber-600' : ''}`}>
                      {org.bounces_30d}
                      {org.total_sent_30d > 0 && (
                        <span className="text-muted-foreground ml-1">({org.bounce_rate.toFixed(1)}%)</span>
                      )}
                    </td>
                    <td className={`px-2 py-2 text-right tabular-nums ${org.complaint_rate >= 0.1 ? 'text-red-600 font-semibold' : org.complaint_rate >= 0.05 ? 'text-amber-600' : ''}`}>
                      {org.complaints_30d}
                      {org.total_sent_30d > 0 && (
                        <span className="text-muted-foreground ml-1">({org.complaint_rate.toFixed(2)}%)</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{org.thread_count}</td>
                    <td className="px-2 py-2">
                      {org.email_paused ? (
                        <Badge variant="destructive" className="gap-1 text-[9px]">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Pausado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-[9px] border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Activo
                        </Badge>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => handleTogglePause(org.org_id, !org.email_paused)}
                        title={org.email_paused ? 'Reactivar correo' : 'Pausar correo'}
                      >
                        {org.email_paused ? (
                          <Play className="h-3 w-3 text-green-600" />
                        ) : (
                          <Pause className="h-3 w-3 text-amber-600" />
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Pausa automática: rebotes &gt; 5% o quejas &gt; 0,1% en 30 días.
      </p>

      {/* Failed webhook events */}
      {data?.failedEvents && data.failedEvents.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center gap-2">
            <XCircle className="h-3.5 w-3.5 text-destructive" />
            <h4 className="text-xs font-semibold">Correos que fallaron al procesar ({data.failedEvents.length})</h4>
          </div>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {data.failedEvents.map((evt) => (
              <div key={evt.id} className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs dark:border-red-900 dark:bg-red-950/20">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-[10px] text-muted-foreground">{evt.id.slice(0, 12)}…</span>
                    {evt.failed_step && (
                      <Badge variant="outline" className="ml-2 text-[9px]">{evt.failed_step}</Badge>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {formatDate(evt.processed_at, 'dd/MM HH:mm')}
                  </span>
                </div>
                {evt.error && (
                  <p className="mt-1 text-red-700 dark:text-red-400">{evt.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProcessRow({ name, freq, logic, status }: { name: string; freq: string; logic: string; status: 'activo' | 'pendiente' }) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-2 py-1.5 font-medium">{name}</td>
      <td className="px-2 py-1.5 text-muted-foreground">{freq}</td>
      <td className="px-2 py-1.5 text-muted-foreground">{logic}</td>
      <td className="px-2 py-1.5">
        <Badge variant={status === 'activo' ? 'default' : 'outline'} className="text-[9px]">
          {status === 'activo' ? 'Activo' : 'Pendiente'}
        </Badge>
      </td>
    </tr>
  );
}
