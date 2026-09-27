'use client';

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle } from 'lucide-react';
import type { AvailabilityResult } from '@/lib/availability';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface EmployeeCardData {
  id: string;
  full_name: string;
  avatar_url: string | null;
  job_title: string | null;
  role: {
    name: string;
    color: string;
  } | null;
  todaySchedule: string; // e.g. "07:00 – 15:00" | "Descanso"
  availability: AvailabilityResult;
  pending: number;
  completed: number;
  overdue: number;
}

interface EmployeeCardProps {
  employee: EmployeeCardData;
}

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function progressPercent(completed: number, pending: number): number {
  const total = completed + pending;
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function EmployeeCard({ employee }: EmployeeCardProps) {
  const {
    id,
    full_name,
    avatar_url,
    role,
    todaySchedule,
    availability,
    pending,
    completed,
    overdue,
  } = employee;

  const progress = progressPercent(completed, pending);
  const hasOverdue = overdue > 0;

  return (
    <Link
      href={`/equipo/${id}`}
      className="group flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Header: avatar + name + role */}
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          {avatar_url && <AvatarImage src={avatar_url} alt={full_name} />}
          <AvatarFallback className="text-xs font-medium">
            {initials(full_name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">
            {full_name}
          </p>
          {role && (
            <Badge
              className="mt-1 text-[10px] font-medium"
              style={{
                backgroundColor: `${role.color}20`,
                color: role.color,
                borderColor: `${role.color}40`,
              }}
              variant="outline"
            >
              {role.name}
            </Badge>
          )}
        </div>
      </div>

      {/* Schedule */}
      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Horario:</span>{' '}
        {todaySchedule}
      </div>

      {/* Availability */}
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: availability.color }}
        />
        <span className="text-xs" style={{ color: availability.color }}>
          {availability.label}
          {availability.reason ? ` — ${availability.reason}` : ''}
        </span>
      </div>

      {/* Task counts */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{pending}</span>{' '}
          pendiente{pending !== 1 ? 's' : ''}
        </span>
        <span>
          <span className="font-medium text-foreground">{completed}</span>{' '}
          completada{completed !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-status-available transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Overdue alert */}
      {hasOverdue && (
        <div className="flex items-center gap-1.5 rounded-lg bg-danger/10 px-2 py-1.5 text-xs font-medium text-danger">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {overdue} tarea{overdue !== 1 ? 's' : ''} vencida
          {overdue !== 1 ? 's' : ''}
        </div>
      )}
    </Link>
  );
}

// -------------------------------------------------------
// Skeleton loader
// -------------------------------------------------------

export function EmployeeCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-1.5 w-full" />
    </div>
  );
}
