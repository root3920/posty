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
): Promise<string> {
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
  if (!res.ok) {
    const err = await res.text();
    console.error('[Instagram] Token exchange failed:', err);
    throw new Error('No se pudo obtener el token de Instagram');
  }
  const data = await res.json();
  return data.access_token;
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
  if (!res.ok) throw new Error('No se pudo obtener el token de larga duración');
  const data = await res.json();
  return { token: data.access_token, expiresIn: data.expires_in ?? 5184000 }; // 60 days default
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
