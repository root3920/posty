'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Sparkles,
  Plus,
  Calendar,
  Play,
  CheckCircle2,
  Eye,
  AlertTriangle,
  Clock,
  BedDouble,
  MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { KpiGrid } from '@/components/shared/kpi-grid';
import { KpiCard, KpiCardSkeleton } from '@/components/shared/kpi-card';
import { PageHeader } from '@/components/shared/page-header';
import { Fab } from '@/components/layout/fab';
import { ScheduleCleaningDialog } from '@/components/housekeeping/schedule-cleaning-dialog';
import {
  useTodayCleanings,
  useHousekeepingKPIs,
  useRoomCleaningStatus,
  useCleaningHistory,
  type CleaningRow,
} from '@/hooks/use-housekeeping';
import { usePermissions } from '@/hooks/use-permissions';
import { startCleaningAction, completeCleaningAction, skipCleaningAction, inspectCleaningAction, cancelCleaningAction } from '@/app/actions/housekeeping';
import { useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@/lib/format';

// -------------------------------------------------------
// Status labels
// -------------------------------------------------------

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Programada', color: 'bg-info/15 text-info' },
  in_progress: { label: 'En curso', color: 'bg-warning/15 text-warning' },
  completed: { label: 'Completada', color: 'bg-success/15 text-success' },
  skipped: { label: 'Omitida', color: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelada', color: 'bg-muted text-muted-foreground' },
};

const ORIGIN_LABELS: Record<string, string> = {
  auto_weekly: 'Semanal',
  pre_arrival: 'Pre-llegada',
  checkout: 'Salida',
  guest_request: 'A pedido',
  manual: 'Manual',
};

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function LimpiezaPage() {
  const [activeTab, setActiveTab] = useState<string>('hoy');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const { has: hasPerm } = usePermissions();

  const tabs = [
    { key: 'hoy', label: 'Hoy' },
    { key: 'habitaciones', label: 'Habitaciones' },
    { key: 'reportes', label: 'Reportes' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Limpieza"
        description={format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
        actions={
          hasPerm('housekeeping.manage') ? (
            <Button size="sm" onClick={() => setScheduleOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Programar limpieza
            </Button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'hoy' && <TodayTab onSchedule={() => setScheduleOpen(true)} />}
      {activeTab === 'habitaciones' && <HabitacionesTab />}
      {activeTab === 'reportes' && <ReportesTab />}

      <ScheduleCleaningDialog open={scheduleOpen} onOpenChange={setScheduleOpen} />

      {hasPerm('housekeeping.manage') && (
        <Fab icon={Plus} onClick={() => setScheduleOpen(true)} label="Programar limpieza" />
      )}
    </div>
  );
}

// -------------------------------------------------------
// Tab: Hoy
// -------------------------------------------------------

function TodayTab({ onSchedule }: { onSchedule?: () => void }) {
  const { data: cleanings = [], isLoading } = useTodayCleanings();
  const kpis = useHousekeepingKPIs();
  const queryClient = useQueryClient();
  const { has: hasPerm } = usePermissions();

  const canExecute = hasPerm('housekeeping.execute');
  const canManage = hasPerm('housekeeping.manage');

  // Group by status for the board
  const groups = useMemo(() => {
    const scheduled = cleanings.filter((c) => c.status === 'scheduled');
    const inProgress = cleanings.filter((c) => c.status === 'in_progress');
    const pendingInspection = cleanings.filter((c) => c.status === 'completed' && c.inspection_status === 'pending');
    const done = cleanings.filter((c) => c.status === 'completed' && c.inspection_status !== 'pending');
    return { scheduled, inProgress, pendingInspection, done };
  }, [cleanings]);

  async function handleStart(id: string) {
    const result = await startCleaningAction(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Limpieza iniciada · Hab. ${(result as { room_number?: string }).room_number}`);
      queryClient.invalidateQueries({ queryKey: ['today_cleanings'] });
      queryClient.invalidateQueries({ queryKey: ['room_cleaning_status'] });
    }
  }

  async function handleComplete(id: string) {
    const result = await completeCleaningAction(id, {});
    if (result.error) {
      toast.error(result.error);
    } else {
      const r = result as { room_number?: string; duration_minutes?: number; next_cleaning_date?: string };
      let msg = `Limpieza completada · Hab. ${r.room_number}`;
      if (r.duration_minutes) msg += ` · ${Math.round(r.duration_minutes)} min`;
      if (r.next_cleaning_date) msg += ` · Próxima: ${formatDate(r.next_cleaning_date)}`;
      toast.success(msg);
      queryClient.invalidateQueries({ queryKey: ['today_cleanings'] });
      queryClient.invalidateQueries({ queryKey: ['room_cleaning_status'] });
    }
  }

  async function handleCancel(id: string) {
    const result = await cancelCleaningAction(id, 'Cancelada manualmente');
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Limpieza cancelada');
      queryClient.invalidateQueries({ queryKey: ['today_cleanings'] });
      queryClient.invalidateQueries({ queryKey: ['room_cleaning_status'] });
    }
  }

  async function handleInspect(id: string, approved: boolean) {
    const result = await inspectCleaningAction(id, approved, approved ? undefined : 'Revisar nuevamente');
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(approved ? 'Inspección aprobada' : 'Inspección rechazada — limpieza reactivada');
      queryClient.invalidateQueries({ queryKey: ['today_cleanings'] });
      queryClient.invalidateQueries({ queryKey: ['room_cleaning_status'] });
    }
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <KpiGrid>
        {isLoading ? (
          [...Array(5)].map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          <>
            <KpiCard icon={<Calendar className="h-5 w-5" />} label="Programadas" value={kpis.scheduled} />
            <KpiCard icon={<Play className="h-5 w-5" />} label="En curso" value={kpis.inProgress} />
            <KpiCard icon={<CheckCircle2 className="h-5 w-5" />} label="Completadas" value={kpis.completed} />
            <KpiCard icon={<Eye className="h-5 w-5" />} label="Por inspeccionar" value={kpis.pendingInspection} />
            <KpiCard icon={<AlertTriangle className="h-5 w-5" />} label="Atrasadas" value={kpis.overdue} />
          </>
        )}
      </KpiGrid>

      {/* Board */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : cleanings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Sparkles className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No hay limpiezas programadas para hoy</p>
          {onSchedule && (
            <Button variant="outline" size="sm" className="mt-3" onClick={onSchedule}>
              <Plus className="mr-1.5 h-4 w-4" />
              Programar limpieza
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <BoardColumn title="Programadas" count={groups.scheduled.length} color="text-info">
            {groups.scheduled.map((c) => (
              <CleaningCard key={c.id} cleaning={c} onStart={canExecute ? () => handleStart(c.id) : undefined} onCancel={canManage ? () => handleCancel(c.id) : undefined} />
            ))}
          </BoardColumn>
          <BoardColumn title="En curso" count={groups.inProgress.length} color="text-warning">
            {groups.inProgress.map((c) => (
              <CleaningCard key={c.id} cleaning={c} onComplete={canExecute ? () => handleComplete(c.id) : undefined} />
            ))}
          </BoardColumn>
          <BoardColumn title="Por inspeccionar" count={groups.pendingInspection.length} color="text-purple-500">
            {groups.pendingInspection.map((c) => (
              <CleaningCard
                key={c.id}
                cleaning={c}
                onInspectApprove={canManage ? () => handleInspect(c.id, true) : undefined}
                onInspectReject={canManage ? () => handleInspect(c.id, false) : undefined}
              />
            ))}
          </BoardColumn>
          <BoardColumn title="Listas" count={groups.done.length} color="text-success">
            {groups.done.map((c) => (
              <CleaningCard key={c.id} cleaning={c} />
            ))}
          </BoardColumn>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------
// Board column
// -------------------------------------------------------

function BoardColumn({ title, count, color, children }: {
  title: string; count: number; color: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold uppercase tracking-wide ${color}`}>{title}</span>
        <Badge variant="secondary" className="text-[10px]">{count}</Badge>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

// -------------------------------------------------------
// Cleaning card
// -------------------------------------------------------

function CleaningCard({ cleaning, onStart, onComplete, onInspectApprove, onInspectReject, onCancel }: {
  cleaning: CleaningRow;
  onStart?: () => void;
  onComplete?: () => void;
  onInspectApprove?: () => void;
  onInspectReject?: () => void;
  onCancel?: () => void;
}) {
  const ct = cleaning.cleaning_type;
  const room = cleaning.room;
  const isOverdue = cleaning.status === 'scheduled' && new Date(cleaning.scheduled_for) < new Date();

  return (
    <div className="rounded-xl border bg-card p-3 space-y-2 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BedDouble className="h-4 w-4 text-muted-foreground" />
          <span className="font-bold text-sm">{room?.number ?? '—'}</span>
          <span className="text-[10px] text-muted-foreground">P{room?.floor ?? '?'}</span>
        </div>
        <div className="flex items-center gap-1">
          {ct && (
            <Badge
              variant="outline"
              className="text-[10px]"
              style={{ borderColor: ct.color, color: ct.color }}
            >
              {ct.name}
            </Badge>
          )}
          {onCancel && (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onCancel} className="text-destructive">
                  Cancelar limpieza
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        {format(new Date(cleaning.scheduled_for), 'HH:mm')}
        {isOverdue && <span className="text-destructive font-medium">Atrasada</span>}
      </div>

      {cleaning.assigned_profile?.full_name && (
        <p className="text-[11px] text-muted-foreground truncate">
          {cleaning.assigned_profile.full_name}
        </p>
      )}

      {cleaning.duration_minutes != null && (
        <p className="text-[11px] text-muted-foreground">
          {Math.round(cleaning.duration_minutes)} min
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-1.5 pt-1">
        {onStart && (
          <Button size="sm" className="h-8 flex-1 text-xs gap-1" onClick={onStart}>
            <Play className="h-3.5 w-3.5" /> Iniciar
          </Button>
        )}
        {onComplete && (
          <Button size="sm" className="h-8 flex-1 text-xs gap-1" onClick={onComplete}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Finalizar
          </Button>
        )}
        {onInspectApprove && (
          <>
            <Button size="sm" className="h-8 flex-1 text-xs gap-1" onClick={onInspectApprove}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onInspectReject}>
              Rechazar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Tab: Habitaciones
// -------------------------------------------------------

function HabitacionesTab() {
  const { data: rooms = [], isLoading } = useRoomCleaningStatus();

  const hkLabels: Record<string, string> = { clean: 'Limpia', dirty: 'Sucia', inspected: 'Inspeccionada', cleaning: 'En limpieza' };
  const hkColors: Record<string, string> = { clean: 'bg-success/15 text-success', dirty: 'bg-danger/15 text-danger', inspected: 'bg-info/15 text-info', cleaning: 'bg-warning/15 text-warning' };

  if (isLoading) {
    return <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;
  }

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
        <BedDouble className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No hay habitaciones</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
            <th className="px-4 py-2">Hab.</th>
            <th className="px-4 py-2">Tipo</th>
            <th className="px-4 py-2">Limpieza</th>
            <th className="px-4 py-2 hidden md:table-cell">Ocupación</th>
            <th className="px-4 py-2 hidden md:table-cell">Última</th>
            <th className="px-4 py-2 hidden lg:table-cell">Próxima</th>
            <th className="px-4 py-2">Días</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((r) => (
            <tr key={r.room_id} className="border-b hover:bg-muted/30 transition-colors">
              <td className="px-4 py-2 font-bold">{r.room_number}</td>
              <td className="px-4 py-2 text-muted-foreground">{r.room_type_name ?? '—'}</td>
              <td className="px-4 py-2">
                <Badge variant="outline" className={`text-[10px] ${hkColors[r.housekeeping_status] ?? ''}`}>
                  {hkLabels[r.housekeeping_status] ?? r.housekeeping_status}
                </Badge>
              </td>
              <td className="px-4 py-2 hidden md:table-cell">
                {r.current_stay_id
                  ? <span className="text-xs">{r.guest_first_name} {r.guest_last_name}</span>
                  : <span className="text-xs text-muted-foreground">Vacía</span>}
              </td>
              <td className="px-4 py-2 hidden md:table-cell">
                {r.last_cleaning_at ? <span className="text-xs">{formatDate(r.last_cleaning_at, 'd MMM HH:mm')}</span> : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-4 py-2 hidden lg:table-cell">
                {r.next_cleaning_at ? <span className="text-xs">{formatDate(r.next_cleaning_at, 'd MMM HH:mm')}</span> : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-4 py-2">
                <span className={r.is_overdue ? 'text-destructive font-bold' : ''}>
                  {r.days_since_last}d{r.is_overdue && ' ⚠'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -------------------------------------------------------
// Tab: Reportes
// -------------------------------------------------------

function ReportesTab() {
  const { data: history = [], isLoading } = useCleaningHistory({});

  if (isLoading) {
    return <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
        <Sparkles className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No hay limpiezas completadas aún</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
            <th className="px-4 py-2">Fecha</th>
            <th className="px-4 py-2">Hora</th>
            <th className="px-4 py-2 hidden md:table-cell">Duración</th>
            <th className="px-4 py-2">Hab.</th>
            <th className="px-4 py-2">Tipo</th>
            <th className="px-4 py-2 hidden md:table-cell">Camarera</th>
            <th className="px-4 py-2 hidden lg:table-cell">Notas</th>
          </tr>
        </thead>
        <tbody>
          {history.map((c) => (
            <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
              <td className="px-4 py-2">{formatDate(c.completed_at, 'd MMM yyyy')}</td>
              <td className="px-4 py-2 tabular-nums">
                {formatDate(c.started_at ?? c.completed_at, 'HH:mm')}–{formatDate(c.completed_at, 'HH:mm')}
              </td>
              <td className="px-4 py-2 hidden md:table-cell tabular-nums">
                {c.duration_minutes ? `${Math.round(c.duration_minutes)} min` : '—'}
              </td>
              <td className="px-4 py-2 font-bold">{c.room?.number ?? '—'}</td>
              <td className="px-4 py-2">
                <Badge variant="outline" className="text-[10px]" style={{ borderColor: c.cleaning_type?.color }}>
                  {c.cleaning_type?.name}
                </Badge>
              </td>
              <td className="px-4 py-2 hidden md:table-cell">{c.completed_profile?.full_name ?? '—'}</td>
              <td className="px-4 py-2 hidden lg:table-cell text-xs text-muted-foreground truncate max-w-[150px]">{c.notes ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
