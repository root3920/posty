'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, HelpCircle, type LucideIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

// -------------------------------------------------------
// Animated number
// -------------------------------------------------------

function AnimatedNumber({ value, format: fmt }: { value: number; format: (n: number) => string }) {
  const spring = useSpring(0, { stiffness: 100, damping: 30 });
  const display = useTransform(spring, (latest) => fmt(latest));
  const prevRef = useRef(value);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      spring.set(value);
    } else if (prevRef.current !== value) {
      spring.set(value);
      prevRef.current = value;
    }
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
}

// -------------------------------------------------------
// Trend badge
// -------------------------------------------------------

function TrendBadge({ changePct }: { changePct: number | null | undefined }) {
  if (changePct == null) return null;

  const isUp = changePct > 0;
  const isFlat = Math.abs(changePct) < 0.05;

  const label = isFlat
    ? '0 %'
    : `${isUp ? '+' : ''}${new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(changePct)} %`;

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
        isFlat
          ? 'bg-muted text-muted-foreground'
          : isUp
          ? 'bg-success/10 text-success'
          : 'bg-danger/10 text-danger'
      }`}
    >
      {isFlat ? (
        <Minus className="h-2.5 w-2.5" />
      ) : isUp ? (
        <TrendingUp className="h-2.5 w-2.5" />
      ) : (
        <TrendingDown className="h-2.5 w-2.5" />
      )}
      {label}
    </span>
  );
}

// -------------------------------------------------------
// KpiCard — unified component for the entire app
// -------------------------------------------------------

export interface KpiCardProps {
  /** Lucide icon component */
  icon: React.ReactNode;
  /** Label (e.g. "Ingresos totales"). Sentence case. Wraps to 2 lines max. */
  label: string;
  /** The number to display (animated) */
  value: number;
  /** Custom formatter (default: locale number). Use formatCurrency, formatPercent, etc. */
  formatValue?: (n: number) => string;
  /** Subtitle below the value (e.g. "4 de 300 noches") */
  subLabel?: string;
  /** % change vs previous period. Green if >0, red if <0, muted if ~0. */
  changePct?: number | null;
  /** Formula tooltip (e.g. "Ingreso de habitaciones ÷ noches vendidas") */
  formula?: string;
  /** Loading state */
  loading?: boolean;
}

const defaultFormat = (n: number) =>
  new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n);

export function KpiCard({
  icon,
  label,
  value,
  formatValue,
  subLabel,
  changePct,
  formula,
  loading = false,
}: KpiCardProps) {
  const fmt = formatValue ?? defaultFormat;

  return (
    <div className="rounded-[10px] border bg-card p-4 shadow-md xl:p-5" style={{ containerType: 'inline-size' }}>
      {/* Row 1: icon + help button */}
      <div className="flex items-center justify-between">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 xl:h-10 xl:w-10">
          <span className="text-primary [&_svg]:h-4 [&_svg]:w-4 xl:[&_svg]:h-5 xl:[&_svg]:w-5">
            {icon}
          </span>
        </div>
        {formula && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="¿Cómo se calcula?"
                  type="button"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              }
            />
            <TooltipContent side="top" className="max-w-64 text-xs">
              <p className="mb-1 font-semibold">¿Cómo se calcula?</p>
              <p>{formula}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Row 2: label — min 2 lines height for alignment */}
      <p className="mt-2 min-h-[2.5em] text-xs leading-tight text-muted-foreground xl:text-sm">
        {label}
      </p>

      {/* Row 3: value */}
      {loading ? (
        <Skeleton className="mt-1 h-7 w-24" />
      ) : (
        <p
          className="mt-1 min-w-0 font-heading font-semibold tabular-nums leading-tight text-foreground"
          style={{ fontSize: 'clamp(20px, 13cqi, 34px)', overflowWrap: 'anywhere' }}
          data-slot="kpi-value"
        >
          <AnimatedNumber value={value} format={fmt} />
        </p>
      )}

      {/* Row 4: sub-label + trend */}
      <div className="mt-1.5 flex min-h-[1.25em] flex-wrap items-center gap-2">
        {subLabel && !loading && (
          <span className="text-[11px] leading-tight text-muted-foreground">{subLabel}</span>
        )}
        {!loading && <TrendBadge changePct={changePct} />}
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Skeleton
// -------------------------------------------------------

export function KpiCardSkeleton() {
  return (
    <div className="rounded-[10px] border bg-card p-4 xl:p-5">
      <Skeleton className="h-8 w-8 rounded-[10px] xl:h-10 xl:w-10" />
      <Skeleton className="mt-2 h-3 w-20" />
      <Skeleton className="mt-2 h-7 w-24" />
      <Skeleton className="mt-2 h-3 w-16" />
    </div>
  );
}
