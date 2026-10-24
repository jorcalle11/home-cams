# Node 22: Node >= 24.18 breaks TLS with some Wyze hosts (see README).
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY vite.config.js ./
COPY web ./web
RUN npm run build

FROM node:22-slim
# No ENV: HOST, API_PORT and NODE_ENV come from .env and docker-compose.yml.
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY --from=build /app/dist ./dist
# The Wyze token is stored here so restarts don't trigger a new login.
RUN mkdir -p .wyze && chown node:node .wyze
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.API_PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# node:sqlite is still experimental in Node 22; hide its startup warning.
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.js"]
