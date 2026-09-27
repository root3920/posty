import { z } from 'zod';
import { phoneSchema } from './phone';

// -------------------------------------------------------
// Guest schema
// -------------------------------------------------------

export const guestSchema = z.object({
  firstName: z.string().min(1, 'El nombre es obligatorio').max(100),
  lastName: z.string().min(1, 'El apellido es obligatorio').max(100),
  documentTypeId: z.string().min(1).nullable().optional(),
  documentNumber: z.string().max(50).nullable().optional(),
  nationality: z.string().max(100).nullable().optional(),
  birthDate: z.string().nullable().optional(),
  phone: phoneSchema,
  email: z.string().email('Email inválido').or(z.literal('')).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  cityOfOrigin: z.string().max(100).nullable().optional(),
  countryOfOrigin: z.string().max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type GuestInput = z.infer<typeof guestSchema>;

// -------------------------------------------------------
// Check-in schema
// -------------------------------------------------------

export const checkInSchema = z.object({
  roomTypeId: z.string().min(1, 'Selecciona un tipo de habitación'),
  roomId: z.string().nullable().optional(), // optional: manual override
  guestData: guestSchema,
  checkInDate: z.string().min(1, 'La fecha de entrada es obligatoria'),
  checkOutDate: z.string().min(1, 'La fecha de salida es obligatoria'),
  adults: z.number().int().min(1, 'Mínimo 1 adulto').max(20),
  children: z.number().int().min(0).max(20).default(0),
  channelId: z.string().min(1).nullable().optional(),
  travelReasonId: z.string().min(1).nullable().optional(),
  ratePerNight: z.number().positive('La tarifa debe ser positiva'),
  notes: z.string().nullable().optional(),
});

export type CheckInInput = z.infer<typeof checkInSchema>;

// -------------------------------------------------------
// Reservation schema (same shape, future dates)
// -------------------------------------------------------

export const reservationSchema = checkInSchema;
export type ReservationInput = z.infer<typeof reservationSchema>;

// -------------------------------------------------------
// Folio charge schema
// -------------------------------------------------------

export const folioChargeSchema = z.object({
  revenueCenterId: z.string().min(1, 'Selecciona un centro de ingresos'),
  description: z.string().min(1, 'La descripción es obligatoria').max(255),
  quantity: z.number().int().min(1, 'Mínimo 1').max(9999),
  unitPrice: z.number().positive('El precio debe ser positivo'),
  taxRate: z.number().min(0).max(100).default(0),
});

export type FolioChargeInput = z.infer<typeof folioChargeSchema>;

// -------------------------------------------------------
// Payment schema
// -------------------------------------------------------

export const paymentSchema = z.object({
  amount: z.number().positive('El monto debe ser positivo'),
  methodId: z.string().min(1, 'Selecciona un método de pago'),
  reference: z.string().max(100).nullable().optional(),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

// -------------------------------------------------------
// Extend stay schema
// -------------------------------------------------------

export const extendStaySchema = z.object({
  newCheckOutDate: z.string().min(1, 'La nueva fecha de salida es obligatoria'),
});

export type ExtendStayInput = z.infer<typeof extendStaySchema>;

// -------------------------------------------------------
// Change room schema
// -------------------------------------------------------

export const changeRoomSchema = z.object({
  newRoomId: z.string().min(1, 'Selecciona una habitación'),
  newRatePerNight: z.number().positive('La tarifa debe ser positiva').optional(),
});

export type ChangeRoomInput = z.infer<typeof changeRoomSchema>;
