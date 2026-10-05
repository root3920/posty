/**
 * Guided tour definitions per module.
 *
 * Each tour is a list of steps with CSS selectors pointing to
 * elements that should be highlighted. driver.js handles
 * positioning, scroll-into-view, overlay, and mobile.
 *
 * To add data-tour attributes to elements, use data-tour="<id>".
 */

export interface TourStep {
  /** CSS selector for the target element */
  element: string;
  /** Popover title */
  title: string;
  /** Popover description */
  description: string;
  /** Popover position */
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export interface TourDef {
  /** Module key — matches the route prefix */
  module: string;
  /** Tour display name */
  name: string;
  /** Steps to highlight */
  steps: TourStep[];
}

export const TOURS: TourDef[] = [
  {
    module: 'hotel',
    name: 'Hotel',
    steps: [
      {
        element: '[data-tour="hotel-rooms"]',
        title: 'Mapa de habitaciones',
        description: 'Aquí ves el estado de cada habitación: disponible, ocupada o en limpieza. Haz clic en una para ver sus detalles.',
        side: 'bottom',
      },
      {
        element: '[data-tour="hotel-checkin"]',
        title: 'Nuevo check-in',
        description: 'Registra la llegada de un huésped. POSTY asigna la habitación automáticamente según el tipo seleccionado.',
        side: 'bottom',
      },
      {
        element: '[data-tour="hotel-reservas"]',
        title: 'Reservas',
        description: 'Consulta y gestiona todas las reservaciones activas, pasadas y futuras.',
        side: 'bottom',
      },
    ],
  },
  {
    module: 'tareas',
    name: 'Tareas',
    steps: [
      {
        element: '[data-tour="tareas-kanban"]',
        title: 'Tablero Kanban',
        description: 'Arrastra las tareas entre columnas para cambiar su estado. Las columnas se configuran en Catálogos.',
        side: 'bottom',
      },
      {
        element: '[data-tour="tareas-crear"]',
        title: 'Crear tarea',
        description: 'Asigna tareas a tu equipo con fecha, prioridad y etiquetas. También puedes programar tareas recurrentes.',
        side: 'left',
      },
    ],
  },
  {
    module: 'limpieza',
    name: 'Limpieza',
    steps: [
      {
        element: '[data-tour="limpieza-grid"]',
        title: 'Estado de limpieza',
        description: 'Ve qué habitaciones necesitan limpieza. Al hacer check-out, la habitación pasa a "sucia" automáticamente.',
        side: 'bottom',
      },
      {
        element: '[data-tour="limpieza-asignar"]',
        title: 'Asignar limpieza',
        description: 'Asigna la limpieza a un miembro del equipo. Se crea una tarea automáticamente.',
        side: 'bottom',
      },
    ],
  },
  {
    module: 'finanzas',
    name: 'Finanzas',
    steps: [
      {
        element: '[data-tour="finanzas-kpis"]',
        title: 'Indicadores clave',
        description: 'Ingresos, gastos, ocupación, ADR y RevPAR del periodo seleccionado, con comparación automática.',
        side: 'bottom',
      },
      {
        element: '[data-tour="finanzas-periodo"]',
        title: 'Periodo',
        description: 'Cambia entre Hoy, Esta semana, Este mes o un rango personalizado. Todo se recalcula al instante.',
        side: 'bottom',
      },
    ],
  },
];

/** Find a tour by module key */
export function findTour(module: string): TourDef | undefined {
  return TOURS.find((t) => t.module === module);
}
