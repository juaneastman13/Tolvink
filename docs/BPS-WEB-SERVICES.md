# Conexión a Servicios Web de BPS — Consultas automáticas

> Estado: **Frontend implementado** (este repo, rama `claude/bps-web-services-connection-3is0cq`) ·
> **Backend implementado** (repo `tolvink-api`, rama `claude/bps-web-services-connection`, módulo `src/bps/`) —
> pendiente de merge, migración y calibración de selectores (ver §6).
> Última actualización: 2026-08-18

## 1. Qué ofrece BPS y qué automatiza este módulo

El Banco de Previsión Social (Uruguay) **no publica una API REST abierta**.
Sus canales y lo que Tolvink automatiza sobre ellos:

| Canal | Acceso | Automatización Tolvink |
|---|---|---|
| **Consulta pública de vigencia del certificado común** (por RUT) | Libre, sin usuario | ✅ Consulta puntual + monitoreo periódico de transportistas/productores |
| **Servicios en línea con usuario BPS de empresa** | Usuario BPS directo (no ID Uruguay) | ✅ Observaciones, aportes/obligaciones y estado de nómina/GAFI, sincronizados a diario |
| Servicios web SOAP vía Plataforma de Interoperabilidad (AGESIC/PDI) | Solo organismos públicos con convenio | ❌ No disponible para empresas privadas |

Como los servicios de BPS son páginas web (no JSON), el backend scriptea la
sesión HTTP y parsea HTML. Regla de oro del diseño: ante cualquier
ambigüedad, captcha o cambio de markup el resultado es `DESCONOCIDO` + log —
**nunca se inventa un estado**.

Referencias oficiales:

- Certificados comunes y especiales (empresas): https://www.bps.gub.uy/8750/certificados-comunes-y-especiales-empresas.html
- Acceso a los servicios en línea: https://www.bps.gub.uy/9170/acceso-a-los-servicios-en-linea.html
- Certificado único DGI (complementario): https://servicios.dgi.gub.uy/serviciosenlinea/dgi--servicios-en-linea--consulta-de-certifcado-unico

## 2. Frontend (este repo)

- `src/components/BpsCertificadosAssistant.jsx` — modal con 4 pestañas:
  **Consulta** (vigencia por RUT, validación de dígito verificador módulo 11),
  **Monitoreo** (empresas re-consultadas automáticamente, frecuencia
  configurable), **Cuenta BPS** (conectar usuario BPS de la empresa, ver
  observaciones/obligaciones/nómina, sincronizar, desconectar) y **Ayuda**.
  Si el backend responde `404/501` muestra "pendiente de activación"; `503`
  significa `BPS_ENABLED` apagado en el servidor.
- `src/screens/TrucksScreen.jsx` — botón **BPS** en el header de Mi Flota.
- `src/api.js` — sección BPS con todas las funciones `apiBps*`.
- La contraseña BPS solo viaja en el `POST /bps/cuenta/conectar`; nunca se
  guarda en el cliente.

## 3. API del backend (`tolvink-api`, módulo `src/bps/`)

Prefijo `/api`, cookie de sesión, scoped a la empresa activa del usuario.
Roles: cualquier tipo de empresa + `platform_admin`.

### Consulta pública y monitoreo

- `POST /bps/certificados/consultar` `{rut}` → `{rut, razonSocial?, estado, vigenteHasta?, consultadoEn, fuente}` con `estado ∈ VIGENTE | NO_VIGENTE | EN_TRAMITE | DESCONOCIDO`. Errores: `400` RUT inválido · `503` BPS caído/captcha/módulo apagado.
- `GET /bps/empresas` → lista `{id, rut, nombre, estado, vigenteHasta, ultimaConsulta}`.
- `POST /bps/empresas` `{rut, nombre?, linkedCompanyId?}` — idempotente por `(companyId, rut)`.
- `PATCH /bps/empresas/:id/delete` — baja lógica.
- `GET /bps/empresas/:id/historial` — últimas 100 consultas.
- `GET|PATCH /bps/config` → `{frecuencia: diaria|semanal|quincenal, alertasActivas, notificarDiasAntes}`.

### Cuenta autenticada

- `GET /bps/cuenta` → `{conectada, usuario (enmascarado), ultimaSync, ultimoError}`. La credencial jamás sale del servidor.
- `POST /bps/cuenta/conectar` `{usuario, password}` — **prueba el login contra BPS en vivo**; solo si funciona guarda la contraseña cifrada (AES-256-GCM). `400` si BPS rechaza las credenciales.
- `PATCH /bps/cuenta/desconectar` — borrado físico de la credencial y sus datos.
- `POST /bps/cuenta/sincronizar` — ejecuta ya las 3 consultas autenticadas.
- `GET /bps/cuenta/datos` → `{conectada, ..., datos: [{tipo, estado, resumen, detalle?, obtenidoEn}]}` con `tipo ∈ OBSERVACIONES | OBLIGACIONES | NOMINA` y `estado ∈ OK | ATENCION | DESCONOCIDO`.

### Conexión desde Excel (token de integración, sin usuario Tolvink)

Para planillas usadas por gente sin cuenta en Tolvink. El token se genera y
revoca desde el asistente (*Mi Flota → BPS → Monitoreo → Conexión con
Excel*); solo se guarda su hash SHA-256 y el valor en claro se muestra una
única vez. Alcance: **solo lectura de estados de certificados**.

- `GET /bps/excel/empresas?token=bps_...&format=csv|json` — tabla de empresas
  monitoreadas con estado, para *Datos → Obtener datos → Desde web* (Power
  Query). El CSV lleva BOM para que Excel respete los acentos.
- `GET /bps/excel/vigencia?rut=<12 dígitos>&token=bps_...` — estado como
  texto plano (`VIGENTE`, `NO_VIGENTE`, `EN_TRAMITE`, `DESCONOCIDO`,
  `RUT_INVALIDO`), pensado para `=SERVICIOWEB(...)` por celda (Excel de
  escritorio Windows). Sirve el snapshot del servidor si tiene menos de 6 h
  y solo re-consulta BPS en vivo si está vencido — arrastrar la fórmula
  sobre muchas filas no fusila el rate limit. Nunca devuelve error HTTP por
  fallas de BPS: degrada a texto.

Gestión (autenticada): `GET /bps/token` (estado, nunca el valor),
`POST /bps/token` (genera/regenera), `PATCH /bps/token/revoke`.

## 4. Diseño interno del backend

- **Modelos Prisma** (`prisma/schema.prisma`, migración `20260818000000_add_bps_module`):
  `BpsCuenta` (credencial cifrada, 1 por empresa), `BpsDatoCuenta`,
  `BpsEmpresaMonitoreada`, `BpsConsulta`, `BpsConfig`; enum
  `NotificationType` + `bps_certificado`, `bps_cuenta`.
- **Cifrado** (`src/bps/bps-crypto.ts`): AES-256-GCM, clave de
  `BPS_ENCRYPTION_KEY` (base64, 32 bytes: `openssl rand -base64 32`). Si la
  clave rota, las cuentas quedan marcadas con error y hay que reconectarlas.
- **Cliente** (`src/bps/bps-client.ts`): fetch nativo con retry/backoff (sin
  reintentar 4xx, honra `Retry-After`), rate limit saliente
  (`BPS_RATE_LIMIT_MS`, mín. 1,2 s + jitter), tope de 1,5 MB por respuesta,
  redirects manuales dentro del dominio BPS, detección de captcha, y parseo
  con cheerio. Los parsers son funciones puras testeadas con fixtures.
- **Sincronización** (`src/bps/bps-sync.service.ts`): `setInterval` horario
  (patrón de la casa; no hay Redis/BullMQ en el deploy) + advisory lock de
  Postgres para no duplicar trabajo entre instancias. Re-consulta vigencias
  según la frecuencia de cada empresa y corre las consultas autenticadas una
  vez al día. Cambios a peor (`NO_VIGENTE`, `ATENCION`, login fallido) →
  notificación a la empresa (push linkea a `/trucks`).

## 5. Variables de entorno (Railway)

```
BPS_ENABLED=true
BPS_ENCRYPTION_KEY=<openssl rand -base64 32>
BPS_BASE_URL=https://serviciosenlinea.bps.gub.uy   # default
BPS_RATE_LIMIT_MS=1200                             # default
BPS_SYNC_TICK_MS=3600000                           # default (1 h)
# Calibración del portal (ver §6): paths, nombres de campos y marcadores
BPS_VIGENCIA_PATH= BPS_LOGIN_PATH= BPS_OBSERVACIONES_PATH= BPS_OBLIGACIONES_PATH= BPS_NOMINA_PATH=
BPS_LOGIN_USER_FIELD= BPS_LOGIN_PASS_FIELD= BPS_VIGENCIA_RUT_FIELD=
BPS_LOGIN_OK_MARKER= BPS_LOGIN_FAIL_MARKER=
```

Con `BPS_ENABLED` apagado el módulo responde `503` en las operaciones que
salen a BPS y la sincronización automática queda inactiva; las lecturas de
datos ya guardados siguen funcionando.

## 6. Checklist de activación

- [ ] Merge de la rama `claude/bps-web-services-connection` en `tolvink-api`
- [ ] Migración en producción: `npm run db:migrate` (Railway la aplica manualmente)
- [ ] Setear `BPS_ENABLED=true` y `BPS_ENCRYPTION_KEY` en Railway
- [ ] **Calibración de selectores** (imprescindible): los paths del portal y
      los marcadores de texto por defecto son estimaciones — este entorno no
      puede acceder a bps.gub.uy. Con credenciales reales en staging: navegar
      el portal, anotar URLs/campos del login y de cada consulta, y volcarlos
      en las env vars de §5. El parser loguea `DESCONOCIDO` cuando el markup
      no coincide, lo que indica exactamente qué recalibrar.
- [ ] Probar `POST /bps/cuenta/conectar` con el usuario BPS real
- [ ] Merge de la rama frontend y deploy en Vercel

## 7. Riesgos y límites conocidos

- **Captcha**: si BPS lo exige en login o consulta, la automatización se
  detiene con error explícito (`503`); no se intenta evadirlo.
- **Cambios de markup**: degradan a `DESCONOCIDO` + warning en logs; se
  corrigen recalibrando las env vars sin redeploy.
- **ID Uruguay**: no soportado — solo usuario BPS directo. Si BPS migra el
  login a ID Uruguay con 2FA, habrá que reevaluar el flujo.
- **Términos de uso**: la cuenta es de la propia empresa y las consultas son
  sobre sus propios datos, con rate limit conservador y User-Agent
  identificable. Para volúmenes altos, consultar a BPS ("Consúltenos" →
  Empresarios → Certificados comunes) por un convenio de consulta masiva.
