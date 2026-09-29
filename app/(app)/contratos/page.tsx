'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Plus, FileText, AlertTriangle, DollarSign, Building2, TrendingUp, Shield } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { FilterBar } from '@/components/shared/filter-bar';
import { KpiGrid } from '@/components/shared/kpi-grid';
import { KpiCard } from '@/components/shared/kpi-card';
import { ResponsiveTable, type Column } from '@/components/shared/responsive-table';
import { Fab } from '@/components/layout/fab';
import { ContractWizard } from '@/components/contracts/contract-wizard';
import {
  ContractStatusBadge,
  InstallmentStatusBadge,
} from '@/components/contracts/contract-status-badge';
import {
  useContracts,
  useContractKpis,
  type ContractViewRow,
} from '@/hooks/use-contracts';
import { useOrganization } from '@/hooks/use-organization';
import { formatCurrency, formatDate, formatDateRange } from '@/lib/format';
import { formatPercent } from '@/lib/format';

// -------------------------------------------------------
// Filter chips
// -------------------------------------------------------

const STATUS_CHIPS = [
  { key: 'all', label: 'Todos' },
  { key: 'active', label: 'Activos' },
  { key: 'expiring', label: 'Por vencer' },
  { key: 'overdue', label: 'Con pagos vencidos' },
  { key: 'draft', label: 'Borradores' },
  { key: 'finished', label: 'Finalizados' },
] as const;

type StatusFilter = (typeof STATUS_CHIPS)[number]['key'];

function filterContracts(
  contracts: ContractViewRow[],
  chip: StatusFilter,
  search: string,
): ContractViewRow[] {
  let filtered = contracts;

  switch (chip) {
    case 'active':
      filtered = filtered.filter((c) => c.status === 'active' || c.status === 'signed');
      break;
    case 'expiring':
      filtered = filtered.filter((c) => c.status === 'expiring_soon');
      break;
    case 'overdue':
      filtered = filtered.filter((c) => c.overdue_installments > 0);
      break;
    case 'draft':
      filtered = filtered.filter((c) => c.status === 'draft' || c.status === 'sent_for_signature');
      break;
    case 'finished':
      filtered = filtered.filter(
        (c) =>
          c.status === 'finished' ||
          c.status === 'terminated_early' ||
          c.status === 'cancelled',
      );
      break;
  }

  if (search.trim()) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.guest_full_name?.toLowerCase().includes(s) ||
        c.guest_document_number?.toLowerCase().includes(s) ||
        c.room_number?.toLowerCase().includes(s) ||
        c.code?.toLowerCase().includes(s),
    );
  }

  return filtered;
}

// -------------------------------------------------------
// Columns
// -------------------------------------------------------

function getColumns(currency: string, locale: string): Column<ContractViewRow>[] {
  return [
    {
      key: 'code',
      header: 'Código',
      priority: 1,
      render: (row) => (
        <Link href={`/contratos/${row.id}`} className="text-primary font-medium hover:underline">
          {row.code}
        </Link>
      ),
    },
    {
      key: 'guest',
      header: 'Huésped',
      priority: 1,
      render: (row) => (
        <span className="font-medium">{row.guest_full_name}</span>
      ),
    },
    {
      key: 'room',
      header: 'Habitación',
      priority: 2,
      render: (row) => (
        <span>
          {row.room_number} · {row.room_type_name}
        </span>
      ),
    },
    {
      key: 'period',
      header: 'Período',
      priority: 2,
      render: (row) => (
        <span className="text-xs">
          {formatDateRange(row.start_date, row.end_date)}
        </span>
      ),
    },
    {
      key: 'monthly_rate',
      header: 'Precio/mes',
      priority: 2,
      render: (row) => formatCurrency(row.monthly_rate, currency, locale),
    },
    {
      key: 'next_payment',
      header: 'Próxima cuota',
      priority: 3,
      render: (row) =>
        row.next_due_date ? (
          <div className="flex items-center gap-2">
            <span className="text-xs">{formatDate(row.next_due_date)}</span>
            {row.next_due_status && (
              <InstallmentStatusBadge status={row.next_due_status} />
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Estado',
      priority: 1,
      render: (row) => <ContractStatusBadge status={row.status} />,
    },
  ];
}

// -------------------------------------------------------
// Inner page (needs useSearchParams)
// -------------------------------------------------------

function ContratosPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { currency, locale } = useOrganization();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [search, setSearch] = useState('');
  const chipParam = (searchParams.get('estado') ?? 'all') as StatusFilter;

  const { data: contracts = [], isLoading } = useContracts();
  const { data: kpis, isLoading: kpisLoading } = useContractKpis();

  const filtered = useMemo(
    () => filterContracts(contracts, chipParam, search),
    [contracts, chipParam, search],
  );

  const columns = useMemo(() => getColumns(currency, locale), [currency, locale]);

  function setChip(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === 'all') {
      params.delete('estado');
    } else {
      params.set('estado', key);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  const longStayPct =
    kpis && kpis.total_rooms > 0
      ? Math.round((kpis.long_stay_rooms / kpis.total_rooms) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos"
        description="Contratos de larga estadía"
        actions={
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo contrato
          </Button>
        }
      />

      {/* KPIs */}
      <KpiGrid>
        <KpiCard
          icon={<FileText className="h-4 w-4" />}
          label="Contratos activos"
          value={kpis?.active_contracts ?? 0}
          loading={kpisLoading}
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Por vencer (30 días)"
          value={kpis?.expiring_soon ?? 0}
          loading={kpisLoading}
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Cuotas vencidas"
          value={kpis?.overdue_installments_amount ?? 0}
          formatValue={(v) => formatCurrency(v, currency, locale)}
          subLabel={kpis ? `${kpis.overdue_installments_count} cuota(s)` : undefined}
          loading={kpisLoading}
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Ingreso mensual recurrente"
          value={kpis?.monthly_recurring_income ?? 0}
          formatValue={(v) => formatCurrency(v, currency, locale)}
          loading={kpisLoading}
        />
        <KpiCard
          icon={<Shield className="h-4 w-4" />}
          label="Depósitos en garantía"
          value={kpis?.total_deposits ?? 0}
          formatValue={(v) => formatCurrency(v, currency, locale)}
          loading={kpisLoading}
        />
        <KpiCard
          icon={<Building2 className="h-4 w-4" />}
          label="Habitaciones en LE"
          value={kpis?.long_stay_rooms ?? 0}
          subLabel={kpis?.total_rooms ? `${longStayPct}% del hotel` : undefined}
          loading={kpisLoading}
        />
      </KpiGrid>

      {/* Filters */}
      <FilterBar activeCount={chipParam !== 'all' ? 1 : 0}>
        <div className="flex flex-wrap gap-2">
          {STATUS_CHIPS.map((chip) => (
            <Badge
              key={chip.key}
              variant={chipParam === chip.key ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setChip(chip.key)}
            >
              {chip.label}
            </Badge>
          ))}
        </div>
        <Input
          placeholder="Buscar huésped, documento, habitación..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </FilterBar>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <ResponsiveTable
          columns={columns}
          data={filtered}
          keyExtractor={(row) => row.id}
          renderCard={(row) => (
            <Link
              href={`/contratos/${row.id}`}
              className="flex flex-col gap-1 rounded-lg border p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-primary text-sm font-medium">{row.code}</span>
                <ContractStatusBadge status={row.status} />
              </div>
              <p className="text-sm font-medium">{row.guest_full_name}</p>
              <p className="text-muted-foreground text-xs">
                Hab. {row.room_number} · {row.room_type_name}
              </p>
              <p className="text-muted-foreground text-xs">
                {formatDateRange(row.start_date, row.end_date)}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium tabular-nums">
                  {formatCurrency(row.monthly_rate, currency, locale)}/mes
                </span>
                {row.next_due_date && row.next_due_status && (
                  <InstallmentStatusBadge status={row.next_due_status} />
                )}
              </div>
            </Link>
          )}
        />
      )}

      {/* Wizard */}
      <ContractWizard open={wizardOpen} onOpenChange={setWizardOpen} />

      {/* FAB mobile */}
      <Fab icon={Plus} label="Nuevo contrato" onClick={() => setWizardOpen(true)} />
    </div>
  );
}

// -------------------------------------------------------
// Page wrapper with Suspense
// -------------------------------------------------------

export default function ContratosPage() {
  return (
    <Suspense>
      <ContratosPageInner />
    </Suspense>
  );
}
