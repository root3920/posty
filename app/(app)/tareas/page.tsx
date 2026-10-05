'use client';

import { useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  List,
  LayoutDashboard,
  CalendarDays,
  User,
  Plus,
  X,
  SlidersHorizontal,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EntitySelect } from '@/components/shared/entity-select';
import { PageHeader } from '@/components/shared/page-header';
import { FilterBar } from '@/components/shared/filter-bar';
import { Fab } from '@/components/layout/fab';

import { useTasks, type TaskFilters, type TaskWithRelations } from '@/hooks/use-tasks';
import { useProfile } from '@/hooks/use-profile';

import { TaskListView } from '@/components/tareas/task-list-view';
import { TaskKanbanView } from '@/components/tareas/task-kanban-view';
import { TourTrigger } from '@/components/onboarding/tour-trigger';
import { TaskCalendarView } from '@/components/tareas/task-calendar-view';
import { MyTasksView } from '@/components/tareas/my-tasks-view';
import { TaskDetailSheet } from '@/components/tareas/task-detail-sheet';
import { TaskCreateDialog } from '@/components/tareas/task-create-dialog';
import { PRIORITY_CONFIG } from '@/components/tareas/task-shared';

// -------------------------------------------------------
// Tab config
// -------------------------------------------------------

type ViewTab = 'lista' | 'tablero' | 'calendario' | 'mis-tareas';

const TABS: { key: ViewTab; label: string; icon: React.ReactNode }[] = [
  { key: 'lista', label: 'Lista', icon: <List className="h-4 w-4" /> },
  { key: 'tablero', label: 'Tablero', icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'calendario', label: 'Calendario', icon: <CalendarDays className="h-4 w-4" /> },
  { key: 'mis-tareas', label: 'Mis tareas', icon: <User className="h-4 w-4" /> },
];

// -------------------------------------------------------
// Main page
// -------------------------------------------------------

export default function TareasPage() {
  return (
    <Suspense>
      <TareasContent />
    </Suspense>
  );
}

function TareasContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: profile } = useProfile();

  // -------------------------------------------------------
  // URL-driven state
  // -------------------------------------------------------

  const activeTab = (searchParams.get('vista') as ViewTab) ?? (typeof window !== 'undefined' && window.innerWidth < 768 ? 'lista' : 'lista');
  const filterStatus = searchParams.get('estado') ?? undefined;
  const filterPriority = searchParams.get('prioridad') ?? undefined;
  const filterAssignee = searchParams.get('asignado') ?? undefined;
  const filterLabel = searchParams.get('etiqueta') ?? undefined;
  const filterDateFrom = searchParams.get('desde') ?? undefined;
  const filterDateTo = searchParams.get('hasta') ?? undefined;
  const filterUnassignedRole = searchParams.get('sin_asignar') === '1';

  // -------------------------------------------------------
  // Local state
  // -------------------------------------------------------

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // -------------------------------------------------------
  // URL param updater
  // -------------------------------------------------------

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function setTab(tab: ViewTab) {
    updateParam('vista', tab);
  }

  function clearFilters() {
    const params = new URLSearchParams();
    if (activeTab !== 'lista') params.set('vista', activeTab);
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilters =
    filterStatus ||
    filterPriority ||
    filterAssignee ||
    filterLabel ||
    filterDateFrom ||
    filterDateTo ||
    filterUnassignedRole;

  // -------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------

  const filters: TaskFilters = {
    statusId: filterStatus,
    priority: filterPriority as TaskFilters['priority'],
    assigneeId: filterAssignee,
    labelId: filterLabel,
    dateFrom: filterDateFrom,
    dateTo: filterDateTo,
    parentTaskId: null,
  };

  const { tasks: allTasks, statuses, labels, teamMembers, isLoading } = useTasks(filters);

  // Apply client-side filter for unassigned-by-role tasks
  const tasks = filterUnassignedRole
    ? allTasks.filter(
        (t) =>
          (t as unknown as Record<string, unknown>)['source'] === 'stay_workflow' &&
          t.assignees.length === 0 &&
          (t as unknown as Record<string, unknown>)['assigned_role_id'],
      )
    : allTasks;

  // -------------------------------------------------------
  // Handlers
  // -------------------------------------------------------

  const handleTaskClick = useCallback((task: TaskWithRelations) => {
    setSelectedTaskId(task.id);
    setDetailOpen(true);
  }, []);

  function handleCalendarDayClick(dateStr: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('desde', dateStr);
    params.set('hasta', dateStr);
    params.set('vista', 'lista');
    router.push(`${pathname}?${params.toString()}`);
  }

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------

  const now = new Date();

  return (
    <div className="space-y-4">
      <TourTrigger module="tareas" />
      {/* ============================= */}
      {/* Page header */}
      {/* ============================= */}
      <PageHeader
        title="Tareas"
        description={format(now, "EEEE, d 'de' MMMM yyyy", { locale: es })}
        actions={
          <Button data-tour="tareas-crear" onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Crear tarea
          </Button>
        }
        className="mb-0"
      />

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ============================= */}
      {/* Filters bar */}
      {/* ============================= */}
      {activeTab !== 'mis-tareas' && (
        <div className="py-1">
          <FilterBar activeCount={[filterStatus, filterPriority, filterAssignee, filterLabel, filterDateFrom, filterDateTo, filterUnassignedRole].filter(Boolean).length}>

          {/* Status filter */}
          <EntitySelect
            options={statuses.map((s) => ({ value: s.id, label: s.name, color: s.color }))}
            value={filterStatus ?? null}
            onChange={(v) => updateParam('estado', v)}
            placeholder="Estado"
            allowClear
            clearLabel="Todos los estados"
            size="sm"
            triggerClassName="w-36"
          />

          {/* Priority filter */}
          <Select
            value={filterPriority ?? ''}
            onValueChange={(v) => updateParam('prioridad', v || null)}
          >
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: cfg.color }}
                    />
                    {cfg.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Assignee filter */}
          <EntitySelect
            options={teamMembers.map((m) => ({ value: m.id, label: m.full_name }))}
            value={filterAssignee ?? null}
            onChange={(v) => updateParam('asignado', v)}
            placeholder="Asignado"
            allowClear
            clearLabel="Todos"
            size="sm"
            triggerClassName="w-36"
          />

          {/* Label filter */}
          {labels.length > 0 && (
            <EntitySelect
              options={labels.map((l) => ({ value: l.id, label: l.name, color: l.color }))}
              value={filterLabel ?? null}
              onChange={(v) => updateParam('etiqueta', v)}
              placeholder="Etiqueta"
              allowClear
              clearLabel="Todas"
              size="sm"
              triggerClassName="w-36"
            />
          )}

          {/* Date range */}
          <div className="flex items-center gap-1">
            <Input
              type="date"
              className="h-7 w-32 text-xs"
              value={filterDateFrom ?? ''}
              onChange={(e) => updateParam('desde', e.target.value || null)}
            />
            <span className="text-xs text-muted-foreground">—</span>
            <Input
              type="date"
              className="h-7 w-32 text-xs"
              value={filterDateTo ?? ''}
              onChange={(e) => updateParam('hasta', e.target.value || null)}
            />
          </div>

          {/* Unassigned by role filter */}
          <Button
            variant={filterUnassignedRole ? 'secondary' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => updateParam('sin_asignar', filterUnassignedRole ? null : '1')}
          >
            Sin asignar (por rol)
          </Button>

          {/* Clear */}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={clearFilters}
            >
              <X className="mr-1 h-3 w-3" />
              Limpiar filtros
            </Button>
          )}
          </FilterBar>
        </div>
      )}

      {/* ============================= */}
      {/* View content */}
      {/* ============================= */}
      <div>
        {activeTab === 'lista' && (
          <TaskListView
            tasks={tasks}
            statuses={statuses}
            isLoading={isLoading}
            onTaskClick={handleTaskClick}
          />
        )}

        {activeTab === 'tablero' && (
          <div data-tour="tareas-kanban">
          <TaskKanbanView
            tasks={tasks}
            statuses={statuses}
            isLoading={isLoading}
            onTaskClick={handleTaskClick}
          />
          </div>
        )}

        {activeTab === 'calendario' && (
          <TaskCalendarView
            tasks={tasks}
            isLoading={isLoading}
            onDayClick={handleCalendarDayClick}
            onTaskClick={handleTaskClick}
          />
        )}

        {activeTab === 'mis-tareas' && profile && (
          <MyTasksView
            tasks={tasks}
            statuses={statuses}
            currentUserId={profile.id}
            isLoading={isLoading}
            onTaskClick={handleTaskClick}
          />
        )}
      </div>

      {/* ============================= */}
      {/* Detail sheet + Create dialog */}
      {/* ============================= */}
      <TaskDetailSheet
        taskId={selectedTaskId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      <TaskCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultStatusId={filterStatus}
      />

      {/* FAB for mobile */}
      <Fab icon={Plus} label="Crear tarea" onClick={() => setCreateOpen(true)} />
    </div>
  );
}
