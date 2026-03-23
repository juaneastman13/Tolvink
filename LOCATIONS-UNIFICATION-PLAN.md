# Ubicaciones — Plan de Unificación LocationsScreen + FieldsScreen

**Fecha:** 2026-03-13
**Estado:** Auditoría completa, pendiente implementación

---

## Parte A — Auditoría de FieldsScreen.jsx (255 líneas)

### Funcionalidades

| Funcionalidad | Líneas | Estado |
|---|---|---|
| Listar campos con lotes anidados | 136-253 | ✅ |
| Crear campo (nombre + dirección + ubicación) | 37-49, 125-133 | ✅ |
| Editar campo (ubicación vía LocationPicker) | 65-83, 184-193 | ✅ |
| Crear lote dentro de campo (nombre + hectáreas + ubicación) | 51-63, 228-241 | ✅ |
| Editar lote (hectáreas + ubicación) | 85-111, 213-224 | ✅ |
| Expandir/colapsar campo para ver lotes | 161, 172 | ✅ |
| Ver en mapa (campo o lote) | 176, 207 | ✅ |
| Agrupar por empresa (multi-company) | 137-146 | ✅ |

### Endpoints consumidos

| Endpoint | Método | Función | Línea |
|---|---|---|---|
| `/fields` | GET | `apiGetFields()` | 33 |
| `/fields` | POST | `apiCreateField(body)` | 41 |
| `/fields/:id` | PATCH | `apiUpdateField(id, body)` | 76 |
| `/fields/:fieldId/lots` | POST | `apiCreateLot(fieldId, body)` | 55 |
| `/fields/:fieldId/lots/:lotId` | PATCH | `apiUpdateLot(fieldId, lotId, body)` | 104 |

**Nota:** `apiGetFieldLots` se importa (línea 6) pero **NO se usa** — los lotes vienen anidados en `apiGetFields()`.

### Formularios e inputs

#### Crear campo (líneas 125-133)
- **Nombre** (`fieldName`): texto, obligatorio — validación: `trim()` no vacío
- **Ubicación** (`fieldLoc`): LocationPicker, opcional — provee lat/lng/address
- **Dirección** (`fieldAddr`): implícita desde LocationPicker

#### Crear lote (líneas 228-241)
- **Nombre** (`lotName`): texto, obligatorio — validación: `trim()` no vacío
- **Hectáreas** (`lotHa`): número, opcional — `parseFloat()`
- **Ubicación** (`lotLoc`): LocationPicker, opcional — provee lat/lng

#### Editar campo (líneas 184-193)
- **Ubicación** (`editFieldLoc`): LocationPicker solamente
- Inicialización: parsea `f.lat`/`f.lng` como Number (líneas 68-69)

#### Editar lote (líneas 213-224)
- **Hectáreas** (`editLotHa`): número, opcional
- **Ubicación** (`editLotLoc`): LocationPicker
- Inicialización con try/catch y fallback (líneas 85-98)

### Acciones por entidad

**Por campo (RowMenu, líneas 173-179):**
- "Ver en mapa" — solo si `f.lat && f.lng` existen
- "Editar" — abre formulario inline

**Por lote (RowMenu, líneas 204-210):**
- "Ver en mapa" — solo si `l.lat && l.lng` existen
- "Editar" — abre formulario inline

### Navegación
- Sin tabs — vista única con campos expandibles
- `onBack()` — volver al menú
- `goToMap(lat, lng, label)` — navegar al mapa (pasado como prop)

---

## Parte B — Auditoría de LocationsScreen.jsx (1,609 líneas)

### Layout

| Viewport | Comportamiento | Líneas |
|---|---|---|
| **Desktop (≥768px)** | Panel fijo a la izquierda (30%, max 420px, min 320px) + mapa a la derecha | 947-962 |
| **Mobile (<768px)** | Mapa fullscreen + panel como drawer lateral (85vw, max 360px, slide-in 250ms) | 951-958 |
| **Mobile backdrop** | Overlay semitransparente, click cierra drawer | 934-939 |
| **Mobile controles** | Botón "← Volver" (top-left) + "Lista" (bottom-left) | 1164-1194 |

### Secciones del panel (sin tabs, secciones colapsables)

| Sección | Estado default | Icono | Líneas |
|---|---|---|---|
| **POIs** (Ubicaciones de interés) | Abierta | `Ic.poi()` | 1092-1107 |
| **Campos** (con lotes anidados) | Abierta | `Ic.field()` | 1110-1126 |

Estado controlado por `sectionOpen = { pois: true, fields: true }` (línea 98).

### CRUD por entidad

#### Campos

| Operación | Disponible | Cómo | Líneas |
|---|---|---|---|
| **CREAR** | ❌ Solo vía import Google Maps | Import 3 pasos → clasificar como "Campo" | 176-184 |
| **LEER** | ✅ | `apiGetFields()` en mount | 113-124 |
| **EDITAR** | ✅ | RowMenu → "Editar ubicación" → LocationPicker inline | 392-415, 779-788 |
| **ELIMINAR** | ✅ | RowMenu → "Eliminar" → confirmación con cascada de lotes | 335-361, 715-730 |
| **COMPARTIR** | ✅ | RowMenu → "Compartir" → modal búsqueda usuarios | 267-280, 1301-1370 |
| **Mapa** | ✅ | Markers con `mkFieldIcon()` | 520 |

#### Lotes

| Operación | Disponible | Cómo | Líneas |
|---|---|---|---|
| **CREAR** | ❌ Solo vía import Google Maps | Import 3 pasos → clasificar como "Lote" + asignar campo | 186-198 |
| **LEER** | ✅ | Anidados bajo campo expandido | 791-868 |
| **EDITAR** | ✅ | RowMenu → "Editar" → hectáreas + LocationPicker inline | 418-443, 852-865 |
| **ELIMINAR** | ✅ | RowMenu → "Eliminar" → confirmación | 349-361, 798-810 |
| **COMPARTIR** | ✅ | RowMenu → "Compartir" → modal búsqueda usuarios | 267-280, 1301-1370 |
| **Mapa** | ✅ | Markers con `mkLotIcon()` escala 0.85 | 521 |

#### POIs

| Operación | Disponible | Cómo | Líneas |
|---|---|---|---|
| **CREAR** | ❌ Solo vía import Google Maps | Import 3 pasos → clasificar como "Interés" | 200-207 |
| **LEER** | ✅ | Sección separada, propios + compartidos | 115, 458-460 |
| **EDITAR** | ⚠️ Parcial | Solo nombre + comentarios, **NO ubicación** | 231-250, 632-644 |
| **ELIMINAR** | ✅ | RowMenu → "Eliminar" / "Quitar" (compartido) → confirmación | 253-265, 647-660 |
| **COMPARTIR** | ✅ | RowMenu → "Compartir" → modal búsqueda usuarios | 267-280, 1301-1370 |
| **RECLASIFICAR** | ✅ | RowMenu → "Reclasificar" → POI a Campo o Lote | 364-389, 1376-1441 |
| **Mapa** | ✅ | Markers con `mkPoiIcon()` | 522 |

### Interacción Mapa ↔ Panel

| Dirección | Acción | Efecto | Líneas |
|---|---|---|---|
| **Panel → Mapa** | Click en entidad | `focusOnMap()`: pan + zoom 15 + info window | 566-592 |
| **Mapa → Panel** | Click en marker | `highlightPanelItem()`: scroll + expandir sección + expandir campo padre (si lote) | 530-544, 595-612 |
| **Mobile: Panel → Mapa** | Click en entidad | Cierra drawer automáticamente | 591 |
| **Mobile: Mapa → Panel** | Click en marker | Abre drawer automáticamente | 611 |

### Google Maps Import (3 pasos)

1. **Pegar URL** (líneas 1018-1039): validación de URL Google Maps, `apiImportGoogleList(url)`
2. **Clasificar** (líneas 1042-1080, componente `ImportClassifyPanel` líneas 1447-1608):
   - Por cada ubicación: select/deselect, editar nombre, tipo (Campo/Lote/Interés), campo padre (si lote), comentarios (si POI)
   - Preview en mapa vía `MapPreviewModal`
3. **Crear** (líneas 158-224): crea campos primero, luego lotes (referenciando nuevos campos), luego POIs

### Búsqueda y filtrado

| Feature | Implementación | Líneas |
|---|---|---|
| **Búsqueda texto** | Input en panel, filtra POIs + campos + lotes por nombre | 96, 987-1004, 618-622 |
| **Filtros de mapa** | Chips toggle por tipo (Campo, Lote, Interés) | 100, 614, 1139-1161 |

### Conexión con flujo de flete

**❌ NO hay integración directa.** LocationsScreen es standalone — `onBack` navega a `/menu`. No pasa datos a NewScreen ni tiene modo de selección.

---

## Parte C — Auditoría del flujo de solicitud de flete (NewScreen.jsx)

### Selección de ORIGEN

**Dos modos** toggle (estado `originMode`, línea 128):

#### Modo "field" (default)
1. Dropdown de campos — datos de `props.fields` (del catálogo)
2. Al seleccionar campo → `apiGetFieldLots(fieldId)` carga lotes (línea 248)
3. Dropdown de lotes
4. **Crear lote on-the-fly** (línea 611): formulario inline con nombre + LocationPicker → `apiCreateLot()`
5. Validación: requiere `fieldId` AND `lotId`

#### Modo "map" (custom)
1. Input nombre (opcional)
2. LocationPicker para lat/lng
3. Validación: requiere `customOrigin.lat` no null

### Selección de DESTINO

**Dos modos** toggle (estado `destMode`, línea 130):

#### Modo "plant" (default)
1. Dropdown de plantas — datos de `props.plants`
2. Branches filtrados por `companyId` de planta seleccionada (línea 267)
3. Validación: requiere `plantId` AND (si hay branches) `branchId`

#### Modo "custom"
1. Input nombre + LocationPicker
2. Selector de confirmación: "Planta" (requiere seleccionar planta) o "Nadie"
3. Validación: requiere `customDest.lat` AND (si confirmMode="plant") `confirmPlantId`

### Datos que usa NewScreen

| Dato | Fuente | Prop |
|---|---|---|
| Campos | `catalog.fields` (vía `useCatalog` hook) | `fields` |
| Lotes | `apiGetFieldLots()` on-demand | fetched |
| Plantas | `catalog.plants` | `plants` |
| Sucursales | `catalog.branches` | `branches` |
| Camiones | `catalog.trucks` | `trucks` |
| **POIs** | **NO se usan** | — |

### PickLocationScreen — Separado

- Ruta: `/campo/[slug]/ubicacion`, `/ubicacion/[slug]`, `/pick-location`
- **Uso exclusivo WhatsApp** — no conectado con NewScreen ni LocationsScreen
- Endpoints: `POST /whatsapp/save-location-by-slug`

### Hallazgos clave

1. **NewScreen no usa POIs** — las ubicaciones de interés no aparecen como opción de origen
2. **Se puede crear lote on-the-fly** en NewScreen (línea 611) pero **NO campo**
3. **Si no hay campos** → el selector de origen está vacío, sin call-to-action para crear
4. **No hay flujo LocationsScreen → NewScreen** — son pantallas independientes

---

## Parte D — Bugs y problemas actuales en LocationsScreen

### Prioridad Alta (impacto en flujo de flete)

| # | Bug/Problema | Archivo:Línea | Descripción | Corrección propuesta |
|---|---|---|---|---|
| D1 | **No se pueden crear campos/lotes directamente** | LocationsScreen.jsx:N/A | Solo vía import Google Maps. Si el usuario quiere agregar un campo simple, debe importar una lista de Google Maps o usar FieldsScreen | Agregar botón "+" en header de sección Campos con formulario inline (nombre + LocationPicker) |
| D2 | **No se pueden crear POIs directamente** | LocationsScreen.jsx:N/A | Solo vía import. Mismo problema que D1 | Agregar botón "+" en header de sección POIs con formulario inline (nombre + comentarios + LocationPicker) |
| D3 | **POI: no se puede editar ubicación** | LocationsScreen.jsx:632-644 | Edit solo permite nombre y comentarios. Fields y Lots sí tienen LocationPicker | Agregar LocationPicker al formulario de edición de POI |
| D4 | **No hay integración con NewScreen** | LocationsScreen.jsx:N/A | LocationsScreen no puede enviar una ubicación seleccionada al flujo de flete | Agregar prop `onSelectLocation` y modo "selección" para el flujo de flete |

### Prioridad Media (UX)

| # | Bug/Problema | Archivo:Línea | Descripción | Corrección propuesta |
|---|---|---|---|---|
| D5 | **Empty state desktop: "Importar" no funciona** | LocationsScreen.jsx:1196-1206 | En desktop sin ubicaciones, el botón "Importar" llama `setDrawerOpen(true)` que no tiene efecto en desktop | En desktop, abrir directamente `setImportStep(1)` |
| D6 | **Info window sin acciones** | LocationsScreen.jsx:534-541 | Click en marker muestra nombre/tipo/dirección pero sin botones Edit/Delete/Share | Agregar botones de acción en el info window HTML |
| D7 | **Importación: descartadas sin detalle** | LocationsScreen.jsx:1464-1465 | Muestra cantidad de descartadas pero no cuáles ni por qué | Mostrar lista expandible de ubicaciones descartadas con razón |
| D8 | **Edición de lote: sin contexto de campo padre** | LocationsScreen.jsx:852-865 | El form de edición de lote no muestra a qué campo pertenece | Mostrar nombre del campo padre en el header del formulario |

### Prioridad Baja (code quality)

| # | Bug/Problema | Archivo:Línea | Descripción | Corrección propuesta |
|---|---|---|---|---|
| D9 | **`EmptyState` importado pero no usado** | LocationsScreen.jsx:4 | Import muerto | Eliminar import |
| D10 | **Magic z-index dispersos** | Varias | 100, 101, 5, 9998, 9999 en distintos lugares | Extraer a constantes con nombres semánticos |
| D11 | **Share search debounce manual** | LocationsScreen.jsx:284 | Timer con useRef en vez de custom hook | Bajo impacto, dejar para refactor general |

---

## Parte E — Plan de Unificación

### E1. Funcionalidad a absorber de FieldsScreen

FieldsScreen tiene estas funcionalidades que **NO existen** en LocationsScreen:

| Funcionalidad | FieldsScreen | LocationsScreen | Acción |
|---|---|---|---|
| **Crear campo** (nombre + dirección + ubicación) | ✅ Formulario inline | ❌ Solo import | **Agregar** formulario inline en sección Campos |
| **Crear lote** dentro de campo (nombre + hectáreas + ubicación) | ✅ Formulario inline bajo campo expandido | ❌ Solo import | **Agregar** botón "Agregar lote" en campo expandido |
| **Editar nombre de campo** | Implícito (solo ubicación) | No edita nombre | **No necesario** — nombre se edita solo desde admin |
| **Agrupación por empresa** (multi-company) | ✅ Headers con nombre empresa | ❌ Lista plana | **Agregar** agrupación condicional si >1 empresa |

**Integración propuesta:**

1. **Crear campo:** Botón "+" en header de sección Campos → formulario inline con:
   - Input nombre (obligatorio)
   - LocationPicker (opcional, para lat/lng/address)
   - Botones Guardar / Cancelar
   - API: `apiCreateField({ name, address, lat, lng })`

2. **Crear lote:** Botón "Agregar lote" al final de lotes en campo expandido → formulario inline con:
   - Input nombre (obligatorio)
   - Input hectáreas (opcional)
   - LocationPicker (opcional)
   - Botones Guardar / Cancelar
   - API: `apiCreateLot(fieldId, { name, hectares, lat, lng })`

3. **Crear POI:** Botón "+" en header de sección POIs → formulario inline con:
   - Input nombre (obligatorio)
   - Input comentarios (opcional)
   - LocationPicker (obligatorio — un POI sin ubicación no tiene sentido)
   - Botones Guardar / Cancelar
   - API: `apiCreatePoi({ name, comments, lat, lng })`

4. **Multi-company grouping:** Condicional — si el usuario tiene campos de >1 empresa, agrupar con headers.

### E2. Bugs y mejoras a corregir (orden por impacto)

1. **D1** — Crear campo directo (bloquea unificación)
2. **D2** — Crear lote directo (bloquea unificación)
3. **D3** — Crear POI directo (bloquea unificación)
4. **D5** — Empty state desktop (bug funcional)
5. **D3** — POI: editar ubicación (inconsistencia)
6. **D8** — Lote: mostrar campo padre en edit
7. **D6** — Info window con acciones
8. **D7** — Import: mostrar descartadas
9. **D9** — Limpiar imports muertos

### E3. Cambios de navegación

#### Archivos a modificar

| Archivo | Cambio | Línea actual |
|---|---|---|
| `src/routing/Router.jsx` | Eliminar `FieldsScreen` lazy import | 17 |
| `src/routing/Router.jsx` | Eliminar `fields: "/fields"` de `SCREEN_TO_PATH` | 51 |
| `src/layout/AppLayout.jsx` | Eliminar `FieldsScreen` de imports | 16 |
| `src/layout/AppLayout.jsx` | Eliminar render condicional `screen==="fields"` | 539 |
| `src/layout/AppLayout.jsx` | Actualizar `navActive` para eliminar "fields" | 419 |
| `src/screens/MenuScreen.jsx` | Cambiar `k:"fields"` → `k:"locations"` en item del menú | 43 |
| `src/screens/MenuScreen.jsx` | Renombrar label `"Mis Campos y Lotes"` → `"Mis Ubicaciones"` (o mantener, ver nota) | 43 |

#### Redirección

- Si alguien navega a `/fields` (bookmark, link viejo) → redirigir a `/locations`
- Agregar en Router.jsx: redirect de `/fields` a `/locations`

#### Nota sobre naming

"Mis Campos y Lotes" describe exactamente lo que hace FieldsScreen. Al unificar con LocationsScreen que también maneja POIs, el item del menú debería ser:
- **Opción A:** "Ubicaciones" (actual nombre de LocationsScreen)
- **Opción B:** "Mis Ubicaciones" (más personal)
- **Recomendación:** "Ubicaciones" — ya existe así, solo eliminar el item duplicado "Mis Campos y Lotes"

### E4. Descomposición propuesta de LocationsScreen

LocationsScreen con 1,609 líneas + funcionalidad nueva de FieldsScreen → ~1,900+ líneas. **Debe descomponerse.**

```
src/screens/LocationsScreen.jsx        (orquestador, ~400 líneas)
  ├── src/components/locations/
  │   ├── LocationsPanel.jsx            (~300 líneas) — panel lateral con secciones
  │   ├── LocationsMap.jsx              (~200 líneas) — mapa con markers + info windows
  │   ├── FieldForm.jsx                 (~80 líneas)  — crear/editar campo
  │   ├── LotForm.jsx                   (~80 líneas)  — crear/editar lote
  │   ├── PoiForm.jsx                   (~80 líneas)  — crear/editar POI
  │   ├── ShareModal.jsx                (~100 líneas) — compartir entidad (genérico)
  │   ├── ReclassifyModal.jsx           (~80 líneas)  — reclasificar POI
  │   ├── ImportFlow.jsx                (~200 líneas) — import Google Maps (3 pasos)
  │   └── ImportClassifyPanel.jsx       (~170 líneas) — ya existe inline, extraer
```

**Responsabilidades:**

| Componente | Responsabilidad |
|---|---|
| **LocationsScreen** | Estado global, carga de datos, coordinación entre panel y mapa, rutas |
| **LocationsPanel** | Render de secciones (POIs, Campos), búsqueda, filtros, items con RowMenu |
| **LocationsMap** | Inicialización Google Maps, markers, info windows, fit bounds, filter chips |
| **FieldForm** | Formulario crear/editar campo (nombre, LocationPicker). Recibe `onSave`, `onCancel` |
| **LotForm** | Formulario crear/editar lote (nombre, hectáreas, LocationPicker). Recibe `fieldId`, `onSave`, `onCancel` |
| **PoiForm** | Formulario crear/editar POI (nombre, comentarios, LocationPicker). Recibe `onSave`, `onCancel` |
| **ShareModal** | Modal genérico para compartir cualquier entidad. Recibe `entityType`, `entityId` |
| **ReclassifyModal** | Modal para convertir POI → Campo/Lote. Recibe `poi`, `fields`, `onConfirm` |
| **ImportFlow** | Steps 1-3 del import Google Maps. Recibe `fields`, `onComplete` |
| **ImportClassifyPanel** | Step 2: clasificación de ubicaciones importadas. Ya existe inline (~160 líneas) |

### E5. Conexión con flujo de flete

#### Estado actual
- NewScreen recibe `fields` como prop del catálogo
- No hay forma de ir de LocationsScreen → NewScreen con una ubicación preseleccionada
- Si el usuario no tiene campos, NewScreen muestra dropdown vacío sin CTA

#### Propuesta de integración (futuro, fuera de esta fase)

**Opción A — Deep link con query params:**
```
/new?originFieldId=xxx&originLotId=yyy
```
- LocationsScreen agrega botón "Usar como origen" en RowMenu de campos/lotes
- Navega a `/new` con params pre-poblados
- NewScreen lee params y pre-selecciona

**Opción B — Modo selección:**
```jsx
<LocationsScreen mode="select" onSelect={(type, entity) => { ... }} />
```
- NewScreen abre LocationsScreen como overlay/modal
- Usuario elige campo/lote, LocationsScreen devuelve la entidad
- NewScreen pre-llena el origen

**Recomendación:** Opción A es más simple y desacoplada. Implementar en fase posterior.

#### Quick win inmediato
- En NewScreen, si `fields.length === 0` y `originMode === "field"`, mostrar CTA: "No tenés campos. [Crear campo →]" que navega a LocationsScreen
- Al volver de LocationsScreen, el catálogo se refresca y los nuevos campos aparecen

### E6. Orden de implementación

#### Paso 1 — Absorber CRUD de FieldsScreen (~2-3 horas)
- Agregar formulario inline "Crear campo" en sección Campos
- Agregar botón "Agregar lote" en campo expandido con formulario inline
- Agregar formulario inline "Crear POI" en sección POIs
- Agregar agrupación por empresa (condicional)
- **Criterio de éxito:** Todo lo que hace FieldsScreen se puede hacer desde LocationsScreen

#### Paso 2 — Corregir bugs existentes (~1-2 horas)
- D5: Fix empty state desktop
- D3: Agregar LocationPicker a edición de POI
- D8: Mostrar campo padre en edición de lote
- D9: Limpiar imports muertos

#### Paso 3 — Descomponer en sub-componentes (~3-4 horas)
- Extraer componentes según E4
- Mantener funcionalidad idéntica (refactor puro, sin cambios funcionales)
- Test manual de cada interacción después de extraer

#### Paso 4 — Mejorar UX mobile (~1-2 horas)
- Info window con acciones (edit/delete/share)
- Import: mostrar descartadas
- Smooth transitions en formularios inline
- Keyboard handling (Enter para guardar, Esc para cancelar)

#### Paso 5 — Eliminar FieldsScreen (~30 min)
- Eliminar `src/screens/FieldsScreen.jsx`
- Actualizar Router.jsx (eliminar import, eliminar ruta, agregar redirect)
- Actualizar AppLayout.jsx (eliminar render condicional)
- Actualizar MenuScreen.jsx (cambiar item del menú)
- Verificar que no queden referencias rotas

#### Paso 6 — Tests manuales del flujo completo (~1 hora)
- [ ] Crear campo desde LocationsScreen
- [ ] Crear lote dentro de campo
- [ ] Crear POI
- [ ] Editar campo (ubicación)
- [ ] Editar lote (hectáreas + ubicación)
- [ ] Editar POI (nombre + comentarios + ubicación)
- [ ] Eliminar campo (con confirmación, cascada lotes)
- [ ] Eliminar lote (con confirmación)
- [ ] Eliminar POI (con confirmación)
- [ ] Compartir campo/lote/POI
- [ ] Reclasificar POI → Campo
- [ ] Reclasificar POI → Lote
- [ ] Importar desde Google Maps
- [ ] Búsqueda filtra correctamente
- [ ] Filtros de mapa toggle
- [ ] Click en panel → foco en mapa
- [ ] Click en marker → highlight en panel
- [ ] Mobile: drawer abre/cierra
- [ ] Mobile: crear campo desde drawer
- [ ] Desktop: panel lateral funciona
- [ ] Navegar a `/fields` redirige a `/locations`
- [ ] Menú ya no muestra "Mis Campos y Lotes"
- [ ] NewScreen sigue funcionando (fields prop del catálogo)
- [ ] Multi-company: campos agrupados correctamente

---

## Apéndice A — Referencias de archivos afectados

| Archivo | Rol | Acción |
|---|---|---|
| `src/screens/LocationsScreen.jsx` | Pantalla principal | **Modificar** (absorber CRUD, luego descomponer) |
| `src/screens/FieldsScreen.jsx` | Pantalla a eliminar | **Eliminar** en Paso 5 |
| `src/screens/NewScreen.jsx` | Flujo de flete | **Sin cambios** en esta fase (integración futura) |
| `src/screens/MenuScreen.jsx` | Menú de navegación | **Modificar** (eliminar item "Mis Campos y Lotes") |
| `src/routing/Router.jsx` | Rutas | **Modificar** (eliminar ruta `/fields`, agregar redirect) |
| `src/layout/AppLayout.jsx` | Layout principal | **Modificar** (eliminar render de FieldsScreen) |
| `src/hooks/useCatalog.jsx` | Datos del catálogo | **Sin cambios** |
| `src/api.js` | Endpoints | **Sin cambios** (todos los endpoints ya usados por LocationsScreen) |
| `src/maps.jsx` | Componentes de mapa | **Sin cambios** |

## Apéndice B — Endpoints compartidos

Todos los endpoints que usa FieldsScreen ya están importados y usados en LocationsScreen:
- `apiGetFields()` — ✅ ya en LocationsScreen:7
- `apiCreateField()` — ✅ ya en LocationsScreen:7
- `apiUpdateField()` — ✅ ya en LocationsScreen:7
- `apiCreateLot()` — ✅ ya en LocationsScreen:7
- `apiUpdateLot()` — ✅ ya en LocationsScreen:7

No se necesitan nuevos endpoints para la unificación.

## Apéndice C — RowMenu ya es compartido

`FieldsScreen` importa `RowMenu` desde `LocationsScreen` (línea 2):
```javascript
import { RowMenu } from "./LocationsScreen";
```

Al eliminar FieldsScreen, no se pierde nada — RowMenu vive en LocationsScreen.
Cuando se descomponga LocationsScreen, RowMenu debería moverse a `src/components/locations/RowMenu.jsx` o a un componente compartido.
