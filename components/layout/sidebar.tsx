'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Building2,
  BedDouble,
  CalendarCheck,
  UserRound,
  DollarSign,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  Sparkles,
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
  children?: { href: string; label: string; icon: LucideIcon }[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { href: '/equipo', label: 'Equipo', icon: Users, module: 'team' },
  { href: '/tareas', label: 'Tareas', icon: CheckSquare, module: 'tasks' },
  {
    href: '/hotel',
    label: 'Hotel',
    icon: Building2,
    module: 'rooms',
    children: [
      { href: '/hotel/habitaciones', label: 'Habitaciones', icon: BedDouble },
      { href: '/hotel/reservas', label: 'Reservas', icon: CalendarCheck },
      { href: '/hotel/huespedes', label: 'Huéspedes', icon: UserRound },
    ],
  },
  { href: '/limpieza', label: 'Limpieza', icon: Sparkles, module: 'housekeeping' },
  { href: '/finanzas', label: 'Finanzas', icon: DollarSign, module: 'finance' },
  {
    href: '/configuracion',
    label: 'Configuración',
    icon: Settings,
    module: 'settings',
    children: [
      { href: '/configuracion/automatizaciones', label: 'Automatizaciones', icon: Zap },
    ],
  },
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
        // Hidden on mobile, flex on tablet+
        'hidden md:flex',
        'h-full flex-col transition-all duration-300',
        // md (768-1023): rail mode 72px always
        // lg (1024-1279): collapsed by default (managed by store, starts as false so 240px)
        // xl (1280+): full width
        // The store collapse state controls width:
        collapsed ? 'w-[68px]' : 'md:w-[72px] lg:w-[240px]',
      )}
      style={{
        background: 'linear-gradient(180deg, var(--sidebar) 0%, #82091b 100%)',
      }}
    >
      {/* Logo */}
      <div className={cn(
        'flex h-16 items-center gap-2.5 border-b border-white/15 px-4',
        (collapsed || true) && 'md:justify-center md:px-2 lg:justify-start lg:px-4',
      )}>
        <Image
          src="/brand/posty-cat-white.png"
          alt="POSTY"
          width={30}
          height={30}
          className="shrink-0"
          priority
        />
        <span className={cn(
          'font-heading text-[17px] font-bold tracking-tight text-white',
          // Hide label on collapsed desktop or on tablet (rail mode)
          collapsed ? 'hidden' : 'hidden lg:inline',
        )}>
          POSTY
        </span>
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

              // Rail mode: tablet md-lg always shows icons only
              // Desktop collapsed: icons only
              // Desktop expanded: icons + labels
              const isIconOnly = collapsed;

              const linkElement = (
                <Link
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-white text-[var(--sidebar-primary-foreground)] shadow-sm dark:bg-[#0f0c0d] dark:text-white'
                      : 'text-white/78 hover:bg-white/10 hover:text-white',
                    // Tablet: center icons (rail)
                    'md:justify-center md:px-2.5 lg:justify-start lg:px-3',
                    // Desktop collapsed: center
                    isIconOnly && 'justify-center px-2.5',
                  )}
                  style={isActive ? {
                    color: 'var(--sidebar-primary-foreground)',
                    backgroundColor: 'var(--sidebar-primary)',
                  } : undefined}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className={cn(
                    // Hide label on tablet (rail) and desktop collapsed
                    'hidden lg:inline',
                    isIconOnly && 'lg:hidden',
                  )}>
                    {item.label}
                  </span>
                </Link>
              );

              // Always show tooltip on tablet rail and desktop collapsed
              const showTooltip = isIconOnly;

              if (showTooltip) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger render={<div />}>{linkElement}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <div key={item.href}>
                  {/* Tablet rail: always tooltip */}
                  <Tooltip>
                    <TooltipTrigger render={<div className="lg:contents" />}>
                      {linkElement}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="lg:hidden">{item.label}</TooltipContent>
                  </Tooltip>
                  {/* Sub-navigation (desktop expanded only) */}
                  {item.children && isActive && !isIconOnly && (
                    <div className="ml-4 mt-0.5 hidden space-y-0.5 border-l border-white/15 pl-3 lg:block">
                      {item.children.map((child) => {
                        const childActive = pathname === child.href;
                        const ChildIcon = child.icon;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150',
                              childActive
                                ? 'bg-white/15 text-white'
                                : 'text-white/60 hover:bg-white/8 hover:text-white',
                            )}
                          >
                            <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
      </nav>

      {/* Collapse toggle — only on desktop (lg+) */}
      <div className="hidden border-t border-white/15 p-2.5 lg:block">
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
