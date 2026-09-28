'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { EntitySelect, type EntityOption } from '@/components/shared/entity-select';
import { useCleaningTypes } from '@/hooks/use-housekeeping';
import { useAllRooms } from '@/hooks/use-hotel';
import { scheduleCleaningAction } from '@/app/actions/housekeeping';
import { format } from 'date-fns';

// -------------------------------------------------------
// Schema
// -------------------------------------------------------

const scheduleSchema = z.object({
  cleaningTypeId: z.string().min(1, 'Selecciona un tipo'),
  scheduledDate: z.string().min(1, 'Selecciona una fecha'),
  scheduledTime: z.string().min(1, 'Selecciona una hora'),
  instructions: z.string().optional(),
});

type ScheduleFormValues = z.infer<typeof scheduleSchema>;

// -------------------------------------------------------
// Props
// -------------------------------------------------------

interface ScheduleCleaningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRoomIds?: string[];
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function ScheduleCleaningDialog({
  open,
  onOpenChange,
  defaultRoomIds = [],
}: ScheduleCleaningDialogProps) {
  const queryClient = useQueryClient();
  const { data: cleaningTypes = [] } = useCleaningTypes();
  const { data: rooms = [] } = useAllRooms();
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(defaultRoomIds);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Next round hour
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      cleaningTypeId: '',
      scheduledDate: format(now, 'yyyy-MM-dd'),
      scheduledTime: format(nextHour, 'HH:mm'),
      instructions: '',
    },
  });

  // Room options
  const roomOptions = useMemo((): EntityOption[] =>
    rooms.map((r) => ({
      value: r.id,
      label: `${r.number} · Piso ${r.floor ?? '?'}`,
    })),
    [rooms],
  );

  // Cleaning type options
  const typeOptions = useMemo((): EntityOption[] =>
    cleaningTypes.map((t) => ({
      value: t.id,
      label: t.name,
      color: t.color,
    })),
    [cleaningTypes],
  );

  // Floors for "select all floor" button
  const floors = useMemo(() => {
    const set = new Set(rooms.map((r) => r.floor).filter(Boolean));
    return Array.from(set).sort() as string[];
  }, [rooms]);

  function toggleRoom(roomId: string) {
    setSelectedRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId],
    );
  }

  function selectFloor(floor: string) {
    const floorRoomIds = rooms.filter((r) => r.floor === floor).map((r) => r.id);
    const allSelected = floorRoomIds.every((id) => selectedRoomIds.includes(id));
    if (allSelected) {
      setSelectedRoomIds((prev) => prev.filter((id) => !floorRoomIds.includes(id)));
    } else {
      setSelectedRoomIds((prev) => [...new Set([...prev, ...floorRoomIds])]);
    }
  }

  async function onSubmit(values: ScheduleFormValues) {
    if (selectedRoomIds.length === 0) {
      toast.error('Selecciona al menos una habitación');
      return;
    }

    setIsSubmitting(true);
    const scheduledFor = `${values.scheduledDate}T${values.scheduledTime}:00`;

    const result = await scheduleCleaningAction({
      roomIds: selectedRoomIds,
      cleaningTypeId: values.cleaningTypeId,
      scheduledFor,
      instructions: values.instructions || undefined,
    });

    setIsSubmitting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      const count = (result as { count?: number }).count ?? selectedRoomIds.length;
      const typeName = cleaningTypes.find((t) => t.id === values.cleaningTypeId)?.name ?? 'Limpieza';
      toast.success(`${count} limpieza${count !== 1 ? 's' : ''} programada${count !== 1 ? 's' : ''} · ${typeName} · ${values.scheduledTime}`);
      queryClient.invalidateQueries({ queryKey: ['today_cleanings'] });
      queryClient.invalidateQueries({ queryKey: ['room_cleaning_status'] });
      reset();
      setSelectedRoomIds([]);
      onOpenChange(false);
    }
  }

  const selectedRooms = rooms.filter((r) => selectedRoomIds.includes(r.id));

  const formFooter = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
        Cancelar
      </Button>
      <Button type="submit" form="schedule-form" disabled={isSubmitting || selectedRoomIds.length === 0}>
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Programar (${selectedRoomIds.length})`}
      </Button>
    </div>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Programar limpieza"
      footer={formFooter}
    >
      <form id="schedule-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Room selection */}
        <div className="space-y-2">
          <Label className="text-xs">Habitaciones *</Label>
          {/* Selected rooms as badges */}
          {selectedRooms.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedRooms.map((r) => (
                <Badge key={r.id} variant="secondary" className="gap-1 pr-1 text-xs">
                  {r.number}
                  <button type="button" onClick={() => toggleRoom(r.id)} className="rounded-full p-0.5 hover:bg-muted-foreground/20">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          {/* Room selector */}
          <EntitySelect
            options={roomOptions.filter((o) => !selectedRoomIds.includes(o.value))}
            value={null}
            onChange={(v) => { if (v) toggleRoom(v); }}
            placeholder="Agregar habitación..."
          />
          {/* Floor buttons */}
          {floors.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {floors.map((f) => (
                <Button key={f} type="button" variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => selectFloor(f)}>
                  Piso {f}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Type */}
        <div className="space-y-1.5">
          <Label className="text-xs">Tipo de limpieza *</Label>
          <EntitySelect
            options={typeOptions}
            value={watch('cleaningTypeId') || null}
            onChange={(v) => setValue('cleaningTypeId', v ?? '')}
            placeholder="Seleccionar tipo"
          />
          {errors.cleaningTypeId && <p className="text-xs text-destructive">{errors.cleaningTypeId.message}</p>}
        </div>

        {/* Date & time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Fecha *</Label>
            <Input type="date" {...register('scheduledDate')} />
            {errors.scheduledDate && <p className="text-xs text-destructive">{errors.scheduledDate.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Hora *</Label>
            <Input type="time" {...register('scheduledTime')} />
            {errors.scheduledTime && <p className="text-xs text-destructive">{errors.scheduledTime.message}</p>}
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-1.5">
          <Label className="text-xs">Instrucciones (opcional)</Label>
          <Textarea rows={2} {...register('instructions')} placeholder="Instrucciones para la camarera..." />
        </div>
      </form>
    </ResponsiveDialog>
  );
}
