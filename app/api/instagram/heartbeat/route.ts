import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/instagram/heartbeat
 * Returns the publisher heartbeat for the health indicator.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'No auth' }, { status: 401 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminDb = createAdminClient() as any;
    const { data, error } = await adminDb
      .from('instagram_publisher_heartbeat')
      .select('last_run_at, processed, errors')
      .eq('id', 1)
      .single();

    if (error || !data) {
      return Response.json({ active: false, lastRunAt: null });
    }

    const row = data as { last_run_at: string; processed: number; errors: number };
    const lastRunAt = new Date(row.last_run_at);
    const secondsAgo = Math.floor((Date.now() - lastRunAt.getTime()) / 1000);
    const active = secondsAgo < 300; // 5 minutes

    return Response.json({
      active,
      lastRunAt: row.last_run_at,
      secondsAgo,
      processed: row.processed,
      errors: row.errors,
    });
  } catch (error) {
    console.error('[Instagram] Heartbeat error:', error);
    return Response.json({ active: false, lastRunAt: null }, { status: 500 });
  }
}
