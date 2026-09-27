'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseErrorMessage, logSupabaseError } from '@/lib/supabase/errors';
import {
  checkInSchema,
  reservationSchema,
  folioChargeSchema,
  paymentSchema,
  extendStaySchema,
  changeRoomSchema,
  type CheckInInput,
  type ReservationInput,
  type FolioChargeInput,
  type PaymentInput,
  type ExtendStayInput,
  type ChangeRoomInput,
} from '@/lib/validations/hotel';

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error('No autenticado');
  return { supabase, user };
}

async function getUserProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single();
  if (error || !profile) throw new Error('Perfil no encontrado');
  return profile;
}

// -------------------------------------------------------
// findOrCreateGuest
// -------------------------------------------------------

async function findOrCreateGuest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  guestData: CheckInInput['guestData'],
): Promise<string> {
  // Try to find existing guest by document
  if (guestData.documentTypeId && guestData.documentNumber) {
    const { data: existing } = await supabase
      .from('guests')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('document_type_id', guestData.documentTypeId)
      .eq('document_number', guestData.documentNumber)
      .maybeSingle();

    if (existing) {
      // Update guest info
      await supabase
        .from('guests')
        .update({
          first_name: guestData.firstName,
          last_name: guestData.lastName,
          nationality: guestData.nationality ?? null,
          birth_date: guestData.birthDate ?? null,
          phone: guestData.phone ?? null,
          email: guestData.email ?? null,
          address: guestData.address ?? null,
          city_of_origin: guestData.cityOfOrigin ?? null,
          country_of_origin: guestData.countryOfOrigin ?? null,
          notes: guestData.notes ?? null,
        })
        .eq('id', existing.id);

      return existing.id;
    }
  }

  // Create new guest
  const { data: newGuest, error } = await supabase
    .from('guests')
    .insert({
      organization_id: organizationId,
      first_name: guestData.firstName,
      last_name: guestData.lastName,
      document_type_id: guestData.documentTypeId ?? null,
      document_number: guestData.documentNumber ?? null,
      nationality: guestData.nationality ?? null,
      birth_date: guestData.birthDate ?? null,
      phone: guestData.phone ?? null,
      email: guestData.email ?? null,
      address: guestData.address ?? null,
      city_of_origin: guestData.cityOfOrigin ?? null,
      country_of_origin: guestData.countryOfOrigin ?? null,
      notes: guestData.notes ?? null,
    })
    .select('id')
    .single();

  if (error || !newGuest) throw new Error('Error al crear el huésped');
  return newGuest.id;
}

// -------------------------------------------------------
// checkInAction
// -------------------------------------------------------

export async function checkInAction(formData: CheckInInput) {
  const parsed = checkInSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  try {
    const { supabase, user } = await getAuthenticatedUser();
    const profile = await getUserProfile(supabase, user.id);
    const { organizationId } = { organizationId: profile.organization_id };

    const {
      roomId,
      guestData,
      checkInDate,
      checkOutDate,
      adults,
      children,
      channelId,
      travelReasonId,
      ratePerNight,
      notes,
    } = parsed.data;

    // Find or create guest
    const guestId = await findOrCreateGuest(supabase, organizationId, guestData);

    // Create stay with checked_in status
    const { data: stay, error: stayError } = await supabase
      .from('stays')
      .insert({
        organization_id: organizationId,
        room_id: roomId,
        primary_guest_id: guestId,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        actual_check_in_at: new Date().toISOString(),
        adults,
        children,
        status: 'checked_in',
        channel_id: channelId ?? null,
        travel_reason_id: travelReasonId ?? null,
        rate_per_night: ratePerNight,
        notes: notes ?? null,
        created_by: user.id,
      })
      .select('id, nights')
      .single();

    if (stayError || !stay) {
      logSupabaseError(stayError, 'checkInAction');
      return { error: getSupabaseErrorMessage(stayError, 'Check-in') };
    }

    // Update room to "Ocupada" status
    // Find the room status that corresponds to "occupied" (counts_as_available = false)
    const { data: occupiedStatus } = await supabase
      .from('room_statuses')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('counts_as_available', false)
      .eq('counts_as_out_of_order', false)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (occupiedStatus) {
      await supabase
        .from('rooms')
        .update({ status_id: occupiedStatus.id })
        .eq('id', roomId);
    }

    // Auto-charge nights to folio
    // Find the "Alojamiento" revenue center
    const { data: revenueCenter } = await supabase
      .from('revenue_centers')
      .select('id')
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    const nights = stay.nights ?? 0;
    if (revenueCenter && nights > 0) {
      await supabase.from('folio_charges').insert({
        stay_id: stay.id,
        revenue_center_id: revenueCenter.id,
        description: `Alojamiento — ${nights} noche(s)`,
        quantity: nights,
        unit_price: ratePerNight,
        tax_rate: 0,
        posted_by: user.id,
      });
    }

    revalidatePath('/hotel');
    return { success: true, stayId: stay.id };
  } catch (err) {
    console.error('checkInAction error:', err);
    return { error: 'Error inesperado al registrar el check-in' };
  }
}

// -------------------------------------------------------
// createReservationAction
// -------------------------------------------------------

export async function createReservationAction(formData: ReservationInput) {
  const parsed = reservationSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  try {
    const { supabase, user } = await getAuthenticatedUser();
    const profile = await getUserProfile(supabase, user.id);
    const organizationId = profile.organization_id;

    const {
      roomId,
      guestData,
      checkInDate,
      checkOutDate,
      adults,
      children,
      channelId,
      travelReasonId,
      ratePerNight,
      notes,
    } = parsed.data;

    const guestId = await findOrCreateGuest(supabase, organizationId, guestData);

    const { data: stay, error: stayError } = await supabase
      .from('stays')
      .insert({
        organization_id: organizationId,
        room_id: roomId,
        primary_guest_id: guestId,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        adults,
        children,
        status: 'reserved',
        channel_id: channelId ?? null,
        travel_reason_id: travelReasonId ?? null,
        rate_per_night: ratePerNight,
        notes: notes ?? null,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (stayError || !stay) {
      logSupabaseError(stayError, 'createReservationAction');
      return { error: getSupabaseErrorMessage(stayError, 'Reserva') };
    }

    revalidatePath('/hotel');
    revalidatePath('/hotel/reservas');
    return { success: true, stayId: stay.id };
  } catch (err) {
    console.error('createReservationAction error:', err);
    return { error: 'Error inesperado al crear la reserva' };
  }
}

// -------------------------------------------------------
// checkOutAction
// -------------------------------------------------------

export async function checkOutAction(stayId: string) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const profile = await getUserProfile(supabase, user.id);
    const organizationId = profile.organization_id;

    // Verify balance
    const { data: balance } = await supabase
      .from('stay_balances')
      .select('balance')
      .eq('stay_id', stayId)
      .maybeSingle();

    const balanceAmount = balance?.balance ?? 0;
    if (balanceAmount > 0) {
      return {
        error: `Hay saldo pendiente de ${balanceAmount.toLocaleString('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        })}. Registre el pago antes de hacer check-out.`,
        balance: balanceAmount,
      };
    }

    // Get the stay to find the room
    const { data: stay, error: stayFetchError } = await supabase
      .from('stays')
      .select('room_id')
      .eq('id', stayId)
      .single();

    if (stayFetchError || !stay) {
      return { error: 'Estancia no encontrada' };
    }

    // Update stay status
    const { error: stayError } = await supabase
      .from('stays')
      .update({
        status: 'checked_out',
        actual_check_out_at: new Date().toISOString(),
      })
      .eq('id', stayId);

    if (stayError) {
      logSupabaseError(stayError, 'checkOutAction');
      return { error: getSupabaseErrorMessage(stayError, 'Check-out') };
    }

    // Find "Sucia" / dirty room status
    const { data: dirtyStatus } = await supabase
      .from('room_statuses')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('counts_as_available', false)
      .eq('counts_as_out_of_order', false)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dirtyStatus) {
      await supabase
        .from('rooms')
        .update({
          status_id: dirtyStatus.id,
          housekeeping_status: 'dirty',
        })
        .eq('id', stay.room_id);
    }

    // Create housekeeping task
    const { data: taskStatus } = await supabase
      .from('task_statuses')
      .select('id')
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (taskStatus) {
      await supabase.from('tasks').insert({
        organization_id: organizationId,
        title: `Limpieza habitación después de check-out`,
        status_id: taskStatus.id,
        priority: 'high',
        room_id: stay.room_id,
        created_by: user.id,
      });
    }

    revalidatePath('/hotel');
    revalidatePath('/tareas');
    return { success: true };
  } catch (err) {
    console.error('checkOutAction error:', err);
    return { error: 'Error inesperado al registrar el check-out' };
  }
}

// -------------------------------------------------------
// addFolioChargeAction
// -------------------------------------------------------

export async function addFolioChargeAction(stayId: string, formData: FolioChargeInput) {
  const parsed = folioChargeSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  try {
    const { supabase, user } = await getAuthenticatedUser();

    const { revenueCenterId, description, quantity, unitPrice, taxRate } = parsed.data;

    const { error } = await supabase.from('folio_charges').insert({
      stay_id: stayId,
      revenue_center_id: revenueCenterId,
      description,
      quantity,
      unit_price: unitPrice,
      tax_rate: taxRate,
      posted_by: user.id,
    });

    if (error) {
      logSupabaseError(error, 'addFolioChargeAction');
      return { error: getSupabaseErrorMessage(error, 'Cargo') };
    }

    revalidatePath('/hotel');
    return { success: true };
  } catch (err) {
    console.error('addFolioChargeAction error:', err);
    return { error: 'Error inesperado al agregar el cargo' };
  }
}

// -------------------------------------------------------
// registerPaymentAction
// -------------------------------------------------------

export async function registerPaymentAction(stayId: string, formData: PaymentInput) {
  const parsed = paymentSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  try {
    const { supabase, user } = await getAuthenticatedUser();
    const profile = await getUserProfile(supabase, user.id);

    const { amount, methodId, reference } = parsed.data;

    const { error } = await supabase.from('payments').insert({
      stay_id: stayId,
      organization_id: profile.organization_id,
      amount,
      method_id: methodId,
      reference: reference ?? null,
      received_by: user.id,
    });

    if (error) {
      logSupabaseError(error, 'registerPaymentAction');
      return { error: getSupabaseErrorMessage(error, 'Pago') };
    }

    revalidatePath('/hotel');
    return { success: true };
  } catch (err) {
    console.error('registerPaymentAction error:', err);
    return { error: 'Error inesperado al registrar el pago' };
  }
}

// -------------------------------------------------------
// extendStayAction
// -------------------------------------------------------

export async function extendStayAction(stayId: string, formData: ExtendStayInput) {
  const parsed = extendStaySchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  try {
    const { supabase, user } = await getAuthenticatedUser();

    // Get current stay
    const { data: stay, error: fetchError } = await supabase
      .from('stays')
      .select('check_out_date, rate_per_night, nights')
      .eq('id', stayId)
      .single();

    if (fetchError || !stay) {
      return { error: 'Estancia no encontrada' };
    }

    const { newCheckOutDate } = parsed.data;

    const { error } = await supabase
      .from('stays')
      .update({ check_out_date: newCheckOutDate })
      .eq('id', stayId);

    if (error) {
      logSupabaseError(error, 'extendStayAction');
      return { error: getSupabaseErrorMessage(error, 'Estancia') };
    }

    // Calculate additional nights charge
    const oldNights = stay.nights;
    const newNights =
      (new Date(newCheckOutDate).getTime() - new Date(stay.check_out_date).getTime()) /
      (1000 * 60 * 60 * 24);

    if (newNights > 0) {
      const { data: revenueCenter } = await supabase
        .from('revenue_centers')
        .select('id')
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (revenueCenter) {
        await supabase.from('folio_charges').insert({
          stay_id: stayId,
          revenue_center_id: revenueCenter.id,
          description: `Extensión de estancia — ${newNights} noche(s) adicional(es)`,
          quantity: newNights,
          unit_price: stay.rate_per_night,
          tax_rate: 0,
          posted_by: user.id,
        });
      }
    }

    // suppress unused variable warning
    void oldNights;

    revalidatePath('/hotel');
    return { success: true };
  } catch (err) {
    console.error('extendStayAction error:', err);
    return { error: 'Error inesperado al extender la estancia' };
  }
}

// -------------------------------------------------------
// changeRoomAction
// -------------------------------------------------------

export async function changeRoomAction(stayId: string, formData: ChangeRoomInput) {
  const parsed = changeRoomSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  try {
    const { supabase, user } = await getAuthenticatedUser();
    const profile = await getUserProfile(supabase, user.id);
    const organizationId = profile.organization_id;

    const { newRoomId, newRatePerNight } = parsed.data;

    // Get current stay
    const { data: stay, error: fetchError } = await supabase
      .from('stays')
      .select('room_id, rate_per_night')
      .eq('id', stayId)
      .single();

    if (fetchError || !stay) {
      return { error: 'Estancia no encontrada' };
    }

    const oldRoomId = stay.room_id;

    // Update stay with new room and optional new rate
    const updatePayload: { room_id: string; rate_per_night?: number } = {
      room_id: newRoomId,
    };
    if (newRatePerNight !== undefined) {
      updatePayload.rate_per_night = newRatePerNight;
    }

    const { error } = await supabase.from('stays').update(updatePayload).eq('id', stayId);

    if (error) {
      logSupabaseError(error, 'changeRoomAction');
      return { error: getSupabaseErrorMessage(error, 'Habitación') };
    }

    // Set old room to dirty
    const { data: dirtyStatus } = await supabase
      .from('room_statuses')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('counts_as_available', false)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dirtyStatus) {
      await supabase
        .from('rooms')
        .update({ status_id: dirtyStatus.id, housekeeping_status: 'dirty' })
        .eq('id', oldRoomId);
    }

    // Set new room to occupied
    const { data: occupiedStatus } = await supabase
      .from('room_statuses')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('counts_as_available', false)
      .eq('counts_as_out_of_order', false)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (occupiedStatus) {
      await supabase
        .from('rooms')
        .update({ status_id: occupiedStatus.id })
        .eq('id', newRoomId);
    }

    // suppress unused variable warning
    void user;

    revalidatePath('/hotel');
    return { success: true };
  } catch (err) {
    console.error('changeRoomAction error:', err);
    return { error: 'Error inesperado al cambiar la habitación' };
  }
}

// -------------------------------------------------------
// updateRoomStatusAction
// -------------------------------------------------------

export async function updateRoomStatusAction(roomId: string, statusId: string) {
  try {
    const { supabase } = await getAuthenticatedUser();

    const { error } = await supabase
      .from('rooms')
      .update({ status_id: statusId })
      .eq('id', roomId);

    if (error) {
      logSupabaseError(error, 'updateRoomStatusAction');
      return { error: getSupabaseErrorMessage(error, 'Habitación') };
    }

    revalidatePath('/hotel');
    return { success: true };
  } catch (err) {
    console.error('updateRoomStatusAction error:', err);
    return { error: 'Error inesperado al actualizar el estado' };
  }
}
