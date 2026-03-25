# --- Stage 1: Build the client ---
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY tsconfig.base.json /app/
COPY client/ ./
RUN npm run build

# --- Stage 2: Build the server ---
FROM node:20-alpine AS server-build
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm install
COPY tsconfig.base.json /app/
COPY server/ ./
RUN npm run build

# --- Stage 3: Production image ---
FROM node:20-alpine
WORKDIR /app

COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev

COPY --from=server-build /app/server/dist ./dist
COPY --from=client-build /app/client/dist ./public

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && \
    chown -R 1001:0 /app && \
    chmod -R g=u /app

USER 1001

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
