'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Zap,
  Plus,
  ChevronDown,
  Loader2,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { EntitySelect } from '@/components/shared/entity-select';
import { useAutomationDetail, useAutomationRuns } from '@/hooks/use-automations';
import { updateAutomationAction, addStepAction, toggleAutomationAction } from '@/app/actions/automations';
import { TRIGGER_CATALOG, ACTION_CATALOG } from '@/lib/automation-engine';
import { formatDate } from '@/lib/format';

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function AutomationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const automationId = params.id;

  const { data: automation, isLoading } = useAutomationDetail(automationId);
  const { data: runs = [] } = useAutomationRuns(automationId);

  const [activeTab, setActiveTab] = useState<'builder' | 'history'>('builder');
  const [addStepOpen, setAddStepOpen] = useState(false);
  const [newActionType, setNewActionType] = useState('');
  const [newActionConfig, setNewActionConfig] = useState<Record<string, string>>({});
  const [addingStep, setAddingStep] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-60 w-full rounded-xl" />
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <p className="text-muted-foreground">Automatización no encontrada</p>
        <Button variant="link" onClick={() => router.push('/configuracion/automatizaciones')}>Volver</Button>
      </div>
    );
  }

  const trigger = TRIGGER_CATALOG.find((t) => t.type === automation.trigger_type);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const steps = (automation.steps ?? []) as any[];

  async function handleToggle(active: boolean) {
    const result = await toggleAutomationAction(automationId, active);
    if (result.error) toast.error(result.error);
    else {
      toast.success(active ? 'Automatización activada' : 'Automatización pausada');
      queryClient.invalidateQueries({ queryKey: ['automation_detail', automationId] });
    }
  }

  async function handleAddStep() {
    if (!newActionType) return;
    setAddingStep(true);
    const result = await addStepAction(automationId, {
      position: steps.length,
      actionType: newActionType,
      actionConfig: newActionConfig,
    });
    setAddingStep(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Paso agregado');
      queryClient.invalidateQueries({ queryKey: ['automation_detail', automationId] });
      setAddStepOpen(false);
      setNewActionType('');
      setNewActionConfig({});
    }
  }

  const actionOptions = ACTION_CATALOG.map((a) => ({ value: a.type, label: a.label }));
  const selectedAction = ACTION_CATALOG.find((a) => a.type === newActionType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{automation.name}</h1>
          {automation.description && (
            <p className="text-xs text-muted-foreground truncate">{automation.description}</p>
          )}
        </div>
        <Switch checked={automation.is_active} onCheckedChange={handleToggle} />
        <Badge variant={automation.is_active ? 'default' : 'secondary'}>
          {automation.is_active ? 'Activa' : 'Borrador'}
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        <button
          onClick={() => setActiveTab('builder')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${activeTab === 'builder' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
        >
          Constructor
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${activeTab === 'history' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
        >
          Historial ({runs.length})
        </button>
      </div>

      {/* Builder tab */}
      {activeTab === 'builder' && (
        <div className="space-y-4">
          {/* Trigger card */}
          <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold">Cuando</span>
              <Badge variant="outline">{trigger?.label ?? automation.trigger_type}</Badge>
            </div>
            {trigger && (
              <p className="text-xs text-muted-foreground mt-1">
                Variables: {trigger.variables.map((v) => `{${v.key}}`).join(', ') || 'ninguna'}
              </p>
            )}
          </div>

          {/* Connector line */}
          <div className="flex justify-center">
            <div className="h-6 w-0.5 bg-border" />
          </div>

          {/* Steps */}
          {steps.map((step, i) => {
            const actionDef = ACTION_CATALOG.find((a) => a.type === step.action_type);
            return (
              <div key={step.id}>
                <div className="rounded-xl border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{i + 1}</Badge>
                    <span className="text-sm font-medium">{actionDef?.label ?? step.action_type}</span>
                  </div>
                  {step.action_config && Object.keys(step.action_config).length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                      {Object.entries(step.action_config).map(([k, v]) => (
                        <p key={k}><span className="font-medium">{k}:</span> {String(v)}</p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex justify-center">
                  <div className="h-6 w-0.5 bg-border" />
                </div>
              </div>
            );
          })}

          {/* Add step button */}
          <div className="flex justify-center">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAddStepOpen(true)}>
              <Plus className="h-4 w-4" />
              Agregar paso
            </Button>
          </div>
        </div>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <div className="space-y-2">
          {runs.length === 0 ? (
            <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
              Sin ejecuciones registradas
            </div>
          ) : (
            runs.map((run) => (
              <div key={run.id} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
                {run.status === 'succeeded' && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                {run.status === 'failed' && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                {run.status === 'running' && <Loader2 className="h-4 w-4 text-warning animate-spin shrink-0" />}
                {!['succeeded', 'failed', 'running'].includes(run.status) && <Clock className="h-4 w-4 text-muted-foreground shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    {formatDate(run.started_at, 'd MMM yyyy HH:mm:ss')}
                  </p>
                  {run.error && <p className="text-xs text-destructive truncate">{run.error}</p>}
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {run.status}
                </Badge>
                {run.is_test && (
                  <Badge variant="secondary" className="text-[10px] shrink-0">Prueba</Badge>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Add step dialog */}
      <ResponsiveDialog
        open={addStepOpen}
        onOpenChange={setAddStepOpen}
        title="Agregar paso"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setAddStepOpen(false)}>Cancelar</Button>
            <Button disabled={!newActionType || addingStep} onClick={handleAddStep}>
              {addingStep ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Agregar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Acción *</Label>
            <EntitySelect
              options={actionOptions}
              value={newActionType || null}
              onChange={(v) => {
                setNewActionType(v ?? '');
                setNewActionConfig({});
              }}
              placeholder="Seleccionar acción"
            />
          </div>

          {/* Dynamic config fields */}
          {selectedAction && selectedAction.configFields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-xs">{field.label}</Label>
              {field.type === 'text' && (
                <Input
                  value={newActionConfig[field.key] ?? ''}
                  onChange={(e) => setNewActionConfig({ ...newActionConfig, [field.key]: e.target.value })}
                  placeholder={`Ej: {guest.first_name}`}
                />
              )}
              {field.type === 'textarea' && (
                <Textarea
                  value={newActionConfig[field.key] ?? ''}
                  onChange={(e) => setNewActionConfig({ ...newActionConfig, [field.key]: e.target.value })}
                  rows={2}
                />
              )}
              {field.type === 'select' && field.options && (
                <EntitySelect
                  options={field.options.map((o) => ({ value: o.value, label: o.label }))}
                  value={newActionConfig[field.key] || null}
                  onChange={(v) => setNewActionConfig({ ...newActionConfig, [field.key]: v ?? '' })}
                  placeholder="Seleccionar..."
                />
              )}
            </div>
          ))}
        </div>
      </ResponsiveDialog>
    </div>
  );
}
