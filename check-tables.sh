#!/bin/bash
psql "postgresql://aba_user:abapass123@localhost:5432/aba_db" <<'SQL'
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
SQL