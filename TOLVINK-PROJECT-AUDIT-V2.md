# TOLVINK — Auditoría Técnica del Proyecto v2

> Fecha: 2026-03-13
> Scope: Frontend (Tolvink), Backend (tolvink-api), Prisma schema, WhatsApp AI, Tests
> Cambios respecto a v1: Descomposición de componentes, módulo WeighTickets, mejoras WhatsApp AI, nuevos tests

---

## 1. VISIÓN GENERAL

Tolvink es una plataforma de logística granelera para Argentina y Uruguay. Conecta **productores** (campos), **plantas** (silos/acopio) y **transportistas** para coordinar fletes de granos desde el campo al destino.

### Módulos actuales

| Módulo | Backend | Frontend | Estado |
|--------|---------|----------|--------|
| Auth (login, registro, reset) | `auth/` | AuthScreen, providers/AuthProvider | Producción |
| Freights (CRUD, state machine) | `freights/` | HomeScreen, ListScreen, DetailScreen, NewScreen, EditScreen | Producción |
| Multi-truck (v6.0) | `freights/` | DetailScreen (trip cards, per-trip actions) | Producción |
| Catalog (plantas, lotes, transportistas) | `catalog.controller.ts` | hooks/useCatalog | Producción |
| Fields & Lots (campos, lotes, POIs) | `fields/` | FieldsScreen, LocationsScreen | Producción |
| Trucks & Drivers (flota) | `trucks/` | TrucksScreen | Producción |
| Plant Access (permisos planta↔productor) | `plant-access/` | AccessScreen | Producción |
| Documents + OCR | `ocr/`, freights documents | uploads.jsx, DocsGallery | Producción |
| Notifications (push + in-app) | `notifications/` | NotificationsScreen, NotifBell | Producción |
| Conversations (chat interno) | `conversations/` | ChatsScreen | Producción |
| SSE (real-time) | `sse/` | hooks/useSSE, providers/SSEProvider | Producción |
| WhatsApp AI Agent | `whatsapp/`, `ai/` | N/A (canal WhatsApp) | Producción |
| Web Chat (AI desde frontend) | `web-chat/` | AiChat.jsx | Producción |
| Tracking & Location | `freights/` tracking endpoints | maps.jsx, TrackFreightScreen | Producción |
| Reports (PDF) | `freights/` report endpoints | ReportsScreen, pdf-report.js | Producción |
| Admin | `admin/` | AdminScreen | Producción |
| Calendar | N/A (frontend-only) | CalendarScreen | Producción |
| **Weigh Tickets** *(NUEVO)* | `weigh-tickets/` | WeighTicketForm, WeighTicketConfirmModal | Producción |
| Analytics | `analytics/` | N/A (backend tracking) | Producción |
| Health | `health/` | N/A | Producción |

---

## 2. ARQUITECTURA Y STACK

### Backend — tolvink-api

| Componente | Tecnología | Versión |
|-----------|-----------|---------|
| Framework | NestJS | 10.3 |
| ORM | Prisma | 5.8 |
| Base de datos | PostgreSQL | — |
| Auth | JWT (HttpOnly cookies) | @nestjs/jwt 10.2 |
| Validación | class-validator + class-transformer | 0.14/0.5 |
| Rate limiting | @nestjs/throttler | 5.2 |
| Docs | Swagger (@nestjs/swagger) | 7.2 |
| AI | Anthropic SDK (@anthropic-ai/sdk) | 0.78 |
| Audio | OpenAI (Whisper) | 6.22 |
| Push | web-push | 3.6 |
| Error tracking | @sentry/node | 8.0 |
| Security | helmet, bcryptjs, cookie-parser, compression | — |
| Storage | Supabase Storage (no SDK, REST directo) | — |
| Tests | Jest + ts-jest | 29.7 |
| TypeScript | | 5.3 |

### Frontend — Tolvink

| Componente | Tecnología | Versión |
|-----------|-----------|---------|
| Framework | React | 18.2 |
| Bundler | Vite | 5.0 |
| Router | react-router-dom | 7.13 |
| State | Zustand | 5.0 |
| PDF | jsPDF + jspdf-autotable | 4.2/5.0 |
| QR | qrcode | 1.5 |
| Error tracking | @sentry/react | 10.39 |
| Tests | Vitest + @testing-library/react | 4.0/16.3 |
| Minifier | Terser | 5.27 |

### Servicios externos

- **Supabase** — Storage (fotos, documentos), auth keys
- **Meta WhatsApp Cloud API** — Canal de mensajería
- **Google Maps Platform** — Mapas, geocoding, directions
- **Anthropic Claude** — AI conversacional (Sonnet 4.6 + Haiku 4.5)
- **OpenAI Whisper** — Transcripción de audio (WhatsApp)
- **Sentry** — Error tracking (frontend + backend)
- **Web Push (VAPID)** — Notificaciones push

---

## 3. MODELO DE DATOS

### Modelos Prisma (29 modelos)

Los modelos marcados con *(NUEVO)* fueron agregados desde la auditoría v1.

| # | Modelo | Tabla | Campos clave | Relaciones principales |
|---|--------|-------|-------------|----------------------|
| 1 | Company | companies | id, name, type, types[], hasInternalFleet, lat, lng, active | → Users, Branches, Fields, Plants, Trucks, Freights |
| 2 | User | users | id, email, passwordHash, name, role, phone, userTypes, isSuperAdmin, activeCompanyId | → Company, UserCompany[], Freights, Assignments |
| 3 | Branch | branches | id, name, companyId, address, lat, lng, active | → Company |
| 4 | Field | fields | id, name, companyId, address, lat, lng, hectares, active | → Company, Lots[], Freights |
| 5 | Lot | lots | id, name, companyId, fieldId, lat, lng, active | → Field, Company, Freights |
| 6 | Poi | pois | id, name, companyId, lat, lng, active | → Company |
| 7 | Plant | plants | id, name, companyId, address, lat, lng, active | → Company, Freights |
| 8 | Truck | trucks | id, plate (unique), brand, model, capacity, companyId, assignedUserId | → Company, User, Assignments |
| 9 | PlantProducerAccess | plant_producer_access | id, plantCompanyId, producerCompanyId, allowedPlantIds, allowedBranchIds | → Companies |
| 10 | UserCompany | user_companies | id, userId, companyId, role, active | → User, Company (unique: userId+companyId) |
| 11 | **Freight** | freights | id, code (unique), status, origin*, dest*, loadDate, truckCount, isMultiTruck, useOwnFleet, shareToken, cross-confirmation timestamps | → Items, Assignments, Documents, **WeighTickets**, Conversation, AuditLogs, Tracking |
| 12 | FreightItem | freight_items | id, freightId, grain, tons, unit, notes | → Freight |
| 13 | FreightAssignment | freight_assignments | id, freightId, transportCompanyId, status, tripStatus, tripNumber, tons, per-trip confirmation timestamps | → Freight, Company, User, Truck, **WeighTickets** |
| 14 | FreightDocument | freight_documents | id, freightId, name, url, type, step, ocrData | → Freight, User |
| 15 | **WeighTicket** *(NUEVO)* | weigh_tickets | id, freightId, assignmentId?, type (origin/destination), ticketNumber, grossWeight, tareWeight, netWeight, humidity, impurities, dockage, temperature, observations, photoUrl, ocrData, ocrConfidence, registeredById | → Freight, Assignment, User |
| 16 | FreightTracking | freight_tracking | id, freightId, userId, lat, lng, speed, heading | → Freight, User |
| 17 | LiveLocation | live_locations | id, freightId, userId, userName, userRole, lat, lng, active, expiresAt | → Freight |
| 18 | Conversation | conversations | id, freightId (unique) | → Freight, Messages, Participants |
| 19 | ConversationParticipant | conversation_participants | id, conversationId, companyId, userId, lastReadAt, pinnedAt, markedUnread | → Conversation |
| 20 | Message | messages | id, conversationId, senderId, text (max 2000) | → Conversation, User |
| 21 | AuditLog | audit_logs | id, entityType, entityId, action, fromValue, toValue, userId, freightId, reason, metadata | → User, Freight |
| 22 | Notification | notifications | id, userId, companyId, type, title, body, entityId, read | → User, Company |
| 23 | PushSubscription | push_subscriptions | id, userId, endpoint, p256dh, auth | → User (unique: userId+endpoint) |
| 24 | RefreshToken | refresh_tokens | id, token (unique), userId, expiresAt | → User |
| 25 | AnalyticsEvent | analytics_events | id, event, data (JSON), userId, sessionId | → User |
| 26 | WhatsAppSession | whatsapp_sessions | id, userId, phone, flowType, flowState, flowStep, expiresAt | → User |
| 27 | WhatsAppMessageLog | whatsapp_message_logs | id, waMessageId, phone, direction, type, content, status | (standalone) |
| 28 | PasswordResetCode | password_reset_codes | id, userId, codeHash, expiresAt, attempts, used, resetJti | → User |
| 29 | FreightPendingChange | freight_pending_changes | id, freightId, changeType, fromValue, toValue, requestedById, approverCompanyId, status | → Freight, Users |

### Enums

| Enum | Valores |
|------|---------|
| CompanyType | producer, plant, transporter |
| UserRole | admin, operator, platform_admin |
| FreightStatus | draft, pending_assignment, assigned, accepted, in_progress, loaded, finished, canceled |
| AssignmentStatus | active, accepted, rejected, canceled |
| TripStatus | pending, accepted, in_progress, loaded, finished, canceled |
| GrainType | Soja, Maiz, Trigo, Girasol, Sorgo, Cebada, Otros |
| NotificationType | 12 tipos (freight_created, freight_assigned, etc.) |
| DocumentStep | request, assignment, load_confirmation, delivery_confirmation, cancellation |

### Modelo WeighTicket (NUEVO — detalle)

```prisma
model WeighTicket {
  id             String   @id @default(uuid())
  freightId      String   @map("freight_id")
  assignmentId   String?  @map("assignment_id")
  type           String   @default("destination") @db.VarChar(20)  // "origin" | "destination"
  ticketNumber   String?  @map("ticket_number") @db.VarChar(100)
  grossWeight    Decimal? @map("gross_weight") @db.Decimal(10, 2)
  tareWeight     Decimal? @map("tare_weight") @db.Decimal(10, 2)
  netWeight      Decimal? @map("net_weight") @db.Decimal(10, 2)
  humidity       Decimal? @db.Decimal(5, 2)
  impurities     Decimal? @db.Decimal(5, 2)
  dockage        Decimal? @db.Decimal(10, 2)
  temperature    Decimal? @db.Decimal(5, 2)
  observations   String?  @db.Text
  photoUrl       String?  @map("photo_url") @db.VarChar(500)
  ocrData        Json?    @map("ocr_data")
  ocrConfidence  Decimal? @map("ocr_confidence") @db.Decimal(3, 2)
  registeredById String   @map("registered_by_id")
  registeredAt   DateTime @default(now()) @map("registered_at")
  @@index([freightId, assignmentId, type])
  @@map("weigh_tickets")
}
```

---

## 4. AUTENTICACIÓN Y SEGURIDAD

### Flujo de autenticación

1. **Login** → `POST /auth/login` con email/phone + password
2. Backend genera JWT (access token, 30min) + refresh token (7d)
3. Access token se envía en **HttpOnly cookie** (`access_token`, Secure, SameSite=Lax)
4. Refresh token en **HttpOnly cookie** (`refresh_token`)
5. Frontend NO almacena tokens — solo user metadata en localStorage
6. Refresh silencioso: `POST /auth/refresh` con cookie automática

### Guards

| Guard | Ubicación | Función |
|-------|----------|---------|
| JwtAuthGuard | `common/guards/jwt-auth.guard.ts` | Verifica JWT desde cookie o header |
| RolesGuard | `common/guards/roles.guard.ts` | Valida @Roles() decorator; platform_admin bypassa verificando DB |
| FreightAccessGuard | `common/guards/freight-access.guard.ts` | Verifica que la empresa del usuario participa en el flete |

### Rate Limiting

- **Global:** 500 req/min por IP (ThrottlerModule en app.module.ts)
- **Login:** 5 req/min
- **OCR:** 20 req/min
- **WeighTicket OCR:** 10 req/min
- **WhatsApp router:** 30 msgs/min por teléfono
- **WhatsApp AI:** 20 msgs/5min por usuario
- **WhatsApp flows:** 30 msgs/5min por usuario

### Protecciones adicionales

- Helmet (headers de seguridad)
- CORS configurado por env var
- Bcrypt con salt rounds automáticos
- Account lockout (5 intentos fallidos → bloqueo)
- HMAC signature verification (webhook WhatsApp)
- SSRF protection en descarga de media WhatsApp (whitelist de CDN hosts)
- Cookie-parser para HttpOnly cookies

---

## 5. API ENDPOINTS — INVENTARIO COMPLETO

### Auth (`/auth/`) — 13 endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/auth/ping` | Health ping |
| POST | `/auth/login` | Login (email/phone + password) |
| POST | `/auth/register` | Registro |
| POST | `/auth/identify-for-reset` | Identificar usuario para reset |
| POST | `/auth/request-code` | Solicitar código WhatsApp |
| POST | `/auth/verify-code` | Verificar código |
| POST | `/auth/reset-password` | Resetear contraseña |
| POST | `/auth/refresh` | Refresh token |
| POST | `/auth/logout` | Logout |
| POST | `/auth/switch-company` | Cambiar empresa activa |
| PATCH | `/auth/password` | Cambiar contraseña |
| GET | `/auth/me/companies` | Mis empresas |
| PATCH | `/auth/me/onboarding-complete` | Marcar onboarding |

### Freights (`/freights/`) — 30 endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/freights` | Crear flete |
| GET | `/freights` | Listar fletes (filtros + paginación) |
| GET | `/freights/:id` | Detalle de flete |
| GET | `/freights/:id/summary` | Resumen ligero |
| GET | `/freights/:id/detail-extra` | Documentos, conversación, cambios pendientes |
| PATCH | `/freights/:id` | Editar flete |
| POST | `/freights/:id/assign` | Asignar transportista |
| POST | `/freights/:id/respond` | Aceptar/rechazar asignación |
| POST | `/freights/:id/start` | Iniciar viaje |
| POST | `/freights/:id/confirm-loaded` | Confirmar carga |
| POST | `/freights/:id/confirm-finished` | Confirmar entrega |
| POST | `/freights/:id/finish` | Finalizar |
| POST | `/freights/:id/cancel` | Cancelar |
| POST | `/freights/:id/authorize` | Autorizar flota propia |
| POST | `/freights/:id/assign-multi` | Asignar múltiples camiones |
| POST | `/freights/:id/assign-truck` | Agregar camión |
| POST | `/freights/:id/assignments/:aId/cancel` | Cancelar asignación |
| PATCH | `/freights/:id/assignments/:aId` | Editar asignación |
| POST | `/freights/:id/assignments/:aId/respond` | Responder viaje |
| POST | `/freights/:id/assignments/:aId/start` | Iniciar viaje específico |
| POST | `/freights/:id/assignments/:aId/confirm-loaded` | Confirmar carga viaje |
| POST | `/freights/:id/assignments/:aId/confirm-finished` | Confirmar entrega viaje |
| POST | `/freights/:id/pending-changes/:changeId/approve` | Aprobar cambio |
| POST | `/freights/:id/pending-changes/:changeId/reject` | Rechazar cambio |
| POST | `/freights/:id/tracking` | Enviar punto GPS |
| GET | `/freights/:id/tracking` | Historial tracking |
| GET | `/freights/:id/tracking/last` | Última posición |
| GET | `/freights/:id/tracking/participants` | Posiciones participantes |
| GET | `/freights/:id/audit` | Historial de cambios |
| POST | `/freights/:id/documents` | Registrar documento |
| DELETE | `/freights/:id/documents/:docId` | Eliminar documento |
| PATCH | `/freights/:id/documents/:docId/ocr` | Guardar datos OCR |

### Freight Drivers (`/freights/drivers/`) — 3 endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/freights/drivers` | Choferes disponibles |
| GET | `/freights/drivers/:driverId/queue` | Cola del chofer |
| POST | `/freights/drivers/:driverId/reorder` | Reordenar cola |

### Weigh Tickets *(NUEVO)* (`/freights/:id/weigh-tickets/`) — 6 endpoints
| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| POST | `/freights/:id/weigh-tickets` | Crear ticket de pesaje | plant, transporter, producer |
| GET | `/freights/:id/weigh-tickets` | Listar tickets (?type=origin/destination) | FreightAccessGuard |
| GET | `/freights/:id/weigh-tickets/:ticketId` | Detalle ticket | FreightAccessGuard |
| PATCH | `/freights/:id/weigh-tickets/:ticketId` | Editar ticket | plant, transporter, producer |
| DELETE | `/freights/:id/weigh-tickets/:ticketId` | Eliminar ticket | plant |
| POST | `/freights/:id/weigh-tickets/:ticketId/ocr` | Ejecutar OCR en foto | plant, transporter, producer (10/min) |

### Freight Public — 8 endpoints (sin auth)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/f/:code` | Flete por código |
| GET | `/f/:code/position` | Posición por código |
| GET | `/f/:code/participants` | Participantes por código |
| GET | `/f/:code/report` | Datos para PDF |
| GET | `/track/:token` | Flete por share token |
| GET | `/track/:token/position` | Posición por token |
| GET | `/track/:token/participants` | Participantes por token |
| GET | `/track/:token/report-data` | Datos por token |

### Catalog (`/catalog/`) — 5 endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/catalog/plants` | Plantas accesibles |
| GET | `/catalog/branches` | Sucursales accesibles |
| GET | `/catalog/lots` | Lotes del usuario |
| GET | `/catalog/transport-companies` | Transportistas |
| GET | `/catalog/all` | Catálogo consolidado |

### Fields (`/fields/`) — 11 endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/fields` | Listar campos con lotes |
| POST | `/fields` | Crear campo |
| PATCH | `/fields/:id` | Editar campo |
| GET | `/fields/:fieldId/lots` | Listar lotes |
| POST | `/fields/:fieldId/lots` | Crear lote |
| PATCH | `/fields/:fieldId/lots/:lotId` | Editar lote |
| GET | `/fields/pois` | Listar POIs |
| POST | `/fields/pois` | Crear POI |
| PATCH | `/fields/pois/:poiId` | Editar POI |
| PATCH | `/fields/pois/:poiId/delete` | Eliminar POI (soft) |
| POST | `/fields/import-google-list` | Importar lista Google Maps |
| POST | `/fields/import-links` | Parsear links |
| POST | `/fields/import-confirm` | Confirmar importación |

### Trucks (`/trucks/`) — 6 endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/trucks` | Registrar camión |
| GET | `/trucks` | Listar camiones |
| PATCH | `/trucks/:id/deactivate` | Desactivar camión |
| POST | `/trucks/drivers` | Crear chofer |
| GET | `/trucks/drivers` | Listar choferes |
| PATCH | `/trucks/drivers/:id/deactivate` | Desactivar chofer |

### Plant Access (`/plant-access/`) — 8 endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/plant-access/plant-companies` | Empresas planta |
| GET | `/plant-access/search-company` | Buscar empresas |
| GET | `/plant-access/search-producer` | Buscar productores |
| GET | `/plant-access/my-facilities` | Mis plantas/sucursales |
| POST | `/plant-access/grant` | Otorgar acceso |
| PATCH | `/plant-access/revoke/:accessId` | Revocar acceso |
| GET | `/plant-access/producers` | Listar productores autorizados |
| GET | `/plant-access/plants` | Mis plantas autorizadas |

### Notifications (`/notifications/`) — 5 endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/notifications/subscribe` | Suscribirse a push |
| DELETE | `/notifications/subscribe` | Desuscribirse |
| GET | `/notifications` | Listar notificaciones |
| PATCH | `/notifications/:id/read` | Marcar como leída |
| PATCH | `/notifications/read-all` | Marcar todas como leídas |

### Conversations (`/conversations/`) — 9 endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/conversations/search-users` | Buscar usuarios para chat |
| POST | `/conversations/start` | Iniciar conversación |
| GET | `/conversations` | Listar conversaciones |
| PATCH | `/conversations/:id/read` | Marcar como leída |
| GET | `/conversations/:id/messages` | Mensajes (paginados) |
| POST | `/conversations/:id/messages` | Enviar mensaje |
| POST | `/conversations/:id/typing` | Indicador de escritura |
| PATCH | `/conversations/:id/pin` | Fijar/desfijar |
| PATCH | `/conversations/:id/mark-unread` | Marcar como no leída |

### SSE (`/sse/`) — 2 endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/sse/ticket` | Obtener ticket SSE |
| GET | `/sse/stream` | Stream SSE |

### OCR (`/ocr/`) — 1 endpoint
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/ocr/analyze` | Analizar documento por URL |

### Web Chat (`/web-chat/`) — 3 endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/web-chat/message` | Mensaje de texto al AI |
| POST | `/web-chat/audio` | Mensaje de audio (Whisper) |
| GET | `/web-chat/history` | Historial de chat |

### WhatsApp (`/whatsapp/`) — 9 endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/whatsapp/webhook` | Verificación Meta |
| POST | `/whatsapp/webhook` | Recibir mensajes |
| POST | `/whatsapp/location-token` | Token para location picker |
| POST | `/whatsapp/save-location` | Guardar ubicación |
| POST | `/whatsapp/save-location-by-slug` | Guardar por slug |
| GET | `/whatsapp/daily-map-data` | Datos mapa diario |
| POST | `/whatsapp/live-location` | Upsert ubicación live |
| GET | `/whatsapp/live-locations` | Ubicaciones activas |
| POST | `/whatsapp/live-location/stop` | Detener live location |

### Admin (`/admin/`) — ~19 endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/admin/companies` | Crear empresa |
| GET | `/admin/companies` | Listar empresas |
| GET | `/admin/companies/:id` | Detalle empresa |
| PATCH | `/admin/companies/:id` | Editar empresa |
| DELETE | `/admin/companies/:id` | Eliminar empresa (soft) |
| POST | `/admin/companies/:cId/users` | Crear usuario |
| GET | `/admin/companies/:cId/users` | Listar usuarios |
| PATCH | `/admin/companies/:cId/users/:uId` | Editar usuario |
| PATCH | `/admin/companies/:cId/users/:uId/deactivate` | Desactivar usuario |
| POST | `/admin/plants` | Crear planta |
| GET | `/admin/plants` | Listar plantas |
| GET | `/admin/plants/:id` | Detalle planta |
| PATCH | `/admin/plants/:id` | Editar planta |
| DELETE | `/admin/plants/:id` | Eliminar planta |
| POST | `/admin/branches` | Crear sucursal |
| GET | `/admin/branches` | Listar sucursales |
| GET | `/admin/branches/:id` | Detalle sucursal |
| PATCH | `/admin/branches/:id` | Editar sucursal |
| DELETE | `/admin/branches/:id` | Eliminar sucursal |

**Total: ~140+ endpoints**

---

## 6. FRONTEND — ESTRUCTURA ACTUAL

### Descomposición (NUEVO vs v1)

La auditoría v1 tenía archivos monolíticos. El refactor los descompuso:

| Archivo original | Archivos resultantes | Nota |
|-----------------|---------------------|------|
| `App.jsx` (~850 líneas) | `providers/AuthProvider.jsx`, `providers/SSEProvider.jsx`, `routing/Router.jsx`, `layout/AppLayout.jsx`, `layout/AppShell.jsx` | App.jsx queda como orquestador mínimo |
| `hooks.jsx` (~500 líneas) | `hooks/useAuth.jsx`, `hooks/useFreights.jsx`, `hooks/useCatalog.jsx`, `hooks/useNotifications.jsx`, `hooks/useSSE.jsx`, `hooks/useResponsive.jsx`, `hooks/useTableInteractions.jsx`, `hooks/helpers.jsx`, `hooks/index.js` | hooks.jsx re-exporta para backward compat |
| `components.jsx` (~973 líneas) | `components/buttons.jsx`, `components/form.jsx`, `components/feedback.jsx`, `components/overlays.jsx`, `components/data-display.jsx`, `components/navigation.jsx`, `components/index.js` | components.jsx re-exporta |

### Árbol de archivos actual

```
src/
├── AiChat.jsx                    # Chat AI embebido
├── App.jsx                       # Entry point (orquestador)
├── api.js                        # Cliente HTTP (95 funciones)
├── components.jsx                # Re-export barrel (backward compat)
├── constants.jsx                 # Constantes (estados, acciones, colores)
├── hooks.jsx                     # Re-export barrel (backward compat)
├── logger.js                     # Logger con niveles
├── main.jsx                      # React root
├── maps.jsx                      # FreightMap, MapOverlay, LocPicker, SafeZone
├── routes-bg.jsx                 # Fondo animado con rutas
├── sentry.js                     # Sentry init
├── store.js                      # Zustand stores (3) + offlineQueue
├── theme.jsx                     # Tokens de diseño (C, Ic, FONT, MONO)
├── uploads.jsx                   # PhotoUpload, DocsGallery, FreightFileUpload, OcrResultModal
├── validation.jsx                # Validación de formularios
│
├── components/                   # Componentes reutilizables
│   ├── index.js                  # Barrel export
│   ├── buttons.jsx               # Btn (memoized)
│   ├── form.jsx                  # Field, NumericStepper, Select, Sec
│   ├── feedback.jsx              # Toast, Loader, LoadingOverlay, EmptyState, Skeletons, ErrorBoundary
│   ├── overlays.jsx              # ModalOverlay, AttachMenu, FileViewer
│   ├── data-display.jsx          # Av, Bd, Tabs, SortTh, exportCSV/Excel/PDF
│   ├── navigation.jsx            # Sidebar, Nav, NotifBell, NotificationsPanel
│   └── WeighTicketForm.jsx       # (NUEVO) WeighTicketForm, WeighTicketSummary
│
├── hooks/                        # Hooks custom
│   ├── index.js                  # Barrel export
│   ├── useAuth.jsx               # Auth hook
│   ├── useFreights.jsx           # CRUD + optimistic updates
│   ├── useCatalog.jsx            # Catálogo con cache
│   ├── useNotifications.jsx      # Push + in-app
│   ├── useSSE.jsx                # Server-Sent Events
│   ├── useResponsive.jsx         # useIsDesktop, useOnline
│   ├── useTableInteractions.jsx  # useTableSort, usePullToRefresh
│   └── helpers.jsx               # mapFreight, mapUser, originDisplay, destDisplay, permsFor
│
├── providers/                    # Context providers
│   ├── AuthProvider.jsx          # Auth state, company switching, simple mode
│   └── SSEProvider.jsx           # SSE connection, event dispatch
│
├── routing/
│   └── Router.jsx                # Lazy imports, route map, screen derivation, public routes
│
├── layout/
│   ├── AppLayout.jsx             # Layout principal (sidebar, modals, nav, content)
│   └── AppShell.jsx              # Shell wrapper (auth gating)
│
├── screens/                      # 25 pantallas
│   ├── HomeScreen.jsx            # Dashboard con cards de acción
│   ├── ListScreen.jsx            # Lista con filtros, tabla/cards, paginación
│   ├── DetailScreen.jsx          # Detalle de flete (~998 líneas)
│   ├── NewScreen.jsx             # Creación multi-step
│   ├── EditScreen.jsx            # Edición de flete
│   ├── AuthScreen.jsx            # Login/registro
│   ├── CalendarScreen.jsx        # Vista calendario
│   ├── MenuScreen.jsx            # Menú principal
│   ├── TrucksScreen.jsx          # Gestión de camiones
│   ├── FieldsScreen.jsx          # Gestión de campos/lotes
│   ├── LocationsScreen.jsx       # Gestión de ubicaciones
│   ├── AdminScreen.jsx           # Panel admin
│   ├── MyDataScreen.jsx          # Datos personales
│   ├── ReportsScreen.jsx         # Reportes
│   ├── ChatsScreen.jsx           # Mensajería
│   ├── NotificationsScreen.jsx   # Notificaciones
│   ├── AccessScreen.jsx          # Acceso planta-productor
│   ├── LandingScreen.jsx         # Landing/onboarding
│   ├── CompanyHeaderPicker.jsx   # Selector de empresa
│   ├── TrackFreightScreen.jsx    # Tracking público
│   ├── LiveFreightScreen.jsx     # Tracking live
│   ├── PickLocationScreen.jsx    # Selector de ubicación
│   ├── DailyMapScreen.jsx        # Mapa diario
│   ├── ViewMapScreen.jsx         # Vista de mapa
│   └── ReportDownloadScreen.jsx  # Descarga de reporte
│
├── modals/                       # 8 modales
│   ├── ConfirmActionModal.jsx    # Confirmación genérica
│   ├── WeighTicketConfirmModal.jsx # (NUEVO) Confirmación con ticket de pesaje
│   ├── AssignModal.jsx           # Asignar transportista
│   ├── TruckSelectModal.jsx      # Seleccionar camión
│   ├── ReasonModal.jsx           # Motivo (cancelar/rechazar)
│   ├── EditTripModal.jsx         # Editar viaje
│   ├── DriverQueueModal.jsx      # Cola de chofer
│   └── MapPreviewModal.jsx       # Preview de mapa
│
├── utils/
│   ├── freight-helpers.jsx       # resolveUserTypeForFreight, getPendingActions
│   └── pdf-report.js             # Generación de PDF con jsPDF
│
└── test/                         # 7 archivos de test
    ├── setup.js                  # Test setup
    ├── api.test.js               # Tests de api.js
    ├── store.test.js             # Tests de stores
    ├── hooks.test.jsx            # Tests de hooks
    ├── constants.test.js         # Tests de constantes
    ├── validation.test.js        # Tests de validación
    └── freight-helpers.test.js   # Tests de helpers
```

### Conteo de archivos

- **Total .jsx:** 66 archivos
- **Total .js:** 13 archivos
- **Total archivos src/:** 79

---

## 7. FRONTEND — COMPONENTES Y DISEÑO

### Sistema de diseño (theme.jsx)

**Colores (C):**
- Primary: `#1A6B37` (verde Tolvink)
- Accent: `#FF6A00` (naranja)
- Secondary: `#0891B2` (cyan)
- OK: `#22c55e`, Error: `#ef4444`, Warn: `#f59e0b`, Info: `#3b82f6`
- Backgrounds, borders, text levels (t1, t2, t3)

**Tipografía:**
- FONT: `"Inter", -apple-system, sans-serif`
- MONO: `"JetBrains Mono", "Fira Code", monospace`

**Iconos (Ic):** 60+ funciones SVG inline (chk, cross, truck, grain, user, cam, doc, edit, etc.)

### Componentes reutilizables

| Componente | Archivo | Descripción |
|-----------|---------|-------------|
| Btn | buttons.jsx | Botón con 5 variantes (pri, acc, sec, ghost, err), memoized |
| Field | form.jsx | Input con label, ícono, error state, password toggle |
| NumericStepper | form.jsx | Input numérico con +/- |
| Select | form.jsx | Dropdown custom (native en mobile) |
| Sec | form.jsx | Sección colapsable con indicador de completitud |
| Toast | feedback.jsx | Notificación temporal (ok/err/warn/info) |
| Loader | feedback.jsx | Spinner |
| LoadingOverlay | feedback.jsx | Overlay full-screen con logo animado |
| EmptyState | feedback.jsx | Estado vacío con ícono y acción |
| SkeletonCard/List/Detail | feedback.jsx | Shimmer loading placeholders |
| ErrorBoundary | feedback.jsx | Class component con Sentry |
| ModalOverlay | overlays.jsx | Modal con animación (logo → card → closing) |
| AttachMenu | overlays.jsx | Menú de adjuntos (cámara, galería, archivos) |
| FileViewer | overlays.jsx | Visor de archivos con zoom |
| Av | data-display.jsx | Avatar con iniciales |
| Bd | data-display.jsx | Badge de color |
| Tabs | data-display.jsx | Tab switcher |
| SortTh | data-display.jsx | Header de tabla ordenable |
| Sidebar | navigation.jsx | Sidebar desktop con búsqueda, empresa, navegación |
| Nav | navigation.jsx | Nav bottom mobile |
| NotifBell | navigation.jsx | Campana con badge |
| NotificationsPanel | navigation.jsx | Panel dropdown de notificaciones |
| **WeighTicketForm** *(NUEVO)* | WeighTicketForm.jsx | Formulario de pesaje (foto+OCR o manual) |
| **WeighTicketSummary** *(NUEVO)* | WeighTicketForm.jsx | Display read-only de tickets |
| **WeighTicketConfirmModal** *(NUEVO)* | modals/WeighTicketConfirmModal.jsx | Modal 3 pasos: elegir → ticket → confirmar |

---

## 8. GESTIÓN DE ESTADO

### Zustand Stores (store.js)

| Store | Propósito | Keys principales |
|-------|----------|------------------|
| useUIStore | Estado de UI global | modal, toast, mapFocus, listView, submitting, actionLoading, notifOpen, chatConvId, duplicateData, editData, locPicker |
| useCatalogStore | Cache de catálogo multi-tenant | cache (keyed by userId), TTL-based |
| useFreightDetailStore | Cache de detalle de flete | details (keyed by freightId), 2min TTL, invalidate() |
| offlineQueue | Cola offline IndexedDB | enqueue, getAll, remove, count, clear |

**Sin cambios desde v1** — la arquitectura de stores se mantiene igual.

---

## 9. LÓGICA DE NEGOCIO — FLETES

### State Machine

```
draft → pending_assignment → assigned → accepted → in_progress → loaded → finished
                                                                            ↓
                                    (cualquier estado) ──────────────── canceled
```

- **pending_assignment:** Flete creado, esperando asignación de transportista
- **assigned:** Transportista asignado, esperando aceptación
- **accepted:** Aceptado por transportista (o autorizado por planta si flota propia)
- **in_progress:** Viaje iniciado, camión en ruta a campo
- **loaded:** Carga confirmada (cross-confirmation), camión en ruta a planta
- **finished:** Entrega confirmada (cross-confirmation)

### Cross-confirmations

**Carga (in_progress → loaded):**
- Requiere confirmación de **transportista** + **productor**
- Ambas partes ven botón "Confirmar carga" independientemente
- Cuando ambos confirman → status pasa a "loaded"

**Entrega (loaded → finished):**
- Requiere confirmación de **transportista** + **planta**
- Mismo patrón que carga

### Multi-truck (v6.0)

- Freight puede tener `truckCount > 1`
- Cada camión tiene su propio `FreightAssignment` con `tripStatus` independiente
- TripStatus sigue la misma state machine pero a nivel viaje
- Status del freight se deriva del estado agregado de los viajes

### Tickets de Pesaje — Integración en flujo (NUEVO)

**Flujo de confirmación modificado:**

1. Usuario presiona "Confirmar carga" o "Confirmar entrega"
2. Se abre `WeighTicketConfirmModal` en lugar de `ConfirmActionModal`
3. **Paso 1 (Choose):** "¿Agregar ticket de pesaje?" → Sí (registrar) / No (directo)
4. **Paso 2 (Ticket):** Si eligió sí → WeighTicketForm con dos modos:
   - **Foto + OCR:** Subir foto → crear ticket → ejecutar OCR → llenar campos → revisar
   - **Manual:** Completar campos a mano → guardar
5. **Paso 3 (Confirm):** Confirmación final con input de toneladas (para carga)

**Tipos de ticket:**
- `origin` — Pesaje en campo (se crea al confirmar carga)
- `destination` — Pesaje en planta (se crea al confirmar entrega)

**Permisos por tipo:**
- Origin: productor o transportista pueden crear
- Destination: planta o transportista pueden crear
- Eliminar: solo planta

**Comparación origen/destino:**
- Al crear ticket de destino, se obtienen tickets de origen
- Se muestra diferencia de peso neto (kg y %)
- Indicador visual: verde si <2%, amarillo/naranja si >2%

---

## 10. MÓDULO WHATSAPP AI

### Arquitectura

```
whatsapp/
├── whatsapp.controller.ts     (756 líneas) — Webhook Meta + endpoints públicos
├── whatsapp.service.ts        (792 líneas) — Meta Cloud API client
├── whatsapp-router.service.ts (1867 líneas) — Router de mensajes + sesiones
├── whatsapp-flow.service.ts   (1560 líneas) — Flujos conversacionales multi-step
└── whatsapp.module.ts         (18 líneas)  — Módulo NestJS

ai/
├── ai.service.ts              — Claude AI conversacional
├── ai.constants.ts            — Configuración del modelo
├── ai-tool-definitions.ts     (44KB) — Definiciones de tools
└── ai-tool-handlers.ts        — Handlers de tools
```

### Configuración del modelo AI

| Parámetro | Valor |
|-----------|-------|
| Modelo principal | claude-sonnet-4-6 |
| Modelo rápido | claude-haiku-4-5 |
| Temperatura | 0.4 |
| Max tokens | 1200 |
| Max historial | 25 mensajes |
| Max tool loops | 5 |
| Sesión timeout | 30 minutos |
| Stale session | 10 minutos (inyecta contexto) |

### Selección de modelo (Fast vs Full)

- **Haiku (rápido):** Saludos, status checks, "mis fletes", mensajes <40 chars
- **Sonnet (completo):** Creación de fletes, análisis, adjuntar documentos
- Primera iteración: modelo seleccionado; loops de tools: siempre Sonnet

### Tools por rol

| Grupo | Tools | Roles |
|-------|-------|-------|
| Core | confirm_action, list_freights, get_freight_detail, summarize_freights | Todos |
| Chofer | accept_freight, reject_freight, start_freight, tracking | chofer |
| Productor | prepare_freight, create_field, create_lot, assign_truck | producer |
| Planta | assign_transporter, authorize_freight, grant_producer_access | plant |
| Transportista | respond_trip, confirm_trip_loaded | transporter |
| Admin | create_user, update_user_role, deactivate_user, list_company_users | admin |
| Multi-empresa | switch_company | Solo si >1 membresía |

### Mejoras implementadas (resumen de P0/P1/P2)

**P0 (Críticos resueltos):**
- **Roles scoped a empresa activa** — Antes el rol era global; ahora se verifica contra `activeCompanyId` y membresías
- **`_sessionCompanyId`** — Se captura al preparar flete para consistencia en confirm

**P1 (Importantes resueltos):**
- **System prompt reescrito** — Instrucciones por rol, datos proactivos pre-cargados
- **Fuzzy search mejorado** — Substring matching, normalización (seseo/yeísmo/b-v), Levenshtein distance, GRAIN_ALIASES, ENTITY_ALIASES
- **Datos proactivos** — Campos, lotes, plantas accesibles, fletes recientes, camiones/choferes inyectados en prompt
- **Flota propia auto-resolve** — Si productor tiene 1 solo camión, lo pre-selecciona
- **Sesión con contexto recuperado** — Al expirar sesión, el contexto previo se inyecta como `_recoveredContext`
- **Retry en envío a Meta** — 3 intentos con backoff exponencial (1s, 3s, 9s), Sentry en fallo

**P2 (Menores resueltos):**
- **Paginación en listas** — `sendSelection()` con 9-10 items por página + "Mostrar más"
- **Stale session detection** — Si pasaron >10 min, inyecta nota "[Sistema: pasaron X min]"
- **Tool result trimming** — Max 800 chars por resultado para evitar bloat

### Tipos de mensaje manejados

| Tipo | Procesamiento |
|------|--------------|
| Texto | AI chat o continuación de flujo |
| Botones (reply) | Resolución de selección + contexto AI |
| Listas (reply) | Resolución de selección + contexto AI |
| Audio | OpenAI Whisper → transcripción → AI |
| Ubicación | GPS write (cooldown 30s por usuario) |
| Media (foto/doc) | Descarga → OCR o adjuntar a flete |

### Flujos conversacionales (multi-step)

| Flujo | Pasos | Timeout |
|-------|-------|---------|
| reject_freight | Seleccionar flete → motivo → confirmar | 10 min |
| confirm_loaded | Seleccionar flete → toneladas → confirmar | 10 min |
| cancel_freight | Seleccionar flete → motivo → confirmar | 10 min |
| create_freight | Grano → toneladas → origen → destino → fecha → confirmar | 10 min |

### Tareas programadas

| Tarea | Intervalo | Función |
|-------|----------|---------|
| cleanupExpired | 30 min | Limpia sesiones expiradas, tokens, tracking >90d |
| checkStaleFreights | (desactivado) | Recordatorio de fletes estancados >2h |
| checkDailySummary | (desactivado) | Resumen diario 10 AM UY |

---

## 11. MÓDULO DE TICKETS DE PESAJE (NUEVO)

### Modelo de datos

Ver modelo `WeighTicket` en sección 3. Campos clave:
- **type:** `origin` (campo) o `destination` (planta)
- **Pesos:** grossWeight, tareWeight, netWeight (auto-calculado si gross+tare)
- **Calidad:** humidity (%), impurities (%), dockage, temperature (°C)
- **OCR:** photoUrl, ocrData (JSON), ocrConfidence (0-1)
- **Relaciones:** freightId (obligatorio), assignmentId (opcional, para multi-truck)

### Endpoints (6)

| Endpoint | Descripción | Roles |
|----------|-------------|-------|
| `POST /freights/:id/weigh-tickets` | Crear ticket | plant, transporter, producer |
| `GET /freights/:id/weigh-tickets` | Listar (filtro ?type=) | FreightAccessGuard |
| `GET /freights/:id/weigh-tickets/:ticketId` | Detalle | FreightAccessGuard |
| `PATCH /freights/:id/weigh-tickets/:ticketId` | Editar | plant, transporter, producer |
| `DELETE /freights/:id/weigh-tickets/:ticketId` | Eliminar | plant |
| `POST /freights/:id/weigh-tickets/:ticketId/ocr` | Ejecutar OCR | plant, transporter, producer (10/min) |

### Servicio backend (weigh-tickets.service.ts)

- **create():** Valida rol vs tipo (origin=producer/transporter, dest=plant/transporter), auto-calcula netWeight
- **findAll():** Filtra por tipo, ordena por registeredAt desc
- **findOne():** Incluye datos de asignación
- **update():** Recalcula netWeight si cambian gross/tare
- **remove():** Hard delete (solo planta)
- **runOcr():** Llama a OcrService con docType `pesaje`, llena solo campos null (ediciones manuales tienen prioridad), maneja nombres en español e inglés

### OCR Prompt

El prompt solicita a Claude Vision extraer:
- ticketNumber, grossWeight, tareWeight, netWeight
- humidity, impurities, temperature, dockage
- plate, product, date, time, observations
- fieldConfidence por campo + overallConfidence

Notas del prompt: maneja tickets térmicos, impresos, manuscritos; convierte toneladas a kg; busca variantes de nombres.

### Flujo de UX frontend

**WeighTicketForm.jsx — Dos modos:**

1. **Foto + OCR:**
   - Usuario toma foto → `uploadPhoto()` a Supabase
   - Se crea ticket con photoUrl → `apiCreateWeighTicket()`
   - Se ejecuta OCR → `apiRunWeighTicketOcr()`
   - Campos se llenan con resultados OCR
   - Usuario revisa/corrige → `apiUpdateWeighTicket()`

2. **Manual:**
   - Usuario completa campos manualmente
   - Guardar → `apiCreateWeighTicket()` con todos los campos

**WeighTicketConfirmModal.jsx — 3 pasos:**

1. **Elegir:** "¿Agregar ticket?" → Sí / No, confirmar directo
2. **Ticket:** WeighTicketForm embebido + opción de omitir
3. **Confirmar:** Modal estándar (toneladas para carga) + badge "Ticket registrado"

**WeighTicketSummary — Display en DetailScreen:**

- Se muestra en la sección de progreso/cross-confirmations
- Tickets de origen bajo "Carga", tickets de destino bajo "Entrega"
- Para fletes finalizados, sección separada "Tickets de Pesaje"
- Muestra: número, bruto/tara/neto, humedad, impurezas, badge OCR%

### Comparación origen vs destino

Cuando se crea ticket de destino:
- Se obtienen tickets de origen del flete
- Se calcula diferencia de peso neto
- Indicador visual: verde si diferencia <2% del peso origen, naranja/amarillo si >2%

---

## 12. TESTS

### Backend (tolvink-api) — 6 archivos, ~215 tests

| Archivo | Tests | Estado |
|---------|-------|--------|
| `freights/__tests__/freight-state-machine.spec.ts` | 66 | Passing (pre-existente) |
| `freights/freights.service.spec.ts` | 56 | 33 failing (pre-existentes, no por cambios recientes) |
| `weigh-tickets/__tests__/weigh-tickets.service.spec.ts` | 30 | **Passing (NUEVO)** |
| `auth/auth.service.spec.ts` | 25 | Algunos failing (pre-existente) |
| `freights/freight-state-machine.service.spec.ts` | 20 | Passing (pre-existente) |
| `common/services/company-resolution.service.spec.ts` | 18 | Algunos failing (pre-existente) |

**Tests de weigh-tickets (NUEVO — 30 tests):**
- CRUD completo (create, findAll, findOne, update, remove)
- Validación de roles por tipo (origin vs destination)
- Auto-cálculo de netWeight
- OCR field merging (español + inglés)
- Filtrado por tipo
- Manejo de errores (not found, forbidden)

### Frontend (Tolvink) — 6 archivos de test

| Archivo | Descripción |
|---------|-------------|
| `test/api.test.js` | Tests del cliente API |
| `test/store.test.js` | Tests de Zustand stores |
| `test/hooks.test.jsx` | Tests de hooks custom |
| `test/constants.test.js` | Tests de constantes |
| `test/validation.test.js` | Tests de validación |
| `test/freight-helpers.test.js` | Tests de helpers de flete |

### Cobertura por área

| Área | Cobertura | Nota |
|------|-----------|------|
| Freight state machine | Alta | 86 tests |
| Freight service CRUD | Media | 56 tests pero algunos failing |
| Weigh tickets service | Alta (NUEVO) | 30 tests, todos passing |
| Auth service | Baja-Media | 25 tests, algunos failing |
| Company resolution | Baja | 18 tests, algunos failing |
| WhatsApp/AI | **Ninguna** | Sin tests |
| Frontend components | **Ninguna** | Sin tests de componentes React |
| Frontend E2E | **Ninguna** | Sin tests E2E |

---

## 13. DEUDA TÉCNICA

### Resuelto desde v1

| Ítem | Resolución |
|------|-----------|
| App.jsx monolítico (~850 líneas) | Descompuesto en providers/, routing/, layout/ |
| hooks.jsx monolítico (~500 líneas) | Descompuesto en hooks/ (8 archivos) |
| components.jsx monolítico (~973 líneas) | Descompuesto en components/ (7 archivos) |
| 0 tests de backend | 215 tests agregados (6 archivos) |
| WhatsApp roles globales (P0) | Roles scoped a empresa activa |
| WhatsApp sin fuzzy search | Fuzzy search con Levenshtein + alias |
| WhatsApp sin datos proactivos | Datos pre-cargados en system prompt |
| WhatsApp sin retry de envío | 3 retries con backoff exponencial |

### Deuda nueva introducida

| Ítem | Severidad | Detalle |
|------|----------|---------|
| DetailScreen.jsx (~998 líneas) | Media | Sigue siendo un god component, candidato a descomposición |
| Inline styles everywhere | Baja | Persiste en todo el proyecto; funciona pero dificulta temas/dark mode |
| WeighTicketForm dynamic import | Baja | `import("../api")` dinámico en handleSave para apiUpdateWeighTicket |
| 33 tests failing pre-existentes | Media | freights.service.spec.ts tiene 33 tests que fallan (no por cambios recientes) |

### Deuda pendiente (de v1, sin resolver)

| Ítem | Severidad | Nota |
|------|----------|------|
| Sin CI/CD pipeline | Alta | No hay GitHub Actions ni pipeline de deploy automatizado |
| Sin tests E2E | Alta | No hay tests de integración end-to-end |
| Sin tests de componentes React | Media | Vitest configurado pero sin tests de componentes |
| Rate limiting per-instance | Media | No compartido entre instancias (no hay Redis) |
| maps.jsx grande (52KB) | Baja | Contiene FreightMap, MapOverlay, SafeZone, LocPicker |
| uploads.jsx grande (23KB) | Baja | Contiene 5 componentes de upload/galería |
| No dark mode | Baja | Design tokens hardcoded para light mode |
| Sin i18n | Baja | Todo en español, no hay sistema de traducciones |

---

## 14. ESTRUCTURA DE ARCHIVOS — BACKEND

```
tolvink-api/
├── prisma/
│   ├── schema.prisma                        # 29 modelos, 8 enums
│   └── migrations/
│       └── 20260313180000_add_weigh_tickets/ # (NUEVA migración)
│           └── migration.sql
│
├── src/
│   ├── main.ts                              # Bootstrap NestJS
│   ├── app.module.ts                        # Root module (14 módulos importados)
│   ├── catalog.controller.ts                # Catálogo (5 endpoints)
│   │
│   ├── admin/
│   │   ├── admin.controller.ts              # ~19 endpoints admin
│   │   ├── admin.service.ts
│   │   └── admin.module.ts
│   │
│   ├── ai/
│   │   ├── ai.service.ts                    # Claude AI conversacional
│   │   ├── ai.constants.ts                  # Config del modelo
│   │   ├── ai-tool-definitions.ts           # 44KB de tool definitions
│   │   └── ai-tool-handlers.ts              # Handlers de tools
│   │
│   ├── analytics/
│   │   ├── analytics.controller.ts
│   │   ├── analytics.service.ts
│   │   └── analytics.module.ts
│   │
│   ├── auth/
│   │   ├── auth.controller.ts               # 13 endpoints
│   │   ├── auth.service.ts
│   │   ├── auth.service.spec.ts             # 25 tests
│   │   ├── auth.module.ts
│   │   └── jwt.strategy.ts
│   │
│   ├── common/
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── freight-access.guard.ts
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   └── roles.decorator.ts
│   │   └── services/
│   │       ├── company-resolution.service.ts
│   │       └── company-resolution.service.spec.ts  # 18 tests
│   │
│   ├── conversations/
│   │   ├── conversations.controller.ts      # 9 endpoints
│   │   ├── conversations.service.ts
│   │   └── conversations.module.ts
│   │
│   ├── database/
│   │   ├── prisma.service.ts
│   │   └── database.module.ts
│   │
│   ├── fields/
│   │   ├── fields.controller.ts             # 13 endpoints
│   │   ├── fields.service.ts
│   │   └── fields.module.ts
│   │
│   ├── freights/
│   │   ├── freights.controller.ts           # 30+ endpoints
│   │   ├── freights.service.ts
│   │   ├── freights.service.spec.ts         # 56 tests
│   │   ├── freights.module.ts
│   │   ├── freight-state-machine.service.ts
│   │   ├── freight-state-machine.service.spec.ts  # 20 tests
│   │   ├── freight-public.controller.ts     # 4 endpoints públicos
│   │   ├── freight-tracking.controller.ts   # 4 endpoints por token
│   │   └── __tests__/
│   │       └── freight-state-machine.spec.ts      # 66 tests
│   │
│   ├── health/
│   │   └── health.controller.ts
│   │
│   ├── notifications/
│   │   ├── notification.controller.ts       # 5 endpoints
│   │   ├── notification.service.ts
│   │   └── notification.module.ts
│   │
│   ├── ocr/
│   │   ├── ocr.controller.ts                # 1 endpoint
│   │   ├── ocr.service.ts
│   │   └── ocr.module.ts
│   │
│   ├── plant-access/
│   │   ├── plant-access.controller.ts       # 8 endpoints
│   │   ├── plant-access.service.ts
│   │   └── plant-access.module.ts
│   │
│   ├── sse/
│   │   ├── sse.controller.ts                # 2 endpoints
│   │   ├── sse.service.ts
│   │   └── sse.module.ts
│   │
│   ├── trucks/
│   │   ├── trucks.controller.ts             # 6 endpoints
│   │   ├── trucks.service.ts
│   │   └── trucks.module.ts
│   │
│   ├── web-chat/
│   │   ├── web-chat.controller.ts           # 3 endpoints
│   │   ├── web-chat.service.ts
│   │   └── web-chat.module.ts
│   │
│   ├── weigh-tickets/                       # (NUEVO)
│   │   ├── weigh-tickets.controller.ts      # 6 endpoints
│   │   ├── weigh-tickets.service.ts         # CRUD + OCR
│   │   ├── weigh-tickets.dto.ts             # CreateWeighTicketDto, UpdateWeighTicketDto
│   │   ├── weigh-tickets.module.ts
│   │   └── __tests__/
│   │       └── weigh-tickets.service.spec.ts      # 30 tests (NUEVO)
│   │
│   └── whatsapp/
│       ├── whatsapp.controller.ts           # 9 endpoints
│       ├── whatsapp.service.ts              # Meta API client (792 líneas)
│       ├── whatsapp-router.service.ts       # Message routing (1867 líneas)
│       ├── whatsapp-flow.service.ts         # Flujos multi-step (1560 líneas)
│       └── whatsapp.module.ts
│
├── package.json
├── tsconfig.json
├── jest.config.ts
└── nest-cli.json
```

---

> **Resumen de cambios v1 → v2:**
> - +1 modelo Prisma (WeighTicket)
> - +6 endpoints API (weigh-tickets)
> - +3 componentes frontend (WeighTicketForm, WeighTicketSummary, WeighTicketConfirmModal)
> - Descomposición de 3 archivos monolíticos en 20+ módulos
> - +30 tests backend (weigh-tickets)
> - Mejoras sustanciales en WhatsApp AI (roles, fuzzy search, datos proactivos, retry, sesión)
> - Flujo de confirmación de carga/entrega ahora incluye paso opcional de ticket de pesaje
