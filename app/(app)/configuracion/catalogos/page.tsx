'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Archive,
  Loader2,
  List,
  X,
  Users,
  Baby,
  DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useProfile } from '@/hooks/use-profile';
import { formatCurrency } from '@/lib/format';
import {
  getSupabaseErrorMessage,
  logSupabaseError,
} from '@/lib/supabase/errors';

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

interface RoomTypeItem {
  id: string;
  name: string;
  description: string | null;
  base_rate: number;
  max_adults: number;
  max_children: number;
  amenities: string[];
  is_active: boolean;
  archived_at: string | null;
}

// -------------------------------------------------------
// Catalog field config — one per table
// -------------------------------------------------------

interface CatalogFieldConfig {
  table: TableName;
  label: string;
  fields: CatalogField[];
}

interface CatalogField {
  column: string;
  label: string;
  type: 'text' | 'color' | 'number' | 'select';
  required?: boolean;
  defaultValue?: string | number;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

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

// -------------------------------------------------------
// Field configs per catalog
// -------------------------------------------------------

const TASK_STATUS_TYPE_OPTIONS = [
  { value: 'open', label: 'Abierto' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'done', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const CATEGORY_GROUP_OPTIONS = [
  { value: 'departmental', label: 'Departamental' },
  { value: 'undistributed', label: 'No distribuido' },
  { value: 'fixed', label: 'Fijo' },
  { value: 'payroll', label: 'Nómina' },
];

const CATALOG_CONFIGS: CatalogFieldConfig[] = [
  {
    table: 'task_statuses',
    label: 'Estados de tarea',
    fields: [
      { column: 'name', label: 'Nombre', type: 'text', required: true },
      { column: 'color', label: 'Color', type: 'color', defaultValue: '#6b7280' },
      { column: 'sort_order', label: 'Orden', type: 'number', defaultValue: 0 },
      {
        column: 'type',
        label: 'Tipo',
        type: 'select',
        required: true,
        defaultValue: 'open',
        options: TASK_STATUS_TYPE_OPTIONS,
      },
    ],
  },
  {
    table: 'room_statuses',
    label: 'Estados de habitación',
    fields: [
      { column: 'name', label: 'Nombre', type: 'text', required: true },
      { column: 'color', label: 'Color', type: 'color', defaultValue: '#6b7280' },
      { column: 'sort_order', label: 'Orden', type: 'number', defaultValue: 0 },
    ],
  },
  {
    table: 'room_types',
    label: 'Tipos de habitación',
    fields: [], // Custom form — handled separately
  },
  {
    table: 'document_types',
    label: 'Tipos de documento',
    fields: [
      { column: 'name', label: 'Nombre', type: 'text', required: true },
      { column: 'code', label: 'Código', type: 'text', required: true, placeholder: 'Ej: CC, PA…' },
      { column: 'sort_order', label: 'Orden', type: 'number', defaultValue: 0 },
    ],
  },
  {
    table: 'booking_channels',
    label: 'Canales de reserva',
    fields: [
      { column: 'name', label: 'Nombre', type: 'text', required: true },
      { column: 'sort_order', label: 'Orden', type: 'number', defaultValue: 0 },
    ],
  },
  {
    table: 'travel_reasons',
    label: 'Motivos de viaje',
    fields: [
      { column: 'name', label: 'Nombre', type: 'text', required: true },
      { column: 'sort_order', label: 'Orden', type: 'number', defaultValue: 0 },
    ],
  },
  {
    table: 'payment_methods',
    label: 'Métodos de pago',
    fields: [
      { column: 'name', label: 'Nombre', type: 'text', required: true },
      { column: 'sort_order', label: 'Orden', type: 'number', defaultValue: 0 },
    ],
  },
  {
    table: 'revenue_centers',
    label: 'Centros de ingreso',
    fields: [
      { column: 'name', label: 'Nombre', type: 'text', required: true },
      { column: 'sort_order', label: 'Orden', type: 'number', defaultValue: 0 },
    ],
  },
  {
    table: 'expense_categories',
    label: 'Categorías de gasto',
    fields: [
      { column: 'name', label: 'Nombre', type: 'text', required: true },
      {
        column: 'category_group',
        label: 'Grupo',
        type: 'select',
        required: true,
        defaultValue: 'departmental',
        options: CATEGORY_GROUP_OPTIONS,
      },
      { column: 'sort_order', label: 'Orden', type: 'number', defaultValue: 0 },
    ],
  },
  {
    table: 'task_labels',
    label: 'Etiquetas de tarea',
    fields: [
      { column: 'name', label: 'Nombre', type: 'text', required: true },
      { column: 'color', label: 'Color', type: 'color', defaultValue: '#6b7280' },
    ],
  },
];

// -------------------------------------------------------
// Generic catalog fetch
// -------------------------------------------------------

async function fetchCatalog(table: TableName): Promise<CatalogItem[]> {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = (supabase.from(table) as any)
    .select('*')
    .order('sort_order', { ascending: true });
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CatalogItem[];
}

async function fetchRoomTypes(): Promise<RoomTypeItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('room_types')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RoomTypeItem[];
}

// -------------------------------------------------------
// Generic catalog tab (NOT used for room_types)
// -------------------------------------------------------

function CatalogTab({
  config,
  organizationId,
}: {
  config: CatalogFieldConfig;
  organizationId: string;
}) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CatalogItem | null>(null);

  // Build zod schema dynamically from fields
  const schemaShape: Record<string, z.ZodTypeAny> = {};
  for (const f of config.fields) {
    if (f.type === 'number') {
      schemaShape[f.column] = z.coerce.number().optional();
    } else if (f.required) {
      schemaShape[f.column] = z.string().min(1, `${f.label} es requerido`);
    } else {
      schemaShape[f.column] = z.string().optional();
    }
  }
  const schema = z.object(schemaShape);
  type FormValues = z.infer<typeof schema>;

  const defaultValues: Record<string, unknown> = {};
  for (const f of config.fields) {
    defaultValues[f.column] = f.defaultValue ?? (f.type === 'number' ? 0 : '');
  }

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['catalog', config.table],
    queryFn: () => fetchCatalog(config.table),
    staleTime: 5 * 60 * 1000,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as FormValues,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const supabase = createClient();
      const payload: Record<string, unknown> = {};
      for (const f of config.fields) {
        payload[f.column] = values[f.column] ?? f.defaultValue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tbl = supabase.from(config.table) as any;
      if (editTarget) {
        const { error } = await tbl.update(payload).eq('id', editTarget.id);
        if (error) throw error;
      } else {
        payload.organization_id = organizationId;
        const { error } = await tbl.insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editTarget ? 'Elemento actualizado' : 'Elemento creado');
      queryClient.invalidateQueries({ queryKey: ['catalog', config.table] });
      setDialogOpen(false);
      setEditTarget(null);
      reset(defaultValues as FormValues);
    },
    onError: (error) => {
      logSupabaseError(error, `catalog:${config.table}:save`);
      toast.error(getSupabaseErrorMessage(error));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (item: CatalogItem) => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tbl = supabase.from(config.table) as any;
      const isArchived = !!item.archived_at;
      if (isArchived) {
        const { error } = await tbl
          .update({ archived_at: null, is_active: true })
          .eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await tbl
          .update({
            archived_at: new Date().toISOString(),
            is_active: false,
          })
          .eq('id', item.id);
        if (error) throw error;
      }
    },
    onSuccess: (_d, item) => {
      toast.success(
        item.archived_at ? 'Elemento restaurado' : 'Elemento archivado',
      );
      queryClient.invalidateQueries({ queryKey: ['catalog', config.table] });
    },
    onError: (error) => {
      logSupabaseError(error, `catalog:${config.table}:archive`);
      toast.error(getSupabaseErrorMessage(error));
    },
  });

  function openCreate() {
    setEditTarget(null);
    const resetValues: Record<string, unknown> = {};
    for (const f of config.fields) {
      if (f.column === 'sort_order') {
        resetValues[f.column] = items.length;
      } else {
        resetValues[f.column] = f.defaultValue ?? (f.type === 'number' ? 0 : '');
      }
    }
    reset(resetValues as FormValues);
    setDialogOpen(true);
  }

  function openEdit(item: CatalogItem) {
    setEditTarget(item);
    const resetValues: Record<string, unknown> = {};
    for (const f of config.fields) {
      const raw = (item as unknown as Record<string, unknown>)[f.column];
      resetValues[f.column] =
        raw ?? f.defaultValue ?? (f.type === 'number' ? 0 : '');
    }
    reset(resetValues as FormValues);
    setDialogOpen(true);
  }

  const hasColor = config.fields.some((f) => f.column === 'color');
  const hasSortOrder = config.fields.some((f) => f.column === 'sort_order');
  const activeItems = items.filter((i) => !i.archived_at);
  const archivedItems = items.filter((i) => !!i.archived_at);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nuevo
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : activeItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">No hay elementos</p>
          <Button
            variant="link"
            size="sm"
            className="mt-1"
            onClick={openCreate}
          >
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
              {hasColor && item.color && (
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-white/20 shadow-sm"
                  style={{ backgroundColor: item.color }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" title={item.name}>{item.name}</p>
                {item.code && (
                  <p className="text-xs text-muted-foreground">
                    Código: {item.code}
                  </p>
                )}
                {item.type && (
                  <p className="text-xs text-muted-foreground">
                    Tipo:{' '}
                    {TASK_STATUS_TYPE_OPTIONS.find((o) => o.value === item.type)
                      ?.label ?? item.type}
                  </p>
                )}
                {item.category_group && (
                  <p className="text-xs text-muted-foreground">
                    Grupo:{' '}
                    {CATEGORY_GROUP_OPTIONS.find(
                      (g) => g.value === item.category_group,
                    )?.label ?? item.category_group}
                  </p>
                )}
              </div>
              {hasSortOrder && (
                <span className="text-xs text-muted-foreground">
                  #{item.sort_order ?? 0}
                </span>
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
              {hasColor && item.color && (
                <span
                  className="h-4 w-4 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
              )}
              <p className="flex-1 text-sm text-muted-foreground">
                {item.name}
              </p>
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
              {editTarget ? 'Editar elemento' : 'Nuevo elemento'} —{' '}
              {config.label}
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handleSubmit((v) => saveMutation.mutate(v))}
            className="space-y-4 pt-2"
          >
            {config.fields.map((f) => {
              if (f.type === 'color') {
                return (
                  <div key={f.column} className="space-y-1.5">
                    <Label>{f.label}</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={(watch(f.column) as string) ?? '#6b7280'}
                        onChange={(e) => setValue(f.column, e.target.value)}
                        className="h-9 w-9 cursor-pointer rounded border bg-transparent p-0.5"
                        aria-label="Seleccionar color"
                      />
                      <Input
                        value={(watch(f.column) as string) ?? ''}
                        onChange={(e) => setValue(f.column, e.target.value)}
                        placeholder="#6b7280"
                        className="w-32 font-mono text-sm"
                        maxLength={7}
                      />
                      <span
                        className="h-7 w-7 rounded-full border border-white/20 shadow-sm"
                        style={{
                          backgroundColor:
                            (watch(f.column) as string) ?? '#6b7280',
                        }}
                      />
                    </div>
                  </div>
                );
              }
              if (f.type === 'select' && f.options) {
                return (
                  <div key={f.column} className="space-y-1.5">
                    <Label>
                      {f.label}
                      {f.required && ' *'}
                    </Label>
                    <Select
                      value={(watch(f.column) as string) ?? ''}
                      onValueChange={(v) => setValue(f.column, v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`Seleccionar ${f.label.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {f.options.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors[f.column] && (
                      <p className="text-xs text-destructive">
                        {errors[f.column]?.message as string}
                      </p>
                    )}
                  </div>
                );
              }
              if (f.type === 'number') {
                return (
                  <div key={f.column} className="space-y-1.5">
                    <Label>{f.label}</Label>
                    <Input type="number" min={0} {...register(f.column)} />
                  </div>
                );
              }
              // text
              return (
                <div key={f.column} className="space-y-1.5">
                  <Label>
                    {f.label}
                    {f.required && ' *'}
                  </Label>
                  <Input
                    placeholder={f.placeholder}
                    {...register(f.column)}
                  />
                  {errors[f.column] && (
                    <p className="text-xs text-destructive">
                      {errors[f.column]?.message as string}
                    </p>
                  )}
                </div>
              );
            })}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || saveMutation.isPending}
              >
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
// Room types — custom form & card layout
// -------------------------------------------------------

const roomTypeSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  base_rate: z.coerce
    .number({ invalid_type_error: 'Ingresa un monto válido' })
    .min(0, 'La tarifa debe ser mayor o igual a 0'),
  max_adults: z.coerce.number().int().min(1, 'Mínimo 1 adulto'),
  max_children: z.coerce.number().int().min(0),
  amenities_input: z.string().optional(),
});

type RoomTypeFormValues = z.infer<typeof roomTypeSchema>;

function RoomTypesTab({
  organizationId,
  currency,
  locale,
}: {
  organizationId: string;
  currency: string;
  locale: string;
}) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RoomTypeItem | null>(null);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [amenityInput, setAmenityInput] = useState('');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['catalog', 'room_types'],
    queryFn: fetchRoomTypes,
    staleTime: 5 * 60 * 1000,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RoomTypeFormValues>({
    resolver: zodResolver(roomTypeSchema),
    defaultValues: {
      name: '',
      description: '',
      base_rate: 0,
      max_adults: 2,
      max_children: 0,
      amenities_input: '',
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: RoomTypeFormValues) => {
      const supabase = createClient();
      const payload = {
        name: values.name,
        description: values.description || null,
        base_rate: values.base_rate,
        max_adults: values.max_adults,
        max_children: values.max_children,
        amenities,
      };

      if (editTarget) {
        const { error } = await supabase
          .from('room_types')
          .update(payload)
          .eq('id', editTarget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('room_types')
          .insert({ ...payload, organization_id: organizationId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(
        editTarget ? 'Tipo de habitación actualizado' : 'Tipo de habitación creado',
      );
      queryClient.invalidateQueries({ queryKey: ['catalog', 'room_types'] });
      setDialogOpen(false);
      setEditTarget(null);
      setAmenities([]);
      reset();
    },
    onError: (error) => {
      logSupabaseError(error, 'catalog:room_types:save');
      toast.error(getSupabaseErrorMessage(error));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (item: RoomTypeItem) => {
      const supabase = createClient();
      const isArchived = !!item.archived_at;
      if (isArchived) {
        const { error } = await supabase
          .from('room_types')
          .update({ archived_at: null, is_active: true })
          .eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('room_types')
          .update({
            archived_at: new Date().toISOString(),
            is_active: false,
          })
          .eq('id', item.id);
        if (error) throw error;
      }
    },
    onSuccess: (_d, item) => {
      toast.success(
        item.archived_at ? 'Tipo de habitación restaurado' : 'Tipo de habitación archivado',
      );
      queryClient.invalidateQueries({ queryKey: ['catalog', 'room_types'] });
    },
    onError: (error) => {
      logSupabaseError(error, 'catalog:room_types:archive');
      toast.error(getSupabaseErrorMessage(error));
    },
  });

  function openCreate() {
    setEditTarget(null);
    setAmenities([]);
    setAmenityInput('');
    reset({
      name: '',
      description: '',
      base_rate: 0,
      max_adults: 2,
      max_children: 0,
      amenities_input: '',
    });
    setDialogOpen(true);
  }

  function openEdit(item: RoomTypeItem) {
    setEditTarget(item);
    setAmenities(item.amenities ?? []);
    setAmenityInput('');
    reset({
      name: item.name,
      description: item.description ?? '',
      base_rate: item.base_rate,
      max_adults: item.max_adults,
      max_children: item.max_children,
      amenities_input: '',
    });
    setDialogOpen(true);
  }

  function addAmenity() {
    const trimmed = amenityInput.trim();
    if (trimmed && !amenities.includes(trimmed)) {
      setAmenities([...amenities, trimmed]);
    }
    setAmenityInput('');
  }

  function removeAmenity(a: string) {
    setAmenities(amenities.filter((x) => x !== a));
  }

  const activeItems = items.filter((i) => !i.archived_at);
  const archivedItems = items.filter((i) => !!i.archived_at);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nuevo tipo
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : activeItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No hay tipos de habitación
          </p>
          <Button
            variant="link"
            size="sm"
            className="mt-1"
            onClick={openCreate}
          >
            Crear primero
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeItems.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border bg-card p-4 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate" title={item.name}>{item.name}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEdit(item)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => archiveMutation.mutate(item)}
                    disabled={archiveMutation.isPending}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  {formatCurrency(item.base_rate, currency, locale)}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {item.max_adults}
                </span>
                <span className="flex items-center gap-1">
                  <Baby className="h-3.5 w-3.5" />
                  {item.max_children}
                </span>
              </div>

              {item.amenities && item.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.amenities.map((a) => (
                    <Badge
                      key={a}
                      variant="secondary"
                      className="text-[10px] font-normal"
                    >
                      {a}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
              <p className="flex-1 text-sm text-muted-foreground">
                {item.name}
              </p>
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

      {/* Room type dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? 'Editar' : 'Nuevo'} tipo de habitación
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handleSubmit((v) => saveMutation.mutate(v))}
            className="space-y-4 pt-2"
          >
            <div className="space-y-1.5">
              <Label htmlFor="rt-name">Nombre *</Label>
              <Input id="rt-name" {...register('name')} />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rt-desc">Descripción</Label>
              <Textarea
                id="rt-desc"
                rows={2}
                {...register('description')}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rt-rate">Tarifa base *</Label>
                <Input
                  id="rt-rate"
                  type="number"
                  step="0.01"
                  min={0}
                  {...register('base_rate')}
                />
                {errors.base_rate && (
                  <p className="text-xs text-destructive">
                    {errors.base_rate.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rt-adults">Máx. adultos *</Label>
                <Input
                  id="rt-adults"
                  type="number"
                  min={1}
                  {...register('max_adults')}
                />
                {errors.max_adults && (
                  <p className="text-xs text-destructive">
                    {errors.max_adults.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rt-children">Máx. niños</Label>
                <Input
                  id="rt-children"
                  type="number"
                  min={0}
                  {...register('max_children')}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Amenidades</Label>
              <div className="flex gap-2">
                <Input
                  value={amenityInput}
                  onChange={(e) => setAmenityInput(e.target.value)}
                  placeholder="Ej: WiFi, TV, Minibar…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addAmenity();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAmenity}
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {amenities.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {amenities.map((a) => (
                    <Badge
                      key={a}
                      variant="secondary"
                      className="gap-1 pr-1 text-xs"
                    >
                      {a}
                      <button
                        type="button"
                        onClick={() => removeAmenity(a)}
                        className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || saveMutation.isPending}
              >
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
  const [activeTab, setActiveTab] =
    useState<TableName>(CATALOG_CONFIGS[0].table);
  const activeConfig =
    CATALOG_CONFIGS.find((c) => c.table === activeTab) ?? CATALOG_CONFIGS[0];

  const { data: profile } = useProfile();
  const organizationId = profile?.organization_id ?? '';
  const currency = profile?.organization?.currency ?? 'COP';
  const locale = profile?.organization?.locale ?? 'es-CO';

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
        {CATALOG_CONFIGS.map((config) => (
          <button
            key={config.table}
            onClick={() => setActiveTab(config.table)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === config.table
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {config.label}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      {activeConfig.table === 'room_types' ? (
        <RoomTypesTab
          organizationId={organizationId}
          currency={currency}
          locale={locale}
        />
      ) : (
        <CatalogTab
          config={activeConfig}
          organizationId={organizationId}
        />
      )}
    </div>
  );
}
