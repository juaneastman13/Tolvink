# Test Coverage Analysis — Tolvink v4.1

## Current State

The test suite has **6 test files** with ~149 test cases covering **6 out of ~50 source modules**. Tests exist for:

| Test File | Module Tested | Cases | Status |
|-----------|--------------|-------|--------|
| `api.test.js` | `api.js` | 27 | Passing |
| `constants.test.js` | `constants.jsx` | 28 | 2 failing (stale) |
| `freight-helpers.test.js` | `utils/freight-helpers.jsx` | 57 | Passing |
| `hooks.test.jsx` | `hooks/helpers.jsx` | 33 | 6 failing (stale) |
| `store.test.js` | `store.js` | 20 | 1 failing (stale) |
| `validation.test.js` | `validation.jsx` | 30 | Passing |

**8 tests are currently failing** due to source code evolving ahead of tests (new actions added, new unit types, new toast fields).

---

## Coverage Gaps — Ranked by Priority

### 1. `useAccessLevel.jsx` — **HIGH priority, EASY to test**

This hook controls the entire permission system (who can do what). It's pure logic with no UI side effects — ideal for unit testing.

**What to test:**
- `can(action)` returns correct booleans for each `accessLevel` (ADMIN, READWRITE, READONLY, NONE)
- `isConsultaFor(companyId)` correctly checks per-company consultation access
- Plant users bypass all access checks
- Permission overrides (`PERM_KEY_MAP`) correctly block READONLY users
- Edge case: missing `accessData`, empty arrays, unknown actions

**Impact:** Permission bugs are security-critical. A wrong `can()` result could expose admin actions to read-only users.

---

### 2. `useFreights.jsx` (merge logic) — **HIGH priority, MODERATE to test**

The `mergeFreight` function inside this hook reconciles list summaries with full detail data. Bugs here cause data loss or stale UI.

**What to test:**
- `mergeFreight` preserves `DETAIL_FIELDS` when a list refresh overwrites a detailed freight
- Optimistic status updates correctly mutate local state
- Rollback on API failure restores original data
- Status count tracking stays consistent after create/cancel/finish
- Pagination edge cases (concurrent `loadMore`, empty pages)
- Multi-truck freight status derivation (skips optimistic update path)

**Impact:** This is the core data layer. Merge bugs silently corrupt displayed freight data.

---

### 3. `useAuth.jsx` — **HIGH priority, MODERATE to test**

Authentication flows are critical and currently untested.

**What to test:**
- Login/signup call API and persist user correctly
- `switchCompany` prevents concurrent calls via `switchingRef`
- Session expiration triggers `authFailHandler` callback
- `simpleMode` toggle persists to localStorage
- `patchUser` optimistically updates user state
- Logout clears all auth state

**Impact:** Auth bugs lock users out or, worse, leak sessions across companies.

---

### 4. `useCatalog.jsx` — **MEDIUM priority, EASY to test**

Cache logic is pure and deterministic.

**What to test:**
- Cache key generation from `user.activeCompanyId + user.id`
- TTL expiration (5-minute window)
- Singleton loading prevents concurrent fetches
- Role-based conditional API calls (e.g., transporters only fetched for certain roles)
- Field filtering by company
- Fallback to cached data on API failure

**Impact:** Cache bugs cause stale dropdowns (wrong plants/trucks shown), leading to incorrect freight assignments.

---

### 5. `useTableInteractions.jsx` — **MEDIUM priority, VERY EASY to test**

Sorting logic is pure functions — the lowest-hanging fruit in the codebase.

**What to test:**
- Sort toggle cycle: `null → asc → desc → null`
- Numeric sorting (parseFloat)
- Date sorting (ISO strings)
- String sorting with `es-UY` locale
- Null/undefined values sort correctly
- `usePullToRefresh` threshold detection (50px)

**Impact:** Low risk, but very easy wins. Good candidate for a first PR to establish testing patterns.

---

### 6. `utils/pdf-report.js` — **MEDIUM priority, MODERATE to test**

Contains pure math (haversine distance) and formatting logic that can be extracted and tested.

**What to test:**
- Haversine distance calculation with known coordinate pairs
- Duration formatting (`_formatDuration`) edge cases: 0ms, negative, hours+minutes
- Date formatting with Spanish locale
- Missing coordinates fallback ("No disponibles")
- Missing freight fields default to "—"
- Page overflow detection logic

**Impact:** PDF reports are customer-facing documents. Wrong distances or dates erode trust.

---

### 7. `useNotifications.jsx` — **MEDIUM priority, EASY to test**

State management is straightforward.

**What to test:**
- `markRead` optimistically decrements unread count (with `Math.max(0)` guard)
- `markAllRead` zeroes count and marks all items
- Offline detection skips fetch
- Deferred fetch (3s delay) and cleanup

**Impact:** Notification badge bugs are visible and annoying but not data-critical.

---

### 8. `useSSE.jsx` + `SSEProvider.jsx` — **LOW priority, HARD to test**

Real-time event handling with browser APIs. Worth testing but requires significant mock infrastructure.

**What to test:**
- Reconnection backoff (exponential, capped at 30s)
- JSON parse errors per event are caught and logged
- Catalog refresh debounce in SSEProvider
- Sound/vibration only fire when document is visible

**Impact:** SSE bugs cause stale data, but the polling fallback mitigates this.

---

## Existing Test Issues to Fix

Before adding new tests, fix the **8 failing tests** caused by source code drift:

1. **`constants.test.js`** — `getActions('assigned', 'transporter')` now includes `"cancel"`; `UNITS` now has 5 entries instead of 4
2. **`hooks.test.jsx`** — `permsFor()` tests have stale expected values (6 failures suggest permission matrix changed)
3. **`store.test.js`** — `show()` now adds a `_ts` timestamp to toasts; test needs `toMatchObject` instead of `toEqual`

---

## Completely Untested Areas (No Coverage)

These modules have **zero test coverage**:

| Category | Files | Risk |
|----------|-------|------|
| **Hooks** | useAuth, useFreights, useCatalog, useNotifications, useSSE, useAccessLevel, useTableInteractions | HIGH — core business logic |
| **Providers** | AuthProvider, SSEProvider | MEDIUM — integration layer |
| **Utils** | pdf-report.js | MEDIUM — customer-facing output |
| **Components** | All 15+ components, all 8 modals | LOW — UI rendering |
| **Screens** | All 28 screens | LOW — integration/E2E territory |
| **Config** | features.js, logger.js, maps.jsx, uploads.jsx | LOW — infrastructure |

---

## Recommended Action Plan

### Phase 1 — Quick wins (fix existing + easy new tests)
1. Fix the 8 failing tests to get CI green
2. Add tests for `useTableInteractions` (pure sorting logic)
3. Add tests for `useAccessLevel` (pure permission logic)

### Phase 2 — Core business logic
4. Extract and test `mergeFreight` from `useFreights`
5. Test `useAuth` login/logout/switchCompany flows
6. Test `useCatalog` cache logic
7. Extract and test haversine + formatting from `pdf-report.js`

### Phase 3 — Integration & edge cases
8. Test `useNotifications` state management
9. Test SSE reconnection logic
10. Add component tests for critical forms (WeighTicketForm, AssignModal)

---

## Infrastructure Suggestions

- **Extract pure logic from hooks**: Functions like `mergeFreight`, haversine calculation, and permission checking are buried inside hooks. Extracting them to standalone utilities makes them trivially testable.
- **Add coverage thresholds**: Configure vitest coverage thresholds to prevent regression (start at current baseline, ratchet up).
- **CI integration**: Add a GitHub Actions workflow to run tests on PR — currently there's no CI testing gate.
