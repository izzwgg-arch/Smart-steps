#!/bin/bash
echo "=== /opt/aba contents ==="
ls /opt/aba/
echo "=== .env file ==="
cat /opt/aba/.env 2>/dev/null
echo "=== ecosystem.config.js ==="
cat /opt/aba/ecosystem.config.js 2>/dev/null
echo "=== Invoice table check ==="
DB=$(grep DATABASE_URL /opt/aba/.env 2>/dev/null | cut -d= -f2-)
if [ -n "$DB" ]; then
  psql "$DB" -t -c "SELECT COUNT(*) FROM \"Invoice\"" 2>&1
fi
