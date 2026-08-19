# Access Control Fix — Role-Based Login Routing
Fixes a critical gap in the current build: the navbar "ROLE" dropdown lets any logged-in user
manually switch between all 4 dashboards (Top Management, Farm Technician, Production
Manager, Administration). This is not access control — it's a display toggle anyone can click.
This must be fixed before this system handles real data.

---

## 1. The Problem (as currently built)

Screenshot evidence: a "ROLE" selector sits in the main navbar and is user-editable at any
time, for any logged-in account. This means:
- A Farm Technician account could open the Administration dashboard (employee management,
  audit logs) or Top Management reports simply by picking a different dropdown option
- There is no server-side check preventing this — role appears to be pure frontend state
- This likely exists as a leftover development/preview shortcut for viewing all 4 interfaces
  while building, not intentional production behavior

## 2. Correct Behavior

**Role is not a user choice. It is an attribute of the employee's account, set once by an
Administrator, and it determines routing automatically after login.**

### 2.1 Where role comes from
- Set on the `Employee` record (`role_id`, per `BACKEND_SPEC.md` §4) when Administration
  creates the account — not selectable by the employee at any point, ever
- Included as a claim inside the JWT issued after successful login + OTP verification
  (`BACKEND_SPEC.md` §2.3), e.g. `{ "sub": "TZ11244043", "role": "top_management", ... }`

### 2.2 Post-login routing (frontend)
- Immediately after OTP verification succeeds, read the `role` claim from the returned token
- Redirect automatically to the matching dashboard — **no interface picker shown to the user**:

| Role | Redirect target |
|---|---|
| `top_management` | `/[locale]/dashboard/management` |
| `farm_technician` | `/[locale]/dashboard/technician` |
| `production_manager` | `/[locale]/dashboard/production` |
| `administrator` | `/[locale]/dashboard/admin` |

- Remove the ROLE dropdown from the production navbar entirely. Replace that navbar slot with
  something that reflects the account, not lets it be changed — e.g. a small non-interactive
  label showing the current role name (per `DESIGN_SYSTEM.md` navbar spec — utility zone
  already has a spot for this next to the profile menu).

### 2.3 Route protection (frontend guard — UX layer only)
Wrap each dashboard route group in a `<RoleGuardedRoute allowedRole="...">` component (already
named in `FRONTEND_SPEC.md` §9) that:
- Reads the role from the authenticated session/token
- Redirects to the user's own correct dashboard (not a login/error page) if they somehow land
  on a URL for a different role — treat it as "let me take you to where you belong," not a
  dead end

### 2.4 API protection (backend — the real boundary)
The frontend guard above is convenience, not security. **Every API endpoint must independently
enforce role** server-side (this was already specified in `BACKEND_SPEC.md` §3/§8 — this is a
reminder to verify it was actually implemented, since the frontend dropdown bug suggests role
checks may currently exist only in the UI):
- Every controller/route handler checks the JWT's `role` claim against the permissions required
  for that endpoint
- A Technician's token calling an Administration endpoint (e.g. `GET /audit-logs`) must return
  `403 Forbidden`, regardless of what the frontend shows or allows
- Test this explicitly: for each of the 4 roles, confirm their token is rejected by every
  endpoint outside their permission set in `BACKEND_SPEC.md` §3's table

## 3. Per-Interface Role Attribution — All 4 Roles, Concretely

This is the exact mechanism: **one field on the employee record, set once by an Administrator,
drives everything else.** No other part of the system should decide which dashboard someone
sees — not a dropdown, not a frontend guess, not a URL the user happens to type.

### 3.0 The attribution step (happens once, at account creation)

An Administrator creates the account via `POST /employees` (`BACKEND_SPEC.md` §8) and sets
`role_id` at that moment. This is the *only* place a role is ever assigned. From then on, that
employee's login always resolves to that role — automatically, every time, on any device.

```json
POST /employees
{
  "employee_number": "TZ11244045",
  "full_name": "Daniel Sitoe",
  "phone_number": "+258821234567",
  "role": "farm_technician",
  "assigned_field_ids": ["field_A01", "field_A02"]
}
```

### 3.1 Interface 1 — Top Management

| | |
|---|---|
| Role key | `top_management` |
| Example account | `TZ10000001` — CEO/Director account, created by Administration |
| Assigned by | Administrator, at account setup, once |
| After login lands on | `/[locale]/dashboard/management` |
| Sees | Org-wide aggregated reports, KPIs, trends across all farms (`BACKEND_SPEC.md` §6) |
| Cannot do | Any write action anywhere in the system — this role is read-only end to end |

### 3.2 Interface 2 — Farm Technician

| | |
|---|---|
| Role key | `farm_technician` |
| Example account | `TZ11244045` — Daniel Sitoe, matches your screenshot |
| Assigned by | Administrator, along with their specific `assigned_field_ids` (which plots they work) |
| After login lands on | `/[locale]/dashboard/technician` |
| Sees | Only their own assigned fields (Plot A-01, A-02 in the screenshot) — never other technicians' fields or any management/admin data |
| Cannot do | View other technicians' data, access reports, manage accounts |

### 3.3 Interface 3 — Production Manager

| | |
|---|---|
| Role key | `production_manager` |
| Example account | `TZ12000010` |
| Assigned by | Administrator |
| After login lands on | `/[locale]/dashboard/production` |
| Sees | All technician submissions for review/approval, crop cycle management, field-to-technician assignment (`BACKEND_SPEC.md` §3) |
| Cannot do | Employee/account management, system audit logs, org-wide donor-level reporting (that's Top Management's view) |

### 3.4 Interface 4 — Administration

| | |
|---|---|
| Role key | `administrator` |
| Example account | `TZ10000099` |
| Assigned by | A pre-existing Administrator (bootstrap the very first admin account directly in the database/seed script — every subsequent account, including new admins, is created through the app by an existing admin) |
| After login lands on | `/[locale]/dashboard/admin` |
| Sees | Employee management, role/field assignment, audit logs, system settings |
| Cannot do | N/A — full access by design, which is exactly why account creation for this role should be tightly controlled and every action logged (`BACKEND_SPEC.md` §7) |

### 3.5 The routing logic (same for all 4 — one function, not four different implementations)

```ts
// after successful OTP verification, on the frontend
const { role } = decodeToken(accessToken);

const roleToRoute: Record<Role, string> = {
  top_management: '/dashboard/management',
  farm_technician: '/dashboard/technician',
  production_manager: '/dashboard/production',
  administrator: '/dashboard/admin',
};

router.replace(`/${locale}${roleToRoute[role]}`);
```

Write this once, in one place (e.g. the OTP verification success handler), not duplicated per
role. Every account, regardless of which of the 4 roles it holds, goes through this exact same
function — the only thing that differs is the `role` value read from their token.

## 4. Multi-Role People (e.g. someone who is both a manager and needs an admin view)

If a real person genuinely needs access to more than one dashboard (uncommon, but possible —
e.g. a Production Manager who's also a system Administrator), handle this as **one account
with multiple assigned permissions**, not by giving them the freewheeling dropdown back:
- Add support for an employee having more than one role in the data model if this is a real
  need (`Employee` ↔ `Role` many-to-many instead of one `role_id`)
- If an account has multiple roles, show a small, deliberate switcher **only to that account**
  — not to everyone — and still enforce each dashboard's permissions independently per role at
  the API layer

Don't build this unless you actually have a person who needs it — for most employees
(including the CEO), one account = one role = one automatic destination after login.

## 5. QA Checklist

- [ ] ROLE dropdown removed from production navbar
- [ ] Login → OTP → lands directly on the correct dashboard for that account's role, with no
      intermediate choice screen
- [ ] Manually navigating to another role's dashboard URL redirects away, doesn't show content
- [ ] For each role, call at least one endpoint outside its permission set directly (e.g. via
      browser devtools/Postman) and confirm the API itself returns 403 — not just that the UI
      hides the button
- [ ] Confirm this was tested with a real Technician-role token, not just as CEO/admin during
      development (dev accounts are often over-privileged and can mask this bug)
- [ ] Seed/verify one test account per role (§3.1–3.4) and confirm each lands on its own
      dashboard straight from login with zero manual steps
