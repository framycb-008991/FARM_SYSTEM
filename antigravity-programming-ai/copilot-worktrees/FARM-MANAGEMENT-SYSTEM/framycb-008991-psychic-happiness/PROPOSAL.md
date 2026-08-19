# System Proposal & Technical Specification
## Digital Farm Production & Administration Management System (*Sistema de Gestão de Produção e Administração Agrícola*)

**Client & Institution:** Fundação de Caridade Tzu Chi Moçambique — Unidade Produtiva de Mecuzi  
**Project:** Integrated Agritech, Administration & Operations Management Platform  
**Operational Foundation:** *Manual de Procedimentos Operacionais Normalizados* (PON-AGR-MEC-V2.0)  
**Author / Lead Architect:** Senior Full-Stack Software Architect & Agritech Systems Engineer  
**Document Version:** 2.0 (Updated Comprehensive Proposal)  
**Target Deployment Environment:** Hybrid Offline-First Mobile Client (Production Points A, B, C) & Cloud/Desktop Web Platform (Point B Operational Centre)

---

## Executive Summary & Table of Contents

This proposal establishes the technical architecture, operational workflows, role-based governance, and delivery roadmap for the **Farm Daily Production & Administration Management System** designed specifically for **Unidade Produtiva de Mecuzi**, operated by **Fundação de Caridade Tzu Chi Moçambique**. 

The system transitions the farm from manual paper registers and spreadsheet silos into a centralized, auditable, and offline-resilient digital management platform that enforces every deadline, approval chain, and threshold defined in the farm's Standard Operating Procedures manual (*PON-AGR-MEC-V2.0*).

### Table of Contents
1. [Institutional & Physical Context](#1-institutional--physical-context)
2. [Architectural Philosophy & Core Operating Principles](#2-architectural-philosophy--core-operating-principles)
3. [Organizational Hierarchy & Role-Based Access Control (N1–N7)](#3-organizational-hierarchy--role-based-access-control-n1n7)
4. [Deep Dive: Farm Manager Role (Coordenador/a da Fazenda — N2)](#4-deep-dive-farm-manager-role-coordenadora-da-fazenda--n2)
5. [System Architecture, Offline Sync & Technology Stack](#5-system-architecture-offline-sync--technology-stack)
6. [Administration Module Functional Specifications](#6-administration-module-functional-specifications)
7. [Production Module Functional Specifications](#7-production-module-functional-specifications)
8. [Cross-Cutting Engines: Trilingual Architecture, Reporting & Alerts](#8-cross-cutting-engines-trilingual-architecture-reporting--alerts)
9. [Core Data Model & Database Architecture](#9-core-data-model--database-architecture)
10. [Phased Implementation Roadmap & Build Plan](#10-phased-implementation-roadmap--build-plan)
11. [Non-Functional Requirements & Definition of Done](#11-non-functional-requirements--definition-of-done)

---

## 1. Institutional & Physical Context

```
+-----------------------------------------------------------------------------------+
|                     FUNDAÇÃO DE CARIDADE TZU CHI MOÇAMBIQUE                       |
|               (Central Council & Central HR/Finance/Logistics/Health)             |
+-----------------------------------------+-----------------------------------------+
                                          | Institutional Oversight & Approvals
                                          v
+-----------------------------------------------------------------------------------+
|                        UNIDADE PRODUTIVA DE MECUZI                                |
|                                                                                   |
|  +----------------------------------+   +--------------------------------------+  |
|  |      ADMINISTRATION MODULE       |   |          PRODUCTION MODULE           |  |
|  | - ADM-ATT-01 (Attendance/Leaves) |   | - PROD-PAP (Annual Production Plan)  |  |
|  | - ADM-WTR-01 (6 Boreholes Log)   |   | - PROD-FIELD (Field Diaries/Points)  |  |
|  | - ADM-FOOD-01 (Kitchen Stock)    |   | - PROD-MECH (Tractor/Mechanization)  |  |
|  | - ADM-FUEL-01 (Fuel & Drums)     |   | - PROD-KPI (N1-N7 Scorecards)        |  |
|  | - ADM-GEN-01 (Solar/Generator)   |   | - PROD-HARVEST (Post-Harvest/Sales)  |  |
|  | - ADM-CFW (Cash-for-Work)        |   +--------------------------------------+  |
|  | - ADM-BDG-01 (Monthly Budget)    |                      ^                      |
|  | - ADM-INV/DRY (Warehouse/Drying) |                      |                      |
|  | - ADM-TOOL/FAK (Tools/First Aid) |                      |                      |
|  +----------------------------------+                      |                      |
|                     |                                      |                      |
|                     +-------------------+------------------+                      |
|                                         |                                         |
|                                         v                                         |
|  +-----------------------------------------------------------------------------+  |
|  |              REPORTING, TRILINGUAL i18n & KPI ENGINE                        |  |
|  | - UI & Reports: Portuguese (Mozambique), English (UK), Trad. Chinese (Taiwan)|  |
|  | - Automated Weekly WhatsApp/PDF | Foundation Word/Excel/PPTX Monthly Package|  |
|  | - Exception Alerts (>120% Water, >10% Fuel, >15% Budget, IMMOBILIZED Units) |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

### 1.1 Physical & Operational Profile

| Parameter | Specifications |
|---|---|
| **Facility & Land Area** | **Unidade Produtiva de Mecuzi** — up to 200 hectares of cashew orchard and rotating seasonal crops |
| **Production Points** | **3 Production Points (Ponto A, Ponto B, Ponto C)**; each point features staff dormitories, sanitation facilities, and water infrastructure |
| **Central Operational Centre** | Situated at **Point B**: Central management office, central inputs & outputs warehouse (≈800 m²), shared drying floor (≈600 m²), kitchen facilities, dormitories, and biometric time-clock |
| **Permanent Workforce** | **33 permanent personnel** on a strict rotation cycle of **2 consecutive weeks on-site (14 days) followed by 2 days off (folga)** |
| **Seasonal Workforce (CFW)** | Cash-for-Work seasonal labor force recruited locally, managed via daily productivity targets, budget-capped and authorized monthly by Foundation Central HR |
| **Water Infrastructure** | **6 boreholes total** (2 per Production Point: 1 operational primary borehole + 1 reserve/expansion), equipped with mechanical flow meters read weekly |
| **Mechanization Fleet** | 2 to 3 tractors, agricultural implements, transport trucks, and operational motorcycles |
| **Fuel Storage Infrastructure** | Initial phase: 5 × 20 L drums (100 L total buffer); Planned upgrade: 500 L dedicated tank equipped with lockable pump and mechanical flow meter |
| **Power Supply** | Primary solar array with automated power management; backup diesel generator activated only during solar deficit or peak machinery maintenance |
| **Time & Attendance** | Centralized biometric time-clock stationed at Point B Main Office |
| **Trilingual System Scope** | Fully localized UI and reporting across **Portuguese (Mozambique)** [operational default], **English (UK)** [technical/partner], and **Traditional Chinese (Taiwan)** [Foundation/institutional] |

---

## 2. Architectural Philosophy & Core Operating Principles

As established in `ROLE.md`, the platform is engineered under four non-negotiable principles:

### 2.1 The SOP is Law, Not Inspiration
Every timeline, numerical threshold, approval chain, and validation gate in PON-AGR-MEC-V2.0 is an absolute system constraint:
- **Zero deadline dilution**: Water readings submitted Mondays by 08:30; Monthly reports submitted by the 5th; Budget requests by the 20th; Monthly CFW plans by the 25th; Council reports by the 28th.
- **Strict algorithmic anomaly detection**: Automatic flagging of water consumption >120% of 30-day average; fuel consumption variance >10%; budget deviations >15% requiring mandatory written justifications.
- **Uncompromised approval hierarchies**: Dual-signature equivalence and multi-level approval workflows (Technician → Production/Admin Manager → Farm Coordinator → CEO / Foundation) are enforced at the database level.

### 2.2 Offline-First is a Core Constraint
Given remote field conditions across Points A, B, and C:
- All mobile data entry interfaces operate with **100% offline autonomy**.
- Local transactions are persisted to client-side storage (SQLite/WatermelonDB/IndexedDB).
- Automatic synchronization queues activate upon detecting network connectivity, leveraging deterministic conflict-resolution algorithms that preserve full audit trails.

### 2.3 Role-Based Security & Foundation Locks
- User capabilities are governed by the **N1–N7 organizational hierarchy**.
- **External Ownership**: Specific fields—notably **CFW hourly/daily wage rates owned by Foundation Central HR**—are strictly read-only within the farm system. Farm managers cannot edit wage rates locally.

### 2.4 Immutable Accountability & Audit Artifacts
- Every data point replaces physical paper logs.
- The system generates an immutable audit record (UUID, actor ID, role level, GPS coordinate, cryptographic timestamp, previous value, new value) on every write, update, sign-off, or rejection.

---

## 3. Organizational Hierarchy & Role-Based Access Control (N1–N7)

The system models the farm's exact 7-tier organizational structure.

```
                      +-----------------------------+
                      |   Tzu Chi Council (Ext.)    |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |   CEO / Top Manager (N1)    |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |  Farm Coordinator (N2)      |  <--- (Farm Manager)
                      +-------+-------------+-------+
                              |             |
            +-----------------+             +-----------------+
            v                                                 v
+-----------------------+                         +-----------------------+
| Production Manager N3 |                         |   Admin Manager N3    |
+-----------+-----------+                         +-----------+-----------+
            |                                                 |
  +---------+---------+                       +---------------+---------------+
  v                   v                       v               v               v
+----------------+ +----------------+ +----------------+ +----------------+ +----------------+
|  Agricultural  | |    Tractor     | |   Finance &    | |   Operations   | |Human & Facility|
|Technicians (N5)| | Operator (N6)  | |Compliance (N5) | |  Support (N5)  | | Services (N5)  |
+----------------+ +----------------+ +----------------+ +----------------+ +----------------+
  |                   |                       |               |               |
  v                   v                       v               v               v
+----------------+ +----------------+ +----------------+ +----------------+ +----------------+
| Comissionários | | Machine Maint. | | Cashier / Pay  | |   Warehouse    | | Kitchen, Cooks,|
| & Field Workers| | & Field Crews  | |  Verification  | | Assistant (N7) | |  Cleaners (N7) |
|      (N7)      | |      (N7)      | |                |                | |                |
+----------------+ +----------------+ +----------------+ +----------------+ +----------------+
```

### 3.1 Role & Permission Matrix

| Level | Role Title | Scope & Module Access | Permissions & Operational Authority |
|---|---|---|---|
| **N1** | **Top Manager / CEO** (*Gestor/a de Topo*) | Full System (Admin + Production + Strategy + Council) | Strategic oversight; final approval on Annual Production Plan (PAP); approves high-impact capital investments; submits accountability reports to Tzu Chi Council. |
| **N2** | **Farm Coordinator / Farm Manager** (*Coordenador/a da Fazenda*) | Full System (Operational Oversight & Escalations) | On-site operational head; resolves cross-departmental escalations; enforces 10% PAP deviation and 15% budget variance gates; approves Point leave coverage; compiles Foundation monthly reports. |
| **N3** | **Production Manager** (*Gestor/a de Produção*) | Production Module (Full Control) | Drafts PAP; manages plot diaries; reviews weekly field inspections; approves tractor schedules; audits fuel efficiency; manages cashew harvest, drying, and grading. |
| **N3** | **Admin Manager** (*Gestor/a de Administração*) | Administration Module (Full Control) | Oversees staff attendance & 14/2 rotation; approves regular leave; compiles monthly budget; manages CFW submissions; oversees warehouse, food stocks, and facilities. |
| **N5** | **Agricultural Technician** (*Técnico/a Agrícola - 1 per Point*) | Production Module (Assigned Point A, B, or C) | Records daily field diaries, crop anomalies (<1h SLA) with GPS/photos; takes Monday 08:30 borehole readings; sets daily CFW targets; co-signs tool allocations. |
| **N5** | **Finance & Compliance Officer** (*Resp. Financeiro/a e Conformidade*) | Admin Module — Financials & Budgets | Controls operational budget lines; tracks cost-per-crop/activity; validates procurement compliance; reconciles warehouse valuation; views locked CFW wage rates. |
| **N5** | **Operations Support Officer** (*Resp. Apoio Operacional e Logística*) | Admin Module — Warehouse, Logistics, Water | Consolidates borehole water readings by Monday 12:00; manages warehouse in/out logs; schedules drying floor bookings; conducts weekly physical stock audits. |
| **N5** | **Human & Facility Services Officer** (*Resp. Serviços Humanos e Instalações*) | Admin Module — Welfare, Kitchen, Health | Logs daily kitchen stock and meal counts; inspects first aid kits and incident reports; oversees sanitary and dormitory hygiene checklists. |
| **N6** | **Tractor Operator** (*Operador de Trator*) | Production Module — Mechanization | Executes mandatory pre-op checklist; logs daily operating hours, hectares worked, and fuel consumed; reports breakdown/immobilization within 15 minutes. |
| **N6** | **Truck / Vehicle Driver** (*Motorista*) | Admin Module — Logistics & Transport | Logs vehicle transport trips, destinations, cargo purposes, odometer readings, and fuel consumption. |
| **N7** | **Warehouse / Stores Assistant** (*Assistente de Armazém*) | Admin Module — Warehouse Data Entry | Records physical goods entry/exit matching signed dispatch notes; executes weekly physical cycle counts. |
| **N7** | **Comissionário / Field Worker / Cook / Cleaner** | Mobile Client / Kiosk — Task Acknowledgement | Views daily task rosters; Comissionários co-sign daily field attendance, tool distribution, and sanitary checklists. |

---

## 4. Deep Dive: Farm Manager Role (Coordenador/a da Fazenda — N2)

As detailed in `FARM_MANAGER_ROLE.md`, the Farm Manager is the on-site operational executive connecting strategic leadership (CEO) with field execution (Department Managers).

### 4.1 System Behavioral Profile
- **Summary & Exception First**: The Farm Manager does not perform routine data entry. The system UI opens directly to active anomalies, variance alerts, threshold breaches, and pending escalations.
- **Multi-Level Approval Gateway**: Serves as the formal review checkpoint before submissions reach the CEO or external Foundation departments.

```
+-----------------------------------------------------------------------------------------+
|                        FARM MANAGER (N2) OPERATIONAL DASHBOARD                          |
+-----------------------------------------------------------------------------------------+
|  [!] URGENT EXCEPTIONS & ESCALATIONS (3 Active)                                         |
|  - Water Anomaly: Borehole 2 (Point A) @ 138% of 30-day average (>120% threshold)      |
|  - Leave Conflict: Point C Technician & Comissionário overlapping leave request blocked  |
|  - Mechanization: Tractor #2 tagged IMMOBILIZED (Hydraulic fault reported 07:15)        |
+-----------------------------------------------------------------------------------------+
|  FINANCIAL & BUDGET EXECUTION (Month-to-Date)      | PRODUCTION VS PAP (Current Cycle)  |
|  - Approved Budget: 450,000 MZN                    | - Planned Hectares: 180 ha         |
|  - Executed: 310,000 MZN (68.8%)                   | - Completed: 165 ha (-8.3% var.)   |
|  - Line Alert: Fuel (+16.2% var. - Action Req.)    | - Tolerance Status: NORMAL (<=10%) |
+-----------------------------------------------------------------------------------------+
|  THIS WEEK AT A GLANCE (Week 33)                   | UPCOMING COMPLIANCE DEADLINES      |
|  - Permanent Staff Attendance: 32/33 on-site       | - Friday 17:00: Weekly Report      |
|  - CFW Labor: 48 workers active across Points      | - 20th: Monthly Budget Submission  |
|  - Warehouse Cover: 3.4 weeks (Safe)               | - 25th: Monthly CFW Plan to Central|
+-----------------------------------------------------------------------------------------+
```

### 4.2 Key Escalation Triggers & SOP Hard Rules for N2

1. **10% Cumulative Production Deviation Rule**:
   - If cumulative monthly field progress drops **>10% below the approved PAP target**, the system triggers an emergency escalation.
   - Farm Manager must escalate to the CEO within **24 hours**.
   - Production Manager must deliver a formal written recovery plan within **2 business days**.
2. **15% Budget Variance Rule**:
   - If any individual budget line deviates by **>15%** from approved allocations, non-essential spending on that line is automatically locked.
   - Farm Manager must escalate to the CEO within **48 hours**.
3. **Point Staffing Coverage Guard**:
   - The system prevents approving leave that would leave a Production Point without both its Technician and Comissionário simultaneously.
4. **48-Hour Sales Settlement Escalation**:
   - Cashew commercial sales batches cannot close without financial payment confirmation. Payments unconfirmed after **48 hours** escalate directly to N2.

### 4.3 AI Copilot Persona for the Farm Manager
When the Farm Manager interacts with the integrated AI Copilot:
- **Lead with Exceptions**: Focuses on discrepancies, blocked workflows, and upcoming deadlines rather than routine data.
- **Exact Numeric Rigour**: Quotes exact metrics (e.g., "+16.2% fuel variance on tractor #1") without rounding or approximations.
- **Traceable Source Citations**: Links every insight directly to its source register (`ADM-WTR-01`, `PROD-FIELD`, `ADM-BDG-01`).
- **No Autonomous Approvals**: Frames decision options clearly while reserving approval authority for the Farm Manager.

---

## 5. System Architecture, Offline Sync & Technology Stack

```
                              +-------------------------------+
                              |    Cloud / Point B Server     |
                              |   (PostgreSQL + Node API)     |
                              +---------------+---------------+
                                              ^
                                              | HTTPS / WSS Sync
                                              v
                 +----------------------------+----------------------------+
                 |                                                         |
                 v                                                         v
  +-------------------------------+                         +-------------------------------+
  |   Point B Operational Centre  |                         | Field Units (Points A, B, C)  |
  |     Desktop / Web Client      |                         | Mobile Client (Offline-First) |
  | (Admin, PM, FM, CEO, Finance) |                         | (Technicians, Operators, Crew)|
  | - Full Dashboards & Workflows |                         | - Local SQLite / IndexedDB    |
  | - Biometric Time-Clock Sync   |                         | - Auto-queue background sync  |
  | - Multi-Format Exporters      |                         | - Low-literacy touch UI       |
  +-------------------------------+                         +-------------------------------+
```

### 5.1 Technology Recommendations

| System Tier | Technology Choice | Architectural Justification |
|---|---|---|
| **Database** | **PostgreSQL 16+** with PostGIS | Enterprise-grade relational integrity, JSONB support for dynamic checklists, and spatial indexing for farm plots and boundary mapping. |
| **Backend API Engine** | **Node.js (NestJS / Express) with TypeScript** / **Python FastAPI** | Strongly typed architecture, high-throughput asynchronous job queues for report compilation, and modular service-oriented structure. |
| **Web Admin Application** | **Next.js / React with TypeScript & Tailwind CSS** | Fast desktop interface for Point B office, rich data tables, live KPI monitoring, and role-based route guards. |
| **Field Mobile Application** | **React Native (Expo) / Flutter / Offline PWA** | Native **offline-first** data capture with local **WatermelonDB / SQLite**, device camera integration, touch signatures, and GPS geotagging. |
| **Biometric Time-Clock Interface** | **Pluggable Adapter Pattern** | Base implementation supports daily CSV/DAT file imports from the Point B time-clock, with an extensible socket/API interface for future direct network sync. |
| **Document Generation Engine** | **docx, exceljs, pptxgenjs, pdfmake** | Programmatic server-side compilation of native Word narrative reports, Excel data sheets, PowerPoint decks, and WhatsApp-ready PDF summaries. |
| **i18n Localization Engine** | **i18next / FormatJS** | Centralized translation dictionary supporting dynamic locale switching across **Portuguese (Mozambique)**, **English (UK)**, and **Traditional Chinese (Taiwan)**. |

---

## 6. Administration Module Functional Specifications

### 6.1 `ADM-ATT-01` — Attendance & Workforce Rotation
- **Purpose**: Digitize daily attendance, rotation tracking (14 days on-site / 2 days off), and leave management for all 33 permanent employees.
- **Fields**: Employee ID, Full Name, Role, Production Point, Clock-in/Clock-out timestamps, Daily Status (`Present`, `Absent`, `Folga_Rotation`, `Mission`, `Medical_Leave`, `Annual_Leave`), Rotation cycle calendar.
- **Business Rules**:
  - Automatically calculates on-site rotation rosters.
  - **Coverage Guard**: Blocks leave submissions if both the Technician and Comissionário of a Production Point would be absent concurrently.
  - **Medical Certificate Enforcement**: Sick leave exceeding 3 consecutive days mandates a PDF/photo attachment before submission.
  - **Notice Period**: Regular annual leave requires a minimum of 2 weeks' notice; emergency leave triggers an escalation tag.
  - **Substitute Designation**: Enables the Farm Coordinator to assign a temporary delegate for the Admin Manager when on leave.

### 6.2 `ADM-WTR-01` — Water Borehole Monitoring
- **Purpose**: Weekly meter tracking across all 6 boreholes (2 per Point: 1 operational, 1 reserve).
- **Fields**: Production Point (A/B/C), Borehole ID, Meter Reading (m³), Reading Timestamp, Recording Technician ID, Calculated Delta Consumption.
- **Cadence & Business Rules**:
  - Readings taken every **Monday by 08:30** by Field Technicians.
  - Operations Support Officer consolidates all readings by **12:00 Monday**.
  - **Leak / Anomaly Trigger**: If weekly consumption exceeds **120% of the trailing 30-day average**, the system flags the borehole, alerts the Operations Support Officer and Production Manager, and prompts an on-site pipeline inspection.

### 6.3 `ADM-FOOD-01` — Kitchen & Food Stock Management
- **Purpose**: Manage daily food provisioning for permanent staff (3 meals/day: breakfast, lunch, dinner) at Point B.
- **Fields**: Stock Item, Category (Dry Goods, Fresh, Grains, Oil, Gas), Quantity In/Out/Balance, Unit, Expiration Date, Kitchen Facility (`Indoor_Gas` vs. `Outdoor_Wood`), Daily Meal Count Served.
- **Business Rules**:
  - Expiry alert triggers 14 days prior to expiration.
  - Automatic deduction of raw ingredients based on meal counts and standard ration templates.
  - Low-stock warning when cover falls below 7 days.

### 6.4 `ADM-FUEL-01` — Fuel Management
- **Purpose**: Track diesel and petrol disbursements from the 100 L drum reserve (and future 500 L metered tank) for tractors, vehicles, and stationary generators.
- **Fields**: Date/Time, Vehicle/Equipment ID, Production Point/Plot, Activity Executed, Litres Dispensed, Remaining Stock Balance, Operator/Driver ID, Odometer / Hour-meter reading.
- **Business Rules**:
  - Weekly consumption audit by Production Manager.
  - **Variance Gate**: Any unexplained consumption variance **>10%** (litres consumed vs. standard consumption per hour/hectare) triggers an anomaly flag that must be justified in the Monthly Foundation Report.

### 6.5 `ADM-GEN-01` — Generator & Solar Energy Log
- **Purpose**: Log diesel generator activations used strictly as a backup when the primary solar array is insufficient.
- **Fields**: Start Timestamp, Stop Timestamp, Operating Hours, Reason for Activation (`Solar_Deficit`, `Grid_Failure`, `High_Load_Maintenance`), Fuel Consumed (L), Maintenance Status.

### 6.6 `ADM-CFW` — Cash-for-Work (CFW) Programme Lifecycle
- **Purpose**: End-to-end administration of the seasonal temporary labour programme.
- **Fields**:
  - *Worker Registry*: Worker ID, Full Name, National ID/Voter ID, Home Community, Assigned Production Point, Eligibility Status.
  - *Daily Targets*: Activity Type, Daily Unit Target (e.g., linear metres weeded, trees pruned), Agreed Rate.
  - *Daily Attendance & Verification*: Worker Name, Activity, Target Achieved (Pass/Fail/Partial), Supervisor Co-signature.
  - *Weekly Submission*: Auto-compiled every **Thursday** for HR/Finance detailing days worked, budget consumed, forecast for remaining month.
  - *Monthly CFW Plan*: Formulated by the 25th of the prior month, requiring Foundation approval prior to execution.
- **Strict Constraint**: **CFW Pay Rates are read-only** for all farm personnel (including N2 and N3). Rate modifications require an authorized Foundation HR configuration update.
- **Quality Control**: Tracks rework rates per crew; flags workers with persistent quality deficits to the Production Manager.

### 6.7 `ADM-BDG-01` — Monthly Budgeting & Financial Control
- **Purpose**: Monthly budget preparation, expense tracking, and variance reconciliation with Foundation Finance.
- **Fields**: Budget Line Code, Cost Centre, Category, Requested Amount, Approved Amount, Actual Spend, Variance (%), Narrative Justification, Month/Year.
- **Deadlines & Rules**:
  - Budget requests for the subsequent month are due on the **20th of the current month**.
  - **15% Variance Justification Rule**: Any budget line exceeding the prior month’s approved value by **>15%** requires a mandatory narrative justification before submission. The system blocks submission if missing.

### 6.8 `ADM-INV-01` & `ADM-DRY-01` — Warehouse, Post-Harvest & Drying Management
- **Warehouse (≈800 m²)**:
  - Tracks agricultural inputs (fertilizers, pesticides, pruning shears, bags) and processed output batches.
  - Dual-signed receipts: Inbound linked to Foundation Logistics *Livro de Entradas*; Outbound linked to *Livro de Saídas* (requires Farm Manager authorization).
  - Weekly random inventory audit (Monday/Tuesday) comparing physical stock to ledger; monthly stock declaration submitted by the **5th of each month**.
  - Discrepancy reconciliation required within **3 business days**.
- **Drying Area (≈600 m²)**:
  - Booking calendar allocating surface area among crops (cashew, grains, legumes).
  - **Contamination Prevention**: Prevents overlapping bookings for incompatible crops or consecutive uncleaned batches.

### 6.9 `ADM-TOOL-01` — Tool Inventory & Allocation Register
- **Fields**: Tool ID/Type, Quantity, Assigned Team/Point, Dispatch Date, Return Date, Tool Condition (`Good`, `Needs_Repair`, `Scrapped`), Digital Signature.
- **Rule**: End-of-day discrepancy flag for unreturned field tools.

### 6.10 `ADM-FAK-01` & Facility Hygiene
- **First Aid (`ADM-FAK-01`)**: Kit tracking across Points A, B, C, and Main Office. Logs incidents, injury types, supplies consumed, and hospital referrals. Monthly report submitted to Foundation Health Dept by the **5th**.
- **Hygiene & Maintenance**: Daily sanitary/rest-area checklists for each Point. Urgent faults (e.g., water disruption, damaged doors) automatically generate Maintenance Work Orders assigned to the Admin Manager.

---

## 7. Production Module Functional Specifications

```
+-----------------------------------------------------------------------------------+
|                            PRODUCTION MODULE WORKFLOW                             |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [PROD-PAP] Annual Production Plan                                                |
|  - Targets by Crop, Hectare, and Activity                                         |
|  - Approved by Top Manager (N1) -> Locks KPI Meta Values                          |
|                               |                                                   |
|                               v                                                   |
|  [PROD-FIELD] Field Activity & Production Points                                  |
|  - Technicians log daily diaries at Points A, B, C (Offline-First)                |
|  - Anomaly detection (<1 hr photo/GPS escalation)                                 |
|  - Weekly completion rate target >= 90%                                           |
|                               |                                                   |
|                               +------------------+                                |
|                               v                  v                                |
|  [PROD-MECH] Mechanization              [PROD-HARVEST] Post-Harvest               |
|  - Pre-op checklist (Pass/Fail)         - Batch reception & classification        |
|  - "IMMOBILIZED" safety interlock       - Drying area allocation (ADM-DRY-01)     |
|  - Weekly scheduling (Wed/Thu)          - Final packaging & Warehouse intake      |
|  - Fuel & hour meter sync               - Commercial sale / donation tracking     |
|                               |                  |                                |
|                               +------------------+                                |
|                               |                                                   |
|                               v                                                   |
|  [PROD-KPI] Performance & Evaluation Engine                                       |
|  - Role scorecards N1 to N7 tied directly to PAP Metas                            |
|  - Qualitative supervisor evaluation (20% weight)                                 |
|  - Scoring Bands: Insufficient (0-49), Reasonable (50-69), Good (70-84), Exc (85+) |
|  - Monthly consolidated KPI report to CEO (+-10% tolerance triggers)              |
+-----------------------------------------------------------------------------------+
```

### 7.1 `PROD-PAP` — Annual Production Plan & Strategic Targets
- Defines annual targets by crop, plot, hectare, and operational activity.
- Undergoes quarterly review cycles.
- Approval workflow: `Production Manager (Draft)` → `Admin Manager (Review)` → `Farm Coordinator (Consolidation)` → `Top Manager (N1 Approval)`.
- Approval locks the operational targets as the baseline **Meta** values for all downstream KPI scorecards.

### 7.2 `PROD-FIELD` — Field Activities & Production Point Tracking
- **Scope**: Covers 3 Production Points (A, B, C) and internal plot divisions across the 200-hectare footprint.
- **Fields**: Point ID, Plot ID, Activity Type (`Land_Prep`, `Planting`, `Weeding`, `Pruning`, `Spraying`, `Irrigation`, `Harvest`), Area Covered (ha), Assigned Team, Materials Applied.
- **Inspection & Anomaly Standards**:
  - Fields inspected at least **twice weekly** (Monday and Thursday), or **daily** during pest/disease vulnerability periods.
  - **1-Hour Anomaly SLA**: Serious anomalies (pest outbreaks, fungal infections, irrigation failure) must be logged and transmitted within **1 hour** of discovery, accompanied by GPS coordinates and photographic evidence.
  - **Activity Completion SLA**: Field teams must achieve **≥90%** of scheduled weekly tasks. Shortfalls require recorded root-cause analysis and recovery schedules.

### 7.3 `PROD-MECH` — Tractor & Mechanization Management
- **Pre-Operation Checklist**:
  - Mandatory mobile inspection (engine oil, radiator coolant, tyre pressure, hydraulic lines, brakes, safety lighting) before turning the key.
  - **IMMOBILIZED Interlock**: If any safety check fails, the unit is automatically flagged `IMMOBILIZED` in the system, blocking usage logging, and an alert is broadcast to the Production Manager within 15 minutes.
- **Weekly Schedule**:
  - Technicians submit machine requests by **Wednesday 15:00**.
  - Tractor Operator and Production Manager finalize and distribute the schedule by **Thursday 17:00**.
- **Maintenance**: Routine servicing logged every Monday (cleaning, air filters, grease points).

### 7.4 `PROD-KPI` — Performance Evaluation Engine
- **Evaluation Cadence**: Annual formal evaluation with monthly checkpoint tracking.
- **Scorecard Structure**:
  - **Quantitative Targets (≈80% weight)**: Sourced directly from locked PAP Metas vs. Realizado (actual logged performance).
  - **Qualitative Evaluation (≈20% weight)**: Entered strictly and exclusively by the direct supervisor.
- **Official SOP Scoring Bands**:
  - **0 – 49**: *Insuficiente* (Insufficient)
  - **50 – 69**: *Razoável* (Reasonable)
  - **70 – 84**: *Bom* (Good)
  - **85 – 100**: *Excelente* (Excellent)
- **Oversight**: Consolidated KPI dashboard flags any department or role deviating by more than **±10%** from benchmark expectations.

### 7.5 `PROD-HARVEST` — Harvest, Processing & Commercialization
- **Cashew Processing Workflow**:
  1. *Field Harvest*: Batch recorded by Point, date, harvest crew, raw weight.
  2. *Reception & Classification*: Quality grading (Nut count, Outturn rate, moisture content, defect percentage).
  3. *Drying Operations*: Linked directly to `ADM-DRY-01` drying surface booking.
  4. *Packaging & Warehouse Intake*: Transition to finished goods inventory in `ADM-INV-01`.
  5. *Commercialization / Donation*: Tracks buyer/beneficiary, volume, unit pricing, payment authorization.
- **48-Hour Payment Rule**: Transactions cannot close without recorded bank payment confirmation. Unresolved payments past 48 hours escalate directly to the Farm Coordinator.

---

## 8. Cross-Cutting Engines: Trilingual Architecture, Reporting & Alerts

### 8.1 Trilingual Architecture Specification

| Locale Code | Language & Region | Primary Purpose & System Usage | Style & Conventions |
|---|---|---|---|
| **`pt-MZ`** | **Portuguese (Mozambique)** | **Operational Default UI** (Field roles, Production Points, Main Office, daily farm operations) | Mozambique-standard terminology matching PON-AGR-MEC-V2.0; 24h time; metric units. |
| **`en-GB`** | **English (UK)** | **Technical & Partner Interface** (Technical support, international agronomists, external audit) | British English spelling ("litres", "organisation", "kilometres"); DD/MM/YYYY dates. |
| **`zh-TW`** | **Traditional Chinese (Taiwan)** | **Institutional & Foundation Reporting** (Farm Coordinator reporting to Tzu Chi Council & Foundation) | Traditional Chinese characters (繁體中文); Taiwan standard agricultural & managerial terminology. |

- **Per-User Locale Preference**: Users select and persist their preferred language profile across all devices.
- **Zero Hard-Coding**: All UI labels, form fields, validation messages, error dialogs, and report templates are externalized into structured JSON dictionary bundles.

### 8.2 SOP Institutional Reporting Calendar

| Report Package | Due Deadline | Recipients | Output Formats |
|---|---|---|---|
| **Weekly Operational Summary** | Fridays @ 17:00 | FM, PM, Admin Manager, Coordinator | PDF / WhatsApp / Web Dashboard |
| **Weekly Inventory & Asset Check** | Mondays / Tuesdays | Admin Manager | Interactive Web Audit View |
| **Monthly Admin Report Package** | 5th of every month | FM, CEO, Foundation HR/Finance | Word (`.docx`) + Excel (`.xlsx`) + PowerPoint (`.pptx`) |
| **Monthly Stock Declaration** | 5th of every month | Foundation Logistics Coordinator | Excel (`.xlsx`) / PDF |
| **Monthly Health & Incident Log** | 5th of every month | Foundation Health Department | PDF / Word (`.docx`) |
| **Monthly Budget Request** | 20th of the month | Foundation Finance Department | Excel / Interactive Approval Portal |
| **Monthly CFW Plan** | 25th of the month | Foundation Central HR | Excel / PDF |
| **Monthly Council Strategic Report** | 28th of the month | Tzu Chi Council | Word / PPTX / Traditional Chinese (`zh-TW`) |

---

## 9. Core Data Model & Database Architecture

```sql
-- 1. Employees & Hierarchy
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role_level VARCHAR(5) NOT NULL CHECK (role_level IN ('N1', 'N2', 'N3', 'N5', 'N6', 'N7')),
    role_title VARCHAR(50) NOT NULL,
    department VARCHAR(50) NOT NULL,
    assigned_point VARCHAR(10) CHECK (assigned_point IN ('Point_A', 'Point_B', 'Point_C', 'Central')),
    contract_type VARCHAR(20) NOT NULL CHECK (contract_type IN ('Permanent', 'Seasonal_CFW', 'Contractor')),
    rotation_status VARCHAR(20) DEFAULT 'On_Site',
    preferred_language VARCHAR(10) DEFAULT 'pt-MZ' CHECK (preferred_language IN ('pt-MZ', 'en-GB', 'zh-TW')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Water Monitoring (ADM-WTR-01)
CREATE TABLE boreholes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    borehole_code VARCHAR(20) UNIQUE NOT NULL,
    production_point VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('Operational', 'Reserve', 'Maintenance')),
    flow_meter_serial VARCHAR(50)
);

CREATE TABLE water_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    borehole_id UUID REFERENCES boreholes(id),
    reading_value_m3 NUMERIC(10, 2) NOT NULL,
    previous_value_m3 NUMERIC(10, 2) NOT NULL,
    consumption_delta_m3 NUMERIC(10, 2) GENERATED ALWAYS AS (reading_value_m3 - previous_value_m3) STORED,
    reading_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    reader_technician_id UUID REFERENCES employees(id),
    is_anomaly BOOLEAN DEFAULT FALSE,
    anomaly_threshold_m3 NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Cash-For-Work Registry & Attendance (ADM-CFW)
CREATE TABLE cfw_workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_code VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    national_id VARCHAR(50),
    community VARCHAR(100),
    assigned_point VARCHAR(10) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE cfw_attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_date DATE NOT NULL,
    worker_id UUID REFERENCES cfw_workers(id),
    production_point VARCHAR(10) NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    daily_target_assigned NUMERIC(8, 2) NOT NULL,
    target_completed NUMERIC(8, 2) NOT NULL,
    quality_status VARCHAR(20) CHECK (quality_status IN ('Approved', 'Rework_Required', 'Rejected')),
    locked_hourly_rate NUMERIC(10, 2) NOT NULL, -- Locked; Foundation HR ownership
    total_payment_due NUMERIC(10, 2) NOT NULL,
    supervisor_technician_id UUID REFERENCES employees(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Fuel & Mechanization Logs (ADM-FUEL-01 & PROD-MECH)
CREATE TABLE equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('Tractor', 'Truck', 'Motorcycle', 'Generator', 'Implement')),
    is_immobilized BOOLEAN DEFAULT FALSE,
    immobilized_reason TEXT,
    last_service_date DATE
);

CREATE TABLE fuel_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_date TIMESTAMP WITH TIME ZONE NOT NULL,
    equipment_id UUID REFERENCES equipment(id),
    operator_id UUID REFERENCES employees(id),
    litres_dispensed NUMERIC(8, 2) NOT NULL,
    remaining_stock_balance NUMERIC(8, 2) NOT NULL,
    activity_description TEXT NOT NULL,
    hour_meter_reading NUMERIC(10, 1),
    odometer_km NUMERIC(10, 1),
    variance_percentage NUMERIC(5, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Monthly Budgeting (ADM-BDG-01)
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year INT NOT NULL,
    fiscal_month INT NOT NULL CHECK (fiscal_month BETWEEN 1 AND 12),
    status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted_Pending', 'Approved', 'Frozen')),
    submitted_by UUID REFERENCES employees(id),
    submission_date TIMESTAMP WITH TIME ZONE
);

CREATE TABLE budget_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID REFERENCES budgets(id),
    line_code VARCHAR(30) NOT NULL,
    category VARCHAR(50) NOT NULL,
    requested_amount NUMERIC(12, 2) NOT NULL,
    approved_amount NUMERIC(12, 2) DEFAULT 0.00,
    actual_spent NUMERIC(12, 2) DEFAULT 0.00,
    previous_month_amount NUMERIC(12, 2) DEFAULT 0.00,
    variance_percentage NUMERIC(5, 2) GENERATED ALWAYS AS (
        CASE WHEN previous_month_amount > 0 
        THEN ((requested_amount - previous_month_amount) / previous_month_amount) * 100 
        ELSE 0 END
    ) STORED,
    narrative_justification TEXT, -- Mandated if variance_percentage > 15.00
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Production Field Diaries & Anomalies (PROD-FIELD)
CREATE TABLE field_plots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plot_code VARCHAR(20) UNIQUE NOT NULL,
    production_point VARCHAR(10) NOT NULL,
    area_hectares NUMERIC(6, 2) NOT NULL,
    primary_crop VARCHAR(50) DEFAULT 'Cashew',
    gps_polygon JSONB
);

CREATE TABLE field_diaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diary_date DATE NOT NULL,
    plot_id UUID REFERENCES field_plots(id),
    technician_id UUID REFERENCES employees(id),
    activity_type VARCHAR(50) NOT NULL,
    hectares_covered NUMERIC(6, 2) NOT NULL,
    materials_used JSONB,
    observations TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE field_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plot_id UUID REFERENCES field_plots(id),
    reported_by UUID REFERENCES employees(id),
    anomaly_type VARCHAR(50) NOT NULL CHECK (anomaly_type IN ('Pest_Infestation', 'Fungal_Disease', 'Irrigation_Fault', 'Wildfire_Damage', 'Other')),
    severity VARCHAR(20) CHECK (severity IN ('Low', 'Medium', 'Critical_Urgent')),
    gps_location JSONB,
    photo_urls TEXT[],
    reported_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    manager_resolution_notes TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE
);
```

---

## 10. Phased Implementation Roadmap & Build Plan

Following Section 11 of `Specification (1).md`, the build is strictly organized into six sequential, self-contained phases.

```
+-----------------------------------------------------------------------------------+
|                        SIX-PHASE IMPLEMENTATION TIMELINE                          |
+-----------------------------------------------------------------------------------+
| Weeks 1-2:   Phase 1 - Foundation (Data Models, RBAC N1-N7, Offline Sync & Audit) |
| Weeks 3-5:   Phase 2 - Core Daily Administration (Attendance, Water, Fuel, Food)  |
| Weeks 6-8:   Phase 3 - Warehouse, Assets & Facilities (Inv, Drying, Tools, FAK)   |
| Weeks 9-11:  Phase 4 - Cash-for-Work & Budgeting (CFW Lifecycle, Budget Variance) |
| Weeks 12-14: Phase 5 - Production Side (PAP, Field Diaries, Tractors, KPI, Harvest)|
| Weeks 15-16: Phase 6 - Reporting, Trilingual Verification & Institutional Hardening|
+-----------------------------------------------------------------------------------+
```

### Phase 1 — Foundation (Weeks 1–2)
*The core structural layer on which all modules depend.*
- Deploy relational schema: `Employee`, `ProductionPoint`, `FieldPlot`, `Borehole`, `Equipment`, `Budget`, and audit entity tables.
- Implement N1–N7 Role-Based Access Control and authentication with refresh token lifecycle.
- Engineer the client-side **Offline-First Synchronization Engine** (local persistence, action queue, conflict resolution, timestamp reconciliation).
- Implement the immutable **Audit-Trail Subsystem** logging all actor actions.
- Build the biometric time-clock ingestion adapter pattern for Point B.

### Phase 2 — Core Daily Administration (Weeks 3–5)
*Digitizing high-frequency daily operational logs.*
- `ADM-ATT-01`: Attendance panel, biometric import, 14/2 rotation calendar, leave requests, and the **Point Coverage Guard** (blocking concurrent absence of Technician and Comissionário).
- `ADM-WTR-01`: Borehole reading register with Monday 08:30 SLA tracking and **>120% 30-day average anomaly detection**.
- `ADM-FUEL-01` & `ADM-GEN-01`: Daily fuel logs, **>10% variance anomaly engine**, and solar/generator runtime records.
- `ADM-FOOD-01`: Kitchen stock registers, 3-meal headcount deduction, and 14-day expiry warning triggers.

### Phase 3 — Warehouse, Assets & Facilities (Weeks 6–8)
*Physical inventory, equipment custody, and site hygiene.*
- `ADM-INV-01` & `ADM-DRY-01`: Warehouse entry/exit dual-signed logs, monthly stock declaration generator, weekly audit reconciliation, and **drying area rotation contamination guards**.
- `ADM-TOOL-01`: Tool dispatch, digital signature sign-offs, and end-of-day unreturned tool alerts.
- `ADM-FAK-01`: First aid occurrence register and monthly Health Department report generator.
- Facility hygiene checklists and automated Maintenance Work Order workflows.

### Phase 4 — Cash-for-Work & Budgeting (Weeks 9–11)
*High-compliance administrative and financial control workflows.*
- `ADM-CFW`: Seasonal worker registry, daily target management, mobile attendance verification, auto-compiled Thursday weekly submissions, monthly CFW plan (due 25th), and **read-only Foundation pay-rate enforcement**.
- `ADM-BDG-01`: Monthly budget request workflow (due 20th), **>15% variance narrative blocker**, actual-vs-approved tracking, and spending freeze triggers.

### Phase 5 — Production Side (Weeks 12–14)
*Field operations, mechanization, and harvest workflows.*
- `PROD-PAP`: Annual Production Plan formulation, review workflows, and locked Meta baseline values.
- `PROD-FIELD`: Mobile field diaries for Points A, B, and C with offline GPS/photo capture, **1-hour anomaly escalation SLA**, and ≥90% weekly task completion metrics.
- `PROD-MECH`: Mandatory pre-op checklist with **15-minute IMMOBILIZED safety interlock**, tractor work logs, and weekly scheduling module.
- `PROD-KPI`: Scorecards for roles N1–N7, locked PAP Metas, qualitative supervisor scoring (20% weight), and official SOP scoring bands.
- `PROD-HARVEST`: Cashew intake, quality classification, drying allocation, finished inventory transfer, and **48-hour commercial sales payment escalation rule**.

### Phase 6 — Reporting, Trilingual Verification & Institutional Hardening (Weeks 15–16)
*Closing the cross-module reporting loop and enterprise validation.*
- Deploy automated Reporting Engine (Weekly WhatsApp/PDF, Monthly Admin Package in Word/Excel/PowerPoint, Monthly Council Report).
- Configure dedicated role dashboards (featuring the **Farm Manager N2 Exception View** and **CEO N1 Strategic View**).
- Validate complete **Trilingual Localization (`pt-MZ`, `en-GB`, `zh-TW`)** across all forms, dialogs, validation messages, and document templates.
- End-to-end field simulation testing under rural low-bandwidth conditions across Points A, B, and C.
- Comprehensive security audit and permission review against Section 4 and Section 9.

---

## 11. Non-Functional Requirements & Definition of Done

### 11.1 Non-Functional Performance & Quality Standards
- **Offline Autonomy**: Zero data loss during disconnected field operations; background synchronization queues automatically reconcile transactions upon reconnection.
- **System Responsiveness**: Office dashboards and reports load in **<3 seconds** on Point B local network.
- **Trilingual Completeness**: 100% of UI strings externalized into translatable JSON bundles; per-user preference persisted across sessions.
- **Audit Traceability**: Every register entry, modification, approval, and rejection is permanently linked to an immutable actor and timestamp record.
- **Data Protection & Backup**: Automated daily differential backups and weekly encrypted off-site snapshots; AES-256 encryption at rest and TLS 1.3 in transit.

### 11.2 Definition of Done (Module Acceptance Criteria)
In strict adherence to `ROLE.md` Section 4, no module is marked complete until:
1. Every field and register specified in PON-AGR-MEC-V2.0 is accurately captured and persisted.
2. Every business rule, threshold trigger, deadline SLA, and approval gate is programmatically enforced.
3. Access permissions match the N1–N7 hierarchy exactly (including locked Foundation fields).
4. Offline data entry, local queuing, and conflict-safe synchronization are fully verified on mobile clients.
5. All underlying operational data feeds accurately into the automated Weekly, Monthly, and Institutional Report Exporters.
6. A complete, immutable audit trail is recorded on all create, edit, approve, and reject actions.

---

*This document serves as the formal architectural blueprint and project proposal for the Unidade Produtiva de Mecuzi Farm Daily Production & Administration Management System.*
