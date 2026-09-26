'use client';

import { Bell, Search, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Header() {
  const { theme, setTheme } = useTheme();

  return (
    <header className="bg-background flex h-14 items-center gap-4 border-b px-4">
      {/* Search */}
      <div className="relative max-w-md flex-1">
        <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input placeholder="Buscar huésped, habitación, tarea..." className="pl-9" disabled />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Cambiar tema"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" aria-label="Notificaciones" disabled>
          <Bell className="h-4 w-4" />
        </Button>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-full"
            render={<Button variant="ghost" size="icon" className="rounded-full" />}
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">US</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem disabled>Mi perfil</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>Cerrar sesión</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
