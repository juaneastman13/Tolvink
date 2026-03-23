# TOLVINK — Estado Actual del Proyecto

**Generado:** 2026-03-14
**Repos:** Frontend (`/workspaces/Tolvink`), Backend (`/workspaces/tolvink-api`)

---

## 1. RESUMEN EJECUTIVO

Tolvink es una plataforma de logística agrícola que conecta productores, plantas y transportistas para la gestión de fletes de granos en Uruguay. El stack es **React 18 + Zustand + Vite** (frontend, Vercel) y **NestJS + Prisma + PostgreSQL** (backend, Railway). Incluye integración con WhatsApp via Meta Cloud API, un asistente de IA (Claude Sonnet 4.6) con 61 herramientas, chat web con streaming SSE, tracking GPS en tiempo real, OCR de cartas de porte, y notificaciones push. El proyecto está en producción, con builds limpios en ambos repos y cobertura de tests en módulos críticos.

**Métricas generales:**

| Métrica | Backend | Frontend |
|---------|---------|----------|
| Archivos fuente | ~97 `.ts` | ~78 `.js`/`.jsx` |
| Líneas de código | ~29,114 | ~21,558 |
| Archivos de test | 6 | 6 |
| Líneas de test | 3,570 | 837 |

---

## 2. MODELO DE DATOS — ESTADO ACTUAL

### 2.1 Enums (8)

| Enum | Valores |
|------|---------|
| **CompanyType** | `producer`, `plant`, `transporter` |
| **UserRole** | `admin`, `operator`, `platform_admin` |
| **FreightStatus** | `draft`, `pending_assignment`, `assigned`, `accepted`, `in_progress`, `loaded`, `finished`, `canceled` |
| **AssignmentStatus** | `active`, `accepted`, `rejected`, `canceled` |
| **TripStatus** | `pending`, `accepted`, `in_progress`, `loaded`, `finished`, `canceled` |
| **GrainType** | `Soja`, `Maiz`, `Trigo`, `Girasol`, `Sorgo`, `Cebada`, `Otros` |
| **NotificationType** | `freight_created`, `freight_assigned`, `freight_accepted`, `freight_rejected`, `freight_started`, `freight_loaded`, `freight_confirmed`, `freight_finished`, `freight_canceled`, `freight_updated`, `message_received`, `conversation_started` |
| **DocumentStep** | `request`, `assignment`, `load_confirmation`, `delivery_confirmation`, `cancellation` |

### 2.2 Modelos (33 total)

#### Company
| Campo | Tipo | Atributos |
|-------|------|-----------|
| id | String | @id @default(uuid()) |
| name | String | @db.VarChar(255) |
| type | CompanyType | (legacy, mantenido por backward compat) |
| types | Json | @default("[]") @map("company_types") |
| address | String? | |
| phone | String? | @db.VarChar(50) |
| email | String? | @db.VarChar(255) |
| rut | String? | @db.VarChar(20) |
| active | Boolean | @default(true) |
| hasInternalFleet | Boolean | @default(false) |
| lat/lng | Decimal? | @db.Decimal(10,6) |
| createdAt/updatedAt | DateTime | |
| **Relaciones** | users, activeUsers, memberships, branches, fields, lots, pois, plants, trucks, freightsAsOrigin, freightsAsDest, assignments, notifications, plantAccessGiven, producerAccessReceived | |

#### User
| Campo | Tipo | Atributos |
|-------|------|-----------|
| id | String | @id @default(uuid()) |
| email | String | @unique |
| passwordHash | String? | |
| name | String | |
| role | UserRole | @default(operator) |
| companyId | String? | FK → Company |
| phone | String? | @unique |
| userTypes | Json | @default("[]") |
| companyByType | Json | @default("{}") |
| roleByType | Json | @default("{}") |
| isSuperAdmin | Boolean | @default(false) |
| active | Boolean | @default(true) |
| activeCompanyId | String? | FK → Company |
| failedLoginAttempts | Int | @default(0) |
| lockedUntil | DateTime? | |
| lastLogin, onboardingCompletedAt | DateTime? | |
| **Índices** | @@index([companyId]), @@index([activeCompanyId]), @@index([phone]) | |

#### Freight
| Campo | Tipo | Atributos |
|-------|------|-----------|
| id | String | @id @default(uuid()) |
| code | String | @unique @db.VarChar(20) |
| status | FreightStatus | @default(draft) |
| originCompanyId | String | FK → Company |
| originLotId | String? | FK → Lot |
| fieldId | String? | FK → Field |
| originName/destName | String | @db.VarChar(255) |
| originLat/originLng/destLat/destLng | Decimal? | @db.Decimal(10,6) |
| destCompanyId | String? | FK → Company |
| destPlantId | String? | FK → Plant |
| loadDate | DateTime | @db.Date |
| loadTime | String | @db.VarChar(5) |
| scheduledAt | DateTime? | |
| requestedById | String | FK → User |
| notes, cancelReason | String? | |
| truckCount | Int | @default(1) |
| assignedTruckCount | Int | @default(0) |
| isMultiTruck | Boolean | @default(false) |
| useOwnFleet | Boolean? | |
| participantCompanyIds | String[] | @default([]) |
| shareToken | String? | @unique |
| *ConfirmedAt (4 timestamps) | DateTime? | transporter/producer loaded, transporter/plant finished |
| **Índices** | loadDate, fieldId, requestedById, originCompanyId, destCompanyId, status+company, status+loadDate, scheduledAt, destName+originName+createdAt, participantCompanyIds (GIN) | |

#### FreightAssignment
| Campo | Tipo | Atributos |
|-------|------|-----------|
| id, freightId, transportCompanyId, assignedById | String | FKs |
| status | AssignmentStatus | @default(active) |
| driverId, driverName, plate | String? | |
| truckId | String? | FK → Truck |
| reason | String? | |
| queuePosition | Int | @default(0) |
| tripStatus | TripStatus | @default(pending) |
| tripNumber | Int | @default(1) |
| tons/loadedTons | Decimal? | |
| startedAt/loadedAt/finishedAt | DateTime? | |
| *ConfirmedAt (4 timestamps) | DateTime? | Per-trip confirmations |

#### FreightItem
grain (VarChar 50), tons (Decimal 10,2), notes, freightId FK.

#### Field
name, companyId FK, address?, lat/lng?, hectares?, comments?, active. @@index([companyId])

#### Lot
name, companyId FK, fieldId? FK, hectares?, lat/lng?, comments?, active. @@index([companyId]), @@index([fieldId])

#### Poi (Point of Interest)
name, companyId FK, address?, lat/lng (required), comments?, active. @@index([companyId])

#### SharedField / SharedLot / SharedPoi
Estructura idéntica: entityId FK, sharedByUserId FK, sharedWithUserId FK, active. @@unique([entityId, sharedWithUserId])

#### Plant
name, companyId FK, address?, lat/lng (required), active. @@index([companyId])

#### Branch
name, companyId FK, address?, reference?, lat/lng?, active. @@index([companyId])

#### Truck
plate (@unique), brand?, model?, capacity?, companyId FK, assignedUserId? FK, active.

#### WeighTicket
freightId FK, assignmentId? FK, type ("destination"), ticketNumber?, grossWeight/tareWeight/netWeight?, humidity/impurities/dockage/temperature?, observations?, photoUrl?, ocrData?, ocrConfidence?, registeredById FK.

#### FreightDocument
freightId FK, name, url, type, step?, uploadedById FK, ocrData?.

#### FreightTracking
freightId FK, userId?, lat/lng, speed?, heading?, createdAt. Historial GPS.

#### LiveLocation
freightId FK, userId FK, userName, userRole, lat/lng, speed?, heading?, active, expiresAt. @@unique([freightId, userId])

#### Conversation
freightId? (@unique). 1:1 con Freight.

#### ConversationParticipant
conversationId FK, companyId, userId?, lastReadAt?, pinnedAt?, markedUnread. @@unique([conversationId, companyId])

#### Message
conversationId FK, senderId FK, text (VarChar 2000), createdAt.

#### Notification
userId FK, companyId? FK, type (NotificationType), title, body?, entityId?, read. Índices: [userId, read], [userId, read, createdAt]

#### PushSubscription
userId FK, endpoint, p256dh, auth. @@unique([userId, endpoint])

#### UserCompany
userId FK, companyId FK, role ("operario"), active. @@unique([userId, companyId])

#### RefreshToken
token (@unique), userId FK, expiresAt.

#### PasswordResetCode
userId FK, codeHash, expiresAt, attempts, used, resetJti.

#### WhatsAppSession
userId FK, phone, flowType?, flowState (Json), flowStep?, expiresAt?.

#### WhatsAppMessageLog
waMessageId?, phone, direction, type, content (Json), status.

#### AnalyticsEvent
event, data (Json), userId?, sessionId?.

#### FreightPendingChange
freightId FK, changeType, fromValue/toValue (Json), requestedById FK, approverCompanyId, status, resolvedAt?, resolvedById?.

#### PlantProducerAccess
plantCompanyId FK, producerCompanyId FK, producerUserId? FK, allowedPlantIds (Json), allowedBranchIds (Json), active.

### 2.3 Migraciones (13 total)

| # | Migración | Fecha |
|---|-----------|-------|
| 1 | init | 2026-02-15 |
| 2 | add_loaded_state | 2026-02-15 |
| 3 | structural_domain_update | 2026-02-15 |
| 4 | add_missing_columns | 2026-02-16 |
| 5 | perf_compound_indexes | 2026-03-11 |
| 6 | add_participant_company_ids | 2026-03-12 |
| 7 | add_poi_model | 2026-03-12 |
| 8 | ensure_pois_table | 2026-03-12 |
| 9 | sync_company_types | 2026-03-13 |
| 10 | add_weigh_tickets | 2026-03-13 |
| 11 | add_shared_pois | 2026-03-13 |
| 12 | add_shared_fields_and_lots | 2026-03-13 |
| 13 | **fix_missing_creates** | **2026-03-13** (última) |

⚠️ La migración 13 corrigió 11 tablas que no tenían `CREATE TABLE` en migraciones previas (fueron creadas vía `prisma db push`). Ahora todas tienen `CREATE TABLE IF NOT EXISTS`.

---

## 3. API — ENDPOINTS ACTUALES

**Prefijo global:** `/api`
**Total controllers:** 16
**Total endpoints:** 150+

### Auth (`/api/auth`)
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | /ping | @SkipThrottle | Health check |
| POST | /login | @Throttle(5/min) | Login email/phone + password |
| POST | /register | @Throttle(5/min) | Registro de usuario |
| POST | /identify-for-reset | @Throttle(5/min) | Identificar para reset (teléfono enmascarado) |
| POST | /request-code | @Throttle(3/min) | Enviar código WhatsApp |
| POST | /verify-code | @Throttle(5/min) | Verificar código |
| POST | /reset-password | @Throttle(5/min) | Nueva contraseña con token |
| POST | /refresh | @Throttle(10/min) | Renovar access token |
| POST | /logout | JwtAuthGuard | Revocar tokens |
| POST | /switch-company | JwtAuthGuard | Cambiar empresa activa |
| PATCH | /password | JwtAuthGuard, @Throttle(3/min) | Cambiar contraseña |
| GET | /me/companies | JwtAuthGuard | Listar mis empresas |
| PATCH | /me/onboarding-complete | JwtAuthGuard | Marcar onboarding completo |

### Freights (`/api/freights`)
| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | / | producer, plant | Crear flete |
| GET | / | (auth) | Listar con filtros server-side y paginación |
| GET | /drivers | transporter, producer, plant | Conductores disponibles |
| GET | /drivers/:id/queue | plant, transporter, producer | Cola del conductor |
| POST | /drivers/:id/reorder | plant | Reordenar cola |
| GET | /:id | FreightAccessGuard | Detalle |
| GET | /:id/summary | FreightAccessGuard | Resumen ligero |
| GET | /:id/detail-extra | FreightAccessGuard | Docs, conversación, cambios |
| POST | /:id/assign | plant | Asignar transportista |
| POST | /:id/respond | transporter | Aceptar/rechazar |
| POST | /:id/start | transporter, producer | Iniciar viaje |
| POST | /:id/confirm-loaded | transporter, producer | Confirmar carga |
| POST | /:id/confirm-finished | transporter, plant | Confirmar entrega |
| POST | /:id/cancel | producer, plant | Cancelar |
| POST | /:id/authorize | plant | Autorizar flota propia |
| POST | /:id/assign-multi | plant | Asignar múltiples camiones |
| POST | /:id/assign-truck | plant | Agregar camión |
| POST | /:id/assignments/:aId/cancel | plant | Cancelar asignación |
| PATCH | /:id/assignments/:aId | plant | Editar asignación |
| POST | /:id/assignments/:aId/respond | transporter, plant | Responder per-trip |
| POST | /:id/assignments/:aId/start | transporter, producer | Iniciar per-trip |
| POST | /:id/assignments/:aId/confirm-loaded | transporter, producer | Confirmar carga per-trip |
| POST | /:id/assignments/:aId/confirm-finished | transporter, plant | Confirmar entrega per-trip |
| PATCH | /:id | producer, plant | Editar flete |
| POST | /:id/pending-changes/:changeId/approve | producer, plant | Aprobar cambio |
| POST | /:id/pending-changes/:changeId/reject | producer, plant | Rechazar cambio |
| POST | /:id/tracking | @Throttle(60/min) | Enviar punto GPS |
| GET | /:id/tracking/participants | (auth) | Posiciones participantes |
| GET | /:id/tracking/last | (auth) | Última posición |
| GET | /:id/tracking | (auth) | Puntos de tracking |
| GET | /:id/audit | (auth) | Historial de cambios |
| POST | /:id/documents | (auth) | Registrar documento |
| DELETE | /:id/documents/:docId | (auth) | Eliminar documento |
| PATCH | /:id/documents/:docId/ocr | @Throttle(20/min) | Guardar OCR |

### Freight Public (`/api/f`) — Sin auth
| GET | /:code, /:code/position, /:code/participants, /:code/report | shareToken requerido |

### Freight Tracking (`/api/track`) — Sin auth
| GET | /:token, /:token/position, /:token/participants, /:token/report-data | Por token |

### Catalog (`/api/catalog`)
| GET | /plants, /branches, /lots, /transport-companies, /all | JwtAuthGuard |

### Fields (`/api/fields`) — 26 endpoints
CRUD campos, lotes, POIs. Share/unshare. Soft delete. Import Google Maps. Reclasificar POIs. Search users.

### Conversations (`/api/conversations`) — 9 endpoints
Search users, start, list (paginado), mark read, messages (cursor), typing, pin, mark-unread, send.

### Trucks (`/api/trucks`) — 6 endpoints
CRUD camiones y conductores.

### Notifications (`/api/notifications`) — 5 endpoints
Subscribe/unsubscribe push, list, mark read, mark all read.

### SSE (`/api/sse`) — 2 endpoints
POST /ticket (30s TTL), GET /stream.

### WhatsApp (`/api/whatsapp`) — 9 endpoints
Webhook (GET verify + POST receive), location-token, save-location (2 variantes), daily-map-data, live-location (upsert, get, stop).

### Web Chat (`/api/web-chat`) — 3 endpoints
POST /message (fire-and-forget → SSE), POST /audio (Whisper → IA), GET /history.

### OCR (`/api/ocr`) — 1 endpoint
POST /analyze.

### Weigh Tickets (`/api/freights/:id/weigh-tickets`) — 6 endpoints
CRUD + OCR.

### Plant Access (`/api/plant-access`) — 8 endpoints
Search, grant, revoke, list producers/plants, facilities.

### Admin (`/api/admin`) — 24 endpoints
Gestión de empresas, sucursales, usuarios, campos, lotes, camiones.

---

## 4. FRONTEND — PANTALLAS Y NAVEGACIÓN

### 4.1 Pantallas Registradas (24 total)

**Core (14, lazy-loaded):**

| Pantalla | Líneas | Ruta |
|----------|--------|------|
| HomeScreen | 1,213 | / |
| ListScreen | 2,005 | /list |
| DetailScreen | 2,298 | /freight/:id |
| NewScreen | 2,189 | /new |
| EditScreen | 379 | /edit/:id |
| CalendarScreen | 421 | /calendar |
| MenuScreen | ~300 | /menu |
| TrucksScreen | 267 | /trucks |
| LocationsScreen | 1,868 | /locations |
| AdminScreen | 1,550 | /admin |
| MyDataScreen | 297 | /mydata |
| ReportsScreen | 747 | /reports |
| ChatsScreen | 1,381 | /chats/:id |
| NotificationsScreen | 166 | /notifications |

**Públicas (6):** TrackFreightScreen (534), LiveFreightScreen (634), DailyMapScreen (378), ViewMapScreen (232), PickLocationScreen (297), ReportDownloadScreen (197)

**Auth (3):** LandingScreen (1,491), AuthScreen (685), AccessScreen (893)

### 4.2 Navegación

**Desktop sidebar** (8 items, 5 en simple mode): Inicio, Fletes, Mapa, Chat, Notificaciones, Calendario, Informes, Menú

**Mobile bottom nav** (5 items): Inicio, Fletes, FAB (pendientes), Mapa, Menú

---

## 5. FRONTEND — COMPONENTES Y SISTEMA DE DISEÑO

### 5.1 Componentes Principales

Av, Bd, Tabs, SortTh, exportCSV/Excel/PDF (data-display); Btn (buttons); Field, NumericStepper, Select, Sec (form); Toast, Loader, LoadingOverlay, EmptyState, SkeletonCard/List/Detail, ErrorBoundary (feedback); ModalOverlay, AttachMenu, FileViewer (overlays); Sidebar, Nav, NotifBell, NotificationsPanel (navigation)

### 5.2 Componentes locations/
FieldForm (76), LotForm (112), PoiForm (121), ReclassifyModal (96), RowMenu (83), ShareLocationModal (162), ImportClassifyPanel (172)

### 5.3 maps.jsx (1,108 líneas)
loadGMaps(), LocationPicker, LocPickerFullscreen, MapOverlay, FreightMap, FreightsOverviewMap, TrackingMap, DailyMapComponent

### 5.4 Design Tokens

**Colores:** pri=#1A6B37 (verde), acc=#FF6A00 (naranja), sec=#0891B2 (cyan), ok/err/warn/info con variantes pale. Texto t1/#18251C, t2/#4A6352, t3/#566B5E. Fondo bg=#F7F8F7.

**Tipografía:** FONT='DM Sans', MONO='JetBrains Mono'

**Íconos (47+):** home, truck, plus, minus, msg, user, chev, chk, pin, plant, cal, clk, warn, send, out, shield, bell, gear, menu3, wa, nav, srch, cross, mail, lock, eye, eyeOff, grain, ban, redo, down, download, filter, cam, img, doc, seedling, expand, collapse, edit, mapView, share, compass, field, lot, poi, clip, phone, map

---

## 6. GESTIÓN DE ESTADO

### 6.1 Zustand Stores (store.js — 197 líneas)

| Store | Campos Principales | TTL |
|-------|-------------------|-----|
| useUIStore | modal, toast, mapFocus, listView, submitting, submitDone, actionLoading, notifOpen, chatConvId, duplicateData, editData, locPicker, goToMap | — |
| useCatalogStore | cache: { [userId]: { data, ts, loading } } | 5 min |
| useFreightDetailStore | details: { [freightId]: { data, ts, loading } } | 2 min |
| offlineQueue | IndexedDB 'tolvink-offline' | Persistente |

### 6.2 Hooks (src/hooks/ — 962 líneas)

| Hook | Líneas | Propósito |
|------|--------|-----------|
| useAuth | 177 | Login/register, sesión, simple mode |
| useFreights | 183 | Listar/fetch/update fletes, paginación |
| useCatalog | 88 | Fetch/cache catálogo |
| useNotifications | 88 | Poll notificaciones |
| useSSE | 166 | Conexión SSE, exponential backoff (5s→30s) |
| useResponsive | 26 | Desktop/mobile, online/offline |
| useTableInteractions | 90 | Sort, pull-to-refresh |
| helpers.jsx | 144 | mapUser, mapFreight, originDisplay, destDisplay, permsFor |

---

## 7. MÓDULO WHATSAPP — ESTADO ACTUAL

### 7.1 Configuración IA

- **Modelo:** Claude Sonnet 4.6 (principal), Haiku 4.5 (simples)
- **Temperatura:** 0.4 | **Max tokens:** 1200 (WA), 2400 (web)
- **Historial:** 25 msgs/sesión | **Timeout:** 30 min (deslizante)
- **Rate limit:** 20 msgs / 5 min por usuario
- **Tool loops:** máx 5, 90s timeout global

### 7.2 System Prompt

1. Identidad: "Tolvink, asistente de logística agrícola"
2. Contexto: usuario, empresa activa, fecha UTC-3
3. Permisos por rol (chofer/productor/planta/transportista/admin)
4. Tono rioplatense, conciso (3-4 líneas)
5. Datos pre-cargados (campos, plantas, fletes recientes)
6. Contexto activo (último flete, última acción)
7. Auto-selección de opciones únicas

### 7.3 Tools (61 total)

| Categoría | Cantidad | Ejemplos |
|-----------|----------|----------|
| Consultas flete | 5 | list_freights, get_freight_detail, summarize_freights, get_dashboard, freight_history |
| Creación/modificación | 5 | prepare_freight, confirm_create_freight, duplicate_freight, update_freight, cancel_freight |
| Acciones de estado | 6 | accept, reject, start, confirm_loaded, confirm_finished, authorize |
| Multi-truck | 6 | respond_trip, start_trip, confirm_trip_loaded/finished, assign_truck, assign_multi |
| Transportistas | 4 | list, assign, update_assignment, cancel_assignment |
| Ubicaciones | 9 | search_plants, list/search fields/lots, create/update field/lot |
| Camiones/conductores | 9 | list/create/update/deactivate trucks/drivers, queue, reorder |
| Documentos/OCR | 5 | attach, list, delete, ocr_analyze, save_ocr |
| Links/mapas | 8+ | tracking, location, map, report, daily_map, batch_report, live_location |
| Admin/usuarios | 8+ | list/create/update/deactivate users, switch_company, update_company |
| Multi-empresa | 4 | list enabled plants/producers, grant/revoke access |
| Sucursales | 4 | list/create/update/delete branches |
| Otros | 3 | confirm_action, get_user_profile, navigate_app (web) |

### 7.4 Flujo de Procesamiento

1. Rate limiting → 2. Lock sesión → 3. Resolución empresa/rol → 4. Preprocesamiento texto → 5. Inyección contexto → 6. Smart trim historial → 7. Tool execution loop (parallel read-only) → 8. Side-effects merge → 9. Validación respuesta → 10. Persistencia sesión

### 7.5 Router de Mensajes

| Tipo | Handler |
|------|---------|
| text | Regex código flete, saludo, dispatch IA |
| button_reply | Acciones notificación/menú |
| list_reply | Selección multi-opción |
| location | Coordenadas GPS |
| audio | Whisper → IA |
| image/document | OCR o adjuntar a flete |

### 7.6 Flows Guiados

reject_freight, confirm_loaded, cancel_freight, create_freight (wizard multi-step)

### 7.7 Problemas Conocidos

| Problema | Estado |
|----------|--------|
| Bot asume roles incorrectos | ✅ Corregido (resolveActiveRole scoped a activeCompanyId) |
| No consulta datos antes de preguntar | ✅ Corregido (pre-carga en system prompt) |
| Búsqueda difusa débil | ✅ Corregido (fuzzySearch con thresholds + ENTITY_ALIASES) |
| Sub-decisiones sin resolver | ✅ Corregido (pendingAction en sesión + contexto) |
| Pérdida de contexto | ✅ Corregido (activeContext + recovery sesiones expiradas) |

---

## 8. MÓDULO WEB CHAT — ESTADO ACTUAL

| Aspecto | Detalle |
|---------|---------|
| Endpoints | POST /message, POST /audio, GET /history |
| Reutiliza tools WhatsApp | ✅ Sí, mismas 61 tools |
| Streaming SSE | ✅ ai:thinking, ai:chunk, ai:transcription, ai:response |
| Navegación in-app | ✅ tool navigate_app envía { screen, freightId } |
| Sesión | phone='web', 30 min timeout |
| Audio | Whisper (español), límite 24MB |
| Idempotency | 60s TTL in-memory dedup |
| Frontend | AiChat.jsx (877 líneas) — FAB flotante con chat, streaming, audio |

---

## 9. AUTENTICACIÓN Y SEGURIDAD

### 9.1 Mecanismo

- **Cookies HttpOnly:** accessToken (30min, path=/api) + refreshToken (7 días, path=/api/auth)
- **Opciones:** secure, sameSite=none, partitioned
- **Silent refresh:** 401 → POST /auth/refresh → retry
- **NO JWT en localStorage** ✅

### 9.2 Guards

| Guard | Propósito |
|-------|-----------|
| JwtAuthGuard | JWT de header/cookie, cache 30s, bloquea desactivados |
| RolesGuard | @Roles() vs company type, platform admin bypasses |
| FreightAccessGuard | Multi-tenant: origin, dest, transporter, driver |

### 9.3 Seguridad

- Brute-force: 5 intentos → lockout 15 min
- Constant-time compare (DUMMY_HASH)
- Password reset: WhatsApp code (6 dígitos, 10 min, max 3 intentos, max 3 códigos/hora)
- CSRF: validación Origin/Referer
- Helmet CSP: Maps, Supabase, Sentry permitidos
- Rate limiting: per-endpoint + global 500/min

---

## 10. TRACKING Y UBICACIÓN

| Pantalla | Líneas | Propósito |
|----------|--------|-----------|
| TrackFreightScreen | 534 | Tracking público |
| LiveFreightScreen | 634 | Ubicación en vivo multi-participante |
| PickLocationScreen | 297 | Picker de ubicación |
| DailyMapScreen | 378 | Mapa diario de operaciones |

- **SSE para tracking:** ✅ Eventos freight:updated con posición
- **Polling fallback:** 30s (SSE on), 5s (SSE off)
- **LiveLocation:** @@unique([freightId, userId]), speed, heading, expiresAt

---

## 11. MÓDULO DE CAMPOS, LOTES Y UBICACIONES

| Feature | Estado |
|---------|--------|
| CRUD campos | ✅ |
| CRUD lotes | ✅ |
| CRUD POIs | ✅ |
| Compartir campos/lotes/POIs | ✅ |
| Soft delete | ✅ (active=false, cascada lotes) |
| Importación Google Maps | ✅ (parse link, clasificar, confirm bulk) |
| Mapa con marcadores coloreados | ✅ |
| Filtros de mapa (inician activos) | ✅ |
| Reclasificar POI como campo/lote | ✅ |
| Drawer fullscreen mobile | ✅ |
| Lote opcional sin lotes | ✅ |

---

## 12. NOTIFICACIONES Y PUSH

| Canal | Estado |
|-------|--------|
| Push (Web Push API) | ✅ VAPID, max 10 subs/usuario |
| SSE | ✅ Max 3 clients/user, 50/empresa, 500 global. Heartbeat 30s, timeout 5min |
| WhatsApp | ✅ Rate limited 100ms entre envíos |

**Eventos SSE:** freight:updated, message:new, notification:new, catalog:changed, typing, read, ai:response, ai:transcription, ai:chunk, ai:thinking

**Limpieza:** Notificaciones leídas 90 días, tracking 90 días, analytics 180 días

---

## 13. INFRAESTRUCTURA Y DEPLOYMENT

### 13.1 Dependencias

**Frontend:** react ^18.2.0, react-router-dom ^7.13.0, zustand ^5.0.11, @sentry/react ^10.39.0, vite ^5.0.0, vitest ^4.0.18

**Backend:** @nestjs/core ^10.3.0, @nestjs/jwt ^10.2.0, @prisma/client ^5.8.0, @anthropic-ai/sdk ^0.78.0, bcryptjs ^2.4.3, helmet ^7.1.0, typescript ^5.3.3

### 13.2 Deploy

| Repo | Plataforma | Build |
|------|-----------|-------|
| Frontend | Vercel | Vite → dist/, SPA rewrite, cache immutable 1yr, CSP headers |
| Backend | Railway | tsc → dist/, `prisma migrate deploy && node dist/main.js`, port 4000 |

### 13.3 DevContainer

Node 20 (Bullseye), ports 5173+3000, ESLint+Prettier+Prisma extensions.

### 13.4 Variables de Entorno

**Frontend:** VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_VAPID_PUBLIC_KEY

**Backend:** DATABASE_URL, DIRECT_URL, JWT_SECRET, WHATSAPP_APP_SECRET, NODE_ENV, PORT, CORS_ORIGIN, SENTRY_DSN, SENTRY_TRACES_RATE

---

## 14. TESTS — COBERTURA ACTUAL

### Frontend (837 líneas, 6 archivos)

| Archivo | Líneas | Estado |
|---------|--------|--------|
| store.test.js | 88 | ✅ Tests reales |
| hooks.test.jsx | 257 | ✅ Tests reales |
| freight-helpers.test.js | 257 | ✅ Tests reales |
| validation.test.js | 186 | ✅ Tests reales |
| constants.test.js | 117 | ✅ Tests reales |
| api.test.js | 189 | ✅ Tests reales |

### Backend (3,570 líneas, 6 archivos)

| Archivo | Líneas | Estado |
|---------|--------|--------|
| auth.service.spec.ts | 444 | ✅ Tests reales |
| freights.service.spec.ts | 898 | ✅ Tests reales |
| freight-state-machine.spec.ts | 1,283 | ✅ Tests reales |
| weigh-tickets.service.spec.ts | 489 | ✅ Tests reales |
| company-resolution.service.spec.ts | 229 | ✅ Tests reales |
| fuzzy-match.spec.ts | 227 | ✅ Tests reales |

⚠️ Dual jest config (.js + .ts) impide `npx jest` sin `--config`.

### Cobertura por Módulo

| Módulo | Cobertura |
|--------|-----------|
| Auth | Buena |
| Freights + State Machine | Buena |
| Weigh Tickets | Buena |
| Company Resolution | Buena |
| Fuzzy Match | Buena |
| WhatsApp/AI | 0% |
| Notifications | 0% |
| Fields/Locations | 0% |
| Admin | 0% |
| Frontend UI | 0% (hooks/stores sí) |

---

## 15. DEUDA TÉCNICA — ESTADO ACTUAL

### 15.1 Archivos Grandes

| Archivo | Líneas | Evaluación |
|---------|--------|-----------|
| ai.service.ts | 5,404 | ⚠️ MUY GRANDE |
| freights.service.ts | 3,078 | ⚠️ GRANDE (cohesivo) |
| DetailScreen.jsx | 2,298 | ⚠️ GRANDE |
| NewScreen.jsx | 2,189 | ⚠️ GRANDE + TODO duplicación |
| ListScreen.jsx | 2,005 | ⚠️ GRANDE |
| LocationsScreen.jsx | 1,868 | Aceptable |
| AppLayout.jsx | 583 | ⚠️ God component |
| api.js | 518 | ⚠️ Monolítico |

### 15.2 TODO/FIXME/HACK

Solo 1 encontrado: `NewScreen.jsx:566` — duplicación mobile/desktop en formulario.

### 15.3 Estado de Deuda Conocida

| Item | Estado |
|------|--------|
| AppLayout God Component (583 líneas) | ⚠️ Persiste |
| components.jsx / hooks.jsx monolitos | ✅ Resuelto (descompuestos) |
| Prop drilling vs Zustand | ✅ Mejorado (10-20 props/screen) |
| Estilos inline sin framework | ⚠️ Persiste (100% inline + tokens) |
| Rate limiting in-memory | ⚠️ Persiste (no escala multi-instancia) |
| CompanyType dual system | ✅ Manejado (helpers abstraen) |
| Decimal handling Prisma | ✅ Resuelto (interceptor global) |
| Google Maps memory leaks | ✅ Corregido (clearInstanceListeners) |
| Unbounded findMany (127 queries) | ⚠️ Persiste (pre-existente) |

---

## 16. PERFORMANCE Y OPTIMIZACIONES

| Métrica | Estado |
|---------|--------|
| Lazy loading screens | ✅ 14 screens + 7 modals + maps |
| HomeScreen no-bloqueante | ✅ Skeleton → datos async |
| Cache con TTL | ✅ Catálogo 5min, detalle 2min, status 30s |
| Catálogo cacheado | ✅ Singleton promise anti-concurrent |
| Actualización granular | ✅ Híbrido (SSE push + polling fallback) |
| Code splitting (Vite) | ✅ Chunks por screen |

---

## 17. ARCHIVOS Y ESTRUCTURA

### 17.1 Frontend (src/)

```
screens/           24 archivos (~21,000 líneas total)
layout/            AppLayout.jsx (583), AppShell.jsx (~50)
components/        navigation.jsx (381), data-display, form, buttons,
                   feedback, overlays, AiChat (877), WeighTicketForm (305)
                   locations/ (7 archivos, ~820 líneas)
routing/           Router.jsx (143)
hooks/             7 hooks + helpers (962 líneas total)
modals/            7 modals (lazy-loaded)
providers/         AuthProvider, SSEProvider
maps.jsx           1,108
api.js             518
store.js           197
theme.jsx          98
constants.jsx      ~200
uploads.jsx        ~320
```

### 17.2 Backend (src/)

```
ai/                ai.service.ts (5,404), ai-tool-definitions.ts (~2,000),
                   ai.constants.ts (~200)
freights/          freights.service.ts (3,078), controller (~1,500),
                   state-machine (~500), dto (~300)
whatsapp/          router (1,867), flow (1,560), service (~800),
                   controller (~700)
admin/             controller (1,212)
fields/            service (~700), controller (~600)
common/            guards/ (3), interceptors/ (3), helpers/ (5+),
                   decorators/, services/
auth/              service (~600), controller (~400)
notifications/     service (~400)
conversations/     controller (~500)
sse/               service (~300)
web-chat/          service (~300), controller (~100)
plant-access/      controller (~400)
ocr/, weigh-tickets/, database/ ~300 c/u
```

---

## 18. AGENTES DE CLAUDE CODE

`.claude/` existe con `settings.local.json` únicamente. **No existe `.claude/agents/`.** No hay agentes configurados.

---

*Documento generado automáticamente por Claude Code el 2026-03-14.*
