-- Verify Payroll Tables
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'Payroll%' 
ORDER BY tablename;

-- Verify Enums
SELECT typname 
FROM pg_type 
WHERE typname LIKE 'Payroll%' 
ORDER BY typname;
