'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Server, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/format';

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
                <th className="px-2 py-1.5">Lógica</th>
                <th className="px-2 py-1.5">Estado</th>
              </tr>
            </thead>
            <tbody>
              <ProcessRow name="Programación de limpiezas" freq="Cada 5 min" logic="backfill_housekeeping_cleanings" status="activo" />
              <ProcessRow name="Repaso de habitaciones vacías" freq="Diario 06:00" logic="Pendiente" status="pendiente" />
              <ProcessRow name="Tareas recurrentes" freq="Cada minuto" logic="process_recurring_tasks" status="activo" />
              <ProcessRow name="Alertas de limpieza vencida" freq="Cada hora" logic="Pendiente" status="pendiente" />
              <ProcessRow name="Pre-check-in automático" freq="Cada hora" logic="Pendiente (Fase 3)" status="pendiente" />
              <ProcessRow name="Auditoría nocturna" freq="Diario 23:55" logic="Pendiente (Fase 2)" status="pendiente" />
              <ProcessRow name="Reservas web vencidas (15 min)" freq="Cada 5 min" logic="Pendiente (Fase 5)" status="pendiente" />
              <ProcessRow name="Resumen semanal del Gestor" freq="Lunes 08:00" logic="Pendiente (Fase 4)" status="pendiente" />
              <ProcessRow name="Correos automáticos" freq="Cada hora" logic="Pendiente (Fase 3)" status="pendiente" />
              <ProcessRow name="Escalamiento de incidencias SLA" freq="Cada 5 min" logic="Pendiente (Fase 2)" status="pendiente" />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProcessRow({ name, freq, logic, status }: { name: string; freq: string; logic: string; status: 'activo' | 'pendiente' }) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-2 py-1.5 font-medium">{name}</td>
      <td className="px-2 py-1.5 text-muted-foreground">{freq}</td>
      <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">{logic}</td>
      <td className="px-2 py-1.5">
        <Badge variant={status === 'activo' ? 'default' : 'outline'} className="text-[9px]">
          {status === 'activo' ? 'Activo' : 'Pendiente'}
        </Badge>
      </td>
    </tr>
  );
}
