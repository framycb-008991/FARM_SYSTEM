# Design System — Farm Management App
Extracted from the "Borcelle" farming presentation (Green & Orange Modern Farming template)
and adapted from a marketing landing page into a professional, usable **dashboard / SaaS UI**.

> Instruction for the agent: apply these tokens and patterns consistently across every screen
> (dashboard, tables, forms, modals, nav) instead of default framework styling. Prioritize
> clarity and usability for daily operational use (farm managers, field workers) over decorative
> marketing flourishes — this is a working tool, not a landing page.

---

## 1. Brand Personality
Natural, organic, trustworthy, energetic. Green = growth/agriculture, orange = action/energy
(used sparingly for primary actions, never as a base color). Clean whitespace, rounded shapes,
no harsh corners, no heavy borders — shadows and color do the separating.

---

## 2. Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--color-primary` | `#2B7B13` | Primary brand green — headings, active nav, icons, chart accents |
| `--color-primary-dark` | `#0D3600` | Dark green — sidebar background, footer, hero/section blocks, text on light bg |
| `--color-primary-mid` | `#315D0D` | Secondary green — hover states, secondary icons |
| `--color-accent` | `#FF5400` | Orange — primary CTA buttons, active states, alerts/highlights only. Do NOT overuse; it should read as "action," not decoration |
| `--color-text` | `#000000` | Body text |
| `--color-surface` | `#FFFFFF` | Card/page backgrounds |
| `--color-surface-alt` | `#F7F9F5` | Subtle off-white section background for contrast between cards |
| `--color-success` | `#2B7B13` | Reuse primary green for success states/badges |
| `--color-warning` | `#FF5400` | Reuse accent orange for warning badges |
| `--color-danger` | `#C0392B` | New — needed for a working app (not in original deck), a red that harmonizes with the earthy palette |

**Rule:** Orange is a CTA/accent color, used on no more than 1–2 elements per screen (e.g., the
main "Save"/"Add Crop"/"New Task" button). Green carries the brand identity everywhere else.

---

## 3. Typography

- **Font family:** `Poppins` (Google Fonts — weights 400, 500, 600, 700/Bold)
- **Headings:** Poppins Bold, tight letter-spacing, large scale for page titles (e.g., 32–40px
  for page H1, 20–24px for card/section titles)
- **Body:** Poppins Regular, 14–16px, generous line-height (1.5) for table/data readability
- **Buttons/labels:** Poppins Medium/Bold, uppercase optional for small tags only

```css
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
```

---

## 4. Shape & Component Language

- **Buttons:** fully rounded (pill-shaped, `border-radius: 999px`), solid orange fill for primary
  actions, white text, subtle circular icon-in-circle affordance for the trailing icon (see
  original "Learn More →" pattern) — translate this into e.g. "Add Field →" style primary buttons
- **Cards:** rounded corners (`16–24px`), soft drop shadow, no visible border
- **Images/thumbnails:** rounded or organic-arch crops (not hard rectangles) for photos —
  e.g., crop field/crop photos with a rounded-top "arch" mask, or circular thumbnails for
  profile/field avatars
- **Nav:** active nav item gets a solid orange pill background; inactive items are plain text
- **Section blocks:** alternate white and dark-green (`#0D3600`) full-bleed blocks to separate
  page regions (e.g., a dark green summary/stats band above a white data table)
- **Icons:** simple solid-fill circular badge icons (colored circle background + white glyph),
  matching `icon-search-circle.png` in `/design-assets/images/`

---

## 5. Signature Motif — Leaf Graphics

The deck uses a photographic, veined leaf cutout (transparent PNG, diagonal placement, soft
drop shadow) as a recurring decorative accent in page corners and section dividers.

- Asset provided: `design-assets/images/leaf-motif-large.png`
- **Use sparingly** in a dashboard context: good for empty states, login/onboarding screens,
  the sidebar footer, or a subtle background watermark on report/export pages — NOT on dense
  data screens where it would compete with information.
- Do not scale it up as a dominant hero element like the original slides; in an app it should
  read as a quiet brand accent, sized small (60–120px) and positioned at page corners or behind
  empty-state illustrations.

---

## 6. Adapting Landing-Page Patterns to App UI

| Original PPT pattern | Farm Management App equivalent |
|---|---|
| Hero headline + photo | Dashboard welcome header ("Good morning, [Name]") with weather/summary stat cards on a dark-green band |
| Pill nav bar with active-orange highlight | Top nav or sidebar with the same active-pill styling |
| "Learn More →" circular-arrow button | Primary actions: "Add Crop →", "New Task →", "View Report →" |
| Rounded arch/circle photo crops | Field/crop photo thumbnails, worker avatars, equipment images |
| Alternating white/dark-green sections | Alternating white table rows on white background vs. a dark-green KPI/summary strip |
| Leaf corner graphics | Empty states, login screen, sidebar footer accent |
| Big bold section titles | Page titles and card headers |

**New components the app needs (not in the original deck — extend the system, don't invent a new
one):** data tables with sortable columns, status badges (using success/warning/danger tokens
above), form inputs (rounded, `12px` radius, green focus ring), sidebar navigation, charts (use
primary/mid green + accent orange as the chart palette), toast notifications, modals.

---

## 7. Main Navigation Bar

The app's top bar is the one place brand identity (foundation logo) and product identity
(app name) appear together — it should look like a professional internal enterprise tool,
not a marketing site header.

**Structure (left → right):**
1. **Logo lockup:** `tzu-chi-logo.png` at ~40px, in a rounded `8px` container if placed on a
   colored background, followed by a thin `1px` vertical divider, then a two-line text block —
   app name (`Poppins 500`, `15px`, `--color-primary-dark`) above a small subtitle
   ("Tzu Chi Moçambique", `Poppins 400`, `11px`, muted gray).
2. **Primary navigation:** pill-shaped nav items (`999px` radius), plain text for inactive
   items, solid `--color-accent` (`#FF5400`) background + white text for the active page —
   same pattern as the original deck's "About" pill.
3. **Utility zone:** notification bell icon, a thin divider, then a circular avatar
   (initials on `--color-primary`) + user name + chevron for the account menu.

**Bar styling:** `72px` height, white background, `1px` bottom border in a light neutral
(not a heavy shadow), subtle `box-shadow: 0 1px 3px rgba(0,0,0,0.06)` for separation from
content — keep it flat and clean, not decorative.

**Logo file notes:**
- `tzu-chi-logo.png` has a solid white background (not transparent). It sits cleanly on the
  white navbar above with no edit needed.
- If the logo is ever placed on a dark-green surface (sidebar, footer, login screen), you'll
  need a transparent-background version first — otherwise it renders as a visible white box.
  Flag this if that use case comes up.

---

## 8. Assets

```
design-assets/
  images/
    leaf-motif-large.png     — signature leaf graphic, transparent background
    icon-search-circle.png   — example of the circular icon-badge style used for icons
    tzu-chi-logo.png         — foundation logo, white background, use in main nav bar
```

Place this folder at your project's `public/branding/` (or equivalent static assets path) and
reference paths accordingly.

---

## 9. Do / Don't

**Do:** keep layouts clean and functional first, then apply this palette/type/shape language.
Use orange as a spotlight, not a base color. Keep leaf motifs small and occasional.

**Don't:** recreate the marketing-site visual density (giant leaf graphics, oversized hero type)
on data-heavy screens. Don't introduce new fonts or colors outside this palette without adding
them here first.
