# OLEADA 3 — Módulo de mantenimiento

> **Directiva de ejecución:** Modo completamente autónomo. No solicitar confirmación en ningún paso. Ejecutar la oleada completa, validar con `npm run build` en ambos repositorios, y hacer commit al finalizar. Si un paso falla, diagnosticar, corregir y continuar.

> **Prerequisito:** Oleadas 1 y 2 implementadas y funcionando (selector de módulo, alta de maquinaria con wizard y catálogo).

---

## FASE 0 — DIAGNÓSTICO OBLIGATORIO (SOLO LECTURA)

```bash
# === VERIFICAR OLEADAS ANTERIORES ===
# Schema actual completo
cat prisma/schema.prisma

# Verificar modelos Machine, MachineTemplate existentes
grep -A 30 "model Machine " prisma/schema.prisma
grep -A 15 "model MachineTemplate" prisma/schema.prisma

# Endpoints de machines existentes
find src -type f -name "*.ts" -path "*machine*"
# Leer controller y service de machines

# Frontend - MachineDetailScreen actual (donde se agregarán tabs de mantenimiento)
grep -r "MachineDetail\|machineDetail\|machine-detail" src --include="*.jsx" -l
# Leer el archivo de detalle de máquina

# Cómo se manejan tabs en el frontend actualmente
grep -r "Tab\|tab\|TabPanel\|tabPanel" src --include="*.jsx" -l | head -10
# Leer si hay un componente de tabs reutilizable

# Verificar MachineTemplate.maintenanceIntervals - cómo se guardaron en seed
# Leer el seed file para entender la estructura del JSON de intervalos

# Cómo se manejan formularios con sub-items dinámicos (agregar N items)
# Buscar patrones existentes (ej: agregar N camiones a un flete, agregar N documentos)
grep -r "push\|append\|addItem\|removeItem" src --include="*.jsx" -l | head -10

# Cómo se manejan uploads de documentos/archivos en el proyecto
grep -r "upload\|Upload\|document\|Document\|file\|File" src --include="*.jsx" -l | head -15

# Theme - tokens
cat src/theme.jsx
```

**Objetivo de la Fase 0:** Entender:
1. Estructura exacta de `MachineDetailScreen` y sus tabs actuales.
2. Formato del JSON `maintenanceIntervals` en los templates del seed.
3. Patrón de formularios con items dinámicos (agregar/eliminar piezas).
4. Cómo funcionan los uploads de documentos/adjuntos.
5. Si hay un componente de timeline o listado cronológico reutilizable.

**NO avanzar a implementación hasta haber leído y comprendido todos estos archivos.**

---

## IMPLEMENTACIÓN

### 1. Backend — Modelos de datos

**Agregar a `schema.prisma`:**

```prisma
model MaintenanceRecord {
  id               String   @id @default(uuid())
  machineId        String
  machine          Machine  @relation(fields: [machineId], references: [id], onDelete: Cascade)
  companyId        String

  type             String   // "scheduled_service", "repair", "part_change", "inspection"
  date             DateTime
  horometerReading Float?
  odometerReading  Float?
  description      String
  partsUsed        Json?    // [{ name: string, partNumber: string, brand: string, quantity: number, unitCost: number }]
  laborCost        Float?
  totalCost        Float?
  workshop         String?
  mechanic         String?
  documents        Json?    // array de URLs en Supabase Storage
  notes            String?

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model MaintenancePlan {
  id               String   @id @default(uuid())
  machineId        String   @unique
  machine          Machine  @relation(fields: [machineId], references: [id], onDelete: Cascade)
  companyId        String

  // Intervalos estándar del template
  intervals        Json     // [{ type: "oil_change", label: "Cambio de aceite", hours: 250, months: 6 }, ...]
  // Intervalos personalizados del usuario
  customIntervals  Json?    // misma estructura, agregados por el usuario

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model MaintenanceAlert {
  id               String   @id @default(uuid())
  machineId        String
  machine          Machine  @relation(fields: [machineId], references: [id], onDelete: Cascade)
  companyId        String

  type             String   // "hours_based", "time_based"
  maintenanceType  String   // "oil_change", "filters", "major_service", etc.
  label            String   // "Cambio de aceite", "Filtros", etc.
  message          String   // "Faltan ~50 hs para el próximo cambio de aceite"
  severity         String   @default("warning") // "warning" (próximo), "overdue" (vencido)
  dueDate          DateTime?
  dueHorometer     Float?
  status           String   @default("pending") // "pending", "acknowledged", "completed", "dismissed"

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

**Agregar relaciones al modelo `Machine` existente** (si no están):
```prisma
// Dentro de model Machine, agregar:
maintenanceRecords MaintenanceRecord[]
maintenancePlan    MaintenancePlan?
maintenanceAlerts  MaintenanceAlert[]
```

Ejecutar migración:
```bash
npx prisma migrate dev --name add-maintenance-models
npx prisma generate
```

### 2. Backend — Endpoints de mantenimiento

**MaintenanceRecord CRUD:**

- `POST /api/machines/:machineId/maintenance-records` → crear registro. Auth guard + validar máquina pertenece a `activeCompanyId`. Guardar `companyId` automáticamente. Si se suben documentos, manejar upload a Supabase Storage bajo `companies/{companyId}/mechanic/machines/{machineId}/maintenance/{recordId}/`. Después de crear: actualizar `currentHorometer` de la máquina si `horometerReading` es mayor al actual. Recalcular alertas.
- `GET /api/machines/:machineId/maintenance-records` → listado ordenado por fecha desc. Filtros: `?type=repair&from=2025-01-01&to=2025-12-31`.
- `GET /api/maintenance-records/:id` → registro individual.
- `PATCH /api/maintenance-records/:id` → actualizar. Validar pertenencia.
- `DELETE /api/maintenance-records/:id` → eliminar. Validar pertenencia.

**MaintenancePlan:**

- `POST /api/machines/:machineId/maintenance-plan` → crear plan. Solo uno por máquina (`@unique machineId`).
- `POST /api/machines/:machineId/maintenance-plan/from-template` → crear plan desde template de la máquina. Copiar `maintenanceIntervals` del `MachineTemplate` asociado al campo `intervals` del plan. Si no tiene template, retornar error indicando que debe crear plan manual.
- `GET /api/machines/:machineId/maintenance-plan` → obtener plan activo.
- `PATCH /api/machines/:machineId/maintenance-plan` → actualizar intervalos o agregar custom intervals.

**MaintenanceAlerts:**

- `GET /api/machines/:machineId/alerts` → alertas activas (pending) de la máquina, ordenadas por severity (overdue primero).
- `GET /api/mechanic/alerts` → todas las alertas activas de todas las máquinas de la empresa activa (para el dashboard futuro).
- `PATCH /api/maintenance-alerts/:id` → actualizar estado: "acknowledged" (el usuario la vio), "completed" (se realizó el mantenimiento), "dismissed" (la descarta).

### 3. Backend — Servicio de cálculo de alertas

**Crear `MaintenanceAlertService`:**

Este servicio calcula si hay alertas que generar o actualizar. Se ejecuta:
- Al crear/actualizar un `MaintenanceRecord` (recalcular alertas de esa máquina).
- Al consultar alertas de una máquina (cálculo on-demand).
- Opcionalmente: cron job diario para alertas basadas en tiempo.

**Lógica de cálculo:**

Para cada intervalo definido en el `MaintenancePlan` de la máquina:

1. **Por horas (hours_based):**
   - Buscar el último `MaintenanceRecord` que corresponda a ese tipo de mantenimiento.
   - Calcular: `horasDesdeUltimoService = machine.currentHorometer - ultimoRecord.horometerReading`.
   - Si `horasDesdeUltimoService >= intervalo * 0.9` → generar alerta `severity: "warning"`.
   - Si `horasDesdeUltimoService >= intervalo` → generar alerta `severity: "overdue"`.

2. **Por tiempo (time_based):**
   - Calcular: `mesesDesdeUltimoService = diferencia en meses entre hoy y ultimoRecord.date`.
   - Si `mesesDesdeUltimoService >= intervaloMeses * 0.9` → warning.
   - Si `mesesDesdeUltimoService >= intervaloMeses` → overdue.

3. **Sin registros previos:** Si no hay ningún `MaintenanceRecord` para ese tipo, usar la fecha de creación de la máquina como referencia, y el `currentHorometer` al momento del alta.

**No duplicar alertas:** Antes de crear una alerta, verificar que no exista una alerta pending del mismo `maintenanceType` para esa máquina. Si existe, actualizarla en lugar de crear otra.

### 4. Frontend — Tab de mantenimiento en ficha de máquina

**Activar el tab "Mantenimiento" en `MachineDetailScreen`** (reemplazar placeholder):

**Sección superior — Alertas activas:**
- Cards de alerta en la parte superior del tab.
- Warning (amarillo): "Próximo cambio de aceite en ~50 hs".
- Overdue (rojo): "Cambio de filtros vencido — 120 hs de atraso".
- Cada alerta con botones: "Registrar intervención" (abre formulario pre-llenado) | "Descartar".

**Sección principal — Timeline de intervenciones:**
- Listado cronológico (más reciente primero).
- Cada item muestra: fecha, tipo (con badge de color: service=azul, reparación=naranja, cambio pieza=verde, inspección=gris), descripción resumida, horómetro, costo total.
- Click en item → expande detalle inline o abre modal con: descripción completa, piezas usadas (tabla), taller/mecánico, documentos adjuntos (fotos, facturas con preview).
- Botón flotante o en header: "+ Registrar intervención".

**Sección lateral o inferior — Plan de mantenimiento:**
- Si la máquina tiene plan: mostrar tabla de intervalos con columnas: Tipo | Cada X horas | Cada X meses | Último realizado | Próximo estimado.
- Si no tiene plan y tiene template: botón "Aplicar plan de fábrica" → crea plan desde template.
- Si no tiene plan ni template: botón "Crear plan personalizado" → formulario para definir intervalos.
- Botón "Editar plan" → modal para modificar intervalos o agregar custom.

### 5. Frontend — Formulario de nueva intervención

**Crear `MaintenanceRecordForm.jsx`** (modal o pantalla):

- **Tipo de intervención:** Select con opciones: Service programado, Reparación, Cambio de pieza, Inspección.
- **Fecha:** Date picker.
- **Horómetro / Odómetro:** Input numérico. Si la máquina tiene `currentHorometer`, mostrar como referencia: "Horómetro actual: 2,450 hs".
- **Descripción:** Textarea.
- **Piezas utilizadas:** Sub-formulario dinámico:
  - Botón "+ Agregar pieza".
  - Por cada pieza: Nombre (texto), Nro. de pieza (texto), Marca (texto), Cantidad (número), Costo unitario (número).
  - Costo total de piezas se calcula automáticamente.
  - Botón de eliminar por pieza.
- **Costo de mano de obra:** Input numérico.
- **Costo total:** Calculado automáticamente (piezas + mano de obra) o editable manualmente.
- **Taller / Mecánico:** Input texto.
- **Documentos:** Upload de fotos/facturas (mismo patrón de upload que las fotos de la máquina).
- **Notas:** Textarea opcional.
- **Botón "Guardar"** → `POST /api/machines/:machineId/maintenance-records`.

**Si se abre desde una alerta:** Pre-llenar el tipo de intervención que corresponde a la alerta.

---

## SECCIONES NO TOCAR

- Módulo de logística completo.
- Selector de módulo (Oleada 1).
- Wizard de alta y listado de máquinas (Oleada 2) — solo se activa el tab de mantenimiento en la ficha.
- Agente WhatsApp.
- Configuración de auth, Supabase, Railway, Vercel.

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

1. ✅ Registrar intervención con piezas y documentos adjuntos → se guarda correctamente y aparece en timeline.
2. ✅ Costo total se calcula automáticamente al agregar piezas + mano de obra.
3. ✅ Upload de documentos (fotos, facturas) funciona en Supabase Storage.
4. ✅ Crear plan de mantenimiento desde template → intervalos se cargan correctamente.
5. ✅ Crear plan personalizado (sin template) → intervalos custom funcionan.
6. ✅ Alertas se generan: warning al 90% del intervalo, overdue al 100%.
7. ✅ Registrar intervención → alerta correspondiente se marca como completed automáticamente (o se recalcula).
8. ✅ Descartar alerta → status cambia a "dismissed".
9. ✅ Abrir formulario desde alerta → tipo pre-llenado.
10. ✅ Horómetro de la máquina se actualiza al registrar intervención con horómetro mayor.
11. ✅ Filtrado por empresa activa funciona correctamente en todos los endpoints.

**Commit:** `feat: maintenance module with records, plans, and alerts`
