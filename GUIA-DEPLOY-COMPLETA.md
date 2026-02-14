# Tolvink — Guía completa de deploy (desde cero)
# Para alguien que nunca usó GitHub ni Vercel

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTE 1: PREPARAR TU COMPUTADORA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 1.1 Instalar Node.js

Node.js es el motor que necesita React para funcionar.

1. Ir a: https://nodejs.org
2. Descargar la versión LTS (el botón verde grande de la izquierda)
3. Instalar con doble click (siguiente, siguiente, finalizar)
4. Para verificar que se instaló, abrir la Terminal:
   - Windows: buscar "cmd" o "PowerShell" en el menú inicio
   - Mac: buscar "Terminal" en Spotlight (Cmd + Espacio)

Escribir:
  node --version

Si aparece algo como "v20.11.0" → está bien instalado.


## 1.2 Instalar Git

Git es la herramienta que conecta tu código con GitHub.

1. Ir a: https://git-scm.com/downloads
2. Descargar para tu sistema operativo
3. Instalar con las opciones por defecto
4. Verificar:

Escribir en la terminal:
  git --version

Si aparece algo como "git version 2.43.0" → está bien.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTE 2: CREAR CUENTA EN GITHUB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GitHub es donde se guarda el código. Vercel lee desde ahí.

1. Ir a: https://github.com
2. Click en "Sign up"
3. Completar:
   - Email: tu email personal
   - Password: una contraseña segura
   - Username: elegir un nombre de usuario (ej: juanperez-dev)
4. Verificar el email (te llega un código)
5. Elegir el plan FREE (es suficiente)

¡Listo! Ya tenés cuenta en GitHub.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTE 3: CREAR CUENTA EN VERCEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Vercel es el servidor donde va a vivir tu app. Es gratis.

1. Ir a: https://vercel.com
2. Click en "Sign Up"
3. IMPORTANTE: Elegir "Continue with GitHub"
   (esto conecta automáticamente las dos cuentas)
4. Autorizar el acceso cuando GitHub lo pida
5. Elegir el plan "Hobby" (gratis)

¡Listo! Vercel ya está conectado con tu GitHub.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTE 4: PREPARAR EL PROYECTO EN TU COMPUTADORA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 4.1 Descomprimir el archivo

1. Descargá el archivo "tolvink-deploy.tar.gz" que te di
2. Poné el archivo en tu Escritorio
3. Abrir la Terminal y escribir:

En Mac:
  cd ~/Desktop
  tar xzf tolvink-deploy.tar.gz

En Windows (PowerShell):
  cd $HOME\Desktop
  tar xzf tolvink-deploy.tar.gz

Esto crea una carpeta llamada "tolvink-deploy" en tu Escritorio.


## 4.2 Instalar las dependencias

En la terminal:
  cd tolvink-deploy
  npm install

Esto descarga React y Vite. Tarda 1-2 minutos.
Al terminar aparece "added XXX packages".


## 4.3 Probar en local (opcional pero recomendado)

En la terminal:
  npm run dev

Aparece algo como:
  Local: http://localhost:3000/

Abrí esa URL en tu navegador. Deberías ver Tolvink funcionando.
Para parar: presioná Ctrl + C en la terminal.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTE 5: SUBIR A GITHUB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 5.1 Configurar Git (solo la primera vez)

En la terminal:
  git config --global user.name "Tu Nombre"
  git config --global user.email "tu@email.com"

Usá el MISMO email que usaste en GitHub.


## 5.2 Crear el repositorio en GitHub

1. Ir a: https://github.com/new
2. Completar:
   - Repository name: tolvink
   - Description: Gestión de fletes de granos
   - Elegir: Public (o Private si preferís)
   - NO marcar "Add a README file"
   - NO marcar "Add .gitignore"
3. Click en "Create repository"

GitHub te muestra una página con instrucciones.
NO cierres esta página, la vas a necesitar.


## 5.3 Subir tu código

Asegurate de estar en la carpeta del proyecto en la terminal:
  cd ~/Desktop/tolvink-deploy

Ahora escribí estos comandos UNO POR UNO:

  git init
  git add .
  git commit -m "Tolvink v4.1 - primera versión"
  git branch -M main
  git remote add origin https://github.com/TU_USUARIO/tolvink.git
  git push -u origin main

IMPORTANTE: Reemplazá TU_USUARIO por tu nombre de usuario de GitHub.
Ejemplo: si tu usuario es "juanperez-dev":
  git remote add origin https://github.com/juanperez-dev/tolvink.git

La primera vez te pide autenticarte:
- Te abre el navegador para autorizar
- O te pide usuario y contraseña
  (en ese caso, la contraseña es un "Personal Access Token",
   que podés crear en GitHub → Settings → Developer Settings →
   Personal Access Tokens → Generate new token → seleccionar "repo")

Si todo salió bien, tu código ya está en GitHub.
Verificá entrando a: https://github.com/TU_USUARIO/tolvink
Deberías ver todos los archivos ahí.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTE 6: DEPLOY EN VERCEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Esta es la parte más fácil.

1. Ir a: https://vercel.com/new

2. En "Import Git Repository" vas a ver tu repo "tolvink"
   Click en "Import"

   Si no aparece: click en "Adjust GitHub App Permissions"
   y dale acceso al repositorio "tolvink"

3. Vercel muestra la configuración del proyecto:
   - Framework Preset: Vite (lo detecta solo)
   - Root Directory: ./ (dejar así)
   - Build Command: npm run build (dejar así)
   - Output Directory: dist (dejar así)

4. Click en "Deploy"

5. Esperá 30-60 segundos. Vas a ver un progreso.

6. Cuando termine, Vercel te muestra:
   "Congratulations! Your project has been deployed."
   Y una URL tipo: https://tolvink-abc123.vercel.app

7. Hacé click en esa URL. ¡Tu app está en internet!


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTE 7: PROBAR EN EL CELULAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Android
1. Abrí Chrome en el celular
2. Entrá a tu URL de Vercel
3. Va a aparecer un banner: "Agregar Tolvink a pantalla de inicio"
4. Aceptá
5. Ahora tenés un ícono de Tolvink como si fuera una app

## iPhone
1. Abrí Safari en el iPhone
2. Entrá a tu URL de Vercel
3. Tocá el ícono de Compartir (el cuadrado con flecha)
4. Bajá y tocá "Agregar a pantalla de inicio"
5. Confirmá el nombre "Tolvink"
6. Tocá "Agregar"
7. Ahora tenés Tolvink en tu pantalla de inicio


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTE 8: COMPARTIR CON OTRAS PERSONAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Simplemente compartí la URL de Vercel por WhatsApp, email, etc.
Cualquier persona puede:
- Abrir desde el navegador del celular
- Instalarlo como app (siguiendo los pasos de arriba)
- Usarlo inmediatamente

No necesitan instalar nada de ninguna tienda.

Cuentas de prueba para compartir:
  carolina@planta.com (Gerente Planta)
  ricardo@transp.com (Gerente Transportista)
  juan@campo.com (Gerente Productor)
  Contraseña: 1234


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTE 9: HACER CAMBIOS Y ACTUALIZAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cada vez que quieras actualizar la app:

1. Hacé los cambios en los archivos de tu computadora
2. Abrí la terminal en la carpeta del proyecto:
     cd ~/Desktop/tolvink-deploy
3. Escribí:
     git add .
     git commit -m "Descripción del cambio"
     git push
4. Vercel detecta el cambio automáticamente
5. En 30 segundos tu app está actualizada para todos


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOMINIO PERSONALIZADO (OPCIONAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Si querés que la URL sea "app.tolvink.com" en vez de la de Vercel:

1. Comprá un dominio en Namecheap, GoDaddy, etc. (~12 USD/año)
2. En Vercel → tu proyecto → Settings → Domains
3. Escribí tu dominio y seguí las instrucciones para configurar DNS
4. HTTPS se activa solo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROBLEMAS COMUNES Y SOLUCIONES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROBLEMA: "npm: command not found"
SOLUCIÓN: Node.js no se instaló bien. Reinstalá desde nodejs.org
          y reiniciá la terminal.

PROBLEMA: "git: command not found"
SOLUCIÓN: Git no se instaló bien. Reinstalá desde git-scm.com
          y reiniciá la terminal.

PROBLEMA: "npm install" falla con errores
SOLUCIÓN: Intentá:
  rm -rf node_modules package-lock.json
  npm install

PROBLEMA: "git push" pide contraseña y falla
SOLUCIÓN: GitHub ya no acepta contraseña directa.
  Necesitás un Personal Access Token:
  1. GitHub → Settings (click en tu avatar arriba a la derecha)
  2. Developer settings (al final del menú izquierdo)
  3. Personal access tokens → Tokens (classic)
  4. Generate new token (classic)
  5. Darle nombre "tolvink", marcar "repo", click Generate
  6. COPIAR el token (empieza con ghp_...)
  7. Usar ESE token como contraseña cuando git lo pida

PROBLEMA: Vercel no detecta el repo
SOLUCIÓN: En Vercel → Settings → Git → 
  "GitHub App Permissions" → darle acceso al repo

PROBLEMA: La app se ve pero no funciona el Service Worker
SOLUCIÓN: El SW necesita HTTPS. En Vercel funciona automáticamente.
  En local (localhost) también funciona.
  NO funciona si abrís el archivo HTML directo.

PROBLEMA: No aparece el botón "Instalar" en el celular
SOLUCIÓN: Asegurate de entrar por HTTPS (la URL de Vercel).
  En Android aparece automático en Chrome.
  En iOS hay que usar el menú Compartir de Safari.
