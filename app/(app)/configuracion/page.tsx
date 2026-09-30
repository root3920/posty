'use client';

import Link from 'next/link';
import { Building2, Shield, Users, Clock, List, Palette, CalendarClock, FileText, MapPin } from 'lucide-react';

const SETTINGS_SECTIONS = [
  {
    href: '/configuracion/roles',
    label: 'Roles y permisos',
    description: 'Gestiona roles y permisos de acceso',
    icon: Shield,
  },
  {
    href: '/configuracion/usuarios',
    label: 'Usuarios',
    description: 'Invita y gestiona miembros del equipo',
    icon: Users,
  },
  {
    href: '/configuracion/empresa',
    label: 'Empresa',
    description: 'Datos del hotel, moneda, zona horaria',
    icon: Building2,
  },
  {
    href: '/configuracion/horarios',
    label: 'Horarios y turnos',
    description: 'Plantillas de turnos y horarios',
    icon: Clock,
  },
  {
    href: '/configuracion/catalogos',
    label: 'Catálogos',
    description: 'Estados, tipos, categorías',
    icon: List,
  },
  {
    href: '/configuracion/marca',
    label: 'Marca y apariencia',
    description: 'Logo, colores, tema',
    icon: Palette,
  },
  {
    href: '/configuracion/tareas-automaticas',
    label: 'Tareas automáticas',
    description: 'Recorrido del huésped, tareas recurrentes y limpieza',
    icon: CalendarClock,
  },
  {
    href: '/configuracion/contratos',
    label: 'Contratos',
    description: 'Larga estadía: plazos, pagos, depósitos',
    icon: FileText,
  },
  {
    href: '/configuracion/espacios',
    label: 'Espacios para eventos',
    description: 'Precios, horarios y capacidad de cada espacio',
    icon: MapPin,
  },
];

export default function ConfiguracionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground text-sm">Gestiona la configuración de tu hotel</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="hover:bg-muted/50 flex items-start gap-4 rounded-lg border p-4 transition-colors"
            >
              <div className="bg-primary/10 text-primary rounded-lg p-2">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-medium">{section.label}</h3>
                <p className="text-muted-foreground text-xs">{section.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
