'use client';

import Image from 'next/image';
import { Menu, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useProfile } from '@/hooks/use-profile';
import { useMobileNavStore } from './mobile-nav-store';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function MobileHeader() {
  const { toggle } = useMobileNavStore();
  const { data: profile } = useProfile();

  return (
    <header
      className="safe-top sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-background/90 px-3 backdrop-blur-xl md:hidden"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0px)' }}
    >
      {/* Hamburger */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        className="touch-target rounded-[10px]"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Logo centrado */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        <Image
          src="/brand/posty-cat-white.png"
          alt="POSTY"
          width={24}
          height={24}
          className="shrink-0 dark:block"
          priority
        />
        <Image
          src="/brand/posty-cat-white.png"
          alt="POSTY"
          width={24}
          height={24}
          className="shrink-0 dark:hidden"
          priority
        />
        <span className="font-heading text-[15px] font-bold tracking-tight">POSTY</span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="touch-target rounded-[10px]"
          aria-label="Notificaciones"
          disabled
        >
          <Bell className="h-5 w-5" />
        </Button>

        <Button variant="ghost" size="icon" className="touch-target rounded-full" aria-label="Perfil">
          <Avatar className="h-8 w-8">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
            <AvatarFallback className="bg-posty-100 text-posty-700 text-xs font-semibold">
              {profile ? getInitials(profile.full_name) : 'US'}
            </AvatarFallback>
          </Avatar>
        </Button>
      </div>
    </header>
  );
}
