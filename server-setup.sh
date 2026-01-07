#!/bin/bash

# A Plus Center - Complete Server Setup Script
# Run this directly on the server: root@66.94.105.43

set -e

echo "🚀 Starting A Plus Center Server Setup..."
echo ""

# Update system
echo "📦 Updating system packages..."
apt-get update -y
apt-get upgrade -y

# Install Node.js 20.x
echo "📦 Installing Node.js 20.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "✅ Node.js already installed: $(node --version)"
fi

# Install PostgreSQL
echo "📦 Installing PostgreSQL..."
if ! command -v psql &> /dev/null; then
    apt-get install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
else
    echo "✅ PostgreSQL already installed"
fi

# Install PM2
echo "📦 Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
else
    echo "✅ PM2 already installed: $(pm2 --version)"
fi

# Install nginx
echo "📦 Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx
    systemctl start nginx
    systemctl enable nginx
else
    echo "✅ Nginx already installed"
fi

# Create application directory
APP_DIR="/var/www/aplus-center"
echo "📁 Creating application directory: $APP_DIR"
mkdir -p $APP_DIR
mkdir -p /var/log/aplus-center

# Set up PostgreSQL database
echo "🗄️  Setting up PostgreSQL database..."
DB_USER="aplususer"
DB_NAME="apluscenter"
DB_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)

# Create database and user
sudo -u postgres psql << EOF
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$DB_USER') THEN
        CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    END IF;
END
\$\$;

SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

ALTER DATABASE $DB_NAME OWNER TO $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
\q
EOF

echo "✅ Database created: $DB_NAME"
echo "✅ Database user created: $DB_USER"
echo "⚠️  Database password: $DB_PASSWORD (save this!)"

# Create .env file template
echo "📝 Creating .env file template..."
cat > $APP_DIR/.env << EOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?schema=public"
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NODE_ENV=production
TZ=America/New_York
EOF

echo "✅ .env file created at $APP_DIR/.env"
echo ""
echo "✅ Server setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Upload your application files to: $APP_DIR"
echo "2. cd $APP_DIR"
echo "3. npm install --production"
echo "4. npx prisma generate"
echo "5. npx prisma db push"
echo "6. npm run create-admin admin@example.com Admin@12345!"
echo "7. npm run build"
echo "8. pm2 start deploy/pm2.config.js"
echo ""
echo "📋 Database credentials:"
echo "   User: $DB_USER"
echo "   Password: $DB_PASSWORD"
echo "   Database: $DB_NAME"
