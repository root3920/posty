'use client';

import { useRouter } from 'next/navigation';
import {
  MoreHorizontal,
  Eye,
  UserRound,
  Edit,
  ArrowRightLeft,
  Calendar,
  LogIn,
  XCircle,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// -------------------------------------------------------
// Props
// -------------------------------------------------------

interface StayActionsMenuProps {
  stay: {
    id: string;
    status: string;
    check_in_date: string;
    check_out_date: string;
    stay_type: string | null;
    primary_guest_id: string;
    contract_id: string | null;
  };
  today: string;
  onConfirmArrival: () => void;
  onEditStay: () => void;
  onChangeRoom: () => void;
  onExtendStay: () => void;
  onCancelStay: () => void;
  onConvertModality: () => void;
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function StayActionsMenu({
  stay,
  today,
  onConfirmArrival,
  onEditStay,
  onChangeRoom,
  onExtendStay,
  onCancelStay,
  onConvertModality,
}: StayActionsMenuProps) {
  const router = useRouter();

  const isReserved = stay.status === 'reserved';
  const isCheckedIn = stay.status === 'checked_in';
  const canEdit = isReserved || isCheckedIn;
  const canConfirmArrival = isReserved && stay.check_in_date <= today;
  const isLongStayWithContract =
    stay.stay_type === 'long_stay' && !!stay.contract_id;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 data-[state=open]:bg-muted"
            aria-label="Acciones de la reserva"
          />
        }
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        {/* Always visible: view detail + guest */}
        <DropdownMenuItem onClick={() => router.push(`/hotel/reservas/${stay.id}`)}>
          <Eye className="h-4 w-4 text-muted-foreground" />
          Ver detalle
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push(`/hotel/huespedes/${stay.primary_guest_id}`)}
        >
          <UserRound className="h-4 w-4 text-muted-foreground" />
          Ver ficha del huésped
        </DropdownMenuItem>

        {/* Long stay with contract */}
        {isLongStayWithContract && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push(`/contratos/${stay.contract_id!}`)}
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              Ver contrato
            </DropdownMenuItem>
          </>
        )}

        {/* Edit actions (reserved + checked_in) */}
        {canEdit && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEditStay}>
              <Edit className="h-4 w-4 text-muted-foreground" />
              Editar reserva
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onChangeRoom}>
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              Cambiar habitación
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExtendStay}>
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Extender o acortar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onConvertModality}>
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              {stay.stay_type === 'long_stay' ? 'Convertir a corta' : 'Convertir a larga estadía'}
            </DropdownMenuItem>
          </>
        )}

        {/* Confirm arrival (reserved + check_in_date <= today) */}
        {canConfirmArrival && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onConfirmArrival}
              className="text-success"
            >
              <LogIn className="h-4 w-4" />
              Confirmar llegada
            </DropdownMenuItem>
          </>
        )}

        {/* Cancel (reserved only) */}
        {isReserved && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onCancelStay}
              variant="destructive"
            >
              <XCircle className="h-4 w-4" />
              Cancelar reserva
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
