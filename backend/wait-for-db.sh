#!/bin/bash
# Espera PostgreSQL, aplica migraciones e inicia uvicorn (producción, sin --reload).
set -e

echo "Esperando a que la base de datos este disponible..."

until pg_isready -h "${DATABASE_HOST:-db}" -p "${DATABASE_PORT:-5432}" -U "${DATABASE_USER:-motostock}"; do
  echo "Esperando PostgreSQL..."
  sleep 2
done

echo "Base de datos conectada"
echo "Ejecutando migraciones de Alembic..."

alembic upgrade head
alembic current

echo "Iniciando aplicacion FastAPI..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
