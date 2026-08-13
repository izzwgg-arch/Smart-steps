#!/bin/bash
# Check aba_db for Invoice table
echo "=== Checking aba_db ==="
psql "postgresql://aba_user:abapass123@localhost:5432/aba_db" -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename" 2>&1 | grep -i invoice || echo "(no Invoice table in aba_db)"

# Check postgres for other users
echo "=== All postgres roles ==="
sudo -u postgres psql -t -c "SELECT rolname FROM pg_roles WHERE rolcanlogin ORDER BY rolname" 2>&1

echo "=== All databases ==="
sudo -u postgres psql -t -c "SELECT datname FROM pg_database WHERE datistemplate=false" 2>&1
