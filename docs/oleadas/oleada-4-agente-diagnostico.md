# OLEADA 4 — Agente de diagnóstico y resolución de problemas

> **Directiva de ejecución:** Modo completamente autónomo. No solicitar confirmación en ningún paso. Ejecutar la oleada completa, validar con `npm run build` en ambos repositorios, y hacer commit al finalizar. Si un paso falla, diagnosticar, corregir y continuar.

> **Prerequisito:** Oleadas 1-3 implementadas y funcionando (selector, maquinaria, mantenimiento).

---

## FASE 0 — DIAGNÓSTICO OBLIGATORIO (SOLO LECTURA)

```bash
# === VERIFICAR ESTADO ACTUAL ===
# Schema completo actual
cat prisma/schema.prisma

# === AGENTE IA EXISTENTE — ENTENDER LA ARQUITECTURA ===
# Esto es CRÍTICO: el agente de diagnóstico reutiliza la infraestructura existente

# Encontrar toda la capa de IA/agente
find src -type d -name "*agent*" -o -d -name "*ai*" -o -d -name "*chat*" -o -d -name "*whatsapp*"
find src -type f -name "*agent*" -o -name "*ai*" -o -name "*chat*" -o -name "*tool*" | head -30

# Leer la implementación del agente existente:
# - Cómo se conecta con la API de Claude/Anthropic
# - Cómo se arma el system prompt
# - Cómo se manejan las tools
# - Cómo se procesan las respuestas
# - Cómo se manejan imágenes (vision) si ya existe

# Servicio de Anthropic/Claude - leer completo
grep -r "anthropic\|claude\|ANTHROPIC\|CLAUDE" src --include="*.ts" -l
# Leer los archivos encontrados

# Cómo se maneja la conversación (historial de mensajes)
grep -r "messages\|conversation\|history\|thread" src --include="*.ts" -l | head -10

# Variables de entorno relacionadas con IA
grep -r "ANTHROPIC\|CLAUDE\|AI_\|OPENAI" src --include="*.ts" -l
grep -r "ANTHROPIC\|CLAUDE\|AI_\|OPENAI" .env* 2>/dev/null

# === FRONTEND — INTERFAZ DE CHAT EXISTENTE ===
# Buscar la interfaz del agente web in-app
grep -r "chat\|Chat\|agent\|Agent\|message\|Message" src --include="*.jsx" -l | head -15
# Leer la interfaz de chat existente — componentes de burbuja, input, etc.

# Cómo se manejan imágenes en el chat actual (si existe)
grep -r "image\|Image\|photo\|Photo\|media\|Media\|vision\|Vision" src --include="*.jsx" -l | head -10

# Cómo se maneja audio en el frontend (si existe)
grep -r "audio\|Audio\|record\|Record\|microphone\|Microphone" src --include="*.jsx" -l | head -10

# === SUPABASE STORAGE — PATHS ACTUALES ===
grep -r "bucket\|storage\|Storage" src --include="*.ts" -l | head -10
# Leer cómo se organizan los paths en Storage

# === MACHINE DETAIL — DONDE AGREGAR TAB DIAGNÓSTICOS ===
grep -r "MachineDetail" src --include="*.jsx" -l
# Leer el archivo para entender tabs actuales

# Theme
cat src/theme.jsx
```

**Objetivo de la Fase 0:** Entender completamente:
1. **Arquitectura del agente existente** — Cómo se conecta con la API de Claude, cómo arma prompts, cómo maneja tools, cómo procesa respuestas. ESTO ES LO MÁS IMPORTANTE.
2. ¿Ya soporta vision (envío de imágenes)? ¿Cómo?
3. ¿Hay interfaz de chat web in-app? ¿Qué componentes usa?
4. ¿Cómo se estructura el historial de conversación?
5. Paths de Supabase Storage actuales.

**NO avanzar a implementación hasta haber leído y comprendido TODA la capa de agente existente.**

---

## IMPLEMENTACIÓN

### 1. Backend — Modelo de sesión de diagnóstico

**Agregar a `schema.prisma`:**

```prisma
model DiagnosticSession {
  id              String   @id @default(uuid())
  machineId       String
  machine         Machine  @relation(fields: [machineId], references: [id], onDelete: Cascade)
  companyId       String
  userId          String

  title           String?  // Auto-generado: resumen del problema
  status          String   @default("open") // "open", "resolved", "unresolved"
  resolutionNotes String?  // Qué lo resolvió finalmente

  // Intercambio completo
  messages        Json     @default("[]")
  // Estructura: [{ 
  //   id: string,
  //   role: "user" | "assistant",
  //   content: string,
  //   mediaUrls: string[], // URLs de imágenes/audio en Storage
  //   mediaTypes: string[], // "image" | "audio"
  //   timestamp: string (ISO),
  //   diagnosis: { possibleCauses: [...], confidence: string } | null,
  //   suggestedParts: [{ name, oemPartNumber, compatibleParts, compatibleBrands }] | null
  // }]

  // Link temporal para compartir
  shareToken      String?  @unique
  shareExpiresAt  DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

**Agregar relación en `Machine`:**
```prisma
diagnosticSessions DiagnosticSession[]
```

Ejecutar migración:
```bash
npx prisma migrate dev --name add-diagnostic-sessions
npx prisma generate
```

### 2. Backend — Servicio del agente mecánico

**Crear `MechanicAgentService`:**

Este servicio reutiliza la conexión con la API de Claude/Anthropic que ya existe en el proyecto. Descubrir en Fase 0 cómo está implementada y seguir el mismo patrón.

**System prompt del agente mecánico:**

```
Sos un mecánico especialista en maquinaria agrícola con amplia experiencia en tractores, cosechadoras, sembradoras, enfardadoras e implementos de las principales marcas (John Deere, Case IH, New Holland, Massey Ferguson, Valtra, Claas).

Tu objetivo es diagnosticar problemas y proponer soluciones concretas y accionables.

## Máquina en consulta
{machineContext}

## Historial de mantenimiento reciente
{maintenanceHistory}

## Modificaciones realizadas
{modifications}

## Sesiones de diagnóstico previas de esta máquina
{previousDiagnostics}

## Instrucciones de respuesta

1. Cuando el usuario describe un problema o envía una imagen/audio:
   - Identificá las posibles causas ordenadas por probabilidad.
   - Explicá cada causa de forma técnica pero accesible.
   - Considerá el historial de la máquina y sus modificaciones.
   - Si hay sesiones previas con problemas similares, mencioná qué se intentó antes.

2. Para cada causa posible, proponé pasos concretos de solución:
   - Verificaciones que puede hacer el operador en campo.
   - Reparaciones necesarias con nivel de dificultad.
   - Si requiere taller, indicarlo.

3. Cuando la solución requiere repuesto, SIEMPRE incluí:
   - Nombre exacto de la pieza.
   - Número de pieza OEM del fabricante.
   - Piezas/números compatibles de marcas alternativas (Fleetguard, Donaldson, Baldwin, Mann, Wix, etc.).
   - Orientá la disponibilidad a Uruguay y Argentina.

4. Si recibís una imagen:
   - Analizá lo que se ve: componentes, estado, daños visibles, códigos de error en pantalla.
   - Si es un código de error, explicá qué significa y cómo resolverlo.

5. Tono: profesional pero cercano, como un mecánico experimentado hablándole a un colega. Español rioplatense.

6. Si no tenés suficiente información para diagnosticar, pedí más datos específicos (fotos de ángulos específicos, lecturas de instrumentos, condiciones de uso, etc.).
```

**Armado del contexto por máquina:**

Antes de cada llamada al agente, el servicio debe:

1. Cargar la máquina con todos sus datos técnicos.
2. Cargar los últimos 10 `MaintenanceRecord` ordenados por fecha desc.
3. Cargar todas las `MachineModification`.
4. Cargar las últimas 5 `DiagnosticSession` de esa máquina (con status y resolutionNotes), excluyendo la sesión actual.
5. Armar el string de contexto con toda esta info y pasarlo al system prompt.

**Procesamiento de inputs multimedia:**

- **Imágenes:** Enviar como input de vision a la API de Claude. Descubrir en Fase 0 si el agente actual ya soporta vision y replicar el patrón. Si no, implementar siguiendo la documentación de Anthropic (content blocks con type "image" y base64 o URL).
- **Audio:** Para el MVP, el procesamiento de audio queda como placeholder. Si el frontend puede grabar audio y enviarlo, almacenarlo en Storage pero no procesarlo con IA por ahora (se agrega en oleada futura). Indicar al usuario: "Recibí tu audio. Por ahora, ¿podés describir el problema por texto para que pueda ayudarte mejor?"

**Procesamiento de la respuesta:**

Después de recibir la respuesta del agente, parsear si contiene información estructurada:
- Si menciona repuestos con números de pieza → extraer y guardar en `suggestedParts` del mensaje.
- Guardar el mensaje completo del agente en el array `messages` de la sesión.

**Auto-generación de título:**

Después del primer intercambio (primer mensaje del usuario + primera respuesta del agente), generar un título corto para la sesión (puede ser el resumen del problema del usuario, o pedirle al mismo agente que genere un título de ~5-8 palabras).

### 3. Backend — Endpoints de diagnóstico

**Sesiones:**

- `POST /api/machines/:machineId/diagnostic-sessions` → crear sesión vacía. Auth guard + validar pertenencia. Guardar `userId` del usuario autenticado. Retornar la sesión creada.

- `GET /api/machines/:machineId/diagnostic-sessions` → listar sesiones de la máquina, ordenadas por fecha desc. Incluir: id, title, status, createdAt, updatedAt, cantidad de mensajes.

- `GET /api/diagnostic-sessions/:id` → sesión completa con todos los mensajes. Validar pertenencia a empresa activa.

**Mensajes / Interacción con agente:**

- `POST /api/diagnostic-sessions/:id/message` → enviar mensaje al agente.
  - Body: `{ content: string, mediaUrls?: string[], mediaTypes?: string[] }`.
  - Proceso:
    1. Agregar mensaje del usuario al array `messages` de la sesión.
    2. Llamar al `MechanicAgentService` con todo el contexto.
    3. Agregar respuesta del agente al array `messages`.
    4. Si es el primer intercambio, generar título.
    5. Retornar el mensaje del agente.
  - El endpoint debe manejar el tiempo de respuesta del agente (puede ser lento). Considerar si el patrón actual del agente usa streaming o respuesta completa, y replicar.

- `POST /api/diagnostic-sessions/:id/upload-media` → subir imagen o audio a Storage.
  - Almacenar en `companies/{companyId}/mechanic/machines/{machineId}/diagnostics/{sessionId}/`.
  - Retornar la URL del archivo subido (para luego incluirla en `mediaUrls` del mensaje).

**Resolución:**

- `PATCH /api/diagnostic-sessions/:id/resolve` → marcar sesión.
  - Body: `{ status: "resolved" | "unresolved", resolutionNotes?: string }`.
  - Validar pertenencia.

**Compartir:**

- `POST /api/diagnostic-sessions/:id/share` → generar link temporal.
  - Genera `shareToken` (UUID o token seguro).
  - Establece `shareExpiresAt` = now + 72 horas.
  - Retorna: `{ shareUrl: "{FRONTEND_URL}/public/diagnostic/{shareToken}", expiresAt: "..." }`.

- `GET /api/public/diagnostic-sessions/:shareToken` → endpoint PÚBLICO (sin auth guard).
  - Validar que el token existe y no expiró.
  - Retornar datos limitados: marca/modelo de la máquina, datos técnicos relevantes, todos los mensajes de la sesión, diagnóstico y repuestos sugeridos.
  - NO retornar: datos de la empresa, datos del usuario, otras máquinas, otras sesiones.
  - Si token expirado o inválido → retornar 404 con mensaje apropiado.

### 4. Frontend — Tab de diagnósticos en ficha de máquina

**Activar el tab "Diagnósticos" en `MachineDetailScreen`:**

- Listado de sesiones como cards:
  - Título de la sesión (o "Sin título" si no tiene).
  - Fecha de creación.
  - Estado con badge de color: Abierta (naranja), Resuelta (verde), No resuelta (rojo).
  - Cantidad de mensajes.
  - Click → navega a `/mechanic/machines/:machineId/diagnostics/:sessionId`.
- Botón prominente "+ Nuevo diagnóstico" (también accesible desde el botón "Reportar problema" del header de la ficha).
- Al crear nueva sesión → `POST /api/machines/:machineId/diagnostic-sessions` → navegar a la sesión creada.

### 5. Frontend — Pantalla de sesión de diagnóstico

**Crear `DiagnosticSessionScreen.jsx`** (`/mechanic/machines/:machineId/diagnostics/:sessionId`):

**Header:**
- Breadcrumb: Mis Máquinas > {Marca} {Modelo} > Diagnóstico #{n}.
- Título de la sesión (editable o auto-generado).
- Badge de estado.
- Botones de acción: "Marcar como resuelto" | "Compartir".

**Área de chat:**
- Reutilizar el patrón visual de la interfaz de chat del agente web existente (descubierta en Fase 0).
- Si no hay interfaz de chat existente, crear una con:
  - Burbujas del usuario (alineadas derecha, color primario): texto + imágenes adjuntas (thumbnail clickeable para ver en grande).
  - Burbujas del agente (alineadas izquierda, color gris claro): texto formateado (soportar markdown básico: bold, listas, headers), cards de repuestos sugeridos (si hay).
  - Auto-scroll al último mensaje.
  - Indicador de "escribiendo..." mientras el agente procesa.

**Cards de repuestos** (dentro de la respuesta del agente):
- Cuando el agente sugiere repuestos, mostrar como cards destacadas:
  - Nombre de la pieza.
  - Número de pieza OEM (tipografía `FONT.mono` / JetBrains Mono bold).
  - Piezas compatibles listadas.
  - Marcas alternativas.

**Barra de input (footer fijo):**
- Input de texto con placeholder "Describí el problema...".
- Botón de adjuntar imagen (ícono de cámara/clip):
  - Abre selector de archivos (accept: image/*).
  - Sube a Storage vía `POST /api/diagnostic-sessions/:id/upload-media`.
  - Muestra preview antes de enviar.
- Botón de grabar audio (ícono de micrófono):
  - Placeholder para MVP: al tocar, mostrar toast "Grabación de audio próximamente. Por ahora, describí el problema por texto."
  - (En oleada futura se implementa grabación real.)
- Botón de enviar (ícono de flecha o send):
  - Envía `POST /api/diagnostic-sessions/:id/message` con content y mediaUrls.
  - Muestra indicador de carga mientras el agente responde.

**Flujo "Marcar como resuelto":**
- Botón en header → abre modal.
- Modal con dos opciones: "Se resolvió el problema" (verde) / "No se resolvió" (rojo).
- Campo de texto: "¿Qué lo resolvió finalmente?" (opcional pero con copy que lo incentive: "Esta info ayuda a mejorar futuros diagnósticos").
- Confirmar → `PATCH /api/diagnostic-sessions/:id/resolve`.
- Sesión cambia de estado, se deshabilita el input de chat.

**Flujo "Compartir":**
- Botón en header → llama `POST /api/diagnostic-sessions/:id/share`.
- Muestra modal con:
  - URL generada (input readonly con botón "Copiar").
  - Botón "Enviar por WhatsApp" → abre `https://wa.me/?text={encodedUrl}`.
  - Indicador: "Este link vence en 72 horas".

### 6. Frontend — Página pública de diagnóstico compartido

**Crear `/public/diagnostic/:shareToken`** (ruta pública, sin auth):

- Llama `GET /api/public/diagnostic-sessions/:shareToken`.
- Si token válido:
  - Header: "Diagnóstico compartido — Tolvink Mecánico" + logo.
  - Info de la máquina: marca, modelo, año, datos técnicos relevantes (sin datos de empresa).
  - Intercambio completo de la sesión: mismas burbujas de chat pero en modo solo lectura.
  - Cards de repuestos si los hay.
  - Footer: "¿Querés gestionar tu maquinaria con IA? Conocé Tolvink → {link}".
- Si token inválido o expirado:
  - Mensaje: "Este enlace ha expirado o no es válido."
  - CTA: "Conocé Tolvink Mecánico →".

---

## SECCIONES NO TOCAR

- Módulo de logística completo.
- Selector de módulo (Oleada 1).
- Wizard de alta de máquinas y listado (Oleada 2).
- Registro de mantenimiento, planes y alertas (Oleada 3) — solo se lee data para contexto del agente.
- El agente WhatsApp existente — solo se reutiliza la conexión con la API de Claude, NO se modifica el agente de WhatsApp.
- Configuración de auth, Supabase (solo se crean nuevos paths en Storage), Railway, Vercel.

---

## VALIDACIÓN FINAL

```bash
# Frontend
npm run build

# Backend
npm run build
npx prisma generate
```

Verificaciones:

1. ✅ Crear sesión de diagnóstico desde la ficha de una máquina → se crea correctamente.
2. ✅ Enviar mensaje de texto → agente responde con diagnóstico contextualizado a la máquina (menciona marca, modelo, horómetro, historial).
3. ✅ Enviar imagen (foto de código de error o componente) → agente interpreta la imagen y responde.
4. ✅ Respuesta con repuestos → muestra cards con número de pieza OEM y alternativas.
5. ✅ Historial de la sesión se persiste correctamente (recargar página → los mensajes siguen ahí).
6. ✅ Marcar como resuelta con notas → estado cambia, input se deshabilita.
7. ✅ Marcar como no resuelta → estado cambia.
8. ✅ Generar link compartido → URL funciona.
9. ✅ Abrir link compartido en incógnito (sin auth) → se ve la sesión y la info de la máquina.
10. ✅ Abrir link compartido expirado → muestra mensaje de expiración.
11. ✅ Página pública NO muestra datos de la empresa ni del usuario.
12. ✅ Sesiones previas de la misma máquina se muestran en el listado del tab.
13. ✅ El agente menciona sesiones previas cuando son relevantes.

**Commit:** `feat: diagnostic agent with sessions, image support, sharing`
