import { createAdminClient } from '@/lib/supabase/admin';
import { decryptToken } from '@/lib/instagram/crypto';
import {
  getAccountInsights,
  getProfile,
} from '@/lib/instagram/client';
import { verifyCronRequest } from '@/lib/cron/verify';
import { ACCOUNT_METRICS, TIME_SERIES_METRICS } from '@/lib/instagram/insights-metrics';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminDb = any;

export const maxDuration = 120;

/**
 * POST /api/cron/instagram-insights (called daily by pg_cron via pg_net)
 *
 * For each connected Instagram account with insights scope:
 * 1. Save account metrics for yesterday (day-by-day via time_series where possible)
 * 2. Re-fetch last 3 days (48h data delay) with upsert
 * 3. Save follower snapshot
 * 4. Log API call
 */
async function handler(request: Request) {
  // Verify cron secret
  const authError = verifyCronRequest(request);
  if (authError) return authError;

  const adminDb: AdminDb = createAdminClient();
  let processed = 0;
  let errors = 0;

  try {
    // Get all connected accounts with insights scope
    const { data: connections, error: connError } = await adminDb
      .from('instagram_connections')
      .select('id,organization_id,ig_user_id,access_token_encrypted,granted_scopes')
      .eq('status', 'connected');

    if (connError) {
      console.error('[cron-insights] Failed to fetch connections:', connError.message);
      return Response.json({ error: 'DB error' }, { status: 500 });
    }

    for (const conn of connections ?? []) {
      const scopes: string[] = conn.granted_scopes ?? [];
      if (!scopes.includes('instagram_business_manage_insights')) continue;

      try {
        const token = decryptToken(conn.access_token_encrypted);

        // Date setup: fetch last 3 days to account for 48h delay
        const now = new Date();
        const threeDaysAgo = new Date(now);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const allMetricNames = ACCOUNT_METRICS.map((m) => m.name);

        // 1. Fetch total_value for each of the last 3 days individually
        for (let d = 0; d < 3; d++) {
          const dayStart = new Date(threeDaysAgo);
          dayStart.setDate(dayStart.getDate() + d);
          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);

          const dateStr = dayStart.toISOString().split('T')[0];

          try {
            const results = await getAccountInsights(
              token, conn.ig_user_id, allMetricNames,
              dayStart, dayEnd, 'total_value',
            );

            const rows: Array<Record<string, unknown>> = [];

            for (const result of results) {
              // Total
              if (result.total_value) {
                rows.push({
                  connection_id: conn.id,
                  organization_id: conn.organization_id,
                  date: dateStr,
                  metric: result.name,
                  breakdown_key: '',
                  breakdown_value: '',
                  value: result.total_value.value,
                  fetched_at: now.toISOString(),
                });

                // Breakdowns
                if (result.total_value.breakdowns) {
                  for (const bd of result.total_value.breakdowns) {
                    const bKey = bd.dimension_keys.join(',');
                    for (const r of bd.results) {
                      const bVal = r.dimension_values.join(',');
                      rows.push({
                        connection_id: conn.id,
                        organization_id: conn.organization_id,
                        date: dateStr,
                        metric: result.name,
                        breakdown_key: bKey,
                        breakdown_value: bVal,
                        value: r.value,
                        fetched_at: now.toISOString(),
                      });
                    }
                  }
                }
              }
            }

            // Upsert
            if (rows.length > 0) {
              for (let i = 0; i < rows.length; i += 100) {
                await adminDb
                  .from('instagram_account_insights_daily')
                  .upsert(rows.slice(i, i + 100), {
                    onConflict: 'connection_id,date,metric,breakdown_key,breakdown_value',
                  });
              }
            }
          } catch (err) {
            // Individual day failed — log but continue
            console.warn(`[cron-insights] Day ${dateStr} failed for conn ${conn.id}:`, err instanceof Error ? err.message : err);
          }
        }

        // 2. Fetch time_series for reach (last 3 days)
        if (TIME_SERIES_METRICS.length > 0) {
          try {
            const tsResults = await getAccountInsights(
              token, conn.ig_user_id, TIME_SERIES_METRICS,
              threeDaysAgo, now, 'time_series',
            );

            for (const result of tsResults) {
              if (result.values) {
                for (const v of result.values) {
                  if (v.end_time) {
                    const dateStr = v.end_time.split('T')[0];
                    await adminDb
                      .from('instagram_account_insights_daily')
                      .upsert({
                        connection_id: conn.id,
                        organization_id: conn.organization_id,
                        date: dateStr,
                        metric: result.name + '_ts',
                        breakdown_key: '',
                        breakdown_value: '',
                        value: v.value,
                        fetched_at: now.toISOString(),
                      }, { onConflict: 'connection_id,date,metric,breakdown_key,breakdown_value' });
                  }
                }
              }
            }
          } catch {
            // time_series failed — not critical
          }
        }

        // 3. Save follower snapshot
        try {
          const profile = await getProfile(token);
          const todayStr = now.toISOString().split('T')[0];

          await adminDb
            .from('instagram_follower_snapshots')
            .upsert({
              connection_id: conn.id,
              organization_id: conn.organization_id,
              date: todayStr,
              followers_count: profile.followers_count ?? 0,
              follows_count: profile.follows_count ?? 0,
              media_count: profile.media_count ?? 0,
            }, { onConflict: 'connection_id,date' });
        } catch (err) {
          console.warn('[cron-insights] Follower snapshot failed:', err instanceof Error ? err.message : err);
        }

        // 4. Log API call
        await adminDb
          .from('instagram_api_logs')
          .insert({
            endpoint: 'cron/instagram-insights',
            method: 'CRON',
            organization_id: conn.organization_id,
            response_body: { processed: true, date: now.toISOString().split('T')[0] },
            status_code: 200,
          });

        processed++;
      } catch (err) {
        errors++;
        console.error(`[cron-insights] Connection ${conn.id} failed:`, err instanceof Error ? err.message : err);

        await adminDb
          .from('instagram_api_logs')
          .insert({
            endpoint: 'cron/instagram-insights',
            method: 'CRON',
            organization_id: conn.organization_id,
            response_body: { error: err instanceof Error ? err.message : 'unknown' },
            status_code: 500,
          }).catch(() => {});
      }
    }

    console.log(`[cron-insights] Done. processed=${processed} errors=${errors}`);
    return Response.json({ processed, errors });
  } catch (error) {
    console.error('[cron-insights] Fatal error:', error);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

export { handler as POST, handler as GET };
