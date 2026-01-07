#!/bin/bash

# A Plus Center - Deployment Verification Script
# Run this on the server after deployment to verify everything is working

set -e

echo "🔍 Verifying A Plus Center deployment..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if PM2 is running
echo -e "\n${YELLOW}Checking PM2 status...${NC}"
if pm2 list | grep -q "aplus-center"; then
    echo -e "${GREEN}✅ PM2 process found${NC}"
    pm2 status
else
    echo -e "${RED}❌ PM2 process not found${NC}"
    exit 1
fi

# Check if application is responding
echo -e "\n${YELLOW}Checking application health...${NC}"
if curl -f -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✅ Application is responding on port 3000${NC}"
else
    echo -e "${RED}❌ Application is not responding on port 3000${NC}"
    echo "Check logs: pm2 logs aplus-center"
    exit 1
fi

# Check database connection
echo -e "\n${YELLOW}Checking database connection...${NC}"
if [ -f .env ]; then
    source .env
    if sudo -u postgres psql -d apluscenter -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database connection successful${NC}"
    else
        echo -e "${RED}❌ Database connection failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  .env file not found, skipping database check${NC}"
fi

# Check Prisma Client
echo -e "\n${YELLOW}Checking Prisma Client...${NC}"
if [ -d "node_modules/.prisma/client" ]; then
    echo -e "${GREEN}✅ Prisma Client is generated${NC}"
else
    echo -e "${YELLOW}⚠️  Prisma Client not found, run: npx prisma generate${NC}"
fi

# Check nginx
echo -e "\n${YELLOW}Checking nginx...${NC}"
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx is running${NC}"
    if nginx -t > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Nginx configuration is valid${NC}"
    else
        echo -e "${RED}❌ Nginx configuration has errors${NC}"
        nginx -t
    fi
else
    echo -e "${YELLOW}⚠️  Nginx is not running${NC}"
fi

# Check logs directory
echo -e "\n${YELLOW}Checking log directory...${NC}"
if [ -d "/var/log/aplus-center" ]; then
    echo -e "${GREEN}✅ Log directory exists${NC}"
else
    echo -e "${YELLOW}⚠️  Log directory missing, creating...${NC}"
    mkdir -p /var/log/aplus-center
    chown -R www-data:www-data /var/log/aplus-center
fi

# Check environment variables
echo -e "\n${YELLOW}Checking critical environment variables...${NC}"
if [ -f .env ]; then
    if grep -q "DATABASE_URL=" .env && grep -q "NEXTAUTH_SECRET=" .env; then
        echo -e "${GREEN}✅ Critical environment variables are set${NC}"
    else
        echo -e "${RED}❌ Missing critical environment variables${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ .env file not found${NC}"
    exit 1
fi

# Check cron jobs initialization
echo -e "\n${YELLOW}Checking cron jobs...${NC}"
if pm2 logs aplus-center --lines 20 | grep -q "Cron jobs"; then
    echo -e "${GREEN}✅ Cron jobs initialized${NC}"
else
    echo -e "${YELLOW}⚠️  Cron jobs may not be initialized, check logs${NC}"
fi

echo -e "\n${GREEN}✅ Deployment verification complete!${NC}"
echo -e "\nNext steps:"
echo "1. Access the application at http://66.94.105.43 (or your domain)"
echo "2. Login with admin credentials"
echo "3. Test creating a provider, client, and timesheet"
echo "4. Monitor logs: pm2 logs aplus-center"
