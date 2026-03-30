# CLAUDE.md — Tolvink

## Project Overview

Tolvink is a **logistics/freight management PWA** for coordinating trucks, drivers, and freight shipments between producers, plants, and transporters. The UI is in **Spanish**. It is a React SPA deployed to **Vercel**, with a separate backend API on **Railway**.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 (JSX, no TypeScript) |
| Build | Vite 5 (ESM, `type: "module"`) |
| Routing | react-router-dom v7 |
| State | Zustand (multiple stores in `src/store.js`) |
| Styling | Vanilla CSS + design tokens in `src/theme.jsx` |
| Testing | Vitest + Testing Library (jsdom) |
| Error tracking | Sentry (`src/sentry.js`) |
| PDF generation | jsPDF + jspdf-autotable |
| Drag & drop | @dnd-kit |
| Deployment | Vercel (auto-deploy from GitHub) |
| Backend | Railway (`VITE_API_URL`) + Supabase (file uploads) |

## Directory Structure

```
src/
  App.jsx              — Root app component
  main.jsx             — Entry point
  api.js               — API client (HttpOnly cookie auth, refresh logic)
  store.js             — Zustand stores (useUIStore, useFreightStore, offlineQueue)
  theme.jsx            — Design tokens (colors, radii, icons)
  constants.jsx        — Freight state machine, status configs
  validation.jsx       — Form validation logic
  logger.js            — Logging utility
  sentry.js            — Sentry error tracking setup
  AiChat.jsx           — AI chat assistant component
  components/          — Reusable UI components
    buttons.jsx, form.jsx, feedback.jsx, navigation.jsx, overlays.jsx, data-display.jsx
    ui/LicensePlate.jsx
    locations/          — Location management components
    index.js            — Barrel exports
  screens/             — Route-level page components (*Screen.jsx)
  modals/              — Modal dialogs (AssignModal, ConfirmActionModal, etc.)
  hooks/               — Custom hooks (useAuth, useFreights, useCatalog, useSSE, etc.)
  providers/           — Context providers (AuthProvider, SSEProvider)
  routing/Router.jsx   — Route definitions, lazy-loaded screens
  utils/               — Helpers (freight-helpers.jsx, pdf-report.js)
  test/                — Test files and setup
    setup.js           — Vitest setup (mocks for localStorage, matchMedia, EventSource)
    *.test.js(x)       — Unit tests
public/                — Static assets, PWA manifest, service worker
scripts/               — Build/deploy scripts
```

## Commands

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Production build (Vite + terser, drops console/debugger)
npm run preview      # Preview production build
npm test             # Run tests once (Vitest)
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with v8 coverage
```

## Key Architecture Patterns

### State Machine
Freights follow a lifecycle: `draft` -> `pending_assignment` -> `assigned` -> `accepted` -> `in_progress` -> `loaded` -> `finished` (or `canceled`). Actions vary by user type (`producer`, `plant`, `transporter`, `chofer`). See `src/constants.jsx`.

### User Roles
- **Producer** — creates freight orders
- **Plant** — receives freight, manages queue board
- **Transporter** — assigns trucks and drivers
- **Chofer (Driver)** — starts/completes trips

### API Client (`src/api.js`)
- Uses HttpOnly cookies for auth (no tokens in JS)
- Has automatic token refresh logic
- All API calls go through helper functions with error handling via `ApiError`
- Sentry integration for error capture

### Zustand Stores (`src/store.js`)
- `useUIStore` — modals, toasts, map state, list view mode
- `useFreightStore` — freight data (assumed, check file for full list)
- `offlineQueue` — offline-first support for queued operations

### Routing (`src/routing/Router.jsx`)
- All screens are lazy-loaded with `React.lazy()` + `Suspense`
- Route map in `SCREEN_TO_PATH` constant
- Modals also lazy-loaded

### Design Tokens (`src/theme.jsx`)
- Colors exported as `C` (light theme tokens)
- Border radii as `R` (xs/sm/md/lg/xl/pill/full)
- Icons as `Ic`
- Status colors via `STATUS_COLORS`

## Coding Conventions

- **Language**: JavaScript with JSX — no TypeScript
- **Module system**: ESM (`import`/`export`)
- **Component naming**: PascalCase for components, files match component name (e.g., `HomeScreen.jsx`)
- **Hooks**: prefixed with `use` in `src/hooks/`
- **No linter or formatter** configured — follow existing code style
- **Inline styles**: Components use inline style objects with theme tokens (`C`, `R`), not CSS classes
- **Short variable names**: The codebase uses abbreviated identifiers (`C` for colors, `R` for radii, `Ic` for icons, `stCfg` for status config) — follow this convention
- **Comments**: Section headers use `// ======================== SECTION ======` style
- **Spanish UI text**: All user-facing labels and messages are in Spanish
- **File organization**: One screen per file, reusable components in `components/`, modals in `modals/`

## Environment Variables

Required in `.env` (not committed):
```
VITE_API_URL=<Railway backend URL>
VITE_GMAPS_KEY=<Google Maps API key>
VITE_SUPABASE_URL=<Supabase project URL>
VITE_SUPABASE_ANON_KEY=<Supabase anon key>
```

## Testing

- Tests live in `src/test/` alongside a `setup.js` that mocks `localStorage`, `matchMedia`, `navigator.onLine`, and `EventSource`
- Vitest globals are enabled — no need to import `describe`/`it`/`expect`
- Use `@testing-library/react` for component tests, `@testing-library/user-event` for interactions
- Run `npm test` before committing

## Build & Deployment

- **Vite** builds with terser minification; `console.*` and `debugger` statements are dropped in production
- **Chunk splitting**: `vendor` (react, router, zustand) and `pdf` (jspdf, qrcode) are separate chunks
- **Service worker** (`public/sw.js`) is version-stamped at build time for cache-busting
- **Vercel** config (`vercel.json`): SPA rewrites, strict security headers (CSP, HSTS, X-Frame-Options), aggressive caching for `/assets/` and `/icons/`
- **PWA**: manifest + service worker + splash screens in `public/`

## Important Notes

- The `backend/` directory is a **git submodule** — do not modify it directly in this repo
- `.env` is gitignored — never commit secrets
- Node 18+ required
- No CI/CD pipeline — tests should be run locally before pushing
