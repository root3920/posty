import { createClient } from '@/lib/supabase/server';
import { getWhatsAppEnv } from '@/lib/whatsapp/env';

/**
 * Debug endpoint: directly test Evolution API endpoints.
 * Returns raw responses from Evolution for diagnosis.
 * Only accessible by authenticated users.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'No auth' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();
    if (!profile) return Response.json({ error: 'No profile' }, { status: 400 });

    const { env } = getWhatsAppEnv();
    if (!env) return Response.json({ error: 'WhatsApp not configured' }, { status: 503 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conn } = await (supabase as any)
      .from('whatsapp_connections')
      .select('instance_name, status')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!conn) return Response.json({ error: 'No connection row in DB' });

    const baseUrl = env.EVOLUTION_API_URL.replace(/\/+$/, '');
    if (!baseUrl.startsWith('http')) {
      return Response.json({ error: 'EVOLUTION_API_URL missing https://' });
    }

    const headers = { apikey: env.EVOLUTION_API_KEY, 'Content-Type': 'application/json' };
    const results: Record<string, unknown> = { instance: conn.instance_name, dbStatus: conn.status };

    // 1. connectionState
    try {
      const r = await fetch(`${baseUrl}/instance/connectionState/${conn.instance_name}`, { headers });
      results.connectionState = { status: r.status, body: await r.json() };
    } catch (e) { results.connectionState = { error: String(e) }; }

    // 2. fetchInstances
    try {
      const r = await fetch(`${baseUrl}/instance/fetchInstances?instanceName=${conn.instance_name}`, { headers });
      const body = await r.json();
      // Truncate large fields
      results.fetchInstances = { status: r.status, type: typeof body, isArray: Array.isArray(body), length: Array.isArray(body) ? body.length : undefined, keys: body && typeof body === 'object' ? Object.keys(Array.isArray(body) && body[0] ? body[0] : body) : [] };
    } catch (e) { results.fetchInstances = { error: String(e) }; }

    // 3. webhook/find
    try {
      const r = await fetch(`${baseUrl}/webhook/find/${conn.instance_name}`, { headers });
      results.webhook = { status: r.status, body: await r.json() };
    } catch (e) { results.webhook = { error: String(e) }; }

    // 4. findChats — POST
    try {
      const r = await fetch(`${baseUrl}/chat/findChats/${conn.instance_name}`, {
        method: 'POST', headers, body: '{}',
      });
      const raw = await r.text();
      const parsed = raw ? JSON.parse(raw) : null;
      const arr = Array.isArray(parsed) ? parsed : [];
      results.findChatsPost = {
        status: r.status,
        count: arr.length,
        first: arr[0] ? { keys: Object.keys(arr[0]), id: arr[0].id, remoteJid: arr[0].remoteJid } : null,
        sample: arr.slice(0, 3).map((c: Record<string, string>) => ({ id: c.id, remoteJid: c.remoteJid, name: c.name, jid: c.jid })),
      };
    } catch (e) { results.findChatsPost = { error: String(e) }; }

    // 5. findChats — GET (fallback)
    try {
      const r = await fetch(`${baseUrl}/chat/findChats/${conn.instance_name}`, { headers });
      results.findChatsGet = { status: r.status, length: (await r.text()).length };
    } catch (e) { results.findChatsGet = { error: String(e) }; }

    // 6. DB counts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: convCount } = await (supabase as any).from('chat_conversations').select('*', { count: 'exact', head: true }).eq('organization_id', profile.organization_id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: msgCount } = await (supabase as any).from('chat_messages').select('*', { count: 'exact', head: true }).eq('organization_id', profile.organization_id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: logCount } = await (supabase as any).from('whatsapp_webhook_logs').select('*', { count: 'exact', head: true });

    results.db = { conversations: convCount, messages: msgCount, webhookLogs: logCount };

    return Response.json(results, { status: 200 });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
