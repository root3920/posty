'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
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
    <div className="flex min-h-full">
      {/* Left panel — brand */}
      <div className="relative hidden w-1/2 items-center justify-center overflow-hidden lg:flex"
        style={{ background: 'linear-gradient(135deg, #9c0b21 0%, #82091b 50%, #690717 100%)' }}
      >
        <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-white/5" />
        <div className="relative z-10 flex flex-col items-center gap-6 px-12 text-center">
          <Image
            src="/brand/posty-cat-white.png"
            alt="POSTY"
            width={120}
            height={120}
            className="drop-shadow-lg"
            priority
          />
          <h1 className="font-heading text-4xl font-bold tracking-tight text-white">POSTY</h1>
          <p className="max-w-xs text-lg text-white/70">
            Registra tu hotel y empieza a gestionar
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center gap-3 lg:hidden">
            <Image src="/brand/posty-cat-black.png" alt="POSTY" width={56} height={56} className="dark:hidden" priority />
            <Image src="/brand/posty-cat-white.png" alt="POSTY" width={56} height={56} className="hidden dark:block" priority />
            <h1 className="font-heading text-2xl font-bold tracking-tight">POSTY</h1>
          </div>

          <div className="hidden lg:block">
            <h2 className="font-heading text-2xl font-bold tracking-tight">Crear cuenta</h2>
            <p className="text-muted-foreground mt-1 text-sm">Registra tu hotel en POSTY</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organizationName">Nombre del hotel</Label>
              <Input id="organizationName" placeholder="Mi Hotel" className="shadow-xs" {...register('organizationName')} />
              {errors.organizationName && <p className="text-destructive text-xs">{errors.organizationName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Tu nombre completo</Label>
              <Input id="fullName" placeholder="Juan Pérez" className="shadow-xs" {...register('fullName')} />
              {errors.fullName && <p className="text-destructive text-xs">{errors.fullName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="tu@email.com" autoComplete="email" className="shadow-xs" {...register('email')} />
              {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" placeholder="••••••" autoComplete="new-password" className="shadow-xs" {...register('password')} />
              {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input id="confirmPassword" type="password" placeholder="••••••" autoComplete="new-password" className="shadow-xs" {...register('confirmPassword')} />
              {errors.confirmPassword && <p className="text-destructive text-xs">{errors.confirmPassword.message}</p>}
            </div>
            <Button type="submit" className="w-full shadow-brand hover:shadow-brand-hover transition-shadow" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear cuenta
            </Button>
          </form>

          <p className="text-muted-foreground text-center text-sm">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-posty-600 font-medium hover:text-posty-500 hover:underline dark:text-posty-400">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
