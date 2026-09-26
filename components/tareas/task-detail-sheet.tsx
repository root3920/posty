'use client';

import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CheckSquare,
  Square,
  Send,
  Clock,
  CalendarDays,
  User2,
  Tag,
  Activity,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useTaskDetail, useTasks } from '@/hooks/use-tasks';
import type { TaskWithRelations } from '@/hooks/use-tasks';
import {
  updateTaskAction,
  addCommentAction,
  createTaskAction,
  updateTaskStatusAction,
} from '@/app/actions/tasks';
import { PRIORITY_CONFIG, AssigneeAvatars, initials } from './task-shared';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface TaskDetailSheetProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// -------------------------------------------------------
// Activity action labels
// -------------------------------------------------------

const ACTIVITY_LABELS: Record<string, string> = {
  status_changed: 'cambió el estado',
  priority_changed: 'cambió la prioridad',
  due_date_changed: 'cambió la fecha de vencimiento',
  assigned: 'asignó la tarea',
  unassigned: 'desasignó la tarea',
  created: 'creó la tarea',
};

// -------------------------------------------------------
// Subtask row
// -------------------------------------------------------

function SubtaskRow({
  task,
  onStatusToggle,
}: {
  task: TaskWithRelations;
  onStatusToggle: () => void;
}) {
  const isDone = task.status?.type === 'done';

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
      <button
        onClick={onStatusToggle}
        className="shrink-0 text-muted-foreground hover:text-primary"
      >
        {isDone ? (
          <CheckSquare className="h-4 w-4 text-green-500" />
        ) : (
          <Square className="h-4 w-4" />
        )}
      </button>
      <span
        className={`flex-1 text-sm ${isDone ? 'text-muted-foreground line-through' : 'text-foreground'}`}
      >
        {task.title}
      </span>
      {task.assignees.length > 0 && (
        <AssigneeAvatars assignees={task.assignees} size="xs" max={2} />
      )}
    </div>
  );
}

// -------------------------------------------------------
// Section wrapper
// -------------------------------------------------------

function Section({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {icon}
        {title}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

// -------------------------------------------------------
// Main component
// -------------------------------------------------------

export function TaskDetailSheet({ taskId, open, onOpenChange }: TaskDetailSheetProps) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useTaskDetail(taskId);
  const { statuses, labels, teamMembers } = useTasks();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const task = data?.task;
  const comments = data?.comments ?? [];
  const activity = data?.activity ?? [];
  const subtasks = data?.subtasks ?? [];

  // -------------------------------------------------------
  // Handlers
  // -------------------------------------------------------

  async function handleTitleSave() {
    if (!task || !titleValue.trim() || titleValue === task.title) {
      setEditingTitle(false);
      return;
    }
    await updateTaskAction(task.id, { title: titleValue });
    await queryClient.invalidateQueries({ queryKey: ['task_detail', taskId] });
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    setEditingTitle(false);
  }

  async function handleStatusChange(statusId: string | null) {
    if (!task || !statusId) return;
    await updateTaskStatusAction(task.id, statusId);
    await queryClient.invalidateQueries({ queryKey: ['task_detail', taskId] });
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }

  async function handlePriorityChange(priority: string | null) {
    if (!task || !priority) return;
    await updateTaskAction(task.id, { priority: priority as TaskWithRelations['priority'] });
    await queryClient.invalidateQueries({ queryKey: ['task_detail', taskId] });
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }

  async function handleDueDateChange(dueDate: string) {
    if (!task) return;
    await updateTaskAction(task.id, { dueDate: dueDate || null });
    await queryClient.invalidateQueries({ queryKey: ['task_detail', taskId] });
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }

  async function handleStartDateChange(startDate: string) {
    if (!task) return;
    await updateTaskAction(task.id, { startDate: startDate || null });
    await queryClient.invalidateQueries({ queryKey: ['task_detail', taskId] });
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }

  async function handleEstimatedMinutesChange(val: string) {
    if (!task) return;
    const mins = val ? parseInt(val, 10) : null;
    await updateTaskAction(task.id, { estimatedMinutes: mins });
    await queryClient.invalidateQueries({ queryKey: ['task_detail', taskId] });
  }

  async function handleAssigneeToggle(profileId: string) {
    if (!task) return;
    const current = task.assignees.map((a) => a.profile_id);
    const next = current.includes(profileId)
      ? current.filter((id) => id !== profileId)
      : [...current, profileId];
    await updateTaskAction(task.id, { assigneeIds: next });
    await queryClient.invalidateQueries({ queryKey: ['task_detail', taskId] });
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }

  async function handleLabelToggle(labelId: string) {
    if (!task) return;
    const current = task.labels.map((l) => l.label_id);
    const next = current.includes(labelId)
      ? current.filter((id) => id !== labelId)
      : [...current, labelId];
    await updateTaskAction(task.id, { labelIds: next });
    await queryClient.invalidateQueries({ queryKey: ['task_detail', taskId] });
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }

  async function handleDescriptionBlur(val: string) {
    if (!task || val === task.description) return;
    await updateTaskAction(task.id, { description: val });
    await queryClient.invalidateQueries({ queryKey: ['task_detail', taskId] });
  }

  async function handleSendComment() {
    if (!task || !commentBody.trim()) return;
    setIsSendingComment(true);
    try {
      await addCommentAction(task.id, commentBody.trim());
      setCommentBody('');
      await queryClient.invalidateQueries({ queryKey: ['task_detail', taskId] });
    } finally {
      setIsSendingComment(false);
    }
  }

  async function handleSubtaskStatusToggle(subtask: TaskWithRelations) {
    const doneStatus = statuses.find((s) => s.type === 'done');
    const openStatus = statuses.find((s) => s.type === 'open');
    if (!doneStatus || !openStatus) return;

    const isDone = subtask.status?.type === 'done';
    const newStatusId = isDone ? openStatus.id : doneStatus.id;
    await updateTaskStatusAction(subtask.id, newStatusId);
    await queryClient.invalidateQueries({ queryKey: ['task_detail', taskId] });
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }

  async function handleAddSubtask() {
    if (!task || !newSubtaskTitle.trim()) return;
    setIsAddingSubtask(true);
    try {
      const defaultStatus = statuses.find((s) => s.type === 'open') ?? statuses[0];
      if (!defaultStatus) return;
      await createTaskAction({
        title: newSubtaskTitle.trim(),
        statusId: defaultStatus.id,
        parentTaskId: task.id,
        priority: 'normal',
        assigneeIds: [],
        labelIds: [],
      });
      setNewSubtaskTitle('');
      await queryClient.invalidateQueries({ queryKey: ['task_detail', taskId] });
    } finally {
      setIsAddingSubtask(false);
    }
  }

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-2xl flex-col gap-0 p-0 sm:max-w-2xl">
        {isLoading || !task ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Header */}
            <div className="border-b px-6 py-4">
              <SheetHeader>
                {editingTitle ? (
                  <Input
                    ref={titleInputRef}
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTitleSave();
                      if (e.key === 'Escape') setEditingTitle(false);
                    }}
                    className="text-xl font-bold"
                    autoFocus
                  />
                ) : (
                  <SheetTitle
                    className="cursor-text text-xl font-bold leading-tight hover:bg-muted/50 rounded px-1 -mx-1"
                    onClick={() => {
                      setTitleValue(task.title);
                      setEditingTitle(true);
                    }}
                  >
                    {task.title}
                  </SheetTitle>
                )}
              </SheetHeader>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Status */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Estado</p>
                  <Select value={task.status_id} onValueChange={handleStatusChange}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: task.status?.color }}
                          />
                          {task.status?.name}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: s.color }}
                            />
                            {s.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Prioridad</p>
                  <Select value={task.priority} onValueChange={handlePriorityChange}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: PRIORITY_CONFIG[task.priority].color }}
                          />
                          {PRIORITY_CONFIG[task.priority].label}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: cfg.color }}
                            />
                            {cfg.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Due date */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Vence</p>
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={task.due_date ?? ''}
                    onChange={(e) => handleDueDateChange(e.target.value)}
                  />
                </div>

                {/* Start date */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Inicio</p>
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={task.start_date ?? ''}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                  />
                </div>

                {/* Estimated time */}
                <div className="space-y-1 col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Tiempo estimado (minutos)
                  </p>
                  <Input
                    type="number"
                    min={0}
                    className="h-8 text-xs"
                    defaultValue={task.estimated_minutes ?? ''}
                    onBlur={(e) => handleEstimatedMinutesChange(e.target.value)}
                    placeholder="Ej: 60"
                  />
                </div>
              </div>

              {/* Assignees */}
              <Section
                title="Asignados"
                icon={<User2 className="h-3.5 w-3.5" />}
              >
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {teamMembers.map((member) => {
                    const isAssigned = task.assignees.some((a) => a.profile_id === member.id);
                    return (
                      <button
                        key={member.id}
                        onClick={() => handleAssigneeToggle(member.id)}
                        className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors ${
                          isAssigned
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                        }`}
                      >
                        <Avatar className="h-4 w-4">
                          {member.avatar_url && (
                            <AvatarImage src={member.avatar_url} alt={member.full_name} />
                          )}
                          <AvatarFallback className="text-[8px]">
                            {initials(member.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        {member.full_name.split(' ')[0]}
                      </button>
                    );
                  })}
                </div>
              </Section>

              {/* Labels */}
              {labels.length > 0 && (
                <Section title="Etiquetas" icon={<Tag className="h-3.5 w-3.5" />}>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {labels.map((label) => {
                      const isSelected = task.labels.some((l) => l.label_id === label.id);
                      return (
                        <button
                          key={label.id}
                          onClick={() => handleLabelToggle(label.id)}
                          className="focus:outline-none"
                        >
                          <Badge
                            variant={isSelected ? 'default' : 'outline'}
                            className="cursor-pointer text-xs"
                            style={
                              isSelected
                                ? {
                                    backgroundColor: label.color,
                                    borderColor: label.color,
                                    color: '#fff',
                                  }
                                : {
                                    borderColor: `${label.color}60`,
                                    color: label.color,
                                  }
                            }
                          >
                            {label.name}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Description */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Descripción
                </p>
                <textarea
                  rows={4}
                  defaultValue={task.description ?? ''}
                  onBlur={(e) => handleDescriptionBlur(e.target.value)}
                  placeholder="Agrega una descripción (soporta Markdown)…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {/* Subtasks */}
              <Section
                title={`Subtareas (${subtasks.length})`}
                icon={<CheckSquare className="h-3.5 w-3.5" />}
              >
                <div className="space-y-0.5 pt-1">
                  {subtasks.map((subtask) => (
                    <SubtaskRow
                      key={subtask.id}
                      task={subtask}
                      onStatusToggle={() => handleSubtaskStatusToggle(subtask)}
                    />
                  ))}

                  {/* Add subtask input */}
                  <div className="flex items-center gap-2 pt-1">
                    <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <Input
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="Nueva subtarea…"
                      className="h-7 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddSubtask();
                      }}
                      disabled={isAddingSubtask}
                    />
                    {newSubtaskTitle.trim() && (
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleAddSubtask}
                        disabled={isAddingSubtask}
                      >
                        Agregar
                      </Button>
                    )}
                  </div>
                </div>
              </Section>

              {/* Comments */}
              <Section
                title={`Comentarios (${comments.length})`}
                icon={<Send className="h-3.5 w-3.5" />}
              >
                <div className="space-y-3 pt-1">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-2">
                      <Avatar className="h-7 w-7 shrink-0">
                        {comment.author?.avatar_url && (
                          <AvatarImage
                            src={comment.author.avatar_url}
                            alt={comment.author.full_name}
                          />
                        )}
                        <AvatarFallback className="text-[10px]">
                          {initials(comment.author?.full_name ?? '?')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold">
                            {comment.author?.full_name ?? 'Usuario'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), {
                              addSuffix: true,
                              locale: es,
                            })}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-foreground">{comment.body}</p>
                      </div>
                    </div>
                  ))}

                  {/* New comment input */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <textarea
                        rows={2}
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                        placeholder="Escribe un comentario…"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            handleSendComment();
                          }
                        }}
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={!commentBody.trim() || isSendingComment}
                      onClick={handleSendComment}
                      className="self-end"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Section>

              {/* Activity */}
              <Section
                title="Actividad"
                icon={<Activity className="h-3.5 w-3.5" />}
                defaultOpen={false}
              >
                <div className="space-y-2 pt-1">
                  {activity.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin actividad registrada</p>
                  )}
                  {activity.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2">
                      <Avatar className="mt-0.5 h-5 w-5 shrink-0">
                        {entry.actor?.avatar_url && (
                          <AvatarImage
                            src={entry.actor.avatar_url}
                            alt={entry.actor.full_name}
                          />
                        )}
                        <AvatarFallback className="text-[8px]">
                          {initials(entry.actor?.full_name ?? '?')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {entry.actor?.full_name ?? 'Sistema'}
                          </span>{' '}
                          {ACTIVITY_LABELS[entry.action] ?? entry.action}
                          {entry.from_value && (
                            <>
                              {' '}
                              de{' '}
                              <span className="font-medium">{entry.from_value}</span>
                            </>
                          )}
                          {entry.to_value && (
                            <>
                              {' '}
                              a{' '}
                              <span className="font-medium">{entry.to_value}</span>
                            </>
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(entry.created_at), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
