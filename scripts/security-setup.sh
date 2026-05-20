#!/bin/bash

# Security setup script for MotoStock production deployment
set -e

echo "🔒 MotoStock Security Setup"
echo "=========================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons"
   exit 1
fi

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p certs
mkdir -p logs
mkdir -p logs/nginx
mkdir -p backups
mkdir -p nginx/ssl

# Set proper permissions
print_status "Setting proper permissions..."
chmod 700 certs
chmod 755 logs
chmod 755 logs/nginx
chmod 700 backups
chmod 700 nginx/ssl

# Generate secure secret key
print_status "Generating secure secret key..."
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
echo "Generated SECRET_KEY: $SECRET_KEY"

# Generate secure database password
print_status "Generating secure database password..."
DB_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(16))")
echo "Generated POSTGRES_PASSWORD: $DB_PASSWORD"

# Generate Redis password
print_status "Generating Redis password..."
REDIS_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(16))")
echo "Generated REDIS_PASSWORD: $REDIS_PASSWORD"

# Create production .env file
print_status "Creating production .env file..."
if [ ! -f .env ]; then
    cp .env.production .env
    print_status "Created .env from .env.production template"
else
    print_warning ".env file already exists, backing up to .env.backup"
    cp .env .env.backup
fi

# Update .env with generated values
print_status "Updating .env with generated secure values..."
sed -i "s/CHANGE_ME_TO_STRONG_RANDOM_PASSWORD/$DB_PASSWORD/g" .env
sed -i "s/CHANGE_ME_TO_NEW_STRONG_SECRET_KEY_32_CHARS/$SECRET_KEY/g" .env
sed -i "s/CHANGE_ME_REDIS_PASSWORD/$REDIS_PASSWORD/g" .env

# Create Docker secrets
print_status "Creating Docker secrets..."
echo "$SECRET_KEY" | docker secret create motostock_secret_key -
echo "$DB_PASSWORD" | docker secret create motostock_db_password -
echo "$REDIS_PASSWORD" | docker secret create motostock_redis_password -

# Set up SSL certificate (self-signed for development, replace with proper certs in production)
print_status "Setting up SSL certificate (self-signed for testing)..."
if [ ! -f nginx/ssl/cert.pem ]; then
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=CO/ST=State/L=City/O=Organization/CN=localhost"
    chmod 600 nginx/ssl/key.pem
    chmod 644 nginx/ssl/cert.pem
    print_status "Created self-signed SSL certificate"
    print_warning "Replace with proper SSL certificate for production"
fi

# Create backup script
print_status "Creating backup script..."
cat > scripts/backup.sh << 'EOF'
#!/bin/bash

# Backup script for MotoStock
set -e

BACKUP_DIR="/app/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_BACKUP_FILE="$BACKUP_DIR/db_backup_$DATE.sql"

# Create database backup
docker exec motostock_db_prod pg_dump -U motostock_prod motostock_prod > $DB_BACKUP_FILE

# Compress backup
gzip $DB_BACKUP_FILE

# Remove old backups (keep last 30 days)
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $DB_BACKUP_FILE.gz"
EOF

chmod +x scripts/backup.sh

# Create monitoring script
print_status "Creating monitoring script..."
cat > scripts/monitor.sh << 'EOF'
#!/bin/bash

# Monitoring script for MotoStack services
set -e

echo "=== MotoStock Service Status ==="

# Check database
echo "Database:"
docker exec motostock_db_prod pg_isready -U motostock_prod

# Check Redis
echo "Redis:"
docker exec motostock_redis_prod redis-cli ping

# Check backend
echo "Backend API:"
curl -f http://localhost/api/health/live

# Check frontend
echo "Frontend:"
curl -f http://localhost/health

echo "=== Resource Usage ==="
docker stats --no-stream

echo "=== Disk Usage ==="
df -h

echo "=== Memory Usage ==="
free -h
EOF

chmod +x scripts/monitor.sh

# Security hardening
print_status "Applying security hardening..."

# Set up log rotation
cat > /etc/logrotate.d/motostock << EOF
/app/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        docker kill -s USR1 motostock_backend_prod
    endscript
}
EOF

# Create systemd service files (optional)
if command -v systemctl &> /dev/null; then
    print_status "Creating systemd service files..."
    cat > /etc/systemd/system/motostock-backup.service << EOF
[Unit]
Description=MotoStock Backup Service
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
ExecStart=/path/to/motostock/scripts/backup.sh

[Install]
WantedBy=multi-user.target
EOF

    cat > /etc/systemd/system/motostock-backup.timer << EOF
[Unit]
Description=Run MotoStock backup every 12 hours
Requires=motostock-backup.service

[Timer]
OnCalendar=*:0/12:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

    systemctl enable motostock-backup.timer
    systemctl start motostock-backup.timer
fi

# Final security checklist
print_status "Security setup completed!"
echo ""
echo "🔒 Security Checklist:"
echo "✅ Secure passwords generated"
echo "✅ SSL certificates created"
echo "✅ Proper file permissions set"
echo "✅ Docker secrets configured"
echo "✅ Log rotation configured"
echo "✅ Backup scripts created"
echo "✅ Monitoring scripts created"
echo ""
echo "⚠️  Important Security Reminders:"
echo "1. Replace self-signed SSL certificate with proper CA-signed certificate"
echo "2. Update CORS_ORIGINS in .env with your actual domains"
echo "3. Configure firewall to only allow necessary ports"
echo "4. Set up proper monitoring and alerting"
echo "5. Regularly update dependencies and containers"
echo "6. Implement proper backup storage and retention policies"
echo "7. Review and update security headers as needed"
echo ""
echo "🚀 Ready for production deployment!"
echo "   Run: docker-compose -f docker-compose.prod.yml up -d"
