#!/bin/bash
echo "=== server .env ==="
cat /var/www/aplus/aplus-center-scheduling/server/.env 2>/dev/null | grep DATABASE
echo "=== root .env ==="
cat /var/www/aplus/aplus-center-scheduling/.env 2>/dev/null | grep DATABASE
echo "=== check Invoice table in aba_db ==="
psql "postgresql://aba_user:abapass123@localhost:5432/aba_db" -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public'" 2>&1 | grep -i invoice
echo "done"
