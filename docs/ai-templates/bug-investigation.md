# Bug Investigation Template

Use for defects, crashes, wrong data, or regressions.

1. Read `docs/ai-context/CURSOR_START_HERE.md`.
2. Identify app boundary and user-visible route.
3. Read only relevant docs:
   - `DEBUGGING.md`
   - domain doc for affected area
   - `DATA_MODEL.md` if data-backed
4. Reproduce or trace exact failing flow.
5. Identify:
   - UI file
   - API route
   - service/helper
   - Prisma model
   - integration/webhook if any
6. Do not code until root cause is stated.
7. If unclear, write `UNKNOWN — verify before changing`.

Risk defaults:
- UI crash: medium unless billing/auth/files/payroll/scheduling.
- Data leak/payment/payroll/auth: high/extreme.
