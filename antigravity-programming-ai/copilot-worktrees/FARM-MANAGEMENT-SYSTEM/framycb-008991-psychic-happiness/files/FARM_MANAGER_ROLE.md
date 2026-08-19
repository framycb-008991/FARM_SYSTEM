# ROLE: Farm Manager (Coordenador/a da Fazenda — N2)

This file defines the Farm Manager role as it should behave inside the Farm Daily Production & Administration Management System (see `Specification.md`). Use it to configure this user's permissions, default views, and — if the system includes an AI copilot — that copilot's persona when the logged-in user is the Farm Manager.

---

## 1. Who This Role Is

The Farm Manager is the **on-site operational head of the farm** — the link between the Top Manager/CEO (strategic direction) and the two department heads who run day-to-day work: the Production Manager and the Admin Manager. In the source SOP this is the *Coordenador/a da Fazenda* (Farm Coordinator, Level N2), reporting to the Top Manager (N1).

The Farm Manager does not run any single register personally (they don't log fuel or take attendance) — their job is **coordination, monitoring, and escalation**: making sure the Production and Administration sides are executing the Annual Production Plan (PAP), staying within budget, and surfacing anything serious to the CEO.

---

## 2. Reports To / Supervises

- **Reports to:** CEO / Top Manager (N1)
- **Supervises:** Production Manager (N3), Admin Manager (N3), and — through them — every role beneath those two branches (Technicians, Tractor Operator, Field Workers, Finance & Compliance, Operations Support, Human & Facility Services)

---

## 3. System Permissions

| Area | Access |
|---|---|
| Administration Module | Full read access to all registers; approval authority on escalations from the Admin Manager |
| Production Module | Full read access to all registers; approval authority on escalations from the Production Manager |
| Budget | Reviews and approves monthly financial reports from Finance; freezes non-essential spending and escalates to CEO if any budget line deviates more than 15% |
| CFW Programme | Oversight visibility; not an entry role |
| KPI / PAP | Consolidates department KPIs monthly; reports to CEO; cannot edit locked Meta values (only via a tracked PAP revision) |
| Reports | Receives and reviews the Weekly Report and Monthly Admin Report; compiles and submits the institutional monthly report to the Foundation |
| Data entry | Minimal — this role reviews and approves far more than it creates |

This role should **not** see itself as a data-entry role in the UI — its dashboard should default to summaries, exceptions, and pending approvals, not blank forms.

---

## 4. Core Responsibilities (from the SOP)

- Compile and submit monthly institutional reports to the Foundation (including translation/preparation for non-Portuguese reporting where required), by the agreed monthly deadline.
- Monitor execution of the Production Plan; if the cumulative deviation from monthly targets exceeds **10%**, escalate to the CEO within 24 hours and require a correction plan from the Production Manager within 2 business days.
- Review monthly financial reports; if budget deviation on any line exceeds **15%**, freeze non-essential spending and escalate to the CEO within 48 hours.
- Manage and monitor outsourced/contracted projects (procurement, quality checks, fortnightly check-ins, sign-off).
- Oversee product commercialization/sales at a high level, confirming payments are registered correctly.
- Consolidate KPIs from all departments monthly and report trends/deviations to the CEO.
- Approve leave arrangements that would otherwise leave a Production Point without both its Technician and Comissionário present.
- Serve as the escalation point for anything the Admin Manager or Production Manager cannot resolve at their level.

---

## 5. Default Dashboard (What This Role Should See First)

1. **Exceptions & pending approvals** — anything currently flagged (budget variance, water/fuel anomalies, stock below 2 weeks' cover, IMMOBILIZED equipment, leave conflicts).
2. **KPI summary** — department-level status against the current PAP, with anything outside ±10% tolerance highlighted.
3. **Budget execution** — actual vs. approved, current month, by department.
4. **This week's status** — attendance summary, CFW budget used vs. allocation, open maintenance requests.
5. **Upcoming deadlines** — the farm's own reporting calendar (weekly report Friday 17:00, monthly report by the 5th, budget request by the 20th, CFW plan by the 25th).

---

## 6. If This Role Powers an AI Copilot

When acting as an assistant for the Farm Manager, the copilot should:
- Lead with exceptions and deadlines, not routine status — this role's job is to notice what's off track, not to review everything.
- Never approve or auto-resolve an escalation on the Farm Manager's behalf; surface it clearly and let them decide.
- Speak in terms of the farm's own thresholds (10% production deviation, 15% budget deviation) rather than vague language like "seems off."
- When summarizing a department's status, be direct about which register or report the summary is drawn from, so it's traceable back to source data.
