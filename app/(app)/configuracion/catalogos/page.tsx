'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Archive, Loader2, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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

interface CatalogItem {
  id: string;
  name: string;
  color?: string | null;
  sort_order?: number | null;
  is_system?: boolean;
  is_active?: boolean;
  archived_at?: string | null;
  // Extras per catalog
  type?: string | null;
  code?: string | null;
  category_group?: string | null;
}

// -------------------------------------------------------
// Schema (shared for all catalogs)
// -------------------------------------------------------

const catalogSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  color: z.string().optional(),
  sort_order: z.coerce.number().optional(),
  type: z.string().optional(),
  code: z.string().optional(),
  category_group: z.string().optional(),
});

type CatalogFormValues = z.infer<typeof catalogSchema>;

// -------------------------------------------------------
// Catalog definitions
// -------------------------------------------------------

type TableName =
  | 'task_statuses'
  | 'room_statuses'
  | 'room_types'
  | 'document_types'
  | 'booking_channels'
  | 'travel_reasons'
  | 'payment_methods'
  | 'revenue_centers'
  | 'expense_categories'
  | 'task_labels';

interface CatalogDef {
  table: TableName;
  label: string;
  hasColor: boolean;
  hasSortOrder: boolean;
  hasType?: boolean;
  typeOptions?: { value: string; label: string }[];
  hasCode?: boolean;
  hasCategoryGroup?: boolean;
}

const CATALOG_DEFS: CatalogDef[] = [
  {
    table: 'task_statuses',
    label: 'Estados de tarea',
    hasColor: true,
    hasSortOrder: true,
    hasType: true,
    typeOptions: [
      { value: 'open', label: 'Abierto' },
      { value: 'in_progress', label: 'En progreso' },
      { value: 'done', label: 'Completado' },
      { value: 'cancelled', label: 'Cancelado' },
    ],
  },
  {
    table: 'room_statuses',
    label: 'Estados de habitación',
    hasColor: true,
    hasSortOrder: true,
  },
  {
    table: 'room_types',
    label: 'Tipos de habitación',
    hasColor: false,
    hasSortOrder: false,
  },
  {
    table: 'document_types',
    label: 'Tipos de documento',
    hasColor: false,
    hasSortOrder: true,
    hasCode: true,
  },
  {
    table: 'booking_channels',
    label: 'Canales de reserva',
    hasColor: false,
    hasSortOrder: true,
  },
  {
    table: 'travel_reasons',
    label: 'Motivos de viaje',
    hasColor: false,
    hasSortOrder: true,
  },
  {
    table: 'payment_methods',
    label: 'Métodos de pago',
    hasColor: false,
    hasSortOrder: true,
  },
  {
    table: 'revenue_centers',
    label: 'Centros de ingreso',
    hasColor: false,
    hasSortOrder: true,
  },
  {
    table: 'expense_categories',
    label: 'Categorías de gasto',
    hasColor: false,
    hasSortOrder: true,
    hasCategoryGroup: true,
  },
  {
    table: 'task_labels',
    label: 'Etiquetas de tarea',
    hasColor: true,
    hasSortOrder: false,
  },
];

const CATEGORY_GROUP_OPTIONS = [
  { value: 'departmental', label: 'Departamental' },
  { value: 'undistributed', label: 'No distribuido' },
  { value: 'fixed', label: 'Fijo' },
  { value: 'payroll', label: 'Nómina' },
  { value: 'other', label: 'Otro' },
];

// -------------------------------------------------------
// Generic catalog fetch
// -------------------------------------------------------

async function fetchCatalog(table: TableName): Promise<CatalogItem[]> {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = (supabase.from(table) as any).select('*').order('sort_order', { ascending: true });
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CatalogItem[];
}

// -------------------------------------------------------
// Generic catalog tab
// -------------------------------------------------------

function CatalogTab({ def }: { def: CatalogDef }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CatalogItem | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['catalog', def.table],
    queryFn: () => fetchCatalog(def.table),
    staleTime: 5 * 60 * 1000,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CatalogFormValues>({
    resolver: zodResolver(catalogSchema),
    defaultValues: {
      name: '',
      color: '#6b7280',
      sort_order: 0,
      type: '',
      code: '',
      category_group: 'other',
    },
  });

  // -------------------------------------------------------
  // Mutations
  // -------------------------------------------------------

  const saveMutation = useMutation({
    mutationFn: async (values: CatalogFormValues) => {
      const supabase = createClient();
      const payload: Record<string, unknown> = { name: values.name };
      if (def.hasColor) payload.color = values.color;
      if (def.hasSortOrder) payload.sort_order = values.sort_order ?? 0;
      if (def.hasType) payload.type = values.type;
      if (def.hasCode) payload.code = values.code;
      if (def.hasCategoryGroup) payload.category_group = values.category_group;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tbl = supabase.from(def.table) as any;
      if (editTarget) {
        const { error } = await tbl.update(payload).eq('id', editTarget.id);
        if (error) throw error;
      } else {
        const { error } = await tbl.insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editTarget ? 'Elemento actualizado' : 'Elemento creado');
      queryClient.invalidateQueries({ queryKey: ['catalog', def.table] });
      setDialogOpen(false);
      setEditTarget(null);
      reset();
    },
    onError: () => toast.error('Error al guardar'),
  });

  const archiveMutation = useMutation({
    mutationFn: async (item: CatalogItem) => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tbl = supabase.from(def.table) as any;
      const isArchived = !!item.archived_at;
      if (isArchived) {
        const { error } = await tbl.update({ archived_at: null, is_active: true }).eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await tbl
          .update({ archived_at: new Date().toISOString(), is_active: false })
          .eq('id', item.id);
        if (error) throw error;
      }
    },
    onSuccess: (_d, item) => {
      toast.success(item.archived_at ? 'Elemento restaurado' : 'Elemento archivado');
      queryClient.invalidateQueries({ queryKey: ['catalog', def.table] });
    },
    onError: () => toast.error('Error al archivar'),
  });

  // -------------------------------------------------------
  // Helpers
  // -------------------------------------------------------

  function openCreate() {
    setEditTarget(null);
    reset({ name: '', color: '#6b7280', sort_order: (items.length ?? 0), type: '', code: '', category_group: 'other' });
    setDialogOpen(true);
  }

  function openEdit(item: CatalogItem) {
    setEditTarget(item);
    reset({
      name: item.name,
      color: item.color ?? '#6b7280',
      sort_order: item.sort_order ?? 0,
      type: item.type ?? '',
      code: item.code ?? '',
      category_group: item.category_group ?? 'other',
    });
    setDialogOpen(true);
  }

  const activeItems = items.filter((i) => !i.archived_at);
  const archivedItems = items.filter((i) => !!i.archived_at);

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nuevo
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : activeItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">No hay elementos</p>
          <Button variant="link" size="sm" className="mt-1" onClick={openCreate}>
            Crear primero
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {activeItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm"
            >
              {def.hasColor && item.color && (
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-white/20 shadow-sm"
                  style={{ backgroundColor: item.color }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{item.name}</p>
                {item.code && (
                  <p className="text-xs text-muted-foreground">Código: {item.code}</p>
                )}
                {item.type && (
                  <p className="text-xs text-muted-foreground">Tipo: {item.type}</p>
                )}
                {item.category_group && (
                  <p className="text-xs text-muted-foreground">
                    Grupo: {CATEGORY_GROUP_OPTIONS.find((g) => g.value === item.category_group)?.label ?? item.category_group}
                  </p>
                )}
              </div>
              {def.hasSortOrder && (
                <span className="text-xs text-muted-foreground">#{item.sort_order ?? 0}</span>
              )}
              {item.is_system && (
                <Badge variant="secondary" className="text-[10px]">
                  Sistema
                </Badge>
              )}
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(item)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {!item.is_system && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => archiveMutation.mutate(item)}
                    disabled={archiveMutation.isPending}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Archived items */}
      {archivedItems.length > 0 && (
        <div className="space-y-2 opacity-60">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Archivados ({archivedItems.length})
          </p>
          {archivedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl border bg-muted/40 px-4 py-3 line-through"
            >
              {def.hasColor && item.color && (
                <span
                  className="h-4 w-4 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
              )}
              <p className="flex-1 text-sm text-muted-foreground">{item.name}</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => archiveMutation.mutate(item)}
                disabled={archiveMutation.isPending}
              >
                Restaurar
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editTarget ? 'Editar elemento' : 'Nuevo elemento'} — {def.label}
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handleSubmit((v) => saveMutation.mutate(v))}
            className="space-y-4 pt-2"
          >
            <div className="space-y-1.5">
              <Label htmlFor="catalog-name">Nombre *</Label>
              <Input id="catalog-name" {...register('name')} />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            {def.hasCode && (
              <div className="space-y-1.5">
                <Label htmlFor="catalog-code">Código</Label>
                <Input id="catalog-code" placeholder="Ej: CC, PA…" {...register('code')} />
              </div>
            )}

            {def.hasType && def.typeOptions && (
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={watch('type') ?? ''}
                  onValueChange={(v) => setValue('type', v ?? '')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {def.typeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {def.hasCategoryGroup && (
              <div className="space-y-1.5">
                <Label>Grupo</Label>
                <Select
                  value={watch('category_group') ?? 'other'}
                  onValueChange={(v) => setValue('category_group', v ?? 'other')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_GROUP_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {def.hasColor && (
              <div className="space-y-1.5">
                <Label htmlFor="catalog-color">Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={watch('color') ?? '#6b7280'}
                    onChange={(e) => setValue('color', e.target.value)}
                    className="h-9 w-9 cursor-pointer rounded border bg-transparent p-0.5"
                    aria-label="Seleccionar color"
                  />
                  <Input
                    id="catalog-color"
                    value={watch('color') ?? ''}
                    onChange={(e) => setValue('color', e.target.value)}
                    placeholder="#6b7280"
                    className="w-32 font-mono text-sm"
                    maxLength={7}
                  />
                  <span
                    className="h-7 w-7 rounded-full border border-white/20 shadow-sm"
                    style={{ backgroundColor: watch('color') ?? '#6b7280' }}
                  />
                </div>
              </div>
            )}

            {def.hasSortOrder && (
              <div className="space-y-1.5">
                <Label htmlFor="catalog-sort">Orden</Label>
                <Input
                  id="catalog-sort"
                  type="number"
                  min={0}
                  {...register('sort_order')}
                />
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || saveMutation.isPending}>
                {(isSubmitting || saveMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editTarget ? 'Guardar cambios' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function CatalogosPage() {
  const [activeTab, setActiveTab] = useState<TableName>(CATALOG_DEFS[0].table);
  const activeDef = CATALOG_DEFS.find((d) => d.table === activeTab) ?? CATALOG_DEFS[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <List className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogos</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los catálogos del sistema
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1.5">
        {CATALOG_DEFS.map((def) => (
          <button
            key={def.table}
            onClick={() => setActiveTab(def.table)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === def.table
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {def.label}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      <CatalogTab def={activeDef} />
    </div>
  );
}
