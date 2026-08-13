#!/bin/bash
DB="postgresql://aba_user:abapass123@127.0.0.1:5432/aba_db"

echo "=== Invoice count ==="
psql "$DB" -t -c "SELECT COUNT(*) FROM aplus_sched.\"Invoice\"" 2>&1

echo "=== Sample invoice numbers ==="
psql "$DB" -t -c "SELECT \"invoiceNumber\", \"createdAt\" FROM aplus_sched.\"Invoice\" ORDER BY \"createdAt\" ASC LIMIT 20" 2>&1
