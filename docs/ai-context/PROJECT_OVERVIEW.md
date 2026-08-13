# Project Overview

## What This Repo Contains

This workspace contains multiple related apps:

- `a-plus-center` root app: Next.js 14 app. Root `package.json` describes it as an "ABA Timesheet, Analytics & Insurance Invoicing Platform". Root `app/layout.tsx` metadata uses `Smart Steps - ABA Management Platform`.
- `aplus-center-scheduling`: production-oriented A Plus scheduling/admin app with React + Vite client, Express server, Prisma, PostgreSQL, JWT auth, reminders, billing, payments, QuickBooks, client files, and operational pages.
- `aplus-center-scheduling/smart-steps`: SmartSteps ABA tracker, Next.js 16 app with App Router, NextAuth v5 beta, Prisma/Postgres, clients, programs/goals/targets, sessions, assessments, reports, and parent portal.
- `smart-steps-android` and `smart-steps-android-backup`: React Native / Expo mobile app folders.

## A Plus Center App

Evidence points to a clinic scheduling/admin system:
- Client management.
- Providers/services.
- Calendar appointments and recurrence.
- Appointment completion and invoice generation.
- Billing, invoices, payments, receipts.
- QuickBooks, Payment Hub, Sola Payments, Google Workspace, VoIP.ms integrations.
- Client file manager with default document folders.
- Users, settings, audit logs, reminders, reports, dashboard.

Primary paths:
- Server: `aplus-center-scheduling/server`.
- Client: `aplus-center-scheduling/client`.
- Prisma schema: `aplus-center-scheduling/server/prisma/schema.prisma`.

## SmartSteps ABA

Evidence points to an ABA tracker:
- Clients and assignments.
- Programs, parent goals, subgoals, targets.
- Sessions, trials, behavior events, interval recordings.
- Goal analytics and raw data APIs.
- Skill assessments and narrative report templates.
- Parent read-only token portal.
- Offline-first local store with Zustand/Dexie.

Primary path:
- `aplus-center-scheduling/smart-steps`.

## Payroll / Timesheets

Root `package.json` mentions timesheets. In `aplus-center-scheduling`, static search found no payroll, timesheet, or fingerprint scanner implementation.

Status:
- A Plus scheduling app payroll/timesheet implementation: `UNKNOWN — verify before changing.`
- Root app payroll/timesheet implementation: likely present in root app based on package description, but not fully mapped in this pass.

## Critical Principle

Do not assume one app owns all functionality. The repo has overlapping product names and nested apps. Identify exact app and route before edits.
