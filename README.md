# Tolvink v4.1 — Deploy a Vercel

## Requisitos previos

- Cuenta en [Vercel](https://vercel.com) (gratis con GitHub)
- [Node.js](https://nodejs.org) v18+ instalado
- [Git](https://git-scm.com) instalado

---

## Opción 1: Deploy desde GitHub (RECOMENDADO)

### Paso 1 — Subir a GitHub

```bash
cd tolvink-deploy
git init
git add .
git commit -m "Tolvink v4.1 — PWA production build"

# Crear repo en GitHub (desde github.com/new) y luego:
git remote add origin https://github.com/TU_USUARIO/tolvink.git
git branch -M main
git push -u origin main
```

### Paso 2 — Conectar con Vercel

1. Ir a [vercel.com/new](https://vercel.com/new)
2. Click en **"Import Git Repository"**
3. Seleccionar el repositorio `tolvink`
4. Vercel detecta automáticamente que es Vite
5. Click en **"Deploy"**

**Listo.** Vercel te dará una URL tipo `https://tolvink-xxxxx.vercel.app`

### Paso 3 — Dominio personalizado (opcional)

1. En el dashboard de Vercel → Settings → Domains
2. Agregar tu dominio (ej: `app.tolvink.com`)
3. Configurar DNS según instrucciones de Vercel
4. HTTPS se activa automáticamente

---

## Opción 2: Deploy directo con CLI

```bash
# Instalar Vercel CLI
npm install -g vercel

# Desde la carpeta del proyecto
cd tolvink-deploy
npm install
vercel

# Seguir las instrucciones interactivas
# Para producción:
vercel --prod
```

---

## Opción 3: Deploy local para testing

```bash
cd tolvink-deploy
npm install
npm run dev
# Abrir http://localhost:3000
```

Para probar la PWA en local necesitás HTTPS. Usá:
```bash
npm run build
npx serve dist
```
O probá en Vercel preview (cada push crea un preview URL).

---

## Estructura del proyecto

```
tolvink-deploy/
├── index.html           ← Entry point con meta PWA
├── package.json         ← Dependencias (React + Vite)
├── vite.config.js       ← Build config
├── vercel.json          ← Config de deploy y headers
├── public/
│   ├── manifest.json    ← PWA manifest
│   ├── sw.js            ← Service Worker
│   ├── icons/           ← Iconos app (SVG)
│   └── splash/          ← Splash screens iOS
└── src/
    ├── main.jsx         ← React entry point
    └── App.jsx          ← Aplicación completa
```

---

## Después del deploy

### Probar PWA en móvil
1. Abrir la URL de Vercel en Chrome (Android) o Safari (iOS)
2. Android: Banner automático "Agregar a pantalla de inicio"
3. iOS: Share → "Agregar a pantalla de inicio"

### Verificar PWA
- Chrome DevTools → Application → Manifest (debe mostrar datos)
- Chrome DevTools → Application → Service Workers (debe estar activo)
- [Lighthouse](https://web.dev/measure) → Auditoría PWA

### Compartir para testing
Simplemente compartí la URL de Vercel. Funciona en cualquier dispositivo con navegador moderno.

---

## Actualizaciones

Cada push a `main` en GitHub dispara un deploy automático en Vercel.

```bash
# Hacer cambios...
git add .
git commit -m "Fix: mejora en filtros"
git push
# Vercel deploya automáticamente en ~30 segundos
```
