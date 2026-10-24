# Home Cams

Visor web para cámaras Wyze (Cam v3, Cam Pan v3): video y audio en vivo por WebRTC, eventos por día,
grupos de la app de Wyze, capturas y encendido/apagado (modo privacidad).

## ¿Por qué?

Wyze tiene una versión web oficial para ver las cámaras, pero requiere una suscripción: la versión
gratuita solo permite ver una cámara. Home Cams es una alternativa web self-hosted para ver **todas**
las cámaras de la cuenta desde el navegador, sin suscripción.

Usa la misma cuenta y la misma nube de Wyze (sin firmware modificado, sin RTSP, sin abrir puertos), y
el video va directo del navegador a Wyze sin pasar por el servidor.

## Requisitos

- Cuenta Wyze con **Key ID** y **API Key** generados en https://developer-api-console.wyze.com
  (con la misma cuenta).
- **Sin Docker:** Node.js 22.13 o superior (usa `node:sqlite`) y menor que 24.18 (Node >= 24.18 rompe TLS con algunos hosts de Wyze).
- **Con Docker:** Docker con Docker Compose v2.

## Configuración

```bash
cp .env.example .env
```

Completa en `.env`:

| Variable | Descripción |
|---|---|
| `WYZE_EMAIL`, `WYZE_PASSWORD` | Cuenta Wyze |
| `WYZE_KEY_ID`, `WYZE_API_KEY` | Credenciales de la API de Wyze |
| `HOST`, `API_PORT` | Dónde escucha la app, p. ej. `127.0.0.1` y `5178` (obligatorios) |
| `UI_PORT` | Puerto de Vite en desarrollo, p. ej. `5173` (obligatorio para `npm run dev`) |
| `CORS_ORIGINS` | Opcional. Orígenes que pueden llamar a `/api` desde un navegador: `*` o una lista separada por comas (`null` = apps abiertas desde `file://`) |

## Login

La primera vez que abres la app muestra un **registro**: el usuario que crees es el único que puede entrar
(no se pueden crear más). Después pide **iniciar sesión**; la sesión dura 30 días (cookie `HttpOnly`) y se cierra
con "Salir". Tras 10 intentos fallidos desde una IP, el login se bloquea 15 minutos.

## API y API keys

El API (`/api/cameras`, `/api/cameras/:mac/stream`, `/api/events`, `/api/cameras/:mac/power`) acepta la sesión
de la web o una **API key por cliente** (`Authorization: Bearer <key>`), para otras apps como una de TV.

Las claves se gestionan con la sesión de la web. Desde la terminal, inicia sesión guardando la cookie:

```bash
curl -c cookies.txt -H 'Content-Type: application/json' -d '{"username":"…","password":"…"}' http://127.0.0.1:5178/api/auth/login
# Crear una clave (se muestra una sola vez; el servidor solo guarda su hash)
curl -b cookies.txt -H 'Content-Type: application/json' -d '{"name":"LG TV 60UQ8050PSB"}' http://127.0.0.1:5178/api/keys
# Clientes: último uso, IP, user agent, peticiones y si están activos (últimos 5 min)
curl -b cookies.txt http://127.0.0.1:5178/api/keys
# Revocar
curl -b cookies.txt -X DELETE http://127.0.0.1:5178/api/keys/<id>
```

El usuario, las sesiones y los clientes se guardan en SQLite (`.wyze/home-cams.db`, en el mismo volumen que el token de Wyze).
Para apps servidas desde otro origen (p. ej. una app de TV abierta desde `file://`), configura `CORS_ORIGINS`.

## Ejecutar sin Docker

```bash
npm install
npm run check   # verifica login, cámaras, eventos y streaming
```

**Desarrollo** (recarga automática):

```bash
npm run dev     # http://localhost:5173 (UI_PORT del .env)
```

**Producción local** (frontend compilado servido por el mismo servidor):

```bash
npm run build
npm start       # http://127.0.0.1:5178 (HOST:API_PORT del .env)
```

## Ejecutar con Docker

El `Dockerfile` tiene varias etapas: `dev` (todas las dependencias; el código se monta desde el host)
y `prod` (solo dependencias de runtime, el servidor y el frontend compilado). El `docker-compose.yml`
de la raíz es para desarrollo local; producción usa la imagen publicada (ver [`download/`](download/)).

```bash
npm run dev-docker    # construye la imagen dev y levanta api y web con logs; Ctrl+C los detiene
```

- `web`: Vite con recarga automática en `http://localhost:UI_PORT` (redirige `/api` al servicio `api`).
- `api`: Express con `node --watch`, también publicado en `HOST:API_PORT` para probar
  clientes externos.

`API_PORT` y `UI_PORT` se leen del `.env` (son obligatorios) o del shell. Si `npm run dev` está corriendo, usa otros puertos:
`API_PORT=5179 UI_PORT=5174 npm run dev-docker`.

Editar el código no requiere reconstruir. Tras cambiar `package.json`, vuelve a ejecutar `npm run dev-docker`.
Usa el `.wyze` del proyecto, así que comparte el token de Wyze y las API keys con `npm run dev`.

## Despliegue en un servidor

El workflow `.github/workflows/docker-image.yml` publica la imagen en `ghcr.io/jorcalle11/home-cams`
en cada push a `main` (`:latest`) y en cada tag `v*.*.*`. La imagen es pública (`docker pull` sin login). La carpeta [`download/`](download/) tiene lo
necesario para ejecutarla en el servidor desde el registry.

## Filtros en la URL

| Parámetro | Ejemplo |
|---|---|
| `tab` | `?tab=events` |
| `group` | `?group=Casa` (nombre o id; sin importar mayúsculas ni tildes) |
| `view` | `?view=list` |
| `cam` | `?cam=AABBCCDDEEFF` (MAC, en Eventos) |
| `day` | `?day=2026-10-18` (en Eventos) |

## Cómo funciona

- `server/` (Express + [`wyze-api`](https://github.com/jfarmer08/wyze-api)): hace login en Wyze, guarda el
  token en `.wyze/` y expone `/api/cameras`, `/api/cameras/:mac/stream`, `/api/cameras/:mac/power`,
  `/api/events` y `/healthz`. Organizado por funcionalidad:
  - `index.js` arranca el servidor; `app.js` arma Express (el orden de los middlewares importa);
    `config.js` es el único lugar que lee las variables de entorno; `db.js` abre SQLite.
  - `features/<auth|keys|cameras|events>/`: cada una con sus rutas (`*.routes.js`) y su lógica (`*.service.js`).
  - `middleware/`: sesión o API key, CORS y el manejo de errores de Wyze.
  - `wyze/`: el cliente de Wyze y los parches que silencian `wyze-api`.
  - `scripts/check.js`: lo que ejecuta `npm run check`.
- `web/` (React + Vite): el navegador recibe una URL de señalización pre-firmada de Amazon Kinesis Video
  Streams y negocia WebRTC directamente con la cámara (el mismo camino que usa view.wyze.com). El video
  no pasa por el servidor.

## Notas

- La API de Wyze no es oficial ni está documentada; puede cambiar sin aviso.
- Los clips de video de los eventos solo existen con Cam Plus; sin él, solo hay imagen.
- Las grabaciones de la tarjeta SD no son accesibles por la API.

## Licencia

[MIT](LICENSE)
