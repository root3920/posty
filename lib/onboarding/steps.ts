import type { OnboardingStepDef } from './types';

/**
 * Single source of truth for all onboarding steps.
 *
 * Each step's completion is derived from real hotel data (OnboardingCounts),
 * not from manual flags. Only "skipped" and "wizard_seen" are stored in DB.
 *
 * To add a new step: add an entry here + ensure `get_onboarding_counts()` RPC
 * returns the data needed for `checkCompleted`.
 */
export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  // -------------------------------------------------------
  // Esencial
  // -------------------------------------------------------
  {
    id: 'company_data',
    stage: 'essential',
    title: 'Datos de la empresa',
    why: 'Para facturar y configurar impuestos correctamente',
    href: '/configuracion/empresa',
    requiredModule: 'settings',
    skippable: false,
    checkCompleted: (c) => c.has_tax_id,
  },
  {
    id: 'room_types',
    stage: 'essential',
    title: 'Tipos de habitación',
    why: 'Define categorías con tarifas para empezar a reservar',
    href: '/configuracion/catalogos',
    requiredModule: 'settings',
    skippable: false,
    checkCompleted: (c) => c.room_types > 0,
  },
  {
    id: 'rooms',
    stage: 'essential',
    title: 'Habitaciones',
    why: 'Crea las habitaciones reales de tu hotel',
    href: '/hotel/habitaciones',
    requiredModule: 'rooms',
    skippable: false,
    checkCompleted: (c) => c.rooms > 0,
  },
  {
    id: 'payment_methods',
    stage: 'essential',
    title: 'Métodos de pago',
    why: 'Para registrar los pagos de tus huéspedes',
    href: '/configuracion/catalogos',
    requiredModule: 'settings',
    skippable: false,
    checkCompleted: (c) => c.payment_methods > 0,
  },
  {
    id: 'first_stay',
    stage: 'essential',
    title: 'Primera reserva',
    why: '¡Tu primera operación en POSTY!',
    href: '/hotel/reservas',
    requiredModule: 'rooms',
    skippable: false,
    checkCompleted: (c) => c.stays > 0,
  },

  // -------------------------------------------------------
  // Equipo
  // -------------------------------------------------------
  {
    id: 'invite_users',
    stage: 'team',
    title: 'Invitar usuarios',
    why: 'Tu equipo podrá gestionar tareas y operaciones',
    href: '/configuracion/usuarios',
    requiredModule: 'settings',
    skippable: true,
    checkCompleted: (c) => c.team_members > 1,
  },
  {
    id: 'schedules',
    stage: 'team',
    title: 'Horarios y turnos',
    why: 'Organiza los turnos de trabajo de tu equipo',
    href: '/configuracion/horarios',
    requiredModule: 'settings',
    skippable: true,
    checkCompleted: (c) => c.work_schedules > 0,
  },

  // -------------------------------------------------------
  // Operación
  // -------------------------------------------------------
  {
    id: 'housekeeping',
    stage: 'operations',
    title: 'Configurar limpieza',
    why: 'Automatiza la asignación de limpiezas por habitación',
    href: '/limpieza',
    requiredModule: 'housekeeping',
    skippable: true,
    checkCompleted: (c) => c.cleaning_types > 0,
  },
  {
    id: 'recurring_tasks',
    stage: 'operations',
    title: 'Tareas automáticas',
    why: 'Programa tareas que se repiten cada día, semana o mes',
    href: '/configuracion/tareas-automaticas',
    requiredModule: 'settings',
    skippable: true,
    checkCompleted: (c) => c.recurring_tasks > 0,
  },
  {
    id: 'regulatory',
    stage: 'operations',
    title: 'Datos regulatorios',
    why: 'RNT, SIRE y TRA para cumplir con MinCIT',
    href: '/configuracion/regulatorio',
    requiredModule: 'settings',
    skippable: true,
    checkCompleted: (c) => c.has_rnt,
  },

  // -------------------------------------------------------
  // Opcional
  // -------------------------------------------------------
  {
    id: 'whatsapp',
    stage: 'optional',
    title: 'Conectar WhatsApp',
    why: 'Chatea con tus huéspedes directamente desde POSTY',
    href: '/configuracion/whatsapp',
    requiredModule: 'chat',
    skippable: true,
    checkCompleted: (c) => c.whatsapp_connected > 0,
  },
  {
    id: 'instagram',
    stage: 'optional',
    title: 'Conectar Instagram',
    why: 'Publica y programa posts desde POSTY',
    href: '/configuracion/instagram',
    requiredModule: 'instagram',
    skippable: true,
    checkCompleted: (c) => c.instagram_connected > 0,
  },
  {
    id: 'event_spaces',
    stage: 'optional',
    title: 'Espacios para eventos',
    why: 'Alquila salones y espacios de tu hotel',
    href: '/eventos',
    requiredModule: 'events',
    skippable: true,
    checkCompleted: (c) => c.event_venues > 0,
  },
  {
    id: 'brand',
    stage: 'optional',
    title: 'Logo y marca',
    why: 'Personaliza POSTY con el logo de tu hotel',
    href: '/configuracion/marca',
    requiredModule: 'settings',
    skippable: true,
    checkCompleted: (c) => c.has_logo,
  },
];

/** Steps in the "essential" stage — used to determine if the panel auto-hides */
export const ESSENTIAL_STEP_IDS = ONBOARDING_STEPS
  .filter((s) => s.stage === 'essential')
  .map((s) => s.id);
