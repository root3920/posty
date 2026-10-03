const API_BASE = 'https://graph.instagram.com';
const OAUTH_BASE = 'https://api.instagram.com';

export interface InstagramProfile {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  account_type?: string;
  media_count?: number;
  followers_count?: number;
  follows_count?: number;
}

export interface InstagramMedia {
  id: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  caption?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  children?: { data: Array<{ id: string; media_type: string; media_url: string }> };
}

/**
 * Exchanges an authorization code for a short-lived access token.
 */
export async function exchangeCodeForToken(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string,
): Promise<{ accessToken: string; userId: string }> {
  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });

  console.log('[ig-exchange] redirect_uri=' + redirectUri + ' code_len=' + code.length + ' app_id=' + appId);

  const res = await fetch(`${OAUTH_BASE}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  // Read as text first to preserve user_id precision (can exceed Number.MAX_SAFE_INTEGER)
  const rawText = await res.text();
  console.log('[ig-callback] step=exchange_short status=' + res.status);

  if (!res.ok) {
    console.error('[Instagram] Token exchange failed (status=' + res.status + '):', rawText.slice(0, 300));
    // Parse error for better message
    if (rawText.includes('Invalid platform app')) throw new Error('not_professional');
    if (rawText.includes('code has been used') || rawText.includes('code has already been used')) throw new Error('code_used');
    if (rawText.includes('Invalid verification code')) throw new Error('code_used');
    if (rawText.includes('redirect_uri does not match') || rawText.includes('Mismatched redirect_uri')) throw new Error('config');
    // Log raw error for debugging — never includes tokens (only the code which is single-use)
    throw new Error('exchange_failed:' + rawText.slice(0, 100));
  }

  // Parse manually to extract user_id as string
  const data = JSON.parse(rawText);
  const accessToken = data.access_token;
  // user_id might be in data directly or wrapped in data.data[0]
  const userId = String(data.user_id ?? data.data?.[0]?.user_id ?? '');

  if (!accessToken) throw new Error('exchange_failed');
  return { accessToken, userId };
}

/**
 * Exchanges a short-lived token for a long-lived token (valid ~60 days).
 */
export async function getLongLivedToken(
  shortToken: string,
  appSecret: string,
): Promise<{ token: string; expiresIn: number }> {
  const res = await fetch(
    `${API_BASE}/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`,
  );
  const rawText = await res.text();
  console.log('[ig-callback] step=exchange_long status=' + res.status);
  if (!res.ok) {
    console.error('[Instagram] Long token exchange failed:', rawText.slice(0, 200));
    throw new Error('exchange_long_failed');
  }
  const data = JSON.parse(rawText);
  return { token: data.access_token, expiresIn: data.expires_in ?? 5184000 };
}

/**
 * Refreshes a long-lived token before it expires.
 */
export async function refreshToken(
  longToken: string,
): Promise<{ token: string; expiresIn: number }> {
  const res = await fetch(
    `${API_BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${longToken}`,
  );
  if (!res.ok) throw new Error('No se pudo renovar el token');
  const data = await res.json();
  return { token: data.access_token, expiresIn: data.expires_in ?? 5184000 };
}

/**
 * Fetches the authenticated user's Instagram profile.
 */
export async function getProfile(token: string): Promise<InstagramProfile> {
  const fields =
    'user_id,username,name,profile_picture_url,account_type,media_count,followers_count,follows_count';
  const res = await fetch(`${API_BASE}/me?fields=${fields}&access_token=${token}`);
  if (!res.ok) {
    const err = await res.text();
    console.error('[Instagram] Profile fetch failed:', err);
    throw new Error('No se pudo obtener el perfil de Instagram');
  }
  const data = await res.json();
  return {
    id: data.user_id ?? data.id,
    username: data.username,
    name: data.name,
    profile_picture_url: data.profile_picture_url,
    account_type: data.account_type,
    media_count: data.media_count,
    followers_count: data.followers_count,
    follows_count: data.follows_count,
  };
}

/**
 * Fetches the user's media feed with optional cursor-based pagination.
 */
export async function getMedia(
  token: string,
  userId: string,
  cursor?: string,
  limit: number = 30,
): Promise<{ media: InstagramMedia[]; nextCursor?: string }> {
  const fields =
    'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count,comments_count,children{id,media_type,media_url}';
  let url = `${API_BASE}/${userId}/media?fields=${fields}&limit=${limit}&access_token=${token}`;
  if (cursor) url += `&after=${cursor}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('No se pudo obtener los posts de Instagram');
  const data = await res.json();
  return {
    media: data.data ?? [],
    nextCursor: data.paging?.cursors?.after,
  };
}

/**
 * Fetches the full detail of a single media item.
 */
export async function getMediaDetail(token: string, mediaId: string): Promise<InstagramMedia> {
  const fields =
    'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count,comments_count,children{id,media_type,media_url}';
  const res = await fetch(`${API_BASE}/${mediaId}?fields=${fields}&access_token=${token}`);
  if (!res.ok) throw new Error('No se pudo obtener el detalle del post');
  return res.json();
}

// -------------------------------------------------------
// Content Publishing API
// -------------------------------------------------------

export async function createMediaContainer(
  token: string,
  userId: string,
  params: { imageUrl: string; caption?: string; altText?: string; isCarouselItem?: boolean },
): Promise<string> {
  const body: Record<string, string> = {
    image_url: params.imageUrl,
    access_token: token,
  };
  if (params.caption && !params.isCarouselItem) body.caption = params.caption;
  if (params.altText) body.alt_text = params.altText;
  if (params.isCarouselItem) body.is_carousel_item = 'true';

  const res = await fetch(`${API_BASE}/${userId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log('[Instagram] createMediaContainer status=' + res.status + ' id=' + data.id);
  if (!res.ok || !data.id) throw new Error(data.error?.message ?? 'Error al crear contenedor');
  return data.id;
}

export async function createCarouselContainer(
  token: string,
  userId: string,
  params: { childrenIds: string[]; caption?: string },
): Promise<string> {
  const body: Record<string, unknown> = {
    media_type: 'CAROUSEL',
    children: params.childrenIds.join(','),
    access_token: token,
  };
  if (params.caption) body.caption = params.caption;

  const res = await fetch(`${API_BASE}/${userId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log('[Instagram] createCarouselContainer status=' + res.status + ' id=' + data.id);
  if (!res.ok || !data.id) throw new Error(data.error?.message ?? 'Error al crear carrusel');
  return data.id;
}

export async function checkContainerStatus(
  token: string,
  containerId: string,
): Promise<{ statusCode: string; errorMessage?: string }> {
  const res = await fetch(
    `${API_BASE}/${containerId}?fields=status_code,status&access_token=${token}`,
  );
  const data = await res.json();
  return {
    statusCode: data.status_code ?? data.status ?? 'UNKNOWN',
    errorMessage: data.error?.message,
  };
}

export async function publishContainer(
  token: string,
  userId: string,
  containerId: string,
): Promise<{ mediaId: string }> {
  const res = await fetch(`${API_BASE}/${userId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: token,
    }),
  });
  const data = await res.json();
  console.log('[Instagram] publishContainer status=' + res.status + ' id=' + data.id);
  if (!res.ok || !data.id) throw new Error(data.error?.message ?? 'Error al publicar');
  return { mediaId: data.id };
}

// -------------------------------------------------------
// Insights API
// -------------------------------------------------------

export interface InsightsValue {
  value: number;
  end_time?: string;
}

export interface InsightsBreakdownItem {
  dimension_key: string;
  dimension_value: string;
  value: number;
}

export interface InsightsMetricResult {
  name: string;
  period: string;
  title?: string;
  description?: string;
  total_value?: { value: number; breakdowns?: Array<{ dimension_keys: string[]; results: Array<{ dimension_values: string[]; value: number }> }> };
  values?: InsightsValue[];
}

/**
 * Fetch account-level insights for a date range.
 * The API enforces max 30 days between since/until.
 *
 * @param metricType 'total_value' or 'time_series'
 */
export async function getAccountInsights(
  token: string,
  userId: string,
  metrics: string[],
  since: Date,
  until: Date,
  metricType: 'total_value' | 'time_series' = 'total_value',
): Promise<InsightsMetricResult[]> {
  const sinceUnix = Math.floor(since.getTime() / 1000);
  const untilUnix = Math.floor(until.getTime() / 1000);

  const params = new URLSearchParams({
    metric: metrics.join(','),
    period: 'day',
    metric_type: metricType,
    since: sinceUnix.toString(),
    until: untilUnix.toString(),
    access_token: token,
  });

  const res = await fetch(`${API_BASE}/${userId}/insights?${params}`);
  const data = await res.json();

  if (!res.ok) {
    const errorMsg = data.error?.message ?? `Insights error (${res.status})`;
    const errorCode = data.error?.code?.toString() ?? '';
    console.error('[Instagram] getAccountInsights failed:', errorMsg, 'metrics:', metrics.join(','));
    throw new Error(`ig_insights:${errorCode}:${errorMsg}`);
  }

  return data.data ?? [];
}

/**
 * Fetch insights for a specific media item.
 * Returns metrics as a flat object { metricName: value }.
 */
export async function getMediaInsights(
  token: string,
  mediaId: string,
  metrics: string[],
): Promise<Record<string, number>> {
  const params = new URLSearchParams({
    metric: metrics.join(','),
    access_token: token,
  });

  const res = await fetch(`${API_BASE}/${mediaId}/insights?${params}`);
  const data = await res.json();

  if (!res.ok) {
    // Some metrics may not be available for certain media types — log but don't throw
    const errorMsg = data.error?.message ?? `Media insights error (${res.status})`;
    console.warn('[Instagram] getMediaInsights failed for', mediaId, ':', errorMsg);
    return {};
  }

  const result: Record<string, number> = {};
  for (const metric of (data.data ?? []) as Array<{ name: string; values?: Array<{ value: number }>; total_value?: { value: number } }>) {
    result[metric.name] = metric.total_value?.value ?? metric.values?.[0]?.value ?? 0;
  }
  return result;
}

/**
 * Fetch follower demographics (age, gender, country, city).
 * Only works with 100+ followers.
 * Only accepts fixed timeframes: this_week, this_month, prev_month, last_14_days, last_30_days, last_90_days.
 */
export async function getFollowerDemographics(
  token: string,
  userId: string,
  timeframe: string = 'last_30_days',
): Promise<InsightsMetricResult[]> {
  const params = new URLSearchParams({
    metric: 'follower_demographics',
    period: 'lifetime',
    timeframe,
    metric_type: 'total_value',
    breakdown: 'age,gender,country,city',
    access_token: token,
  });

  const res = await fetch(`${API_BASE}/${userId}/insights?${params}`);
  const data = await res.json();

  if (!res.ok) {
    const errorMsg = data.error?.message ?? `Demographics error (${res.status})`;
    console.warn('[Instagram] getFollowerDemographics failed:', errorMsg);
    return [];
  }

  return data.data ?? [];
}

export async function getPublishingLimit(
  token: string,
  userId: string,
): Promise<{ quota: number; used: number }> {
  const res = await fetch(
    `${API_BASE}/${userId}/content_publishing_limit?fields=config,quota_usage&access_token=${token}`,
  );
  const data = await res.json();
  const config = data.data?.[0]?.config ?? {};
  const usage = data.data?.[0]?.quota_usage ?? 0;
  return { quota: config.quota_total ?? 50, used: usage };
}
