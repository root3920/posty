'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setupPasswordSchema, type SetupPasswordInput } from '@/lib/validations/auth';
import { createClient } from '@/lib/supabase/client';

export default function AuthSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetupPasswordInput>({
    resolver: zodResolver(setupPasswordSchema),
  });

  async function onSubmit(data: SetupPasswordInput) {
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({
      password: data.password,
    });

    if (error) {
      toast.error('Error al configurar la contraseña');
      setLoading(false);
      return;
    }

    toast.success('Contraseña configurada');
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-6">
        <div className="space-y-2 text-center">
          <div className="bg-primary text-primary-foreground mx-auto flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold">
            P
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Configurar cuenta</h1>
          <p className="text-muted-foreground text-sm">
            Define tu contraseña para acceder a POSTY
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nueva contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••"
              autoComplete="new-password"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-destructive text-xs">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••"
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-destructive text-xs">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar contraseña
          </Button>
        </form>
      </div>
    </div>
  );
}
