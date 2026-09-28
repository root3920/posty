'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Settings2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Loader2,
  Pencil,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { createClient } from '@/lib/supabase/client';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Template = Record<string, any> & {
  id: string;
  title_template: string;
  description: string | null;
  priority: string;
  is_active: boolean;
  offset_days: number;
  anchor: string;
  at_time: string | null;
  skip_if_past: boolean;
  role_name: string | null;
  role_color: string | null;
  role_system_key: string | null;
};

// -------------------------------------------------------
// Priority config (reuse from tasks)
// -------------------------------------------------------

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  normal: 'Normal',
  low: 'Baja',
};

const ANCHOR_LABELS: Record<string, string> = {
  check_in: 'Check-in',
  check_out: 'Check-out',
  booking: 'Reserva',
};

// -------------------------------------------------------
// Fetch
// -------------------------------------------------------

async function fetchTemplates(): Promise<Template[]> {
  const supabase = createClient();

  // Fetch templates and roles separately (no FK relationship exists)
  const [templatesRes, rolesRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any)('task_templates')
      .select('*')
      .order('sort_order', { ascending: true }),
    supabase.from('roles')
      .select('id, name, color, system_key'),
  ]);

  if (templatesRes.error) {
    console.error('fetchTemplates error:', templatesRes.error);
    return [];
  }

  // Build role lookup by system_key
  const roleMap = new Map<string, { name: string; color: string | null; system_key: string | null }>();
  for (const r of (rolesRes.data ?? [])) {
    if (r.system_key) roleMap.set(r.system_key, r);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((templatesRes.data ?? []) as any[]).map((t: any) => {
    const role = roleMap.get(t.role_system_key);
    return {
      ...t,
      role_name: role?.name ?? null,
      role_color: role?.color ?? null,
    };
  });
}

// -------------------------------------------------------
// Edit dialog
// -------------------------------------------------------

interface EditDialogProps {
  template: Template | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}

function EditTemplateDialog({ template, open, onOpenChange, onSaved }: EditDialogProps) {
  const [title, setTitle] = useState(template?.title_template ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [priority, setPriority] = useState(template?.priority ?? 'normal');
  const [offsetDays, setOffsetDays] = useState<number>(template?.offset_days ?? 0);
  const [anchor, setAnchor] = useState(template?.anchor ?? 'check_in');
  const [atTime, setAtTime] = useState(template?.at_time ?? '');
  const [skipIfPast, setSkipIfPast] = useState(template?.skip_if_past ?? false);
  const [isActive, setIsActive] = useState(template?.is_active ?? true);
  const [isSaving, setIsSaving] = useState(false);

  // Sync when template changes
  if (template && title !== template.title_template && !isSaving) {
    setTitle(template.title_template);
    setDescription(template.description ?? '');
    setPriority(template.priority);
    setOffsetDays(template.offset_days);
    setAnchor(template.anchor);
    setAtTime(template.at_time ?? '');
    setSkipIfPast(template.skip_if_past);
    setIsActive(template.is_active);
  }

  async function handleSave() {
    if (!template) return;
    setIsSaving(true);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from as any)('task_templates')
        .update({
          title_template: title,
          description: description || null,
          priority,
          offset_days: offsetDays,
          anchor,
          at_time: atTime || null,
          skip_if_past: skipIfPast,
          is_active: isActive,
        })
        .eq('id', template.id);

      if (error) {
        toast.error(error.message ?? 'Error al guardar la plantilla');
      } else {
        toast.success('Plantilla actualizada');
        onSaved();
        onOpenChange(false);
      }
    } catch (err) {
      console.error('EditTemplateDialog save error:', err);
      toast.error('Error inesperado al guardar');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar plantilla</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Título *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Limpiar habitación {{room_number}}"
            />
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Puedes usar <code>{'{{room_number}}'}</code>, <code>{'{{guest_name}}'}</code>, etc.
            </p>
          </div>

          <div>
            <Label className="text-xs">Descripción</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Descripción de la tarea..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Prioridad</Label>
              <Select value={priority} onValueChange={(v) => { if (v) setPriority(v); }}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Ancla</Label>
              <Select value={anchor} onValueChange={(v) => { if (v) setAnchor(v); }}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ANCHOR_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Días de offset</Label>
              <Input
                type="number"
                value={offsetDays}
                onChange={(e) => setOffsetDays(parseInt(e.target.value, 10) || 0)}
              />
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Negativo = antes del ancla
              </p>
            </div>

            <div>
              <Label className="text-xs">Hora (HH:MM)</Label>
              <Input
                type="time"
                value={atTime}
                onChange={(e) => setAtTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={skipIfPast}
                onCheckedChange={setSkipIfPast}
                id="skip-if-past"
              />
              <Label htmlFor="skip-if-past" className="text-sm cursor-pointer">
                Omitir si ya pasó
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                id="is-active"
              />
              <Label htmlFor="is-active" className="text-sm cursor-pointer">
                Activa
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------
// Template card
// -------------------------------------------------------

interface TemplateCardProps {
  template: Template;
  onEdit: (t: Template) => void;
  onToggle: (t: Template, value: boolean) => void;
}

function TemplateCard({ template, onEdit, onToggle }: TemplateCardProps) {
  const anchorLabel = ANCHOR_LABELS[template.anchor] ?? template.anchor;
  const offsetLabel =
    template.offset_days === 0
      ? `El día del ${anchorLabel.toLowerCase()}`
      : template.offset_days > 0
        ? `${template.offset_days} día(s) después del ${anchorLabel.toLowerCase()}`
        : `${Math.abs(template.offset_days)} día(s) antes del ${anchorLabel.toLowerCase()}`;

  return (
    <div className={`rounded-lg border bg-card p-4 transition-opacity ${template.is_active ? '' : 'opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{template.title_template}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{offsetLabel}</p>
          {template.at_time && (
            <p className="text-[11px] text-muted-foreground">A las {template.at_time}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="outline"
            className="text-[10px]"
          >
            {PRIORITY_LABELS[template.priority] ?? template.priority}
          </Badge>
          <Switch
            checked={template.is_active}
            onCheckedChange={(v) => onToggle(template, v)}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onEdit(template)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {template.description && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{template.description}</p>
      )}
    </div>
  );
}

// -------------------------------------------------------
// Role group
// -------------------------------------------------------

interface RoleGroupProps {
  roleName: string;
  roleColor: string | null;
  templates: Template[];
  onEdit: (t: Template) => void;
  onToggle: (t: Template, value: boolean) => void;
}

function RoleGroup({ roleName, roleColor, templates, onEdit, onToggle }: RoleGroupProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 text-sm font-semibold hover:text-foreground transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
        {roleColor && (
          <span
            className="h-3 w-3 rounded-full shrink-0"
            style={{ backgroundColor: roleColor }}
          />
        )}
        <span>{roleName}</span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground font-normal">
          {templates.length}
        </span>
      </button>

      {!collapsed && (
        <div className="ml-6 space-y-2">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} onEdit={onEdit} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function AutomatizacionesPage() {
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['task_templates'],
    queryFn: fetchTemplates,
    staleTime: 30 * 1000,
  });

  async function handleToggle(template: Template, value: boolean) {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from as any)('task_templates')
      .update({ is_active: value })
      .eq('id', template.id);

    if (error) {
      toast.error(error.message ?? 'Error al actualizar la plantilla');
    } else {
      queryClient.invalidateQueries({ queryKey: ['task_templates'] });
    }
  }

  function handleEdit(template: Template) {
    setEditingTemplate(template);
    setEditDialogOpen(true);
  }

  async function handleRestore() {
    // Placeholder: in the future this could call an RPC to restore default templates
    setIsRestoring(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsRestoring(false);
    toast.info('Las plantillas por defecto serán restauradas en una próxima versión.');
  }

  // Group by role
  const roleGroups = templates.reduce<Map<string, { roleName: string; roleColor: string | null; templates: Template[] }>>(
    (acc, t) => {
      const key = t.role_name ?? 'Sin rol';
      if (!acc.has(key)) {
        acc.set(key, { roleName: key, roleColor: t.role_color, templates: [] });
      }
      acc.get(key)!.templates.push(t);
      return acc;
    },
    new Map(),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Automatizaciones</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Plantillas de tareas que se generan automáticamente al registrar una estancia
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRestore}
          disabled={isRestoring}
        >
          {isRestoring ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-4 w-4" />
          )}
          Restaurar plantillas por defecto
        </Button>
      </div>

      {/* Global toggle (placeholder) */}
      <div className="flex items-center justify-between rounded-lg border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium">Generación automática de tareas</p>
            <p className="text-xs text-muted-foreground">
              Al registrar una estancia, se generan las tareas configuradas
            </p>
          </div>
        </div>
        <Switch checked disabled />
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 p-3 text-sm text-info">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Las tareas se generan con base en la fecha de entrada/salida de cada estancia.
          Modifica las plantillas para personalizar qué tareas se crean para cada rol.
        </span>
      </div>

      {/* Templates grouped by role */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
          ))}
        </div>
      ) : roleGroups.size === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Settings2 className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            No hay plantillas configuradas
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Las plantillas se crearán al ejecutar la migración inicial
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(roleGroups.values()).map((group) => (
            <RoleGroup
              key={group.roleName}
              roleName={group.roleName}
              roleColor={group.roleColor}
              templates={group.templates}
              onEdit={handleEdit}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <EditTemplateDialog
        template={editingTemplate}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['task_templates'] })}
      />
    </div>
  );
}
