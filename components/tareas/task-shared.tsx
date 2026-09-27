'use client';

import { format, isToday, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { UserX } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { TaskPriority, TaskWithRelations } from '@/hooks/use-tasks';

// -------------------------------------------------------
// Priority config
// -------------------------------------------------------

export const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; color: string; bgColor: string }
> = {
  urgent: { label: 'Urgente', color: '#ef4444', bgColor: '#fef2f2' },
  high: { label: 'Alta', color: '#f59e0b', bgColor: '#fffbeb' },
  normal: { label: 'Normal', color: '#3b82f6', bgColor: '#eff6ff' },
  low: { label: 'Baja', color: '#6b7280', bgColor: '#f9fafb' },
};

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function formatDueDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(`${dateStr}T12:00:00`);
  if (isToday(date)) return 'Hoy';
  return format(date, "d MMM", { locale: es });
}

export function dueDateColor(dateStr: string | null, completedAt: string | null): string {
  if (!dateStr || completedAt) return 'text-muted-foreground';
  const date = new Date(`${dateStr}T12:00:00`);
  if (isPast(date) && !isToday(date)) return 'text-danger';
  if (isToday(date)) return 'text-warning';
  return 'text-muted-foreground';
}

// -------------------------------------------------------
// UnassignedRoleChip
// Shows a dashed chip when a task has an assigned_role_id but no assignees
// -------------------------------------------------------

interface UnassignedRoleChipProps {
  roleName: string;
  roleColor?: string | null;
  size?: 'sm' | 'xs';
}

export function UnassignedRoleChip({ roleName, roleColor, size = 'sm' }: UnassignedRoleChipProps) {
  const sizeClass = size === 'xs' ? 'text-[9px] px-1.5 py-0.5 gap-1' : 'text-[10px] px-2 py-0.5 gap-1.5';
  return (
    <span
      className={`inline-flex items-center rounded-full border border-dashed font-medium ${sizeClass}`}
      style={
        roleColor
          ? {
              borderColor: `${roleColor}60`,
              backgroundColor: `${roleColor}10`,
              color: roleColor,
            }
          : undefined
      }
    >
      <UserX className={size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      Sin asignar · {roleName}
    </span>
  );
}

// -------------------------------------------------------
// AssigneeAvatars
// -------------------------------------------------------

interface AssigneeAvatarsProps {
  assignees: TaskWithRelations['assignees'];
  max?: number;
  size?: 'sm' | 'xs';
}

export function AssigneeAvatars({ assignees, max = 3, size = 'sm' }: AssigneeAvatarsProps) {
  const shown = assignees.slice(0, max);
  const extra = assignees.length - shown.length;
  const sizeClass = size === 'xs' ? 'h-5 w-5 text-[8px]' : 'h-6 w-6 text-[10px]';

  if (assignees.length === 0) return null;

  return (
    <div className="flex -space-x-1">
      {shown.map((a) => (
        <Avatar
          key={a.id}
          className={`${sizeClass} ring-2 ring-background`}
          title={a.profile.full_name}
        >
          {a.profile.avatar_url && (
            <AvatarImage src={a.profile.avatar_url} alt={a.profile.full_name} />
          )}
          <AvatarFallback className={`font-medium ${sizeClass}`}>
            {initials(a.profile.full_name)}
          </AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <div
          className={`${sizeClass} flex items-center justify-center rounded-full bg-muted ring-2 ring-background text-[8px] font-medium text-muted-foreground`}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------
// PriorityBadge
// -------------------------------------------------------

interface PriorityBadgeProps {
  priority: TaskPriority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <Badge
      variant="outline"
      className="text-[10px] font-medium"
      style={{
        backgroundColor: cfg.bgColor,
        borderColor: `${cfg.color}40`,
        color: cfg.color,
      }}
    >
      {cfg.label}
    </Badge>
  );
}

// -------------------------------------------------------
// LabelBadges
// -------------------------------------------------------

interface LabelBadgesProps {
  labels: TaskWithRelations['labels'];
  max?: number;
}

export function LabelBadges({ labels, max = 2 }: LabelBadgesProps) {
  if (labels.length === 0) return null;
  const shown = labels.slice(0, max);
  const extra = labels.length - shown.length;

  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((l) => (
        <Badge
          key={l.id}
          variant="outline"
          className="text-[10px]"
          style={{
            backgroundColor: `${l.label.color}15`,
            borderColor: `${l.label.color}40`,
            color: l.label.color,
          }}
        >
          {l.label.name}
        </Badge>
      ))}
      {extra > 0 && (
        <Badge variant="outline" className="text-[10px] text-muted-foreground">
          +{extra}
        </Badge>
      )}
    </div>
  );
}
