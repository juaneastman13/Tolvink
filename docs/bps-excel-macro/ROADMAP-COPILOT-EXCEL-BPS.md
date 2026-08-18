# Roadmap — Generar el Excel-macro de consultas BPS con Copilot desktop

> Objetivo: construir un archivo Excel (`.xlsm`) que consulte BPS **directamente
> desde Excel, con usuario BPS, sin ningún servidor de Tolvink en el medio**.
> Como este trabajo necesita Windows + Excel + acceso real a bps.gub.uy, se
> hace en **Copilot desktop** sobre tu máquina, siguiendo este documento.
> Público: vos + Copilot (le pegás el "Prompt maestro" del punto 6).

---

## 1. Objetivo y por qué migrar a Copilot desktop

Las consultas BPS *con usuario* no son una URL simple: hay que iniciar sesión
(mandar usuario/clave, mantener cookies, navegar formularios con campos
ocultos) y parsear el HTML que devuelve el portal. La única forma de hacer eso
**sin intermediario** es una **macro VBA** dentro de un `.xlsm`.

Esto **no se puede construir ni probar** en el entorno donde se desarrolló
Tolvink (un sandbox Linux sin Excel y con bps.gub.uy bloqueado). En cambio, en
tu **máquina Windows con Excel y Copilot** sí se puede:

- generar el código VBA,
- importarlo y **ejecutarlo** en Excel real,
- **calibrar** los selectores contra el portal BPS verdadero (paso imprescindible),
- iterar hasta que funcione.

Por eso el entregable de acá es este roadmap + un "prompt maestro" que Copilot
usa para generarte el código y el libro.

---

## 2. Qué "Copilot" usar

| Herramienta | ¿Sirve? | Uso |
|---|---|---|
| **GitHub Copilot en VS Code** (Windows) | ✅ **Recomendado** | Genera el módulo `.bas` y el README; iterás el código con Copilot Chat. Después importás el `.bas` en Excel. |
| **Copilot Chat** (web/app) pegando VBA en el editor de Excel (`Alt+F11`) | ✅ Alternativa | Si no querés VS Code: le pedís el VBA a Copilot y lo pegás directo en un módulo del editor de VBA de Excel. |
| **Copilot en Excel** (Microsoft 365) | ⚠️ Limitado | Ayuda con fórmulas y con el armado de hojas, pero **no** escribe macros VBA con login/sesión. Útil solo para la parte de formato. |
| **Office Scripts** (Excel web, "Automatizar") | ❌ No | Es TypeScript y corre en la nube de Office; no puede mantener una sesión de login a BPS. Descartado. |

**Camino recomendado:** GitHub Copilot en VS Code para el código + Excel de
escritorio para importar, probar y calibrar.

---

## 3. Prerequisitos

- **Windows 10/11** con **Excel de escritorio** (2016 o posterior). *No funciona
  en Excel para Mac ni Excel web* — el objeto HTTP con cookies es Windows-only.
- **Macros habilitadas**: Archivo → Opciones → Centro de confianza → Configuración
  de macros → "Deshabilitar todas las macros con notificación" (y habilitar al abrir).
- **Usuario BPS directo** (no ID Uruguay) de tu empresa, con acceso a Servicios
  en Línea.
- **Acceso a internet a bps.gub.uy** desde la máquina.
- **VS Code** + extensión **GitHub Copilot** (si vas por el camino recomendado).
- Referencia técnica: el archivo `tolvink-api/src/bps/bps-client.ts` de este
  proyecto — tiene el flujo de login y los marcadores de texto ya pensados.
  Llevalo como insumo (punto 4).

---

## 4. Insumos / spec bundle (qué llevar a Copilot)

1. **Este roadmap** (sobre todo el Prompt maestro del punto 6).
2. **`bps-client.ts`** como *lógica de referencia* — Copilot lo traduce de
   TypeScript a VBA. De ahí salen:
   - El flujo: GET página → extraer campos ocultos (ViewState) → POST con
     credenciales → seguir redirects manteniendo cookies → parsear.
   - Los **marcadores de texto** de cada estado (ya redactados en español,
     normalizados sin tildes). Ej. vigencia:
     - `NO_VIGENTE`: contiene `no posee certificado` / `certificado ... no vigente` / `vencido`
     - `EN_TRAMITE`: `en tramite` / `solicitud en proceso`
     - `VIGENTE`: `posee certificado ... vigente` / `certificado comun vigente`
     - nada de lo anterior → `DESCONOCIDO`
3. **Tabla de configuración** (va en la hoja *Configuración* del libro, para
   recalibrar sin tocar el código):

   | Clave | Qué es | Valor inicial (calibrar) |
   |---|---|---|
   | `BASE_URL` | Dominio de Servicios en Línea | `https://serviciosenlinea.bps.gub.uy` |
   | `LOGIN_PATH` | Página de login | *(anotar del portal)* |
   | `LOGIN_USER_FIELD` | `name` del input de usuario | *(ver HTML)* |
   | `LOGIN_PASS_FIELD` | `name` del input de contraseña | *(ver HTML)* |
   | `LOGIN_OK_MARKER` | texto que aparece al loguear bien | `cerrar sesion` / `mis servicios` |
   | `LOGIN_FAIL_MARKER` | texto de credenciales inválidas | `usuario o contrasena` |
   | `VIGENCIA_PATH` / `RUT_FIELD` | consulta pública por RUT | *(anotar)* |
   | `OBSERVACIONES_PATH` | página de observaciones | *(anotar)* |
   | `OBLIGACIONES_PATH` | página de aportes/obligaciones | *(anotar)* |
   | `NOMINA_PATH` | página de estado de nómina | *(anotar)* |
   | `CERT_MEDICAS_PATH` | página de certificaciones médicas | *(anotar — ver nota abajo)* |

   > **Nota importante sobre certificaciones médicas:** no tengo confirmado qué
   > página del portal BPS para empresas expone las certificaciones médicas ni
   > qué devuelve. Es un **slot a calibrar**: navegás vos a esa consulta en el
   > portal, anotás su URL y los textos que muestra, y completás el path + los
   > marcadores. El mismo método sirve para cualquier consulta nueva.

4. **Layout de hojas** (punto 6 lo detalla): *Configuración*, *Consulta RUT*,
   *Datos de la empresa*, *Instrucciones*.
5. **Advertencias de seguridad** (punto 8) — que queden escritas en la hoja
   *Instrucciones* del libro.

### Cómo obtener los valores a calibrar
En Excel/Windows con el portal abierto en el navegador: entrá a cada página,
abrí las Herramientas de desarrollador del navegador (`F12`) → pestaña Network
→ hacé la acción (login, consulta) → mirá la URL del request, el método
(GET/POST) y, en el formulario, los `name` de los campos. Anotá también una
frase distintiva del resultado ("posee certificado vigente", etc.).

---

## 5. Pasos

1. **Carpeta de trabajo**: creá `C:\bps-excel\` y abrila en VS Code. Copiá ahí
   `bps-client.ts` (insumo de referencia) y este roadmap.
2. **Generá el código**: abrí Copilot Chat y pegá el **Prompt maestro** (punto 6).
   Copilot te crea `BpsConsultas.bas` y te describe las hojas del libro.
3. **Armá el libro**: en Excel, creá un libro nuevo con las 4 hojas (Copilot te
   da los encabezados y celdas). Guardalo **como `.xlsm`** (Libro de Excel
   habilitado para macros).
4. **Importá la macro**: en Excel, `Alt+F11` (editor VBA) → menú Archivo →
   Importar archivo → elegí `BpsConsultas.bas`.
5. **Cargá credenciales y config**: completá la hoja *Configuración* con tu
   usuario/clave BPS y los paths/markers que puedas (los que falten, en el
   siguiente paso).
6. **Calibrá contra el portal real**: corré primero la consulta pública por RUT
   (no necesita login). Si devuelve `DESCONOCIDO`, ajustá `VIGENCIA_PATH`/
   `RUT_FIELD`/marcadores mirando el Network del navegador. Repetí con el login
   y cada consulta autenticada.
7. **Iterá con Copilot**: cuando algo no parsee, pegale a Copilot el HTML que
   devolvió el portal y pedile que ajuste el parser o el marcador.
8. **Validá** con el checklist del punto 7. Recién ahí el archivo está listo.

---

## 6. Prompt maestro para Copilot (copiá y pegá tal cual)

```
Actuá como experto en VBA para Excel en Windows. Necesito un módulo VBA que
consulte el portal de BPS Uruguay (Servicios en Línea) directamente desde
Excel, con login de usuario, sin ningún servidor intermedio. Te adjunto como
referencia el archivo bps-client.ts (TypeScript): traducí su lógica de login y
sus marcadores de texto a VBA. Requisitos:

ARQUITECTURA
- HTTP con "MSXML2.ServerXMLHTTP.6.0". Manejá las cookies MANUALMENTE: leé el
  header "Set-Cookie" con GetAllResponseHeaders tras cada respuesta, acumulá un
  "cookie jar" (Nombre=Valor; ...) y reenvialo en el header "Cookie" del
  siguiente request. Seguí redirects (3xx) manualmente, solo dentro del dominio
  BASE_URL.
- Timeout por request y un rate limit: Application.Wait de ~1,2 segundos entre
  requests para no saturar BPS.
- Toda la configuración (BASE_URL, paths, nombres de campos de formulario y
  marcadores de texto) se lee de la hoja "Configuración" por nombre de celda,
  NO hardcodeada, para poder recalibrar sin tocar código.

FUNCIONES
- NormalizarTexto(html) As String: quita etiquetas HTML, pasa a minúsculas,
  saca tildes (á→a, etc.) y colapsa espacios. Todos los parsers comparan sobre
  texto normalizado.
- ExtraerOcultos(html) As String: arma el cuerpo application/x-www-form-
  urlencoded con todos los <input type="hidden"> (name=value) para reenviar el
  ViewState y demás en el POST de login.
- LoginBps(usuario, clave) As String: GET LOGIN_PATH → ExtraerOcultos → POST con
  usuario/clave (usando LOGIN_USER_FIELD/LOGIN_PASS_FIELD) + ocultos, siguiendo
  redirects. Devuelve el cookie jar si detecta LOGIN_OK_MARKER; devuelve "" si
  detecta LOGIN_FAIL_MARKER, un captcha (texto "captcha"/"recaptcha") o no
  aparece el marcador OK. Nunca reintenta un login fallido en loop.
- ConsultarPagina(cookies, path) As String: GET autenticado a path con el cookie
  jar; devuelve NormalizarTexto del body.
- Parsers, cada uno recibe el texto normalizado y devuelve un estado; ante
  cualquier ambigüedad devuelven "DESCONOCIDO" (nunca inventan):
  * EstadoVigencia -> "VIGENTE"|"NO_VIGENTE"|"EN_TRAMITE"|"DESCONOCIDO"
    (evaluar la negación primero: "no posee certificado" contiene "posee
    certificado"). Extraé fecha "vigente hasta dd/mm/aaaa" si está.
  * EstadoObservaciones -> "OK"|"ATENCION"|"DESCONOCIDO"
  * EstadoObligaciones  -> "OK"|"ATENCION"|"DESCONOCIDO"
  * EstadoNomina        -> "OK"|"ATENCION"|"DESCONOCIDO"
  * EstadoCertificacionesMedicas -> "OK"|"ATENCION"|"DESCONOCIDO"
    (los marcadores de texto de esta consulta los voy a calibrar yo: dejá los
    marcadores en constantes/celdas de config bien señaladas con un comentario
    "CALIBRAR").
- Manejo de errores: envolvé cada consulta en On Error para que un fallo escriba
  "DESCONOCIDO" o "SIN CONEXION" en la celda, sin cortar la macro ni mostrar un
  error críptico.

SUBS DE ENTRADA (asignables a botones de formulario)
- ActualizarConsultaRut: recorre la hoja "Consulta RUT", por cada RUT no vacío
  valida el dígito verificador (RUT uruguayo, 12 dígitos, módulo 11), llama a la
  consulta pública de vigencia y escribe el estado y la fecha en la fila.
- ActualizarDatosEmpresa: lee usuario/clave de "Configuración", hace LoginBps y,
  si funciona, corre las consultas de Certificaciones médicas, Observaciones,
  Obligaciones y Nómina, escribiendo estado + fecha/hora en la hoja "Datos de la
  empresa". Si el login falla, muestra un MsgBox claro y no sigue.

LIBRO (describime las celdas para armarlo)
- Hoja "Configuración": tabla clave/valor con BASE_URL, *_PATH, *_FIELD,
  *_MARKER, y celdas USUARIO_BPS / CLAVE_BPS. Marcá con color y una nota que las
  credenciales quedan guardadas en el archivo (riesgo).
- Hoja "Consulta RUT": columnas RUT | Estado | Vigente hasta | Notas, con una
  fila de ejemplo, y un botón "Actualizar" que llama a ActualizarConsultaRut.
- Hoja "Datos de la empresa": filas Certificaciones médicas / Observaciones /
  Obligaciones / Nómina con columnas Estado | Fecha, y un botón "Consultar" que
  llama a ActualizarDatosEmpresa.
- Hoja "Instrucciones": pasos de uso + advertencias de seguridad.

Entregame: (1) el módulo completo BpsConsultas.bas comentado en español, y (2)
las instrucciones para crear las hojas y asignar los botones. Priorizá
robustez y mensajes claros por sobre elegancia.
```

---

## 7. Checklist de aceptación / pruebas

Probá en este orden y no pases al siguiente hasta que el anterior funcione:

- [ ] **Consulta pública por RUT** devuelve `VIGENTE`/`NO_VIGENTE` correcto para
      un RUT que ya conocés (contrastá con la consulta manual en el portal).
- [ ] **Login** con tu usuario BPS devuelve cookies (no `""`); con una clave
      mal escrita a propósito devuelve `""` y el MsgBox de fallo.
- [ ] **Cada consulta autenticada** (Certificaciones médicas, Observaciones,
      Obligaciones, Nómina) devuelve un estado coherente con lo que ves en el
      portal a mano.
- [ ] **Markup inesperado** (por ej. si BPS está caído) escribe `DESCONOCIDO` o
      `SIN CONEXION`, nunca un estado inventado ni un error que corta la macro.
- [ ] **Dígito verificador**: un RUT inválido en la hoja da `RUT_INVALIDO` sin
      llamar a BPS.
- [ ] Reabrir el archivo, habilitar macros y correr de nuevo: sigue funcionando.

---

## 8. Riesgos y límites (leé esto antes de usarlo en serio)

- **Credenciales + datos de salud dentro de un archivo reenviable.** Elegiste
  guardar el usuario/clave de BPS en el `.xlsm`, y las certificaciones médicas
  son datos sensibles (ley 18.331). Cualquiera que reciba el archivo tiene tu
  acceso a BPS y esos datos. Mitigaciones mínimas: no lo compartas por mail,
  guardalo en una ubicación restringida, y considerá proteger/ocultar la hoja
  *Configuración* (sabiendo que **eso no es cifrado real**, solo disuade). Si
  varias personas necesitan esto, es mejor que cada una tenga su copia con sus
  propias credenciales, no una compartida.
- **Windows-only.** No corre en Mac ni Excel web.
- **Frágil ante cambios de BPS.** Si el portal cambia el HTML o un path, la
  macro deja de parsear y hay que recalibrar (por eso todo está en la hoja
  *Configuración*). Cada copia distribuida se recalibra por separado.
- **Captcha.** Si BPS pide un captcha, la macro se detiene: no se puede
  automatizar ese paso.
- **Sin límite de tasa central.** Si corrés muchas consultas seguidas o varias
  copias a la vez, BPS podría bloquear temporalmente el acceso. El
  `Application.Wait` ayuda pero no reemplaza el criterio.
- **Certificaciones médicas = slot a calibrar.** No está confirmada la página ni
  el formato exacto de esa consulta; se completa con tu usuario real siguiendo
  el método del punto 4.

---

## Apéndice — Alternativa más segura (por si la reconsiderás)

Si en algún momento la exposición de credenciales/datos médicos en el archivo te
preocupa, el mismo dato se puede ver dentro de Tolvink (detrás de login) y
descargarse como Excel desde ahí, sin llevar credenciales adentro del archivo.
Eso ya está diseñado en `docs/BPS-WEB-SERVICES.md`. Este roadmap cubre lo que
pediste: **directo desde Excel, sin Tolvink**.
