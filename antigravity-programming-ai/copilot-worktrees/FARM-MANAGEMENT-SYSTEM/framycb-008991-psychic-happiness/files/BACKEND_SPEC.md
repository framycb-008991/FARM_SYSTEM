# Backend Specification — Tzu Chi Moçambique Farm Management System

## 1. Overview

A role-based farm management backend serving four distinct interfaces (Top Management, Farm
Technicians, Production Manager, Administration), with authentication built around **employee
number + PIN** instead of email, and **SMS OTP** as a mandatory second factor on every login.
Must support **offline data capture** from field technicians in low-connectivity rural areas.

**Recommended stack:**
- **Runtime:** Node.js (TypeScript)
- **Framework:** NestJS (or Express if you want something lighter — NestJS gives you built-in
  structure for RBAC, modules, and guards, which this project needs)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Auth tokens:** JWT (short-lived access token + refresh token)
- **SMS/OTP provider:** Twilio (Verify API handles OTP generation/expiry/retry natively —
  don't hand-roll OTP logic). Alternative: Vonage. Confirm coverage/pricing for Mozambique
  (+258) numbers before committing.
- **File/photo storage:** S3-compatible object storage (for field photos technicians attach
  to reports)
- **Background jobs:** BullMQ (Redis-backed) — for OTP expiry cleanup, sync conflict
  processing, scheduled report generation

---

## 2. Authentication & Identity

### 2.1 Identity model
- **Primary identifier:** Employee Number (e.g. `TZ11244043`) — unique, human-assigned,
  format: 2-letter org prefix + 8 digits. Validate format server-side but keep it configurable
  (don't hardcode the regex in business logic — store the pattern in config).
- **Phone number:** required at first-time signup, stored in E.164 format (e.g.
  `+258821234567`). This is the OTP delivery channel — verify it via OTP at signup before the
  account is activated.
- **PIN/password:** set at first-time signup (first factor). Recommend a numeric PIN (4–6
  digits) rather than a complex password — easier for field staff on basic phones/low literacy
  contexts, but hash it with the same rigor as a password (bcrypt/argon2, never store plain).

### 2.2 First-time signup flow (admin-provisioned, not self-service)
Employee accounts should be **created by an Administrator** (this is an internal workforce
tool, not public signup) with employee number + name + role + phone number pre-filled. The
employee's first login then becomes an **activation flow**:

1. Employee enters their Employee Number + the temporary PIN given to them by admin (or a
   claim code)
2. System sends OTP via SMS to the phone number on file
3. Employee enters OTP → verified → prompted to set their permanent PIN
4. Account status moves from `pending` → `active`

### 2.3 Every-login flow
1. `POST /auth/login` — employee number + PIN
2. If valid → generate OTP, send via SMS, return a short-lived `login_challenge_id`
3. `POST /auth/verify-otp` — `login_challenge_id` + OTP code
4. If valid → issue JWT access token (short expiry, e.g. 15 min) + refresh token (e.g. 7 days,
   stored httpOnly)
5. Rate-limit both steps (e.g. 5 attempts per 15 min per employee number) to prevent brute
   force; lock account after repeated failures and require admin unlock

### 2.4 Security notes
- OTP codes: 6 digits, expire in 5 minutes, single-use, invalidate previous OTP when a new one
  is requested
- Never log OTP codes or PINs in plaintext anywhere (application logs, error trackers)
- All endpoints behind TLS only
- Refresh tokens revocable server-side (store a token version/blacklist so admin can force
  logout a compromised device)

---

## 3. Roles & Access Control (RBAC)

Four roles, each mapped to one interface:

| Role | Interface | Core permissions |
|---|---|---|
| `top_management` | Reports Dashboard | Read-only access to aggregated reports, KPIs, trends across all farms. No write access to operational data. |
| `farm_technician` | Field Data Entry | Create/edit their own field reports (planting, crop health, harvest counts, issues, photos). No access to other technicians' raw data beyond their assigned fields. |
| `production_manager` | Production Console | Read all technician submissions, approve/flag entries, manage crop cycles, allocate fields/tasks to technicians, generate production reports. |
| `administrator` | Admin Panel | User/employee management (create/deactivate accounts, reset PINs, assign roles/fields), system configuration, audit logs, full read access. |

- Enforce via a `roles` + `permissions` table (not hardcoded role checks scattered in code) —
  gives you flexibility to add e.g. a "regional supervisor" role later without a rewrite.
- Every write action must be attributable to a user (audit trail — see §6).

---

## 4. Core Data Model (high level)

```
Employee
  id, employee_number (unique), full_name, phone_number, pin_hash,
  role_id, status (pending/active/suspended), assigned_field_ids[],
  created_by, created_at

Role
  id, name, description

OtpChallenge
  id, employee_id, code_hash, purpose (signup|login), expires_at,
  attempts, consumed_at

Field
  id, name, location (lat/lng or region), area_hectares, crop_type,
  assigned_technician_ids[]

CropCycle
  id, field_id, planting_date, expected_harvest_date, status,
  production_manager_id

FieldReport                          -- technician-submitted data
  id, field_id, technician_id, report_type (planting|inspection|harvest|issue),
  data (structured JSON: e.g. quantity_kg, health_notes, pest_flag),
  photo_urls[], submitted_at, sync_status (synced|pending),
  client_generated_id (for offline dedup — see §5), reviewed_by, reviewed_at

ProductionSummary                    -- aggregated, generated for management/reports
  id, period, field_id, total_yield_kg, notes, generated_at

AuditLog
  id, actor_employee_id, action, target_entity, target_id, metadata, created_at
```

---

## 5. Offline Support (Farm Technician interface)

Because technicians work in low/no-connectivity areas, the technician-facing API must support
**offline-first sync**, not just a normal CRUD API:

- **Client-generated IDs:** the frontend generates a UUID for each report *before* it has
  network access. The backend uses this as an idempotency key so retried syncs never create
  duplicates.
- **Sync endpoint:** `POST /sync/field-reports` accepts a **batch** of queued reports (created
  possibly hours/days earlier while offline), each with its client-generated ID and a local
  timestamp. Backend upserts by client ID, returns per-item success/conflict status.
- **Conflict handling:** conflicts here are rare (each technician owns their own reports) but
  handle the case where the same client ID is submitted twice (return "already synced," not an
  error).
- **Photo sync:** photos captured offline are queued locally and uploaded once connectivity
  returns; report record can reference a temporary local photo ID until upload completes, then
  the backend confirms and returns the permanent URL.
- **Sync status visibility:** every report has a `sync_status` field so the frontend can show
  the technician what's synced vs. still pending — critical for trust in the system.

---

## 6. Reporting & Aggregation (Top Management interface)

- Precompute aggregates (don't make the Reports dashboard run heavy queries live against raw
  `FieldReport` data on every load) — run a scheduled job (daily) that rolls up
  `FieldReport` → `ProductionSummary`.
- Expose read endpoints like `GET /reports/summary?period=&field_id=&crop_type=` returning
  pre-aggregated KPIs: total yield, yield trend, active fields, flagged issues count.
- Top Management role should never be able to write — keep this enforced at the API layer, not
  just hidden in the UI.

---

## 7. Audit Logging

Every account creation, role change, PIN reset, data approval/rejection, and login (success and
failure) should write to `AuditLog`. This matters for an organization managing donor-funded
agricultural work — Administration will likely need this for accountability/reporting to the
foundation.

---

## 8. API Surface (representative, not exhaustive)

```
POST   /auth/login                      employee_number + pin -> challenge_id
POST   /auth/verify-otp                 challenge_id + otp -> tokens
POST   /auth/refresh                    refresh_token -> new access token
POST   /auth/logout

POST   /employees                       [admin] create employee (provisioning)
GET    /employees                       [admin] list/search
PATCH  /employees/:id                   [admin] update role/status/field assignment
POST   /employees/:id/reset-pin         [admin]

GET    /fields                          [technician: own; manager/admin: all]
POST   /field-reports                   [technician] single online submission
POST   /sync/field-reports              [technician] batch offline sync
GET    /field-reports                   [manager] review queue
PATCH  /field-reports/:id/review        [manager] approve/flag

GET    /reports/summary                 [top_management]
GET    /reports/trends                  [top_management]

GET    /audit-logs                      [admin]
```

---

## 9. Non-functional requirements

- **Low bandwidth tolerance:** paginate all list endpoints, keep payloads lean (no
  over-fetching), support gzip compression
- **Timezone/locale:** store timestamps in UTC, format for Mozambique locale (CAT, UTC+2) at
  the edge
- **Localization-ready:** API error messages/codes should be translatable keys, not hardcoded
  English strings, since field staff may be more comfortable in Portuguese
- **Backups:** daily automated PostgreSQL backups given this is operational + donor-reportable
  data
