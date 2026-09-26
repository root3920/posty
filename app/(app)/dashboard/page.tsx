'use client';

import { useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, type Variants } from 'framer-motion';
import {
  BedDouble,
  Users,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  DollarSign,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  UserCheck,
  UserX,
  ClipboardList,
  Banknote,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useHotelKPIs } from '@/hooks/use-hotel';
import { useFinanceKPIs } from '@/hooks/use-finance';
import { useTasks } from '@/hooks/use-tasks';
import { useProfile } from '@/hooks/use-profile';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatPercent } from '@/lib/format';
import {
  calculateAvailability,
  type WorkScheduleBlock,
  type TimeOffEntry,
} from '@/lib/availability';
import type { Tables, Enums } from '@/types/database';

// -------------------------------------------------------
// Animation variants
// -------------------------------------------------------

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
  },
};

// -------------------------------------------------------
// KPI card component
// -------------------------------------------------------

interface DashKpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subLabel?: string;
  color?: string;
}

function DashKpiCard({ icon, label, value, subLabel, color = 'text-foreground' }: DashKpiCardProps) {
  return (
    <motion.div variants={cardVariants} className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className={`text-xl font-bold leading-tight ${color}`}>{value}</p>
          {subLabel && <p className="text-[11px] text-muted-foreground">{subLabel}</p>}
        </div>
      </div>
    </motion.div>
  );
}

// -------------------------------------------------------
// Alert item
// -------------------------------------------------------

interface AlertItemProps {
  icon: React.ReactNode;
  text: string;
  severity: 'warning' | 'error' | 'info';
  href?: string;
}

function AlertItem({ icon, text, severity, href }: AlertItemProps) {
  const colorMap = {
    warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300',
    error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-300',
    info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-300',
  };

  const content = (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${colorMap[severity]}`}>
      <span className="shrink-0">{icon}</span>
      <span className="flex-1">{text}</span>
      {href && <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" />}
    </div>
  );

  if (href) {
    return (
      <motion.div variants={cardVariants}>
        <Link href={href} className="block">
          {content}
        </Link>
      </motion.div>
    );
  }

  return <motion.div variants={cardVariants}>{content}</motion.div>;
}

// -------------------------------------------------------
// Section header
// -------------------------------------------------------

function SectionHeader({
  title,
  href,
}: {
  title: string;
  href: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <Link
        href={href}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Ver más
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

// -------------------------------------------------------
// Greeting helper
// -------------------------------------------------------

function buildGreeting(hour: number): string {
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// -------------------------------------------------------
// Team data fetcher (reused from equipo page pattern)
// -------------------------------------------------------

interface ProfileWithSchedules extends Tables<'profiles'> {
  work_schedules: Tables<'work_schedules'>[];
  time_off: Tables<'time_off'>[];
}

async function fetchTeamSummary(): Promise<ProfileWithSchedules[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*, work_schedules(*), time_off(*)')
    .eq('is_active', true);
  if (error) throw error;
  return (data ?? []) as unknown as ProfileWithSchedules[];
}

// -------------------------------------------------------
// Main dashboard content
// -------------------------------------------------------

function DashboardContent() {
  const router = useRouter();
  const now = useMemo(() => new Date(), []);

  const todayStr = format(now, 'yyyy-MM-dd');
  const monthFrom = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthTo = format(endOfMonth(now), 'yyyy-MM-dd');
  const todayPeriod = { from: todayStr, to: todayStr };
  const monthPeriod = { from: monthFrom, to: monthTo };

  // Data hooks
  const { data: profile } = useProfile();
  const { data: hotelKpis, isLoading: hotelLoading } = useHotelKPIs();
  const { data: financeToday } = useFinanceKPIs(todayPeriod);
  const { data: financeMonth } = useFinanceKPIs(monthPeriod);
  const { tasks, statuses, isLoading: tasksLoading } = useTasks({ parentTaskId: null });
  const teamQuery = useQuery({
    queryKey: ['team_summary_dashboard'],
    queryFn: fetchTeamSummary,
    staleTime: 2 * 60 * 1000,
  });

  // -------------------------------------------------------
  // Team KPIs
  // -------------------------------------------------------

  const teamKpis = useMemo(() => {
    const employees = teamQuery.data ?? [];
    let onShift = 0;
    let available = 0;
    let absent = 0;

    for (const emp of employees) {
      const avail = calculateAvailability({
        now,
        timezone: profile?.organization?.timezone ?? 'UTC',
        availability_override: emp.availability_override as Enums<'availability_status'> | null,
        schedules: emp.work_schedules as WorkScheduleBlock[],
        timeOff: emp.time_off as TimeOffEntry[],
      });
      if (avail.status === 'on_shift') onShift++;
      if (avail.status === 'available' || avail.status === 'on_shift') available++;
      if (avail.status === 'absent') absent++;
    }
    return { onShift, available, absent, total: employees.length };
  }, [teamQuery.data, now, profile]);

  // -------------------------------------------------------
  // Task KPIs
  // -------------------------------------------------------

  const taskKpis = useMemo(() => {
    const doneTypes: Array<Enums<'task_status_type'>> = ['done'];
    let pending = 0;
    let completed = 0;
    let overdue = 0;

    for (const task of tasks) {
      if (!task.status) continue;
      const isDone = doneTypes.includes(task.status.type as Enums<'task_status_type'>);
      const isCancelled = task.status.type === 'cancelled';
      if (isDone) {
        completed++;
      } else if (!isCancelled) {
        if (task.due_date && task.due_date < todayStr) {
          overdue++;
        } else {
          pending++;
        }
      }
    }
    return { pending, completed, overdue };
  }, [tasks, todayStr]);

  // -------------------------------------------------------
  // Alerts
  // -------------------------------------------------------

  const alerts = useMemo(() => {
    const list: AlertItemProps[] = [];

    if (taskKpis.overdue > 0) {
      list.push({
        icon: <Clock className="h-4 w-4" />,
        text: `${taskKpis.overdue} tarea${taskKpis.overdue > 1 ? 's' : ''} vencida${taskKpis.overdue > 1 ? 's' : ''}`,
        severity: 'error',
        href: '/tareas',
      });
    }

    if (hotelKpis && hotelKpis.outOfServiceRooms > 0) {
      list.push({
        icon: <AlertTriangle className="h-4 w-4" />,
        text: `${hotelKpis.outOfServiceRooms} habitación${hotelKpis.outOfServiceRooms > 1 ? 'es' : ''} fuera de servicio`,
        severity: 'warning',
        href: '/hotel',
      });
    }

    if (financeMonth && financeMonth.accountsPayable > 0) {
      list.push({
        icon: <Banknote className="h-4 w-4" />,
        text: `${formatCurrency(financeMonth.accountsPayable)} en cuentas por pagar`,
        severity: 'warning',
        href: '/finanzas/gastos',
      });
    }

    if (hotelKpis && hotelKpis.departuresToday > 0) {
      list.push({
        icon: <ArrowUpFromLine className="h-4 w-4" />,
        text: `${hotelKpis.departuresToday} salida${hotelKpis.departuresToday > 1 ? 's' : ''} pendiente${hotelKpis.departuresToday > 1 ? 's' : ''} hoy`,
        severity: 'info',
        href: '/hotel',
      });
    }

    return list;
  }, [taskKpis, hotelKpis, financeMonth]);

  const greeting = buildGreeting(now.getHours());
  const firstName = profile?.full_name?.split(' ')[0] ?? '';
  const dateLabel = format(now, "EEEE, d 'de' MMMM yyyy", { locale: es });

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground capitalize">{dateLabel}</p>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5 space-y-8">

        {/* ============================
            Section 1: Hotel hoy
        ============================ */}
        <section className="space-y-3">
          <SectionHeader title="Hotel hoy" href="/hotel" />
          {hotelLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : hotelKpis ? (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
              <DashKpiCard
                icon={<TrendingUp className="h-5 w-5 text-indigo-600" />}
                label="Ocupación"
                value={`${hotelKpis.occupancyPct}%`}
                subLabel={`${hotelKpis.occupiedRooms} / ${hotelKpis.totalRooms} hab.`}
                color="text-indigo-600"
              />
              <DashKpiCard
                icon={<BedDouble className="h-5 w-5 text-green-600" />}
                label="Disponibles"
                value={hotelKpis.availableRooms}
                color="text-green-600"
              />
              <DashKpiCard
                icon={<ArrowDownToLine className="h-5 w-5 text-teal-600" />}
                label="Llegadas hoy"
                value={hotelKpis.arrivalsToday}
                color="text-teal-600"
              />
              <DashKpiCard
                icon={<ArrowUpFromLine className="h-5 w-5 text-orange-600" />}
                label="Salidas hoy"
                value={hotelKpis.departuresToday}
                color="text-orange-600"
              />
            </motion.div>
          ) : null}
        </section>

        {/* ============================
            Section 2: Equipo hoy
        ============================ */}
        <section className="space-y-3">
          <SectionHeader title="Equipo hoy" href="/equipo" />
          {teamQuery.isLoading || tasksLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
            >
              <DashKpiCard
                icon={<UserCheck className="h-5 w-5 text-green-600" />}
                label="En turno"
                value={teamKpis.onShift}
                color="text-green-600"
              />
              <DashKpiCard
                icon={<Users className="h-5 w-5 text-blue-600" />}
                label="Disponibles"
                value={teamKpis.available}
                subLabel={`de ${teamKpis.total} total`}
                color="text-blue-600"
              />
              <DashKpiCard
                icon={<UserX className="h-5 w-5 text-red-500" />}
                label="Ausentes"
                value={teamKpis.absent}
                color="text-red-500"
              />
              <DashKpiCard
                icon={<ClipboardList className="h-5 w-5 text-amber-600" />}
                label="Tareas pendientes"
                value={taskKpis.pending}
                color="text-amber-600"
              />
              <DashKpiCard
                icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
                label="Completadas"
                value={taskKpis.completed}
                color="text-green-600"
              />
              <DashKpiCard
                icon={<Clock className="h-5 w-5 text-red-600" />}
                label="Vencidas"
                value={taskKpis.overdue}
                color={taskKpis.overdue > 0 ? 'text-red-600' : 'text-foreground'}
              />
            </motion.div>
          )}
        </section>

        {/* ============================
            Section 3: Finanzas
        ============================ */}
        <section className="space-y-3">
          <SectionHeader title="Finanzas" href="/finanzas" />
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <DashKpiCard
              icon={<DollarSign className="h-5 w-5 text-indigo-600" />}
              label="Ingresos hoy"
              value={financeToday ? formatCurrency(financeToday.totalRevenue) : '—'}
              color="text-indigo-600"
            />
            <DashKpiCard
              icon={<TrendingUp className="h-5 w-5 text-teal-600" />}
              label="Ingresos este mes"
              value={financeMonth ? formatCurrency(financeMonth.totalRevenue) : '—'}
              color="text-teal-600"
            />
            <DashKpiCard
              icon={<BarChart3 className="h-5 w-5 text-green-600" />}
              label="GOP mes"
              value={financeMonth ? formatCurrency(financeMonth.gop) : '—'}
              subLabel={financeMonth ? `Margen: ${formatPercent(financeMonth.gopMarginPct)}` : undefined}
              color={financeMonth && financeMonth.gop >= 0 ? 'text-green-600' : 'text-red-600'}
            />
            <DashKpiCard
              icon={<BedDouble className="h-5 w-5 text-blue-600" />}
              label="Ocupación mes"
              value={financeMonth ? formatPercent(financeMonth.occupancyPct) : '—'}
              subLabel={financeMonth ? `${financeMonth.roomNightsSold} noches vendidas` : undefined}
              color="text-blue-600"
            />
          </motion.div>
        </section>

        {/* ============================
            Section 4: Alertas
        ============================ */}
        {alerts.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight">Alertas</h2>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-2"
            >
              {alerts.map((alert, i) => (
                <AlertItem key={i} {...alert} />
              ))}
            </motion.div>
          </section>
        )}

        {/* Quick actions */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight">Acceso rápido</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/hotel')}>
              <BedDouble className="mr-1.5 h-4 w-4" />
              Habitaciones
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/hotel/reservas')}>
              <ArrowDownToLine className="mr-1.5 h-4 w-4" />
              Reservas
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/tareas')}>
              <ClipboardList className="mr-1.5 h-4 w-4" />
              Tareas
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/equipo')}>
              <Users className="mr-1.5 h-4 w-4" />
              Equipo
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/finanzas')}>
              <BarChart3 className="mr-1.5 h-4 w-4" />
              Finanzas
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Page export
// -------------------------------------------------------

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
