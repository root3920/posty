import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'No auth' }, { status: 401 });

    const checks: Record<string, boolean | string> = {};

    // Env vars (present + format, never show values)
    const appId = process.env.INSTAGRAM_APP_ID;
    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
    const encKey = process.env.TOKEN_ENCRYPTION_KEY;

    checks.INSTAGRAM_APP_ID = !!appId && appId.length > 5;
    checks.INSTAGRAM_APP_SECRET = !!appSecret && appSecret.length > 10;
    checks.INSTAGRAM_REDIRECT_URI = !!redirectUri && redirectUri.startsWith('https://');
    checks.INSTAGRAM_REDIRECT_URI_value = redirectUri ?? 'NOT SET';
    checks.TOKEN_ENCRYPTION_KEY = !!encKey && encKey.length >= 32;
    checks.TOKEN_ENCRYPTION_KEY_format = encKey ? (/^[0-9a-fA-F]{64}$/.test(encKey) ? 'hex64' : `utf8_${encKey.length}chars`) : 'NOT SET';

    // DB table exists
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (supabase as any)
        .from('instagram_connections')
        .select('*', { count: 'exact', head: true });
      checks.instagram_connections_table = true;
      checks.instagram_connections_count = count ?? 0;
    } catch {
      checks.instagram_connections_table = false;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (supabase as any)
        .from('instagram_media')
        .select('*', { count: 'exact', head: true });
      checks.instagram_media_table = true;
    } catch {
      checks.instagram_media_table = false;
    }

    const allOk = checks.INSTAGRAM_APP_ID === true &&
      checks.INSTAGRAM_APP_SECRET === true &&
      checks.INSTAGRAM_REDIRECT_URI === true &&
      checks.TOKEN_ENCRYPTION_KEY === true &&
      checks.instagram_connections_table === true;

    return Response.json({ ok: allOk, checks });
  } catch (error) {
    return Response.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
