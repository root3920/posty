import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
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

    const body = await request.json() as { action: string };

    const admin = createAdminClient();

    if (body.action === 'apply_privacy') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (admin as any).rpc('apply_personal_account_privacy', {
        p_org_id: profile.organization_id,
      });
      if (error) throw error;
      return Response.json(data);
    }

    if (body.action === 'delete_non_guest_chats') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (admin as any).rpc('delete_imported_non_guest_chats', {
        p_org_id: profile.organization_id,
      });
      if (error) throw error;
      return Response.json(data);
    }

    if (body.action === 'change_account_type') {
      const { accountType } = body as { action: string; accountType: string };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('whatsapp_connections')
        .update({ account_type: accountType })
        .eq('organization_id', profile.organization_id);

      // If changed to personal, apply privacy rules
      if (accountType === 'personal') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).rpc('apply_personal_account_privacy', {
          p_org_id: profile.organization_id,
        });
      } else {
        // If changed to business, unhide all
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any)
          .from('chat_conversations')
          .update({ is_hidden: false })
          .eq('organization_id', profile.organization_id)
          .eq('is_hidden', true);
      }

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[Privacy]', error);
    return Response.json({ error: 'Error' }, { status: 500 });
  }
}
