You are upgrading an existing web app called "Mecuzi Farm Management" (PT-Moçambique
locale). Do not rebuild the app — extend it. Reuse existing components, styles, auth,
and offline-sync engine wherever the spec below says to reuse them.

Attached/referenced: `ADMIN_OPERATIONS_DASHBOARD_SPEC.md` — read it fully before writing
any code. It is the source of truth for roles, sections, data entities, and permissions.
Everything below is the task instruction; the spec file has the detail.

## Task

Add a new "Administrative Operations" module to the existing system:

1. **8 new roles** (`admin_manager`, `finance_compliance_lead`,
   `operations_support_lead`, `hr_facility_lead`, `driver`, `warehouse_assistant`,
   `cook`, `cleaning_assistant`) — provisioned through the existing "Colaboradores &
   PINs" screen exactly like current roles (TZ# + full name + phone/SMS OTP + role +
   PIN reset), no changes to that screen's UI needed beyond adding these roles to the
   role dropdown.

2. **One new dashboard**, "Painel de Operações Administrativas", built on the existing
   dashboard shell (same top bar, sidebar pattern, green header banner, critical-alerts
   strip as already used in the Admin & Auditoria dashboard). It has 3 role-scoped
   sections:
   - Finança & Conformidade
   - Apoio Operacional
   - Serviços ao Colaborador & Instalações

   `admin_manager` sees all 3 sections plus a cross-unit "Visão Geral" and "Relatórios
   Consolidados" view. Each unit lead role sees ONLY their own section — hide the other
   sections from the sidebar entirely for that role, don't just disable them.

   **Enforce this server-side**, not just in the UI: a unit lead's API calls to another
   unit's endpoints must return 403.

3. **Build out each section's sub-views and data entities** exactly as listed in
   section 4, 5, and 6 of the spec file (budgets, payments, cost tracking, procurement,
   stock reconciliation, cash reconciliation, financial reports, document repository /
   inventory, field requisitions, post-harvest, transport logistics, warehouse ledger,
   borehole readings, waste management, harvest coordination, team supervision / meals,
   kitchen stock, staff wellbeing, hygiene checklists, first-aid log, facility
   maintenance).

   Flag the **Bem-Estar da Equipa (staff wellbeing)** entity as sensitive: restrict it
   to `hr_facility_lead` and `admin_manager` only, and exclude it by default from any
   report export or consolidated view unless the data is aggregated/anonymized first.

4. **One shared "Operational Data Entry" interface** (do not build 4 separate
   interfaces) reusing the existing offline-capable mobile shell already used for Farm
   Technician (same sync engine, same TZ#/PIN login, same single-column mobile layout).
   Swap in the correct form set per role on login:
   - Driver: trip log (destination, purpose, km, fuel), breakdown report
   - Warehouse Assistant: stock in/out, daily physical count, anomaly/damage report
   - Cook: meal served log, daily food stock, restock request
   - Cleaning Assistant: daily cleaning checklist, facility anomaly report, basic
     maintenance log

   Each submission must route into the correct unit lead's review queue, following the
   existing pattern already used for Production Manager reviewing Farm Technician
   submissions.

5. **Reporting**: build "Relatórios Consolidados" for `admin_manager` with a date-range
   picker and section filter, generating weekly/monthly/quarterly/semi-annual reports,
   exportable to PDF and XLSX. Add a monthly reminder/alert to `admin_manager` for the
   day-20 budget-submission deadline.

6. **Alerts**: extend the existing alert system (e.g. the "Furo 2: Anomalia >120%" type
   already shown in the current dashboard) to also surface inside the Apoio Operacional
   section rather than duplicating that logic.

## Constraints

- Match the existing visual language exactly: same color system (green
  primary/header, orange for critical alerts), same card/table styles, same top bar
  layout (search, PAPEL badge, Sair, connectivity dot, IDIOMA selector, Assistente AI
  button).
- Portuguese (Moçambique) labels throughout, matching the terms used in the spec file
  and in the existing screens.
- Don't touch or regress any existing role, dashboard, or screen outside this module.
- Ask me before making any schema-breaking change to existing tables the new module
  reads from (e.g. Armazém/stock ledger, alert definitions).

## Deliverable

Working module behind the 8 new roles, wired into existing auth/provisioning, with
server-side permission enforcement per the matrix in section 9 of the spec file. Confirm
back with a summary of every new route/screen/entity you created before considering this
done.
