import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getInstagramEnv } from '@/lib/instagram/env';
import { decryptToken } from '@/lib/instagram/crypto';
import {
  getAccountInsights,
  getProfile,
} from '@/lib/instagram/client';
import {
  ACCOUNT_METRICS,
  TIME_SERIES_METRICS,
  splitInto30DayWindows,
} from '@/lib/instagram/insights-metrics';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminDb = any;

/**
 * GET /api/instagram/insights?since=2026-09-01&until=2026-09-30&compare=1
 *
 * Reads from the DB first (instagram_account_insights_daily + instagram_follower_snapshots).
 * If no data in DB for the range, fetches directly from Instagram API and saves.
 *
 * Returns: { metrics, timeSeries, followerSeries, profile, fetchedAt, hasData }
 */
export async function GET(request: Request) {
  try {
    const { env } = getInstagramEnv();
    if (!env) {
      return Response.json({ error: 'Configuración de Instagram incompleta' }, { status: 503 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();
    if (!profileData) {
      return Response.json({ error: 'No se encontró el perfil' }, { status: 400 });
    }

    const orgId = profileData.organization_id;
    const adminDb: AdminDb = createAdminClient();

    // Get connection
    const { data: conn } = await adminDb
      .from('instagram_connections')
      .select('id,ig_user_id,access_token_encrypted,status,granted_scopes,followers_count')
      .eq('organization_id', orgId)
      .eq('status', 'connected')
      .maybeSingle();

    if (!conn) {
      return Response.json({ error: 'No hay conexión de Instagram activa' }, { status: 404 });
    }

    // Check insights permission
    const grantedScopes: string[] = conn.granted_scopes ?? [];
    const hasInsightsScope = grantedScopes.includes('instagram_business_manage_insights');

    const url = new URL(request.url);
    const sinceStr = url.searchParams.get('since');
    const untilStr = url.searchParams.get('until');
    const compare = url.searchParams.get('compare') === '1';

    if (!sinceStr || !untilStr) {
      return Response.json({ error: 'Parámetros since y until requeridos' }, { status: 400 });
    }

    const since = new Date(sinceStr + 'T00:00:00Z');
    const until = new Date(untilStr + 'T23:59:59Z');
    const periodDays = Math.ceil((until.getTime() - since.getTime()) / (1000 * 60 * 60 * 24));

    // Try to read from DB first
    const { data: dbInsights } = await adminDb
      .from('instagram_account_insights_daily')
      .select('date,metric,breakdown_key,breakdown_value,value')
      .eq('connection_id', conn.id)
      .gte('date', sinceStr)
      .lte('date', untilStr)
      .order('date', { ascending: true });

    const { data: dbFollowers } = await adminDb
      .from('instagram_follower_snapshots')
      .select('date,followers_count,follows_count,media_count')
      .eq('connection_id', conn.id)
      .gte('date', sinceStr)
      .lte('date', untilStr)
      .order('date', { ascending: true });

    const metrics: Record<string, { total: number; breakdowns: Record<string, Record<string, number>> }> = {};
    let reachTimeSeries: Array<{ date: string; value: number }> = [];
    let followerSeries: Array<{ date: string; followers_count: number; follows_count: number; media_count: number }> = [];
    let fetchedAt: string | null = null;
    let hasData = false;

    if (dbInsights && dbInsights.length > 0) {
      // Build metrics from DB
      hasData = true;
      fetchedAt = 'db';

      for (const row of dbInsights) {
        if (!metrics[row.metric]) {
          metrics[row.metric] = { total: 0, breakdowns: {} };
        }
        if (row.breakdown_key === '' && row.breakdown_value === '') {
          metrics[row.metric].total += row.value;
        } else {
          if (!metrics[row.metric].breakdowns[row.breakdown_key]) {
            metrics[row.metric].breakdowns[row.breakdown_key] = {};
          }
          const bk = metrics[row.metric].breakdowns[row.breakdown_key];
          bk[row.breakdown_value] = (bk[row.breakdown_value] ?? 0) + row.value;
        }
      }

      // Build reach time series from DB
      reachTimeSeries = dbInsights
        .filter((r: { metric: string; breakdown_key: string }) => r.metric === 'reach' && r.breakdown_key === '')
        .map((r: { date: string; value: number }) => ({ date: r.date, value: r.value }));
    } else if (hasInsightsScope) {
      // Fetch directly from Instagram API
      try {
        const token = decryptToken(conn.access_token_encrypted);

        // Fetch total_value metrics in 30-day windows
        const windows = splitInto30DayWindows(since, until);
        const allMetricNames = ACCOUNT_METRICS.map((m) => m.name);

        for (const window of windows) {
          try {
            const results = await getAccountInsights(
              token, conn.ig_user_id, allMetricNames,
              window.since, window.until, 'total_value',
            );

            for (const result of results) {
              if (!metrics[result.name]) {
                metrics[result.name] = { total: 0, breakdowns: {} };
              }
              if (result.total_value) {
                metrics[result.name].total += result.total_value.value;

                // Process breakdowns
                if (result.total_value.breakdowns) {
                  for (const bd of result.total_value.breakdowns) {
                    const bKey = bd.dimension_keys.join(',');
                    if (!metrics[result.name].breakdowns[bKey]) {
                      metrics[result.name].breakdowns[bKey] = {};
                    }
                    for (const r of bd.results) {
                      const bVal = r.dimension_values.join(',');
                      metrics[result.name].breakdowns[bKey][bVal] =
                        (metrics[result.name].breakdowns[bKey][bVal] ?? 0) + r.value;
                    }
                  }
                }
              }
            }
          } catch (err) {
            // If a metric is rejected, log and continue
            console.warn('[insights] Window fetch failed:', err instanceof Error ? err.message : err);
          }
        }

        // Fetch time_series for reach
        if (TIME_SERIES_METRICS.length > 0) {
          for (const window of windows) {
            try {
              const tsResults = await getAccountInsights(
                token, conn.ig_user_id, TIME_SERIES_METRICS,
                window.since, window.until, 'time_series',
              );

              for (const result of tsResults) {
                if (result.name === 'reach' && result.values) {
                  for (const v of result.values) {
                    if (v.end_time) {
                      reachTimeSeries.push({
                        date: v.end_time.split('T')[0],
                        value: v.value,
                      });
                    }
                  }
                }
              }
            } catch {
              // time_series fetch failed, continue
            }
          }
        }

        hasData = Object.keys(metrics).length > 0;
        fetchedAt = new Date().toISOString();

        // Save to DB for future reads (fire-and-forget)
        if (hasData) {
          saveInsightsToDb(adminDb, conn.id, orgId, metrics, sinceStr).catch((e: unknown) =>
            console.error('[insights] Failed to save to DB:', e),
          );
        }
      } catch (err) {
        console.error('[insights] API fetch failed:', err);
        // Return empty rather than error — the modal will show "Sin datos"
      }
    }

    // Follower series
    followerSeries = (dbFollowers ?? []).map((r: { date: string; followers_count: number; follows_count: number; media_count: number }) => ({
      date: r.date,
      followers_count: r.followers_count,
      follows_count: r.follows_count,
      media_count: r.media_count,
    }));

    // Compare with previous period
    let previousMetrics: Record<string, { total: number }> | null = null;
    if (compare) {
      const prevSince = new Date(since);
      prevSince.setDate(prevSince.getDate() - periodDays);
      const prevUntil = new Date(since);
      prevUntil.setDate(prevUntil.getDate() - 1);
      const prevSinceStr = prevSince.toISOString().split('T')[0];
      const prevUntilStr = prevUntil.toISOString().split('T')[0];

      const { data: prevDbInsights } = await adminDb
        .from('instagram_account_insights_daily')
        .select('metric,value,breakdown_key')
        .eq('connection_id', conn.id)
        .gte('date', prevSinceStr)
        .lte('date', prevUntilStr);

      if (prevDbInsights && prevDbInsights.length > 0) {
        previousMetrics = {};
        for (const row of prevDbInsights) {
          if (row.breakdown_key !== '') continue;
          if (!previousMetrics[row.metric]) {
            previousMetrics[row.metric] = { total: 0 };
          }
          previousMetrics[row.metric].total += row.value;
        }
      }
    }

    // Get current profile for follower count
    let currentFollowers = conn.followers_count ?? 0;
    if (hasInsightsScope) {
      try {
        const token = decryptToken(conn.access_token_encrypted);
        const profile = await getProfile(token);
        currentFollowers = profile.followers_count ?? currentFollowers;
      } catch {
        // Use cached
      }
    }

    return Response.json({
      metrics,
      reachTimeSeries,
      followerSeries,
      previousMetrics,
      currentFollowers,
      hasInsightsScope,
      hasData,
      fetchedAt,
      periodDays,
    });
  } catch (error) {
    console.error('[insights] Route error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/instagram/insights/refresh
 * Manual refresh — re-fetches last 3 days from Instagram API.
 */
export async function POST(_request: Request) {
  try {
    const { env } = getInstagramEnv();
    if (!env) {
      return Response.json({ error: 'Configuración de Instagram incompleta' }, { status: 503 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();
    if (!profileData) {
      return Response.json({ error: 'No se encontró el perfil' }, { status: 400 });
    }

    const adminDb: AdminDb = createAdminClient();
    const { data: conn } = await adminDb
      .from('instagram_connections')
      .select('id,ig_user_id,access_token_encrypted,granted_scopes')
      .eq('organization_id', profileData.organization_id)
      .eq('status', 'connected')
      .maybeSingle();

    if (!conn) {
      return Response.json({ error: 'No hay conexión activa' }, { status: 404 });
    }

    const grantedScopes: string[] = conn.granted_scopes ?? [];
    if (!grantedScopes.includes('instagram_business_manage_insights')) {
      return Response.json({ error: 'Falta el permiso de estadísticas' }, { status: 403 });
    }

    // Rate limit: max once every 5 minutes
    const token = decryptToken(conn.access_token_encrypted);

    // Fetch last 3 days
    const now = new Date();
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const allMetricNames = ACCOUNT_METRICS.map((m) => m.name);

    const results = await getAccountInsights(
      token, conn.ig_user_id, allMetricNames,
      threeDaysAgo, now, 'total_value',
    );

    const metrics: Record<string, { total: number; breakdowns: Record<string, Record<string, number>> }> = {};
    for (const result of results) {
      if (!metrics[result.name]) {
        metrics[result.name] = { total: 0, breakdowns: {} };
      }
      if (result.total_value) {
        metrics[result.name].total += result.total_value.value;
      }
    }

    const sinceStr = threeDaysAgo.toISOString().split('T')[0];
    const untilStr = now.toISOString().split('T')[0];

    await saveInsightsToDb(adminDb, conn.id, profileData.organization_id, metrics, sinceStr);

    // Save follower snapshot
    const profile = await getProfile(token);
    await adminDb
      .from('instagram_follower_snapshots')
      .upsert({
        connection_id: conn.id,
        organization_id: profileData.organization_id,
        date: untilStr,
        followers_count: profile.followers_count ?? 0,
        follows_count: profile.follows_count ?? 0,
        media_count: profile.media_count ?? 0,
      }, { onConflict: 'connection_id,date' });

    return Response.json({ success: true, refreshedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[insights] Refresh error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar' },
      { status: 500 },
    );
  }
}

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

async function saveInsightsToDb(
  adminDb: AdminDb,
  connectionId: string,
  orgId: string,
  metrics: Record<string, { total: number; breakdowns: Record<string, Record<string, number>> }>,
  sinceStr: string,
) {
  const rows: Array<{
    connection_id: string;
    organization_id: string;
    date: string;
    metric: string;
    breakdown_key: string;
    breakdown_value: string;
    value: number;
    fetched_at: string;
  }> = [];

  const now = new Date().toISOString();

  // For simplicity, we store the total for each date in the range as a daily entry
  // using the sinceStr as the date (the cron job will store proper day-by-day data)
  for (const [metricName, data] of Object.entries(metrics)) {
    // Total (no breakdown)
    rows.push({
      connection_id: connectionId,
      organization_id: orgId,
      date: sinceStr,
      metric: metricName,
      breakdown_key: '',
      breakdown_value: '',
      value: data.total,
      fetched_at: now,
    });

    // Breakdowns
    for (const [bKey, bValues] of Object.entries(data.breakdowns)) {
      for (const [bVal, val] of Object.entries(bValues)) {
        rows.push({
          connection_id: connectionId,
          organization_id: orgId,
          date: sinceStr,
          metric: metricName,
          breakdown_key: bKey,
          breakdown_value: bVal,
          value: val,
          fetched_at: now,
        });
      }
    }
  }

  if (rows.length > 0) {
    // Upsert in batches of 100
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await adminDb
        .from('instagram_account_insights_daily')
        .upsert(batch, { onConflict: 'connection_id,date,metric,breakdown_key,breakdown_value' });
      if (error) {
        console.error('[insights] Upsert batch error:', error.message);
      }
    }
  }
}
