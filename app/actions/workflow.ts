'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseErrorMessage, logSupabaseError } from '@/lib/supabase/errors';

// -------------------------------------------------------
// confirmArrivalAction
// Calls confirm_guest_arrival RPC, then queries task count
// -------------------------------------------------------

export async function confirmArrivalAction(
  stayId: string,
  documentVerified: boolean,
  paymentConfirmed: boolean,
): Promise<
  | { success: true; roomNumber: string; tasksGenerated: number }
  | { error: string }
> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return { error: 'No autenticado' };

    // Call RPC
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('confirm_guest_arrival', {
      p_stay_id: stayId,
      p_document_verified: documentVerified,
      p_payment_confirmed: paymentConfirmed,
    });

    if (error) {
      logSupabaseError(error, 'confirmArrivalAction');
      return { error: getSupabaseErrorMessage(error, 'Llegada') };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = data as any;
    const roomNumber: string = result?.room_number ?? '';

    // Count tasks generated for this stay
    const { count } = await supabase
      .from('tasks')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select('id', { count: 'exact', head: true } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .eq(('stay_id' as any), stayId);

    revalidatePath('/hotel');
    revalidatePath('/hotel/reservas');
    revalidatePath('/tareas');

    return {
      success: true,
      roomNumber,
      tasksGenerated: count ?? 0,
    };
  } catch (err) {
    console.error('confirmArrivalAction error:', err);
    return { error: 'Error inesperado al confirmar la llegada' };
  }
}
