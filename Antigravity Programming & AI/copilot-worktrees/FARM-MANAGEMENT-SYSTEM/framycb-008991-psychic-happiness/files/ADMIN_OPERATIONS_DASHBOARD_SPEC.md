# Mecuzi Farm Management — Administrative Operations Dashboard
## System Integration Specification

**Module:** Departamento Administrativo (Administrative Department)
**Target system:** Mecuzi Farm Management (existing web app — PT-MZ locale)
**Prepared for:** System integration / AI build handoff (Kimi)
**Source SOP:** `DEPARTAMENTO_ADMINISTRATIVO_FOR_SYSTEM_Integration.docx`, sections 2.2.7–2.2.14
**Status:** Ready for build

---

## 1. Purpose & Design Decision

The Administrative Department SOP defines 8 roles under a single manager (Gestor/a
Administrativo/a) organized into 3 functional units:

- **Finance & Compliance** (Responsável Financeiro/a e de Conformidade)
- **Operations Support** (Responsável de Apoio Operacional → Motorista, Assistente de Armazém)
- **Human & Facility Services** (Responsável de Serviços ao Colaborador e Instalações →
  Cozinheiro/a, Auxiliar de Limpeza)

**Decision: build ONE dashboard — "Painel de Operações Administrativas" — with 3
role-scoped sections, not three separate dashboards.**

Rationale:
- The Admin Manager's core function per the SOP is to supervise all three units and
  consolidate their reports upward to the Farm Coordinator (2.2.7, responsibility #8–9).
  That only works if all three units are visible in one place, one navigation shell.
- Each unit head sees only their own section by default — this reuses the existing
  scoping pattern already live in the system (Production Manager reviewing Technician
  submissions).
- The 4 operational roles (Driver, Warehouse Assistant, Cook, Cleaning Assistant) do not
  get dashboard sections — they get logins into a shared, lightweight **"Operational Data
  Entry"** interface (one shell, 4 different forms), following the same offline-capable
  pattern already used for Farm Technician.

Net new scope: **8 roles**, **1 new dashboard with 3 sections**, **1 shared operational
entry interface with 4 form variants**.

---

## 2. Role Hierarchy & System Roles

| # | SOP Role (PT) | Level | Reports to | System Role Key | Interface |
|---|---|---|---|---|---|
| 1 | Gestor/a Administrativo/a | N3 | Coordenador/a da Fazenda (N2) | `admin_manager` | Painel de Operações Administrativas (all 3 sections, read/write + consolidation) |
| 2 | Responsável Financeiro/a e de Conformidade | N5 | Gestor/a Administrativo/a | `finance_compliance_lead` | Painel — Section: Finance & Compliance only |
| 3 | Responsável de Apoio Operacional | N5 | Gestor/a Administrativo/a | `operations_support_lead` | Painel — Section: Operations Support only |
| 4 | Motorista | N6 | Responsável de Apoio Operacional | `driver` | Operational Data Entry — Driver form |
| 5 | Assistente de Armazém | N7 | Responsável de Apoio Operacional | `warehouse_assistant` | Operational Data Entry — Warehouse form |
| 6 | Responsável de Serviços ao Colaborador e Instalações | N5 | Gestor/a Administrativo/a | `hr_facility_lead` | Painel — Section: Human & Facility Services only |
| 7 | Cozinheiro/a | N7 | Responsável de Serviços ao Colaborador e Instalações | `cook` | Operational Data Entry — Kitchen form |
| 8 | Auxiliar de Limpeza | N7 | Responsável de Serviços ao Colaborador e Instalações | `cleaning_assistant` | Operational Data Entry — Cleaning form |

All 8 roles are provisioned the same way as existing roles: TZ# employee number,
full name, phone (SMS OTP), role assignment, PIN — via the existing **"Colaboradores &
PINs"** screen (Administração & Auditoria interface), with a **Resetar PIN** action per
row, identical to the pattern already shown in the current build.

---

## 3. Dashboard Architecture — "Painel de Operações Administrativas"

### 3.1 Navigation shell (reuses existing shell components)

Same top bar as existing screens: logo/unit name, global search, **PAPEL** badge (role
label), **Sair**, connectivity indicator, **IDIOMA** selector, **Assistente AI**.

Left sidebar for this dashboard:

```
Painel de Operações Administrativas
├── Visão Geral (Admin Manager only — consolidated view)
├── Finança & Conformidade
├── Apoio Operacional
├── Serviços ao Colaborador & Instalações
├── Relatórios Consolidados
└── Configurações
```

- **Admin Manager (`admin_manager`)**: sees all sidebar items, all 3 sections in
  read/write, plus "Visão Geral" (cross-unit summary) and "Relatórios Consolidados".
- **Unit leads** (`finance_compliance_lead`, `operations_support_lead`,
  `hr_facility_lead`): sidebar shows only their own section by default (same
  visual pattern as the existing "Colaboradores & PINs" active-item highlight in the
  screenshot) — other two sections are hidden, not just disabled. "Visão Geral" and
  "Relatórios Consolidados" are hidden for unit leads.
- Section header banner (green, matching existing "Painel de Administração" banner
  style) shows: dashboard title, logged-in user's name + role in parentheses, one-line
  purpose subtitle — same layout as `Painel de Administração — Helena Macuacua (Admin &
  RH)` in the reference screenshot.
- Critical-alerts strip (orange "N CRÍTICOS" pill + chip list, collapsible) is reused
  unchanged from the existing pattern, filtered to alerts relevant to whichever
  section(s) the logged-in role can see.

### 3.2 Access control rule

A unit lead account querying another unit's endpoint returns `403`. The Admin Manager
role is the only role with cross-unit read access. This must be enforced server-side,
not just hidden in the UI.

---

## 4. Section: Finança & Conformidade (Finance & Compliance)

Owner role: `finance_compliance_lead`. Visible read-only to `admin_manager`.

### 4.1 Sub-views
1. **Orçamento Operacional** — budget by culture (talhão/crop) and by activity.
   Create/edit budget lines, compare planned vs. actual.
2. **Pagamentos** — record and track payments to suppliers, service providers, and
   workers. Status: Pendente / Pago / Rejeitado.
3. **Cost Tracking** — cost-by-culture and cost-by-activity rollups, sourced from
   Pagamentos + Procurement records.
4. **Controlo de Procurement** — purchase requests queue: verify compliance and
   authorization before a purchase is marked processed. Approve / Reject / Request Info.
5. **Reconciliação de Stock** — periodic valuation and reconciliation of input/product
   stock (reads from Armazém data owned by Operations Support; write access only to
   the reconciliation record, not the underlying stock ledger).
6. **Reconciliação de Caixa** — cash reconciliation log, transaction accuracy checks.
7. **Relatórios Financeiros** — generate monthly / quarterly / annual financial
   reports for submission to Admin Manager and the Fundação. Export to PDF/XLSX.
8. **Documentação** — repository for financial/admin documents prepared for
   submission or translation (upload, tag, status: Rascunho / Pronto / Submetido).

### 4.2 Data entities
`budget_line`, `payment`, `cost_entry`, `procurement_request`, `stock_reconciliation`,
`cash_reconciliation`, `financial_report`, `document_record`.

---

## 5. Section: Apoio Operacional (Operations Support)

Owner role: `operations_support_lead`. Visible read-only to `admin_manager`.
Supervises `driver` and `warehouse_assistant` submissions.

### 5.1 Sub-views
1. **Inventário & Stocks** — agricultural input inventory (seeds, fertilizer,
   pesticides, tools). Levels, thresholds, low-stock flags.
2. **Requisições de Campo** — input-distribution requests validated by Farm
   Technicians; approve, mark distributed.
3. **Pós-Colheita** — post-harvest operations log: reception, grading, weighing,
   packaging, storage, per batch.
4. **Logística de Transporte** — vehicle/tractor/truck assignment and internal
   transport coordination; feeds from Motorista trip logs.
5. **Registos de Armazém** — warehouse in/out ledger for all inputs and finished
   product; feeds from Assistente de Armazém entries.
6. **Leituras dos Furos de Água** — weekly borehole/water-meter readings,
   consolidated for submission to Admin Manager (this is the "Furo 2: Anomalia >120%"
   alert type visible in the existing critical-alerts strip — reuse that alert
   definition here).
7. **Gestão de Resíduos** — waste sorting/routing log, monthly Centro Metuchira
   shipment tracking.
8. **Coordenação de Colheita** — harvest coordination calendar/checklist.
9. **Supervisão da Equipa** — read view of Motorista + Assistente de Armazém
   submissions awaiting review, with approve/flag actions.

### 5.2 Data entities
`inventory_item`, `field_requisition`, `postharvest_batch`, `transport_log`,
`warehouse_ledger_entry`, `borehole_reading`, `waste_log`, `harvest_task`.

---

## 6. Section: Serviços ao Colaborador & Instalações (Human & Facility Services)

Owner role: `hr_facility_lead`. Visible read-only to `admin_manager`.
Supervises `cook` and `cleaning_assistant` submissions.

### 6.1 Sub-views
1. **Refeições & Plano Nutricional** — daily meal service oversight, nutrition
   plan compliance tracking; feeds from Cozinheiro/a entries.
2. **Stock de Cozinha** — daily food/kitchen-consumables stock, expiry tracking,
   replenishment requests routed to Admin Manager.
3. **Bem-Estar da Equipa** — permanent-staff wellbeing log: health flags, morale
   notes, interpersonal conflicts, special needs. **Sensitive data — restricted to
   `hr_facility_lead` and `admin_manager` only; excluded from any exported/consolidated
   report unless explicitly aggregated and anonymized.**
4. **Higiene & Instalações** — cleanliness/hygiene standards checklist for common
   facilities; feeds from Auxiliar de Limpeza entries.
5. **Kit de Primeiros Socorros** — first-aid kit stock control, usage log, monthly
   report to Departamento de Saúde (external).
6. **Manutenção de Instalações** — basic maintenance/small-repair work coordination
   and status tracking.

### 6.2 Data entities
`meal_log`, `kitchen_stock`, `wellbeing_note` (restricted), `hygiene_checklist`,
`first_aid_log`, `maintenance_ticket`.

---

## 7. Operational Data Entry — Shared Interface (4 roles)

One reusable UI shell (same offline-capable, mobile-first pattern as the existing
Farm Technician interface), with a role-specific form set swapped in on login. Not
four separate builds.

| Role | Form(s) available |
|---|---|
| `driver` (Motorista) | Registo de Viagem (destino, finalidade, km, combustível) · Reporte de Avaria |
| `warehouse_assistant` (Assistente de Armazém) | Entrada/Saída de Stock · Contagem Física Diária · Reporte de Anomalia/Dano |
| `cook` (Cozinheiro/a) | Registo de Refeição Servida · Stock Diário de Alimentos · Reporte de Necessidade de Reabastecimento |
| `cleaning_assistant` (Auxiliar de Limpeza) | Checklist de Limpeza Diária · Reporte de Anomalia nas Instalações · Registo de Manutenção Básica |

### 7.1 Shell requirements
- Single-column, large-touch-target mobile layout.
- Works offline; queues submissions locally and syncs when connectivity returns
  (same as Farm Technician — reuse the existing sync engine, don't rebuild it).
- Simple TZ#/PIN login, same auth flow as all other roles.
- Each submission routes to the correct unit lead's queue (Operations Support lead
  for Driver/Warehouse; Human & Facility Services lead for Cook/Cleaning) for review,
  matching the existing Production-Manager-reviews-Technician pattern.
- No access to dashboards, reports, or other roles' data.

---

## 8. Consolidated Reporting Flow

```
Motorista ─┐
           ├─► Operations Support Lead ─┐
Assistente ─┘   (review & consolidate)  │
de Armazém                              │
                                         ├─► Admin Manager ─► Coordenador/a da Fazenda (N2)
Cozinheiro/a ─┐                          │      (Visão Geral +
              ├─► HR & Facility Lead ────┘       Relatórios Consolidados +
Auxiliar de   ┘   (review & consolidate)          weekly/monthly/quarterly/
Limpeza                                            semi-annual report submission
                                                    to Fundação)
Finance & Compliance Lead ──────────────────────────┘
   (independent, reports directly into Admin Manager's
    consolidated view — no subordinate data-entry roles)
```

Report cadence to implement (per SOP responsibility #7): **semanal, mensal,
trimestral, semestral** — each report type should be generatable from "Relatórios
Consolidados" with a date-range picker and section filter, exportable PDF/XLSX.

Monthly budget request (responsibility #1) needs a due-date reminder: **submission
deadline = day 20 of each month**, surfaced as a dashboard reminder/alert to
`admin_manager`.

---

## 9. Permissions Matrix

| Capability | admin_manager | finance_compliance_lead | operations_support_lead | hr_facility_lead | driver / warehouse_assistant / cook / cleaning_assistant |
|---|---|---|---|---|---|
| View own unit section | ✔ (all 3) | ✔ (own) | ✔ (own) | ✔ (own) | — |
| View other units | ✔ | ✘ | ✘ | ✘ | ✘ |
| Edit own unit data | ✔ | ✔ | ✔ | ✔ | — |
| Submit operational entry | — | — | — | — | ✔ (own form set) |
| Review/approve subordinate submissions | ✔ | — | ✔ (Driver, Warehouse) | ✔ (Cook, Cleaning) | — |
| Generate consolidated report | ✔ | ✘ (own-unit reports only) | ✘ | ✘ | ✘ |
| Access Bem-Estar da Equipa (sensitive) | ✔ | ✘ | ✘ | ✔ | ✘ |
| Manage colaboradores/PINs | (existing Admin & Auditoria role only) | | | | |

---

## 10. Build Notes for Implementation

- **Reuse, don't rebuild:** top bar, sidebar shell, green section-header banner,
  critical-alerts strip, TZ#/PIN provisioning table, offline sync engine — all already
  exist elsewhere in the system per the reference screenshot. This spec only adds new
  sidebar items, new sections/forms, and new role keys wired into the existing
  components.
- **Server-side scoping is mandatory** — the UI hiding sections for unit leads is not
  sufficient; API endpoints must reject cross-unit requests by role.
- **Wellbeing data** (`wellbeing_note`) needs field-level access restriction, not just
  screen-level — it must never appear in exports/consolidated reports without explicit
  aggregation/anonymization.
- **Alert reuse:** "Furo 2: Anomalia >120%" and similar existing alert types should be
  extended to also surface inside Apoio Operacional, not duplicated as new alert logic.
- New TZ# range / EMP-code convention should follow whatever pattern the existing
  Colaboradores & PINs table already uses (visible in the reference screenshot:
  `TZ########` / `EMP-###`).

---

## 11. Out of Scope (explicitly not in this build)

- Payroll processing (payments are logged/tracked here, not disbursed from the system).
- External integrations with Departamento de Saúde or Centro Metuchira systems — this
  build only produces the reports/logs that get sent to them, not a live integration.
- Any change to existing roles/dashboards outside the Administrative Department.
