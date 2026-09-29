'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Zap,
  Plus,
  MoreHorizontal,
  Trash2,
  Copy,
  Play,
  History,
  Settings2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { EntitySelect } from '@/components/shared/entity-select';
import { PageHeader } from '@/components/shared/page-header';
import { Fab } from '@/components/layout/fab';
import { createClient } from '@/lib/supabase/client';
import { useAutomations } from '@/hooks/use-automations';
import { createAutomationAction, toggleAutomationAction, deleteAutomationAction } from '@/app/actions/automations';
import { TRIGGER_CATALOG } from '@/lib/automation-engine';
import { formatDate } from '@/lib/format';

// -------------------------------------------------------
// Task templates fetch (existing system templates)
// -------------------------------------------------------

interface Template {
  id: string;
  title_template: string;
  description: string | null;
  role_system_key: string;
  role_name: string | null;
  role_color: string | null;
  workflow: string;
  scope: string;
  anchor: string;
  offset_days: number;
  at_time: string | null;
  priority: string;
  is_active: boolean;
  phase: number | null;
}

async function fetchTemplates(): Promise<Template[]> {
  const supabase = createClient();
  const [templatesRes, rolesRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any)('task_templates').select('*').order('sort_order', { ascending: true }),
    supabase.from('roles').select('id, name, color, system_key'),
  ]);
  if (templatesRes.error) throw templatesRes.error;
  const roleMap = new Map<string, { name: string; color: string | null }>();
  for (const r of (rolesRes.data ?? [])) {
    if (r.system_key) roleMap.set(r.system_key, r);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((templatesRes.data ?? []) as any[]).map((t: any) => {
    const role = roleMap.get(t.role_system_key);
    return { ...t, role_name: role?.name ?? null, role_color: role?.color ?? null };
  });
}

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function AutomatizacionesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('mis');
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTrigger, setNewTrigger] = useState('');
  const [creating, setCreating] = useState(false);

  const { data: automations = [], isLoading: automationsLoading } = useAutomations();
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['task_templates_list'],
    queryFn: fetchTemplates,
    staleTime: 5 * 60 * 1000,
  });

  const tabs = [
    { key: 'mis', label: 'Mis automatizaciones', count: automations.filter((a) => !a.is_system).length },
    { key: 'sistema', label: 'Flujos de POSTY', count: templates.length },
  ];

  async function handleCreate() {
    if (!newName.trim() || !newTrigger) return;
    setCreating(true);
    const result = await createAutomationAction({
      name: newName.trim(),
      triggerType: newTrigger,
    });
    setCreating(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Automatización creada');
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      setNewDialogOpen(false);
      setNewName('');
      setNewTrigger('');
      if (result.automationId) {
        router.push(`/configuracion/automatizaciones/${result.automationId}`);
      }
    }
  }

  async function handleToggle(id: string, active: boolean) {
    const result = await toggleAutomationAction(id, active);
    if (result.error) {
      toast.error(result.error);
    } else {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteAutomationAction(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Automatización eliminada');
      queryClient.invalidateQueries({ queryKey: ['automations'] });
    }
  }

  const triggerOptions = TRIGGER_CATALOG.map((t) => ({
    value: t.type,
    label: t.label,
    description: t.category,
  }));

  const userAutomations = automations.filter((a) => !a.is_system);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automatizaciones"
        description="Cuando pasa algo → haz algo automáticamente"
        actions={
          <Button size="sm" onClick={() => setNewDialogOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nueva automatización
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px]">{tab.count}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Mis automatizaciones */}
      {activeTab === 'mis' && (
        <div className="space-y-3">
          {automationsLoading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          ) : userAutomations.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 text-center">
              <Zap className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <h3 className="text-base font-semibold">Aún no tienes automatizaciones</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Crea tu primera automatización para que POSTY haga cosas por ti
              </p>
              <Button className="mt-4" onClick={() => setNewDialogOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Nueva automatización
              </Button>
            </div>
          ) : (
            userAutomations.map((a) => (
              <div key={a.id} className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Zap className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/configuracion/automatizaciones/${a.id}`} className="font-semibold text-sm hover:underline">
                    {a.name}
                  </Link>
                  {a.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{a.description}</p>}
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">
                      {TRIGGER_CATALOG.find((t) => t.type === a.trigger_type)?.label ?? a.trigger_type}
                    </Badge>
                    <span>Creada {formatDate(a.created_at, 'd MMM yyyy')}</span>
                  </div>
                </div>
                <Switch checked={a.is_active} onCheckedChange={(v) => handleToggle(a.id, v)} />
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted">
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => router.push(`/configuracion/automatizaciones/${a.id}`)}>
                      <Settings2 className="mr-2 h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(a.id)} className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Flujos de POSTY (task_templates) */}
      {activeTab === 'sistema' && (
        <div className="space-y-3">
          {templatesLoading ? (
            [...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
          ) : templates.length === 0 ? (
            <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
              No hay plantillas del sistema
            </div>
          ) : (
            templates.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t.title_template}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {t.role_name && (
                      <Badge variant="outline" className="text-[10px]" style={{ borderColor: t.role_color ?? undefined }}>
                        {t.role_name}
                      </Badge>
                    )}
                    {t.phase && (
                      <span className="text-[10px] text-muted-foreground">Fase {t.phase}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {t.priority}
                    </span>
                  </div>
                </div>
                <Badge variant={t.is_active ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                  {t.is_active ? 'Activa' : 'Pausada'}
                </Badge>
              </div>
            ))
          )}
        </div>
      )}

      {/* New automation dialog */}
      <ResponsiveDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        title="Nueva automatización"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setNewDialogOpen(false)}>Cancelar</Button>
            <Button disabled={!newName.trim() || !newTrigger || creating} onClick={handleCreate}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear y configurar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre *</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: Bienvenida VIP" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cuando pasa... *</Label>
            <EntitySelect
              options={triggerOptions}
              value={newTrigger || null}
              onChange={(v) => setNewTrigger(v ?? '')}
              placeholder="Seleccionar disparador"
            />
          </div>
        </div>
      </ResponsiveDialog>

      {/* FAB */}
      <Fab icon={Plus} onClick={() => setNewDialogOpen(true)} label="Nueva automatización" />
    </div>
  );
}
