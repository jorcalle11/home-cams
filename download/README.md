# Home Cams — ejecutar desde el registry

Ejecuta la imagen publicada en `ghcr.io/jorcalle11/home-cams` con Docker Compose.

## Requisitos

- Docker con Docker Compose v2.
- Cuenta Wyze con **Key ID** y **API Key** de https://developer-api-console.wyze.com (misma cuenta).

## 1. Copiar esta carpeta al servidor

```bash
scp -r download usuario@servidor:~/home-cams
```

## 2. Configurar

```bash
cd ~/home-cams
cp .env.example .env
chmod 600 .env
```

Completa en `.env`:

| Variable | Descripción |
|---|---|
| `WYZE_EMAIL`, `WYZE_PASSWORD` | Cuenta Wyze |
| `WYZE_KEY_ID`, `WYZE_API_KEY` | Credenciales de la API de Wyze |
| `APP_USERNAME`, `APP_PASSWORD` | Login de la app (obligatorio; usa una contraseña larga) |
| `HOST`, `API_PORT` | Dónde se publica, p. ej. `127.0.0.1` y `5178` (obligatorios) |

## 3. Acceso al registry (solo si el paquete es privado)

Crea un token en GitHub (Settings → Developer settings → Personal access tokens → *Tokens (classic)*)
con solo el permiso `read:packages`:

```bash
echo TU_TOKEN | docker login ghcr.io -u TU_USUARIO_GITHUB --password-stdin
```

## 4. Ejecutar

```bash
docker compose pull
docker compose up -d
docker compose ps        # STATUS debe pasar a "healthy"
```

Abre `http://HOST:API_PORT` (p. ej. http://127.0.0.1:5178) e inicia sesión con `APP_USERNAME` / `APP_PASSWORD`.

Con `127.0.0.1` la app solo es accesible desde el servidor: para usarla desde otros equipos publícala con
un proxy con HTTPS (Caddy, nginx). Sin HTTPS la contraseña viaja en claro.

## Actualizar

```bash
docker compose pull && docker compose up -d
```

## Detener

```bash
docker compose down
```

## Problemas comunes

| Síntoma | Causa |
|---|---|
| Se reinicia en bucle: `Faltan APP_USERNAME y APP_PASSWORD` | Completa ambos en `.env` |
| `Invalid credentials ... (errorCode 1000)` | Email, contraseña o key de Wyze incorrectos (o Key ID y API Key invertidos) |
| `Rate Limited` | Demasiados logins seguidos; espera unos 10 minutos |
| `denied` / `unauthorized` al hacer `pull` | Falta el `docker login ghcr.io` del paso 3 |
