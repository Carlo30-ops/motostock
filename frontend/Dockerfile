# Multi-stage build optimizado para frontend con mejoras de seguridad y rendimiento
FROM node:20-alpine as builder

WORKDIR /app

# Enable corepack for pnpm support
RUN corepack enable

# Copiar archivos de dependencias primero para mejor cache
COPY package.json pnpm-lock.yaml* ./

# Instalar dependencias con optimizaciones
RUN pnpm install --frozen-lockfile --prod=false || npm install

# Copiar código fuente
COPY . .

# Build para producción con optimizaciones
RUN pnpm run build

# Stage de producción con nginx optimizado
FROM nginx:alpine as production

# Instalar herramientas adicionales para health checks
RUN apk add --no-cache wget curl

# Copiar build del frontend
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuración nginx optimizada
COPY nginx.conf /etc/nginx/nginx.conf

# Copiar script de health check
COPY health-check.sh /health-check.sh
RUN chmod +x /health-check.sh

# Security headers y optimizaciones
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Security headers \
    add_header X-Frame-Options "SAMEORIGIN" always; \
    add_header X-Content-Type-Options "nosniff" always; \
    add_header X-XSS-Protection "1; mode=block" always; \
    add_header Referrer-Policy "strict-origin-when-cross-origin" always; \
    add_header Content-Security-Policy "default-src '\''self'\''; script-src '\''self'\'' '\''unsafe-inline'\''; style-src '\''self'\'' '\''unsafe-inline'\''; img-src '\''self'\'' data: https:; font-src '\''self'\''; connect-src '\''self'\'' ws: wss:;"; \
    \
    # Optimizaciones para SPA \
    location / { \
        try_files $uri $uri/ /index.html; \
        add_header Cache-Control "no-cache, no-store, must-revalidate"; \
        add_header Pragma "no-cache"; \
        add_header Expires "0"; \
    } \
    \
    # Cache para assets estáticos \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
    \
    # Health check endpoint \
    location /health { \
        access_log off; \
        return 200 "healthy\n"; \
        add_header Content-Type text/plain; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Health check mejorado
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

# Exponer puerto 80
EXPOSE 80

# User no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Cambiar ownership
RUN chown -R nextjs:nodejs /usr/share/nginx/html && \
    chown -R nextjs:nodejs /var/cache/nginx && \
    chown -R nextjs:nodejs /var/log/nginx && \
    chown -R nextjs:nodejs /etc/nginx/conf.d

USER nextjs

CMD ["nginx", "-g", "daemon off;"]

# Stage de desarrollo optimizado
FROM node:20-alpine as development

WORKDIR /app

# Enable corepack for pnpm support
RUN corepack enable

# Instalar dependencias con cache optimizado
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || npm install

COPY . .

# Vite development server con configuración optimizada
EXPOSE 5173

# Health check script para desarrollo
COPY health-check.sh /health-check.sh
RUN chmod +x /health-check.sh

# Health check para Docker en desarrollo
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD /health-check.sh

# CMD optimizado para desarrollo con host 0.0.0.0
CMD ["pnpm", "run", "dev", "--host", "0.0.0.0"]
