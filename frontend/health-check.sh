#!/bin/bash

# Health check script para frontend Vite
set -e

# Verificar que el servidor Vite esté respondiendo
if curl -f -s http://localhost:5173 > /dev/null; then
    echo "✅ Frontend health check passed"
    exit 0
else
    echo "❌ Frontend health check failed"
    exit 1
fi
