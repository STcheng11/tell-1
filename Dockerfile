# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=3000 DATA_DIR=/app/data UPLOAD_DIR=/app/uploads
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json index.js version.js ./
COPY --chown=node:node index.html styles.css app.js ui-runtime.js theme.js theme.css glass.css glass-dialogs.js sw.js manifest.json ./
COPY --chown=node:node admin.html admin.css admin.js logo.jpg logo.png tell-icon.png ./
COPY --chown=node:node icons ./icons
COPY --chown=node:node scripts/reset-admin-password.cjs ./scripts/reset-admin-password.cjs
RUN mkdir -p /app/data /app/uploads && chown node:node /app/data /app/uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "index.js"]
