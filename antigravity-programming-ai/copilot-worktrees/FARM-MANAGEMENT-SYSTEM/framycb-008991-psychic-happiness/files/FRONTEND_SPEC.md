# Frontend Specification — Tzu Chi Moçambique Farm Management System

> Apply `DESIGN_SYSTEM.md` (colors, typography, navbar, cashew-leaf brand motif) to every
> screen described here. This file defines structure and behavior; that file defines look.

## 1. Overview

**Stack:** React + Next.js (TypeScript), Tailwind CSS (maps cleanly to the design tokens in
`DESIGN_SYSTEM.md`), PWA support (`next-pwa` or Workbox) for offline capability on the
Technician interface.

**Four role-based interfaces, one codebase**, gated by the authenticated user's role after
login — not four separate apps. Shared: login/OTP flow, main navbar, design system.

```
/login                     -- employee number + PIN
/verify-otp                -- OTP entry
/dashboard/management       -- Top Management
/dashboard/technician       -- Farm Technician
/dashboard/production       -- Production Manager
/dashboard/admin             -- Administration
```

Route guard: after login, redirect to the dashboard matching the user's role. A user should
never be able to navigate into another role's route (server-enforced via API too, per backend
spec §3 — frontend guard is UX, not the security boundary).

---

## 2. Shared: Authentication Flow

### Screen: Login
- Two fields: **Employee Number** (e.g. `TZ11244043`) and **PIN** (numeric input, masked)
- No "email" field anywhere in this flow
- Helper text under the PIN field: "Forgot your PIN? Contact your administrator" (PIN resets
  are admin-driven, not self-service email links — there's no email in this system)
- On submit → navigate to OTP screen, show which phone number (masked, e.g.
  `+258 82 *** 4567`) the code was sent to

### Screen: Verify OTP
- 6-digit code input (auto-advance per digit, numeric keypad on mobile)
- "Resend code" with a 30–60s cooldown timer
- Clear error state for expired/invalid code, with attempts remaining shown
- On success → issue tokens, redirect to role dashboard

### First-time activation (admin-provisioned account)
- Same login screen, but a `pending` account status triggers an activation variant: after OTP
  verification, show a **"Set your PIN"** screen (enter new PIN twice) before entering the
  dashboard. One-time only.

---

## 3. Shared: Main Navigation Bar
Per `DESIGN_SYSTEM.md` §7 — Tzu Chi logo + app name left, role-appropriate nav pills center,
notifications/profile right. Nav pill items differ per role (see each interface below).

---

## 4. Interface 1 — Top Management (Reports)

**Goal:** fast, visual, read-only insight. No data entry. Should look like an executive
dashboard, not an operational tool.

**Nav items:** Overview · Yield Reports · Trends · Fields

**Key screens:**
- **Overview:** KPI cards (total active fields, total yield this period, flagged issues count,
  active technicians) using the dark-green summary band pattern from the design system, above
  white content
- **Yield Reports:** filterable table/chart (by field, crop cycle, period) — chart color
  palette = primary green + accent orange per design system
- **Trends:** time-series chart of yield over time, exportable (PDF/CSV) for donor reporting
- **Fields:** map or list view of all fields with status badges (on-track / attention-needed)

**Explicitly excluded:** no edit/delete controls anywhere in this interface — enforce this in
the UI (hide, don't just disable) since this role has no write permission on the backend.

---

## 5. Interface 2 — Farm Technician (Field Data Entry)

**Goal:** fast, simple, thumb-friendly data entry that works with no signal. This is the most
operationally different interface — treat it closer to a mobile app than a desktop dashboard.

**Nav items:** My Fields · New Report · Sync Status

**Key screens:**
- **My Fields:** list of fields assigned to this technician only
- **New Report:** a short form per report type (Planting / Inspection / Harvest / Issue) —
  large touch targets, minimal typing (prefer steppers/toggles/photo capture over free text
  where possible), camera capture for field photos
- **Sync Status:** a visible, honest indicator of what's saved locally vs. synced to server —
  e.g. a badge per report: "Saved on device" (gray clock icon) vs "Synced" (green check).
  This is not cosmetic — field staff need to trust the app isn't silently losing their work.

**Offline behavior (critical):**
- Form submissions save immediately to local storage (IndexedDB) with a client-generated ID,
  regardless of connectivity
- A background sync process pushes queued reports to `POST /sync/field-reports` (per backend
  spec §5) whenever connectivity is detected
- Show a persistent, unobtrusive connectivity indicator (not a blocking banner) — e.g. small
  dot in the navbar: green = online & synced, amber = offline with pending items
- Never block the technician from creating a new report because they're offline — that
  defeats the purpose

---

## 6. Interface 3 — Production Manager

**Goal:** operational oversight — review technician submissions, manage crop cycles, allocate
work.

**Nav items:** Review Queue · Crop Cycles · Field Assignments · Reports

**Key screens:**
- **Review Queue:** list of submitted technician reports pending review, approve/flag actions,
  filter by field/technician/date
- **Crop Cycles:** create/manage planting-to-harvest cycles per field, set expected harvest
  dates
- **Field Assignments:** assign technicians to fields (drag-and-drop or simple select list)
- **Reports:** production-level reports (narrower scope than Top Management's org-wide view —
  this role sees operational detail, e.g. per-technician submission quality/timeliness)

---

## 7. Interface 4 — Administration

**Goal:** system and workforce management. This is where employee accounts, roles, and system
integrity live.

**Nav items:** Employees · Roles & Fields · Audit Log · Settings

**Key screens:**
- **Employees:** create employee (employee number auto-suggested or entered, name, phone
  number, role, temp PIN generation), list/search/deactivate, reset PIN (triggers a new
  temp-PIN + forces re-activation flow on next login)
- **Roles & Fields:** assign roles, manage field metadata (name, location, crop type)
- **Audit Log:** searchable/filterable log per backend spec §7 — who did what, when (logins,
  approvals, PIN resets, role changes)
- **Settings:** org-level config (e.g. OTP expiry window, session timeout) if you want these
  admin-configurable rather than hardcoded

---

## 8. Accessibility & Field-Usability Notes

- Farm Technician interface should be tested on low-end Android devices and in bright outdoor
  sunlight conditions in mind — high contrast, large tap targets (min 44px), avoid thin
  low-contrast text
- Support Portuguese as the primary language (confirm with the team — Mozambique's official
  language) with English as a secondary option if needed for management/donor reporting;
  don't hardcode English strings, use an i18n library (e.g. `next-intl`) from the start
- All forms need clear inline validation — technicians in the field won't have patience for a
  form that silently fails on submit

---

## 9. Component Reuse Across Interfaces

Build once, reuse across all four dashboards:
- `<StatusBadge />` (synced/pending, on-track/attention, approved/flagged)
- `<KpiCard />` (used in both Top Management and Production Manager)
- `<DataTable />` (sortable, filterable — reports, employees, audit log all use this)
- `<RoleGuardedRoute />` wrapper
- `<OtpInput />`, `<PinInput />`
