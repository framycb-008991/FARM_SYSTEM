# ROLE: CEO / Top Manager (Gestor/a de Topo — N1)

This file defines the CEO role as it should behave inside the Farm Daily Production & Administration Management System (see `Specification.md`). Use it to configure this user's permissions, default views, and — if the system includes an AI copilot — that copilot's persona when the logged-in user is the CEO.

---

## 1. Who This Role Is

The CEO is the **highest authority on the farm**, responsible for strategic direction and accountability to the Foundation's Council. In the source SOP this is the *Gestor/a de Topo* (Top Manager, Level N1), reporting to the Tzu Chi Council ("Conselho Tzu Chi"). This is the only role above the Farm Manager (N2) in the hierarchy.

The CEO operates at the level of strategy, approvals, and external representation — not day-to-day operations. Their system experience should be the lightest-touch, highest-altitude view in the whole platform.

---

## 2. Reports To / Supervises

- **Reports to:** Tzu Chi Council (external to the farm — the system should model this as an external stakeholder, not an in-app role)
- **Supervises:** Farm Manager / Farm Coordinator (N2), with full visibility into everything below

---

## 3. System Permissions

| Area | Access |
|---|---|
| Administration Module | Full read/oversight access; no routine data entry |
| Production Module | Full read/oversight access; no routine data entry |
| Annual Production Plan (PAP) | Approval authority — reviews and signs off the annual plan proposed by the Farm Manager |
| Strategic decisions | Sole authority for high-impact decisions: investment, expansion, partnerships |
| KPI | Views consolidated KPI dashboard; approves the farm's overall performance narrative to the Council |
| Budget | Final escalation point for budget deviations the Farm Manager cannot resolve; not involved in routine budget review |
| Reports | Receives monthly consolidated reports from the Farm Manager; submits accountability reporting to the Council |
| Data entry | None expected — this role should never be blocked waiting on a form |

---

## 4. Core Responsibilities (from the SOP)

- Define and communicate the farm's strategic vision and annual objectives.
- Ensure accountability to the Tzu Chi Council on the farm's overall performance — receive the Farm Manager's consolidated monthly report (due around the 25th) and submit the Council report monthly (by the 28th).
- Represent the farm in external institutional relationships (Ministry of Agriculture, partners, development programmes).
- Make high-impact decisions on investment, expansion, and strategic partnerships, within a defined analysis window (up to 5 business days), escalating anything outside personal authority to the Council within 10 business days.
- Approve the Annual Production Plan (PAP) and major operational directions, reviewing budget/resource allocation, timeline, and alignment with strategy (typical review window: 7 days).
- Supervise overall performance via KPIs reported by the Farm Manager monthly, with a ±10% tolerance; anything outside tolerance requires a written correction plan from the Farm Manager within 3 business days, tracked weekly until resolved.

---

## 5. Default Dashboard (What This Role Should See First)

1. **Strategic KPI summary** — farm-wide performance vs. the approved PAP, tolerance-flagged.
2. **Pending approvals** — anything requiring CEO sign-off (PAP revisions, high-impact decisions, escalated budget/production deviations).
3. **Accountability calendar** — when the next Council report is due, and its current draft status.
4. **Escalations only** — nothing at the level of daily registers (fuel, water, attendance) should surface here unless it has already been escalated twice (Technician/Officer → Manager → Farm Manager → CEO).

---

## 6. If This Role Powers an AI Copilot

When acting as an assistant for the CEO, the copilot should:
- Default to strategic framing: trends, risks, and decisions needed — never raw operational logs.
- Treat anything reaching this role as already escalated and important; do not soften or bury it under routine updates.
- When asked "how is the farm doing," answer with the PAP/KPI picture and flag anything outside tolerance, rather than a generic operational summary.
- Never make or imply approval of a strategic decision on the CEO's behalf — present the options and the Farm Manager's/Council's input, and let the CEO decide.
