#!/bin/bash

# Script para esperar a la base de datos y ejecutar migraciones
set -e

echo "🔄 Esperando a que la base de datos esté disponible..."

# Esperar a que PostgreSQL esté listo
until pg_isready -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER"; do
  echo "⏳ Esperando PostgreSQL..."
  sleep 2
done

echo "✅ Base de datos conectada"

# Extraer host, puerto, user de DATABASE_URL si no están definidas
if [ -z "$DATABASE_HOST" ]; then
  DATABASE_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
fi

if [ -z "$DATABASE_PORT" ]; then
  DATABASE_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
fi

if [ -z "$DATABASE_USER" ]; then
  DATABASE_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
fi

echo "🚀 Ejecutando migraciones de Alembic..."

# Ejecutar migraciones
alembic upgrade head

echo "📊 Verificando estado de migraciones..."
alembic current

echo "🎯 Iniciando aplicación FastAPI..."

# Iniciar la aplicación
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
