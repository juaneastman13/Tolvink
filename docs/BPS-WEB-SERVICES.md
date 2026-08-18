# Conexión a Servicios Web de BPS — Consultas automáticas de certificados

> Estado: **Frontend implementado** (este repo) · **Backend pendiente** (repo `tolvink-api`)
> Última actualización: 2026-08-18

## 1. Qué ofrece BPS y qué es posible automatizar

El Banco de Previsión Social (Uruguay) **no publica una API REST abierta** para
terceros. Sus canales son:

| Canal | Acceso | Automatizable |
|---|---|---|
| **Consulta pública de vigencia del certificado común** (por RUT) | Libre, sin usuario | ✅ Sí — es la base de este módulo |
| Consulta de autenticidad de certificados emitidos | Libre, sin usuario | ✅ Sí (por número de certificado) |
| Servicios en línea de empresas (solicitar/descargar certificado propio, nóminas, aportes, GAFI) | Usuario BPS personal o de empresa (contrato de adhesión) | ⚠️ Parcial — sesión autenticada, sin API formal |
| Servicios web SOAP vía Plataforma de Interoperabilidad (AGESIC/PDI) | Solo organismos públicos con convenio | ❌ No para empresas privadas |

Referencias oficiales:

- Certificados comunes y especiales (empresas): https://www.bps.gub.uy/8750/certificados-comunes-y-especiales-empresas.html
- Solicitar certificados de empresas: https://www.bps.gub.uy/857/solicitar-certificados-de-empresas.html
- Acceso a los servicios en línea: https://www.bps.gub.uy/9170/acceso-a-los-servicios-en-linea.html
- Certificado único DGI (complementario): https://servicios.dgi.gub.uy/serviciosenlinea/dgi--servicios-en-linea--consulta-de-certifcado-unico

**Estrategia del módulo:** el backend de Tolvink consulta la verificación
pública de vigencia por RUT (no requiere credenciales), guarda el resultado y
lo re-consulta periódicamente (cron). El frontend ya está listo y degrada con
un aviso si el backend aún no expone los endpoints.

### Caso de uso en Tolvink

Las plantas y productores necesitan verificar que sus **transportistas** estén
al día con BPS (certificado común vigente) antes de asignarles fletes. Hoy eso
se hace a mano. Con este módulo:

1. Consulta puntual por RUT desde la pantalla **Mi Flota → botón BPS**.
2. Monitoreo automático: lista de empresas cuyo estado se re-consulta con la
   frecuencia configurada (diaria/semanal/quincenal).
3. Alertas cuando un certificado pasa a **no vigente** o está por vencer.

## 2. Qué hay implementado en este repo (frontend)

- `src/components/BpsCertificadosAssistant.jsx` — modal con 3 pestañas
  (Consultar RUT / Monitoreo / Ayuda). Valida el dígito verificador del RUT
  (módulo 11). Si el backend responde `404/501`, muestra "pendiente de
  activación" y ofrece los enlaces de consulta manual.
- `src/screens/TrucksScreen.jsx` — botón **BPS** en el header de Mi Flota.
- `src/api.js` — cliente de los endpoints (sección BPS).

## 3. Contrato de API que debe implementar `tolvink-api`

Todos los endpoints bajo el prefijo existente `/api`, autenticados con la
cookie de sesión, scoped a la empresa activa del usuario (`activeCompanyId`).

### 3.1 `POST /bps/certificados/consultar`

Consulta en vivo la vigencia del certificado común para un RUT.

```jsonc
// Request
{ "rut": "211234567890" }

// Response 200
{
  "rut": "211234567890",
  "razonSocial": "TRANSPORTES DEL ESTE S.A.",   // si BPS la devuelve; opcional
  "estado": "VIGENTE",                          // VIGENTE | NO_VIGENTE | EN_TRAMITE | DESCONOCIDO
  "vigenteHasta": "2026-11-30",                 // opcional (ISO date)
  "consultadoEn": "2026-08-18T14:30:00Z",
  "fuente": "BPS consulta pública"
}
```

Errores: `400` RUT inválido · `502` BPS no disponible (`{ message }`) ·
`429` si se excede el rate-limit interno hacia BPS.

### 3.2 `GET /bps/empresas`

Empresas monitoreadas por la empresa activa, con su último estado.

```jsonc
[
  {
    "id": "cku…",
    "rut": "211234567890",
    "nombre": "TRANSPORTES DEL ESTE S.A.",
    "estado": "VIGENTE",
    "vigenteHasta": "2026-11-30",
    "ultimaConsulta": "2026-08-18T06:00:00Z",
    "proximaConsulta": "2026-08-19T06:00:00Z"
  }
]
```

### 3.3 `POST /bps/empresas`

Alta en el monitoreo: `{ "rut": "…", "nombre": "…", "companyId": "…" }`
(`nombre` y `companyId` opcionales; `companyId` permite vincular a una empresa
ya cargada en Tolvink). Responde el registro creado (mismo shape que 3.2).
Idempotente por `(ownerCompanyId, rut)`.

### 3.4 `PATCH /bps/empresas/:id/delete`

Baja lógica del monitoreo (patrón soft-delete usado en el resto de la API).

### 3.5 `GET /bps/empresas/:id/historial`

Historial de consultas: `[{ "estado", "vigenteHasta", "consultadoEn" }]`
ordenado descendente, máx. 100.

### 3.6 `GET /bps/config` · `PATCH /bps/config`

```jsonc
{ "frecuencia": "diaria", "alertasActivas": true, "notificarDiasAntes": 7 }
```

`frecuencia`: `diaria | semanal | quincenal`.

## 4. Diseño de referencia para el backend

### 4.1 Modelo de datos (Prisma)

```prisma
model BpsEmpresaMonitoreada {
  id             String    @id @default(cuid())
  ownerCompanyId String    // empresa Tolvink que monitorea
  companyId      String?   // empresa Tolvink vinculada (opcional)
  rut            String
  nombre         String?
  estado         String    @default("DESCONOCIDO")
  vigenteHasta   DateTime?
  ultimaConsulta DateTime?
  active         Boolean   @default(true)
  createdAt      DateTime  @default(now())
  consultas      BpsConsulta[]

  @@unique([ownerCompanyId, rut])
}

model BpsConsulta {
  id           String   @id @default(cuid())
  empresaId    String
  empresa      BpsEmpresaMonitoreada @relation(fields: [empresaId], references: [id])
  estado       String
  vigenteHasta DateTime?
  raw          Json?     // respuesta cruda para debugging
  consultadoEn DateTime  @default(now())
}

model BpsConfig {
  ownerCompanyId     String  @id
  frecuencia         String  @default("diaria")
  alertasActivas     Boolean @default(true)
  notificarDiasAntes Int     @default(7)
}
```

### 4.2 Cliente BPS (servicio)

La consulta pública de vigencia es una página web (JSF), no un JSON API, por
lo que el cliente debe:

1. `GET` a la página de consulta para obtener cookies de sesión y el
   `ViewState`.
2. `POST` del formulario con el RUT.
3. Parsear el HTML de respuesta ("posee certificado común vigente" /
   "no posee…"). Mantener los selectores/regex en configuración para poder
   ajustarlos sin redeploy si BPS cambia el markup.

Recomendaciones obligatorias:

- **Rate limit** propio: máx. 1 request/segundo hacia BPS, con jitter.
- **Backoff** exponencial ante 5xx/timeouts; marcar `DESCONOCIDO` tras 3
  fallos, nunca `NO_VIGENTE` por error técnico.
- **Cache**: no repetir la misma consulta de RUT dentro de 6 h (salvo
  consulta manual explícita).
- **User-Agent** identificable (`Tolvink/4.x (+https://tolvink.com)`).
- Registrar `raw` truncado (≤ 8 KB) para diagnóstico.

Variables de entorno sugeridas (Railway):

```
BPS_CONSULTA_ENABLED=true
BPS_CONSULTA_URL=<URL de la consulta pública de vigencia>
BPS_CRON="0 6 * * *"          # corrida diaria 06:00 UY
BPS_RATE_LIMIT_MS=1200
```

### 4.3 Job de consultas automáticas

Cron (node-cron o el scheduler de Railway) que:

1. Selecciona empresas `active` cuya `ultimaConsulta` sea más vieja que la
   `frecuencia` configurada por su `ownerCompanyId`.
2. Consulta BPS respetando el rate-limit.
3. Guarda `BpsConsulta` y actualiza el snapshot en `BpsEmpresaMonitoreada`.
4. Si el estado cambió a `NO_VIGENTE`, o `vigenteHasta` está a menos de
   `notificarDiasAntes` días: crea una notificación (sistema de
   `/notifications` existente) y opcionalmente push.

### 4.4 Si BPS cambia la página o bloquea la consulta

- El parser debe fallar a `DESCONOCIDO` + alerta interna (Sentry), nunca
  inventar estado.
- Alternativa de mediano plazo: gestionar usuario de empresa en servicios en
  línea BPS y automatizar la descarga del certificado propio; requiere
  credenciales del cliente y debe evaluarse legalmente (términos de uso BPS).
- Para volúmenes altos conviene consultar a BPS (vía "Consúltenos", tema
  Empresarios → Certificados comunes) si ofrecen un convenio de consulta
  masiva.

## 5. Checklist de activación

- [ ] Backend: modelos Prisma + migración
- [ ] Backend: cliente BPS + endpoints 3.1–3.6
- [ ] Backend: cron de consultas automáticas + notificaciones
- [ ] Backend: variables de entorno en Railway
- [ ] Probar con RUTs reales de transportistas conocidos
- [ ] (Opcional) Mostrar el estado BPS en la ficha de empresa vinculada

El frontend no requiere cambios adicionales: detecta automáticamente cuando
los endpoints están disponibles.
