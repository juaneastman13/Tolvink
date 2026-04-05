# OLEADA 2 — Alta de maquinaria + Catálogo + QR

> **Directiva de ejecución:** Modo completamente autónomo. No solicitar confirmación en ningún paso. Ejecutar la oleada completa, validar con `npm run build` en ambos repositorios, y hacer commit al finalizar. Si un paso falla, diagnosticar, corregir y continuar.

> **Prerequisito:** La Oleada 1 debe estar implementada y funcionando (selector de módulo, rutas base de `/mechanic`, layout mecánico).

---

## FASE 0 — DIAGNÓSTICO OBLIGATORIO (SOLO LECTURA)

Antes de modificar cualquier archivo, ejecutar este diagnóstico para entender el estado actual post-Oleada 1:

```bash
# === VERIFICAR OLEADA 1 ===
# Schema actual - verificar que enabledModules existe
grep -A 5 "enabledModules" prisma/schema.prisma

# Rutas del módulo mecánico - verificar estructura
grep -r "mechanic\|MechanicLayout\|ModuleSelector" src --include="*.jsx" -l

# Layout mecánico actual
# Leer el archivo MechanicLayout.jsx o equivalente creado en Oleada 1

# Verificar que /mechanic/machines tiene placeholder
# Leer el archivo placeholder de machines

# === CONTEXTO NECESARIO PARA OLEADA 2 ===
# Cómo se manejan uploads a Supabase Storage actualmente
grep -r "supabase\|storage\|bucket\|upload\|Storage" src --include="*.jsx" -l
grep -r "supabase\|storage\|bucket\|upload\|Storage" src --include="*.ts" -l
# Leer los archivos relevantes de storage/upload

# Cómo se manejan formularios wizard/multi-step en el frontend actual
grep -r "wizard\|Wizard\|step\|Step\|stepper" src --include="*.jsx" -l
# Leer si hay algún componente de wizard reutilizable (ej: FreightWizard)

# Cómo se manejan los selects/dropdowns en el frontend
grep -r "Select\|select\|dropdown\|Dropdown\|Combobox" src --include="*.jsx" -l | head -10

# Componentes reutilizables disponibles
find src -type f -name "*.jsx" -path "*/components/*" | head -30
# Leer los componentes de UI reutilizables (botones, inputs, modals, cards)

# Theme - refrescar conocimiento de tokens
cat src/theme.jsx

# Backend - estructura de un módulo CRUD existente (para replicar patrón)
# Buscar un módulo bien estructurado (ej: freight, fleet, truck)
find src -type d -name "*freight*" -o -d -name "*fleet*" -o -d -name "*truck*" -o -d -name "*vehicle*"
# Leer module, controller, service y DTOs de ese módulo como referencia de patrón

# Backend - cómo se hace validación de DTOs
grep -r "class-validator\|IsString\|IsNotEmpty\|ValidationPipe" src --include="*.ts" -l | head -5

# Backend - middleware/guard de activeCompanyId
grep -r "activeCompanyId\|activeCompany\|getCompanyId" src --include="*.ts" -l | head -10
# Leer cómo se extrae el companyId del usuario autenticado
```

**Objetivo de la Fase 0:** Entender:
1. ¿Cómo funciona el upload a Supabase Storage? ¿Hay un servicio reutilizable?
2. ¿Hay un componente wizard/stepper existente que pueda reutilizar?
3. ¿Qué patrón de selects/dropdowns se usa? ¿Hay componente propio?
4. ¿Cuál es la estructura estándar de un módulo CRUD en el backend?
5. ¿Cómo se extrae `activeCompanyId` en los controllers?

**NO avanzar a implementación hasta haber leído y comprendido todos estos archivos.**

---

## IMPLEMENTACIÓN

### 1. Backend — Modelos de datos

**Agregar a `schema.prisma`:**

```prisma
model MachineTemplate {
  id                   String   @id @default(uuid())
  brand                String
  series               String?
  model                String
  machineType          String   // "tractor", "harvester", "seeder", "baler", "implement", "truck", "car", "motorcycle", "other"
  engineBrand          String?
  engineModel          String?
  enginePower          String?
  engineDisplacement   String?
  transmissionType     String?
  fuelType             String?
  hydraulicSystem      String?
  maintenanceIntervals Json?    // { "oilChange": 250, "filters": 500, "majorService": 1000 }
  specs                Json?
  machines             Machine[]
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@unique([brand, model, machineType])
}

model Machine {
  id                   String   @id @default(uuid())
  companyId            String
  company              Company  @relation(fields: [companyId], references: [id])
  templateId           String?
  template             MachineTemplate? @relation(fields: [templateId], references: [id])

  // Identificación
  machineType          String
  brand                String
  model                String
  year                 Int?
  serialNumber         String

  // Datos técnicos
  engineBrand          String?
  engineModel          String?
  enginePower          String?
  engineDisplacement   String?
  transmissionType     String?
  fuelType             String?
  hydraulicSystem      String?
  hydraulicCapacity    String?
  tireSize             String?
  tireBrand            String?
  currentHorometer     Float?
  currentOdometer      Float?

  // QR
  qrCode               String?  @unique

  // Fotos
  photos               Json?

  // Relaciones
  modifications        MachineModification[]
  repairHistory        MachineRepairHistory[]

  // Metadata
  status               String   @default("active") // "active", "inactive", "sold"
  notes                String?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@unique([companyId, serialNumber])
}

model MachineModification {
  id          String    @id @default(uuid())
  machineId   String
  machine     Machine   @relation(fields: [machineId], references: [id], onDelete: Cascade)
  description String
  date        DateTime?
  notes       String?
  createdAt   DateTime  @default(now())
}

model MachineRepairHistory {
  id          String    @id @default(uuid())
  machineId   String
  machine     Machine   @relation(fields: [machineId], references: [id], onDelete: Cascade)
  description String
  date        DateTime?
  workshop    String?
  cost        Float?
  notes       String?
  createdAt   DateTime  @default(now())
}
```

**Importante:** Agregar la relación `machines Machine[]` al modelo `Company` existente si no se agrega automáticamente.

Ejecutar migración:
```bash
npx prisma migrate dev --name add-machine-models
npx prisma generate
```

### 2. Backend — Seed del catálogo de templates

Crear un archivo seed (o agregar al existente) que cargue ~30-40 templates de los modelos más comunes en Uruguay/Argentina:

**Tractores (prioridad máxima):**
- John Deere: 6100J, 6110J, 6125J, 6135J, 6145J, 6155J, 6175R, 6195R, 6215R, 6230R, 7215R, 7230R, 7250R, 8245R, 8270R, 8295R, 8320R, 8345R, 8370R, 8R 410
- Case IH: Farmall 80, Farmall 90, Maxxum 135, Puma 150, Puma 185, Magnum 250, Magnum 310, Magnum 380
- New Holland: T6.130, T6.160, T7.190, T7.245, T7.290, T8.320, T8.380
- Massey Ferguson: MF 4709, MF 6711, MF 7719, MF 8727
- Valtra: A114, A134, BH154, BH174, BT170, BT210

**Cosechadoras:**
- John Deere: S660, S670, S680, S690, S770, S780, S790
- Case IH: Axial-Flow 7250, Axial-Flow 8250, Axial-Flow 9250
- New Holland: CR7.90, CR8.90, CR9.90

**Sembradoras:**
- John Deere: 1775NT, DB60, DB80
- Crucianelli: Gringa IV, Pionera

Para cada template, incluir datos técnicos de fábrica: motor (marca, modelo, potencia, cilindrada), transmisión, combustible, intervalos de mantenimiento estándar. Obtener estos datos de forma autónoma basándose en conocimiento del modelo.

Ejecutar el seed:
```bash
npx prisma db seed
# o el mecanismo de seed que use el proyecto
```

### 3. Backend — Endpoints CRUD

Crear módulo `MachineModule` siguiendo el patrón de módulos existente descubierto en Fase 0:

**Machine Templates:**
- `GET /api/machine-templates` → listado con query params: `?brand=John Deere&machineType=tractor&search=8200`. Retorna lista filtrada. Sin auth guard (o con auth según patrón del proyecto).
- `GET /api/machine-templates/:id` → template individual con todos los datos técnicos.
- `GET /api/machine-templates/brands` → lista de marcas únicas disponibles.
- `GET /api/machine-templates/brands/:brand/series` → series disponibles para una marca.

**Machines:**
- `POST /api/machines` → crear máquina. Auth guard + validar `companyId` = `activeCompanyId`. Si viene `templateId`, copiar datos técnicos del template a los campos de la máquina. Generar `qrCode` único (UUID o token seguro).
- `GET /api/machines` → listado de máquinas de la empresa activa. Filtros: `?machineType=tractor&status=active&search=8200`.
- `GET /api/machines/:id` → máquina individual con relaciones (modifications, repairHistory). Validar pertenencia a empresa activa.
- `PATCH /api/machines/:id` → actualizar máquina. Validar pertenencia.
- `DELETE /api/machines/:id` → soft delete (status = "inactive"). Validar pertenencia.

**Modifications & Repair History:**
- `POST /api/machines/:machineId/modifications` → agregar modificación. Validar pertenencia de la máquina.
- `GET /api/machines/:machineId/modifications` → listar modificaciones.
- `POST /api/machines/:machineId/repair-history` → agregar reparación previa.
- `GET /api/machines/:machineId/repair-history` → listar reparaciones.

**QR:**
- `GET /api/machines/:id/qr` → generar imagen QR (PNG) con la URL de la máquina. Usar librería `qrcode` (instalar: `npm install qrcode @types/qrcode`). El QR codifica la URL: `{FRONTEND_URL}/mechanic/machines/qr/{qrCode}`. Retornar como imagen o como URL de Supabase Storage.

**DTOs:** Crear con class-validator siguiendo el patrón del proyecto.

### 4. Frontend — Pantalla de listado de máquinas

**Reemplazar el placeholder de `/mechanic/machines` con `MachinesListScreen.jsx`:**

- Header: "Mis Máquinas" + botón "+ Agregar máquina" (alineado a la derecha o como FAB).
- Filtros: selector de tipo de máquina (todos, tractor, cosechadora, etc.) + campo de búsqueda.
- Listado en cards (grid en desktop, stack en mobile):
  - Cada card muestra: foto principal (o ícono placeholder según tipo), marca + modelo en bold, tipo de máquina, año, horómetro actual (si tiene), estado con indicador de color.
  - Click en card → navega a `/mechanic/machines/:id`.
- Estado vacío: si no hay máquinas, mostrar mensaje + CTA "Registrar tu primera máquina".

Estilos: tokens `C`, `FONT`, `Ic` de `theme.jsx`, inline, `borderRadius: 12px`.

### 5. Frontend — Wizard de alta de máquina

**Crear `MachineWizard.jsx`** (modal o pantalla completa según patrón del proyecto):

**Paso 1 — Identificación:**
- Select "Tipo de máquina": Tractor, Sembradora, Enfardadora, Cosechadora, Implemento, Camión, Auto, Moto, Otro.
- Select "Marca": alimentado desde `GET /api/machine-templates/brands` + opción "Otra marca" (texto libre).
- Select "Serie/Línea" (aparece dinámicamente si hay series para la marca seleccionada): alimentado desde `GET /api/machine-templates/brands/:brand/series`.
- Select "Modelo" (filtra dinámicamente): alimentado desde `GET /api/machine-templates?brand=X&machineType=Y`.
- Si el usuario selecciona un template → indicador visual "Datos técnicos pre-cargados ✓".
- Si elige "Otra marca" o un modelo no catalogado → continúa con campos manuales.
- Año de fabricación (input numérico).
- Número de serie (input texto, obligatorio).

**Paso 2 — Datos técnicos:**
- Si viene de template: campos pre-llenados pero editables.
- Si es manual: campos vacíos.
- Campos: Motor (marca, modelo, cilindrada, potencia), Transmisión (tipo), Combustible, Sistema hidráulico (tipo, capacidad), Neumáticos (medida, marca), Horómetro actual, Odómetro actual.
- Cada campo con label claro y placeholder descriptivo.

**Paso 3 — Fotografías:**
- Zona de upload drag-and-drop o botón de selección.
- Sugerencia: "Subí al menos una foto frontal y una lateral".
- Preview de las fotos seleccionadas con opción de eliminar.
- Upload a Supabase Storage bajo `companies/{companyId}/mechanic/machines/{machineId}/photos/`.
- Paso opcional — se puede saltear.

**Paso 4 — Historial previo (opcional):**
- Sección "Modificaciones realizadas":
  - Botón "+ Agregar modificación" → campos: descripción (textarea), fecha aproximada.
  - Lista de modificaciones agregadas con opción de eliminar.
- Sección "Reparaciones anteriores":
  - Botón "+ Agregar reparación" → campos: descripción (textarea), fecha, taller/mecánico, costo aproximado.
  - Lista de reparaciones agregadas.
- Sección "Último mantenimiento conocido":
  - Campos: tipo de servicio (select: cambio aceite, service general, etc.), fecha, horómetro al momento.
- Todo este paso es opcional — se puede saltear entero.

**Paso 5 — Confirmación:**
- Resumen visual de todo lo cargado, organizado en secciones.
- Foto principal (si se subió) + marca/modelo en destaque.
- Datos técnicos resumidos.
- Cantidad de modificaciones y reparaciones cargadas.
- Botón "Registrar máquina" → `POST /api/machines` + llamadas para modifications y repair-history.
- Al éxito → navegar a la ficha de la máquina creada.

**Navegación del wizard:**
- Indicador de pasos (1-5) en la parte superior.
- Botones "Anterior" / "Siguiente" en cada paso.
- Validación por paso antes de avanzar (Paso 1: tipo, marca, modelo, serial obligatorios).

### 6. Frontend — Ficha de máquina

**Crear `MachineDetailScreen.jsx`** (`/mechanic/machines/:id`):

- Header: marca + modelo en grande, badge de tipo de máquina, badge de estado.
- Galería de fotos (carousel simple o grid).
- Tabs (usar patrón de tabs del proyecto si existe):
  - **Datos técnicos:** Todos los campos técnicos en layout de ficha.
  - **Historial:** Timeline con modificaciones + reparaciones ordenadas cronológicamente. Botones para agregar nuevas.
  - **Mantenimiento:** Placeholder "Próximamente" (Oleada 3).
  - **Diagnósticos:** Placeholder "Próximamente" (Oleada 4).
- Botones de acción en header o footer:
  - "Editar" → abre edición inline o modal.
  - "Descargar QR" → descarga la imagen QR (`GET /api/machines/:id/qr`).
  - "Reportar problema" → placeholder (Oleada 4).

### 7. Frontend — Ruta de QR scan

**Crear ruta `/mechanic/machines/qr/:qrCode`:**
- Ruta protegida (requiere auth).
- Al cargar: buscar máquina por `qrCode` → redirigir a `/mechanic/machines/:id`.
- Si no se encuentra o no pertenece a la empresa del usuario → mostrar error.

---

## SECCIONES NO TOCAR

- Todo el módulo de logística (fletes, cola, flota, ubicaciones).
- El selector de módulo de Oleada 1 (ya funciona).
- El agente WhatsApp.
- La configuración de auth.
- Modelos de Prisma existentes pre-Oleada 1.

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

1. ✅ `GET /api/machine-templates` retorna templates del catálogo con filtros funcionando.
2. ✅ Wizard Paso 1: seleccionar marca → cargan series → seleccionar serie → cargan modelos → seleccionar modelo → datos técnicos se pre-cargan en Paso 2.
3. ✅ Wizard Paso 1: elegir "Otra marca" → campos manuales funcionan.
4. ✅ Crear máquina completa con fotos, modificaciones y reparaciones → se guarda todo correctamente.
5. ✅ Listado muestra las máquinas de la empresa activa (no muestra máquinas de otras empresas).
6. ✅ Ficha de máquina muestra todos los datos y tabs.
7. ✅ QR se genera y al escanearlo redirige a la ficha correcta.
8. ✅ Upload de fotos funciona con Supabase Storage.
9. ✅ Número de serie único por empresa (no se puede duplicar).

**Commit:** `feat: machine registration with catalog, wizard, QR generation`
