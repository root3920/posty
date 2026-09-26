'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Building2,
  DollarSign,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebarStore } from './sidebar-store';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/equipo', label: 'Equipo', icon: Users },
  { href: '/tareas', label: 'Tareas', icon: CheckSquare },
  { href: '/hotel', label: 'Hotel', icon: Building2 },
  { href: '/finanzas', label: 'Finanzas', icon: DollarSign },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebarStore();

  return (
    <aside
      className={cn(
        'bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full flex-col border-r transition-all duration-300',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold">
          P
        </div>
        {!collapsed && <span className="text-lg font-bold tracking-tight">POSTY</span>}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          const linkElement = (
            <Link
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                collapsed && 'justify-center px-2',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger render={<div />}>{linkElement}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return <div key={item.href}>{linkElement}</div>;
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className="w-full"
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
