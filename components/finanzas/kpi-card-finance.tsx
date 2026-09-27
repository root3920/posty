'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';


// -------------------------------------------------------
// AnimatedNumber — animates from 0 to target value
// -------------------------------------------------------

function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format: (n: number) => string;
}) {
  const spring = useSpring(0, { stiffness: 100, damping: 30 });
  const display = useTransform(spring, (latest) => format(latest));
  const [prevValue, setPrevValue] = useState(value);

  useEffect(() => {
    if (prevValue !== value) {
      spring.set(value);
      setPrevValue(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Initialize on mount
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      spring.set(value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <motion.span>{display}</motion.span>;
}

// -------------------------------------------------------
// Trend badge
// -------------------------------------------------------

function TrendBadge({
  changePct,
}: {
  changePct: number | null | undefined;
}) {
  if (changePct == null) return null;

  const isUp = changePct > 0;
  const isFlat = changePct === 0;

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
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
      {isFlat ? '0%' : `${isUp ? '+' : ''}${changePct.toFixed(1)}%`}
    </span>
  );
}

// -------------------------------------------------------
// KpiCardFinance
// -------------------------------------------------------

export interface KpiCardFinanceProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  formatValue?: (n: number) => string;
  subLabel?: string;
  changePct?: number | null;
  formula?: string;
  color?: string;
  loading?: boolean;
}

export function KpiCardFinance({
  icon,
  label,
  value,
  formatValue,
  subLabel,
  changePct,
  formula,
  color = 'text-foreground',
  loading = false,
}: KpiCardFinanceProps) {
  const fmt = formatValue ?? ((n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 }));

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{label}</p>
            {loading ? (
              <div className="mt-1 h-6 w-20 animate-pulse rounded bg-muted" />
            ) : (
              <p className={`text-xl font-bold leading-tight ${color}`}>
                <AnimatedNumber value={value} format={fmt} />
              </p>
            )}
            {subLabel && !loading && (
              <p className="text-[11px] text-muted-foreground">{subLabel}</p>
            )}
            {!loading && (
              <div className="mt-1">
                <TrendBadge changePct={changePct} />
              </div>
            )}
          </div>
        </div>

        {formula && (
          <TooltipProvider delay={200}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label="¿Cómo se calcula?"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                }
              />
              <TooltipContent side="top" className="max-w-64 text-xs">
                <p className="font-semibold mb-1">¿Cómo se calcula?</p>
                <p>{formula}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
