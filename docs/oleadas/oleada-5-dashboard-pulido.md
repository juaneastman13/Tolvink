# OLEADA 5 — Dashboard de flota mecánica + pulido final

> **Directiva de ejecución:** Modo completamente autónomo. No solicitar confirmación en ningún paso. Ejecutar la oleada completa, validar con `npm run build` en ambos repositorios, y hacer commit al finalizar. Si un paso falla, diagnosticar, corregir y continuar.

> **Prerequisito:** Oleadas 1-4 implementadas y funcionando (selector, maquinaria, mantenimiento, diagnóstico).

---

## FASE 0 — DIAGNÓSTICO OBLIGATORIO (SOLO LECTURA)

```bash
# === VERIFICAR TODO EL ESTADO ACTUAL ===
# Schema completo
cat prisma/schema.prisma

# Verificar todos los modelos del módulo mecánico existen
grep "model Machine\b\|model MachineTemplate\|model MaintenanceRecord\|model MaintenancePlan\|model MaintenanceAlert\|model DiagnosticSession" prisma/schema.prisma

# === FRONTEND — ESTRUCTURA ACTUAL DEL MÓDULO MECÁNICO ===
# Todas las pantallas creadas
find src -type f -name "*.jsx" -path "*mechanic*" -o -name "*.jsx" -path "*Mechanic*" -o -name "*.jsx" -path "*machine*" -o -name "*.jsx" -path "*Machine*" -o -name "*.jsx" -path "*diagnostic*" -o -name "*.jsx" -path "*Diagnostic*"
# Leer cada archivo encontrado

# Layout mecánico actual — sidebar/nav
grep -r "MechanicLayout\|mechanicLayout" src --include="*.jsx" -l
# Leer el layout

# Rutas actuales del módulo mecánico
grep -r "mechanic" src --include="*.jsx" -l
# Leer la configuración de rutas

# === BACKEND — ENDPOINTS EXISTENTES ===
# Todos los controllers del módulo mecánico
find src -type f -name "*.controller.ts" -path "*machine*" -o -name "*.controller.ts" -path "*maintenance*" -o -name "*.controller.ts" -path "*diagnostic*"
# Leer cada controller

# Servicio de alertas
find src -type f -name "*alert*" -path "*maintenance*"
# Leer el servicio de alertas

# === REFERENCIA — DASHBOARD DE LOGÍSTICA (SI EXISTE) ===
# Para replicar patrón visual
grep -r "dashboard\|Dashboard\|HomeScreen\|homeScreen" src --include="*.jsx" -l
# Leer el dashboard/home de logística como referencia de diseño

# Theme
cat src/theme.jsx
```

**Objetivo de la Fase 0:** Entender:
1. Estado completo de todas las pantallas del módulo mecánico.
2. Cómo está armado el layout y la navegación del módulo.
3. Si hay un dashboard de logística cuyo patrón visual replicar.
4. Endpoints disponibles para armar las queries del dashboard.
5. Cómo funciona el servicio de alertas para obtener el conteo por estado.

**NO avanzar a implementación hasta haber leído y comprendido el estado completo.**

---

## IMPLEMENTACIÓN

### 1. Backend — Endpoint de dashboard

**Crear `GET /api/mechanic/dashboard`:**

Auth guard + filtrar por `activeCompanyId`.

Retorna:

```json
{
  "summary": {
    "totalMachines": 12,
    "activeMachines": 10,
    "upToDate": 7,
    "alertsPending": 2,
    "openIssues": 1
  },
  "machines": [
    {
      "id": "uuid",
      "brand": "John Deere",
      "model": "8245R",
      "machineType": "tractor",
      "year": 2020,
      "serialNumber": "...",
      "currentHorometer": 3200,
      "photoUrl": "https://...",
      "status": "up_to_date",
      "alertsCount": 0,
      "openDiagnosticsCount": 0,
      "nextMaintenance": {
        "type": "Cambio de aceite",
        "estimatedAt": "~3400 hs o Jun 2026"
      },
      "lastMaintenance": {
        "type": "Service programado",
        "date": "2026-02-15",
        "horometerReading": 3000
      }
    }
  ],
  "recentAlerts": [
    {
      "id": "uuid",
      "machineId": "uuid",
      "machineBrand": "John Deere",
      "machineModel": "8245R",
      "label": "Cambio de filtros",
      "message": "Vencido — 120 hs de atraso",
      "severity": "overdue",
      "status": "pending"
    }
  ],
  "recentDiagnostics": [
    {
      "id": "uuid",
      "machineId": "uuid",
      "machineBrand": "Case IH",
      "machineModel": "Magnum 310",
      "title": "Pérdida de potencia en subida",
      "status": "open",
      "createdAt": "2026-03-28T14:30:00Z",
      "messagesCount": 6
    }
  ]
}
```

**Lógica de cálculo del status por máquina:**

Para cada máquina activa:
1. Contar `MaintenanceAlert` con `status: "pending"`.
2. Contar `DiagnosticSession` con `status: "open"`.
3. Determinar estado:
   - Si tiene diagnósticos abiertos → `"open_issue"` (rojo).
   - Si tiene alertas pending con severity "overdue" → `"overdue"` (rojo).
   - Si tiene alertas pending con severity "warning" → `"alert"` (amarillo).
   - Si no tiene ninguna → `"up_to_date"` (verde).

**Próximo mantenimiento estimado:**
- Del `MaintenancePlan` de la máquina, calcular cuál intervalo vence primero.
- Estimar basándose en: horómetro actual + intervalo - último service de ese tipo.

**Listas recientes:**
- `recentAlerts`: últimas 5 alertas pending/overdue de la empresa.
- `recentDiagnostics`: últimas 5 sesiones abiertas de la empresa.

### 2. Frontend — Dashboard principal del módulo mecánico

**Reemplazar el placeholder de `/mechanic/dashboard` con `MechanicDashboardScreen.jsx`:**

**Sección superior — Counters:**
- Tres cards de resumen en fila (responsive: stack en mobile):
  - **Al día** (verde): número de máquinas up_to_date. Ícono de check.
  - **Alertas** (amarillo/naranja): número de máquinas con alert + overdue. Ícono de warning.
  - **Problemas abiertos** (rojo): número de máquinas con open_issue. Ícono de alerta.
- Cada counter es clickeable → filtra el listado de máquinas abajo por ese estado.

**Sección media — Alertas y diagnósticos recientes:**
- Dos columnas (o tabs en mobile):
  - **Alertas recientes:** Lista compacta de las últimas alertas. Cada item: máquina + tipo de alerta + severity badge. Click → navega a la ficha de la máquina, tab mantenimiento.
  - **Diagnósticos abiertos:** Lista compacta de sesiones abiertas. Cada item: máquina + título del diagnóstico + fecha. Click → navega a la sesión de diagnóstico.

**Sección inferior — Listado de máquinas:**
- Cards o filas con todas las máquinas de la empresa.
- Cada card:
  - Foto (o ícono placeholder según tipo de máquina).
  - Marca + Modelo (bold).
  - Tipo de máquina (badge).
  - Horómetro actual.
  - Indicador de estado: dot verde/amarillo/rojo.
  - Próximo mantenimiento (texto breve).
  - Alertas activas (si hay, badge con número).
  - Diagnósticos abiertos (si hay, badge con número).
- Click en card → navega a `/mechanic/machines/:id`.
- Filtros: por tipo de máquina, por estado, búsqueda por marca/modelo.
- Si no hay máquinas: estado vacío con CTA "Registrar tu primera máquina →".

**Estilos:**
- Tokens `C`, `FONT`, `Ic` de `theme.jsx`.
- Inline, `borderRadius: 12px`.
- Paleta de estado: Verde para al día, Amarillo/Naranja para alertas, Rojo para problemas.
- El dashboard debe sentirse como el "home" del módulo mecánico.

### 3. Frontend — Pulido de navegación del módulo mecánico

**Actualizar `MechanicLayout.jsx`:**

- Sidebar (desktop) / bottom nav (mobile) con items finales:
  - **Dashboard** (ícono home/gauge) → `/mechanic/dashboard` — activo por defecto.
  - **Mis Máquinas** (ícono tractor/list) → `/mechanic/machines`.
  - Separador.
  - **Cambiar módulo** (ícono switch/swap) → navega a `/module-selector` (o directo a logística si solo tiene dos módulos).

- Header del módulo:
  - Logo "Tolvink Mecánico" o variación del logo principal.
  - Nombre de la empresa activa.
  - Avatar/menú del usuario (reutilizar el que ya existe en logística).

- Ruta por defecto de `/mechanic` → redirect a `/mechanic/dashboard`.

### 4. Pulido general — Revisión de UX

**Verificar y corregir estos flujos completos:**

1. **Login → Selector → Dashboard mecánico → Mis Máquinas → Crear máquina → Ficha → Tab mantenimiento → Registrar intervención.**
2. **Ficha de máquina → Tab diagnósticos → Nuevo diagnóstico → Enviar mensaje con imagen → Recibir respuesta → Marcar resuelto.**
3. **Ficha de máquina → Diagnóstico → Compartir → Abrir link en incógnito.**
4. **Dashboard → Click en alerta → Ficha de máquina → Tab mantenimiento → Registrar intervención desde alerta.**
5. **Dashboard → Click en diagnóstico abierto → Sesión de diagnóstico.**
6. **Cambiar módulo → Ir a logística → Verificar que logística sigue funcionando normal → Volver a mecánico.**

**Para cada flujo, verificar:**
- Navegación sin errores de consola.
- Loading states en todas las llamadas a API.
- Estados vacíos con mensajes útiles.
- Responsive: que funcione en mobile y desktop.
- Breadcrumbs o indicadores de ubicación claros.

### 5. Backend — Revisión de seguridad

Verificar que TODOS los endpoints del módulo mecánico:

- Tienen auth guard (excepto los explícitamente públicos: `/public/diagnostic-sessions/:shareToken`).
- Filtran por `activeCompanyId` — nunca exponer datos entre empresas.
- Validan pertenencia de recursos (no poder acceder a una máquina de otra empresa manipulando IDs en URL).
- Los paths de Supabase Storage incluyen `companyId`: `companies/{companyId}/mechanic/...`.
- El endpoint público de diagnóstico compartido NO expone datos sensibles.
- Los `shareToken` expiran correctamente.

---

## SECCIONES NO TOCAR

- Módulo de logística completo — VERIFICAR que sigue funcionando exactamente igual.
- El agente WhatsApp existente.
- Configuración de auth base.
- Configuración de Supabase, Railway, Vercel.

---

## VALIDACIÓN FINAL

```bash
# Frontend
npm run build
# Sin errores ni warnings críticos

# Backend  
npm run build
npx prisma generate
# Sin errores
```

Verificaciones:

1. ✅ Dashboard muestra counters correctos: al día, alertas, problemas abiertos.
2. ✅ Dashboard counters son clickeables y filtran el listado.
3. ✅ Alertas recientes muestran las últimas alertas y navegan correctamente.
4. ✅ Diagnósticos abiertos muestran sesiones abiertas y navegan correctamente.
5. ✅ Cards de máquinas muestran estado visual correcto (verde/amarillo/rojo).
6. ✅ Próximo mantenimiento estimado se muestra en cada card.
7. ✅ Filtros del listado funcionan (tipo de máquina, estado, búsqueda).
8. ✅ Navegación sidebar/bottom nav funciona en desktop y mobile.
9. ✅ "Cambiar módulo" funciona → va a logística → logística funciona normal → puede volver.
10. ✅ Estado vacío del dashboard muestra CTA si no hay máquinas.
11. ✅ Flujo completo login → selector → dashboard → máquina → mantenimiento → diagnóstico → compartir funciona sin errores.
12. ✅ Ningún endpoint del módulo mecánico expone datos de otras empresas.
13. ✅ Build limpio en ambos repos.
14. ✅ El módulo de logística sigue funcionando exactamente como antes de las 5 oleadas.

**Commit:** `feat: mechanic dashboard with fleet status overview + navigation polish`

---

## POST-OLEADA 5 — REVISIÓN INTEGRAL

Una vez completadas las 5 oleadas, hacer una revisión final:

```bash
# Build limpio
cd frontend && npm run build
cd backend && npm run build && npx prisma generate

# Verificar que no hay imports rotos o dependencias faltantes
grep -r "from '.*mechanic\|from '.*Machine\|from '.*Diagnostic\|from '.*Maintenance" src --include="*.jsx" --include="*.ts" | grep -i "error\|undefined\|null" || echo "No broken imports found"

# Verificar tamaño de bundle del frontend (no debería haberse inflado excesivamente)
npm run build 2>&1 | tail -20
```

**El módulo mecánico está completo y listo para testing con usuarios reales.**
