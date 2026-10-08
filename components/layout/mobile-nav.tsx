'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
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
  ChevronDown,
  Camera,
  Mail,
  Building,
  Shield,
  UserPlus,
  List,
  Palette,
  Clock,
  ServerCog,
  MapPin,
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
import { HotelLogo } from './hotel-logo';

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
  { href: '/correo', label: 'Correo', icon: Mail, module: 'email' },
  { href: '/instagram', label: 'Instagram', icon: Camera, module: 'instagram' },
  {
    href: '/hotel',
    label: 'Hotel',
    icon: Building2,
    module: 'rooms',
    children: [
      { href: '/hotel', label: 'Resumen', icon: Building2 },
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
      { href: '/configuracion', label: 'Resumen', icon: Settings },
      { href: '/configuracion/empresa', label: 'Empresa', icon: Building },
      { href: '/configuracion/roles', label: 'Roles', icon: Shield },
      { href: '/configuracion/usuarios', label: 'Usuarios', icon: UserPlus },
      { href: '/configuracion/catalogos', label: 'Catálogos', icon: List },
      { href: '/configuracion/horarios', label: 'Horarios', icon: Clock },
      { href: '/configuracion/marca', label: 'Marca', icon: Palette },
      { href: '/configuracion/tareas-automaticas', label: 'Tareas automáticas', icon: CalendarClock },
      { href: '/configuracion/contratos', label: 'Contratos', icon: FileText },
      { href: '/configuracion/espacios', label: 'Espacios', icon: MapPin },
      { href: '/configuracion/regulatorio', label: 'Regulatorio', icon: FileText },
      { href: '/configuracion/facturacion', label: 'Impuestos', icon: FileText },
      { href: '/configuracion/correo', label: 'Correo', icon: Mail },
      { href: '/configuracion/instagram', label: 'Instagram', icon: Camera },
      { href: '/configuracion/sistema', label: 'Sistema', icon: ServerCog },
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

  // Accordion: track which section is expanded (only one at a time)
  // Initial value: the parent that contains the active route
  const activeParentHref = useMemo(() => {
    const activeParent = visibleItems.find(
      (item) => item.children && (
        pathname === item.href ||
        pathname.startsWith(`${item.href}/`) ||
        item.children.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`))
      ),
    );
    return activeParent?.href ?? null;
  }, [pathname, visibleItems]);

  // Reset to active parent each time the menu opens
  const [expandedSection, setExpandedSection] = useState<string | null>(activeParentHref);
  const lastOpenState = useRef(open);
  useEffect(() => {
    if (open && !lastOpenState.current) {
      // Menu just opened
      setExpandedSection(activeParentHref);
    }
    lastOpenState.current = open;
  }, [open, activeParentHref]);

  function handleParentClick(item: NavItem) {
    if (!item.children || item.children.length === 0) {
      // No children — navigate and close
      return; // handled by Link
    }

    // Has children — toggle accordion, do NOT navigate
    setExpandedSection((prev) => (prev === item.href ? null : item.href));
  }

  function handleChildClick() {
    onOpenChange(false);
  }

  function handleLeafClick() {
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-[min(85vw,320px)] p-0 gap-0"
        style={{
          background: 'linear-gradient(180deg, var(--sidebar) 0%, var(--sidebar-darker, #82091b) 100%)',
        }}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b border-white/15 px-4">
          <HotelLogo catSize={28} withText onDark />
          <SheetClose className="ml-auto flex h-8 w-8 items-center justify-center rounded-[10px] text-white/60 transition-colors hover:bg-white/10 hover:text-white" aria-label="Cerrar menú">
            <ChevronRight className="h-4 w-4" />
          </SheetClose>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-4" aria-label="Menú principal">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-[10px] bg-white/10" />
              ))
            : visibleItems.map((item) => {
                const hasChildren = item.children && item.children.length > 0;
                const isExpanded = expandedSection === item.href;
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  || (item.children?.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`)) ?? false);
                const Icon = item.icon;
                const sectionId = `mobile-nav-section-${item.href.replace(/\//g, '-')}`;

                // If parent with children and only 1 visible child, navigate directly
                if (hasChildren && item.children!.length === 1) {
                  return (
                    <Link
                      key={item.href}
                      href={item.children![0].href}
                      onClick={handleLeafClick}
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
                  );
                }

                if (hasChildren) {
                  // Parent with children — button that toggles accordion
                  return (
                    <div key={item.href}>
                      <button
                        type="button"
                        onClick={() => handleParentClick(item)}
                        aria-expanded={isExpanded}
                        aria-controls={sectionId}
                        className={cn(
                          'flex w-full min-h-[44px] items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all duration-150',
                          isActive
                            ? 'bg-white/15 text-white'
                            : 'text-white/78 hover:bg-white/10 hover:text-white',
                        )}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        <span className="flex-1 text-left">{item.label}</span>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 shrink-0 text-white/50 transition-transform duration-200',
                            isExpanded && 'rotate-180',
                          )}
                        />
                      </button>

                      {/* Children accordion */}
                      <div
                        id={sectionId}
                        role="region"
                        className={cn(
                          'overflow-hidden transition-all duration-200 ease-in-out',
                          isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0',
                        )}
                      >
                        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/15 pl-3 pb-1">
                          {item.children!.map((child) => {
                            // For "Resumen" child that matches parent href, use exact match
                            const childActive = child.href === item.href
                              ? pathname === child.href
                              : pathname === child.href || pathname.startsWith(`${child.href}/`);
                            const ChildIcon = child.icon;
                            const badgeCount = child.badgeKey ? badgeCounts[child.badgeKey] ?? 0 : 0;
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={handleChildClick}
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
                      </div>
                    </div>
                  );
                }

                // Leaf item — no children
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleLeafClick}
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
                );
              })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
