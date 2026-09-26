'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { registerSchema, type RegisterInput } from '@/lib/validations/auth';
import { registerAction } from '@/app/actions/auth';

export default function RegistroPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterInput) {
    setLoading(true);

    const result = await registerAction(data);

    if (result.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    toast.success('Cuenta creada exitosamente');
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
          <h1 className="text-2xl font-bold tracking-tight">Crear cuenta</h1>
          <p className="text-muted-foreground text-sm">Registra tu hotel en POSTY</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="organizationName">Nombre del hotel</Label>
            <Input
              id="organizationName"
              placeholder="Mi Hotel"
              {...register('organizationName')}
            />
            {errors.organizationName && (
              <p className="text-destructive text-xs">{errors.organizationName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Tu nombre completo</Label>
            <Input
              id="fullName"
              placeholder="Juan Pérez"
              {...register('fullName')}
            />
            {errors.fullName && (
              <p className="text-destructive text-xs">{errors.fullName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-destructive text-xs">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
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
            Crear cuenta
          </Button>
        </form>

        <p className="text-muted-foreground text-center text-sm">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
