#!/bin/bash
echo "=== Process 1169107 env (DATABASE_URL) ==="
cat /proc/1169107/environ 2>/dev/null | tr '\0' '\n' | grep -i database
echo "=== Process 1169107 cmdline ==="
cat /proc/1169107/cmdline 2>/dev/null | tr '\0' ' '
echo ""
echo "=== nginx aplus-center config ==="
cat /etc/nginx/sites-enabled/aplus-center 2>/dev/null | head -40
