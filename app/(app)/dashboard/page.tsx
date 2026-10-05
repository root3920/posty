'use client';

import { useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth, isToday } from 'date-fns';
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
  BedDouble as BedIcon,
  Settings2,
  CircleCheck,
  Circle,
  LogIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KpiGrid } from '@/components/shared/kpi-grid';
import { KpiCard, KpiCardSkeleton } from '@/components/shared/kpi-card';
import { useHotelKPIs, useRoomTypes } from '@/hooks/use-hotel';
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
import { ConfirmArrivalModal } from '@/components/hotel/confirm-arrival-modal';
import { getStayBadges, BADGE_STYLES } from '@/lib/stays/badges';
import { useOrganization } from '@/hooks/use-organization';
import { todayInTimezone } from '@/lib/dates';

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
    warning: 'border-warning/20 bg-warning/10 text-warning dark:border-warning/30 dark:bg-warning/15 dark:text-warning',
    error: 'border-danger/20 bg-danger/10 text-danger dark:border-danger/30 dark:bg-danger/15 dark:text-danger',
    info: 'border-info/20 bg-info/10 text-info dark:border-info/30 dark:bg-info/15 dark:text-info',
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
// Onboarding step
// -------------------------------------------------------

function OnboardingStep({
  step,
  title,
  description,
  done,
  href,
}: {
  step: number;
  title: string;
  description: string;
  done: boolean;
  href: string;
}) {
  return (
    <motion.div variants={cardVariants}>
      <Link
        href={href}
        className={`flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50 ${done ? 'opacity-60' : ''}`}
      >
        <span className="mt-0.5 shrink-0">
          {done ? (
            <CircleCheck className="h-5 w-5 text-emerald-500" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground/40" />
          )}
        </span>
        <div className="min-w-0">
          <p className={`text-sm font-medium ${done ? 'line-through text-muted-foreground' : ''}`}>
            {step}. {title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </Link>
    </motion.div>
  );
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
// Today arrivals fetcher
// -------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchTodayArrivals(): Promise<Record<string, any>[]> {
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from as any)('stays_view')
    .select('id, guest_first_name, guest_last_name, room_number, status, check_in_date, check_out_date')
    .eq('check_in_date', today)
    .eq('status', 'reserved');
  if (error) {
    console.error('fetchTodayArrivals error:', error);
    return [];
  }
  return data ?? [];
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
  const [arrivalModalOpen, setArrivalModalOpen] = useState(false);
  const [selectedArrivalStayId, setSelectedArrivalStayId] = useState<string | null>(null);

  const { timezone } = useOrganization();
  const todayStr = todayInTimezone(timezone);
  const monthFrom = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthTo = format(endOfMonth(now), 'yyyy-MM-dd');
  const todayPeriod = { from: todayStr, to: todayStr };
  const monthPeriod = { from: monthFrom, to: monthTo };

  // Data hooks
  const { data: profile } = useProfile();
  const { data: hotelKpis, isLoading: hotelLoading } = useHotelKPIs();
  const { data: roomTypes = [] } = useRoomTypes();
  const { data: financeToday } = useFinanceKPIs(todayPeriod);
  const { data: financeMonth } = useFinanceKPIs(monthPeriod);
  const { tasks, statuses, isLoading: tasksLoading } = useTasks({ parentTaskId: null });
  const teamQuery = useQuery({
    queryKey: ['team_summary_dashboard'],
    queryFn: fetchTeamSummary,
    staleTime: 2 * 60 * 1000,
  });

  const todayArrivalsQuery = useQuery({
    queryKey: ['today_arrivals_dashboard'],
    queryFn: fetchTodayArrivals,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
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
    const openTypes = new Set<string>(['open', 'in_progress']);
    let pending = 0;
    let completed = 0;
    let overdue = 0;

    for (const task of tasks) {
      if (!task.status) continue;
      const statusType = task.status.type as string;
      if (statusType === 'done') {
        completed++;
      } else if (statusType !== 'cancelled' && openTypes.has(statusType)) {
        // Pendientes hoy: status open/in_progress AND due_date = today
        if (task.due_date === todayStr) {
          pending++;
        }
        // Vencidas: due_date < today AND not done
        if (task.due_date && task.due_date < todayStr) {
          overdue++;
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
  const dateLabel = format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{dateLabel}</p>
      </div>

        {/* ============================
            Onboarding card (shown when no rooms exist)
        ============================ */}
        {(() => {
          const hasRoomTypes = roomTypes.length > 0;
          const hasRooms = (hotelKpis?.totalRooms ?? 0) > 0;
          const hasTeam = (teamQuery.data?.length ?? 0) > 1;
          const allDone = hasRoomTypes && hasRooms && hasTeam;
          const dismissed = typeof window !== 'undefined' && localStorage.getItem('posty_setup_dismissed') === '1';
          const show = !hotelLoading && hotelKpis && !allDone && !dismissed;

          return show ? (
          <motion.section
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="relative rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-5 space-y-4"
          >
            <button
              type="button"
              onClick={() => { localStorage.setItem('posty_setup_dismissed', '1'); window.location.reload(); }}
              className="absolute right-3 top-3 text-xs text-muted-foreground hover:text-foreground"
              aria-label="Ocultar"
            >
              Ocultar
            </button>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Settings2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Configura tu hotel</h2>
                <p className="text-xs text-muted-foreground">Completa estos pasos para empezar a operar</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <OnboardingStep
                step={1}
                title="Crea tipos de habitación"
                description="Define Twin, Suite, etc. con tarifas"
                done={hasRoomTypes}
                href="/configuracion/catalogos"
              />
              <OnboardingStep
                step={2}
                title="Crea habitaciones"
                description="Agrega habitaciones individuales o en lote"
                done={hasRooms}
                href="/hotel/habitaciones"
              />
              <OnboardingStep
                step={3}
                title="Invita a tu equipo"
                description="Agrega recepcionistas y personal"
                done={hasTeam}
                href="/configuracion/usuarios"
              />
            </div>
          </motion.section>
          ) : null;
        })()}

        {/* ============================
            Section 1: Hotel hoy
        ============================ */}
        <section className="space-y-3">
          <SectionHeader title="Hotel hoy" href="/hotel" />
          {hotelLoading ? (
            <KpiGrid>
              {[...Array(4)].map((_, i) => <KpiCardSkeleton key={i} />)}
            </KpiGrid>
          ) : hotelKpis ? (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
            <KpiGrid>
              <KpiCard
                icon={<TrendingUp className="h-5 w-5" />}
                label="Ocupación"
                value={hotelKpis.occupancyPct}
                formatValue={(n) => formatPercent(n)}
                subLabel={`${hotelKpis.occupiedRooms} / ${hotelKpis.totalRooms} hab.`}
              />
              <KpiCard
                icon={<BedDouble className="h-5 w-5" />}
                label="Disponibles"
                value={hotelKpis.availableRooms}
                subLabel={`de ${hotelKpis.totalRooms} habitaciones`}
              />
              <KpiCard
                icon={<ArrowDownToLine className="h-5 w-5" />}
                label="Llegadas hoy"
                value={hotelKpis.arrivalsToday}
              />
              <KpiCard
                icon={<ArrowUpFromLine className="h-5 w-5" />}
                label="Salidas hoy"
                value={hotelKpis.departuresToday}
              />
            </KpiGrid>
            </motion.div>
          ) : null}
        </section>

        {/* ============================
            Section: Llegadas de hoy
        ============================ */}
        {(todayArrivalsQuery.data?.length ?? 0) > 0 && (
          <section className="space-y-3">
            <SectionHeader title="Llegadas de hoy" href="/hotel/reservas" />
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-1.5"
            >
              {(todayArrivalsQuery.data ?? []).map((arrival) => (
                <motion.div
                  key={arrival.id}
                  variants={cardVariants}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-status-arrivals/10">
                      <ArrowDownToLine className="h-4 w-4 text-status-arrivals" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {arrival.guest_first_name} {arrival.guest_last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">Hab. {arrival.room_number}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(() => {
                      const badges = getStayBadges(
                        {
                          status: arrival.status,
                          check_in_date: arrival.check_in_date,
                          check_out_date: arrival.check_out_date ?? arrival.check_in_date,
                        },
                        todayStr,
                      );
                      return (
                        <Badge variant="outline" className={`text-[10px] ${BADGE_STYLES[badges.status.variant]}`}>
                          {badges.status.label}
                        </Badge>
                      );
                    })()}
                    <Button
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => {
                        setSelectedArrivalStayId(arrival.id);
                        setArrivalModalOpen(true);
                      }}
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      Confirmar
                    </Button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </section>
        )}

        {/* ============================
            Section 2: Equipo hoy
        ============================ */}
        <section className="space-y-3">
          <SectionHeader title="Equipo hoy" href="/equipo" />
          {teamQuery.isLoading || tasksLoading ? (
            <KpiGrid>
              {[...Array(6)].map((_, i) => <KpiCardSkeleton key={i} />)}
            </KpiGrid>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
            <KpiGrid>
              <KpiCard
                icon={<UserCheck className="h-5 w-5" />}
                label="En turno"
                value={teamKpis.onShift}
              />
              <KpiCard
                icon={<Users className="h-5 w-5" />}
                label="Disponibles"
                value={teamKpis.available}
                subLabel={`de ${teamKpis.total} total`}
              />
              <KpiCard
                icon={<UserX className="h-5 w-5" />}
                label="Ausentes"
                value={teamKpis.absent}
              />
              <KpiCard
                icon={<ClipboardList className="h-5 w-5" />}
                label="Tareas pendientes"
                value={taskKpis.pending}
              />
              <KpiCard
                icon={<CheckCircle2 className="h-5 w-5" />}
                label="Completadas"
                value={taskKpis.completed}
              />
              <KpiCard
                icon={<Clock className="h-5 w-5" />}
                label="Vencidas"
                value={taskKpis.overdue}
              />
            </KpiGrid>
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
          >
          <KpiGrid>
            <KpiCard
              icon={<DollarSign className="h-5 w-5" />}
              label="Ingresos hoy"
              value={financeToday?.totalRevenue ?? 0}
              formatValue={(n) => formatCurrency(n)}
              loading={!financeToday}
            />
            <KpiCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Ingresos este mes"
              value={financeMonth?.totalRevenue ?? 0}
              formatValue={(n) => formatCurrency(n)}
              loading={!financeMonth}
            />
            <KpiCard
              icon={<BarChart3 className="h-5 w-5" />}
              label="GOP mes"
              value={financeMonth?.gop ?? 0}
              formatValue={(n) => formatCurrency(n)}
              subLabel={financeMonth ? `Margen: ${formatPercent(financeMonth.gopMarginPct)}` : undefined}
              loading={!financeMonth}
            />
            <KpiCard
              icon={<BedDouble className="h-5 w-5" />}
              label="Ocupación mes"
              value={financeMonth?.occupancyPct ?? 0}
              formatValue={(n) => formatPercent(n)}
              subLabel={financeMonth ? `${financeMonth.roomNightsSold} noches vendidas` : undefined}
              loading={!financeMonth}
            />
          </KpiGrid>
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

      <ConfirmArrivalModal
        open={arrivalModalOpen}
        onOpenChange={setArrivalModalOpen}
        stayId={selectedArrivalStayId}
      />
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
