# 🚀 Guía de Despliegue en Producción y Staging — MotoStock

Esta guía detalla los pasos y mejores prácticas para desplegar el ecosistema full-stack **MotoStock** en un servidor de producción o pruebas (staging) utilizando la configuración premium de contenedores con Nginx WAF (ModSecurity), SSL, Prometheus, Grafana y respaldos automatizados.

---

## 📋 Requisitos del Servidor

*   **Sistema Operativo:** Servidor Linux (Ubuntu 22.04 LTS o superior recomendado).
*   **Recursos Mínimos:** 2 vCPUs, 4 GB RAM, 40 GB SSD.
*   **Herramientas requeridas:**
    *   Docker v24.0.0 o superior.
    *   Docker Compose v2.20.0 o superior.
    *   Cliente OpenSSL.
    *   Cliente Curl / Wget.

---

## 🛠️ Paso 1: Preparación del Servidor y Directorios

Por seguridad, la aplicación debe correr con privilegios restringidos. No ejecutes Docker como root de manera directa en tus flujos de despliegue si es posible.

Crea los directorios necesarios para los volúmenes persistentes en el directorio del proyecto en el servidor (ej. `/var/www/motostock`):

```bash
mkdir -p certs logs logs/nginx backups nginx/ssl
```

Establece los permisos correctos en el sistema de archivos del servidor para restringir el acceso a directorios altamente sensibles:

```bash
chmod 700 certs backups nginx/ssl
chmod 755 logs logs/nginx
```

---

## 🔑 Paso 2: Generación Segura de Secretos y Configuración de `.env`

Copia la plantilla de producción como tu archivo `.env` definitivo:

```bash
cp .env.production .env
```

Genera claves robustas de forma aleatoria utilizando Python y actualiza tu `.env`:

### 1. Clave Secreta para Tokens JWT (`SECRET_KEY`)
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
# Copia la salida y asígnala a: SECRET_KEY=
```

### 2. Clave de Cifrado Simétrico Fernet (`ENCRYPTION_KEY`)
Esta clave de 44 caracteres codificada en Base64 se utiliza para encriptar campos altamente sensibles en la base de datos (como credenciales de API o certificados de empresa). **¡No la pierdas o no podrás descifrar los datos!**
```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# Copia la salida y asígnala a: ENCRYPTION_KEY=
```

### 3. Contraseñas de Base de Datos y Redis
Genera contraseñas fuertes de 16-32 caracteres alfanuméricos para `POSTGRES_PASSWORD`, `REDIS_PASSWORD` y `GRAFANA_PASSWORD`.

### 4. Ajustar CORS y Dominios
En el archivo `.env`, localiza y edita los dominios del frontend y el API:
```env
CORS_ORIGINS=https://mi-taller.com,https://api.mi-taller.com
VITE_API_URL=https://api.mi-taller.com
```

---

## 🛡️ Paso 3: Configurar SSL (HTTPS) con Nginx

El despliegue de producción utiliza la imagen `owasp/modsecurity-crs:nginx-alpine` que integra el cortafuegos de aplicaciones web (WAF) ModSecurity con las reglas predeterminadas OWASP para bloquear inyecciones SQL, XSS y ataques de fuerza bruta.

### Opción A: Usar Let's Encrypt (Certbot) en el Servidor (Recomendado)
1.  Instala certbot en tu servidor anfitrión:
    ```bash
    sudo apt update
    sudo apt install certbot -y
    ```
2.  Obtén los certificados (asegúrate de que los puertos 80 y 443 apunten a la IP del servidor):
    ```bash
    sudo certbot certonly --standalone -d mi-taller.com -d api.mi-taller.com
    ```
3.  Crea enlaces simbólicos o copia los certificados generados al directorio `nginx/ssl` de MotoStock:
    ```bash
    cp /etc/letsencrypt/live/mi-taller.com/fullchain.pem ./nginx/ssl/cert.pem
    cp /etc/letsencrypt/live/mi-taller.com/privkey.pem ./nginx/ssl/key.pem
    chmod 600 ./nginx/ssl/key.pem
    ```

### Opción B: Certificados Auto-Firmados (Solo Staging/Pruebas)
Si despliegas en un servidor interno o local de pruebas, puedes generar certificados temporales:
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/key.pem \
    -out nginx/ssl/cert.pem \
    -subj "/C=CO/ST=Bogota/L=Bogota/O=MotoStock/CN=localhost"
chmod 600 nginx/ssl/key.pem
```

---

## 🚀 Paso 4: Lanzar el Stack de Producción

Una vez configuradas las variables de entorno (`.env`) y cargados los certificados en `nginx/ssl/`, arranca el entorno de producción con el archivo de compose correspondiente:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Acciones Automatizadas en el Arranque:
1.  **db**: PostgreSQL 15 arranca y monta el volumen persistente `pgdata_prod`.
2.  **redis**: Inicia de forma segura requiriendo la contraseña asignada.
3.  **backend**: Espera a que la base de datos y Redis estén listos, ejecuta las migraciones de base de datos con Alembic e inicia el servidor Uvicorn en el puerto interno `8000`.
4.  **frontend**: Compila y optimiza el código de React en HTML/JS estático y levanta un servidor Nginx ligero en el puerto interno `80`.
5.  **nginx**: Levanta el proxy reverso con WAF en los puertos públicos `80` (HTTP con redirección automática) y `443` (HTTPS cifrado), enrutando el tráfico adecuadamente:
    *   Tráfico web a `frontend`.
    *   Tráfico `/api` y `/docs` al `backend`.

---

## 📊 Paso 5: Monitoreo con Grafana y Prometheus

Si tu entorno de producción requiere visualización del rendimiento y consumo de recursos de la API:

1.  Asegúrate de configurar `PROMETHEUS_ENABLED=true` en tu `.env`.
2.  El servidor de Prometheus recopila métricas desde la API de FastAPI automáticamente.
3.  Accede a Grafana en: `http://<IP-TU-SERVIDOR>:3000`.
4.  Inicia sesión con `GRAFANA_USER` y `GRAFANA_PASSWORD` (configurados en tu `.env`).
5.  Grafana viene pre-provisionado con el origen de datos de Prometheus y tableros listos para analizar el consumo de memoria, CPU y tiempos de respuesta de la API.

---

## 💾 Paso 6: Verificación de Copias de Seguridad (Backups)

El contenedor `motostock_backup` realiza automáticamente volcados lógicos de la base de datos en `/backups/` cada 12 horas.

Para verificar que los backups se estén guardando de manera satisfactoria:
```bash
ls -lh ./backups/
```
*Deberías ver archivos con el formato `db_backup_YYYYMMDD_HHMMSS.sql.gz`.*

### Procedimiento de Restauración en Producción:
En caso de desastre, puedes restaurar un backup específico deteniendo la app y ejecutando:
```bash
# 1. Asegúrate de tener los servicios arriba
docker compose -f docker-compose.prod.yml up -d db

# 2. Descomprimir el respaldo elegido
gunzip ./backups/db_backup_20260521_120000.sql.gz

# 3. Restaurar la base de datos
docker exec -i motostock_db_prod psql -U motostock_prod -d motostock_prod < ./backups/db_backup_20260521_120000.sql
```

---

## 🔍 Paso 7: Diagnóstico de Problemas Habituales (Troubleshooting)

### 1. El backend no se inicia (`unhealthy`)
*   **Causa:** Fallo en la migración de Alembic o problemas al conectar a Redis/Postgres.
*   **Solución:** Revisa los logs detallados del backend:
    ```bash
    docker compose -f docker-compose.prod.yml logs backend --tail=100
    ```

### 2. El WAF bloquea peticiones legítimas
*   **Causa:** Falsos positivos de ModSecurity ante ciertos payloads JSON extensos.
*   **Solución:** Puedes ajustar las reglas o deshabilitar reglas específicas editando `nginx/waf_rules.conf` y reiniciando el contenedor de nginx:
    ```bash
    docker compose -f docker-compose.prod.yml restart nginx
    ```

### 3. Error de CORS en el Navegador
*   **Causa:** La variable `CORS_ORIGINS` no coincide exactamente con el dominio desde el cual estás accediendo.
*   **Solución:** Modifica `CORS_ORIGINS` en el archivo `.env` asegurándote de incluir el protocolo exacto y de no colocar barras finales (`/`). Ejemplo: `https://mi-taller.com` (no `https://mi-taller.com/`).
