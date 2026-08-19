# Internationalization (i18n) Specification
Fixes the "language switch doesn't translate the whole page" bug and defines full,
system-wide support for **3 languages**:

| Code | Language | Notes |
|---|---|---|
| `pt-MZ` | Portuguese (Mozambique) | **Default/primary** — main language for Farm Technicians and most field/admin staff |
| `en-GB` | English (UK) | Secondary — management/donor reporting |
| `zh-TW` | Traditional Chinese (Taiwan) | Foundation headquarters language |

> Give this file to Antigravity alongside `DESIGN_SYSTEM.md`, `BACKEND_SPEC.md`, and
> `FRONTEND_SPEC.md`. It should be treated as a hard requirement, not a nice-to-have: **no
> page ships with hardcoded, non-translatable text.**

---

## 1. Root Cause of "Doesn't Translate the Whole Page"

Before rebuilding, the agent should understand *why* this happens, so it doesn't reintroduce
the same bug while adding the 3rd language. In order of likelihood:

1. **Hardcoded strings** typed directly into JSX instead of pulled through the translation
   function — the #1 cause of partial translation. Every string added after initial setup
   (new buttons, table headers, status badges, error messages) is a place this creeps back in.
2. **Components rendered outside the i18n provider's scope** — e.g. a navbar or shared layout
   built before locale routing existed, sitting outside the `[locale]` route segment.
3. **Static/cached rendering** serving one locale's pre-rendered HTML to everyone.
4. **Third-party components** (charts, tables, date pickers) with their own internal locale
   setting, disconnected from the app's language switcher.
5. **Data-driven text from the backend** (e.g. report type names, status values) stored as raw
   strings ("Pending", "Approved") instead of translation keys — these will never translate no
   matter how good the frontend i18n setup is, because they don't come from the translation
   files at all.

This spec's structure directly closes all five gaps below.

---

## 2. Library & Setup

**Library:** `next-intl` (Next.js App Router native support, handles routing, static
rendering, and formatting together — avoids gap #2 and #3 above by design when set up
correctly).

### 2.1 Route structure — mandatory
**Every** page must live under a `[locale]` dynamic segment. Nothing that renders user-facing
text should exist outside it.

```
app/
  [locale]/
    layout.tsx              <- wraps everything in NextIntlClientProvider
    login/page.tsx
    verify-otp/page.tsx
    dashboard/
      management/page.tsx
      technician/page.tsx
      production/page.tsx
      admin/page.tsx
  layout.tsx                 <- root layout: html/body only, NO user-facing text here
```

If the navbar, footer, or any shared component currently lives in the root layout (outside
`[locale]`), **move it inside** the `[locale]/layout.tsx`. This is very likely the exact cause
of the current bug if the navbar/shared chrome isn't translating.

### 2.2 Middleware
```ts
// middleware.ts
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['pt-MZ', 'en-GB', 'zh-TW'],
  defaultLocale: 'pt-MZ',
  localePrefix: 'always' // /pt-MZ/dashboard, /en-GB/dashboard, /zh-TW/dashboard
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
```

### 2.3 Static rendering caveat
If any page uses `generateStaticParams` / static generation, it must generate one version
**per locale**, not one cached version total — `next-intl` handles this automatically when
pages read the locale from the route param correctly; audit any page that was hardcoded to
skip this.

---

## 3. Translation File Structure

Organize by the same feature areas as `FRONTEND_SPEC.md`, not one giant file — keeps files
manageable and lets different people translate different sections.

```
messages/
  pt-MZ/
    common.json          -- shared: navbar, buttons, errors, validation messages
    auth.json             -- login, OTP, activation flow
    management.json       -- Top Management interface
    technician.json        -- Farm Technician interface
    production.json        -- Production Manager interface
    admin.json             -- Administration interface
  en-GB/
    (same structure)
  zh-TW/
    (same structure)
```

**Key naming convention:** `feature.section.element`, e.g.:
```json
{
  "auth": {
    "login": {
      "employeeNumberLabel": "Número de Funcionário",
      "pinLabel": "PIN",
      "forgotPinHelp": "Esqueceu o seu PIN? Contacte o administrador"
    }
  }
}
```

Same key structure across all 3 locale files — a missing key in one file should be treated as
a build-time error, not a silent English/Portuguese fallback in production (see §6).

---

## 4. Closing Gap #5 — Backend Data Must Use Keys, Not Raw Strings

This is the gap that's easy to miss and the one most likely to leave "islands" of
untranslated text even after the frontend is fixed properly.

**Wrong** (what likely exists today):
```json
{ "status": "Pending" }
```
The frontend has no way to translate a raw string value coming from the database.

**Right:**
```json
{ "status": "pending" }
```
Backend returns a stable enum/key (`pending`, `approved`, `flagged`, `synced`, etc.). The
frontend maps it through translations:
```json
// messages/pt-MZ/common.json
{ "status": { "pending": "Pendente", "approved": "Aprovado", "flagged": "Sinalizado" } }
```

**Action for the backend:** audit `BACKEND_SPEC.md`'s enums (`report_type`, `sync_status`,
`status` fields on `Employee`/`FieldReport`/`CropCycle`) — confirm every one of these is a
fixed machine-readable key, never a human-language label, going forward. Any place the
database or API currently returns a display label directly needs to switch to returning the
key and letting the frontend translate it.

---

## 5. Language Switcher

- Place in the main navbar utility zone (per `DESIGN_SYSTEM.md` §7), as a compact
  dropdown/flag+code control (e.g. "PT" / "EN" / "中文"), not full language names, to save
  navbar space
- Switching language should **preserve the current page** (re-render the same route under the
  new locale prefix), not bounce the user back to a dashboard home
- Persist the choice (cookie or user profile field) so it's remembered on next login —
  recommend storing it on the `Employee` record server-side (add `preferred_locale` to the
  schema in `BACKEND_SPEC.md` §4) so a technician's language choice follows them across
  devices, not just a browser cookie

---

## 6. Translation Completeness — Build-Time Safety Net

To stop this bug from silently recurring as new features ship:
- Add a build-time or CI check that fails if any key exists in `pt-MZ` (source language) but
  is missing in `en-GB` or `zh-TW` — don't rely on manual review to catch missing translations
- In development, configure `next-intl` to render a visible marker (e.g. `[[missing:
  key.name]]`) for any missing key instead of silently falling back — makes gaps obvious
  immediately during QA rather than shipping silently-broken text
- Add a short QA pass to the definition of done for any new screen: **load the page in all 3
  languages and visually confirm zero English/Portuguese leftover text** before merging

---

## 7. Traditional Chinese (zh-TW) — Font Fix Required

**Poppins (the design system's typeface) has no Chinese glyphs.** When `zh-TW` is active,
any Chinese text will silently fall back to the browser's default system font, breaking
visual consistency exactly where the foundation's own headquarters staff will notice it most.

**Fix — update `DESIGN_SYSTEM.md` §3 (Typography) with a locale-aware font stack:**

```css
/* Latin-script locales (pt-MZ, en-GB) */
--font-body: 'Poppins', sans-serif;

/* zh-TW */
--font-body-zh: 'Poppins', 'Noto Sans TC', sans-serif;
```

- Use **Noto Sans TC** for Chinese text — it's the closest visual match to Poppins' geometric,
  clean style among fonts with full Traditional Chinese coverage, and it's free (Google Fonts).
- Apply the font stack at the `[locale]` layout level (`lang="zh-TW"` on `<html>`, with a CSS
  rule keyed off that attribute or the locale-specific body class) so Latin characters mixed
  into Chinese pages (like the employee number `TZ11244043`) still render in Poppins, while
  Chinese characters render in Noto Sans TC.
- Headline weights: use Noto Sans TC's Bold/Medium weights to match Poppins Bold/Medium sizing
  — check them side by side, Noto Sans TC generally renders visually heavier at the same
  font-size, so headline sizing may need a small (~1–2px) adjustment for zh-TW specifically.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet">
```

---

## 8. Date, Number & Phone Formatting

Use `next-intl`'s built-in formatting (backed by `Intl.DateTimeFormat`/`Intl.NumberFormat`) —
never hand-format dates/numbers with string concatenation, which is locale-blind by
definition.

| | pt-MZ | en-GB | zh-TW |
|---|---|---|---|
| Date | 18/08/2026 | 18/08/2026 | 2026年8月18日 |
| Number | 1.234,56 | 1,234.56 | 1,234.56 |
| Phone display | +258 82 123 4567 | +258 82 123 4567 | +258 82 123 4567 (always international format, not localized) |

---

## 9. Third-Party Component Locale Sync

Audit every non-custom component used across the 4 interfaces (charts, `<DataTable />`
pagination text, date pickers) and confirm each one accepts a `locale` prop wired to the
current app locale. Component libraries commonly default to English regardless of the app's
own i18n state — this is a classic hidden source of "half-translated" pages.

---

## 10. Rollout / Fix Checklist

For the agent fixing the existing bug, work in this order:

1. Move all shared layout/chrome (navbar, footer) inside the `[locale]` segment if it isn't
   already (§2.1)
2. Audit every page for hardcoded strings, migrate to `t()` calls, one interface at a time
   (Top Management → Technician → Production → Administration)
3. Audit backend enum fields, switch any human-readable labels to stable keys (§4)
4. Add the `en-GB` and `zh-TW` message files (mirroring the `pt-MZ` key structure)
5. Add the Noto Sans TC font stack for zh-TW (§7)
6. Add the missing-key CI check (§6)
7. QA pass: every screen, all 3 languages, confirm zero untranslated text
