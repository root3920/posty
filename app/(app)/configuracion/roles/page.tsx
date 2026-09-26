'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/hooks/use-profile';

interface Role {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_system: boolean;
  home_route: string;
}

interface Permission {
  key: string;
  module: string;
  action: string;
  scope: string | null;
  description: string;
}

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  team: 'Equipo',
  tasks: 'Tareas',
  rooms: 'Hotel',
  guests: 'Huéspedes',
  stays: 'Estancias',
  finance: 'Finanzas',
  settings: 'Configuración',
  roles: 'Roles',
};

export default function RolesPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#6b7280');

  // Fetch roles
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('roles')
        .select('*')
        .order('is_system', { ascending: false })
        .order('name');
      if (error) throw error;
      return data as Role[];
    },
  });

  // Fetch all permissions
  const { data: allPermissions = [] } = useQuery({
    queryKey: ['all-permissions'],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('permissions')
        .select('*')
        .order('module')
        .order('action');
      if (error) throw error;
      return data as Permission[];
    },
  });

  // Fetch role permissions for selected role
  const { data: rolePermissions = [] } = useQuery({
    queryKey: ['role-permissions', selectedRole?.id],
    queryFn: async () => {
      if (!selectedRole) return [];
      const { data, error } = await createClient()
        .from('role_permissions')
        .select('permission_key')
        .eq('role_id', selectedRole.id);
      if (error) throw error;
      return data.map((rp) => rp.permission_key);
    },
    enabled: !!selectedRole,
  });

  // Toggle permission mutation
  const togglePermission = useMutation({
    mutationFn: async ({ roleId, permKey, enabled }: { roleId: string; permKey: string; enabled: boolean }) => {
      if (enabled) {
        const { error } = await createClient()
          .from('role_permissions')
          .insert({ role_id: roleId, permission_key: permKey });
        if (error) throw error;
      } else {
        const { error } = await createClient()
          .from('role_permissions')
          .delete()
          .eq('role_id', roleId)
          .eq('permission_key', permKey);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions', selectedRole?.id] });
    },
    onError: () => {
      toast.error('Error al actualizar permiso');
    },
  });

  // Create role mutation
  const createRole = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id) throw new Error('Sin organización');
      const { error } = await createClient().from('roles').insert({
        organization_id: profile.organization_id,
        name: newRoleName,
        description: newRoleDescription || null,
        color: newRoleColor,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setIsCreateOpen(false);
      setNewRoleName('');
      setNewRoleDescription('');
      setNewRoleColor('#6b7280');
      toast.success('Rol creado');
    },
    onError: () => {
      toast.error('Error al crear el rol');
    },
  });

  // Delete role mutation
  const deleteRole = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await createClient().from('roles').delete().eq('id', roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setSelectedRole(null);
      toast.success('Rol eliminado');
    },
    onError: () => {
      toast.error('Error al eliminar el rol');
    },
  });

  // Duplicate role
  const duplicateRole = useMutation({
    mutationFn: async (role: Role) => {
      if (!profile?.organization_id) throw new Error('Sin organización');
      // Create new role
      const { data: newRole, error: createError } = await createClient()
        .from('roles')
        .insert({
          organization_id: profile.organization_id,
          name: `${role.name} (copia)`,
          description: role.description,
          color: role.color,
          home_route: role.home_route,
        })
        .select('id')
        .single();
      if (createError || !newRole) throw createError;

      // Copy permissions
      const { data: perms } = await createClient()
        .from('role_permissions')
        .select('permission_key')
        .eq('role_id', role.id);

      if (perms && perms.length > 0) {
        const { error: permError } = await createClient()
          .from('role_permissions')
          .insert(perms.map((p) => ({ role_id: newRole.id, permission_key: p.permission_key })));
        if (permError) throw permError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Rol duplicado');
    },
    onError: () => {
      toast.error('Error al duplicar el rol');
    },
  });

  // Group permissions by module
  const permissionsByModule = allPermissions.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roles y permisos</h1>
          <p className="text-muted-foreground text-sm">
            Administra los roles y sus permisos de acceso
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Crear rol
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Roles list */}
        <div className="space-y-2">
          {rolesLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))
            : roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    selectedRole?.id === role.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: role.color }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{role.name}</span>
                      {role.is_system && (
                        <Badge variant="secondary" className="text-[10px]">
                          Sistema
                        </Badge>
                      )}
                    </div>
                    {role.description && (
                      <p className="text-muted-foreground text-xs">{role.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateRole.mutate(role);
                      }}
                      title="Duplicar"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {!role.is_system && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('¿Eliminar este rol?')) {
                            deleteRole.mutate(role.id);
                          }
                        }}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </button>
              ))}
        </div>

        {/* Permissions matrix */}
        <div className="rounded-lg border p-4">
          {selectedRole ? (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: selectedRole.color }}
                />
                <h2 className="text-lg font-semibold">{selectedRole.name}</h2>
                {selectedRole.is_system && (
                  <Badge variant="secondary">Sistema — todos los permisos</Badge>
                )}
              </div>

              {Object.entries(permissionsByModule).map(([module, perms]) => (
                <div key={module} className="space-y-2">
                  <h3 className="text-sm font-medium">
                    {MODULE_LABELS[module] || module}
                  </h3>
                  <div className="grid gap-1">
                    {perms.map((perm) => {
                      const isEnabled = rolePermissions.includes(perm.key);
                      return (
                        <label
                          key={perm.key}
                          className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                        >
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            disabled={selectedRole.is_system}
                            onChange={() =>
                              togglePermission.mutate({
                                roleId: selectedRole.id,
                                permKey: perm.key,
                                enabled: !isEnabled,
                              })
                            }
                            className="h-4 w-4 rounded"
                          />
                          <div>
                            <span className="text-sm">{perm.description}</span>
                            <span className="text-muted-foreground ml-2 text-xs">
                              {perm.key}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center">
              <p className="text-muted-foreground text-sm">
                Selecciona un rol para ver sus permisos
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Role Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear rol</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createRole.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="roleName">Nombre</Label>
              <Input
                id="roleName"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Ej: Recepcionista nocturno"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleDescription">Descripción</Label>
              <Input
                id="roleDescription"
                value={newRoleDescription}
                onChange={(e) => setNewRoleDescription(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleColor">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="roleColor"
                  type="color"
                  value={newRoleColor}
                  onChange={(e) => setNewRoleColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border"
                />
                <Input
                  value={newRoleColor}
                  onChange={(e) => setNewRoleColor(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={createRole.isPending}>
              {createRole.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear rol
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
