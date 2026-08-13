#!/bin/bash
echo "=== Process env for port 4000 node ==="
cat /proc/1169107/environ | tr '\0' '\n' | grep -E "DATABASE|DB_|POSTGRES"
echo "=== All env vars ==="
cat /proc/1169107/environ | tr '\0' '\n' | grep -v "^PATH\|^HOME\|^USER\|^SHELL\|^TERM"
