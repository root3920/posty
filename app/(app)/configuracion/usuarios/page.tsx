'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { createClient } from '@/lib/supabase/client';
import { inviteSchema, type InviteInput } from '@/lib/validations/auth';
import { inviteUserAction } from '@/app/actions/auth';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  is_active: boolean;
  role: { id: string; name: string; color: string } | null;
}

interface Role {
  id: string;
  name: string;
  color: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function UsuariosPage() {
  const queryClient = useQueryClient();
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteInput>({
    resolver: zodResolver(inviteSchema),
  });

  // Fetch profiles
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('profiles')
        .select('id, full_name, email, phone, job_title, is_active, role:roles(id, name, color)')
        .order('full_name');
      if (error) throw error;
      return data as unknown as Profile[];
    },
  });

  // Fetch roles for invite form
  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('roles')
        .select('id, name, color')
        .order('name');
      if (error) throw error;
      return data as Role[];
    },
  });

  // Invite mutation
  const invite = useMutation({
    mutationFn: async (data: InviteInput) => {
      const result = await inviteUserAction(data);
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsInviteOpen(false);
      reset();
      toast.success('Invitación enviada');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al enviar la invitación');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-muted-foreground text-sm">
            Gestiona los miembros de tu equipo
          </p>
        </div>
        <Button onClick={() => setIsInviteOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invitar
        </Button>
      </div>

      {/* Users list */}
      <div className="space-y-2">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg border bg-muted/30" />
            ))
          : profiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center gap-4 rounded-lg border p-4"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{profile.full_name}</span>
                    {!profile.is_active && (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">{profile.email}</p>
                </div>
                {profile.role && (
                  <Badge
                    style={{ backgroundColor: `${profile.role.color}20`, color: profile.role.color, borderColor: profile.role.color }}
                  >
                    {profile.role.name}
                  </Badge>
                )}
              </div>
            ))}
      </div>

      {/* Invite Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar miembro</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((data) => invite.mutate(data))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inviteFullName">Nombre completo</Label>
              <Input
                id="inviteFullName"
                placeholder="Juan Pérez"
                {...register('fullName')}
              />
              {errors.fullName && (
                <p className="text-destructive text-xs">{errors.fullName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Email</Label>
              <Input
                id="inviteEmail"
                type="email"
                placeholder="juan@hotel.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-destructive text-xs">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="inviteRole">Rol</Label>
              <select
                id="inviteRole"
                className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm"
                {...register('roleId')}
              >
                <option value="">Selecciona un rol</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              {errors.roleId && (
                <p className="text-destructive text-xs">{errors.roleId.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={invite.isPending}>
              {invite.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar invitación
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
