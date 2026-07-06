# Kashf — JSON Contract Build Report

_Contract-only task: define the exact data shape the demo frontend renders and the backend fills. Frontend and backend build in parallel against these files. No frontend/backend logic was written. All real numbers are verified from the raw 2023–2025 files; all Mistral/Simulate outputs are explicit `PLACEHOLDER:` strings._

**Date:** 2026-07-05

---

## 1. Deliverables

```
contract/
  case_schema.json               reference schema with per-field descriptions
  case_1_al_mamzar.json          ITT_W1 / JCT_MAMZ  — SIGNAL_ISSUE
  case_2_szr_defence.json        SZR_N1 / JCT_DEF   — DEMAND_EXCEEDS_ADAPTIVE (+ secondary SZR_S1)
  case_3_storm.json              16–17 Apr 2024     — WEATHER_INCIDENT
  case_4_citywide_triage.json    all 18 corridors   — triage_table deviation
  case_5_garhoud_no_signal.json  AIR_W1 / null      — NO_SIGNAL_ATTRIBUTABLE
  validate.py                    schema + placeholder checker
```

Every case file carries `"status": "partial"` — real numbers are in; Mistral narrative and
Simulate outputs are pending. `status` flips to `"verified"` only when the backend fills every
placeholder (validate.py enforces this consistency).

---

## 2. Value convention

Two kinds of values live in these files:

1. **VERIFIED** — computed from the real dataset in prior verification passes (or, for Case 4,
   recomputed fresh here). Present as exact numbers, used as-is, not "improved".
2. **PLACEHOLDER** — Mistral-generated text and Simulate outputs that do not exist yet. Every
   one is a string starting with `PLACEHOLDER:` so it can never be mistaken for a real output.
   Numeric fields that are still pending (e.g. `simulate` before/after, `confidence_pct` where
   not supplied) carry the placeholder string too — the frontend keys off `status` to know a
   `partial` file may hold placeholder strings in otherwise-numeric slots.

---

## 3. Case 4 — fresh 18-corridor computation and cross-check

Concatenated `traffic_volume_hourly_{2023,2024,2025}.csv` (26,304 hours × 18 corridors) and computed,
per corridor, with the exact method from the feasibility report:

- `los_f_pct = count(level_of_service == 'F') / N × 100`
- `demand_gap_vph = mean(demand_vph) − mean(volume_vph)`
- `mean_vc = mean(vc_ratio)`
- `severity_color`: **red** if `los_f_pct > 4`, **amber** if `1–4`, **green** if `< 1`

### Cross-check against previously-verified spot values — all matched exactly, nothing to flag

| location_id | expected los_f_pct | fresh los_f_pct | result |
|---|---|---|---|
| ITT_W1 | 8.27 | 8.27 | MATCH |
| ITT_E1 | 7.76 | 7.76 | MATCH |
| AIR_W1 | 5.20 | 5.20 | MATCH |
| SZR_N1 | 4.39 | 4.39 | MATCH |
| EKR_S1 | 1.21 | 1.21 | MATCH |
| EMR_E1 | 0.00 | 0.00 | MATCH |

### Full triage_table (as written into case_4)

| location_id | area | los_f_pct | demand_gap_vph | mean_vc | severity_color |
|---|---|---|---|---|---|
| ITT_W1 | Al Mamzar | 8.27 | 117.7 | 0.498 | red |
| ITT_E1 | Al Qiyadah | 7.76 | 101.6 | 0.469 | red |
| AIR_W1 | Al Garhoud | 5.20 | 45.4 | 0.444 | red |
| SZR_N1 | Trade Centre | 4.39 | 64.9 | 0.426 | red |
| SZR_N2 | DIFC | 3.88 | 53.7 | 0.415 | amber |
| SZR_S1 | Trade Centre | 3.80 | 67.5 | 0.408 | amber |
| SZR_S2 | DIFC | 3.46 | 60.2 | 0.402 | amber |
| SZR_N4 | Al Barsha | 2.86 | 31.7 | 0.393 | amber |
| SZR_S4 | Al Barsha | 2.63 | 50.8 | 0.386 | amber |
| GAR_N1 | Garhoud | 2.19 | 24.3 | 0.437 | amber |
| EKR_N1 | Business Bay | 1.77 | 11.1 | 0.367 | amber |
| MAK_N1 | Bur Dubai | 1.60 | 18.1 | 0.423 | amber |
| JBR_X1 | Jumeirah | 1.51 | 7.8 | 0.353 | amber |
| EKR_S1 | Al Quoz | 1.21 | 24.2 | 0.355 | amber |
| BBC_S1 | Business Bay | 0.94 | 19.2 | 0.402 | green |
| DWC_X1 | Dubai South | 0.00 | 0.9 | 0.180 | green |
| EMR_E1 | Al Awir | 0.00 | 0.9 | 0.248 | green |
| MBZ_E1 | DIP | 0.00 | 1.8 | 0.282 | green |

---

## 4. Verified inputs per case (as specified)

- **Case 1 — Al Mamzar:** ITT_W1 / JCT_MAMZ; route_anchors `[[55.338,25.268],[55.355,25.295]]`;
  junction_point `[55.35,25.294]`; triage rank 1, los_f 8.27, gap 117.7, vc 0.498; diagnosis
  `SIGNAL_ISSUE` (Fixed-time, 315 phase failures — worst of 10, gap 117.7 vph); human_review false.
  **Corridor–junction distance deliberately omitted** from evidence (0.1 km vs 0.515 km conflict,
  being recomputed separately).
- **Case 2 — SZR Defence:** SZR_N1 / JCT_DEF; route_anchors are the **corrected DISPLAY** anchors
  on the SZR carriageway (not the monitoring coords) — noted in `map._comment`; triage los_f 4.39,
  gap 64.9, vc 0.426; diagnosis `DEMAND_EXCEEDS_ADAPTIVE` (SCOOT-adaptive, 130 phase failures,
  pair distance 0.258 km); human_review false. **secondary_corridor** SZR_S1 added (los_f 3.80,
  gap 67.5, vc 0.408, pair 0.152 km) with its route_anchors as a placeholder pending a Mapbox check.
- **Case 3 — Storm (16–17 Apr 2024):** diagnosis `WEATHER_INCIDENT` (low vc ~0.35 during slowdown,
  heavy precipitation, incident cluster); confidence 55; human_review true; response-time figure left
  as `PLACEHOLDER: pending storm_response_time_final.md`.
- **Case 5 — Garhoud (no signal):** AIR_W1, junction null; triage rank 3, los_f 5.20, gap 45.4,
  vc 0.444; diagnosis `NO_SIGNAL_ATTRIBUTABLE` (nearest JCT_GARH 0 phase failures, 0.99 km away;
  capacity/incident-driven); human_review false.

---

## 5. Validation

`validate.py` checks that every file parses, conforms to the schema (required fields, status enum,
Case-4 18-row count + severity_color↔los_f_pct consistency, Case-2 secondary_corridor shape,
status↔placeholder consistency) and lists every field still holding a placeholder.

```
======================================================================
RESULT: ALL FILES CONFORM | 73 placeholder field(s) across 5 files
======================================================================
```

Per-file: case_1 = 16 placeholders, case_2 = 17, case_3 = 22, case_4 = 1 (`narrative`),
case_5 = 17. All five: SCHEMA OK, status = partial.

---

## 6. Judgment calls (flagged for override)

1. **`confidence_pct` for cases 1, 2, 5.** The task supplied a verified confidence only for Case 3
   (55). Rather than invent realistic-looking numbers, the others are
   `PLACEHOLDER: diagnosis confidence pending`, following the task's own rule that pending numeric
   fields become `PLACEHOLDER:` strings. Override by hard-coding values if the diagnosis engine's
   confidence is considered deterministic for the slam-dunk signal cases.
2. **Case 3 (storm) is intentionally placeholder-heavy.** No corridor, coordinates, or triage
   numbers were supplied, so `map.corridor_id`, route/severity, and all four triage metrics are
   placeholders. Only the verified parts are filled (`diagnosis.type`, evidence facts,
   `confidence_pct=55`, `human_review_required=true`, response-time placeholder inside evidence).
   Supply a featured corridor to fill its map/triage.

---

## 7. Verified vs assumed

- **Verified from raw files:** the full 18-corridor triage_table (recomputed fresh over 26,304
  hours each, cross-checked against 6 spot values — all matched); all Case 1/2/5 triage numbers and
  diagnosis evidence (carried from prior verified passes and consistent with the fresh table).
- **Placeholder (not invented):** all Mistral narrative/summary/recommendation text, all Simulate
  candidate/before/after/cost/disruption values, all flow_animation values, `top_fix`, Case-3
  corridor selection and triage, Case-2 secondary route_anchors, and `confidence_pct` for cases
  1/2/5 — every one an explicit `PLACEHOLDER:` string.
