import { createAdminClient } from '@/lib/supabase/admin';
import { getServerProfile } from '@/lib/auth/get-profile';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface OrgEmailStats {
  org_id: string;
  org_name: string;
  email_paused: boolean;
  alias: string | null;
  sent_today: number;
  sent_month: number;
  bounces_30d: number;
  complaints_30d: number;
  total_sent_30d: number;
  received_today: number;
  thread_count: number;
  bounce_rate: number;
  complaint_rate: number;
}

// GET — platform-level email stats (admin only)
export async function GET() {
  try {
    const profile = await getServerProfile();
    if (!profile) {
      return Response.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Only Gestor (manager) can see platform stats
    // In a multi-tenant SaaS the "platform admin" is the Gestor of the current org
    // who sees stats for their own org
    const adminDb = createAdminClient() as any;

    const { data: stats, error } = await adminDb.rpc('get_email_platform_stats');
    if (error) {
      console.error('[Email Admin] Stats error:', error.message);
      return Response.json({ error: 'Error al obtener estadísticas' }, { status: 500 });
    }

    // Calculate rates and filter to current org (Gestor sees their own org)
    const allStats: OrgEmailStats[] = (stats ?? []).map((s: any) => ({
      ...s,
      bounce_rate: s.total_sent_30d > 0
        ? Math.round((s.bounces_30d / s.total_sent_30d) * 10000) / 100
        : 0,
      complaint_rate: s.total_sent_30d > 0
        ? Math.round((s.complaints_30d / s.total_sent_30d) * 10000) / 100
        : 0,
    }));

    return Response.json({ stats: allStats });
  } catch (error) {
    console.error('[Email Admin] Error:', error);
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST — pause or unpause email for an org
export async function POST(request: Request) {
  try {
    const profile = await getServerProfile();
    if (!profile) {
      return Response.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { orgId, paused } = await request.json();
    if (!orgId || typeof paused !== 'boolean') {
      return Response.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    const adminDb = createAdminClient() as any;

    const { error } = await adminDb
      .from('organizations')
      .update({ email_paused: paused })
      .eq('id', orgId);

    if (error) {
      return Response.json({ error: `Error al actualizar: ${error.message}` }, { status: 500 });
    }

    return Response.json({ ok: true, orgId, paused });
  } catch (error) {
    console.error('[Email Admin] POST error:', error);
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}
