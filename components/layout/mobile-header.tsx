'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useProfile } from '@/hooks/use-profile';
import { useMobileNavStore } from './mobile-nav-store';
import { GlobalSearch } from './global-search';
import { NotificationBell } from './notification-bell';
import { HotelLogo } from './hotel-logo';

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
        <HotelLogo catSize={24} withText onDark={false} />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <GlobalSearch />
        <NotificationBell />

        <Button variant="ghost" size="icon" className="touch-target rounded-full" aria-label="Perfil">
          <Avatar className="h-8 w-8">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {profile ? getInitials(profile.full_name) : 'US'}
            </AvatarFallback>
          </Avatar>
        </Button>
      </div>
    </header>
  );
}
