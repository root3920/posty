/**
 * Instagram Insights metric definitions.
 *
 * Single source of truth for which metrics we request from the Instagram API.
 * If Meta retires/renames a metric, update THIS file only.
 *
 * Reference: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/insights
 *
 * RETIRED metrics (DO NOT USE): impressions, plays, clips_replays_count,
 * ig_reels_aggregated_all_plays_count, video_views.
 */

// -------------------------------------------------------
// Account-level metrics (GET /{ig-user-id}/insights)
// -------------------------------------------------------

export interface AccountMetricDef {
  /** API metric name */
  name: string;
  /** Human label (Spanish) */
  label: string;
  /** Tooltip description */
  help: string;
  /** Whether this metric supports time_series (day-by-day) */
  timeSeries: boolean;
  /** Whether this metric supports total_value */
  totalValue: boolean;
  /** Breakdown keys this metric supports (empty = no breakdown) */
  breakdowns: string[];
}

/**
 * All account-level metrics we request.
 * Order matters — it determines the display order in the KPI grid.
 */
export const ACCOUNT_METRICS: AccountMetricDef[] = [
  {
    name: 'views',
    label: 'Visualizaciones',
    help: 'Número total de veces que tu contenido fue visto (puede incluir repeticiones)',
    timeSeries: false,
    totalValue: true,
    breakdowns: ['media_product_type', 'follow_type'],
  },
  {
    name: 'reach',
    label: 'Alcance',
    help: 'Cuentas únicas que vieron tu contenido',
    timeSeries: true,
    totalValue: true,
    breakdowns: ['media_product_type', 'follow_type'],
  },
  {
    name: 'accounts_engaged',
    label: 'Cuentas que interactuaron',
    help: 'Cuentas únicas que interactuaron con tu contenido (me gusta, comentarios, guardados, compartidos)',
    timeSeries: false,
    totalValue: true,
    breakdowns: [],
  },
  {
    name: 'total_interactions',
    label: 'Interacciones totales',
    help: 'Suma de me gusta, comentarios, guardados, compartidos y respuestas',
    timeSeries: false,
    totalValue: true,
    breakdowns: ['media_product_type'],
  },
  {
    name: 'likes',
    label: 'Me gusta',
    help: 'Número de me gusta en tu contenido',
    timeSeries: false,
    totalValue: true,
    breakdowns: ['media_product_type'],
  },
  {
    name: 'comments',
    label: 'Comentarios',
    help: 'Número de comentarios en tu contenido',
    timeSeries: false,
    totalValue: true,
    breakdowns: ['media_product_type'],
  },
  {
    name: 'saves',
    label: 'Guardados',
    help: 'Número de veces que guardaron tu contenido',
    timeSeries: false,
    totalValue: true,
    breakdowns: ['media_product_type'],
  },
  {
    name: 'shares',
    label: 'Compartidos',
    help: 'Número de veces que compartieron tu contenido',
    timeSeries: false,
    totalValue: true,
    breakdowns: ['media_product_type'],
  },
  {
    name: 'reposts',
    label: 'Reposts',
    help: 'Número de veces que repostearon tu contenido',
    timeSeries: false,
    totalValue: true,
    breakdowns: [],
  },
  {
    name: 'replies',
    label: 'Respuestas a historias',
    help: 'Respuestas directas a tus historias',
    timeSeries: false,
    totalValue: true,
    breakdowns: [],
  },
  {
    name: 'profile_links_taps',
    label: 'Toques en botones del perfil',
    help: 'Toques en los botones de acción del perfil (llamar, correo, cómo llegar)',
    timeSeries: false,
    totalValue: true,
    breakdowns: ['contact_button_type'],
  },
  {
    name: 'follows_and_unfollows',
    label: 'Nuevos / dejaron de seguir',
    help: 'Nuevos seguidores y personas que dejaron de seguirte',
    timeSeries: false,
    totalValue: true,
    breakdowns: ['follow_type'],
  },
];

// Metrics that support time_series period
export const TIME_SERIES_METRICS = ACCOUNT_METRICS.filter((m) => m.timeSeries).map((m) => m.name);

// All metric names for the API request
export const ALL_ACCOUNT_METRIC_NAMES = ACCOUNT_METRICS.map((m) => m.name);

// -------------------------------------------------------
// Media-level metrics (GET /{ig-media-id}/insights)
// -------------------------------------------------------

export interface MediaMetricDef {
  name: string;
  label: string;
  /** Which media_product_types support this metric */
  mediaTypes: ('FEED' | 'REELS' | 'STORY')[];
}

export const MEDIA_METRICS: MediaMetricDef[] = [
  { name: 'views', label: 'Visualizaciones', mediaTypes: ['FEED', 'REELS', 'STORY'] },
  { name: 'reach', label: 'Alcance', mediaTypes: ['FEED', 'REELS', 'STORY'] },
  { name: 'likes', label: 'Me gusta', mediaTypes: ['FEED', 'REELS'] },
  { name: 'comments', label: 'Comentarios', mediaTypes: ['FEED', 'REELS'] },
  { name: 'saves', label: 'Guardados', mediaTypes: ['FEED', 'REELS'] },
  { name: 'shares', label: 'Compartidos', mediaTypes: ['FEED', 'REELS', 'STORY'] },
  { name: 'total_interactions', label: 'Interacciones', mediaTypes: ['FEED', 'REELS'] },
  { name: 'profile_visits', label: 'Visitas al perfil', mediaTypes: ['FEED', 'REELS'] },
  { name: 'follows', label: 'Seguidores ganados', mediaTypes: ['FEED', 'REELS'] },
  { name: 'profile_activity', label: 'Acciones en el perfil', mediaTypes: ['FEED', 'REELS'] },
  { name: 'ig_reels_avg_watch_time', label: 'Tiempo promedio de reproducción', mediaTypes: ['REELS'] },
  { name: 'ig_reels_video_view_total_time', label: 'Tiempo total de reproducción', mediaTypes: ['REELS'] },
];

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

/** Split a date range into 30-day windows (API max is 30 days per request). */
export function splitInto30DayWindows(
  since: Date,
  until: Date,
): Array<{ since: Date; until: Date }> {
  const windows: Array<{ since: Date; until: Date }> = [];
  let windowStart = new Date(since);

  while (windowStart < until) {
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + 30);
    if (windowEnd > until) {
      windows.push({ since: new Date(windowStart), until: new Date(until) });
    } else {
      windows.push({ since: new Date(windowStart), until: new Date(windowEnd) });
    }
    windowStart = new Date(windowEnd);
  }

  return windows;
}

/** Calculate percentage variation between two values. Returns null if previous is 0 or null. */
export function calcVariation(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Calculate engagement rate: interactions / reach. Returns null if reach is 0 or null. */
export function calcEngagementRate(interactions: number | null, reach: number | null): number | null {
  if (interactions == null || reach == null || reach === 0) return null;
  return (interactions / reach) * 100;
}
