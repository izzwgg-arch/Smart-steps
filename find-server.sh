#!/bin/bash
echo "=== nginx sites ==="
ls /etc/nginx/sites-enabled/ 2>/dev/null
echo "=== all pm2 processes (all users) ==="
pm2 list
echo "=== processes on port 4000 ==="
ss -tlnp 2>/dev/null | grep 4000
echo "=== scheduling server env file ==="
find /var/www/aplus/aplus-center-scheduling/server -name ".env*" 2>/dev/null
cat /var/www/aplus/aplus-center-scheduling/server/.env 2>/dev/null
