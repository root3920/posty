'use server';

import { createClient } from '@/lib/supabase/server';
import { getSupabaseErrorMessage, logSupabaseError } from '@/lib/supabase/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import { registerSchema, inviteSchema } from '@/lib/validations/auth';

export async function registerAction(formData: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  organizationName: string;
}) {
  const parsed = registerSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();

  // 1. Sign up the user
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        organization_name: parsed.data.organizationName,
      },
    },
  });

  if (signUpError) {
    console.error('Registration error:', signUpError);
    return { error: signUpError.message };
  }

  if (!authData.user) {
    return { error: 'No se pudo crear el usuario' };
  }

  // 2. Use admin client to create organization, seed defaults, and link profile
  const admin = createAdminClient();

  // Create organization
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({ name: parsed.data.organizationName })
    .select('id')
    .single();

  if (orgError || !org) {
    logSupabaseError(orgError, 'registerAction:organization');
    return { error: getSupabaseErrorMessage(orgError, 'Organización') };
  }

  // Seed default catalogs
  const { error: seedError } = await admin.rpc('seed_organization_defaults', {
    p_org_id: org.id,
  });

  if (seedError) {
    logSupabaseError(seedError, 'registerAction:seed');
    return { error: getSupabaseErrorMessage(seedError, 'Configuración inicial') };
  }

  // Get the Gestor role (system role created by seed)
  const { data: gestorRole } = await admin
    .from('roles')
    .select('id')
    .eq('organization_id', org.id)
    .eq('is_system', true)
    .eq('name', 'Gestor')
    .single();

  // Create profile
  const { error: profileError } = await admin
    .from('profiles')
    .insert({
      id: authData.user.id,
      organization_id: org.id,
      role_id: gestorRole?.id ?? null,
      full_name: parsed.data.fullName,
      email: parsed.data.email,
    });

  if (profileError) {
    logSupabaseError(profileError, 'registerAction:profile');
    return { error: getSupabaseErrorMessage(profileError, 'Perfil') };
  }

  return { success: true };
}

export async function inviteUserAction(formData: {
  email: string;
  fullName: string;
  roleId: string;
}) {
  const parsed = inviteSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();

  // Get current user's organization
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'No autenticado' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return { error: 'Perfil no encontrado' };
  }

  // Use admin client to invite
  const admin = createAdminClient();

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      data: {
        full_name: parsed.data.fullName,
        organization_id: profile.organization_id,
        role_id: parsed.data.roleId,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? '' : 'http://localhost:3000'}/auth/setup`,
    },
  );

  if (inviteError) {
    console.error('Invite error:', inviteError);
    return { error: inviteError.message };
  }

  if (!inviteData.user) {
    return { error: 'Error al enviar la invitación' };
  }

  // Create profile for invited user
  const { error: profileError } = await admin
    .from('profiles')
    .insert({
      id: inviteData.user.id,
      organization_id: profile.organization_id,
      role_id: parsed.data.roleId,
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      is_active: true,
    });

  if (profileError) {
    logSupabaseError(profileError, 'inviteUserAction:profile');
    return { error: getSupabaseErrorMessage(profileError, 'Perfil del invitado') };
  }

  return { success: true };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
