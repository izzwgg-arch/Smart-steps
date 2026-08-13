#!/bin/bash
# Check the scheduling server source for DB config
grep -r "DATABASE_URL\|DB_HOST\|DB_NAME\|postgres" /var/www/aplus/aplus-center-scheduling/server/src/config/ 2>/dev/null
echo "---ecosystem---"
cat /var/www/aplus/aplus-center-scheduling/ecosystem.config.js 2>/dev/null
