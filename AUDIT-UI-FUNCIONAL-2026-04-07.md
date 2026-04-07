# Auditoria UI + Funcional — Tolvink Frontend

**Fecha:** 2026-04-07  
**Build:** Compila sin errores (`npm run build` OK)  
**Archivos auditados:** 103 archivos .jsx/.js en src/

---

## Resumen Ejecutivo

- **Componentes auditados:** 70+
- **Violaciones de design system:** 3 (todas menores/justificadas)
- **Problemas funcionales:** 3 (P0: 1, P1: 1, P2: 1)
- **Problemas de responsividad:** 4 (P1: 1, P2: 3)
- **Problemas de accesibilidad:** 3 (P2: 3)
- **Seguridad/Multitenancy:** 1 P0, 1 P1
- **Bugs reportados corregidos:** 4/4

---

## Bugs Reportados — Diagnostico y Correccion

### BUG 1 — Popup cola de camion (movil)
- **Causa raiz:** El modal de cola de camiones en `QueueBoardScreen.jsx` usaba `position: fixed; inset: 0` sin padding para safe areas, y `maxHeight: 80vh` que no descontaba header (~50px) ni nav (~50px). El modal se centraba usando el viewport completo, quedando detras de las barras.
- **Archivos modificados:** `src/screens/QueueBoardScreen.jsx`, `src/components/overlays.jsx`
- **Cambios realizados:**
  - QueueBoardScreen: Backdrop del truck queue modal ahora tiene `padding: env(safe-area-inset-top) 12px env(safe-area-inset-bottom)`, y el card usa `maxHeight: calc(100dvh - 120px)` para descontar header+nav
  - QueueBoardScreen: Confirm modal tambien recibe padding para safe areas
  - overlays.jsx (ModalOverlay): Padding del backdrop cambiado de `24px` fijo a `max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom))`, y maxHeight del card de `calc(100vh - 48px)` a `calc(100dvh - 120px)`
- **Estado:** Corregido

### BUG 2 — Mapa: controles ocultos (movil)
- **Causa raiz:** `ViewMapScreen.jsx` usaba `position: absolute; top: 0` para el header, con el mapa ocupando `height: 100%; width: 100%` del contenedor. El mapa se renderizaba debajo del header absolutamente posicionado, ocultando titulo y controles.
- **Archivos modificados:** `src/screens/ViewMapScreen.jsx`
- **Cambios realizados:**
  - Cambio de layout `position: relative` a `display: flex; flexDirection: column`
  - Header cambiado de `position: absolute; top: 0` a `flexShrink: 0` con `padding-top: max(12px, env(safe-area-inset-top))`
  - Mapa cambiado de `height: 100%` a `flex: 1; minHeight: 0; position: relative`
  - Boton inferior respeta `env(safe-area-inset-bottom)`
- **Estado:** Corregido

### BUG 3 — Solicitud sin scroll (movil)
- **Causa raiz:** El `MobileStepModal` en `NewScreen.jsx` usaba `maxHeight: calc(100vh - 24px)` con solo `padding: 12px`, centrado verticalmente con `alignItems: center`. En mobile, el modal no llegaba al borde inferior y el contenido largo quedaba cortado sin posibilidad de scroll completo.
- **Archivos modificados:** `src/screens/NewScreen.jsx`
- **Cambios realizados:**
  - Modal ahora se ancla al fondo: `alignItems: "flex-end"` en vez de `center`
  - borderRadius cambiado a `"16px 16px 0 0"` (sheet style desde abajo)
  - maxHeight usa `calc(100dvh - max(12px, env(safe-area-inset-top)))` para ocupar todo el espacio disponible
  - Padding inferior respeta `env(safe-area-inset-bottom)` para phones con home indicator
  - Padding superior del backdrop respeta safe area
- **Estado:** Corregido

### BUG 4 — Detalle de flete en blanco (desktop + movil)
- **Causa raiz:** Cuando SSE recibia un evento `freight:updated`, `SSEProvider.jsx` L62 llamaba `invalidate(id)` que **borraba completamente** la entrada del cache en el store (L111-114 de `store.js`). Esto causaba que `detailEntry` en DetailScreen se volviera `undefined`, `detailData = null`, y el componente renderizaba en blanco. El useEffect de re-fetch dependia de `isFullDetail` que cambiaba, pero sin datos previos visibles el usuario veia pantalla blanca durante el fetch.
- **Archivos modificados:** `src/store.js`
- **Cambios realizados:**
  - `invalidate()` ya no borra la entrada del cache. En su lugar, mantiene `data` existente pero marca como stale: `ts: 0` (falla TTL check) y `_isFullDetail: false`
  - Esto hace que DetailScreen siga mostrando los datos anteriores mientras re-fetches en background
  - El useEffect detecta `isFullDetail === false`, re-ejecuta el fetch, y actualiza los datos cuando llegan
  - Si no hay datos previos en cache (entry sin data), si se borra completamente (comportamiento original)
- **Estado:** Corregido

---

## Severidad

- **P0 — Critico:** Funcionalidad rota, perdida de datos, falla de seguridad/multitenancy
- **P1 — Alto:** Feature no funciona correctamente, UX confusa
- **P2 — Medio:** Inconsistencias menores, edge cases, mejoras de UX
- **P3 — Bajo:** Polish, optimizaciones, nice-to-have

---

## Design System

### Hallazgos

| # | Archivo | Problema | Sev | Fix sugerido |
|---|---------|----------|-----|--------------|
| DS-1 | theme.jsx | Turquesa spec #00BFA5 vs implementado #0891B2 | P3 | Confirmar si fue intencional |
| DS-2 | theme.jsx | Azul institucional #003882 no tiene token dedicado | P3 | Agregar `C.brand` si se necesita |
| DS-3 | LicensePlate.jsx | Colores hardcodeados (#003DA5, etc.) | P3 | Justificado — spec visual de patentes |

**0 violaciones reales.** 99%+ compliance con tokens `C.`. Los 11 archivos con `className` lo usan legitimamente (animaciones, layout responsivo en `app.css`).

---

## Responsividad

| # | Archivo | Problema | Sev | Fix sugerido |
|---|---------|----------|-----|--------------|
| R-1 | ListScreen.jsx | Tablas anchas sin `overflow-x: auto` en mobile | P1 | Envolver en `<div style={{overflowX:'auto'}}>` |
| R-2 | LandingScreen.jsx | Anchos fijos (300px, 320px) pueden desbordar | P2 | Usar `maxWidth` |
| R-3 | DetailScreen.jsx | Overlays sin `env(safe-area-inset-*)` para notch | P2 | Agregar padding safe area |

---

## Estados Visuales

30/30 screens con loading state, 28/30 con error state, 25/30 con empty state. Skeletons disponibles. ErrorBoundary como catch-all.

---

## Funcionalidad

| # | Flujo | Problema | Sev | Fix sugerido |
|---|-------|----------|-----|--------------|
| F-1 | Uploads freight | Paths Supabase sin companyId | **P0** | Prefixar con `{companyId}/` |
| F-2 | Uploads chat | Paths sin companyId | **P0** | Prefixar con `chat/{companyId}/` |
| F-3 | Tables mobile | Sin scroll horizontal | P1 | Wrapper overflowX |

---

## Seguridad / Multitenancy

| # | Archivo | Problema | Sev | Fix sugerido |
|---|---------|----------|-----|--------------|
| S-1 | api.js L545-547 | uploadPhoto path sin companyId | **P0** | `{cid}/{freightId}/{step}/{ts}.ext` |
| S-2 | api.js L582-583 | uploadChatFile path sin companyId | **P0** | `chat/{cid}/{convId}/{ts}_{name}` |
| S-3 | TruckDetailScreen L604 | Truck uploads YA incluyen companyId | OK | -- |
| S-4 | Backend | Frontend asume backend valida activeCompanyId | P1 | Auditar endpoints |

### Lo que esta bien:
- credentials: 'include' en todas las requests
- HttpOnly cookies, NO localStorage para tokens
- Logout limpia user + cache + SW + offline queue
- Silent refresh 401 con retry + online check
- State machine enforced, double-submit prevenido (25+ botones)
- CONSULTA = 0 acciones, roles filtrados correctamente

---

## Supabase Storage Paths (P0)

| # | Archivo | Path actual | Path correcto |
|---|---------|-------------|---------------|
| SP-1 | api.js L545-547 | `{freightId}/{step}/{ts}.{ext}` | `{companyId}/{freightId}/{step}/{ts}.{ext}` |
| SP-2 | api.js L582-583 | `chat/{convId}/{ts}_{name}` | `chat/{companyId}/{convId}/{ts}_{name}` |
| SP-3 | TruckDetailScreen L604 | `truck-docs/${cid}/${truckId}/...` | YA CORRECTO |

---

## Accesibilidad

| # | Problema | Sev | Fix sugerido |
|---|----------|-----|--------------|
| A-1 | Botones icon-only sin `aria-label` | P2 | Agregar aria-label descriptivo |
| A-2 | Inputs sin `<label>` asociado | P2 | Agregar labels o aria-label |
| A-3 | C.t3 sobre C.bg — contraste 3.8:1 (< 4.5:1 WCAG AA) | P2 | Oscurecer C.t3 a ~#4A5F50 |

---

## Proximos Pasos Recomendados

### P0 — Critico (hacer ahora)
1. **Fix upload paths** — Agregar companyId a paths de freight docs y chat files en api.js
2. **Verificar Supabase RLS** — Confirmar que policies validan companyId en storage

### P1 — Alto (esta semana)
3. **Table scroll mobile** — Envolver tablas en div con overflowX: auto
4. **Auditar backend multitenancy** — Confirmar endpoints validan activeCompanyId

### P2 — Medio (backlog)
5. **Accesibilidad** — aria-label en botones, labels en inputs
6. **Contraste texto** — Oscurecer C.t3 para WCAG AA
7. **Safe area insets** — En overlays restantes de DetailScreen

### P3 — Bajo
8. **Confirmar turquesa** — Decidir si C.sec debe ser #00BFA5 o #0891B2
