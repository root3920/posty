'use client';

import { useState, useMemo } from 'react';
import {
  Eye,
  Users,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Repeat2,
  Reply,
  MousePointerClick,
  UserPlus,
  Activity,
  RefreshCw,
  Loader2,
  BarChart3,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { KpiCard, KpiCardSkeleton } from '@/components/shared/kpi-card';
import { KpiGrid } from '@/components/shared/kpi-grid';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  useInstagramInsights,
  useRefreshInsights,
  type InsightsPeriod,
  periodLabel,
} from '@/hooks/use-instagram-insights';
import {
  ACCOUNT_METRICS,
  calcVariation,
  calcEngagementRate,
} from '@/lib/instagram/insights-metrics';


// -------------------------------------------------------
// Metric icon map
// -------------------------------------------------------

const METRIC_ICONS: Record<string, React.ReactNode> = {
  views: <Eye className="h-4 w-4" />,
  reach: <Users className="h-4 w-4" />,
  accounts_engaged: <Activity className="h-4 w-4" />,
  total_interactions: <MousePointerClick className="h-4 w-4" />,
  likes: <Heart className="h-4 w-4" />,
  comments: <MessageCircle className="h-4 w-4" />,
  saves: <Bookmark className="h-4 w-4" />,
  shares: <Share2 className="h-4 w-4" />,
  reposts: <Repeat2 className="h-4 w-4" />,
  replies: <Reply className="h-4 w-4" />,
  profile_links_taps: <MousePointerClick className="h-4 w-4" />,
  follows_and_unfollows: <UserPlus className="h-4 w-4" />,
  followers_count: <Users className="h-4 w-4" />,
  engagement_rate: <Activity className="h-4 w-4" />,
};

// -------------------------------------------------------
// Period selector months
// -------------------------------------------------------

function generateMonthOptions(): Array<{ label: string; value: InsightsPeriod }> {
  const months: Array<{ label: string; value: InsightsPeriod }> = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleDateString('es', { month: 'long', year: 'numeric' }),
      value: { type: 'month', year: d.getFullYear(), month: d.getMonth() + 1 },
    });
  }
  return months;
}

const MONTH_OPTIONS = generateMonthOptions();

// -------------------------------------------------------
// Number formatters
// -------------------------------------------------------

const fmtNum = (n: number) =>
  new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number) =>
  new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n) + ' %';

const fmtCompact = (n: number) =>
  new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

// -------------------------------------------------------
// Chart tooltip
// -------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-2 shadow-md text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry: { color: string; name: string; value: number }, i: number) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {fmtNum(entry.value)}
        </p>
      ))}
    </div>
  );
}

// -------------------------------------------------------
// No insights scope message
// -------------------------------------------------------

function NoInsightsScopeMessage({ onReconnect }: { onReconnect: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
        <AlertTriangle className="h-8 w-8 text-warning" />
      </div>
      <div className="max-w-sm space-y-2">
        <h3 className="font-heading text-lg font-semibold">Permiso de estadísticas requerido</h3>
        <p className="text-sm text-muted-foreground">
          Para ver estadísticas necesitas volver a conectar Instagram y aceptar el permiso de estadísticas.
        </p>
      </div>
      <Button onClick={onReconnect}>Reconectar Instagram</Button>
    </div>
  );
}

// -------------------------------------------------------
// Summary Tab
// -------------------------------------------------------

interface SummaryTabProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  compare: boolean;
}

function SummaryTab({ data, compare }: SummaryTabProps) {
  const metrics = useMemo(() => data.metrics ?? {}, [data.metrics]);
  const previousMetrics = useMemo(() => data.previousMetrics ?? {}, [data.previousMetrics]);

  // Build KPI cards from ACCOUNT_METRICS definition
  const kpiCards = useMemo(() => {
    const cards: Array<{
      key: string;
      label: string;
      help: string;
      value: number | null;
      changePct: number | null;
      icon: React.ReactNode;
    }> = [];

    for (const def of ACCOUNT_METRICS) {
      const current = metrics[def.name]?.total ?? null;
      const previous = previousMetrics[def.name]?.total ?? null;
      const variation = compare ? calcVariation(current, previous) : null;

      cards.push({
        key: def.name,
        label: def.label,
        help: def.help,
        value: current,
        changePct: variation,
        icon: METRIC_ICONS[def.name] ?? <BarChart3 className="h-4 w-4" />,
      });
    }

    // Add followers count
    cards.push({
      key: 'followers_count',
      label: 'Seguidores',
      help: 'Total de seguidores actuales',
      value: data.currentFollowers ?? null,
      changePct: null,
      icon: METRIC_ICONS.followers_count,
    });

    // Add engagement rate (calculated)
    const totalInteractions = metrics.total_interactions?.total ?? null;
    const reach = metrics.reach?.total ?? null;
    const engRate = calcEngagementRate(totalInteractions, reach);
    cards.push({
      key: 'engagement_rate',
      label: 'Tasa de interacción',
      help: 'Interacciones totales ÷ alcance × 100',
      value: engRate,
      changePct: null,
      icon: METRIC_ICONS.engagement_rate,
    });

    return cards;
  }, [metrics, previousMetrics, data.currentFollowers, compare]);

  // Reach time series for chart
  const reachTimeSeries = data.reachTimeSeries ?? [];

  // Follower series for chart
  const followerSeries = data.followerSeries ?? [];

  // Breakdown by content type
  const contentTypeBreakdown = useMemo(() => {
    const result: Array<{ type: string; views: number; reach: number; interactions: number }> = [];
    const types = ['FEED', 'REELS', 'STORY'];

    for (const t of types) {
      const views = metrics.views?.breakdowns?.media_product_type?.[t] ?? 0;
      const reach = metrics.reach?.breakdowns?.media_product_type?.[t] ?? 0;
      const interactions = metrics.total_interactions?.breakdowns?.media_product_type?.[t] ?? 0;
      if (views > 0 || reach > 0 || interactions > 0) {
        const labels: Record<string, string> = { FEED: 'Publicaciones', REELS: 'Reels', STORY: 'Historias' };
        result.push({
          type: labels[t] ?? t,
          views,
          reach,
          interactions,
        });
      }
    }

    return result;
  }, [metrics]);

  // Follower vs non-follower breakdown
  const followTypeData = useMemo(() => {
    const viewsFollower = metrics.views?.breakdowns?.follow_type?.FOLLOWER ?? 0;
    const viewsNon = metrics.views?.breakdowns?.follow_type?.NON_FOLLOWER ?? 0;
    const reachFollower = metrics.reach?.breakdowns?.follow_type?.FOLLOWER ?? 0;
    const reachNon = metrics.reach?.breakdowns?.follow_type?.NON_FOLLOWER ?? 0;

    if (viewsFollower === 0 && viewsNon === 0 && reachFollower === 0 && reachNon === 0) return null;

    return [
      { label: 'Seguidores', visualizaciones: viewsFollower, alcance: reachFollower },
      { label: 'No seguidores', visualizaciones: viewsNon, alcance: reachNon },
    ];
  }, [metrics]);

  const hasAnyData = data.hasData;

  if (!hasAnyData) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
        <BarChart3 className="h-10 w-10 opacity-40" />
        <p className="text-sm">Sin datos para este periodo</p>
        <p className="max-w-xs text-xs">
          Los datos pueden tardar hasta 48 horas en estar disponibles. Intenta con un periodo anterior.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <KpiGrid>
        {kpiCards.map((card) => (
          <KpiCard
            key={card.key}
            icon={card.icon}
            label={card.label}
            value={card.value ?? 0}
            formatValue={card.key === 'engagement_rate' ? fmtPct : fmtNum}
            formula={card.help}
            changePct={card.changePct}
            subLabel={card.value == null ? 'Sin datos' : undefined}
          />
        ))}
      </KpiGrid>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Chart 1: Reach time series */}
        {reachTimeSeries.length > 0 && (
          <div className="rounded-[10px] border bg-card p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold">Alcance por día</h4>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={reachTimeSeries} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 10 }} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Alcance"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Chart 2: Followers over time */}
        {followerSeries.length > 0 && (
          <div className="rounded-[10px] border bg-card p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold">Seguidores en el tiempo</h4>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={followerSeries} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 10 }} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="followers_count"
                  name="Seguidores"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Chart 3: Followers vs non-followers */}
        {followTypeData && (
          <div className="rounded-[10px] border bg-card p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold">Seguidores vs. no seguidores</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={followTypeData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 10 }} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="visualizaciones" name="Visualizaciones" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="alcance" name="Alcance" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Chart 4: By content type */}
        {contentTypeBreakdown.length > 0 && (
          <div className="rounded-[10px] border bg-card p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold">Por tipo de contenido</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={contentTypeBreakdown} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 10 }} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="views" name="Visualizaciones" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="reach" name="Alcance" fill="#22c55e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="interactions" name="Interacciones" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Main Modal
// -------------------------------------------------------

interface InsightsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasInsightsScope: boolean;
}

export function InsightsModal({ open, onOpenChange, hasInsightsScope }: InsightsModalProps) {
  const [period, setPeriod] = useState<InsightsPeriod>('last_30_days');
  const [compare, setCompare] = useState(true);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  const { data, isLoading, error } = useInstagramInsights(period, compare);
  const refreshMutation = useRefreshInsights();

  const handleRefresh = () => {
    refreshMutation.mutate(undefined, {
      onSuccess: () => toast.success('Datos actualizados'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al actualizar'),
    });
  };

  const handleReconnect = () => {
    onOpenChange(false);
    // External OAuth redirect — must use window.location for full page navigation
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/api/instagram/authorize';
  };

  const handlePeriodChange = (value: string | null) => {
    if (!value) return;
    if (value === 'month_picker') {
      setMonthPickerOpen(!monthPickerOpen);
      return;
    }
    setMonthPickerOpen(false);
    setPeriod(value as InsightsPeriod);
  };

  const handleMonthSelect = (year: number, month: number) => {
    setPeriod({ type: 'month', year, month });
    setMonthPickerOpen(false);
  };

  // Determine the select display value
  const periodSelectValue = typeof period === 'string' ? period : 'month_picker';

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Estadísticas de Instagram"
      size="2xl"
    >
      {!hasInsightsScope ? (
        <NoInsightsScopeMessage onReconnect={handleReconnect} />
      ) : (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
            {/* Period selector */}
            <Select value={periodSelectValue} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue>
                  {typeof period === 'string' ? periodLabel(period) : periodLabel(period)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_7_days">Últimos 7 días</SelectItem>
                <SelectItem value="last_30_days">Últimos 30 días</SelectItem>
                <SelectItem value="this_month">Este mes</SelectItem>
                <SelectItem value="prev_month">Mes anterior</SelectItem>
                <SelectItem value="month_picker">
                  <span className="flex items-center gap-1">
                    Elegir mes <ChevronDown className="h-3 w-3" />
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Month picker dropdown */}
            {monthPickerOpen && (
              <div className="absolute z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
                {MONTH_OPTIONS.map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full rounded px-3 py-1.5 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      const v = opt.value as { type: 'month'; year: number; month: number };
                      handleMonthSelect(v.year, v.month);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Compare toggle */}
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={compare} onCheckedChange={setCompare} />
              Comparar con periodo anterior
            </label>

            <div className="flex-1" />

            {/* Data freshness */}
            {data?.fetchedAt && (
              <span className="text-[11px] text-muted-foreground">
                {data.fetchedAt === 'db' ? 'Datos guardados' : `Actualizado ${new Date(data.fetchedAt).toLocaleString('es')}`}
              </span>
            )}

            {/* Refresh button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshMutation.isPending}
            >
              {refreshMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Actualizar
            </Button>
          </div>

          {/* Data delay notice */}
          <p className="text-[11px] text-muted-foreground">
            Los datos de los últimos 2 días pueden estar incompletos.
          </p>

          {/* Tabs */}
          <Tabs defaultValue="resumen">
            <TabsList>
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="audiencia" disabled>Audiencia</TabsTrigger>
              <TabsTrigger value="publicaciones" disabled>Publicaciones</TabsTrigger>
              <TabsTrigger value="historias" disabled>Historias</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="mt-4">
              {isLoading ? (
                <KpiGrid>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <KpiCardSkeleton key={i} />
                  ))}
                </KpiGrid>
              ) : error ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <AlertTriangle className="h-8 w-8 text-danger" />
                  <p className="text-sm text-muted-foreground">
                    {error instanceof Error ? error.message : 'Error al cargar estadísticas'}
                  </p>
                </div>
              ) : data ? (
                <SummaryTab data={data} compare={compare} />
              ) : null}
            </TabsContent>

            <TabsContent value="audiencia" className="mt-4">
              <div className="py-12 text-center text-sm text-muted-foreground">
                Disponible en la siguiente fase.
              </div>
            </TabsContent>

            <TabsContent value="publicaciones" className="mt-4">
              <div className="py-12 text-center text-sm text-muted-foreground">
                Disponible en la siguiente fase.
              </div>
            </TabsContent>

            <TabsContent value="historias" className="mt-4">
              <div className="py-12 text-center text-sm text-muted-foreground">
                Disponible en la siguiente fase.
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </ResponsiveDialog>
  );
}
