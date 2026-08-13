# UI Redesign Template

Use for visual or layout changes.

1. Confirm this is UI-only.
2. Read:
   - `CURSOR_START_HERE.md`
   - `SAFE_CHANGE_ZONES.md`
   - affected domain doc if page is high-risk.
3. Identify exact page/component.
4. Do not change data fetching, auth checks, API payloads, billing calculations, or form submission behavior unless requested.
5. Preserve existing route paths and event handlers.
6. Run relevant client build.

If the redesign touches billing, scheduling, client files, payroll, permissions, or QuickBooks, reclassify as high risk.
