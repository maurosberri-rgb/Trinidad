# Imagen de Trinidad para Cloudflare Containers (linux/amd64).
# Etapa 1: instala todo y compila la web y la API.
FROM node:22-slim AS compilar
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# Etapa 2: solo lo necesario para correr.
FROM node:22-slim
ENV NODE_ENV=production PORT=4500
WORKDIR /app
COPY --from=compilar /app/package.json ./
COPY --from=compilar /app/node_modules ./node_modules
COPY --from=compilar /app/apps/api/package.json ./apps/api/
COPY --from=compilar /app/apps/api/dist ./apps/api/dist
COPY --from=compilar /app/apps/web/dist ./apps/web/dist
USER node
EXPOSE 4500
CMD ["node", "apps/api/dist/index.js"]
