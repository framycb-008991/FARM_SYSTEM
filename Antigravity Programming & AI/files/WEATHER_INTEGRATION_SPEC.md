# Weather & Wildfire Alert Integration Specification
Extends `BACKEND_SPEC.md`, `ADMIN_OPERATIONS_SPEC.md`, `ACCESS_CONTROL_FIX.md`, and
`I18N_SPEC.md` with climate and fire risk alerting. Follows the same conventions already
established in those files — role scoping, offline sync, audit logging, translation keys —
this is an extension, not a parallel system.

---

## 1. Overview

Two distinct risk categories, from two different data sources:

| Category | Source | What it tells you |
|---|---|---|
| **Weather risk** (rain, drought, heat, wind/cyclone) | Open-Meteo forecast API | What's *about to happen*, based on forecast models |
| **Fire risk** | Two-part: NASA FIRMS (detection) + a computed Fire Danger Index (prediction) | What's *already burning nearby*, and how likely fire is to start/spread given current conditions |

Don't conflate these into one "weather alert" type — a farm manager needs to know the
difference between "a fire is currently detected 3km from your field" and "conditions are dry
enough that a fire would spread quickly right now." Both matter, differently.

---

## 2. Data Sources

### 2.1 Open-Meteo (weather forecast) — no API key required
`https://api.open-meteo.com/v1/forecast` — per-field lat/lng, pull: `temperature_2m`,
`precipitation`, `precipitation_probability`, `windspeed_10m`, `windgusts_10m`,
`relative_humidity_2m`, `soil_moisture_0_to_1cm`, `et0_fao_evapotranspiration`. 7-day daily +
48h hourly.

### 2.2 NASA FIRMS (active fire detection) — free, requires a registered MAP_KEY
`https://firms.modaps.eosdis.nasa.gov/api/` — satellite-detected active fire/thermal
hotspots (VIIRS/MODIS), updated every few hours. Query by bounding box around each field's
coordinates (recommend a 10–20km radius buffer, configurable). Returns detected hotspot
lat/lng, detection time, confidence level, and brightness/intensity — this is **actual fire
detection**, not a prediction.

> Registration note: FIRMS requires a free MAP_KEY (instant, email-based, no cost) —
> different from Open-Meteo which needs nothing at all. Flag this as a one-time setup step,
> not a blocker to building the integration.

### 2.3 Computed Fire Danger Index (no new API — derived from data already ingested)
Compute a simplified fire danger score from the same Open-Meteo variables already being
pulled for weather alerts: low humidity + high temperature + high wind + prolonged dry spell
(days since meaningful rain) = elevated fire spread risk. This is a **prediction**, distinct
from FIRMS' detection — use an established simplified formula (e.g. a Nesterov-index-style or
Canadian FWI-style approximation); don't invent an arbitrary scoring system — cite the formula
used in code comments so it can be audited/tuned later.

> **Note on FIRMS reliability:** FIRMS is a US federal service and went quiet for ~6 weeks
> during the Oct–Nov 2025 US government shutdown before resuming normal operation. Rare, but
> real — §11's graceful-degradation handling covers this, and §3a's manual reporting layer
> means the system is never solely dependent on FIRMS being up.

### 2.4 Manual fire/smoke report (human-observed — fastest layer)
Satellite detection has real limits for this use case: ~3-hour latency, and it can miss small
or newly-started fires under cloud cover or dense canopy. **A person on the ground will
almost always notice smoke before a satellite does.** This is not a fallback for when FIRMS is
unavailable — it's the fastest detection layer, always on, working alongside satellite data.

Add a **"Report Fire / Smoke"** quick-action to two interfaces:
- **Farm Technician** — alongside the existing New Report flow
- **Operational Data Entry** (Driver, Warehouse Assistant, Cook, Cleaning Assistant) — these
  roles move around the farm and dormitories throughout the day and may spot something before
  any technician does

Keep the form deliberately minimal — someone reporting a fire is not in a form-filling mood:
- Location: auto-captured GPS if available, else a field/area picker (pre-filled with the
  employee's assigned field if applicable)
- One-tap severity: "Smoke visible" / "Active fire visible"
- Optional photo (camera capture)
- Optional short note
- Submit — no other required fields

This works fully offline, using the exact same client-generated-ID sync mechanism as every
other field entry (`BACKEND_SPEC.md` §5) — a fire report shouldn't be blocked by a lack of
signal at the exact moment it matters most.

---

## 3a. Data Model Addition — Human Reports

```
FireHotspot   -- extend the existing table from §3, don't create a parallel one
  ...(existing fields)...
  source (nasa_firms | human_report)
  reported_by (employee_id, nullable — null for satellite-sourced rows)
  photo_urls[] (nullable)
```

A human report and a satellite detection are both just rows in `FireHotspot` with a different
`source` — they feed the same `ClimateAlert` pipeline in §5, so nothing downstream (the
banner, notifications, acknowledgment) needs to know or care which one triggered it.



```
WeatherReading
  id, field_id, recorded_at, temperature_c, precipitation_mm,
  precipitation_probability, wind_speed_kmh, wind_gust_kmh,
  humidity_pct, soil_moisture, evapotranspiration, source (open_meteo)

FireHotspot
  id, field_id (nearest field, may be null if outside all field buffers),
  latitude, longitude, distance_to_field_km, detected_at, confidence (low|nominal|high),
  brightness, source (nasa_firms), satellite (viirs|modis)

FireDangerReading
  id, field_id, calculated_at, danger_score, danger_level (low|moderate|high|extreme),
  days_since_rain, inputs_snapshot (json — the weather values the score was derived from)

ClimateAlert
  id, field_id, alert_type (drought_risk | heavy_rain | flood_risk | extreme_heat |
    high_wind | cyclone_warning | disease_risk_humidity | fire_danger | fire_detected),
  severity (watch | warning | critical), triggered_at, resolved_at,
  forecast_window, message_key, related_hotspot_id (nullable, links to FireHotspot),
  acknowledged_by, acknowledged_at

ClimateAlertThreshold          -- admin-configurable, not hardcoded
  id, alert_type, comparator, value, unit, applies_to_region_or_field
```

`fire_detected` and `fire_danger` are both `alert_type` values on the same `ClimateAlert`
table as the weather alerts — one unified alert model, two additional types, not a separate
fire-alert system.

---

## 4. Ingestion Jobs (extends existing BullMQ setup)

| Job | Frequency | Source |
|---|---|---|
| Weather forecast sync | every 6 hours | Open-Meteo, per active field |
| Fire hotspot sync | every 3 hours (FIRMS updates more frequently than weather changes) | NASA FIRMS, bounding box per field |
| Fire danger score calculation | every 6 hours, right after weather sync | computed locally from `WeatherReading` |

Batch/rate-limit requests across fields for both APIs — don't fire one request per field per
second; both providers have fair-use expectations even without a hard key-based rate limit.

---

## 5. Alert Evaluation Logic

Defaults below — make every threshold editable in Administrative Operations → Settings
(`ClimateAlertThreshold`), not hardcoded in application logic:

- **Cyclone/high wind:** gusts > 60 km/h forecast within 48h → `critical`
- **Heavy rain / flood risk:** >40mm in 24h forecast, or 3+ consecutive days >20mm →
  `warning`; escalate to `critical` if it overlaps an active harvest/drying period (check
  `CropCycle` status for that field)
- **Drought risk:** soil moisture below threshold for 10+ consecutive days with no rain
  forecast → `warning`
- **Extreme heat:** forecast max temp > 38°C → `watch`
- **Disease risk:** humidity > 85% combined with recent rainfall → `watch` (fungal risk
  relevant to cashew)
- **Fire danger (predicted):** danger_level `high` → `warning`; `extreme` → `critical`
- **Fire detected (actual):** any FIRMS hotspot within the field's buffer radius →
  `critical`, always — a confirmed nearby fire is never a `watch`. Distance-based severity
  refinement is fine (e.g. <5km vs 5–20km) but the floor is `critical` for anything inside
  the configured buffer.
- **Fire detected (human-reported):** always `critical`, always immediate. Unlike every other
  alert type in this spec, a human fire/smoke report must **not** wait for the next scheduled
  evaluation cycle — trigger the `ClimateAlert` and SMS notification (§8) the moment the
  report is submitted (or the moment it syncs, if it was filed offline). A person who just saw
  smoke does not need the system to double-check the weather first.

---

## 6. Integration with the Existing Critical Alerts Banner

All alert types — weather and fire — feed into the **same** banner already shown on the
dashboards ("4 CRITICAL", "Borehole 2: >120% Spike", etc.). A cyclone warning or a detected
fire hotspot should appear with identical visual treatment and click-to-expand behavior to
existing operational alerts. Do not build a separate fire/weather alert widget.

---

## 7. Role-Scoped Visibility (per `ACCESS_CONTROL_FIX.md` role model)

| Role | Sees |
|---|---|
| Farm Technician | Alerts for their assigned fields only, in the offline-capable interface — cache latest alert state locally, visible without signal, sync on reconnect |
| Production Manager | Alerts across all fields they oversee, with crop-cycle context (e.g. "Heavy rain warning overlaps Plot A-01's harvest window") |
| Top Management | Aggregated org-wide climate/fire risk summary, not per-field detail |
| Operations Support (Administrative Operations) | Correlates rainfall against existing `BoreholeReading` data — flags if borehole levels aren't responding as expected to recent rainfall |
| Administrator | Manages `ClimateAlertThreshold` config; sees the same read-only operations summary pattern already defined in `ADMIN_OPERATIONS_SPEC.md` §7 |

---

## 8. Notifications

Reuse the existing Twilio SMS integration. SMS fires for **`critical` severity only** — never
`watch`/`warning`, to avoid alert fatigue — sent to the relevant Production Manager and Admin
Manager for that field. This explicitly includes both `cyclone_warning` (critical) and
`fire_detected` (always critical). Log every notification sent to `AuditLog`.

---

## 9. Acknowledgment & Audit

A `critical` alert requires acknowledgment (`acknowledged_by`/`acknowledged_at`) — same
accountability pattern used elsewhere in the system. A detected fire hotspot or cyclone
warning should not be able to silently scroll off a dashboard unacknowledged.

---

## 10. Internationalization

Backend returns `alert_type` and a `message_key` — never a pre-formatted English string. The
frontend resolves display text through the translation system in all 3 languages
(`I18N_SPEC.md`), including fire-specific messaging (e.g. "Incêndio detetado a X km" /
"Fire detected X km away" / "偵測到火災，距離 X 公里").

---

## 11. Failure Handling

- A field with no weather/fire data yet (new field, API outage) must degrade gracefully —
  show "no data available," never crash the dashboard or block other alerts from rendering
- If NASA FIRMS or Open-Meteo is unreachable, log the failure, retry with backoff, and don't
  let a failed external call block the ingestion job for other fields

---

## 12. QA Checklist

- [ ] Weather ingestion job runs on schedule, batched/rate-limited across fields
- [ ] Fire hotspot ingestion job runs on schedule, correctly buffers around field coordinates
- [ ] Fire danger score calculates correctly against known high-risk conditions (manually
      verify with a hot/dry/windy test case)
- [ ] All alert types (weather + fire) appear in the existing critical banner with no
      separate/inconsistent UI
- [ ] Field with no data yet fails gracefully, doesn't crash the dashboard
- [ ] Farm Technician sees cached alerts while offline, including fire alerts
- [ ] SMS fires only for `critical` — confirm `fire_detected` always triggers it,
      `fire_danger` only triggers it at `extreme`
- [ ] Alert text renders correctly in pt-MZ, en-GB, and zh-TW, including fire-specific
      messages
- [ ] A detected hotspot correctly links back to its `ClimateAlert` via
      `related_hotspot_id` for traceability
- [ ] "Report Fire / Smoke" is reachable in ≤2 taps from both the Farm Technician and
      Operational Data Entry home screens
- [ ] A manual fire report submitted while offline is not lost, and triggers the critical
      alert + SMS immediately upon sync — not on the next scheduled evaluation cycle
- [ ] A manual report and a FIRMS detection for the same real fire both appear correctly
      (as two `FireHotspot` rows, ideally visually linked/deduplicated in the UI rather than
      shown as two unrelated alerts)
