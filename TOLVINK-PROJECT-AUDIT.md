# TOLVINK — Project Audit

> Comprehensive technical audit of the Tolvink logistics platform.
> Generated: 2026-03-12

---

## Table of Contents

1. [Vision General](#1-visión-general)
2. [Architecture & Stack](#2-architecture--stack)
3. [Modelo de Datos](#3-modelo-de-datos)
4. [Autenticación y Seguridad](#4-autenticación-y-seguridad)
5. [API — Endpoints Completos](#5-api--endpoints-completos)
6. [Frontend — Pantallas y Navegación](#6-frontend--pantallas-y-navegación)
7. [Frontend — Componentes y Sistema de Diseño](#7-frontend--componentes-y-sistema-de-diseño)
8. [Gestión de Estado](#8-gestión-de-estado)
9. [Lógica de Negocio — Fletes (Core)](#9-lógica-de-negocio--fletes-core)
10. [Lógica de Negocio — Campos y Lotes](#10-lógica-de-negocio--campos-y-lotes)

---

## 1. Visión General

Tolvink is a logistics platform for the Argentine/Uruguayan grain freight market. It connects three actors:

- **Productores** (grain producers): Create freight requests from their fields
- **Plantas** (grain elevators/silos): Receive grain, assign transporters
- **Transportistas** (trucking companies): Accept/execute freight jobs

### Core Value Propositions

- **WhatsApp-first experience:** AI-powered bot handles freight creation, tracking, and updates via WhatsApp Business API
- **Real-time tracking:** GPS position sharing, live maps, participant locations
- **Multi-company support:** Users can belong to multiple companies with different roles
- **Document management:** Photo/document upload with OCR for cargo letters (cartas de porte)

### Current Status

Production (Railway + Vercel), active users, PWA with push notifications.

---

## 2. Architecture & Stack

### Frontend (Tolvink repo)

| Technology | Version / Detail |
|---|---|
| React | 18.2 |
| Bundler | Vite |
| State Management | Zustand 5.0 |
| Maps | Google Maps JS API |
| Hosting | Vercel |
| PWA | Service worker enabled |
| CSS | All inline styles (no framework) |
| Font | DM Sans |

### Backend (tolvink-api repo)

| Technology | Version / Detail |
|---|---|
| Framework | NestJS 10.3.0 (Node.js) |
| ORM | Prisma 5.8.0 |
| Database | PostgreSQL (Supabase-hosted) |
| Hosting | Railway |
| Language | TypeScript 5.3 |

### External Services

| Service | Purpose |
|---|---|
| Supabase | PostgreSQL DB + File Storage |
| Meta WhatsApp Business API | Bot messaging |
| Google Maps Platform | Maps JS, Places, Geocoding, Directions |
| Anthropic Claude API | AI agent for WhatsApp bot |
| OpenAI Whisper | Audio transcription (WhatsApp voice notes) |
| Sentry | Error tracking (frontend + backend) |
| Web Push | VAPID-based push notifications |

### Architecture Flow

```
React PWA (Vercel) ──HTTP/SSE──→ NestJS API (Railway) ──Prisma──→ PostgreSQL (Supabase)
                                      │
                                      ├──→ Meta WhatsApp API
                                      ├──→ Claude AI (Anthropic)
                                      ├──→ OpenAI Whisper
                                      ├──→ Supabase Storage
                                      ├──→ Google Maps APIs
                                      └──→ Web Push
```

### Environment Variables

**Backend (required):**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `DIRECT_URL` | Direct DB connection (bypasses pooler) |
| `JWT_SECRET` | JWT signing secret |
| `WHATSAPP_APP_SECRET` | WhatsApp HMAC verification |

**Backend (optional):**

| Variable | Default |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | - |
| `WHATSAPP_ACCESS_TOKEN` | - |
| `WHATSAPP_VERIFY_TOKEN` | - |
| `ANTHROPIC_API_KEY` | - |
| `OPENAI_API_KEY` | - |
| `SUPABASE_URL` | - |
| `SUPABASE_SERVICE_KEY` | - |
| `VAPID_PUBLIC_KEY` | - |
| `VAPID_PRIVATE_KEY` | - |
| `SENTRY_DSN` | - |
| `INTERNAL_API_KEY` | - |
| `PORT` | 4000 |
| `NODE_ENV` | - |
| `JWT_EXPIRES_IN` | 30m |
| `CORS_ORIGIN` | - |
| `FRONTEND_URL` | - |

**Frontend:**

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API URL |
| `VITE_GMAPS_KEY` | Google Maps API key |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `VITE_SENTRY_DSN` | Sentry DSN for frontend |
| `VITE_VAPID_PUBLIC_KEY` | VAPID public key for push |

---

## 3. Modelo de Datos

### Enums

| Enum | Values |
|---|---|
| **CompanyType** | `producer`, `plant`, `transporter` |
| **UserRole** | `admin`, `operator`, `platform_admin` |
| **FreightStatus** | `draft`, `pending_assignment`, `assigned`, `accepted`, `in_progress`, `loaded`, `finished`, `canceled` |
| **AssignmentStatus** | `active`, `accepted`, `rejected`, `canceled` |
| **TripStatus** | `pending`, `accepted`, `in_progress`, `loaded`, `finished`, `canceled` |
| **GrainType** | `Soja`, `Maiz`, `Trigo`, `Girasol`, `Sorgo`, `Cebada`, `Otros` |
| **NotificationType** | `freight_created`, `freight_assigned`, `freight_accepted`, `freight_rejected`, `freight_started`, `freight_loaded`, `freight_confirmed`, `freight_finished`, `freight_canceled`, `freight_updated`, `message_received`, `conversation_started` |
| **DocumentStep** | `request`, `assignment`, `load_confirmation`, `delivery_confirmation`, `cancellation` |

### Models

#### Company

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | String | |
| type | CompanyType | Legacy single-type |
| types | Json | Multi-type array |
| address | String? | |
| phone | String? | |
| email | String? | |
| rut | String? | |
| hasInternalFleet | Boolean | |
| lat | Decimal? | |
| lng | Decimal? | |
| active | Boolean | default: true |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Relations: users, memberships, branches, fields, lots, pois, plants, trucks, freights.

#### User

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| email | String | unique |
| passwordHash | String | |
| name | String | |
| role | UserRole | |
| companyId | String | FK |
| phone | String | unique |
| userTypes | Json | array |
| companyByType | Json | |
| roleByType | Json | |
| isSuperAdmin | Boolean | |
| active | Boolean | |
| lastLogin | DateTime? | |
| onboardingCompletedAt | DateTime? | |
| failedLoginAttempts | Int | default: 0 |
| lockedUntil | DateTime? | |
| activeCompanyId | String? | FK |

Relations: company, activeCompany, memberships, freights, assignments, trucks, messages, auditLogs, notifications, pushSubscriptions, refreshTokens, whatsappSessions, passwordResetCodes.

#### UserCompany

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| userId | String | FK |
| companyId | String | FK |
| role | String | default: 'operario' |
| active | Boolean | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Unique constraint: `[userId, companyId]`.

#### Branch

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | String | |
| companyId | String | FK |
| address | String? | |
| reference | String? | |
| lat | Decimal? | |
| lng | Decimal? | |
| active | Boolean | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

#### Field

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | String | |
| companyId | String | FK |
| address | String? | |
| lat | Decimal? | |
| lng | Decimal? | |
| hectares | Decimal? | |
| comments | String? | |
| active | Boolean | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Relations: company, lots, freights.

#### Lot

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | String | |
| companyId | String | FK |
| fieldId | String | FK |
| hectares | Decimal? | |
| lat | Decimal? | |
| lng | Decimal? | |
| comments | String? | |
| active | Boolean | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Relations: company, field, freights.

#### Poi

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(255) | |
| companyId | String | FK |
| address | String? | |
| lat | Decimal(10,6) | |
| lng | Decimal(10,6) | |
| comments | String? | |
| active | Boolean | default: true |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Index: `companyId`.

#### Plant

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | String | |
| companyId | String | FK |
| address | String? | |
| lat | Decimal? | |
| lng | Decimal? | |
| active | Boolean | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Relations: company, freights.

#### Truck

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| plate | String | unique |
| brand | String? | |
| model | String? | |
| capacity | String? | |
| companyId | String | FK |
| assignedUserId | String? | FK |
| active | Boolean | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

#### PlantProducerAccess

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| plantCompanyId | String | FK |
| producerCompanyId | String | FK |
| producerUserId | String | FK |
| allowedPlantIds | Json | |
| allowedBranchIds | Json | |
| active | Boolean | |

Unique constraint: `[plantCompanyId, producerCompanyId, producerUserId]`.

#### Freight

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| code | String | unique |
| status | FreightStatus | default: draft |
| **Origin** | | |
| originCompanyId | String | FK |
| originLotId | String? | FK |
| fieldId | String? | FK |
| originName | String? | |
| originLat | Decimal? | |
| originLng | Decimal? | |
| **Destination** | | |
| destCompanyId | String? | FK |
| destPlantId | String? | FK |
| destName | String? | |
| destLat | Decimal? | |
| destLng | Decimal? | |
| **Schedule** | | |
| loadDate | Date | |
| loadTime | String | HH:MM format |
| scheduledAt | DateTime? | |
| **Audit** | | |
| requestedById | String | FK |
| notes | String? | |
| cancelReason | String? | |
| **Multi-truck** | | |
| truckCount | Int | default: 1 |
| assignedTruckCount | Int | default: 0 |
| isMultiTruck | Boolean | default: false |
| **Fleet** | | |
| useOwnFleet | Boolean? | |
| **Tracking** | | |
| participantCompanyIds | String[] | GIN index |
| shareToken | String | unique |
| **Cross-confirmations** | | |
| transporterLoadedConfirmedAt | DateTime? | |
| producerLoadedConfirmedAt | DateTime? | |
| transporterFinishedConfirmedAt | DateTime? | |
| plantFinishedConfirmedAt | DateTime? | |
| **Timestamps** | | |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| startedAt | DateTime? | |
| finishedAt | DateTime? | |
| loadedAt | DateTime? | |

#### FreightItem

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| freightId | String | FK |
| grain | GrainType | |
| tons | Decimal | |
| notes | String? | |

#### FreightAssignment

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| freightId | String | FK |
| transportCompanyId | String | FK |
| status | AssignmentStatus | default: active |
| driverId | String? | |
| driverName | String? | |
| plate | String? | |
| truckId | String? | |
| assignedById | String? | |
| reason | String? | |
| queuePosition | Int? | |
| **Trip (v6.0)** | | |
| tripStatus | TripStatus | default: pending |
| tripNumber | Int? | |
| tons | Decimal? | |
| loadedTons | Decimal? | |
| startedAt | DateTime? | |
| loadedAt | DateTime? | |
| finishedAt | DateTime? | |
| **Cross-confirmations (per trip)** | | |
| transporterLoadedConfirmedAt | DateTime? | |
| producerLoadedConfirmedAt | DateTime? | |
| transporterFinishedConfirmedAt | DateTime? | |
| plantFinishedConfirmedAt | DateTime? | |

#### FreightDocument

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| freightId | String | FK |
| name | String | |
| url | String | |
| type | String? | |
| step | DocumentStep? | |
| uploadedById | String? | |
| ocrData | Json? | |

#### FreightTracking

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| freightId | String | FK |
| userId | String | FK |
| lat | Decimal | |
| lng | Decimal | |
| speed | Decimal? | |
| heading | Decimal? | |
| createdAt | DateTime | |

#### LiveLocation

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| freightId | String | FK |
| userId | String | FK |
| userName | String | |
| userRole | String | |
| lat | Decimal | |
| lng | Decimal | |
| speed | Decimal? | |
| heading | Decimal? | |
| active | Boolean | |
| expiresAt | DateTime | |

Unique constraint: `[freightId, userId]`.

#### Conversation

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| freightId | String? | unique |

Relations: messages, participants.

#### ConversationParticipant

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| conversationId | String | FK |
| companyId | String? | |
| userId | String | FK |
| joinedAt | DateTime | |
| lastReadAt | DateTime? | |
| pinnedAt | DateTime? | |
| markedUnread | Boolean | default: false |

Unique constraint: `[conversationId, companyId]`.

#### Message

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| conversationId | String | FK |
| senderId | String | FK |
| text | String | max 2000 chars |
| createdAt | DateTime | |

#### AuditLog

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| entityType | String | |
| entityId | String | |
| action | String | |
| fromValue | String? | |
| toValue | String? | |
| userId | String? | |
| freightId | String? | |
| reason | String? | |
| metadata | Json? | |
| createdAt | DateTime | |

#### Notification

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| userId | String | FK |
| companyId | String? | |
| type | NotificationType | |
| title | String | |
| body | String? | |
| entityId | String? | |
| read | Boolean | default: false |
| createdAt | DateTime | |

#### PushSubscription

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| userId | String | FK |
| endpoint | String | |
| p256dh | String | |
| auth | String | |
| createdAt | DateTime | |

Unique constraint: `[userId, endpoint]`.

#### RefreshToken

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| token | String | unique, hashed |
| userId | String | FK |
| expiresAt | DateTime | |
| createdAt | DateTime | |

#### AnalyticsEvent

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| event | String | |
| data | Json? | |
| userId | String? | |
| sessionId | String? | |
| createdAt | DateTime | |

#### WhatsAppSession

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| userId | String? | |
| phone | String | |
| flowType | String? | |
| flowState | Json? | |
| flowStep | String? | |
| expiresAt | DateTime | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

#### WhatsAppMessageLog

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| waMessageId | String? | |
| phone | String | |
| direction | String | inbound / outbound |
| type | String? | |
| content | Json? | |
| status | String? | |
| createdAt | DateTime | |

#### PasswordResetCode

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| userId | String | FK |
| codeHash | String | |
| expiresAt | DateTime | |
| attempts | Int | |
| used | Boolean | |
| resetJti | String? | |
| createdAt | DateTime | |

#### FreightPendingChange

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| freightId | String | FK |
| changeType | String | |
| fromValue | Json? | |
| toValue | Json? | |
| requestedById | String | FK |
| approverCompanyId | String? | |
| status | String | default: 'pending' |
| createdAt | DateTime | |
| resolvedAt | DateTime? | |
| resolvedById | String? | |

---

## 4. Autenticación y Seguridad

### Auth Mechanism

- Login with email/phone + password returns JWT access token (30min) + refresh token (7 days)
- Access token stored in HttpOnly secure cookie (`samesite: none`, `partitioned`)
- Refresh token also in HttpOnly cookie
- On 401: automatic token refresh via `/auth/refresh`, retry original request
- Frontend has `_logoutInProgress` flag to prevent cascading logouts

### Password Reset Flow

1. `POST /auth/identify-for-reset` — returns masked phone
2. `POST /auth/request-code` — sends WhatsApp verification code
3. `POST /auth/verify-code` — returns one-time reset token (with JTI nonce)
4. `POST /auth/reset-password` — sets new password

### Security Protections

| Protection | Detail |
|---|---|
| Helmet | CSP, HSTS, X-Frame-Options |
| CORS | Explicit whitelist |
| CSRF | Origin/Referer validation on state-changing requests (skip webhooks) |
| Rate limiting (global) | 500 req/min |
| Rate limiting (per-user) | 500/min authenticated, 100/min anonymous |
| Per-endpoint throttle | Decorators on specific routes |
| Password hashing | Bcrypt, ROUNDS=10 |
| Token storage | SHA256 for refresh tokens |
| Account lockout | 5 failed attempts, 15min lock |
| Timing attack prevention | Constant-time comparison (bcrypt) |
| Request timeout | 30s max (except SSE) |
| Body size limit | 2MB |
| Input validation | ValidationPipe with whitelist + forbidNonWhitelisted |
| WhatsApp webhook | HMAC-SHA256 signature verification |

### Guards

| Guard | Purpose |
|---|---|
| **JwtAuthGuard** | Extracts JWT from cookie or Authorization header, validates, caches user active status 30s |
| **RolesGuard** | Checks `@Roles()` decorator against user's companyTypes (supports multi-type companies) |
| **FreightAccessGuard** | Multi-tenant validation: user's company must participate in freight (origin, dest, or transporter) |
| **ThrottlerGuard** | Global rate limiting |

---

## 5. API — Endpoints Completos

### Auth (`/api/auth`)

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| GET | /ping | No | - | Health check |
| POST | /login | No | - | Login (email/phone + password) |
| POST | /register | No | - | Create account |
| POST | /identify-for-reset | No | - | Start password reset |
| POST | /request-code | No | - | Request WhatsApp verification code |
| POST | /verify-code | No | - | Verify code, get reset token |
| POST | /reset-password | No | - | Set new password |
| POST | /refresh | No | - | Refresh access token |
| POST | /logout | JWT | - | Revoke tokens |
| POST | /switch-company | JWT | - | Switch active company |
| PATCH | /password | JWT | - | Change password |
| GET | /me/companies | JWT | - | List user's companies |
| PATCH | /me/onboarding-complete | JWT | - | Mark onboarding done |

### Freights (`/api/freights`)

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| POST | / | JWT | producer/plant | Create freight |
| GET | / | JWT | - | List freights (paginated, filtered) |
| GET | /drivers | JWT | transporter/producer/plant | List available drivers |
| GET | /drivers/:driverId/queue | JWT | - | Driver's freight queue |
| POST | /drivers/:driverId/reorder | JWT | plant/platform_admin | Reorder queue |
| GET | /:id/summary | JWT+Access | - | Lightweight freight summary |
| GET | /:id/detail-extra | JWT+Access | - | Documents + conversation + pending changes |
| GET | /:id | JWT+Access | - | Full freight detail |
| POST | /:id/assign | JWT+Access | plant | Assign transporter |
| POST | /:id/respond | JWT+Access | transporter | Accept/reject assignment |
| POST | /:id/start | JWT+Access | transporter/producer | Start trip |
| POST | /:id/confirm-loaded | JWT+Access | transporter/producer | Confirm load |
| POST | /:id/confirm-finished | JWT+Access | transporter/plant | Confirm delivery |
| POST | /:id/finish | JWT+Access | transporter/plant | Alias for confirm-finished |
| POST | /:id/cancel | JWT+Access | producer/plant | Cancel with reason |
| POST | /:id/authorize | JWT+Access | plant | Authorize own fleet |
| POST | /:id/assign-multi | JWT+Access | plant | Assign multiple trucks |
| POST | /:id/assign-truck | JWT+Access | plant | Add single truck |
| POST | /:id/assignments/:aId/cancel | JWT+Access | plant | Cancel truck assignment |
| PATCH | /:id/assignments/:aId | JWT+Access | plant | Edit assignment |
| POST | /:id/assignments/:aId/respond | JWT+Access | transporter/plant | Accept/reject trip |
| POST | /:id/assignments/:aId/start | JWT+Access | transporter/producer | Start specific trip |
| POST | /:id/assignments/:aId/confirm-loaded | JWT+Access | transporter/producer | Load per truck |
| POST | /:id/assignments/:aId/confirm-finished | JWT+Access | transporter/plant | Delivery per truck |
| PATCH | /:id | JWT+Access | producer/plant | Edit freight |
| POST | /:id/pending-changes/:changeId/approve | JWT+Access | producer/plant | Approve change |
| POST | /:id/pending-changes/:changeId/reject | JWT+Access | producer/plant | Reject change |
| POST | /:id/tracking | JWT+Access | - | Add GPS point |
| GET | /:id/tracking/participants | JWT+Access | - | Participant positions |
| GET | /:id/tracking/last | JWT+Access | - | Last truck position |
| GET | /:id/tracking | JWT+Access | - | All tracking points |
| GET | /:id/audit | JWT+Access | - | Change history |
| POST | /:id/documents | JWT+Access | - | Upload document |
| DELETE | /:id/documents/:docId | JWT+Access | - | Delete document |
| PATCH | /:id/documents/:docId/ocr | JWT+Access | - | Save OCR data |

### Catalog (`/api/catalog`)

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| GET | /plants | JWT | - | List accessible plants |
| GET | /branches | JWT | - | List branches |
| GET | /lots | JWT | - | List user's lots |
| GET | /transport-companies | JWT | - | List transporters |
| GET | /all | JWT | - | Consolidated catalog |

### Fields (`/api/fields`)

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| GET | / | JWT | - | List fields with lots |
| POST | / | JWT | producer | Create field |
| PATCH | /:id | JWT | producer | Edit field |
| GET | /:fieldId/lots | JWT | - | List lots in field |
| POST | /:fieldId/lots | JWT | producer | Create lot |
| PATCH | /:fieldId/lots/:lotId | JWT | producer | Edit lot |
| GET | /pois | JWT | - | List POIs |
| POST | /pois | JWT | producer | Create POI |
| PATCH | /pois/:poiId | JWT | producer | Edit POI |
| PATCH | /pois/:poiId/delete | JWT | producer | Soft delete POI |
| POST | /import-google-list | JWT | producer | Parse Google Maps list |
| POST | /import-links | JWT | producer | Parse Google Maps links |
| POST | /import-confirm | JWT | producer | Confirm import |

### Trucks (`/api/trucks`)

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| POST | / | JWT | transporter/producer/plant | Create truck |
| GET | / | JWT | transporter/producer/plant | List trucks |
| PATCH | /:id/deactivate | JWT | transporter/producer/plant | Deactivate truck |
| POST | /drivers | JWT | transporter/producer/plant | Create driver |
| GET | /drivers | JWT | transporter/producer/plant | List drivers |
| PATCH | /drivers/:id/deactivate | JWT | transporter/producer/plant | Deactivate driver |

### Notifications (`/api/notifications`)

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| POST | /subscribe | JWT | - | Push subscription |
| DELETE | /subscribe | JWT | - | Unsubscribe |
| GET | / | JWT | - | Get notifications |
| PATCH | /:id/read | JWT | - | Mark read |
| PATCH | /read-all | JWT | - | Mark all read |

### Conversations (`/api/conversations`)

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| GET | /search-users | JWT | - | Search users |
| POST | /start | JWT | - | Start conversation |
| GET | / | JWT | - | List conversations |
| PATCH | /:id/read | JWT | - | Mark read |
| GET | /:id/messages | JWT | - | Get messages (cursor-based) |
| POST | /:id/typing | JWT | - | Typing indicator |
| PATCH | /:id/pin | JWT | - | Pin/unpin |
| PATCH | /:id/mark-unread | JWT | - | Toggle unread |
| POST | /:id/messages | JWT | - | Send message |

### SSE (`/api/sse`)

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| POST | /ticket | JWT | - | Get SSE ticket |
| GET | /stream | Ticket | - | SSE event stream |

### WhatsApp (`/api/whatsapp`)

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| GET | /webhook | No | - | Meta verification |
| POST | /webhook | HMAC | - | Receive messages |
| POST | /location-token | Internal | - | Generate location token |
| POST | /save-location | Token | - | Save picked location |
| POST | /save-location-by-slug | Token | - | Save by slug |
| GET | /daily-map-data | Token | - | Today's freights |
| POST | /live-location | Token | - | Update live position |
| GET | /live-locations | Token | - | Active positions |
| POST | /live-location/stop | Token | - | Stop sharing |

### Health (`/api/health`)

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| GET | / | No | - | Health check |

### OCR (`/api/ocr`)

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| POST | /analyze | JWT | - | Analyze document image |

### Web Chat (`/api/web-chat`)

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| POST | /send | JWT | - | Send AI chat message |
| GET | /history | JWT | - | Get chat history |
| POST | /audio | JWT | - | Transcribe + respond |

### Admin (`/api/admin`)

Multiple CRUD endpoints for companies, users, branches, trucks, fields, lots, and plant access. All require `platform_admin` role.

---

## 6. Frontend — Pantallas y Navegación

24 screens total, all lazy-loaded with `React.lazy` + `Suspense`.

### Navigation System

Single `screen` state variable in `App.jsx`. `onNav(screenKey)` function maps keys to URL paths via the `SCREEN_TO_PATH` object. Uses `window.history.pushState` for URL management (no React Router for internal navigation).

### Route Map (`SCREEN_TO_PATH`)

| Key | Path |
|---|---|
| home | `/` |
| list | `/list` |
| detail | `/freight/:id` |
| new | `/new` |
| edit | `/edit/:id` |
| calendar | `/calendar` |
| menu | `/menu` |
| trucks | `/trucks` |
| fields | `/fields` |
| locations | `/locations` |
| admin | `/admin` |
| mydata | `/mydata` |
| reports | `/reports` |
| chats | `/chats` |
| notifications | `/notifications` |

### Public Routes (no auth, direct React Router)

- `/pick-location`, `/track`, `/report`, `/daily-map`, `/live-freight`, `/ver-mapa`
- `/:code/ubicacion`, `/:code/informe` (clean URLs)
- `/campo/:slug/ubicacion`, `/ubicacion/:slug`

### Layout

- **Desktop** (`useIsDesktop(768)`): Sidebar (220px left panel) + main content
- **Mobile**: Bottom Nav bar with 4 tabs (Home, List, New, Menu)

### Screens

| Screen | File | Purpose |
|---|---|---|
| HomeScreen | HomeScreen.jsx | Dashboard: pending actions grouped, daily summary, multi-company tabs |
| ListScreen | ListScreen.jsx | Freight list: Kanban/table views, filters, server-side pagination |
| DetailScreen | DetailScreen.jsx | Freight detail: timeline, docs, OCR, chat, map, audit, pending changes |
| NewScreen | NewScreen.jsx | Create freight form: field/lot/plant, custom locations, multi-truck |
| EditScreen | EditScreen.jsx | Edit freight details, pending change flow |
| CalendarScreen | CalendarScreen.jsx | Calendar view by load date |
| MenuScreen | MenuScreen.jsx | Main menu: logout, company switch, settings |
| TrucksScreen | TrucksScreen.jsx | Truck/driver CRUD |
| FieldsScreen | FieldsScreen.jsx | Field and lot management with location picker |
| LocationsScreen | LocationsScreen.jsx | POI management: import from Google Maps, edit/delete |
| AdminScreen | AdminScreen.jsx | Admin: companies, users, branches, trucks, lots, fields |
| MyDataScreen | MyDataScreen.jsx | User profile editor |
| ReportsScreen | ReportsScreen.jsx | PDF report generation/download |
| ChatsScreen | ChatsScreen.jsx | Real-time messaging with SSE |
| NotificationsScreen | NotificationsScreen.jsx | Notification inbox |
| PickLocationScreen | PickLocationScreen.jsx | Public: Google Maps location picker |
| TrackFreightScreen | TrackFreightScreen.jsx | Public: real-time freight tracking |
| ReportDownloadScreen | ReportDownloadScreen.jsx | Public: PDF download |
| DailyMapScreen | DailyMapScreen.jsx | Public: daily freights on map |
| LiveFreightScreen | LiveFreightScreen.jsx | Public: live participant tracking |
| ViewMapScreen | ViewMapScreen.jsx | Public: generic map viewer |
| AccessScreen | AccessScreen.jsx | Plant-producer access management |

---

## 7. Frontend — Componentes y Sistema de Diseño

### Design Tokens (`theme.jsx` - `C` object)

**Colors:**

| Token | Value | Description |
|---|---|---|
| `pri` | `#1A6B37` | Primary green |
| `acc` | `#FF6A00` | Accent orange |
| `sec` | `#0891B2` | Secondary cyan |
| `ok` | green | Success |
| `err` | red | Error |
| `warn` | amber | Warning |
| `info` | blue | Info |
| `muted` | gray | Muted/disabled |

Each color has `base`, `Lt` (light), and `Pale` variants.

**Text:** `t1` (dark), `t2` (medium), `t3` (light), `tOn` (white on dark).

**Borders:** `b1` (light), `b2` (lighter), `bFocus` (focused).

**Backgrounds:** `bg`, `bgCard`, `bgInput`, `bgOverlay`, `nav`, `w` (white).

**Shadows:** `sh` (small), `shMd`, `shLg`.

**Typography:** `FONT = 'DM Sans'`, `MONO = 'JetBrains Mono'`.

### Icons (`Ic` object)

60+ SVG icon functions with signature `Ic.iconName(color, size)`. Examples: `Ic.pin`, `Ic.truck`, `Ic.grain`, etc.

### Reusable Components (`components.jsx`)

| Component | Description |
|---|---|
| `Av` | Avatar with initials |
| `Bd` | Badge (color, bg, small variant) |
| `Btn` | Button (variants: pri, sec, err, ghost, acc; props: full, sm, icon, disabled) |
| `Tabs` | Tab switcher |
| `Field` | Form input with label + icon |
| `NumericStepper` | +/- number input |
| `Select` | Dropdown (native mobile, custom desktop) |
| `Sec` | Collapsible form section |
| `Toast` | Auto-dismiss notification (3.5s) |
| `Loader` | Animated spinner |
| `LoadingOverlay` | Full-screen loading with logo to result circle transition |
| `SortTh` | Sortable table header |
| `ModalOverlay` | Animated modal container |
| `AttachMenu` | Camera/gallery/files action sheet |
| `Sidebar` | Desktop left nav (220px) |
| `Nav` | Mobile bottom navigation |
| `NotifBell` | Notification bell with count |
| `NotificationsPanel` | Dropdown notification list |
| `ErrorBoundary` | Error catch wrapper |
| `EmptyState` | Empty list placeholder with icon + action |

### Map Components (`maps.jsx`)

| Component | Description |
|---|---|
| `loadGMaps()` | Lazy-loads Google Maps JS API |
| `LocationPicker` | Map + autocomplete for location selection |
| `LocPickerFullscreen` | Full-screen version |
| `FreightMap` | Origin/destination route map with tracking |
| `MapOverlay` | Full-screen map in App.jsx |
| `SafeZone` | Error boundary for maps |

### Styling

All inline styles, no CSS files (except `app.css` for globals), no Tailwind. Design tokens from the `C` object ensure consistency.

---

## 8. Gestión de Estado

### Zustand Stores (`store.js`)

| Store | Key State |
|---|---|
| `useUIStore` | modal, toast, mapFocus, listView (kanban/table), submitting, submitDone, actionLoading, notifOpen, chatConvId, duplicateData, editData, locPicker |
| `useCatalogStore` | Multi-user catalog cache `{ [userId]: { data, ts, loading } }` with 5min TTL |
| `useFreightDetailStore` | Freight detail cache `{ [freightId]: { data, ts, loading } }` with 2min TTL |
| `offlineQueue` | IndexedDB-backed queue for offline writes (enqueue, getAll, remove, count, clear) |

### Custom Hooks (`hooks.jsx`)

| Hook | Purpose |
|---|---|
| `useAuth()` | user, loading, login, signup, logout, switchCompany, patchUser, simpleMode |
| `useFreights(user)` | freights[], loading, CRUD operations, all state transitions |
| `useCatalog(user)` | Loads plants, branches, lots, fields, transporters, trucks (cached 5min) |
| `useNotifications(user)` | notifications[], unreadCount, markRead, markAllRead |
| `useSSE(user, handlers)` | SSE connection with ticket auth; handles freight updates, messages, notifications, typing, AI responses |
| `useIsDesktop(breakpoint)` | Responsive boolean |
| `useOnline()` | `navigator.onLine` boolean |
| `originDisplay(f)` | Display helper for freight origin |
| `destDisplay(f)` | Display helper for freight destination |
| `permsFor(user)` | Permission calculator |

### State Flow

1. **App.jsx orchestrates:** auth check, SSE connect, catalog load, screen render
2. **SSE events trigger:** freight list refresh, notification count update, chat message append, typing indicator
3. **Polling fallback:** 30s when SSE disconnected, adapts based on visibility
4. **Offline:** writes queued in IndexedDB, replayed on reconnect

---

## 9. Lógica de Negocio — Fletes (Core)

### Freight Lifecycle

```
draft → pending_assignment → assigned → accepted → in_progress → loaded → finished
                                  ↓
                              rejected → back to pending_assignment

Any state → canceled (producer/plant cancels with reason)
```

1. **draft** to **pending_assignment** — producer creates the freight
2. **pending_assignment** to **assigned** — plant assigns a transporter
3. **assigned** to **accepted** — transporter accepts (or **rejected**, returning to pending_assignment)
4. **accepted** to **in_progress** — transporter or producer starts the trip
5. **in_progress** to **loaded** — both transporter AND producer confirm load
6. **loaded** to **finished** — both transporter AND plant confirm delivery
7. Any state to **canceled** — producer or plant cancels with a reason

### Multi-Truck (v6.0)

Single freight, multiple assignments. Each assignment has its own `tripStatus` lifecycle. The freight's overall status reflects the aggregate (e.g., finished when ALL trips are finished).

### Cross-Confirmations

Load and delivery require two-party confirmation:

- **Load:** transporter confirms + producer confirms = status moves to `loaded`
- **Delivery:** transporter confirms + plant confirms = status moves to `finished`

### State Machine

`freight-state-machine.service.ts` validates transitions, checks roles, and enforces business rules.

### Key Freight Fields

| Category | Fields |
|---|---|
| **Origin** | originCompanyId + (originLotId \| fieldId \| customOriginName) + lat/lng |
| **Destination** | destCompanyId + (destPlantId \| customDestName) + lat/lng |
| **Schedule** | loadDate + loadTime |
| **Items** | grain type + tons (multiple items per freight) |
| **Documents** | photos, cargo letters with OCR |
| **Access** | participantCompanyIds (GIN-indexed array for fast multi-tenant queries) |

### Audit Log

Every state change, field edit, and assignment creates an `AuditLog` entry with before/after values.

---

## 10. Lógica de Negocio — Campos y Lotes

### Field Model

Represents a farm (campo). Has name, location (lat/lng), address, hectares, and company owner. Can contain multiple lots.

### Lot Model

Subdivision of a field. Has name, hectares, and location. Links to a field. Used as freight origin.

### CRUD

Full create/update via API. The Fields screen includes a location picker with Google Maps. No delete is implemented for fields or lots (soft-delete exists only for POIs).

### Relation to Freights

- `Freight.originLotId` references a Lot (which belongs to a Field via `fieldId`)
- `Freight.fieldId` references a Field directly

### POI (Points of Interest)

Separate model for locations that are not fields or lots. Has name, address, lat/lng, and comments. Full CRUD with soft delete. Supports import from Google Maps shared lists.

### Import Flow

1. User pastes a Google Maps list URL
2. Backend scrapes the list, extracts locations with coordinates
3. Frontend displays locations for classification (Campo / Lote / Punto de Interes)
4. On confirm: creates fields (pass 1), lots (pass 2), POIs (pass 3)
# 11. LÓGICA DE NEGOCIO — EMPRESAS Y USUARIOS

**Company model:** Has name, type (legacy single: producer/plant/transporter), types (new multi-type JSON array). Companies can be multiple types simultaneously (e.g., a plant that also produces).

**User model:** Belongs to a primary company (companyId). Has userTypes JSON array (e.g., ["producer", "plant"]). Can have memberships in multiple companies via UserCompany join table.

**Multi-company support:**
- UserCompany model: userId + companyId + role + active. Unique constraint on [userId, companyId].
- User has activeCompanyId — determines which company context they're operating in.
- POST /auth/switch-company: Changes active company, issues new JWT with updated companyId/companyType.
- CompanyResolutionService: resolveAllCompanyIds(user) queries UserCompany memberships.

**Roles within company:**
- UserRole enum: admin, operator, platform_admin
- roleByType JSON: maps company types to roles (e.g., {"producer": "admin", "plant": "operator"})
- Platform admin: superuser, sees all data, bypasses access guards

**Invitation flow:** Admin creates user via /api/admin endpoints, assigns to company with role. No self-service invitation or email verification currently.

# 12. MÓDULO WHATSAPP

**Architecture:**
- WhatsApp Controller: Receives Meta Cloud API webhooks (HMAC-SHA256 verified)
- WhatsApp Service: Sends messages (text, buttons, lists, templates), handles media
- WhatsApp Router Service: Routes incoming messages to appropriate handlers
- WhatsApp Flow Service: Multi-turn conversation state machine
- AI Service (Anthropic Claude): Intelligent agent for natural language freight operations

**Webhook flow:**
1. Meta sends POST /api/whatsapp/webhook with message payload
2. Controller validates HMAC-SHA256 signature using WHATSAPP_APP_SECRET
3. Deduplication: in-memory Set with 1-min TTL per waMessageId
4. Router processes: text, button_reply, list_reply, location, audio, image, document
5. For AI flows: routes to Claude with system prompt + tools
6. Response sent back via Meta Cloud API

**Message types supported:**
- sendText(phone, text): Plain text message
- sendButtons(phone, body, buttons[]): Interactive reply buttons (max 3)
- sendList(phone, body, buttonLabel, sections[]): List picker
- sendSelection(phone, items, config): Paginated selection list
- sendTemplate(phone, templateName, lang, components?): Pre-approved templates

**AI Agent (Claude):**
- System prompt defines behavior: creates freights, queries status, shares locations
- Tool definitions: create_freight, list_freights, get_freight_detail, share_location, etc.
- Context: user's company, recent freights, available plants/fields

**Public links generated via WhatsApp:**
- pick-location: Location picker (no auth, token-based)
- track: Freight tracking map
- live-freight: Real-time participant locations
- report: PDF download
- daily-map: Daily freight map

**Background tasks (cron-like, setInterval):**
- checkStaleFreights(): Every 15min — remind about stale freights
- checkDailySummary(): Daily at 10:00 AM (Uruguay timezone) — send summary
- cleanupExpired(): Every 30min — clean sessions, tokens, locations, logs

**Media handling:**
- downloadMedia(mediaId): Downloads from Meta CDN (allowlisted hosts only)
- Audio: transcribed via OpenAI Whisper
- Images: uploaded to Supabase Storage

# 13. MÓDULO DE TRACKING Y UBICACIÓN

**TrackFreightScreen (public):**
- Accessed via /track?t=shareToken or /:code/ubicacion
- Shows real-time freight position on Google Map
- Displays origin → destination route
- Auto-refreshes tracking points
- No auth required — uses freight shareToken

**LiveFreightScreen (public):**
- Accessed via /live-freight?t=token
- Shows all participants sharing their location in real-time
- Each participant has avatar + name + role on map
- Auto-polls live locations every 5s
- Token-based auth (signed tokens from WhatsApp service)

**PickLocationScreen (public):**
- Accessed via /pick-location?t=token or /campo/:slug/ubicacion
- Google Maps with autocomplete + draggable pin
- Saves location back to API via POST /whatsapp/save-location
- One-time token consumption (prevents reuse)
- Used by WhatsApp bot when user needs to set freight origin/destination

**DailyMapScreen (public):**
- Accessed via /daily-map?t=token
- Shows all of today's freights on a single map
- Color-coded markers by status
- Token-validated (signed by WhatsApp service)

**GPS tracking (authenticated):**
- POST /freights/:id/tracking: Add GPS point (lat, lng, speed, heading)
- GET /freights/:id/tracking: All points for route replay
- GET /freights/:id/tracking/last: Last truck position
- GET /freights/:id/tracking/participants: All participant last positions
- Rate limited: 60 points/min

**Live location sharing:**
- POST /whatsapp/live-location: Update position (token-based)
- GET /whatsapp/live-locations: Get active locations (token-based)
- POST /whatsapp/live-location/stop: Stop sharing
- LiveLocation model: active flag + expiresAt (auto-cleanup)
- GPS cooldown: 1 location per 30s per user (WhatsApp)

**State:** Primarily polling-based. SSE sends freight update events but tracking data is polled separately.

# 14. MÓDULO DE REPORTES

**PDF generation (frontend, pdf-report.js):**
- Uses jspdf + qrcode libraries
- Generates freight summary PDF with:
  - Header with Tolvink logo
  - Freight code + status
  - Origin/destination details
  - Items (grain, tons)
  - Assignment details (transporter, truck, driver)
  - Timeline (created, started, loaded, finished)
  - QR code linking to public tracking page
- Generated entirely on client-side (no server rendering)

**ReportDownloadScreen (public):**
- Accessed via /report?t=shareToken or /:code/informe
- Fetches freight data via shareToken (no auth)
- Renders preview + download button
- WhatsApp bot sends link to this page

**ReportsScreen (authenticated):**
- Date range selector
- Filter by status, origin, destination
- Bulk PDF generation
- Download as ZIP (multiple freights)
- Uses adm-zip on backend for ZIP creation

# 15. NOTIFICACIONES

**In-app notifications:**
- NotificationType enum: freight_created, freight_assigned, freight_accepted, freight_rejected, freight_started, freight_loaded, freight_confirmed, freight_finished, freight_canceled, freight_updated, message_received, conversation_started
- Stored in Notification table (userId, type, title, body, entityId, read)
- API: GET /notifications, PATCH /:id/read, PATCH /read-all

**Push notifications (Web Push):**
- VAPID-based (Voluntary Application Server Identification)
- Service worker receives push events
- PushSubscription model stores endpoint + keys per user
- API: POST /subscribe, DELETE /subscribe
- Sent via web-push npm package on backend

**Frontend:**
- NotificationsScreen: Full notification inbox
- NotificationsPanel: Dropdown from bell icon (desktop)
- NotifBell: Badge with unread count
- useNotifications hook: polling-based refresh
- SSE sends `notification` events for real-time updates

**Notification triggers (backend):**
- Freight state changes (create, assign, accept, reject, start, load, finish, cancel)
- New messages in conversations
- Sent to all relevant users based on freight participants

# 16. CATÁLOGO Y DATOS MAESTROS

**Grains/Products:**
- GrainType enum: Soja, Maiz, Trigo, Girasol, Sorgo, Cebada, Otros
- No separate catalog table — hardcoded enum
- Frontend: GRAINS constant array

**Plants:**
- Plant model: name, companyId, address, lat, lng, active
- Filtered by PlantProducerAccess (producers only see plants they have access to)
- Cached 5min on frontend via useCatalog

**Branches (Sucursales):**
- Branch model: name, companyId, address, reference, lat, lng, active
- Filtered by company access
- Cached 5min

**Trucks & Drivers:**
- Truck model: plate (unique), brand, model, capacity, companyId, assignedUserId
- Drivers are Users with role in transporter company
- Managed via TrucksScreen or AdminScreen

**Catalog loading (frontend):**
- useCatalog hook loads all catalog data via GET /catalog/all
- Cached per user+company key with 5min TTL in Zustand
- Includes: plants, branches, lots, fields, transporters, trucks

# 17. INTEGRACIONES EXTERNAS

**Google Maps Platform:**
- Maps JavaScript API: Interactive maps (FreightMap, LocationPicker, MapOverlay, tracking)
- Places API: Autocomplete for location search
- Geocoding API: Address → coordinates conversion
- Directions API: Route rendering between origin/destination
- API key: VITE_GMAPS_KEY (frontend), loaded lazily via loadGMaps()

**Meta WhatsApp Business API:**
- Cloud API (not On-Premise)
- Webhook: POST /api/whatsapp/webhook (HMAC-SHA256)
- Sending: via Graph API v21.0 (https://graph.facebook.com/v21.0)
- Message types: text, interactive (buttons, lists), template, media
- Media download: from Meta CDN (lookaside.fbsbx.com, scontent.xx.fbcdn.net)
- Config: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET

**Supabase:**
- PostgreSQL database hosting (DATABASE_URL, DIRECT_URL)
- Storage: File upload for documents/photos (SUPABASE_URL, SUPABASE_SERVICE_KEY)
- Frontend storage: Direct upload via anon key (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- Image transforms: thumb(url, size) for responsive images

**Anthropic Claude API:**
- SDK: @anthropic-ai/sdk
- Used in AI module for WhatsApp bot intelligence
- Tool use (function calling) for freight operations
- Config: ANTHROPIC_API_KEY

**OpenAI:**
- SDK: openai
- Used for Whisper audio transcription (WhatsApp voice notes)
- Config: OPENAI_API_KEY

**Sentry:**
- @sentry/node (backend), @sentry/react (frontend)
- Error tracking + performance monitoring
- Config: SENTRY_DSN, SENTRY_TRACES_RATE

# 18. INFRAESTRUCTURA Y DEPLOYMENT

**Backend (Railway):**
- Nixpacks build (auto-detected from package.json)
- Build: `npx prisma migrate deploy && npx prisma generate && npx rimraf dist && tsc -p tsconfig.build.json`
- Start: `npx prisma migrate deploy && npx prisma generate && node dist/main.js`
- NOTE: prisma migrate deploy in start scripts is unreliable on Railway — fallback ensurePoisTable() in PrismaService
- Auto-deploy on git push to main
- Port: 0.0.0.0:$PORT (Railway-assigned)

**Frontend (Vercel):**
- Vite build, auto-deploy on push to main
- SPA with client-side routing
- Service worker for PWA/offline
- Domain: configured in Vercel

**Database (Supabase):**
- PostgreSQL
- Connection pooling via pgbouncer (connection_limit=20, pool_timeout=30)
- Direct URL for migrations (bypasses pgbouncer)

**PWA:**
- manifest.json: standalone display, icons, splash screens
- Service worker: cache-first for static assets, network-first for API
- Push notification support via VAPID
- Install prompt handling in main.jsx
- iOS safe area support (viewport-fit=cover)

**Dev environment:**
- GitHub Codespace (devcontainer)
- Both repos in /workspaces/
- No local DB — uses Supabase directly
- Vite dev server on port 3000

# 19. DEUDA TÉCNICA Y PROBLEMAS CONOCIDOS

**Architecture issues:**
1. **God components**: App.jsx (820 lines), components.jsx (973 lines), hooks.jsx (938 lines) — too much logic in single files
2. **Inline styles everywhere**: No CSS modules, Tailwind, or styled-components. All styles inline. Makes theming/dark mode hard.
3. **Prop drilling vs Zustand**: Inconsistent — some state in Zustand, some passed via props through 3+ levels
4. **Test coverage: ~0%**: Test files exist but are minimal. No CI test pipeline.
5. **No CI/CD pipeline**: Direct push to main triggers deploy. No PR reviews, no automated checks.

**Backend issues:**
6. **Rate limiting is per-instance**: Uses in-memory Map, not Redis. Won't work with multiple Railway instances.
7. **prisma migrate deploy unreliable on Railway**: Had to add ensurePoisTable() workaround in PrismaService.
8. **No pagination on several endpoints**: getPois, getFields, getLots return all results.
9. **Decimal type handling**: Prisma returns Decimal objects, inconsistently serialized to JSON.
10. **CompanyType dual system**: Both `type` (single) and `types[]` (multi) exist, migration incomplete.

**Frontend issues:**
11. **No dark mode**: Only light theme defined.
12. **No i18n**: All text hardcoded in Spanish.
13. **Single-file screens**: Some screens are 1000+ lines (DetailScreen 79KB, NewScreen 73KB).
14. **Google Maps memory leaks**: Map instances created but never properly destroyed.
15. **No error boundaries on screens**: Only SafeZone for maps.

**Security:**
16. **No CSRF tokens**: Only Origin/Referer validation.
17. **No email verification**: Users can register with any email.
18. **Admin endpoints loosely guarded**: Some admin operations lack granular permission checks.

**Known TODOs found in code:**
- Offline queue: implemented but replay logic is basic
- SSE reconnection: works but doesn't handle extended disconnections gracefully
- WhatsApp flow state: sessions expire but cleanup is periodic (30min intervals)

# 20. ARCHIVOS Y ESTRUCTURA

**Frontend (Tolvink/src/):**
```
src/
├── App.jsx                    # Main app orchestrator, routing, SSE, global state
├── main.jsx                   # React entry, PWA install, SW registration
├── api.js                     # API client (104 functions), auth refresh, file upload
├── store.js                   # Zustand stores (UI, catalog, detail, offline queue)
├── hooks.jsx                  # Custom hooks (auth, freights, catalog, notifications, SSE)
├── components.jsx             # Reusable components (Btn, Field, Modal, Nav, Sidebar, etc.)
├── maps.jsx                   # Google Maps components (LocationPicker, FreightMap, etc.)
├── theme.jsx                  # Design tokens (C colors, Ic icons, FONT)
├── constants.jsx              # Status configs, grains, units, poll intervals
├── validation.jsx             # Validation engine, schemas
├── AiChat.jsx                 # AI chat component
├── sentry.js                  # Error reporting init
├── logger.js                  # Logging utility
├── routes-bg.jsx              # Background route visualization
├── app.css                    # Global CSS (minimal)
├── screens/
│   ├── HomeScreen.jsx         # Dashboard
│   ├── ListScreen.jsx         # Freight list (Kanban/table)
│   ├── DetailScreen.jsx       # Freight detail
│   ├── NewScreen.jsx          # Create freight
│   ├── EditScreen.jsx         # Edit freight
│   ├── CalendarScreen.jsx     # Calendar view
│   ├── MenuScreen.jsx         # Main menu
│   ├── TrucksScreen.jsx       # Truck management
│   ├── FieldsScreen.jsx       # Field & lot management
│   ├── LocationsScreen.jsx    # POI management
│   ├── AdminScreen.jsx        # Admin panel
│   ├── MyDataScreen.jsx       # User profile
│   ├── ReportsScreen.jsx      # Reports
│   ├── ChatsScreen.jsx        # Messaging
│   ├── NotificationsScreen.jsx # Notification inbox
│   ├── PickLocationScreen.jsx # Public: location picker
│   ├── TrackFreightScreen.jsx # Public: freight tracking
│   ├── ReportDownloadScreen.jsx # Public: PDF download
│   ├── DailyMapScreen.jsx     # Public: daily map
│   ├── LiveFreightScreen.jsx  # Public: live tracking
│   ├── ViewMapScreen.jsx      # Public: map viewer
│   ├── AccessScreen.jsx       # Plant-producer access
│   └── CompanyHeaderPicker.jsx # Company selector (legacy)
├── modals/
│   ├── AssignModal.jsx        # Assign transporter
│   ├── TruckSelectModal.jsx   # Select truck
│   ├── ConfirmActionModal.jsx # Action confirmation
│   ├── ReasonModal.jsx        # Cancel/reject with reason
│   ├── DriverQueueModal.jsx   # Driver queue management
│   ├── EditTripModal.jsx      # Edit trip details
│   └── MapPreviewModal.jsx    # Map preview
├── utils/
│   ├── freight-helpers.jsx    # Freight display helpers
│   └── pdf-report.js          # PDF generation
└── test/
    ├── api.test.js
    ├── constants.test.js
    ├── hooks.test.jsx
    ├── store.test.js
    ├── validation.test.js
    ├── freight-helpers.test.js
    └── setup.js
```

**Backend (tolvink-api/src/):**
```
src/
├── main.ts                    # Bootstrap, security middleware, CORS, CSRF
├── app.module.ts              # Root module, global guards
├── admin/
│   └── admin.controller.ts    # Admin CRUD endpoints
├── ai/
│   ├── ai.module.ts
│   ├── ai.service.ts          # Claude AI integration
│   ├── ai.constants.ts        # System prompts
│   └── ai-tool-definitions.ts # AI function calling tools
├── analytics/
│   └── analytics.module.ts    # Analytics event logging
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts     # Login, register, reset, refresh
│   ├── auth.service.ts        # JWT, bcrypt, token management
│   ├── auth.dto.ts            # Auth DTOs
│   └── auth.service.spec.ts   # Tests
├── catalog.controller.ts      # Catalog endpoints (plants, branches, lots)
├── common/
│   ├── common.module.ts       # Global shared module
│   ├── constants.ts           # App constants
│   ├── build-synthetic-user.ts # Synthetic user for internal operations
│   ├── fuzzy-match.ts         # String matching utility
│   ├── request-cache.ts       # AsyncLocalStorage per-request cache
│   ├── selection-helpers.ts   # Prisma select/include helpers
│   ├── signed-token.ts        # HMAC token signing/verification
│   ├── decorators/
│   │   ├── current-user.decorator.ts  # @CurrentUser()
│   │   └── roles.decorator.ts         # @Roles()
│   ├── filters/
│   │   └── http-exception.filter.ts   # Global error handler + Sentry
│   ├── guards/
│   │   ├── jwt-auth.guard.ts          # JWT extraction + validation
│   │   ├── roles.guard.ts             # Role-based access
│   │   └── freight-access.guard.ts    # Multi-tenant freight access
│   ├── interceptors/
│   │   ├── logging.interceptor.ts     # HTTP request logging
│   │   └── user-rate-limit.interceptor.ts # Per-user rate limiting
│   └── services/
│       ├── company-resolution.service.ts  # Multi-company ID resolution
│       └── company-resolution.service.spec.ts
├── conversations/
│   └── conversations.controller.ts # Chat CRUD + messaging
├── database/
│   ├── database.module.ts     # Global DB module
│   └── prisma.service.ts      # Prisma client + retry + ensurePoisTable
├── fields/
│   ├── fields.module.ts
│   ├── fields.controller.ts   # Fields, lots, POIs, Google Maps import
│   ├── fields.service.ts      # CRUD + Google Maps scraping
│   └── fields.dto.ts          # Field/Lot/POI DTOs
├── freights/
│   ├── freights.module.ts
│   ├── freights.controller.ts # Main freight endpoints
│   ├── freights.service.ts    # Business logic, state transitions
│   ├── freights.dto.ts        # Freight DTOs
│   ├── freight-state-machine.service.ts # State machine
│   ├── freight-public.controller.ts     # Public tracking endpoints
│   ├── freight-tracking.controller.ts   # GPS tracking endpoints
│   ├── freight-state-machine.service.spec.ts
│   └── freights.service.spec.ts
├── health/
│   └── health.module.ts       # Health check
├── notifications/
│   ├── notification.module.ts
│   ├── notification.controller.ts # Push subscribe, get, mark read
│   ├── notification.service.ts    # Send push, create notification
│   └── web-push.d.ts             # Type declaration
├── ocr/
│   ├── ocr.module.ts
│   ├── ocr.controller.ts     # Document OCR endpoint
│   ├── ocr.service.ts        # Claude Vision for OCR
│   └── ocr.dto.ts
├── plant-access/
│   └── plant-access.controller.ts # Plant-producer access management
├── sse/
│   ├── sse.module.ts
│   ├── sse.controller.ts     # SSE ticket + stream
│   └── sse.service.ts        # Event emitter, client management
├── trucks/
│   └── trucks.controller.ts   # Truck + driver CRUD
├── web-chat/
│   ├── web-chat.module.ts
│   ├── web-chat.controller.ts # Web AI chat
│   └── web-chat.service.ts    # Claude integration for web
└── whatsapp/
    ├── whatsapp.module.ts
    ├── whatsapp.controller.ts  # Webhooks, location, live tracking
    ├── whatsapp.service.ts     # Message sending, media, background tasks
    ├── whatsapp-router.service.ts # Message routing
    └── whatsapp-flow.service.ts   # Conversation flows

prisma/
├── schema.prisma              # Full data model (30+ models)
├── seed.ts                    # Database seeding
└── migrations/                # 8 migration folders
```

**Config files:**
- Frontend: vite.config.js, package.json, index.html, public/manifest.json, public/sw.js
- Backend: package.json, tsconfig.json, tsconfig.build.json, nest-cli.json, .eslintrc.js
- Shared: .gitignore, devcontainer config
