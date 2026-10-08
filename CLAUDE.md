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
- **Formularios**: Antes de crear cualquier formulario nuevo, usar `ResponsiveDialog` (nunca Dialog/Sheet directo), `PhoneInput` (nunca `type="tel"`), `TimeSelect` (nunca `type="time"`), `EntitySelect` y `lib/format.ts`. Las reglas de ESLint lo verifican
- **Teléfonos visibles**: Todo teléfono en la interfaz se muestra con `ContactActions` (`components/shared/contact-actions.tsx`): ícono WhatsApp (abre chat en POSTY), llamar (tel:), copiar
- **Dropdowns**: Todo dropdown que use IDs usa `EntitySelect` (`components/shared/entity-select.tsx`). Nunca mostrar UUIDs al usuario. `<SelectValue>` de Base UI muestra el valor crudo si las opciones no han cargado — por eso EntitySelect renderiza la etiqueta manualmente. Solo usar `<Select>` directo para enums hardcoded (prioridad, moneda, estado de limpieza)
- **Visualización de datos**: Nunca mostrar IDs (ni completos ni cortados) al usuario. Las listas leen de vistas `*_view` (`stays_view`, `tasks_view`, `expenses_view`, `rooms_view`, `other_revenue_view`) con nombres legibles. Usar los componentes `RoomBadge`, `GuestName`, `ProfileChip` y `CatalogBadge` de `components/shared/`
- **Borrado**: Soft delete (`archived_at`) en catálogos
- **Migraciones**: Solo vía `supabase/migrations/`. Nunca SQL Editor manual. NUNCA usar `supabase migration repair --status applied` sin antes confirmar con `npm run db:verify` que el SQL existe en la base
- **Verificación de esquema**: Después de cada `db push`, correr `npm run db:verify` para detectar migraciones "registradas pero no ejecutadas"
- **Links internos**: Todo href o Link debe apuntar a una ruta que exista (tiene page.tsx). Antes de cada entrega, verificar con grep que ningún link apunte a una ruta sin página. La app tiene not-found.tsx global y dentro de (app) para evitar la página blanca de Next.js
- **Enum casts**: SIEMPRE usar casts explícitos al asignar texto a columnas enum en PL/pgSQL (e.g. `'clean'::housekeeping_status`, `'scheduled'::cleaning_status`). Nunca asignar texto crudo a un enum
- **Errores de Supabase**: Nunca convertir un error en un estado vacío (`if (error) return []`). Las funciones de fetch deben lanzar el error (`if (error) throw error`); React Query lo captura en su estado `error` y los componentes lo muestran. Solo las funciones de auth (profile, permissions) pueden devolver null en caso de error
- **Procesos programados**: Usar `pg_cron` (dentro de Postgres) en vez de crons de Vercel. Los jobs se registran en migraciones con `cron.schedule()`. Visible en Configuración → Sistema. Después de cada `db push`, verificar que los jobs siguen activos con `db:verify`
- **Tareas recurrentes**: `process_recurring_tasks()` (pg_cron cada minuto) crea tareas normales a partir de `recurring_tasks`. Idempotente por `(recurring_task_id, occurrence_date)`. Soporta: diario, semanal, mensual (día 31 → último día del mes), cada N días. Configuración en `/configuracion/tareas-automaticas`
- **Permisos nuevos**: Toda migración que agregue permisos nuevos (`INSERT INTO permissions`) DEBE también asignarlos a los roles de las organizaciones EXISTENTES (Gestor=todos, Recepción=subset, demás=view). Usar `ON CONFLICT DO NOTHING` para idempotencia. No basta con agregarlos en `seed_organization_defaults` (que solo corre para orgs nuevas)
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
  (app)/chat                     ← Módulo Chat (WhatsApp)
  (app)/correo                   ← Módulo Correo (Email Inbox)
  (app)/hotel                    ← Módulo Hotel
  (app)/limpieza                 ← Módulo Limpieza (Housekeeping)
  (app)/eventos                  ← Módulo Eventos (alquiler de espacios)
  (app)/finanzas                 ← Módulo Finanzas
  (app)/contratos                ← Módulo Contratos de Larga Estadía
  (app)/configuracion            ← Configuración (incluye tareas-automaticas, contratos, espacios, whatsapp)
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

## Fase actual: Contratos de Larga Estadía — Entrega 1 ✅

## Estado de fases

- [x] Fase 0: Setup — Next.js, Supabase, shadcn, Tailwind
- [x] Fase 1: Base de datos — migraciones, RLS, seed_organization_defaults
- [x] Fase 2: Auth — login, registro, onboarding, roles dinámicos
- [x] Fase 3: Módulo Equipo — perfiles, turnos, disponibilidad
- [x] Fase 4: Módulo Tareas — Kanban, asignaciones, actividad
- [x] Fase 5: Módulo Hotel — habitaciones, huéspedes, estancias, folio
- [x] Fase 6: Módulo Finanzas — ingresos, gastos, P&G, presupuesto
- [x] Fase 7: Dashboard principal, configuración completa, seed demo
- [x] Contratos E1: Precios LE, wizard 4 pasos, cuotas con prorrateo, pagos, depósito, sección /contratos, detalle, config
- [x] Hotel E1: Sidebar LE bajo Hotel con badge, acciones en TODAS las filas, columna Modalidad, audit_log, editar/cambiar/extender/cancelar reserva
- [x] Hotel E2: Conversión de modalidad (corta ↔ larga), guest_snapshot, visits, nota crédito retroactiva
- [x] Hotel E3: Fusionar huéspedes, cambiar titular, historial audit_log, stats de huésped, detección duplicados
- [x] Eventos: Alquiler de espacios, reservas con detección de cruces, depósitos, calendario semanal, tareas automáticas
- [x] Chat F0: Provider layer + Evolution API, webhook, conexión QR, chat mínimo de prueba
- [x] Chat F1: Sección Chat completa (Realtime, filtros, medios, notas internas, asignación, quick replies, badge no leídos)
- [x] Chat F2: Contexto del huésped (panel derecho), ContactActions, GuestContextPanel
- [x] Chat F3: Rate limiting (20/min, 300/h, 5 sin respuesta), primer contacto, errores en español
- [x] Chat: Session lifecycle — sesión aislada por conexión, sin importar historial, desconexión limpia con archivado de huéspedes
- [x] ContactActions en PhoneDisplay + eventos. Ficha huésped: pestaña Chat con archivados. wa.me sin country code hardcoded
- [x] Contratos E2: Otrosí, renovación, terminación con liquidación, envío para firma, documentos
- [x] Email Fase A: Buzón de entrada, separación de remitentes, alias por hotel, recepción inbound, hilos, UI 3 columnas, admin panel

## Módulo Contratos de Larga Estadía

- **Tablas**: `contracts`, `contract_installments`, `contract_payments`
- **Enums**: `stay_type`, `contract_status`, `billing_cycle`, `installment_status`
- **Columnas nuevas**: `room_types.monthly_rate/weekly_rate/biweekly_rate`, `stays.stay_type/contract_id`, `organizations.contract_*`
- **Vista**: `contracts_view` (join con guest, room, room_type, resumen de cuotas)
- **Funciones**: `create_contract_with_stay`, `generate_contract_installments`, `register_contract_payment`, `register_deposit_payment`, `available_rooms_for_contract`, `available_rooms_of_type_for_period`, `get_contract_kpis`
- **Permisos**: `contracts.view`, `contracts.create`, `contracts.edit`, `contracts.terminate`, `contracts.payments`
- **Cuotas**: Se generan con prorrateo del primer y último período. El pago soporta parciales y excedentes que se aplican a la siguiente cuota
- **Depósito**: Se registra como pasivo (no ingreso). Estado: pending/paid/partial/returned/applied
- **Estancia bloqueada**: Cada contrato crea una estancia `stay_type='long_stay'` que bloquea la habitación por el anti-double-booking constraint

## audit_log y Acciones de Reservas

- **audit_log**: Tabla genérica con triggers automáticos en stays, guests, contracts. Columnas: entity_type, entity_id, action, before/after jsonb, actor_id, reason
- **Columnas nuevas**: `stays.visit_id`, `stays.guest_snapshot`, `stays.converted_from_stay_id`, `contracts.guest_snapshot`, `contracts.origin_stay_id`, `guests.archived_at`
- **Funciones de edición**: `update_stay`, `cancel_stay`, `change_stay_room`, `extend_shorten_stay`, `snapshot_guest_data`, `get_audit_log`
- **Sidebar**: "Larga estadía" es child de Hotel con badge rojo (cuotas vencidas + contratos por vencer)
- **Reservas**: columna "Modalidad" (Corta/Larga estadía), chip de filtro "Larga estadía", menú "⋯" en TODAS las filas con acciones según estado
- **Componentes de acción**: StayActionsMenu, EditStayDialog, ChangeRoomDialog, ExtendStayDialog, CancelStayDialog

## Módulo Eventos (Alquiler de Espacios)

- **Tablas**: `event_venues`, `event_bookings`, `event_booking_history`
- **Enums**: `venue_pricing_type` (per_hour/per_person/flat_rate), `event_booking_status` (pending_deposit/confirmed/finished/cancelled), `event_deposit_status` (pending/received/returned/retained)
- **Vista**: `event_bookings_view` (join con venue + creator profile)
- **Funciones**: `create_event_booking` (valida cruces con FOR UPDATE, calcula total, crea tareas de limpieza), `cancel_event_booking`, `register_event_deposit`, `mark_event_rental_paid`, `finalize_event_booking`, `return_event_deposit`, `retain_event_deposit`, `get_event_kpis`, `get_venue_bookings_for_date`
- **Permisos**: `events.view`, `events.create`, `events.edit`, `events.delete`, `events.manage_deposits`
- **Cruces horarios**: Validados en la función SQL con `FOR UPDATE` — error descriptivo con código y nombre del booking que choca
- **Precio snapshot**: El precio y depósito se copian del espacio al crear la reserva; cambiar el espacio no afecta reservas existentes
- **Tareas automáticas**: Al confirmar, crea "Preparar espacio" (1h antes) y "Limpiar después" (al terminar). Al cancelar, cancela las tareas vinculadas
- **3 tabs**: Reservas (tabla + filtros), Calendario semanal (grid espacios × días), Espacios (tarjetas con switch activo/inactivo)
- **WhatsApp**: Botón "Enviar por WhatsApp" con wa.me link y mensaje prellenado

## Módulo Chat (WhatsApp)

- **Arquitectura**: Evolution API (Railway, Docker) → webhook → POSTY (Vercel) → Supabase. POSTY es fuente de verdad de los chats
- **Provider layer**: `lib/whatsapp/types.ts` (interfaz), `lib/whatsapp/evolution-provider.ts` (implementación v2.3), `lib/whatsapp/provider.ts` (factory). La UI nunca llama a Evolution directo
- **Tablas**: `whatsapp_connections`, `whatsapp_webhook_logs` (raw capture), `chat_conversations`, `chat_messages`
- **API routes**: `/api/webhooks/whatsapp` (pública), `/api/whatsapp/{connect,qr,status,send,disconnect}` (autenticadas)
- **Webhook**: raw capture ANTES de validar, idempotente por external_id, siempre 200
- **Permisos**: `chat.view`, `chat.view_all`, `chat.send`, `chat.assign`, `chat.manage_connection`
- **Variables de entorno**: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `WHATSAPP_WEBHOOK_SECRET`
- **Conexión**: QR escaneado desde /configuracion/whatsapp. Estado visible en /chat

## Módulo Correo (Email Inbox — Fase A)

- **Arquitectura**: Resend (envío + recepción) → webhook `/api/webhooks/resend` → Supabase. Dos remitentes separados para proteger reputación
- **Remitente sistema**: `POSTY <noreply@postyassistant.com>` — para registro, invitaciones, contraseña
- **Remitente hotel**: `"Hotel Sol" <hotel-sol@hoteles.postyassistant.com>` — para correos a huéspedes
- **Reply-To con token**: `alias+threadToken@hoteles.postyassistant.com` — para que las respuestas caigan en el hilo correcto
- **Tablas**: `email_aliases` (alias por org), `email_threads` (hilos), `email_messages` (extendida con threading + inbound), `email_webhook_events` (idempotencia), `email_suppressions` (rebotes/quejas)
- **Columnas nuevas en email_messages**: `thread_id`, `direction` (in/out), `message_id`, `in_reply_to`, `references_header`, `from_address`, `cc`, `html_sanitized`, `attachments` (jsonb), `raw_payload`
- **Columnas nuevas en organizations**: `email_forward_inbound`, `email_paused`
- **API routes**: `/api/webhooks/resend` (extendida con `email.received`), `/api/email/{reply,compose,alias,attachments,admin}`
- **Funciones RPC**: `get_email_unread_count`, `mark_email_thread_read`, `assign_email_thread`, `set_email_thread_status`, `get_email_platform_stats`
- **Permisos**: `email.view`, `email.send`, `email.manage`
- **Variables de entorno**: `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET`, `EMAIL_HOTEL_DOMAIN` (default `hoteles.postyassistant.com`)
- **Storage**: bucket privado `email-attachments` (10MB/archivo, 25MB/correo, bloquea ejecutables)
- **Lib**: `lib/email/sanitize.ts` (HTML seguro), `lib/email/anti-loop.ts` (prevención de bucles), `lib/email/alias.ts` (generación/validación), `lib/email/thread-resolver.ts` (resolución de hilos con 4 estrategias), `lib/email/pause-check.ts`
- **Hooks**: `hooks/use-email-inbox.ts` (14 hooks: threads, messages, unread, realtime, reply, compose, assign, status, link guest, alias)
- **UI**: `/correo` (3 columnas como Chat), Configuración → Correo (alias + reenvío), ficha huésped tab "Correos" con hilos
- **Resolución de hilos**: 1) +token en dirección, 2) In-Reply-To/References, 3) email del remitente = huésped, 4) hilo nuevo
- **Seguridad**: HTML sanitizado (sin scripts/forms/iframes/eventos), imágenes externas bloqueadas por defecto, sandbox iframe
- **Anti-loop**: Auto-Submitted, Precedence bulk, X-Posty-*, X-Auto-Response-Suppress
- **Auto-pausa**: rebotes >5% o quejas >0.1% en 30 días → `email_paused=true`, visible en Configuración → Sistema
- **Rate limits inbound**: 200/org/hora, 30/sender/hora
- **Alias**: 3-40 chars, minúsculas+números+guiones, palabras reservadas bloqueadas, cambio con gracia de 90 días
- **Reenvío**: copia al `contact_email` del hotel con aviso "Responde desde POSTY", header `X-Posty-Forwarded`
- **Realtime**: habilitado en `email_threads` y `email_messages`

## Publicador automático de Instagram (Fase 3)

- **Cron**: pg_cron `instagram-publish` cada minuto → pg_net llama `/api/cron/instagram-publish` con `CRON_SECRET` desde Supabase Vault
- **Máquina de estados**: `draft → scheduled → processing → published | failed`. Desde `failed` puede ir a `scheduled` (retry) o `canceled`. Desde `draft/scheduled/failed` puede ir a `canceled`
- **Claim**: `claim_due_instagram_posts(p_limit)` usa `FOR UPDATE SKIP LOCKED` para evitar duplicados entre corridas concurrentes
- **Contenedor**: Se crea al momento de publicar (no al programar) porque vence en 24h. Se guarda `container_id` inmediatamente
- **Idempotencia**: Si un post ya tiene `ig_media_id`, nunca se vuelve a publicar
- **Reintentos**: Hasta 3, con espera de 2, 10 y 30 min, solo para errores temporales (red, 5xx, rate limit). Errores permanentes (token, permisos, formato) van directo a `failed`
- **Stuck recovery**: `unstick_instagram_posts()` detecta posts en `processing` por >10 min sin `ig_media_id`
- **Heartbeat**: `instagram_publisher_heartbeat` (singleton row) se escribe cada corrida. El frontend muestra indicador verde/rojo
- **Desconexión**: Trigger `trg_ig_disconnect_move_to_draft` mueve programados a borrador al desconectar
- **Timezone**: Todo scheduling usa `lib/datetime-tz.ts` (`hotelLocalToUtc` / `utcToHotelLocal`). La zona del hotel (organizations.timezone) es la referencia, nunca la del navegador
- **Columnas nuevas**: `instagram_posts.children_container_ids`, `last_error_code`, `locked_at`, `next_attempt_at`
- **Tabla nueva**: `instagram_publisher_heartbeat` (id=1 singleton)
- **Funciones nuevas**: `claim_due_instagram_posts`, `unstick_instagram_posts`, `on_instagram_disconnect`
- **Variables de entorno**: `CRON_SECRET` (en Vercel y en Supabase Vault)
- **Ruta pública**: `/api/cron` ya está en `public-routes.ts`
- **UI**: 3 pestañas en `/instagram`: Grilla (con programados arriba, borde punteado), Programados (lista + filtros + acciones), Calendario (mes/semana)

## Estadísticas de Instagram (Fase A)

- **Permiso nuevo**: `instagram_business_manage_insights` en el scope de OAuth. Columna `granted_scopes text[]` en `instagram_connections`
- **Tablas**: `instagram_account_insights_daily` (métricas diarias por cuenta), `instagram_follower_snapshots` (foto diaria de seguidores), `instagram_media_insights` (métricas por post)
- **Permiso POSTY**: `instagram.view_insights` (Gestor y Mercadeo por defecto)
- **Métricas**: Definidas en `lib/instagram/insights-metrics.ts` — archivo único a editar si Meta cambia métricas
- **API client**: `getAccountInsights`, `getMediaInsights`, `getFollowerDemographics` en `lib/instagram/client.ts`
- **API routes**: `/api/instagram/insights` (GET: leer, POST: refrescar últimos 3 días), `/api/cron/instagram-insights` (cron diario 3AM)
- **Cron**: `instagram-insights-daily` (pg_cron 0 3 * * *) re-fetch últimos 3 días con upsert (retraso 48h de Instagram)
- **UI**: Botón "Estadísticas" en `/instagram`, modal `ResponsiveDialog size="2xl"` con tabs Resumen/Audiencia/Publicaciones/Historias
- **Resumen**: KPI cards (14 métricas + engagement rate) + 4 gráficas (alcance diario, seguidores, seg/no-seg, por tipo de contenido)
- **Reconexión**: Si falta el scope de insights, el modal muestra aviso con botón "Reconectar"
- **Datos vacíos**: null → "Sin datos", nunca 0. Los datos de los últimos 2 días pueden estar incompletos
- **Ventanas de 30 días**: La API de Instagram limita a 30 días por consulta; `splitInto30DayWindows` parte rangos largos

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
- [x] TRA/SIRE: campos regulatorios, API MinCIT, generador SIRE, envío desde check-in, config RNT
- [x] Impuestos y recibos: IVA alojamiento, ICA, impuesto al consumo (sin facturación electrónica DIAN)
- [x] Reportes fiscales: libro ventas/compras, IVA, retención, FONTUR, ocupación, TRA, SIRE — CSV y Excel
- [x] Instagram F1: Conexión OAuth, token largo, grilla de lectura, detalle de post, caché, desconexión
- [x] Instagram F2: Publicar ahora (imagen + carrusel, recorte JPEG con sharp, alt text, caption, vista previa, Storage bucket)
- [x] Instagram F3: Programación, calendario, cron, cupo, reintentos (sin plantillas — fase futura)
- [x] Instagram Insights A: Permiso + reconexión + Resumen (KPIs + gráficas), consulta directa + guardado diario
- [ ] Instagram Insights B: Audiencia y Publicaciones
- [ ] Instagram Insights C: Historias, carga inicial del historial y exportar
- [ ] Instagram F4: Plantillas reutilizables, mejores horas para publicar
- [ ] Notificaciones en tiempo real (Supabase Realtime)
- [ ] App móvil (React Native / Expo)
- [ ] Integración OTAs (Booking, Expedia) vía channel manager

## Decisiones adicionales (Fase 7)

| # | Decisión | Motivo |
|---|---|---|
| D5 | Dashboard usa framer-motion `stagger` con `containerVariants` / `cardVariants` | Entrada visual atractiva sin dependencias extra |
| D6 | Catálogos: componente genérico `CatalogTab` con prop `def: CatalogDef` | Evita 10 páginas/componentes idénticos |
| D7 | `seed.sql` usa `set session_replication_role = replica` para bypass RLS | Solo para entorno demo local; nunca producción |
| D8 | Configuración empresa: `react-hook-form + zod` con `setValue` para Selects | Consistente con el resto del proyecto |
| D9 | Dashboard team KPIs calculados en cliente desde hook + `calculateAvailability` | Reutiliza la lógica ya testeada del módulo Equipo |
