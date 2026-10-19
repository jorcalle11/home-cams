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
- **Sin Docker:** Node.js 20 o 22 (Node >= 24.18 rompe TLS con algunos hosts de Wyze).
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
| `HOST`, `PORT` | Dónde escucha la app (por defecto `127.0.0.1:5178`) |
| `APP_USERNAME`, `APP_PASSWORD` | Login de la app. Obligatorio en producción y en Docker |

## Ejecutar sin Docker

```bash
npm install
npm run check   # verifica login, cámaras, eventos y streaming
```

**Desarrollo** (recarga automática):

```bash
npm run dev     # http://localhost:5173
```

**Producción local** (frontend compilado servido por el mismo servidor):

```bash
npm run build
npm start       # http://127.0.0.1:3001 (HOST:PORT del .env)
```

## Ejecutar con Docker

```bash
npm run docker:up     # construye la imagen y levanta el contenedor
npm run docker:logs   # logs en vivo; debe decir "API en http://0.0.0.0:3001"
npm run docker:down   # detiene el contenedor
```

La app queda en `http://HOST:PORT` del `.env` (por defecto http://127.0.0.1:3001). Si `npm run dev`
está corriendo, usa otro puerto: `PORT=3002 npm run docker:up`.

El token de Wyze se guarda en el volumen `home-cams_wyze-token`, así que reiniciar no fuerza un login nuevo.

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
  `/api/events` y `/healthz`.
- `web/` (React + Vite): el navegador recibe una URL de señalización pre-firmada de Amazon Kinesis Video
  Streams y negocia WebRTC directamente con la cámara (el mismo camino que usa view.wyze.com). El video
  no pasa por el servidor.

## Notas

- La API de Wyze no es oficial ni está documentada; puede cambiar sin aviso.
- Los clips de video de los eventos solo existen con Cam Plus; sin él, solo hay imagen.
- Las grabaciones de la tarjeta SD no son accesibles por la API.

## Licencia

[MIT](LICENSE)
