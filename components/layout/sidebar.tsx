'use client';

import Link from 'next/link';
import Image from 'next/image';
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
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/use-permissions';
import { useSidebarStore } from './sidebar-store';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  module: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { href: '/equipo', label: 'Equipo', icon: Users, module: 'team' },
  { href: '/tareas', label: 'Tareas', icon: CheckSquare, module: 'tasks' },
  { href: '/hotel', label: 'Hotel', icon: Building2, module: 'rooms' },
  { href: '/finanzas', label: 'Finanzas', icon: DollarSign, module: 'finance' },
  { href: '/configuracion', label: 'Configuración', icon: Settings, module: 'settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebarStore();
  const { canViewModule, isLoading } = usePermissions();

  const visibleItems = isLoading
    ? NAV_ITEMS
    : NAV_ITEMS.filter((item) => canViewModule(item.module));

  return (
    <aside
      className={cn(
        'flex h-full flex-col transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-[240px]',
      )}
      style={{
        background: 'linear-gradient(180deg, var(--sidebar) 0%, #82091b 100%)',
      }}
    >
      {/* Logo */}
      <div className={cn(
        'flex h-16 items-center gap-2.5 border-b border-white/15 px-4',
        collapsed && 'justify-center px-2',
      )}>
        <Image
          src="/brand/posty-cat-white.png"
          alt="POSTY"
          width={30}
          height={30}
          className="shrink-0"
          priority
        />
        {!collapsed && (
          <span className="font-heading text-[17px] font-bold tracking-tight text-white">
            POSTY
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2.5 py-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-[10px] bg-white/10" />
            ))
          : visibleItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              const linkElement = (
                <Link
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-white text-[var(--sidebar-primary-foreground)] shadow-sm dark:bg-[#0f0c0d] dark:text-white'
                      : 'text-white/78 hover:bg-white/10 hover:text-white',
                    collapsed && 'justify-center px-2.5',
                  )}
                  style={isActive ? {
                    color: 'var(--sidebar-primary-foreground)',
                    backgroundColor: 'var(--sidebar-primary)',
                  } : undefined}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
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
      <div className="border-t border-white/15 p-2.5">
        <button
          onClick={toggle}
          className="flex w-full items-center justify-center rounded-[10px] p-2 text-white/60 transition-all duration-150 hover:bg-white/10 hover:text-white"
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
