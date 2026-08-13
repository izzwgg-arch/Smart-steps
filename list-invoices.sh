#!/bin/bash
DB="postgresql://aba_user:abapass123@127.0.0.1:5432/aba_db"
psql "$DB" -c 'SELECT "invoiceNumber", "createdAt" FROM aplus_sched."Invoice" ORDER BY "createdAt" ASC' 2>&1
