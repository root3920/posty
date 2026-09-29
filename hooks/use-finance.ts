'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { parseDateOnly } from '@/lib/dates';
import type { Tables, Enums } from '@/types/database';

// -------------------------------------------------------
// Enriched types
// -------------------------------------------------------

export interface ExpenseWithCategory extends Tables<'expenses'> {
  category: Tables<'expense_categories'>;
}

export interface OtherRevenueWithCenter extends Tables<'other_revenue'> {
  revenue_center: Tables<'revenue_centers'>;
}

export interface ExpenseFilters {
  from?: string;
  to?: string;
  categoryId?: string;
  paymentStatus?: Enums<'payment_status'>;
}

export interface RevenueFilters {
  from?: string;
  to?: string;
  revenueCenterId?: string;
}

export interface FinancePeriod {
  from: string;
  to: string;
}

// -------------------------------------------------------
// Revenue by center breakdown
// -------------------------------------------------------
export interface RevenueByCenterItem {
  centerId: string;
  centerName: string;
  folioRevenue: number;
  otherRevenue: number;
  total: number;
}

// -------------------------------------------------------
// Finance KPIs
// -------------------------------------------------------
export interface FinanceKPIs {
  // Occupancy & Room stats
  roomNightsSold: number;
  roomNightsAvailable: number;
  numberOfStays: number;
  occupancyPct: number;
  adr: number;
  revpar: number;
  trevpar: number;
  alos: number;
  cancellationRate: number;
  noShowRate: number;

  // Revenue
  totalFolioRevenue: number;
  totalOtherRevenue: number;
  totalRevenue: number;
  revenueByCenter: RevenueByCenterItem[];

  // Expenses
  totalExpenses: number;
  expensesByGroup: Record<string, number>;
  departmentalExpenses: number;
  undistributedExpenses: number;
  fixedExpenses: number;
  payrollExpenses: number;

  // Profitability
  gop: number;
  gopMarginPct: number;
  goppar: number;
  cpor: number;
  laborCostPct: number;
  oer: number;
  ebitda: number;
  netProfit: number;

  // Cash
  cashByPaymentMethod: Record<string, number>;
  netCashFlow: number;
  accountsReceivable: number;
  accountsPayable: number;
  projectedRevenue30: number;
  projectedRevenue60: number;
  projectedRevenue90: number;
}

// -------------------------------------------------------
// Fetch functions
// -------------------------------------------------------

async function fetchExpenses(filters: ExpenseFilters = {}): Promise<ExpenseWithCategory[]> {
  const supabase = createClient();

  let query = supabase
    .from('expenses')
    .select(
      `
      *,
      category:expense_categories(*)
      `,
    )
    .order('expense_date', { ascending: false });

  if (filters.from) query = query.gte('expense_date', filters.from);
  if (filters.to) query = query.lte('expense_date', filters.to);
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
  if (filters.paymentStatus) query = query.eq('payment_status', filters.paymentStatus);

  const { data, error } = await query;
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []) as any[];
}

async function fetchOtherRevenue(filters: RevenueFilters = {}): Promise<OtherRevenueWithCenter[]> {
  const supabase = createClient();

  let query = supabase
    .from('other_revenue')
    .select(
      `
      *,
      revenue_center:revenue_centers(*)
      `,
    )
    .order('revenue_date', { ascending: false });

  if (filters.from) query = query.gte('revenue_date', filters.from);
  if (filters.to) query = query.lte('revenue_date', filters.to);
  if (filters.revenueCenterId) query = query.eq('revenue_center_id', filters.revenueCenterId);

  const { data, error } = await query;
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []) as any[];
}

async function fetchBudgets(year: number): Promise<Tables<'budgets'>[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('year', year)
    .order('month', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

async function fetchFinanceKPIs(period: FinancePeriod): Promise<FinanceKPIs> {
  const supabase = createClient();
  const { from, to } = period;

  const today = new Date().toISOString().split('T')[0];
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const in60 = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

  // Fire all queries in parallel
  const [
    staysRes,
    folioChargesRes,
    otherRevenueRes,
    expensesRes,
    paymentsRes,
    snapshotsRes,
    roomsCountRes,
    stayBalancesRes,
    futureStays30Res,
    futureStays60Res,
    futureStays90Res,
  ] = await Promise.all([
    // stays in period (for occupancy, ADR, ALOS, cancellation, no-show)
    supabase
      .from('stays')
      .select('id, nights, rate_per_night, status, adults, children')
      .gte('check_in_date', from)
      .lte('check_in_date', to),

    // folio charges in period
    supabase
      .from('folio_charges')
      .select(
        `
        total, revenue_center_id,
        revenue_center:revenue_centers(id, name)
        `,
      )
      .gte('posted_at', `${from}T00:00:00`)
      .lte('posted_at', `${to}T23:59:59`),

    // other revenue in period
    supabase
      .from('other_revenue')
      .select(
        `
        amount, revenue_center_id,
        revenue_center:revenue_centers(id, name)
        `,
      )
      .gte('revenue_date', from)
      .lte('revenue_date', to),

    // expenses in period
    supabase
      .from('expenses')
      .select(
        `
        amount, payment_status,
        category:expense_categories(id, name, category_group)
        `,
      )
      .gte('expense_date', from)
      .lte('expense_date', to),

    // payments in period
    supabase
      .from('payments')
      .select(
        `
        amount, method_id,
        method:payment_methods(id, name)
        `,
      )
      .gte('paid_at', `${from}T00:00:00`)
      .lte('paid_at', `${to}T23:59:59`),

    // daily snapshots in period for room-nights
    supabase
      .from('daily_room_snapshots')
      .select('*')
      .gte('snapshot_date', from)
      .lte('snapshot_date', to),

    // total active rooms (fallback when no snapshots)
    supabase.from('rooms').select('id').eq('is_active', true),

    // stay balances for AR
    supabase.from('stay_balances').select('balance').gt('balance', 0),

    // future stays for projected revenue (next 30 days)
    supabase
      .from('stays')
      .select('nights, rate_per_night')
      .gte('check_in_date', today)
      .lte('check_in_date', in30)
      .in('status', ['reserved', 'checked_in']),

    // future stays 60 days
    supabase
      .from('stays')
      .select('nights, rate_per_night')
      .gte('check_in_date', today)
      .lte('check_in_date', in60)
      .in('status', ['reserved', 'checked_in']),

    // future stays 90 days
    supabase
      .from('stays')
      .select('nights, rate_per_night')
      .gte('check_in_date', today)
      .lte('check_in_date', in90)
      .in('status', ['reserved', 'checked_in']),
  ]);

  // -------------------------------------------------------
  // Process stays
  // -------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stays = (staysRes.data ?? []) as any[];
  const checkedInStays = stays.filter(
    (s) => s.status === 'checked_in' || s.status === 'checked_out',
  );
  const cancelledStays = stays.filter((s) => s.status === 'cancelled');
  const noShowStays = stays.filter((s) => s.status === 'no_show');

  const numberOfStays = checkedInStays.length;
  const roomNightsSold = checkedInStays.reduce((sum: number, s: { nights: number }) => sum + (s.nights ?? 0), 0);

  // Room-nights available: use snapshots if available, otherwise days * total rooms
  const snapshots = snapshotsRes.data ?? [];
  const totalRoomsCount = (roomsCountRes.data ?? []).length;
  let roomNightsAvailable = 0;

  if (snapshots.length > 0) {
    roomNightsAvailable = snapshots.reduce((sum, s) => sum + s.available_rooms, 0);
  } else {
    // Approximate: count days in period * total rooms
    const fromDate = parseDateOnly(from);
    const toDate = parseDateOnly(to);
    const days = Math.max(
      1,
      Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1,
    );
    roomNightsAvailable = days * totalRoomsCount;
  }

  const roomRevenue = checkedInStays.reduce(
    (sum: number, s: { nights: number; rate_per_night: number }) => sum + (s.nights ?? 0) * (s.rate_per_night ?? 0),
    0,
  );

  const occupancyPct =
    roomNightsAvailable > 0 ? (roomNightsSold / roomNightsAvailable) * 100 : 0;
  const adr = roomNightsSold > 0 ? roomRevenue / roomNightsSold : 0;
  const alos = numberOfStays > 0 ? roomNightsSold / numberOfStays : 0;

  const totalPeriodStays = stays.length;
  const cancellationRate =
    totalPeriodStays > 0 ? (cancelledStays.length / totalPeriodStays) * 100 : 0;
  const noShowRate =
    totalPeriodStays > 0 ? (noShowStays.length / totalPeriodStays) * 100 : 0;

  // -------------------------------------------------------
  // Process folio charges
  // -------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const folioCharges = (folioChargesRes.data ?? []) as any[];
  const totalFolioRevenue = folioCharges.reduce(
    (sum: number, c: { total: number }) => sum + (c.total ?? 0),
    0,
  );

  // Revenue by center from folio charges
  const revenueByCenterMap: Map<
    string,
    { centerId: string; centerName: string; folioRevenue: number; otherRevenue: number }
  > = new Map();

  for (const charge of folioCharges) {
    const centerId = charge.revenue_center_id as string;
    const centerName = (charge.revenue_center as { name: string } | null)?.name ?? 'Sin clasificar';
    const existing = revenueByCenterMap.get(centerId) ?? {
      centerId,
      centerName,
      folioRevenue: 0,
      otherRevenue: 0,
    };
    existing.folioRevenue += charge.total ?? 0;
    revenueByCenterMap.set(centerId, existing);
  }

  // -------------------------------------------------------
  // Process other revenue
  // -------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const otherRevenues = (otherRevenueRes.data ?? []) as any[];
  const totalOtherRevenue = otherRevenues.reduce(
    (sum: number, r: { amount: number }) => sum + (r.amount ?? 0),
    0,
  );

  for (const rev of otherRevenues) {
    const centerId = rev.revenue_center_id as string;
    const centerName = (rev.revenue_center as { name: string } | null)?.name ?? 'Sin clasificar';
    const existing = revenueByCenterMap.get(centerId) ?? {
      centerId,
      centerName,
      folioRevenue: 0,
      otherRevenue: 0,
    };
    existing.otherRevenue += rev.amount ?? 0;
    revenueByCenterMap.set(centerId, existing);
  }

  const revenueByCenter: RevenueByCenterItem[] = Array.from(revenueByCenterMap.values()).map(
    (item) => ({
      ...item,
      total: item.folioRevenue + item.otherRevenue,
    }),
  );

  const totalRevenue = totalFolioRevenue + totalOtherRevenue;

  // -------------------------------------------------------
  // Process expenses
  // -------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expenses = (expensesRes.data ?? []) as any[];
  const totalExpenses = expenses.reduce(
    (sum: number, e: { amount: number }) => sum + (e.amount ?? 0),
    0,
  );

  const expensesByGroup: Record<string, number> = {};
  for (const expense of expenses) {
    const group: string =
      (expense.category as { category_group: string } | null)?.category_group ?? 'other';
    expensesByGroup[group] = (expensesByGroup[group] ?? 0) + (expense.amount ?? 0);
  }

  const departmentalExpenses = expensesByGroup['departmental'] ?? 0;
  const undistributedExpenses = expensesByGroup['undistributed'] ?? 0;
  const fixedExpenses = expensesByGroup['fixed'] ?? 0;
  const payrollExpenses = expensesByGroup['payroll'] ?? 0;

  // -------------------------------------------------------
  // Profitability calculations
  // -------------------------------------------------------
  const gop = totalRevenue - departmentalExpenses - undistributedExpenses - payrollExpenses;
  const gopMarginPct = totalRevenue > 0 ? (gop / totalRevenue) * 100 : 0;
  const goppar = roomNightsAvailable > 0 ? gop / roomNightsAvailable : 0;
  const revpar = roomNightsAvailable > 0 ? roomRevenue / roomNightsAvailable : 0;
  const trevpar = roomNightsAvailable > 0 ? totalRevenue / roomNightsAvailable : 0;
  const cpor =
    roomNightsSold > 0
      ? (departmentalExpenses + undistributedExpenses) / roomNightsSold
      : 0;
  const laborCostPct = totalRevenue > 0 ? (payrollExpenses / totalRevenue) * 100 : 0;
  const operatingExpenses = departmentalExpenses + undistributedExpenses + payrollExpenses;
  const oer = totalRevenue > 0 ? (operatingExpenses / totalRevenue) * 100 : 0;
  const ebitda = gop - fixedExpenses;
  const netProfit = totalRevenue - totalExpenses;

  // -------------------------------------------------------
  // Cash: payments in period by method
  // -------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payments = (paymentsRes.data ?? []) as any[];
  const cashByPaymentMethod: Record<string, number> = {};
  let totalCashCollected = 0;

  for (const payment of payments) {
    const methodName = (payment.method as { name: string } | null)?.name ?? 'Otro';
    cashByPaymentMethod[methodName] = (cashByPaymentMethod[methodName] ?? 0) + (payment.amount ?? 0);
    totalCashCollected += payment.amount ?? 0;
  }

  // Paid expenses in period
  const paidExpenses = expenses
    .filter((e: { payment_status: string }) => e.payment_status === 'paid')
    .reduce((sum: number, e: { amount: number }) => sum + (e.amount ?? 0), 0);

  const netCashFlow = totalCashCollected - paidExpenses;

  // Accounts receivable: positive stay balances
  const stayBalances = stayBalancesRes.data ?? [];
  const accountsReceivable = stayBalances.reduce(
    (sum: number, b: { balance: number | null }) => sum + Math.max(0, b.balance ?? 0),
    0,
  );

  // Accounts payable: pending expenses
  const accountsPayable = expenses
    .filter((e: { payment_status: string }) => e.payment_status === 'pending')
    .reduce((sum: number, e: { amount: number }) => sum + (e.amount ?? 0), 0);

  // Projected revenue
  const projectedRevenue30 = (futureStays30Res.data ?? []).reduce(
    (sum, s) => sum + (s.nights ?? 0) * (s.rate_per_night ?? 0),
    0,
  );
  const projectedRevenue60 = (futureStays60Res.data ?? []).reduce(
    (sum, s) => sum + (s.nights ?? 0) * (s.rate_per_night ?? 0),
    0,
  );
  const projectedRevenue90 = (futureStays90Res.data ?? []).reduce(
    (sum, s) => sum + (s.nights ?? 0) * (s.rate_per_night ?? 0),
    0,
  );

  return {
    roomNightsSold,
    roomNightsAvailable,
    numberOfStays,
    occupancyPct,
    adr,
    revpar,
    trevpar,
    alos,
    cancellationRate,
    noShowRate,
    totalFolioRevenue,
    totalOtherRevenue,
    totalRevenue,
    revenueByCenter,
    totalExpenses,
    expensesByGroup,
    departmentalExpenses,
    undistributedExpenses,
    fixedExpenses,
    payrollExpenses,
    gop,
    gopMarginPct,
    goppar,
    cpor,
    laborCostPct,
    oer,
    ebitda,
    netProfit,
    cashByPaymentMethod,
    netCashFlow,
    accountsReceivable,
    accountsPayable,
    projectedRevenue30,
    projectedRevenue60,
    projectedRevenue90,
  };
}

// -------------------------------------------------------
// Hooks
// -------------------------------------------------------

export function useExpenses(filters: ExpenseFilters = {}) {
  return useQuery({
    queryKey: ['finance_expenses', filters],
    queryFn: () => fetchExpenses(filters),
    staleTime: 30 * 1000,
  });
}

export function useOtherRevenue(filters: RevenueFilters = {}) {
  return useQuery({
    queryKey: ['finance_other_revenue', filters],
    queryFn: () => fetchOtherRevenue(filters),
    staleTime: 30 * 1000,
  });
}

export function useBudgets(year: number) {
  return useQuery({
    queryKey: ['finance_budgets', year],
    queryFn: () => fetchBudgets(year),
    staleTime: 5 * 60 * 1000,
  });
}

export function useFinanceKPIs(period: FinancePeriod) {
  return useQuery({
    queryKey: ['finance_kpis', period.from, period.to],
    queryFn: () => fetchFinanceKPIs(period),
    staleTime: 60 * 1000,
    enabled: !!period.from && !!period.to,
  });
}
