#!/bin/bash
echo "=== env files in scheduling ==="
find /var/www/aplus/aplus-center-scheduling -name ".env*" -not -path "*/node_modules/*" 2>/dev/null

echo "=== scheduling server processes ==="
pm2 list

echo "=== postgres tables in aba_db ==="
psql "postgresql://aba_user:abapass123@localhost:5432/aba_db" -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename" 2>&1
