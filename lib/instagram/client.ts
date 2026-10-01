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
  const res = await fetch(`${OAUTH_BASE}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }),
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
