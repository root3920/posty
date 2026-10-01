'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  FileX2,
  ExternalLink,
  Copy,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveTable, type Column } from '@/components/shared/responsive-table';
import { useInvoices, useInvoiceDetail, type Invoice } from '@/hooks/use-invoices';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// -------------------------------------------------------
// DIAN status badge
// -------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  validated: {
    label: 'Validada',
    icon: CheckCircle2,
    className: 'bg-success/10 text-success',
  },
  pending: {
    label: 'Pendiente',
    icon: Clock,
    className: 'bg-warning/10 text-warning',
  },
  rejected: {
    label: 'Rechazada',
    icon: XCircle,
    className: 'bg-danger/10 text-danger',
  },
  draft: {
    label: 'Borrador',
    icon: FileX2,
    className: 'bg-muted text-muted-foreground',
  },
};

function DianStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const Icon = config.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function truncateCufe(cufe: string | null) {
  if (!cufe) return '—';
  return `${cufe.slice(0, 8)}...${cufe.slice(-4)}`;
}

// -------------------------------------------------------
// Invoice detail panel
// -------------------------------------------------------

function InvoiceDetailPanel({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const { data, isLoading } = useInvoiceDetail(invoiceId);

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { invoice, lines } = data;

  return (
    <div className="space-y-5">
      {/* Back button */}
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a la lista
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 rounded-xl border bg-card p-5">
        <div>
          <p className="text-xs text-muted-foreground">Número de factura</p>
          <p className="text-xl font-bold tabular-nums">
            {invoice.prefix ? `${invoice.prefix}-` : ''}{invoice.invoice_number}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(invoice.invoice_date), "d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>
        <DianStatusBadge status={invoice.dian_status} />
      </div>

      {/* Customer */}
      <div className="rounded-xl border bg-card p-5 space-y-2">
        <h3 className="text-sm font-semibold">Cliente</h3>
        <p className="text-sm">{invoice.customer_name}</p>
        {invoice.customer_nit && (
          <p className="text-xs text-muted-foreground">NIT / Doc: {invoice.customer_nit}</p>
        )}
      </div>

      {/* Lines */}
      {lines.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b">
            <h3 className="text-sm font-semibold">Líneas de factura</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-muted-foreground">Descripción</th>
                <th className="px-4 py-2 text-right text-xs text-muted-foreground">Cant.</th>
                <th className="px-4 py-2 text-right text-xs text-muted-foreground">Precio</th>
                <th className="px-4 py-2 text-right text-xs text-muted-foreground">IVA</th>
                <th className="px-4 py-2 text-right text-xs text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-4 py-2">{line.description}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{line.quantity}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(line.unit_price)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{line.tax_rate}%</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{formatCurrency(line.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals */}
      <div className="rounded-xl border bg-card p-5 space-y-2">
        <h3 className="text-sm font-semibold mb-3">Resumen</h3>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{formatCurrency(invoice.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">IVA</span>
          <span className="tabular-nums">{formatCurrency(invoice.iva_amount)}</span>
        </div>
        <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2">
          <span>Total</span>
          <span className="tabular-nums">{formatCurrency(invoice.total)}</span>
        </div>
      </div>

      {/* CUFE */}
      {invoice.cufe && (
        <div className="rounded-xl border bg-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">CUFE</h3>
            <button
              onClick={() => {
                navigator.clipboard.writeText(invoice.cufe!);
                toast.success('CUFE copiado');
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </button>
          </div>
          <p className="text-xs font-mono break-all text-muted-foreground">{invoice.cufe}</p>
        </div>
      )}

      {/* PDF */}
      {invoice.pdf_path && (
        <a
          href={invoice.pdf_path}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ExternalLink className="h-4 w-4" />
          Descargar PDF
        </a>
      )}
    </div>
  );
}

// -------------------------------------------------------
// Invoice table columns
// -------------------------------------------------------

const COLUMNS: Column<Invoice>[] = [
  {
    key: 'invoice_number',
    header: 'Número',
    priority: 1,
    render: (row) => (
      <span className="font-medium tabular-nums">
        {row.prefix ? `${row.prefix}-` : ''}{row.invoice_number}
      </span>
    ),
  },
  {
    key: 'invoice_date',
    header: 'Fecha',
    priority: 1,
    render: (row) => format(new Date(row.invoice_date), 'dd/MM/yyyy'),
  },
  {
    key: 'customer_name',
    header: 'Cliente',
    priority: 1,
    render: (row) => <span className="max-w-[180px] truncate block">{row.customer_name}</span>,
  },
  {
    key: 'customer_nit',
    header: 'NIT / Doc.',
    priority: 2,
    render: (row) => <span className="text-muted-foreground tabular-nums">{row.customer_nit ?? '—'}</span>,
  },
  {
    key: 'subtotal',
    header: 'Subtotal',
    priority: 3,
    render: (row) => <span className="tabular-nums">{formatCurrency(row.subtotal)}</span>,
  },
  {
    key: 'iva_amount',
    header: 'IVA',
    priority: 3,
    render: (row) => <span className="tabular-nums">{formatCurrency(row.iva_amount)}</span>,
  },
  {
    key: 'total',
    header: 'Total',
    priority: 1,
    render: (row) => <span className="font-semibold tabular-nums">{formatCurrency(row.total)}</span>,
  },
  {
    key: 'dian_status',
    header: 'Estado DIAN',
    priority: 1,
    render: (row) => <DianStatusBadge status={row.dian_status} />,
  },
  {
    key: 'cufe',
    header: 'CUFE',
    priority: 3,
    render: (row) => (
      <span className="font-mono text-xs text-muted-foreground">{truncateCufe(row.cufe)}</span>
    ),
  },
];

// -------------------------------------------------------
// Main content
// -------------------------------------------------------

function FacturasContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const today = new Date();
  const defaultFrom = format(startOfMonth(today), 'yyyy-MM-dd');
  const defaultTo = format(endOfMonth(today), 'yyyy-MM-dd');

  const dateFrom = searchParams.get('desde') ?? defaultFrom;
  const dateTo = searchParams.get('hasta') ?? defaultTo;

  const [fromInput, setFromInput] = useState(dateFrom);
  const [toInput, setToInput] = useState(dateTo);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const { data: invoices = [], isLoading } = useInvoices(dateFrom, dateTo);

  function applyFilter() {
    if (!fromInput || !toInput) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('desde', fromInput);
    params.set('hasta', toInput);
    router.push(`${pathname}?${params.toString()}`);
  }

  if (selectedInvoiceId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Detalle de factura</h1>
            <p className="text-sm text-muted-foreground">Facturación electrónica DIAN</p>
          </div>
        </div>
        <InvoiceDetailPanel invoiceId={selectedInvoiceId} onClose={() => setSelectedInvoiceId(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Facturas electrónicas</h1>
            <p className="text-sm text-muted-foreground">Facturación DIAN</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/configuracion/facturacion')}
        >
          Configurar DIAN
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Desde</span>
          <input
            type="date"
            value={fromInput}
            onChange={(e) => setFromInput(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Hasta</span>
          <input
            type="date"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          />
        </div>
        <Button size="sm" onClick={applyFilter}>
          Aplicar
        </Button>
      </div>

      {/* Summary KPIs */}
      {!isLoading && invoices.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: 'Total facturas',
              value: invoices.length.toString(),
              className: 'text-foreground',
            },
            {
              label: 'Validadas DIAN',
              value: invoices.filter((i) => i.dian_status === 'validated').length.toString(),
              className: 'text-success',
            },
            {
              label: 'Pendientes',
              value: invoices.filter((i) => i.dian_status === 'pending').length.toString(),
              className: 'text-warning',
            },
            {
              label: 'Total facturado',
              value: formatCurrency(invoices.reduce((s, i) => s + i.total, 0)),
              className: 'text-foreground font-bold',
            },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={cn('text-lg font-semibold tabular-nums mt-0.5', kpi.className)}>
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">No hay facturas en este período</p>
          <p className="text-xs text-muted-foreground mt-1">
            Las facturas se generan desde las reservas o contratos de larga estadía
          </p>
        </div>
      ) : (
        <ResponsiveTable
          data={invoices}
          columns={COLUMNS}
          keyExtractor={(row) => row.id}
          actions={(row) => (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedInvoiceId(row.id)}
            >
              Ver
            </Button>
          )}
          renderCard={(row) => (
            <div
              key={row.id}
              className="cursor-pointer rounded-xl border bg-card p-4 space-y-2 hover:bg-muted/30 transition-colors"
              onClick={() => setSelectedInvoiceId(row.id)}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold tabular-nums text-sm">
                  {row.prefix ? `${row.prefix}-` : ''}{row.invoice_number}
                </span>
                <DianStatusBadge status={row.dian_status} />
              </div>
              <p className="text-sm">{row.customer_name}</p>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{format(new Date(row.invoice_date), 'dd/MM/yyyy')}</span>
                <span className="tabular-nums font-medium text-foreground">{formatCurrency(row.total)}</span>
              </div>
              {row.cufe && (
                <p className="text-xs font-mono text-muted-foreground truncate">{truncateCufe(row.cufe)}</p>
              )}
            </div>
          )}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------
// Page export
// -------------------------------------------------------

export default function FacturasPage() {
  return (
    <Suspense>
      <FacturasContent />
    </Suspense>
  );
}
