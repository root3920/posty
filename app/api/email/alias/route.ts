import { createAdminClient } from '@/lib/supabase/admin';
import { getServerProfile } from '@/lib/auth/get-profile';
import { validateAlias, generateAlias } from '@/lib/email/alias';
import { getEmailEnv } from '@/lib/email/env';
import { z } from 'zod';

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET — return current alias for the org
export async function GET() {
  try {
    const profile = await getServerProfile();
    if (!profile) {
      return Response.json({ error: 'No autenticado' }, { status: 401 });
    }

    const adminDb = createAdminClient() as any;
    const { env } = getEmailEnv();
    const domain = env?.EMAIL_HOTEL_DOMAIN || 'hoteles.postyassistant.com';

    const { data: aliasRow } = await adminDb
      .from('email_aliases')
      .select('alias, active, created_at')
      .eq('organization_id', profile.organization_id)
      .eq('active', true)
      .maybeSingle();

    return Response.json({
      alias: aliasRow?.alias || null,
      domain,
      fullAddress: aliasRow ? `${aliasRow.alias}@${domain}` : null,
      createdAt: aliasRow?.created_at || null,
    });
  } catch (error) {
    console.error('[Email Alias] GET error:', error);
    return Response.json({ error: 'Error al obtener alias' }, { status: 500 });
  }
}

const updateSchema = z.object({
  alias: z.string().min(3).max(40),
});

// PUT — create or update alias
export async function PUT(request: Request) {
  try {
    const profile = await getServerProfile();
    if (!profile) {
      return Response.json({ error: 'No autenticado' }, { status: 401 });
    }

    const org = profile.organization;
    if (!org) {
      return Response.json({ error: 'Organización no encontrada' }, { status: 403 });
    }

    const input = updateSchema.safeParse(await request.json());
    if (!input.success) {
      return Response.json({ error: input.error.issues[0].message }, { status: 400 });
    }

    const newAlias = input.data.alias.toLowerCase();

    // Validate format and reserved words
    const validationError = validateAlias(newAlias);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }

    const adminDb = createAdminClient() as any;
    const { env } = getEmailEnv();
    const domain = env?.EMAIL_HOTEL_DOMAIN || 'hoteles.postyassistant.com';

    // Check uniqueness (across all orgs)
    const { data: existing } = await adminDb
      .from('email_aliases')
      .select('organization_id')
      .eq('alias', newAlias)
      .eq('active', true)
      .maybeSingle();

    if (existing && existing.organization_id !== profile.organization_id) {
      return Response.json({ error: 'Este alias ya está en uso por otro hotel' }, { status: 409 });
    }

    // Check if org already has an alias
    const { data: currentAlias } = await adminDb
      .from('email_aliases')
      .select('id, alias')
      .eq('organization_id', profile.organization_id)
      .eq('active', true)
      .maybeSingle();

    if (currentAlias) {
      if (currentAlias.alias === newAlias) {
        return Response.json({
          alias: newAlias,
          domain,
          fullAddress: `${newAlias}@${domain}`,
        });
      }

      // Deactivate old alias with 90-day grace period
      await adminDb
        .from('email_aliases')
        .update({
          active: false,
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', currentAlias.id);
    }

    // Insert new alias
    const { error: insertErr } = await adminDb
      .from('email_aliases')
      .upsert({
        organization_id: profile.organization_id,
        alias: newAlias,
        active: true,
        expires_at: null,
      }, {
        onConflict: 'organization_id',
      });

    if (insertErr) {
      // Handle unique constraint violation
      if (insertErr.code === '23505') {
        return Response.json({ error: 'Este alias ya está en uso' }, { status: 409 });
      }
      return Response.json({ error: `Error al guardar alias: ${insertErr.message}` }, { status: 500 });
    }

    return Response.json({
      alias: newAlias,
      domain,
      fullAddress: `${newAlias}@${domain}`,
    });
  } catch (error) {
    console.error('[Email Alias] PUT error:', error);
    return Response.json({ error: 'Error al actualizar alias' }, { status: 500 });
  }
}

// POST — auto-generate alias from org name
export async function POST() {
  try {
    const profile = await getServerProfile();
    if (!profile) {
      return Response.json({ error: 'No autenticado' }, { status: 401 });
    }

    const org = profile.organization;
    if (!org) {
      return Response.json({ error: 'Organización no encontrada' }, { status: 403 });
    }

    // Check if already has an alias
    const adminDb = createAdminClient() as any;
    const { data: existing } = await adminDb
      .from('email_aliases')
      .select('alias')
      .eq('organization_id', profile.organization_id)
      .eq('active', true)
      .maybeSingle();

    if (existing) {
      return Response.json({ alias: existing.alias, alreadyExists: true });
    }

    // Generate from org name
    let candidate = generateAlias(org.name);

    // Ensure uniqueness
    let attempts = 0;
    while (attempts < 10) {
      const { data: taken } = await adminDb
        .from('email_aliases')
        .select('id')
        .eq('alias', candidate)
        .maybeSingle();

      if (!taken) break;

      attempts++;
      candidate = `${generateAlias(org.name)}-${attempts}`;
    }

    return Response.json({ alias: candidate, alreadyExists: false });
  } catch (error) {
    console.error('[Email Alias] POST error:', error);
    return Response.json({ error: 'Error al generar alias' }, { status: 500 });
  }
}
