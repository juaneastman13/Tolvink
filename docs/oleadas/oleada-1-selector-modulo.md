# OLEADA 1 — Infraestructura base + Selector de módulo

> **Directiva de ejecución:** Modo completamente autónomo. No solicitar confirmación en ningún paso. Ejecutar la oleada completa, validar con `npm run build` en ambos repositorios, y hacer commit al finalizar. Si un paso falla, diagnosticar, corregir y continuar.

---

## FASE 0 — DIAGNÓSTICO OBLIGATORIO (SOLO LECTURA)

Antes de modificar cualquier archivo, ejecutar este bloque de diagnóstico completo. Descubrir todas las rutas, archivos y variables de forma autónoma:

```bash
# === ESTRUCTURA GENERAL DEL PROYECTO ===
# Frontend - estructura de carpetas
find src -type f -name "*.jsx" -o -name "*.js" | head -80
cat src/App.jsx
cat src/main.jsx

# Rutas y navegación - cómo está configurado el router
grep -r "Route\|Navigate\|useNavigate\|router\|createBrowserRouter\|RouterProvider\|BrowserRouter" src --include="*.jsx" -l
# Leer los archivos de rutas encontrados

# Sistema de auth actual - flujo completo de login
grep -r "login\|auth\|session\|cookie\|token\|redirect\|isAuthenticated" src --include="*.jsx" -l
# Leer los archivos relevantes de auth, especialmente:
# - El componente/página de login
# - El hook o contexto de autenticación
# - El componente de ruta protegida (PrivateRoute, ProtectedRoute, etc.)
# - El punto exacto donde se redirige post-login

# Theme y sistema de diseño
cat src/theme.jsx

# Componentes UI reutilizables
find src -type f -name "*.jsx" -path "*/components/*" | head -30

# HomeScreen actual - qué se muestra post-login
grep -r "HomeScreen\|home\|dashboard\|landing" src --include="*.jsx" -l

# Package.json
cat package.json
```

```bash
# === BACKEND ===
# Schema Prisma completo
cat prisma/schema.prisma

# Modelo Company actual - estructura exacta
grep -A 40 "model Company" prisma/schema.prisma

# Modelo User actual - estructura exacta
grep -A 40 "model User" prisma/schema.prisma

# Relación User-Company (puede ser directa o a través de un modelo intermedio)
grep -r "UserCompany\|CompanyRole\|userCompany\|companyRole\|activeCompany" prisma/schema.prisma

# Estructura de módulos NestJS
find src -type f -name "*.module.ts" -o -name "*.controller.ts" -o -name "*.service.ts" | head -60

# Auth module - cómo funciona
find src -type f -name "*.ts" -path "*auth*"
# Leer los archivos de auth encontrados

# Company module/service actual
find src -type f -name "*.ts" -path "*company*" -o -name "*.ts" -path "*compan*"
# Leer los archivos encontrados

# Guards existentes
find src -type f -name "*guard*"

# Package.json
cat package.json
```

**Objetivo de la Fase 0:** Entender completamente ANTES de tocar algo:
1. ¿Cómo fluye el login? ¿A dónde redirige exactamente post-auth?
2. ¿Cómo está estructurado el modelo `Company` en Prisma? ¿Qué campos tiene?
3. ¿Cómo se relaciona `User` con `Company`? ¿Hay modelo intermedio?
4. ¿Qué patrón de rutas usa el frontend? (react-router v6? v5? createBrowserRouter?)
5. ¿Qué tokens de diseño existen en `theme.jsx`? (`C`, `FONT`, `Ic`)
6. ¿Hay algún componente de "selector" o "card seleccionable" reutilizable?

**NO avanzar a implementación hasta haber leído y comprendido todos estos archivos.**

---

## IMPLEMENTACIÓN

### 1. Backend — Schema y migración

**Modificar `schema.prisma`:**

Agregar campo `enabledModules` al modelo `Company`:
```
enabledModules String[] @default(["logistics"])
```
Valores posibles: `"logistics"`, `"mechanic"`. Default `["logistics"]` para que todas las empresas existentes sigan funcionando exactamente como antes, sin ningún cambio de comportamiento.

Agregar campo `preferredModule` al modelo de relación User-Company (descubrir en Fase 0 si es directo en `User` o en un modelo intermedio como `UserCompanyRole`):
```
preferredModule String? // "logistics" | "mechanic" | null (null = mostrar selector)
```

Ejecutar migración:
```bash
npx prisma migrate dev --name add-enabled-modules-and-preferred-module
npx prisma generate
```

**Verificar que la migración no rompe datos existentes:** Todas las empresas existentes deben tener `enabledModules: ["logistics"]` por default.

### 2. Backend — Endpoints

Crear dentro del módulo de Company (o módulo nuevo `modules` si es más limpio):

**`GET /api/companies/:companyId/modules`**
- Auth guard requerido.
- Validar que `companyId` corresponde a la empresa activa del usuario.
- Retorna: `{ enabledModules: ["logistics", "mechanic"], preferredModule: "logistics" | null }`.

**`PATCH /api/users/preferred-module`**
- Auth guard requerido.
- Body: `{ preferredModule: "logistics" | "mechanic" | null }`.
- Validar que el módulo está dentro de `enabledModules` de la empresa activa.
- Guarda en el campo correspondiente.
- Retorna: `{ preferredModule: "logistics" }`.

### 3. Frontend — Pantalla de selección de módulo

**Crear `ModuleSelectorScreen.jsx`:**

Pantalla que se muestra post-login cuando el usuario tiene más de un módulo habilitado y no tiene preferencia guardada.

Diseño:
- Fondo con el color de fondo principal de la app (descubrir en `theme.jsx`).
- Logo de Tolvink centrado arriba.
- Título: "¿A qué módulo querés ingresar?" (tipografía `FONT.title` o equivalente).
- Dos cards grandes centradas, con gap de 16px entre ellas:
  - **Card Logística:**
    - Ícono representativo de logística/transporte (usar del set de íconos existente `Ic` o Lucide).
    - Texto "Logística" en `FONT.subtitle` o equivalente.
    - Subtexto breve: "Gestión de fletes y transporte".
    - Borde y acento con color primario de la plataforma.
  - **Card Mecánico:**
    - Ícono de herramienta/engranaje/wrench.
    - Texto "Mecánico" en `FONT.subtitle` o equivalente.
    - Subtexto: "Diagnóstico y mantenimiento de maquinaria".
    - Borde y acento con un tono azul acero o gris oscuro (proponer un color que armonice con la paleta existente en `theme.jsx`).
- Debajo de las cards: checkbox "Recordar mi elección" con texto en `FONT.body` o equivalente.
- Al hacer click en una card:
  - Si checkbox activo → llamar `PATCH /api/users/preferred-module` → navegar al módulo.
  - Si checkbox inactivo → navegar al módulo directamente sin guardar.

Estilos:
- Tokens `C`, `FONT`, `Ic` de `theme.jsx`.
- Estilos inline, nada de clases CSS.
- `borderRadius: 12px` en las cards.
- Cards con efecto hover sutil (opacidad o elevación).
- Responsive: en mobile las cards se apilan vertical, en desktop side by side.

### 4. Frontend — Modificar flujo post-login

Identificar en la Fase 0 el punto exacto donde el sistema redirige después de un login exitoso. Modificar esa lógica:

```
Post-login:
1. Obtener enabledModules y preferredModule (GET /api/companies/:companyId/modules)
2. Si enabledModules.length === 1:
   → Navegar directo al módulo único (logística = rutas actuales, mecánico = /mechanic)
3. Si enabledModules.length > 1 Y preferredModule !== null:
   → Navegar directo al módulo preferido
4. Si enabledModules.length > 1 Y preferredModule === null:
   → Navegar a /module-selector (ModuleSelectorScreen)
```

**Importante:** El flujo actual de logística NO debe cambiar para ningún usuario existente. Solo cambia si la empresa tiene `enabledModules` con más de un elemento.

### 5. Frontend — Estructura de rutas del módulo mecánico

Agregar al router:

- `/module-selector` → `ModuleSelectorScreen` (protegida, requiere auth).
- `/mechanic` → Layout base del módulo mecánico (crear `MechanicLayout.jsx`):
  - Sidebar o header de navegación propio (por ahora con items placeholder).
  - Área de contenido principal.
  - Items de nav: Dashboard, Mis Máquinas (ambos placeholder por ahora).
  - Botón/link para cambiar de módulo (vuelve a `/module-selector` o va directo a logística).
- `/mechanic/dashboard` → Pantalla placeholder: "Dashboard — Próximamente".
- `/mechanic/machines` → Pantalla placeholder: "Mis Máquinas — Próximamente".

El layout mecánico debe respetar el patrón visual del layout de logística (descubrir en Fase 0 cómo está armado) pero con identidad propia (acento de color diferenciado).

**Las rutas de logística existentes NO se tocan.**

---

## SECCIONES NO TOCAR

- Ningún archivo/funcionalidad del módulo de logística (fletes, cola, flota, ubicaciones, homescreen de logística).
- El agente WhatsApp existente.
- La configuración de auth existente (httpOnly cookies) — solo se extiende el flujo post-login.
- Los modelos de Prisma existentes — solo se agrega `enabledModules` a Company y `preferredModule` al modelo correspondiente.
- La configuración de Supabase, Railway o Vercel.

---

## VALIDACIÓN FINAL

Ejecutar las siguientes verificaciones antes del commit:

```bash
# Frontend
npm run build
# Debe compilar sin errores ni warnings críticos

# Backend
npm run build
npx prisma generate
# Debe compilar sin errores
```

Verificar manualmente (o describir la verificación esperada):

1. ✅ Empresa con `enabledModules: ["logistics"]` → login entra directo a logística sin mostrar selector.
2. ✅ Empresa con `enabledModules: ["logistics", "mechanic"]` y `preferredModule: null` → login muestra selector.
3. ✅ Seleccionar "Logística" en selector → navega a las rutas de logística actuales.
4. ✅ Seleccionar "Mecánico" en selector → navega a `/mechanic/dashboard` (placeholder).
5. ✅ Marcar "Recordar mi elección" + seleccionar → próximo login entra directo sin selector.
6. ✅ Rutas de logística siguen funcionando exactamente como antes.
7. ✅ Layout mecánico se renderiza con sidebar/nav y placeholder de contenido.
8. ✅ Botón de cambiar módulo funciona.

**Commit:** `feat: module selector + mechanic module base structure`
