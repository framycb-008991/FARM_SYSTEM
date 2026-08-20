# Mobile View Validation Report

## Test context

- Application: Mecuzi Farm Management System
- URL: https://farm-system-a1v8.onrender.com/
- Route reached after login: `#/pt-MZ/dashboard/management`
- Test account: `TZ10000001` (PIN omitted from this report)
- Device emulation: iPhone 15
- Viewport: 393 × 659 CSS pixels
- Date: 2026-08-20

## Executive summary

The application loads and authenticates successfully on mobile, but the responsive layout has several usability and accessibility issues. Header controls and alert content are clipped, report tables are not adapted for narrow screens, and the collapsed navigation exposes icon-only buttons without accessible names.

## Findings

### MOB-001 — Header controls are clipped on narrow screens

- Severity: High
- Area: Global header
- Reproduction: Log in at the tested mobile viewport and inspect the top header.
- Observed: The brand occupies the left side while the search field and subsequent role, logout, online status, language, and AI controls extend beyond the 393px viewport. The controls are visibly truncated and are not available through document-level horizontal scrolling.
- Impact: Users cannot reliably access key global actions such as search, logout, language selection, or the AI assistant.
- Recommendation: Add a mobile header layout with a compact menu/action trigger, or wrap the controls into a responsive second row. Ensure all controls remain visible and usable at widths around 320–393px.

### MOB-002 — Critical-alert chips are truncated

- Severity: Medium
- Area: Dashboard alerts
- Reproduction: After login, view the dashboard at the tested mobile viewport.
- Observed: The alert chips continue horizontally and are clipped at the right edge. Alert labels such as the tractor and fuel alerts cannot be read in full.
- Impact: Critical operational information is partially hidden on mobile.
- Recommendation: Allow chips to wrap into multiple rows, or provide a horizontally scrollable alert region with a clear scroll affordance and accessible full-text labels.

### MOB-003 — Yield report table is not mobile-adapted

- Severity: Medium
- Area: Rendimento & Colheita report
- Reproduction: Select the Rendimento & Colheita section from the mobile sidebar.
- Observed: The report table retains an approximately 840px width inside a roughly 264px-wide mobile container. Only the first columns are visible in the viewport; the remaining report fields require horizontal scrolling, with no obvious visual indication that more columns are available.
- Impact: Users may miss important report values such as targets, estimated value, and performance.
- Recommendation: Convert rows to stacked mobile cards, or provide a clearly labeled horizontally scrollable table with a visible affordance and preserved column headers.

### MOB-004 — Collapsed mobile navigation buttons lack accessible names

- Severity: Medium
- Area: Sidebar navigation
- Reproduction: Inspect the collapsed sidebar after login at the tested mobile viewport.
- Observed: Navigation buttons render as icons only. The accessibility snapshot exposes the buttons without accessible names, so their destinations cannot be determined by assistive technology.
- Impact: Screen-reader users and users unfamiliar with the icons cannot reliably navigate between dashboard sections.
- Recommendation: Add accessible labels or `aria-label` values to every icon button, and consider displaying labels on tap or through a mobile navigation drawer.

## Evidence

- Dashboard screenshot: `.playwright-cli/page-2026-08-20T02-49-31-208Z.png`
- Yield report screenshot: `.playwright-cli/page-2026-08-20T02-49-59-814Z.png`
- Playwright snapshots: `.playwright-cli/page-2026-08-20T02-49-29-765Z.yml` and `.playwright-cli/page-2026-08-20T02-49-56-826Z.yml`
- Confirmed viewport metrics: `innerWidth=393`, `innerHeight=659`.
- Confirmed document metrics: document width remained 393px; clipped content did not create document-level horizontal scrolling.

## Recommended acceptance criteria

- All global header actions remain visible and operable at 320px, 375px, and 393px widths.
- Alert content is fully readable without relying on accidental clipping.
- Reports provide either a responsive card layout or an explicitly discoverable horizontal-scroll treatment.
- Every mobile navigation control has an accessible name and a clear destination.
