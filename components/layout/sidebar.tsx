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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Building,
  Shield,
  UserPlus,
  List,
  Palette,
  Clock,
  ServerCog,
  CalendarClock,
  CalendarDays,
  FileText,
  MapPin,
  MessageCircle,
  Camera,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/use-permissions';
import { useContractKpis } from '@/hooks/use-contracts';
import { useChatUnreadCount } from '@/hooks/use-chat';
import { useSidebarStore } from './sidebar-store';
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
  badgeKey?: string;
  children?: NavChild[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { href: '/equipo', label: 'Equipo', icon: Users, module: 'team' },
  { href: '/tareas', label: 'Tareas', icon: CheckSquare, module: 'tasks' },
  { href: '/chat', label: 'Chat', icon: MessageCircle, module: 'chat', badgeKey: 'chat_unread' },
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
      { href: '/configuracion/instagram', label: 'Instagram', icon: Camera },
      { href: '/configuracion/sistema', label: 'Sistema', icon: ServerCog },
    ],
  },
];

// -------------------------------------------------------
// Floating popover for collapsed sidebar (rail/icon mode)
// -------------------------------------------------------

function FloatingChildMenu({
  item,
  badgeCounts,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  badgeCounts: Record<string, number>;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="min-w-[180px] space-y-0.5 rounded-lg border bg-popover p-1.5 shadow-lg">
      <p className="px-2 py-1 text-xs font-semibold text-foreground">{item.label}</p>
      {item.children?.map((child) => {
        const childActive = child.href === item.href
          ? pathname === child.href
          : pathname === child.href || pathname.startsWith(`${child.href}/`);
        const ChildIcon = child.icon;
        const badgeCount = child.badgeKey ? badgeCounts[child.badgeKey] ?? 0 : 0;
        return (
          <Link
            key={child.href}
            href={child.href}
            onClick={onNavigate}
            className={cn(
              'flex min-h-[36px] items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              childActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
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
  );
}

// -------------------------------------------------------
// Sidebar icon-only item with hover popover
// -------------------------------------------------------

function SidebarIconItem({
  item,
  isActive,
  badgeCounts,
  pathname,
}: {
  item: NavItem;
  isActive: boolean;
  badgeCounts: Record<string, number>;
  pathname: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const Icon = item.icon;
  const hasChildren = item.children && item.children.length > 0;
  const showPopover = hasChildren && (hovered || clicked);

  function handleMouseEnter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setHovered(true);
  }

  function handleMouseLeave() {
    timeoutRef.current = setTimeout(() => {
      setHovered(false);
      setClicked(false);
    }, 150);
  }

  function handleClick() {
    if (hasChildren) {
      setClicked((v) => !v);
    }
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!hasChildren) {
    return (
      <Tooltip>
        <TooltipTrigger render={<div />}>
          <Link
            href={item.href}
            className={cn(
              'group flex items-center justify-center rounded-[10px] px-2.5 py-2.5 transition-all duration-150',
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
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={handleClick}
        aria-expanded={showPopover}
        className={cn(
          'flex w-full items-center justify-center rounded-[10px] px-2.5 py-2.5 transition-all duration-150',
          isActive
            ? 'bg-white/15 text-white'
            : 'text-white/78 hover:bg-white/10 hover:text-white',
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
      </button>

      {/* Floating popover */}
      {showPopover && (
        <div
          className="absolute left-full top-0 z-50 ml-2"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <FloatingChildMenu
            item={item}
            badgeCounts={badgeCounts}
            pathname={pathname}
            onNavigate={() => { setClicked(false); setHovered(false); }}
          />
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------
// Main Sidebar
// -------------------------------------------------------

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebarStore();
  const { canViewModule, isLoading } = usePermissions();
  const { data: contractKpis } = useContractKpis();
  const { data: chatUnread } = useChatUnreadCount();

  const badgeCounts: Record<string, number> = {
    contracts_alert: (contractKpis?.overdue_installments_count ?? 0) + (contractKpis?.expiring_soon ?? 0),
    chat_unread: chatUnread ?? 0,
  };

  const visibleItems = isLoading
    ? NAV_ITEMS
    : NAV_ITEMS.filter((item) => canViewModule(item.module));

  // Desktop expanded: accordion state
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

  const [expandedSection, setExpandedSection] = useState<string | null>(activeParentHref);
  // Sync when route changes
  const prevPathRef = useRef(pathname);
  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname;
      setExpandedSection(activeParentHref);
    }
  }, [pathname, activeParentHref]);

  function toggleSection(href: string) {
    setExpandedSection((prev) => (prev === href ? null : href));
  }

  return (
    <aside
      className={cn(
        'hidden md:flex',
        'h-full flex-col transition-all duration-300',
        collapsed ? 'w-[68px]' : 'md:w-[72px] lg:w-[240px]',
      )}
      style={{
        background: 'linear-gradient(180deg, var(--sidebar) 0%, #82091b 100%)',
      }}
    >
      {/* Logo */}
      <div className={cn(
        'flex h-16 items-center border-b border-white/15 px-4',
        (collapsed || true) && 'md:justify-center md:px-2 lg:justify-start lg:px-4',
      )}>
        {/* On tablet rail (md<lg): no text. On desktop: text unless collapsed */}
        <div className={cn(collapsed ? '' : 'hidden lg:flex')}>
          <HotelLogo catSize={30} withText onDark collapsed={collapsed} />
        </div>
        {/* Tablet rail: logo only */}
        <div className={cn(collapsed ? 'hidden' : 'flex lg:hidden')}>
          <HotelLogo catSize={28} withText={false} onDark collapsed />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-[10px] bg-white/10" />
            ))
          : visibleItems.map((item) => {
              const hasChildren = item.children && item.children.length > 0;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                || (item.children?.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`)) ?? false);
              const Icon = item.icon;
              const isIconOnly = collapsed;
              const isExpanded = expandedSection === item.href;

              // ── Icon-only mode (tablet rail + desktop collapsed) ──
              if (isIconOnly) {
                return (
                  <SidebarIconItem
                    key={item.href}
                    item={item}
                    isActive={isActive}
                    badgeCounts={badgeCounts}
                    pathname={pathname}
                  />
                );
              }

              // ── Tablet rail (md < lg): always icon-only ──
              // This block handles the tablet rail on md breakpoint
              // The icon-only items are shown via CSS, expanded items hidden

              // ── Desktop expanded mode ──

              if (!hasChildren) {
                // Leaf item
                return (
                  <div key={item.href}>
                    {/* Tablet: tooltip wrapper */}
                    <Tooltip>
                      <TooltipTrigger render={<div className="lg:contents" />}>
                        <Link
                          href={item.href}
                          className={cn(
                            'group flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all duration-150',
                            isActive
                              ? 'bg-white text-[var(--sidebar-primary-foreground)] shadow-sm dark:bg-[#0f0c0d] dark:text-white'
                              : 'text-white/78 hover:bg-white/10 hover:text-white',
                            'md:justify-center md:px-2.5 lg:justify-start lg:px-3',
                          )}
                          style={isActive ? {
                            color: 'var(--sidebar-primary-foreground)',
                            backgroundColor: 'var(--sidebar-primary)',
                          } : undefined}
                        >
                          <Icon className="h-[18px] w-[18px] shrink-0" />
                          <span className="hidden lg:inline">{item.label}</span>
                          {item.badgeKey && (badgeCounts[item.badgeKey] ?? 0) > 0 && (
                            <span className="ml-auto hidden h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white lg:flex">
                              {badgeCounts[item.badgeKey]}
                            </span>
                          )}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="lg:hidden">{item.label}</TooltipContent>
                    </Tooltip>
                  </div>
                );
              }

              // Parent with children — accordion toggle
              const sectionId = `sidebar-section-${item.href.replace(/\//g, '-')}`;

              return (
                <div key={item.href}>
                  {/* Tablet: tooltip + icon-only link */}
                  <div className="lg:hidden">
                    <SidebarIconItem
                      item={item}
                      isActive={isActive}
                      badgeCounts={badgeCounts}
                      pathname={pathname}
                    />
                  </div>

                  {/* Desktop: accordion button */}
                  <button
                    type="button"
                    onClick={() => toggleSection(item.href)}
                    aria-expanded={isExpanded}
                    aria-controls={sectionId}
                    className={cn(
                      'hidden w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all duration-150 lg:flex',
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

                  {/* Desktop: children accordion */}
                  <div
                    id={sectionId}
                    className={cn(
                      'hidden overflow-hidden transition-all duration-200 ease-in-out lg:block',
                      isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0',
                    )}
                  >
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/15 pl-3 pb-1">
                      {item.children!.map((child) => {
                        const childActive = child.href === item.href
                          ? pathname === child.href
                          : pathname === child.href || pathname.startsWith(`${child.href}/`);
                        const ChildIcon = child.icon;
                        const badgeCount = child.badgeKey ? badgeCounts[child.badgeKey] ?? 0 : 0;
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
