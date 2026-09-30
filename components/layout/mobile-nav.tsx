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
  CalendarClock,
  CalendarDays,
  FileText,
  MessageCircle,
  Sparkles,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { useContractKpis } from '@/hooks/use-contracts';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetClose,
} from '@/components/ui/sheet';

interface NavChild {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  module: string;
  children?: NavChild[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { href: '/equipo', label: 'Equipo', icon: Users, module: 'team' },
  { href: '/tareas', label: 'Tareas', icon: CheckSquare, module: 'tasks' },
  { href: '/chat', label: 'Chat', icon: MessageCircle, module: 'chat' },
  {
    href: '/hotel',
    label: 'Hotel',
    icon: Building2,
    module: 'rooms',
    children: [
      { href: '/hotel/habitaciones', label: 'Habitaciones', icon: BedDouble },
      { href: '/hotel/reservas', label: 'Reservas', icon: CalendarCheck },
      { href: '/contratos', label: 'Larga estadía', icon: FileText, badgeKey: 'contracts_alert' },
      { href: '/hotel/huespedes', label: 'Huéspedes', icon: UserRound },
    ],
  },
  { href: '/limpieza', label: 'Limpieza', icon: Sparkles, module: 'housekeeping' },
  { href: '/eventos', label: 'Eventos', icon: CalendarDays, module: 'events' },
  { href: '/finanzas', label: 'Finanzas', icon: DollarSign, module: 'finance' },
  {
    href: '/configuracion',
    label: 'Configuración',
    icon: Settings,
    module: 'settings',
    children: [
      { href: '/configuracion/tareas-automaticas', label: 'Tareas automáticas', icon: CalendarClock },
    ],
  },
];

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const pathname = usePathname();
  const { canViewModule, isLoading } = usePermissions();
  const { data: contractKpis } = useContractKpis();

  const badgeCounts: Record<string, number> = {
    contracts_alert: (contractKpis?.overdue_installments_count ?? 0) + (contractKpis?.expiring_soon ?? 0),
  };

  const visibleItems = isLoading
    ? NAV_ITEMS
    : NAV_ITEMS.filter((item) => canViewModule(item.module));

  function handleNavClick() {
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-[min(85vw,320px)] p-0 gap-0"
        style={{
          background: 'linear-gradient(180deg, var(--sidebar) 0%, #82091b 100%)',
        }}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b border-white/15 px-4">
          <Image
            src="/brand/posty-cat-white.png"
            alt="POSTY"
            width={28}
            height={28}
            className="shrink-0"
            priority
          />
          <span className="font-heading text-[17px] font-bold tracking-tight text-white">
            POSTY
          </span>
          <SheetClose className="ml-auto flex h-8 w-8 items-center justify-center rounded-[10px] text-white/60 transition-colors hover:bg-white/10 hover:text-white" aria-label="Cerrar menú">
            <ChevronRight className="h-4 w-4" />
          </SheetClose>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-4">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-[10px] bg-white/10" />
              ))
            : visibleItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  || (item.children?.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`)) ?? false);
                const Icon = item.icon;

                return (
                  <div key={item.href}>
                    <Link
                      href={item.href}
                      onClick={handleNavClick}
                      className={cn(
                        'flex min-h-[44px] items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'bg-white text-[var(--sidebar-primary-foreground)] shadow-sm dark:bg-[#0f0c0d] dark:text-white'
                          : 'text-white/78 hover:bg-white/10 hover:text-white',
                      )}
                      style={isActive ? {
                        color: 'var(--sidebar-primary-foreground)',
                        backgroundColor: 'var(--sidebar-primary)',
                      } : undefined}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                    {/* Sub-navigation */}
                    {item.children && isActive && (
                      <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/15 pl-3">
                        {item.children.map((child) => {
                          const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
                          const ChildIcon = child.icon;
                          const badgeCount = child.badgeKey ? badgeCounts[child.badgeKey] ?? 0 : 0;
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={handleNavClick}
                              className={cn(
                                'flex min-h-[44px] items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium transition-all duration-150',
                                childActive
                                  ? 'bg-white/15 text-white'
                                  : 'text-white/60 hover:bg-white/8 hover:text-white',
                              )}
                            >
                              <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                              {child.label}
                              {badgeCount > 0 && (
                                <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                  {badgeCount}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
