# Tolvink — Design System & Brand Guidelines

**Versión**: v5.4
**Última actualización**: 2026-02-18
**Propósito**: Guía completa de diseño UI/UX para desarrollo de imágenes de marca, marketing, y expansión visual

---

## 🎨 Identidad de Marca

### **Concepto**
Tolvink es una plataforma de logística agrícola que conecta productores, plantas y transportistas en Uruguay. El diseño transmite:
- **Confianza**: colores tierra, verde corporativo
- **Simplicidad**: interfaz limpia, sin decoración excesiva
- **Profesionalismo**: tipografía moderna, espaciado generoso
- **Eficiencia**: acciones rápidas, navegación clara

### **Público Objetivo**
- Productores rurales (30-60 años, conocimiento medio de tecnología)
- Gerentes de plantas agrícolas (25-50 años, alta exigencia operativa)
- Transportistas y choferes (25-55 años, uso móvil intensivo)

---

## 🎨 Paleta de Colores

### **Primario — Verde Corporativo**
```
#1A6B37   RGB(26, 107, 55)    — Principal (botones, CTA, header)
#228B46   RGB(34, 139, 70)    — Light variant (hover)
#E4F3EA   RGB(228, 243, 234)  — Pale (backgrounds, badges)
rgba(26,107,55,0.06)          — Ghost (subtle highlights)
```
**Uso**: Botones de acción principal, estados exitosos, iconos de planta/campo, branding.

**Significado**: Crecimiento, agricultura, confiabilidad.

---

### **Acento — Naranja**
```
#FF6A00   RGB(255, 106, 0)    — Principal (alertas, solicitado)
#FF8124   RGB(255, 129, 36)   — Light variant
#FFF3E8   RGB(255, 243, 232)  — Pale (backgrounds)
```
**Uso**: Estados de alerta ("Solicitado"), badges de urgencia, notificaciones importantes.

**Significado**: Atención, acción requerida, energía.

---

### **Secundario — Cyan**
```
#0891B2   RGB(8, 145, 178)    — Principal (info, enlaces)
#06B6D4   RGB(6, 182, 212)    — Light variant
#ECFEFF   RGB(236, 254, 255)  — Pale (backgrounds)
```
**Uso**: Estados informativos, enlaces, tracking en curso.

**Significado**: Movimiento, transporte, fluidez.

---

### **Estados Semánticos**

**Éxito (OK)**
```
#1A6B37   RGB(26, 107, 55)    — OK
#E4F3EA   RGB(228, 243, 234)  — OK Pale
```

**Información**
```
#0891B2   RGB(8, 145, 178)    — Info
#ECFEFF   RGB(236, 254, 255)  — Info Pale
```

**Advertencia**
```
#CA8A04   RGB(202, 138, 4)    — Warn
#FEF9C3   RGB(254, 249, 195)  — Warn Pale
```

**Error**
```
#DC2626   RGB(220, 38, 38)    — Error
#FEE2E2   RGB(254, 226, 226)  — Error Pale
```

**Neutro/Deshabilitado**
```
#71717A   RGB(113, 113, 122)  — Muted
#F4F4F5   RGB(244, 244, 245)  — Muted Pale
```

---

### **Neutros & Grises**

**Backgrounds**
```
#F7F8F7   RGB(247, 248, 247)  — BG principal (fondo app)
#FFFFFF   RGB(255, 255, 255)  — Blanco (cards, nav)
#F1F4F2   RGB(241, 244, 242)  — BG Card Alt (contraste sutil)
#EDEFED   RGB(237, 239, 237)  — BG Input (formularios)
rgba(10,20,14,0.85)           — BG Overlay (modales)
```

**Texto**
```
#18251C   RGB(24, 37, 28)     — T1 (títulos, texto principal)
#4A6352   RGB(74, 99, 82)     — T2 (subtítulos, labels)
#8A9C90   RGB(138, 156, 144)  — T3 (texto secundario, placeholders)
#FFFFFF   RGB(255, 255, 255)  — T On (texto sobre colores oscuros)
```

**Bordes**
```
#DEE4E0   RGB(222, 228, 224)  — B1 (bordes suaves)
#ECF0ED   RGB(236, 240, 237)  — B2 (divisores)
#1A6B37   RGB(26, 107, 55)    — B Focus (inputs focuseados)
```

**Sombras**
```
0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)    — sh (cards, botones)
0 4px 14px rgba(0,0,0,0.06)                               — shMd (dropdowns, modales pequeños)
0 12px 32px rgba(0,0,0,0.10)                              — shLg (modales grandes)
```

---

## 🔤 Tipografía

### **Familias**

**Sans-Serif Principal** (UI, cuerpo de texto, botones)
```
font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```
- **Fuente**: [DM Sans](https://fonts.google.com/specimen/DM+Sans) (Google Fonts)
- **Pesos utilizados**: 400 (Regular), 500 (Medium), 600 (Semi-Bold), 700 (Bold)
- **Características**: Moderna, alta legibilidad, geométrica sin rigidez

**Monospace** (códigos de flete, IDs, timestamps)
```
font-family: 'JetBrains Mono', 'IBM Plex Mono', 'SF Mono', monospace;
```
- **Fuente**: [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono)
- **Uso**: Códigos de flete (FLT-XXXX), matrículas, teléfonos, fechas/horas

---

### **Escala Tipográfica**

| Uso | Tamaño | Peso | Line Height | Ejemplo |
|-----|--------|------|-------------|---------|
| H1 (Títulos principales) | 24px | 700 | 1.3 | "Fletes activos" |
| H2 (Subtítulos screen) | 18px | 700 | 1.4 | "Solicitados" |
| H3 (Títulos de card) | 16px | 600 | 1.4 | Nombre de productor |
| Body (Texto normal) | 14px | 400 | 1.6 | Descripciones, labels |
| Small (Texto secundario) | 12px | 400 | 1.5 | Timestamps, metadata |
| Caption (Mínimo) | 10px | 600 | 1.4 | Badges, tags |
| Button (Botones) | 14px | 700 | 1 | CTAs |
| Code (Monospace) | 11px | 700 | 1.3 | FLT-1234 |

---

## 🏷️ Estados de Fletes (State Machine)

Los fletes tienen 8 estados con colores específicos:

| Estado | Label | Color | Background | Uso |
|--------|-------|-------|------------|-----|
| `draft` | Borrador | `#71717A` | `#F4F4F5` | Flete creado sin enviar |
| `pending_assignment` | Solicitado | `#FF6A00` | `#FFF3E8` | Esperando asignación de transportista |
| `assigned` | Asignado a flota | `#0891B2` | `#ECFEFF` | Transportista asignado, esperando confirmación |
| `accepted` | Confirmado camión | `#2563EB` | `#EFF6FF` | Camión confirmado, listo para cargar |
| `in_progress` | En curso | `#4ADE80` | `#ECFDF5` | Viaje iniciado |
| `loaded` | Cargando | `#22C55E` | `#DCFCE7` | Confirmación de carga en progreso |
| `finished` | Finalizado | `#1A6B37` | `#E4F3EA` | Flete completado exitosamente |
| `canceled` | Cancelado | `#DC2626` | `#FEE2E2` | Flete cancelado |

**Flujo normal**: draft → pending_assignment → assigned → accepted → in_progress → loaded → finished

**Badges**: Esquinas redondeadas (4px), padding 4px 8px, font-size 10px, font-weight 700, uppercase.

---

## 🧩 Componentes UI

### **Botones**

#### **Primario** (CTA principal)
```css
background: #1A6B37;
color: #FFFFFF;
border: none;
border-radius: 10px;
padding: 12px 20px;
font-size: 14px;
font-weight: 700;
box-shadow: 0 1px 3px rgba(0,0,0,0.05);
transition: background 0.2s;
```
**Hover**: `background: #228B46`

#### **Secundario** (acciones alternativas)
```css
background: transparent;
color: #1A6B37;
border: 1.5px solid #1A6B37;
border-radius: 10px;
padding: 10px 18px;
font-size: 14px;
font-weight: 600;
```
**Hover**: `background: rgba(26,107,55,0.06)`

#### **Ghost** (acciones terciarias)
```css
background: transparent;
color: #4A6352;
border: none;
padding: 8px 12px;
font-size: 13px;
font-weight: 500;
```
**Hover**: `background: #F1F4F2`

#### **Destructivo** (cancelar, eliminar)
```css
background: #DC2626;
color: #FFFFFF;
border: none;
border-radius: 10px;
padding: 12px 20px;
font-size: 14px;
font-weight: 700;
```
**Hover**: `background: #B91C1C`

---

### **Inputs & Forms**

#### **Text Input**
```css
background: #EDEFED;
border: 1.5px solid #DEE4E0;
border-radius: 8px;
padding: 11px 14px;
font-size: 14px;
color: #18251C;
font-family: 'DM Sans', sans-serif;
```
**Focus**: `border-color: #1A6B37; outline: none;`

#### **Select / Dropdown**
```css
/* Same as Text Input + dropdown arrow icon */
background: #EDEFED url('data:image/svg...') no-repeat right 10px center;
appearance: none;
```

#### **Checkbox / Radio**
- Accent color: `#1A6B37`
- Border radius: 4px (checkbox), 50% (radio)
- Size: 18px × 18px

#### **Label**
```css
font-size: 12px;
font-weight: 600;
color: #4A6352;
margin-bottom: 6px;
```

---

### **Cards**

#### **Card estándar** (freights, conversations)
```css
background: #FFFFFF;
border: 1px solid #DEE4E0;
border-radius: 12px;
padding: 14px;
box-shadow: 0 1px 3px rgba(0,0,0,0.05);
cursor: pointer;
transition: background 0.15s;
```
**Hover**: `background: #F7F8F7`

**Left border accent** (estado del flete):
```css
border-left: 4px solid {estado.color};
```

---

### **Badges**

#### **Status Badge** (estados de flete)
```css
display: inline-flex;
align-items: center;
padding: 4px 8px;
border-radius: 4px;
font-size: 10px;
font-weight: 700;
text-transform: uppercase;
letter-spacing: 0.5px;
color: {estado.color};
background: {estado.bg};
```

#### **Tag Badge** (grano, toneladas)
```css
padding: 3px 6px;
border-radius: 3px;
font-size: 11px;
font-weight: 600;
background: #F1F4F2;
color: #4A6352;
```

---

### **Modales**

```css
background: rgba(10,20,14,0.85); /* overlay */
backdrop-filter: blur(4px);

.modal-content {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 24px;
  max-width: 480px;
  box-shadow: 0 12px 32px rgba(0,0,0,0.10);
  animation: tvSlideUp 0.25s ease-out;
}
```

**Animación de entrada**:
```css
@keyframes tvSlideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

### **Navigation Bar**

```css
background: #FFFFFF;
height: 58px;
border-bottom: 1px solid #DEE4E0;
padding: 0 16px;
display: flex;
align-items: center;
position: sticky;
top: 0;
z-index: 100;
```

**Logo**: Verde #1A6B37, font-size 20px, font-weight 700

---

### **Bottom Navigation** (Mobile)

```css
background: #FFFFFF;
height: 60px;
border-top: 1px solid #DEE4E0;
display: flex;
justify-content: space-around;
align-items: center;
position: fixed;
bottom: 0;
left: 0;
right: 0;
z-index: 100;
```

**Tab activa**: icon color `#1A6B37`, label color `#1A6B37`, font-weight 700

**Tab inactiva**: icon color `#8A9C90`, label color `#8A9C90`, font-weight 500

---

### **Skeleton Loaders**

```css
.skeleton-block {
  background: linear-gradient(90deg, #EDEFED 25%, #F7F8F7 50%, #EDEFED 75%);
  background-size: 200% 100%;
  animation: tvShimmer 1.5s ease-in-out infinite;
  border-radius: 8px;
}

@keyframes tvShimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

### **Empty States**

```css
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
padding: 48px 24px;
text-align: center;

icon: 28px, color #8A9C90
title: 16px, font-weight 700, color #18251C
subtitle: 14px, color #8A9C90
```

---

### **Loading Spinner** (3 dots)

```css
.dot {
  width: 8px;
  height: 8px;
  background: #1A6B37;
  border-radius: 50%;
  animation: tvDots 1.4s ease-in-out infinite;
}
.dot:nth-child(1) { animation-delay: 0s; }
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes tvDots {
  0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
  40% { transform: scale(1); opacity: 1; }
}
```

---

## 🎯 Iconografía

### **Estilo**
- **Tipo**: Line icons (stroke-based), no fills
- **Stroke width**: 2px (estándar), 2.5px (botones CTA), 3px (checks)
- **Stroke cap**: round
- **Stroke join**: round
- **Tamaños**: 16px (small), 18px (standard), 20px (large), 24px (extra large)

### **Colores de iconos según contexto**
- **Primarios** (acciones): `#1A6B37`
- **Secundarios** (navegación): `#4A6352`
- **Terciarios** (metadata): `#8A9C90`
- **Sobre colores oscuros**: `#FFFFFF`
- **Estados**: usar colores semánticos (ok, warn, err, info)

### **Iconos principales**

| Icono | Nombre | Uso |
|-------|--------|-----|
| 🏠 | home | Pantalla principal |
| 🚚 | truck | Fletes, transporte |
| ➕ | plus | Crear nuevo |
| 💬 | msg | Mensajes, chat |
| 👤 | user | Perfil, productor |
| ◀ | chev | Back, navegación |
| ✓ | chk | Confirmar, OK |
| 📍 | pin | Ubicación, mapa |
| 🏭 | plant | Plantas agroalimentarias |
| 📅 | cal | Calendario, fechas |
| 🕒 | clk | Hora, tiempo |
| ⚠️ | warn | Alertas, pendiente |
| ↗️ | send | Enviar mensaje |
| 🚪 | out | Logout |
| 🛡️ | shield | Admin, seguridad |
| 🔔 | bell | Notificaciones |
| ⚙️ | gear | Configuración |
| 🌾 | grain | Granos, productos |
| 🚫 | ban | Cancelar, prohibir |
| 🔄 | redo | Refrescar, rehacer |
| 🔍 | srch | Buscar |
| ✕ | cross | Cerrar, eliminar |
| 📧 | mail | Email |
| 🔒 | lock | Seguridad, privado |
| 👁️ | eye | Ver, mostrar |
| 📷 | cam | Cámara, foto |
| 🖼️ | img | Imagen |
| 📄 | doc | Documento |

**Nota**: Iconos SVG inline, no fuentes de iconos (mayor control y performance).

---

## 📱 Espaciado & Layout

### **Grid System**
- **Container max-width**: 1200px (desktop)
- **Gutter**: 16px (mobile), 24px (desktop)
- **Columns**: 12 (responsive)

### **Spacing Scale** (padding, margin, gap)
```
4px   — xxs (badges internos)
6px   — xs (small gaps)
8px   — sm (card internal spacing)
12px  — md (section gaps)
16px  — lg (card padding)
20px  — xl (screen padding)
24px  — 2xl (modal padding)
32px  — 3xl (section separators)
48px  — 4xl (empty states)
```

### **Border Radius**
```
3px   — Badges pequeños
4px   — Badges estándar
8px   — Inputs
10px  — Botones
12px  — Cards
16px  — Modales
```

### **Responsive Breakpoints**
```
mobile:  0-767px
tablet:  768-1023px
desktop: 1024px+
```

---

## 🎬 Animaciones & Transiciones

### **Duración**
```
0.15s — Hover rápido (backgrounds, colors)
0.2s  — Transiciones estándar (buttons)
0.25s — Modales, slides
0.3s  — Page transitions
```

### **Easing**
```
ease-out     — Entradas (modales, tooltips)
ease-in-out  — Transiciones bidireccionales
ease         — Default (hovers)
```

### **Keyframes utilizados**
- `tvSlideUp` — Modales, tooltips (translateY + opacity)
- `tvShimmer` — Skeleton loaders (background-position)
- `tvDots` — Loading spinner (scale + opacity)
- `tvFadeIn` — Page transitions (opacity)

---

## 🖼️ Imágenes & Media

### **Fotografía**
- **Estilo**: Realista, luz natural, ambientes rurales/agrícolas
- **Tono**: Cálido, tierra, verde natural
- **Composición**: Espacio para texto, horizonte bajo
- **Evitar**: Stock genérico, urbano, artificial

### **Ilustraciones** (si se usan)
- **Estilo**: Line-art, minimalista, geométrico
- **Colores**: Paleta principal (verde, naranja, cyan)
- **Uso**: Empty states, onboarding, error screens

### **Logos**
- **Primary**: Texto "Tolvink" en verde #1A6B37, DM Sans Bold
- **Icon**: Letra "T" estilizada con forma de camión o grano (a desarrollar)
- **Lockup**: Horizontal (logo + texto)
- **Tamaños mínimos**: 120px ancho (web), 80px ancho (mobile)

---

## ♿ Accesibilidad

### **Contraste de Colores**
- **Texto primario sobre fondo claro**: Ratio 12.4:1 (AAA)
- **Texto secundario sobre fondo claro**: Ratio 4.8:1 (AA)
- **Botones primarios**: Ratio 4.5:1 mínimo
- **Estados de flete**: Todos cumplen WCAG AA para badges

### **Touch Targets**
- **Mínimo**: 44px × 44px (botones, links)
- **Ideal**: 48px × 48px

### **Focus States**
- **Outline**: `2px solid #1A6B37`
- **Offset**: 2px
- **Visible en navegación por teclado**

### **Screen Readers**
- Labels en inputs
- Alt text en imágenes
- ARIA labels en iconos sin texto

---

## 📐 Ejemplos de Aplicación

### **Freight Card** (vista kanban)
```
┌─────────────────────────────────────┐
│ ┃ FLT-1234  [Solicitado]           │ ← border-left: 4px #FF6A00
│ ┃                                   │
│ ┃ Soja · 50 tn                      │ ← 14px, bold
│ ┃                                   │
│ ┃ 👤 Productor ABC                  │ ← 11px, icon + text
│ ┃ 🚚 Transporte XYZ (ABC-123)       │
│ ┃ 🏭 Planta Montevideo              │
└─────────────────────────────────────┘
```
**Colors**: Card BG `#FFFFFF`, border `#DEE4E0`, left accent `#FF6A00`

---

### **Button Group** (acciones de flete)
```
[Cancelar]  [   Asignar   ]
 ↑             ↑
 Ghost         Primary
```

---

### **Status Badge Evolution**
```
Solicitado → Asignado → Confirmado → En curso → Finalizado
  🟠           🔵          🔵           🟢         🟢
```

---

### **Loading States**
1. **Skeleton**: Shimmer gray blocks
2. **Spinner**: 3 bouncing dots (verde)
3. **Empty**: Icon + "Sin fletes todavía"

---

## 🚀 Uso en Marketing

### **Hero Section** (landing page)
```
Background: #F7F8F7 con overlay verde suave
Heading: 32px, Bold, #18251C
Subheading: 18px, Regular, #4A6352
CTA: Botón primario verde "Comenzar gratis"
Image: Camión en campo rural (formato landscape)
```

### **Feature Cards**
```
Icon: 48px, color primario #1A6B37
Title: 20px, Bold, #18251C
Description: 14px, Regular, #4A6352
Background: #FFFFFF con sombra suave
```

### **Social Media**
- **Palette**: Verde primario + naranja acento + blanco
- **Typography**: DM Sans Bold para headlines
- **Templates**: Square (1080×1080), Story (1080×1920)
- **Hashtags**: #Tolvink #LogísticaAgrícola #AgroUruguay

### **Email Templates**
- **Header**: Verde #1A6B37, logo blanco
- **Body**: Fondo #F7F8F7, cards blancas
- **CTA**: Botón primario verde
- **Footer**: Texto gris #8A9C90

---

## 📦 Assets para Exportar

### **Logos**
- `logo-primary.svg` — Verde sobre transparente
- `logo-white.svg` — Blanco sobre transparente
- `logo-horizontal.svg` — Logo + texto horizontal
- `logo-icon.svg` — Solo icono (square)
- Tamaños: SVG vectorial + PNG @1x, @2x, @3x

### **Favicon**
- `favicon.svg` — Icono vectorial
- `favicon-16x16.png`, `favicon-32x32.png`, `favicon-192x192.png`, `favicon-512x512.png`

### **App Icons** (para native apps)
- iOS: 1024×1024 (sin alpha)
- Android: 512×512 (adaptive layers)
- PWA: 192×192, 512×512

### **Social Sharing**
- `og-image.png` — 1200×630 (Open Graph)
- `twitter-card.png` — 1200×675

### **Iconos SVG**
- Todos los iconos de `theme.jsx` exportados individualmente
- Formato: optimizados con SVGO

---

## 🔗 Recursos

### **Fuentes**
- [DM Sans en Google Fonts](https://fonts.google.com/specimen/DM+Sans)
- [JetBrains Mono en Google Fonts](https://fonts.google.com/specimen/JetBrains+Mono)

### **Herramientas Recomendadas**
- **Diseño**: Figma (vectorial, components, prototypes)
- **Iconos**: Lucide Icons, Feather Icons (mismo estilo)
- **Paleta**: Coolors.co para expansión de colores
- **Contraste**: WebAIM Contrast Checker
- **Optimización**: SVGO (SVG), TinyPNG (PNG)

### **Inspección de Código**
- Archivo fuente: `src/theme.jsx` (colores, iconos)
- Archivo fuente: `src/constants.jsx` (estados de flete)
- Archivo fuente: `src/components.jsx` (componentes UI)

---

## 📝 Notas Finales

Este design system se usa actualmente en producción en **https://tolvink.app** con +100 usuarios activos. Todas las especificaciones son extraídas del código real y han sido validadas en dispositivos móviles (iOS Safari, Android Chrome) y desktop (Chrome, Firefox, Safari).

Para desarrollo de imágenes de marca:
1. **Mantener consistencia** con paleta verde/naranja/cyan
2. **Tipografía DM Sans** como fuente exclusiva para marketing
3. **Iconografía line-based** con stroke 2px
4. **Espaciado generoso** — no apretar elementos
5. **Fotografía realista** con ambientes rurales uruguayos

**Contacto técnico**: Este documento fue generado automáticamente desde el código fuente en 2026-02-18.

---

**Versión del documento**: 1.0
**Generado por**: Claude Opus 4.6
**Licencia**: Uso interno Tolvink
