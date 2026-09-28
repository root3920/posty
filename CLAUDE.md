# POSTY — Gestión Hotelera SaaS

> **Fuente de verdad**: `POSTY_SPEC.md` en la raíz del proyecto.

## Stack

- **Framework**: Next.js 16.3.6 (App Router, TypeScript strict)
- **Auth & DB**: Supabase (Postgres + RLS + Auth + Storage + Realtime)
- **UI**: Tailwind CSS 4 + shadcn/ui + lucide-react + framer-motion + sonner
- **Gráficas**: Recharts
- **Kanban**: @dnd-kit
- **Fechas**: date-fns (locale `es`)
- **Formularios**: react-hook-form + zod
- **Estado**: TanStack Query (datos), Zustand (UI)
- **Tablas**: TanStack Table
- **Testing**: Vitest + Playwright
- **Deploy**: Vercel

## Convenciones

- **DB**: snake_case para tablas y columnas
- **TS**: camelCase para variables/funciones, PascalCase para componentes/tipos
- **UI**: Todo en español
- **Código**: Todo en inglés (nombres de tablas, columnas, variables)
- **Montos**: `numeric(14,2)` en DB, nunca `float`. Formatear con `Intl.NumberFormat`
- **Fechas**: `timestamptz` en UTC. "Hoy" se calcula con la zona horaria de la organización (default `America/Bogota`)
- **IDs**: uuid. Las personas se referencian siempre por id, nunca por nombre
- **Dropdowns**: Todo dropdown que use IDs usa `EntitySelect` (`components/shared/entity-select.tsx`). Nunca mostrar UUIDs al usuario. `<SelectValue>` de Base UI muestra el valor crudo si las opciones no han cargado — por eso EntitySelect renderiza la etiqueta manualmente. Solo usar `<Select>` directo para enums hardcoded (prioridad, moneda, estado de limpieza)
- **Visualización de datos**: Nunca mostrar IDs (ni completos ni cortados) al usuario. Las listas leen de vistas `*_view` (`stays_view`, `tasks_view`, `expenses_view`, `rooms_view`, `other_revenue_view`) con nombres legibles. Usar los componentes `RoomBadge`, `GuestName`, `ProfileChip` y `CatalogBadge` de `components/shared/`
- **Borrado**: Soft delete (`archived_at`) en catálogos
- **Migraciones**: Solo vía `supabase/migrations/`. Nunca SQL Editor manual. NUNCA usar `supabase migration repair --status applied` sin antes confirmar con `npm run db:verify` que el SQL existe en la base
- **Verificación de esquema**: Después de cada `db push`, correr `npm run db:verify` para detectar migraciones "registradas pero no ejecutadas"
- **Enum casts**: SIEMPRE usar casts explícitos al asignar texto a columnas enum en PL/pgSQL (e.g. `'clean'::housekeeping_status`, `'scheduled'::cleaning_status`). Nunca asignar texto crudo a un enum
- **Tipos**: Regenerar con `npm run db:types` después de cada migración
- **RLS**: Toda tabla con `organization_id` tiene RLS activado + políticas
- **Clientes Supabase**: Nunca instanciados a nivel de módulo en código server
- **Rutas públicas**: Definidas en `lib/auth/public-routes.ts` (único array)

## Estructura de carpetas

```
app/
  (auth)/login, registro         ← Páginas públicas de auth
  auth/callback, auth/setup      ← Route handlers de auth
  (app)/layout.tsx               ← Layout protegido (Sidebar + Header)
  (app)/dashboard                ← Dashboard principal
  (app)/equipo                   ← Módulo Equipo
  (app)/tareas                   ← Módulo Tareas
  (app)/hotel                    ← Módulo Hotel
  (app)/limpieza                 ← Módulo Limpieza (Housekeeping)
  (app)/finanzas                 ← Módulo Finanzas
  (app)/configuracion            ← Configuración
components/
  ui/                            ← Componentes shadcn/ui
  layout/                        ← Sidebar, Header, stores
  providers/                     ← ThemeProvider, QueryProvider
lib/
  supabase/client.ts             ← Browser client
  supabase/server.ts             ← Server client (cookies)
  supabase/admin.ts              ← Service role (factory, solo server)
  auth/public-routes.ts          ← Rutas públicas
  format.ts                      ← Formateo de moneda/números
  dates.ts                       ← Utilidades de fecha con timezone
  utils.ts                       ← cn() helper
  validations/                   ← Schemas Zod compartidos
hooks/                           ← React hooks personalizados
types/database.ts                ← Tipos generados por Supabase CLI
supabase/
  config.toml                    ← Config Supabase local
  migrations/                    ← Migraciones SQL versionadas
  seed.sql                       ← Datos demo
proxy.ts                         ← Middleware (Next.js 16 soporta proxy.ts)
```

## Comandos

| Comando | Descripción |
|---|---|
| `npm run dev` | Dev server con Turbopack |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Vitest |
| `npm run test:e2e` | Playwright |
| `npm run db:types` | Regenerar tipos de DB |
| `npm run db:reset` | Reset DB local |

## Definiciones de negocio

- **Pendientes hoy**: tareas asignadas al empleado, estado tipo `open` o `in_progress`, con `due_date` = hoy
- **Vencidas**: `due_date` < hoy y no completadas (se muestran aparte, no se mezclan con pendientes)
- **Completadas hoy**: tareas con `completed_at` dentro del día de hoy (zona de la organización)

## Modelo de datos

Se implementa en Fase 1. Ver `POSTY_SPEC.md` secciones 4-9.

## Decisiones

| # | Decisión | Motivo |
|---|---|---|
| D1 | Usar `proxy.ts` (Next.js 16 lo soporta como `PROXY_FILENAME`) | La spec lo sugiere; confirmado en las constantes de Next.js 16 |
| D2 | `@types/node@22` en vez de `@20` | Requerido por Vitest 5 |
| D3 | Color primario default: usar el tema neutro de shadcn | El color lo elige cada hotel en Configuración (Fase 7) |
| D4 | `lang="es"` en el root HTML | UI toda en español per spec |

## Lecciones aprendidas (del CRM HIC — no repetir)

1. Todo cambio de esquema → archivo en `supabase/migrations/`
2. Nada de "falso éxito" — verificar `error` de Supabase siempre
3. RLS en toda tabla con `organization_id`
4. Clientes Supabase dentro de funciones, no a nivel de módulo
5. Rutas públicas en un único array
6. Paginación/agregación SQL para listas grandes (límite 1000)
7. Personas referenciadas por ID, nunca por nombre
8. Huéspedes: índice único por `(org_id, document_type, document_number)`
9. Zonas horarias: `timestamptz` UTC, calcular "hoy" con timezone de la org
10. Secretos en `.gitignore` desde el primer commit
11. Cada migración nueva se aplica con `npx supabase db push` y se confirma con `npx supabase migration list` antes de entregar. Nunca dejar migraciones sin aplicar.
12. No duplicar timestamps de migración — verificar con `ls supabase/migrations/` antes de crear

## Fase actual: 7 (Dashboard + Config + Seed) ✅ — TODAS LAS FASES COMPLETADAS

## Estado de fases

- [x] Fase 0: Setup — Next.js, Supabase, shadcn, Tailwind
- [x] Fase 1: Base de datos — migraciones, RLS, seed_organization_defaults
- [x] Fase 2: Auth — login, registro, onboarding, roles dinámicos
- [x] Fase 3: Módulo Equipo — perfiles, turnos, disponibilidad
- [x] Fase 4: Módulo Tareas — Kanban, asignaciones, actividad
- [x] Fase 5: Módulo Hotel — habitaciones, huéspedes, estancias, folio
- [x] Fase 6: Módulo Finanzas — ingresos, gastos, P&G, presupuesto
- [x] Fase 7: Dashboard principal, configuración completa, seed demo

## Sistema de diseño

### Tipografía
- **Títulos, KPIs, nombre POSTY**: Outfit (500/600/700) → `font-heading`
- **Texto de interfaz**: Plus Jakarta Sans (400/500/600) → `font-sans`
- Cargadas con `next/font/google`, variables CSS `--font-outfit` y `--font-plus-jakarta`
- Todos los números en tablas, KPIs y montos usan `tabular-nums`

### Colores de marca
- Color principal: `#9c0b21` (vino) — configurable por hotel en `organizations.brand_color`
- Escala brand-50 a brand-900 como tokens en `globals.css`
- Modo claro: fondo `#f8f6f5`, tarjetas `#ffffff`, bordes `#ece7e5`
- Modo oscuro: fondo `#0f0c0d`, tarjetas `#1a1617`, bordes `#2e2728`
- Estados: success `#16a34a`, warning `#d97706`, danger `#dc2626`, info `#2563eb`

### Sidebar
- Fondo vino con degradado sutil (`--sidebar` → `#82091b`)
- Texto blanco al 78%, hover blanco al 10%, activo: blanco (día) / negro (noche)
- Logo: siempre el gato blanco sobre vino

### Radio de bordes
- Base: `--radius: 10px` para botones, inputs, tarjetas, dialogs, etc.
- Badges/avatares: `rounded-full`
- Checkboxes: `6px`

### Sombras
- Sistema de elevación: shadow-xs → shadow-xl + shadow-brand
- Tinte cálido `rgba(28,21,23,...)`, no gris
- Dark mode: borde `#2e2728` + brillo interior sutil

### Logo e íconos
- `public/brand/posty-cat-white.png` — sobre fondos oscuros/vino
- `public/brand/posty-cat-black.png` — sobre fondos claros
- Componente `<PostyLogo variant="auto|white|black" withText size />`
- **Favicon/íconos** (convención de archivos App Router, generan `<link>` automáticos):
  - `app/favicon.ico` — favicon clásico
  - `app/icon.svg` — favicon SVG
  - `app/apple-icon.png` — Apple touch icon 180×180
  - `public/icons/android-chrome-{192,512}x{192,512}.png` — PWA
  - `app/manifest.ts` — Web App Manifest (reemplaza site.webmanifest)
- **Fuente de diseño**: `design/brand/isotipo_gato/` (archivos originales)
- Para reemplazar íconos: editar los archivos en `design/brand/isotipo_gato/`, copiar a `app/` y `public/icons/`

### Componente EntitySelect
- `components/shared/entity-select.tsx` — Select que siempre muestra la etiqueta
- Usado en vez del Select nativo de shadcn para campos con IDs (UUIDs)

## Responsive

### Breakpoints
- Mobile: < 768px · Tablet vertical: 768–1023px · Tablet horizontal: 1024–1279px · Desktop: ≥ 1280px
- Márgenes: 16px mobile, 24px tablet, 32px desktop (clase `page-px`)
- Ancho máximo: 1440px centrado

### Navegación
- Mobile: hamburger + Sheet drawer (vino, 85vw max 320px) + MobileHeader (56px sticky)
- Tablet vertical: sidebar riel 72px (solo íconos)
- Tablet horizontal: sidebar colapsado, expandible
- Desktop: sidebar completo 240px

### Componentes responsive obligatorios
- **`ResponsiveDialog`**: Dialog en desktop, bottom Sheet en mobile (sticky header/footer, safe-area)
- **`ResponsiveTable`**: tabla con sticky first col en desktop, tarjetas en mobile (via `renderCard`)
- **`PageHeader`**: título fluido, acciones ocultas en mobile (usa FAB)
- **`FilterBar`**: inline en desktop, bottom sheet "Filtros (N)" en mobile
- **`KPIGrid`**: CSS grid auto-fill con container queries, min 2 cols mobile
- **`FAB`**: botón flotante para acción principal, solo mobile

### Reglas de formularios
- 1 columna mobile, 2 columnas desde `sm:` (640px)
- Todos los hijos de grid: `min-w-0`
- Touch target: `min-h-[44px]` en mobile
- Font-size inputs: 16px mínimo en mobile (iOS zoom prevention via CSS)
- Usar `ResponsiveDialog` para formularios, nunca Dialog directo
- Viewport: `width=device-width`, `viewportFit: 'cover'`, dvh para alturas

## TODO futuro
- [ ] Exportación TRA/SIRE (regulatorio colombiano)
- [ ] Notificaciones en tiempo real (Supabase Realtime)
- [ ] App móvil (React Native / Expo)
- [ ] Integración OTAs (Booking, Expedia) vía channel manager
- [ ] Reportes avanzados PDF/Excel

## Decisiones adicionales (Fase 7)

| # | Decisión | Motivo |
|---|---|---|
| D5 | Dashboard usa framer-motion `stagger` con `containerVariants` / `cardVariants` | Entrada visual atractiva sin dependencias extra |
| D6 | Catálogos: componente genérico `CatalogTab` con prop `def: CatalogDef` | Evita 10 páginas/componentes idénticos |
| D7 | `seed.sql` usa `set session_replication_role = replica` para bypass RLS | Solo para entorno demo local; nunca producción |
| D8 | Configuración empresa: `react-hook-form + zod` con `setValue` para Selects | Consistente con el resto del proyecto |
| D9 | Dashboard team KPIs calculados en cliente desde hook + `calculateAvailability` | Reutiliza la lógica ya testeada del módulo Equipo |
