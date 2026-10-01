'use client';

import { useState, Suspense } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, Download, Table2, Loader2, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/format';
import { formatDateOnly } from '@/lib/dates';
import { downloadCsv, downloadExcel } from '@/lib/reports/export-utils';
import { toast } from 'sonner';

// -------------------------------------------------------
// Report types
// -------------------------------------------------------

type ReportType =
  | 'sales_book'
  | 'purchase_book'
  | 'iva_declaration'
  | 'retention'
  | 'fontur'
  | 'occupancy'
  | 'tra_report'
  | 'sire_report';

const REPORT_OPTIONS: { value: ReportType; label: string; description: string }[] = [
  {
    value: 'sales_book',
    label: 'Libro de ventas',
    description: 'Ingresos por cargos a folios y otros ingresos',
  },
  {
    value: 'purchase_book',
    label: 'Libro de compras',
    description: 'Gastos y compras del período',
  },
  {
    value: 'iva_declaration',
    label: 'Declaración de IVA',
    description: 'Resumen IVA cobrado vs. IVA pagado',
  },
  {
    value: 'retention',
    label: 'Retención en la fuente',
    description: 'Gastos agrupados por categoría',
  },
  {
    value: 'fontur',
    label: 'Contribución parafiscal FONTUR',
    description: 'Ingresos operacionales × 0,25 %',
  },
  {
    value: 'occupancy',
    label: 'Ocupación (DANE/MinCIT)',
    description: 'Ocupación diaria promedio del período',
  },
  {
    value: 'tra_report',
    label: 'Reporte TRA',
    description: 'Registro de viajeros enviados al sistema TRA',
  },
  {
    value: 'sire_report',
    label: 'Reporte SIRE',
    description: 'Envíos al Sistema de Información de Registro de Extranjeros',
  },
];

// -------------------------------------------------------
// Column definitions per report type
// -------------------------------------------------------

interface ReportColumn {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  format?: (val: unknown) => string;
}

function getColumns(type: ReportType): ReportColumn[] {
  switch (type) {
    case 'sales_book':
      return [
        { key: 'Fecha', header: 'Fecha' },
        { key: 'Descripción', header: 'Descripción' },
        { key: 'Base', header: 'Base', align: 'right' },
        { key: 'IVA %', header: 'IVA %' },
        { key: 'IVA', header: 'IVA', align: 'right' },
        { key: 'Total', header: 'Total', align: 'right' },
        { key: 'Fuente', header: 'Fuente' },
      ];
    case 'purchase_book':
      return [
        { key: 'Fecha', header: 'Fecha' },
        { key: 'Categoría', header: 'Categoría' },
        { key: 'Grupo', header: 'Grupo' },
        { key: 'Proveedor', header: 'Proveedor' },
        { key: 'Descripción', header: 'Descripción' },
        { key: 'Monto', header: 'Monto', align: 'right' },
        { key: 'Impuesto', header: 'Impuesto', align: 'right' },
        { key: 'Estado', header: 'Estado' },
      ];
    case 'iva_declaration':
      return [
        { key: 'Concepto', header: 'Concepto' },
        { key: 'Base gravable', header: 'Base gravable', align: 'right' },
        { key: 'IVA', header: 'IVA', align: 'right' },
      ];
    case 'retention':
      return [
        { key: 'Categoría', header: 'Categoría' },
        { key: 'Grupo', header: 'Grupo' },
        { key: 'Total gastos', header: 'Total gastos', align: 'right' },
        { key: 'Cantidad', header: 'Cantidad', align: 'right' },
      ];
    case 'fontur':
      return [
        { key: 'Concepto', header: 'Concepto' },
        { key: 'Base', header: 'Base ingresos operacionales', align: 'right' },
        { key: 'Tarifa', header: 'Tarifa' },
        { key: 'Contribución', header: 'Contribución FONTUR', align: 'right' },
      ];
    case 'occupancy':
      return [
        { key: 'Fecha', header: 'Fecha' },
        { key: 'Habitaciones totales', header: 'Total hab.' },
        { key: 'Habitaciones disponibles', header: 'Disponibles' },
        { key: 'Habitaciones ocupadas', header: 'Ocupadas' },
        { key: 'Fuera de servicio', header: 'F. de servicio' },
        { key: 'Ocupación %', header: 'Ocupación %', align: 'right' },
      ];
    case 'tra_report':
      return [
        { key: 'Fecha', header: 'Fecha' },
        { key: 'Estado', header: 'Estado' },
        { key: 'ID API TRA', header: 'ID API TRA' },
        { key: 'Mensaje de error', header: 'Mensaje de error' },
      ];
    case 'sire_report':
      return [
        { key: 'Fecha', header: 'Fecha' },
        { key: 'Tipo', header: 'Tipo' },
        { key: 'Estado', header: 'Estado' },
        { key: 'Enviado en', header: 'Enviado en' },
        { key: 'Mensaje de error', header: 'Mensaje de error' },
      ];
  }
}

// -------------------------------------------------------
// Data fetchers
// -------------------------------------------------------

const GROUP_LABELS: Record<string, string> = {
  departmental: 'Departamentales',
  undistributed: 'No distribuidos',
  fixed: 'Fijos',
  payroll: 'Nómina',
};

async function fetchReport(
  type: ReportType,
  periodStart: string,
  periodEnd: string,
): Promise<Record<string, unknown>[]> {
  const supabase = createClient();

  switch (type) {
    case 'sales_book': {
      // Revenue from folio charges (stays) + other_revenue
      const { data: charges, error: chErr } = await (supabase as any)
        .from('folio_charges')
        .select('description, quantity, unit_price, tax_rate, total, posted_at, stay_id')
        .gte('posted_at', periodStart)
        .lte('posted_at', periodEnd + 'T23:59:59')
        .order('posted_at');
      if (chErr) throw chErr;

      const { data: otherRev, error: orErr } = await supabase
        .from('other_revenue')
        .select('description, amount, tax_amount, revenue_date')
        .gte('revenue_date', periodStart)
        .lte('revenue_date', periodEnd)
        .order('revenue_date');
      if (orErr) throw orErr;

      const rows: Record<string, unknown>[] = (charges ?? []).map((c: any) => {
        const base = (c.quantity ?? 1) * (c.unit_price ?? 0);
        const tax = base * (c.tax_rate ?? 0) / 100;
        return {
          'Fecha': c.posted_at ? formatDateOnly(c.posted_at) : '',
          'Descripción': c.description ?? '',
          'Base': formatCurrency(base),
          'IVA %': `${c.tax_rate ?? 0}%`,
          'IVA': formatCurrency(tax),
          'Total': formatCurrency(c.total ?? 0),
          'Fuente': 'Folio',
        };
      });

      for (const r of otherRev ?? []) {
        rows.push({
          'Fecha': (r as any).revenue_date ? formatDateOnly((r as any).revenue_date) : '',
          'Descripción': (r as any).description ?? '',
          'Base': formatCurrency((r as any).amount ?? 0),
          'IVA %': '',
          'IVA': formatCurrency((r as any).tax_amount ?? 0),
          'Total': formatCurrency(((r as any).amount ?? 0) + ((r as any).tax_amount ?? 0)),
          'Fuente': 'Otros ingresos',
        });
      }
      return rows;
    }

    case 'purchase_book': {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, category:expense_categories(name, category_group)')
        .gte('expense_date', periodStart)
        .lte('expense_date', periodEnd)
        .order('expense_date');
      if (error) throw error;
      return (data ?? []).map((exp: any) => ({
        'Fecha': exp.expense_date ? formatDateOnly(exp.expense_date) : '',
        'Categoría': exp.category?.name ?? '',
        'Grupo': GROUP_LABELS[exp.category?.category_group ?? ''] ?? exp.category?.category_group ?? '',
        'Proveedor': exp.supplier ?? '',
        'Descripción': exp.description ?? '',
        'Monto': formatCurrency(exp.amount ?? 0),
        'Impuesto': formatCurrency(exp.tax_amount ?? 0),
        'Estado': exp.payment_status === 'paid' ? 'Pagado' : 'Pendiente',
      }));
    }

    case 'iva_declaration': {
      // Revenue (IVA collected from folio charges)
      const { data: charges, error: chErr } = await (supabase as any)
        .from('folio_charges')
        .select('quantity, unit_price, tax_rate')
        .gte('posted_at', periodStart)
        .lte('posted_at', periodEnd + 'T23:59:59');
      if (chErr) throw chErr;

      // Purchases (IVA paid on expenses)
      const { data: expenses, error: expErr } = await supabase
        .from('expenses')
        .select('amount, tax_amount')
        .gte('expense_date', periodStart)
        .lte('expense_date', periodEnd);
      if (expErr) throw expErr;

      let totalBase = 0;
      let totalIvaCobrado = 0;
      for (const c of charges ?? []) {
        const base = ((c as any).quantity ?? 1) * ((c as any).unit_price ?? 0);
        totalBase += base;
        totalIvaCobrado += base * ((c as any).tax_rate ?? 0) / 100;
      }
      const totalCompras = (expenses ?? []).reduce((s: number, e: any) => s + (e.amount ?? 0), 0);
      const totalIvaPagado = (expenses ?? []).reduce((s: number, e: any) => s + (e.tax_amount ?? 0), 0);
      const ivaNeto = totalIvaCobrado - totalIvaPagado;

      return [
        {
          'Concepto': 'Ingresos gravados (cargos a folios)',
          'Base gravable': formatCurrency(totalBase),
          'IVA': formatCurrency(totalIvaCobrado),
        },
        {
          'Concepto': 'Compras deducibles (gastos)',
          'Base gravable': formatCurrency(totalCompras),
          'IVA': formatCurrency(totalIvaPagado),
        },
        {
          'Concepto': 'IVA neto a pagar / a favor',
          'Base gravable': '',
          'IVA': formatCurrency(ivaNeto),
        },
      ];
    }

    case 'retention': {
      const { data, error } = await supabase
        .from('expenses')
        .select('amount, category:expense_categories(name, category_group)')
        .gte('expense_date', periodStart)
        .lte('expense_date', periodEnd);
      if (error) throw error;

      const grouped: Record<string, { categoryGroup: string; total: number; count: number }> = {};
      for (const exp of data ?? []) {
        const cat = (exp as any).category;
        const key = cat?.name ?? 'Sin categoría';
        if (!grouped[key]) {
          grouped[key] = { categoryGroup: cat?.category_group ?? '', total: 0, count: 0 };
        }
        grouped[key].total += (exp as any).amount ?? 0;
        grouped[key].count += 1;
      }

      return Object.entries(grouped).map(([name, info]) => ({
        'Categoría': name,
        'Grupo': GROUP_LABELS[info.categoryGroup] ?? info.categoryGroup,
        'Total gastos': formatCurrency(info.total),
        'Cantidad': info.count,
      }));
    }

    case 'fontur': {
      const { data: invoices, error } = await (supabase as any)
        .from('invoices')
        .select('total')
        .gte('invoice_date', periodStart)
        .lte('invoice_date', periodEnd);
      if (error) throw error;

      const totalIngresos = (invoices ?? []).reduce((s: number, i: any) => s + (i.total ?? 0), 0);
      const contribucion = totalIngresos * 0.0025;

      return [
        {
          'Concepto': `Ingresos operacionales (${periodStart} — ${periodEnd})`,
          'Base': formatCurrency(totalIngresos),
          'Tarifa': '0,25 % (2,5 × mil)',
          'Contribución': formatCurrency(contribucion),
        },
      ];
    }

    case 'occupancy': {
      const { data, error } = await (supabase as any)
        .from('daily_room_snapshots')
        .select('snapshot_date, total_rooms, available_rooms, occupied_rooms, out_of_order_rooms')
        .gte('snapshot_date', periodStart)
        .lte('snapshot_date', periodEnd)
        .order('snapshot_date');
      if (error) throw error;

      return (data ?? []).map((snap: any) => {
        const occ =
          snap.available_rooms > 0
            ? ((snap.occupied_rooms / snap.available_rooms) * 100).toFixed(1) + ' %'
            : '—';
        return {
          'Fecha': snap.snapshot_date ? formatDateOnly(snap.snapshot_date) : '',
          'Habitaciones totales': snap.total_rooms ?? 0,
          'Habitaciones disponibles': snap.available_rooms ?? 0,
          'Habitaciones ocupadas': snap.occupied_rooms ?? 0,
          'Fuera de servicio': snap.out_of_order_rooms ?? 0,
          'Ocupación %': occ,
        };
      });
    }

    case 'tra_report': {
      const { data, error } = await (supabase as any)
        .from('tra_submissions')
        .select('created_at, status, tra_api_id, error_message')
        .gte('created_at', periodStart + 'T00:00:00')
        .lte('created_at', periodEnd + 'T23:59:59')
        .order('created_at');
      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        'Fecha': row.created_at ? formatDateOnly(row.created_at.slice(0, 10)) : '',
        'Estado': row.status ?? '',
        'ID API TRA': row.tra_api_id ?? '',
        'Mensaje de error': row.error_message ?? '',
      }));
    }

    case 'sire_report': {
      const { data, error } = await (supabase as any)
        .from('sire_submissions')
        .select('created_at, submission_type, status, submitted_at, error_message')
        .gte('created_at', periodStart + 'T00:00:00')
        .lte('created_at', periodEnd + 'T23:59:59')
        .order('created_at');
      if (error) throw error;

      const TYPE_LABELS: Record<string, string> = {
        check_in: 'Entrada',
        check_out: 'Salida',
        cancellation: 'Cancelación',
      };

      return (data ?? []).map((row: any) => ({
        'Fecha': row.created_at ? formatDateOnly(row.created_at.slice(0, 10)) : '',
        'Tipo': TYPE_LABELS[row.submission_type] ?? row.submission_type ?? '',
        'Estado': row.status ?? '',
        'Enviado en': row.submitted_at ? formatDateOnly(row.submitted_at.slice(0, 10)) : '—',
        'Mensaje de error': row.error_message ?? '',
      }));
    }
  }
}

// -------------------------------------------------------
// Report preview table
// -------------------------------------------------------

interface ReportTableProps {
  columns: ReportColumn[];
  data: Record<string, unknown>[];
}

function ReportTable({ columns, data }: ReportTableProps) {
  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No hay datos para el período seleccionado.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted/50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-muted/30 transition-colors">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-3 py-2 tabular-nums whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : ''
                  }`}
                >
                  {String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -------------------------------------------------------
// Main page content
// -------------------------------------------------------

function ReportesFiscalesContent() {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(today, 'yyyy-MM'));
  const [selectedReport, setSelectedReport] = useState<ReportType>('sales_book');
  const [reportData, setReportData] = useState<Record<string, unknown>[] | null>(null);
  const [generating, setGenerating] = useState(false);

  const periodStart = selectedMonth + '-01';
  const periodEnd = format(
    endOfMonth(new Date(selectedMonth + '-01T12:00:00')),
    'yyyy-MM-dd',
  );

  const reportOption = REPORT_OPTIONS.find((r) => r.value === selectedReport)!;
  const columns = getColumns(selectedReport);

  async function handleGenerate() {
    setGenerating(true);
    setReportData(null);
    try {
      const data = await fetchReport(selectedReport, periodStart, periodEnd);
      setReportData(data);
      if (data.length === 0) {
        toast.info('No se encontraron datos para este período.');
      } else {
        toast.success(`Reporte generado: ${data.length} fila${data.length !== 1 ? 's' : ''}`);
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al generar el reporte');
    } finally {
      setGenerating(false);
    }
  }

  function buildFilename() {
    return `${selectedReport}_${selectedMonth}`;
  }

  function handleCsv() {
    if (!reportData || reportData.length === 0) return;
    downloadCsv(reportData, buildFilename());
    toast.success('Archivo CSV descargado');
  }

  function handleExcel() {
    if (!reportData || reportData.length === 0) return;
    downloadExcel(reportData, buildFilename(), reportOption.label);
    toast.success('Archivo Excel descargado');
  }

  // Generate month options for selector (24 months back)
  const monthOptions: { value: string; label: string }[] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    monthOptions.push({
      value: format(d, 'yyyy-MM'),
      label: format(d, 'MMMM yyyy', { locale: es }),
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reportes fiscales</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Generación de reportes para la DIAN y autoridades
        </p>
      </div>

      {/* Controls card */}
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Period selector */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Período
            </label>
            <Select value={selectedMonth} onValueChange={(v) => setSelectedMonth(v ?? '')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Report type selector */}
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Tipo de reporte
            </label>
            <Select
              value={selectedReport}
              onValueChange={(v) => {
                if (v) setSelectedReport(v as ReportType);
                setReportData(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {reportOption && (
              <p className="text-xs text-muted-foreground">{reportOption.description}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Table2 className="mr-1.5 h-4 w-4" />
            )}
            Generar
          </Button>

          {reportData && reportData.length > 0 && (
            <>
              <Button variant="outline" onClick={handleCsv}>
                <FileText className="mr-1.5 h-4 w-4" />
                Descargar CSV
              </Button>
              <Button variant="outline" onClick={handleExcel}>
                <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                Descargar Excel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Preview */}
      {generating && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      )}

      {!generating && reportData !== null && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              {reportOption.label}{' '}
              <span className="font-normal text-muted-foreground">
                — {format(new Date(selectedMonth + '-01T12:00:00'), 'MMMM yyyy', { locale: es })}
              </span>
            </h2>
            {reportData.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {reportData.length} fila{reportData.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <ReportTable columns={columns} data={reportData} />
        </div>
      )}
    </div>
  );
}

export default function ReportesFiscalesPage() {
  return (
    <Suspense>
      <ReportesFiscalesContent />
    </Suspense>
  );
}
