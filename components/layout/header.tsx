'use client';

import { useRouter } from 'next/navigation';
import { Moon, Sun, LogOut, User, HelpCircle } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProfile } from '@/hooks/use-profile';
import { signOutAction } from '@/app/actions/auth';
import { GlobalSearch } from './global-search';
import { NotificationBell } from './notification-bell';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Header() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { data: profile } = useProfile();

  async function handleSignOut() {
    await signOutAction();
    toast.success('Sesión cerrada');
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 hidden h-14 items-center gap-4 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl md:flex">
      {/* Search */}
      <GlobalSearch />

      <div className="ml-auto flex items-center gap-2">
        {/* Org name */}
        {profile?.organization && (
          <span className="text-muted-foreground mr-2 hidden text-sm font-medium md:inline">
            {profile.organization.name}
          </span>
        )}

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Cambiar tema"
          className="rounded-[10px]"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* Notifications */}
        <NotificationBell />

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-full"
            render={<Button variant="ghost" size="icon" className="rounded-full" />}
          >
            <Avatar className="h-8 w-8">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {profile ? getInitials(profile.full_name) : 'US'}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {profile && (
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{profile.full_name}</p>
                <p className="text-muted-foreground text-xs">{profile.role?.name}</p>
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User className="mr-2 h-4 w-4" />
              Mi perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              // Trigger tour replay for the current page
              window.dispatchEvent(new CustomEvent('posty:replay-tour'));
            }}>
              <HelpCircle className="mr-2 h-4 w-4" />
              Ver recorrido
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
