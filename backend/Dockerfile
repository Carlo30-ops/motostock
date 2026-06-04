# Multi-stage build para optimizar tamaño de imagen
FROM python:3.11-slim as builder

# Instalar dependencias de compilación
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev libffi-dev libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgdk-pixbuf-xlib-2.0-0 shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar requirements e instalar dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage de producción
FROM python:3.11-slim as production

# Instalar solo dependencias runtime necesarias
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgdk-pixbuf-xlib-2.0-0 shared-mime-info curl postgresql-client \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app

# Copiar dependencias instaladas desde builder
COPY --from=builder /usr/local/lib /usr/local/lib
COPY --from=builder /usr/local/bin /usr/local/bin

# Copiar código de aplicación
COPY . .

# Script para esperar a la base de datos y ejecutar migraciones
COPY wait-for-db.sh /wait-for-db.sh
RUN chmod +x /wait-for-db.sh

# Agregar al PATH las instalaciones de usuario
ENV PATH=/usr/local/bin:$PATH

# Health check para Docker
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/api/health/live || exit 1

# Crear usuario no-root para seguridad (lectura de /usr/local para alembic/uvicorn)
RUN groupadd -r motostock && useradd -r -g motostock motostock \
    && chown -R motostock:motostock /app \
    && chmod +x /wait-for-db.sh
USER motostock

CMD ["/wait-for-db.sh"]





