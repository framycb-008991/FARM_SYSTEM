# Farm Daily Production & Administration Management System

**Client & Institution:** Fundação de Caridade Tzu Chi Moçambique — Unidade Produtiva de Mecuzi
**Project:** Farm Management Software for the Unidade Produtiva de Mecuzi
**Type:** Cashew orchard farm, up to 200 hectares
**Source of truth:** Derived from the farm's SOP manual *"Manual de Procedimentos Operacionais Normalizados"* (PON-AGR-MEC-V2.0)
**Version:** 1.0
**Audience of this document:** An AI coding agent (or human dev team) building this system from scratch. Treat every rule in this document as a hard functional requirement unless marked "optional" or "recommended."

---

## 0. How to Use This Document

This README is the single source of truth for what to build. It is organized so you can build module-by-module:

1. Read Section 1–3 first to understand context, architecture, and roles — do not skip these, since almost every module depends on the role model in Section 4.
2. Build the data model in Section 8 first (or alongside your first module), since every module below references these entities.
3. Each module in Sections 5 and 6 is self-contained: purpose, fields, validation rules, roles, and outputs. Implement fields and validation rules exactly as written — they come directly from an operating SOP that a real organization depends on for compliance and accountability.
4. Do not invent additional business rules not stated here. Where something is ambiguous, prefer the simplest implementation consistent with the stated rule, and leave a `// TODO: confirm with stakeholder` comment rather than guessing at farm policy.
5. See `ROLE.md` (companion file) for the persona/operating instructions you should hold while building this.

---

## 1. Project Context

The farm ("Unidade Produtiva de Mecuzi") operates under a **self-management model with financial oversight** by a parent Foundation. The farm prepares and submits monthly budgets for central approval; the Foundation supplies resources; the farm is responsible for execution, monitoring, and accountability. This relationship drives many deadlines and approval chains below — they are not arbitrary and must be preserved.

### 1.1 Physical & Organizational Profile

| Attribute | Value |
|---|---|
| Total farmed area | Up to 200 hectares, cashew orchard |
| Production Points | 3 Points (A, B, C), each with dormitory, sanitation facilities, water supply |
| Permanent employees | 33, working 2 consecutive weeks on-site followed by 2 days off |
| Tractors / mechanized equipment | 2 to 3 tractors |
| Water boreholes | 6 total — 2 per Production Point (1 operational + 1 reserve/expansion), each with a flow meter read weekly |
| Central Operational Centre | Located at Point B: main office, central warehouse, kitchen, dormitories, drying area |
| Central warehouse | ≈ 800 m², stores agricultural inputs and finished/processed product |
| Drying area | ≈ 600 m², shared across multiple crops on a rotation calendar |
| Kitchen | Indoor gas kitchen (daily use) + outdoor wood-fired kitchen (high-volume days); 3 meals/day for permanent staff |
| Fuel storage | 5 × 20 L drums (100 L total); planned upgrade to a 500 L tank with locked pump and mechanical meter |
| Power | Primarily solar; diesel generator used as backup only |
| Time & attendance | Biometric time clock located at Point B (main office) |
| CFW workforce | Seasonal/temporary labour paid per verified productivity target, budget-controlled monthly |
| System languages | Trilingual UI — English (UK), Portuguese (Mozambique), and Traditional Chinese (Taiwan); Portuguese (Mozambique) is the operational default, English (UK) and Traditional Chinese (Taiwan) are required for institutional/Foundation reporting |

### 1.2 Scope

Build **two integrated sides**:

- **Administration Side** — attendance & workforce, Cash-for-Work (CFW) programme, water/fuel/energy logs, kitchen & food stock, warehouse & inventory, drying area, waste, budgeting, maintenance, first aid, institutional reporting.
- **Production Side** — annual production planning, field/area activity tracking across the three Production Points, tractor & mechanization management, KPI/performance evaluation, harvest and post-harvest handling.

Both sides share a common employee, farm-structure, and reporting backbone (Section 8).

### 1.3 Key Abbreviations

| Term | Meaning |
|---|---|
| PAP | Plano Anual de Produção — Annual Production Plan |
| CFW | Cash-for-Work — temporary/seasonal paid labour programme |
| SOP / PON | Standard Operating Procedures manual (source document) |
| Ponto A/B/C | Production Point A, B, or C |
| Comissionário/a | Point supervisor / crew lead for a Production Point |
| KPI | Key Performance Indicator, scored per role each evaluation cycle |
| N1–N7 | Organizational hierarchy levels, N1 = Top Manager, N7 = Field Worker |

---

## 2. System Architecture

### 2.1 Two-Module Structure

- **Administration Module** — primary users: Admin Manager (N3) and three functional units under them (Finance & Compliance, Operations Support, Human & Facility Services).
- **Production Module** — primary users: Production Manager (N3), Agricultural Technicians (N5, one per Production Point), Tractor Operator (N6).

Both feed a shared **Reporting & KPI Engine** used by the Farm Coordinator (N2) and Top Manager (N1) for oversight, and by the Foundation for external accountability.

### 2.2 Deployment Model

- Central server / cloud-hosted application, primary access from the main office at Point B (assume fixed connectivity there).
- **Offline-first mobile data capture** for Production Points and field roles — rural/intermittent connectivity is the norm, not the exception. Local storage with automatic background sync when connectivity resumes. This is a hard requirement, not a nice-to-have.
- Lightweight mobile UI for Technicians, Tractor Operator, Comissionários, and CFW attendance capture — optimized for low bandwidth and minimal typing (pick-lists, numeric pads, camera capture, GPS auto-tag over free text wherever possible).
- Fuller desktop/web UI for Admin Manager, Production Manager, Farm Coordinator, and Top Manager — reporting, budgeting, approvals.

### 2.3 External Interfaces

- **Biometric time clock** at Point B — daily import/sync of clock-in/clock-out events into Attendance. Build an abstraction layer (adapter pattern) since the exact hardware/API is not yet specified — assume CSV/file import as the baseline integration, with a pluggable interface for a future direct API integration.
- **Export**: Word, Excel, and PowerPoint for the Monthly Admin Report package (must match the Foundation's required submission format — Word narrative + Excel data + PowerPoint summary).
- **Email + WhatsApp-shareable export** (PDF/image) for the Weekly Report.
- **Traditional Chinese (Taiwan) export**, and **English (UK) export**, of monthly production/administration reports for the Farm Coordinator's institutional reporting to the Foundation.

### 2.4 Suggested Technology Approach (recommendation, not mandate)

Given the offline-first mobile requirement and the need for a role-based admin backend with rich reporting/export:

- **Backend**: REST or GraphQL API with a relational database (PostgreSQL recommended) modeling the entities in Section 8.
- **Mobile/field client**: offline-capable framework (e.g., React Native, Flutter, or a PWA with local storage + background sync) — pick one, but the offline-sync requirement is non-negotiable regardless of framework.
- **Web admin client**: any modern web framework, standard role-based routing.
- **File exports**: server-side generation of .docx/.xlsx/.pptx (or equivalent) matching Section 5's monthly report package.
- **Auth**: role-based access control (RBAC) matching Section 4 exactly — do not build a generic "admin/user" binary model.

If the target platform, hosting, or team's stack is already decided elsewhere, defer to that — this section is guidance for an otherwise-unconstrained build.

---

## 3. Design Principles to Follow

1. **Every deadline, threshold, and approval chain in this document is a real operational constraint the farm already lives by.** Do not soften, generalize, or "improve" them without flagging the change.
2. **Offline resilience over cleverness.** Field roles work in low-connectivity conditions; never block data capture on a live connection.
3. **Locked fields stay locked.** Some data (e.g., CFW pay rates) is explicitly owned by an external party (the Foundation) and must not be editable by farm-level roles in the UI, even by senior farm roles.
4. **Every register needs an audit trail.** Who entered it, when, and any subsequent edits — this replaces the SOP's dual-signature paper controls.
5. **Roles see only what their SOP role would see**, with escalation visibility upward (a supervisor can see their reports' data; a subordinate cannot see their supervisor's approvals-in-progress unless the SOP says otherwise).

---

## 4. User Roles & Permissions

| Level | Role | Module Access | Typical Permission |
|---|---|---|---|
| N1 | Top Manager | Admin + Production (read/oversight), KPI, Strategic Plan | View all; approve annual plan; approve strategic decisions |
| N2 | Farm Coordinator | Admin + Production (full oversight) | View all; approve budget/KPI escalations; sign off monthly reports |
| N3 | Production Manager | Production (full) | Create/edit production data; approve field-level requests; submit reports |
| N3 | Admin Manager | Administration (full) | Create/edit admin data; approve CFW/budget submissions; submit reports |
| N5 | Agricultural Technician | Production (own Production Point only) | Enter field activity, water readings, CFW supervision; request inputs |
| N5 | Finance & Compliance Officer | Administration — Finance | Enter/approve payments; budget tracking; stock valuation |
| N5 | Operations Support Officer | Administration — Warehouse & Logistics | Warehouse in/out; transport logistics; post-harvest; water consolidation |
| N5 | Human & Facility Services Officer | Administration — Welfare & Facilities | Kitchen/food stock; hygiene checklists; first aid; welfare notes |
| N6 | Tractor Operator | Production — Mechanization | Daily equipment log; pre-op checklist; weekly usage schedule |
| N6 | Truck Driver | Administration — Logistics | Trip log; vehicle checks |
| N7 | Warehouse/Stores Assistant | Administration — Warehouse (data entry) | Record stock in/out; physical counts |
| N7 | Field Worker / Cook / Cleaner | Mobile — task acknowledgement only | View assigned tasks; confirm completion (no admin access) |

**Escalation rule:** If a request or approval is outside a role's authority (per the SOP), the system must route it to the next level up, not silently reject it.

---

## 5. Administration Module — Functional Specifications

Each sub-module below corresponds to a register/process in the SOP, identified by its original form code where one exists. Build each as a distinct feature area with its own entry form, list/history view, validation, and report output.

### 5.1 `ADM-ATT-01` — Attendance & Workforce Rotation

**Purpose:** Digitizes the daily attendance panel and the permanent-staff rotation calendar (2 weeks on-site / 2 days off).

**Fields:**
- Employee ID, name, role, Production Point/unit
- Clock-in / clock-out timestamps (from biometric device import or manual fallback)
- Status: present, absent, on rotation leave (folga), on mission, medical leave, annual leave
- Rotation cycle calendar per employee (14 days on / 2 days off), auto-generated/updated monthly

**Business rules:**
- No Production Point may have its Technician and Comissionário on leave at the same time — block the leave submission and show the conflict.
- Sick leave of 3+ consecutive days requires an attached medical certificate (file upload) before approval.
- Leave requests require minimum 2 weeks' notice, except requests flagged as emergencies.
- Leave requests route to the Admin Manager for approval.
- If the Admin Manager is absent, the Farm Coordinator must be able to designate a temporary substitute with full Admin Manager permissions for the duration.

**Roles:** Entry — Admin Manager (biometric import) / employee self-service for leave requests. Approval — Admin Manager, escalated conflicts to Farm Coordinator.

**Outputs:** Daily attendance dashboard; monthly attendance summary (days worked, absences, leave, sick leave per person) feeding the Monthly Admin Report.

---

### 5.2 `ADM-WTR-01` — Water Borehole Monitoring

**Purpose:** Weekly flow-meter readings for all 6 boreholes (2 per Production Point), with automatic anomaly detection.

**Fields:**
- Production Point & borehole ID (operational / reserve)
- Meter reading value, reading date/time
- Reader (Agricultural Technician)
- Calculated weekly consumption (delta from previous reading)

**Business rules:**
- Reading due every **Monday**; Technician submits by **08:30**, consolidated by Operations Support by **12:00**.
- Auto-flag any borehole where weekly consumption exceeds **120% of the trailing 30-day average** as a possible leak/fault; notify the Operations Support Officer and Production Manager the same day.

**Roles:** Entry — Agricultural Technician per Point. Consolidation — Operations Support Officer. Oversight — Admin Manager.

**Outputs:** Weekly water consumption report by borehole/Point; monthly water summary with anomaly log for the Monthly Admin Report.

---

### 5.3 `ADM-FOOD-01` — Kitchen & Food Stock Management

**Purpose:** Tracks daily food stock in/out for the 3 daily meals served to permanent staff at Point B.

**Fields:**
- Item name, unit, quantity in / quantity out / balance
- Expiry date
- Kitchen used (indoor gas / outdoor wood)
- Meals served count (breakfast/lunch/dinner)
- Restocking requests

**Business rules:**
- Auto-flag items nearing expiry.
- Restocking requests must be raised with adequate lead time and routed to the Admin Manager.

**Roles:** Entry — Human & Facility Services Officer / Cook. Oversight — Admin Manager.

**Outputs:** Daily stock balance; monthly meals-served and stock-variance-vs-plan report.

---

### 5.4 `ADM-FUEL-01` — Fuel Management

**Purpose:** Logs fuel consumption for tractors, machines, vehicles, and motorcycles against the 100 L drum stock (or future 500 L metered tank).

**Fields:**
- Date, vehicle/equipment ID, activity, Production Point/area
- Litres dispensed, litres remaining in stock
- Operator/driver
- Odometer or operating-hours reading

**Business rules:**
- Weekly review by the Production Manager.
- Any unexplained consumption variance **greater than 10%** must be auto-flagged for investigation and included in the monthly Foundation report.

**Roles:** Entry — Tractor Operator / Truck Driver. Review — Production Manager. Reported — Admin Manager (monthly).

**Outputs:** Weekly fuel report by vehicle/activity; monthly consumption & variance summary.

---

### 5.5 `ADM-GEN-01` — Generator & Solar Energy Log

**Purpose:** Records each generator activation (used only when solar supply is insufficient).

**Fields:** Date/time started and stopped, reason for use, fuel consumed, hours run, maintenance status.

**Roles:** Entry — designated operator / Admin Manager.

**Outputs:** Monthly generator hours, fuel used, and maintenance status for the Monthly Admin Report.

---

### 5.6 `ADM-CFW` — Cash-for-Work (CFW) Management

**Purpose:** Manages the full lifecycle of the seasonal/temporary paid-labour programme: eligibility, recruitment, daily productivity targets, attendance verification, weekly and monthly budget control.

**Fields:**
- Worker registry: name, ID, Production Point, eligibility status
- Daily productivity target per activity (negotiated jointly by Technician and Comissionário before work starts)
- Daily attendance/verification register per worker, per activity, per Production Point
- **Weekly submission (every Thursday)** to HR/Finance: worker names by Point/activity, days worked per person, cumulative budget used vs. monthly allocation, forecast of remaining need, any changes to the approved monthly plan
- **Monthly CFW plan** (due the 25th of the prior month; requires Foundation approval before the month starts)
- Payment rates — sourced from and editable only by the Foundation's central HR

**Business rules:**
- Pay rate fields are **read-only** for all farm-level roles including the Admin Manager. Rate changes only take effect via a flagged "HR-approved rate update" import/action.
- System should auto-generate the draft weekly CFW submission from the week's attendance/target data (do not require manual re-entry).
- Track group performance quality (rework rate) per activity; flag workers with persistently low quality to the Production Manager.

**Roles:** Entry — Agricultural Technician (targets, attendance) and Admin Manager (budget, weekly/monthly submissions). Approval — Foundation HR/Finance (external, i.e., outside the system or via an external-reviewer role).

**Outputs:** Weekly CFW update (`ADM-CFW-01`), monthly CFW plan, CFW cost breakdown by category (field/kitchen/cleaning) for the Monthly Admin Report.

---

### 5.7 `ADM-BDG-01` — Monthly Budgeting

**Purpose:** Manages the monthly budget request/approval cycle with the Foundation, and tracks actual-vs-approved spend.

**Fields:** Budget line, category, amount requested, amount approved, amount spent to date, narrative justification (conditional), month/year, submission status.

**Business rules:**
- Budget request for the following month is due by the **20th** of the current month.
- Any line exceeding the previous month's value by **more than 15%** requires a mandatory written narrative justification before submission — block submission without it.

**Roles:** Entry/submission — Admin Manager. Review/approval — Foundation (external), escalation to Farm Coordinator if overall deviation exceeds 15%.

**Outputs:** Monthly budget request; budget performance report (actual vs. approved by line) in the Monthly Admin Report.

---

### 5.8 `ADM-INV-01` / `ADM-DRY-01` — Warehouse, Post-Harvest & Drying Area Management

**Purpose:** Manages the central warehouse (≈800 m²) and drying area (≈600 m²) at Point B: inputs (seeds, fertilizer, tools) and outputs (processed harvest for sale/donation), plus drying-area scheduling.

**Fields:**
- Stock item, category (input/output), quantity, unit, location
- Entry register: linked to Foundation logistics "Livro de Entradas" (dual-signed — one copy stays at farm, one returns to logistics)
- Exit register: linked to "Livro de Saída", requires the Farm Manager's signature, purpose (sale/donation)
- Drying area booking: crop, Production Point, date range, area occupied (of 600 m²), rotation sequence to avoid cross-contamination between crops

**Business rules:**
- Monthly stock declaration sent to the Foundation's Logistics Coordinator and central warehouse by the **5th** of each month.
- Discrepancies between farm and Foundation records must be reconciled within **3 business days**.
- Weekly random inventory audit (Monday or Tuesday) comparing physical stock to the entry/exit log; auto-flag discrepancies.
- Drying-area bookings must not overlap for incompatible crops, per the rotation calendar — validate on booking creation.

**Roles:** Entry — Warehouse/Stores Assistant. Oversight — Operations Support Officer. Guardianship/sign-off — Admin Manager.

**Outputs:** Daily stock ledger; weekly audit report; monthly stock declaration; drying-area occupancy calendar.

---

### 5.9 `ADM-TOOL-01` — Tools Register

**Purpose:** Tracks distribution and return of tools to field teams.

**Fields:** Tool ID/type, quantity, team/Point assigned, date out, date returned, condition.

**Business rules:** Team leaders must digitally sign for both distribution and return; unreturned tools auto-flag at end of day.

**Roles:** Entry — Technician/Comissionário per Point. Verification — Warehouse Assistant.

---

### 5.10 `ADM-FAK-01` — First Aid & Health Incident Register

**Purpose:** Tracks first aid kits (one at each Production Point A/B/C and the main office) and health incidents.

**Fields:** Kit location, stock levels, expiry dates; incident date, person, injury/illness type, items used, hospital referral (Y/N), outcome.

**Business rules:** Monthly summary of incidents, injury types, items consumed, referral outcomes, and kit status due to the Foundation's Health Department by the **5th** of each month.

**Roles:** Entry — Point-designated responsible (via Human & Facility Services Officer). Oversight — Admin Manager (global kit management).

---

### 5.11 Facility Hygiene & Maintenance Requests

**Purpose:** Daily hygiene checklist per Production Point and a maintenance-request workflow from report to resolution.

**Fields:** Daily hygiene checklist per Point (toilets, rest areas) — status, anomalies; maintenance request — description, location, urgency, requester, assigned to, status, resolution date.

**Business rules:** Any anomaly (blockage, damaged door, no water supply) must be immediately escalated to the Admin Manager, who logs it and issues a maintenance request.

**Roles:** Entry — Comissionário per Point (checklist). Management — Admin Manager (requests, tracking to resolution).

---

### 5.12 Weekly / Monthly Administration Reporting

Auto-compile the following from the modules above, matching the SOP cadence exactly:

| Report | Due | Recipients | Content |
|---|---|---|---|
| Weekly Report | Fridays, 17:00 | Farm Manager, Production Manager, Coordination (WhatsApp + email) | Attendance summary, production updates per Point, fuel & water consumption, kitchen status, CFW days/budget, maintenance issues, incidents, next-week forecast |
| Weekly Inventory & Asset Check | Mon/Tue | Admin Manager | Warehouse count vs. register, fuel drum check, tool return check, first aid kit check |
| Monthly Admin Report | By the 5th | Farm Manager, Coordination, Foundation RH/Finance (Word + Excel + PowerPoint) | Attendance, CFW cost by category, food, fuel, water, waste/composting, first aid, generator, maintenance status, events, budget performance, next-month forecast |
| Monthly Budget Request | By the 20th | Foundation | Requested budget for following month, with justification for lines >15% variance |
| Monthly CFW Plan | By the 25th | Foundation (approval required before month start) | Planned CFW needs by Point/activity for the following month |
| Monthly Health Summary | By the 5th | Foundation Health Department | First aid incidents, items used, referrals, kit status |

**Implementation note:** Build a generic "Report" entity/service that pulls from the underlying modules on a schedule, rather than hard-coding each report as a one-off — but the *content and deadlines* of each report above are fixed requirements, not suggestions.

---

## 6. Production Module — Functional Specifications

### 6.1 `PROD-PAP` — Annual Production Plan (PAP) & Goal Management

**Purpose:** Defines and tracks the farm's annual operational targets, with quarterly reviews, and drives the KPI "Meta" values used in performance evaluation.

**Fields:** Annual targets by area/culture/activity; quarterly review checkpoints; approval chain (Production Manager → Admin Manager → Coordination → Top Manager sign-off).

**Roles:** Owned by Production Manager & Admin Manager, coordinated with Farm Coordinator, approved by Top Manager.

---

### 6.2 `PROD-FIELD` — Production Point & Field Activity Tracking

**Purpose:** Tracks day-to-day field operations (land prep, planting, weeding, irrigation, harvest) across the 3 Production Points and their internal plots, within the up-to-200-hectare footprint.

**Fields:**
- Production Point (A/B/C), plot/zone, GPS boundary (optional mapping)
- Field diary: activity type, date, area covered, crew assigned, materials used
- Anomaly reports: pest, disease, irrigation failure, unexplained damage — with GPS location and photo
- Weekly field report per Technician, submitted Friday

**Business rules:**
- Field inspected at least **twice weekly** (Mon/Thu), or **daily** during high-risk season.
- Anomalies reported to the Production Manager **within 1 hour** of detection, with photo documentation.
- Weekly activity completion target: **≥90%** of planned weekly activities; shortfalls require a recorded cause and recovery plan.

**Roles:** Entry — Agricultural Technician per Point. Oversight — Production Manager.

---

### 6.3 `PROD-MECH` — Tractor & Mechanization Management

**Purpose:** Manages the 2–3 tractors and associated equipment: scheduling, pre-operation safety checks, daily usage logs, maintenance.

**Fields:**
- Pre-operation checklist (oil, fuel, tyres, brakes, lights) — pass/fail, before every use
- Daily operation log: hours run, area worked, activity, fuel consumed
- Weekly usage schedule: Technicians submit requests by Wednesday 15:00; Tractor Operator + Production Manager finalize by Thursday, communicated by Thursday 17:00
- Breakdown/maintenance report: description, "IMMOBILIZED" tag, internal-repair vs. external-service decision, downtime

**Business rules:**
- Equipment failing the pre-operation checklist must **not** be used; auto-tag "IMMOBILIZED" and report to the Production Manager within 15 minutes.
- Weekly maintenance (Monday): general cleaning, belt/filter check, logged per unit.

**Roles:** Entry — Tractor Operator. Scheduling approval — Production Manager.

**Outputs:** Weekly tractor usage schedule; fuel/hours feed into `ADM-FUEL-01`; equipment availability dashboard.

---

### 6.4 `PROD-KPI` — KPI & Performance Evaluation

**Purpose:** Digitizes the role-based KPI evaluation templates (N1–N7) defined in the SOP, tying each cycle's targets back to the approved PAP.

**Fields:** Role, KPI name, weight, Meta (from approved PAP), Realizado (actual), Score; qualitative score (assigned exclusively by the role's direct supervisor); evaluation cycle (annual).

**Business rules:**
- Score bands: **0–49 Insufficient · 50–69 Reasonable · 70–84 Good · 85–100 Excellent**.
- Meta values are **locked** once the PAP is approved for the cycle; only editable via a tracked PAP revision.
- Qualitative component (typically ~20% of score) is restricted to the direct supervisor role only — enforce at the field/permission level.

**Roles:** Set targets — Production Manager / Admin Manager / Coordination at cycle start. Score entry — direct supervisor of each role.

**Outputs:** Individual scorecards; department KPI dashboard; monthly consolidated KPI report to N1 (tolerance ±10% flagging).

---

### 6.5 `PROD-HARVEST` — Harvest & Post-Harvest Handling

**Purpose:** Tracks cashew product flow from field harvest through reception, classification, weighing, drying, packaging, warehousing, to sale/donation.

**Fields:** Harvest batch (Production Point, date, quantity, crew); reception & classification (grade, weight, condition); drying-area allocation & duration (linked to `ADM-DRY-01`); final packaging & warehouse intake (linked to `ADM-INV-01`); sale/donation record (buyer, quantity, agreed value, payment status).

**Business rules:** Sale requires payment confirmation and registration in the financial system before closing the transaction; unresolved payments beyond **48h** escalate to the Farm Coordinator.

**Roles:** Entry — Operations Support Officer (post-harvest), Farm Coordinator (sales negotiation).

---

## 7. Cross-Cutting System Features

### 7.1 Dashboards & Alerts
- Executive dashboard (N1/N2): KPI status, budget execution, production progress vs. PAP, alerts requiring escalation.
- Operational dashboards (N3): attendance today, CFW budget used vs. allocation, warehouse stock levels, fuel/water status, open maintenance requests.
- Automatic threshold alerts:
  - Water consumption > 120% of 30-day average
  - Fuel variance > 10%
  - Budget line variance > 15%
  - Stock cover below 2 weeks
  - Drying-area booking conflicts
  - Equipment tagged IMMOBILIZED
  - Leave requests that would leave a Point uncovered (no Technician + Comissionário)

### 7.2 Reporting & Export
- One-click generation of the Weekly Report and Monthly Admin Report in Word/Excel/PowerPoint format.
- Traditional Chinese (Taiwan) and English (UK) export for institutional reporting to the Foundation.
- PDF/image export suitable for WhatsApp sharing.

### 7.3 Language & Usability
- The system UI must be fully trilingual: **English (UK), Portuguese (Mozambique), and Traditional Chinese (Taiwan)**, with a per-user language switch (each user selects and persists their own preferred UI language; it is not tied to role or device).
- **Portuguese (Mozambique)** is the operational default for the on-farm interface (field roles, Production Points, main office) — it is the working language of the SOP and of daily operations.
- **English (UK)** supports non-Portuguese-speaking technical/support staff and external partners. Use UK spelling and conventions (e.g., "litres," "organisation," "kilometres," DD/MM/YYYY dates) throughout the English locale, not US English.
- **Traditional Chinese (Taiwan)** is required for the Farm Coordinator's institutional reporting to the Foundation and for any Foundation-facing user reviewing farm data directly in the system. Use Traditional (not Simplified) Chinese characters and Taiwan-standard terminology throughout.
- All static UI text, labels, form fields, validation messages, and generated report templates (Weekly Report, Monthly Admin Report, Budget Request, CFW Plan, Health Summary) must be translatable and available in all three locales — do not hard-code English or Portuguese strings.
- Data values entered by users (free-text notes, incident descriptions, etc.) are stored as entered and are not machine-translated; only the system's own UI, labels, and generated report templates require full trilingual support.
- Field-level mobile interface designed for low literacy / minimal typing: pick-lists, numeric keypads, photo capture, GPS auto-tag — this applies across all three languages equally.
- Must work on low-bandwidth/intermittent rural connectivity; offline capture with sync-on-connect.

### 7.4 Security, Audit & Data Integrity
- Role-based access control matching the N1–N7 hierarchy (Section 4).
- Full audit trail on all records: who entered/edited/approved, and when.
- Locked fields for Foundation-controlled data (e.g., CFW pay rates) — editable only via an authorized import/approval flow.
- Automated daily backup.

---

## 8. Core Data Model (Key Entities)

Implement these as the backbone; every module above references one or more of these entities. Field lists are the minimum required — extend as needed for implementation (IDs, timestamps, etc.) but do not omit anything listed.

| Entity | Key Attributes |
|---|---|
| `Employee` | ID, name, role/level (N1–N7), department, Production Point, contract type (permanent/CFW), status |
| `ProductionPoint` | Code (A/B/C), area (ha), boreholes, dormitory capacity, Comissionário, Technician |
| `Field` / `Plot` | Production Point, area, current crop/stage, GPS boundary |
| `Borehole` | Production Point, type (operational/reserve), meter reading history |
| `Tractor` / `Equipment` | ID, type, status, maintenance history, current assignment |
| `FuelLog` | Date, vehicle/equipment, litres, activity, area, operator |
| `GeneratorLog` | Date/time, reason, fuel used, hours |
| `WarehouseItem` / `StockMovement` | Item, category, quantity, unit, movement type (in/out), linked entry/exit book reference |
| `DryingAreaBooking` | Crop, Production Point, date range, area occupied |
| `CFWWorker` / `CFWAttendance` | Worker, eligibility, Production Point, activity, daily target, days worked, rate (locked) |
| `Budget` / `BudgetLine` | Month, category, requested, approved, spent, justification |
| `MaintenanceRequest` | Location, description, urgency, status, resolution date |
| `FirstAidIncident` | Point, date, person, type, items used, referral outcome |
| `KPIRecord` | Role, cycle, KPI name, weight, Meta, Realizado, Score |
| `Attendance` / `LeaveRequest` | Employee, date, status, rotation cycle, leave dates, approval status |
| `HarvestBatch` | Production Point, date, quantity, grade, drying allocation, sale/donation record |
| `Vehicle` / `TripLog` | Vehicle, driver, destination, purpose, mileage, fuel |

---

## 9. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Usability | Low-literacy-friendly mobile UI for field roles; Portuguese (Mozambique)-first with full English (UK) and Traditional Chinese (Taiwan) UI support; minimal free-text entry where pick-lists suffice |
| Localization | Full trilingual UI (English, Portuguese, Traditional Chinese – Taiwan) via a translation/i18n layer — all labels, messages, and generated report templates must be sourced from translatable strings, not hard-coded |
| Connectivity | Must function with intermittent/low-bandwidth rural connectivity; offline data capture with automatic sync |
| Performance | Dashboards and reports load in under 5 seconds on standard office connectivity at Point B |
| Reliability | Automated daily backups; no silent data loss on sync conflicts (last-write with audit trail, not silent overwrite) |
| Security | Role-based access control; audit log; locked/Foundation-controlled fields; encrypted data at rest and in transit |
| Scalability | Must support the current 3 Production Points/200 ha and allow additional Points, boreholes, or crops without redesign |
| Compliance | Must reproduce all Foundation-mandated deadlines, approval chains, and document formats described in this document |
| Auditability | Every register (attendance, CFW, warehouse, budget) traceable to who entered it and when |

---

## 10. Appendix — SOP Form Code Reference

| Code | Register |
|---|---|
| `ADM-ATT-01` | Attendance Panel |
| `ADM-WTR-01` | Weekly Water Register |
| `ADM-FOOD-01` | Daily Food Stock Register |
| `ADM-FUEL-01` | Daily Fuel Register |
| `ADM-GEN-01` | Generator Operation Register |
| `ADM-CFW-01` | Weekly CFW Update |
| `ADM-BDG-01` | Monthly Budget Model |
| `ADM-TOOL-01` | Tool Distribution/Return Sheet |
| `ADM-INV-01` | Warehouse Entry/Exit Register |
| `ADM-DRY-01` | Drying Area Register |
| `ADM-FAK-01` | First Aid Occurrence Register |

---

## 11. Build Plan — 6 Phases

Build in six phases. Each phase should be fully working (data capture, validation rules, roles, and — where noted — offline sync) before moving to the next; do not leave a phase "partially done" and jump ahead. Phases 1–3 are Administration-heavy, Phase 4 is the most complex single module, Phase 5 is Production, Phase 6 closes the loop with reporting and hardening.

### Phase 1 — Foundation
*Everything else depends on this phase being solid.*
- Core data model (Section 8): `Employee`, `ProductionPoint`, `Field`/`Plot`, `Borehole`, `Tractor`/`Equipment`, and the remaining entities' schemas stubbed out.
- Authentication and full role-based access control matching the N1–N7 hierarchy exactly (Section 4) — not a generic admin/user model.
- Offline-first architecture and sync engine (Section 2.2, 7.3) — design this now, not later. Retrofitting offline support after Phases 2–5 are built is significantly more expensive and risk-prone.
- Audit-trail infrastructure (who/when on every create/edit/approve) — build once, reuse everywhere.

### Phase 2 — Core Daily Administration
*The registers staff touch every single day.*
- Attendance & Workforce Rotation (`ADM-ATT-01`) — biometric import, rotation calendar, leave requests, the "no Point without Technician + Comissionário" rule.
- Water Borehole Monitoring (`ADM-WTR-01`) — weekly readings, 120%-of-average anomaly detection.
- Fuel Management (`ADM-FUEL-01`) and Generator & Solar Energy Log (`ADM-GEN-01`) — daily logs, 10% variance flagging.
- Kitchen & Food Stock (`ADM-FOOD-01`).

### Phase 3 — Warehouse, Assets & Facilities
*Physical goods, tools, and site upkeep.*
- Warehouse, Post-Harvest & Drying Area Management (`ADM-INV-01` / `ADM-DRY-01`) — entry/exit registers, monthly stock declaration, weekly audit, drying-area rotation conflicts.
- Tools Register (`ADM-TOOL-01`).
- First Aid & Health Incident Register (`ADM-FAK-01`).
- Facility Hygiene & Maintenance Requests (Section 5.11).

### Phase 4 — Cash-for-Work & Budgeting
*The most complex and most tightly regulated admin workflows — build once Phases 1–3 are stable.*
- Cash-for-Work Management (`ADM-CFW`) — eligibility, daily targets, attendance verification, the Thursday weekly submission, the monthly plan (due the 25th), and the Foundation-locked pay-rate field.
- Monthly Budgeting (`ADM-BDG-01`) — budget request cycle (due the 20th), the 15%-variance mandatory-justification rule, actual-vs-approved tracking.

### Phase 5 — Production Side
*Field operations, mechanization, and performance.*
- Annual Production Plan & Goal Management (`PROD-PAP`).
- Production Point & Field Activity Tracking (`PROD-FIELD`) — field diary, anomaly reporting (1-hour SLA), weekly ≥90% completion tracking.
- Tractor & Mechanization Management (`PROD-MECH`) — pre-operation checklist, daily logs, weekly scheduling, IMMOBILIZED tagging.
- KPI & Performance Evaluation (`PROD-KPI`) — role-based scorecards tied to the approved PAP, locked Meta values, supervisor-only qualitative scoring.
- Harvest & Post-Harvest Handling (`PROD-HARVEST`) — batch tracking through to sale/donation.

### Phase 6 — Reporting, Integration & Hardening
*Close the loop across both sides and prepare for real use.*
- Reporting Engine (Section 5.12) — Weekly Report, Monthly Admin Report (Word/Excel/PowerPoint), Monthly Budget Request, Monthly CFW Plan, Monthly Health Summary, all auto-compiled from Phases 1–5 data.
- Dashboards & threshold alerts (Section 7.1) across both modules.
- Export tooling: Word/Excel/PowerPoint generation in English, Portuguese, and Traditional Chinese (Taiwan); WhatsApp-shareable PDF/image export.
- Verify the i18n/translation layer (Section 7.3) is applied consistently across every module built in Phases 1–5, not just the reporting layer.
- End-to-end offline-sync testing under realistic rural-connectivity conditions, including conflict scenarios.
- Full audit-trail and permissions review against Section 4 and Section 9 (Non-Functional Requirements) before handoff.
