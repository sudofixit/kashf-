# Kashf — Frontend Build Report

_Build of the enterprise demo console per `kashf_frontend_build_spec.md`. Date: 2026-07-05._

---

## 1. Prerequisite — contract route anchors + validation

The three verified Mapbox display anchors were already present in the contract from the
prior task and match the spec exactly, so no rewrite was required — confirmed in place and
re-validated:

- `case_2_szr_defence.json` → `secondary_corridor.route_anchors` = `[[55.283953, 25.224351], [55.272668, 25.207789]]`
- `case_3_storm.json` → `map.route_anchors` = `[[55.320805, 25.251252], [55.326906, 25.259271]]`
- `case_5_garhoud_no_signal.json` → `map.route_anchors` = `[[55.344955, 25.251739], [55.334415, 25.257095]]`

All five files are `status: "verified"`.

```
======================================================================
Kashf JSON contract validation
======================================================================
### case_1_al_mamzar.json          SCHEMA: OK  (status=verified)  PLACEHOLDERS: none
### case_2_szr_defence.json        SCHEMA: OK  (status=verified)  PLACEHOLDERS: none
### case_3_storm.json              SCHEMA: OK  (status=verified)  PLACEHOLDERS: none
### case_4_citywide_triage.json    SCHEMA: OK  (status=verified)  PLACEHOLDERS: none
### case_5_garhoud_no_signal.json  SCHEMA: OK  (status=verified)  PLACEHOLDERS: none
======================================================================
RESULT: ALL FILES CONFORM | 0 placeholder field(s) across 5 files
======================================================================
```

---

## 2. What was built

```
frontend/
  index.html            top bar · map zone · 400px right panel · bottom disclosure strip
  css/main.css          §1 design system verbatim (palette, Inter, 8px grid, one panel shadow)
  js/config.js          gitignored — Mapbox token
  js/config.example.js  template for config.js
  .gitignore            ignores js/config.js
  js/data.js            loads all 5 contract files, validates (mirrors validate.py), reference coords
  js/map.js             Mapbox dark-v11, pins, junction diamonds, routes, flow animation, fallback, rain
  js/app.js             tabs, clock, status pill, panel rendering, before/after toggle, sortable table
  README.md             run instructions
```

**Stack:** plain HTML + CSS + vanilla JS + Mapbox GL JS v3 (dark-v11). Chart.js was
**omitted** — no chart genuinely helped the described panel (all custom components), and the
spec forbids decorative charts.

---

## 3. Spec coverage (§ by §)

| § | Requirement | Status |
|---|---|---|
| 1 | Palette CSS vars exact, Inter 400/500/600, tabular-nums, 8px grid, cards 10px/1px border, one panel shadow, severity = only saturated colors | ✅ |
| 2 | Three-zone shell; top bar wordmark+subtitle, 5 tabs (accent underline + arrow-key nav), live clock, **data-driven** status pill; bottom disclosure strip from config | ✅ |
| 3 | 18 corridor pins by `severity_color` + hover tooltip (id/area/los_f/gap from contract); 10 junction diamonds, JCT_MAMZ & JCT_DEF pulse; Directions-API routes cached in a JS object; flow dots (density high=14/med=8/low=4, gridlock=16; speed from `speed_factor`); fitBounds 80px/1.2s; Case 2 dual converging flows; Case 4 no route; Case 3 rain + incident cluster; junction≠route separation code comment | ✅ built · ⚠ live map unverified (needs token) |
| 4 | Every value from contract; diagnosis badges by type; metric row (Case 3 "storm-day"); Case 4 ranked sortable table; diagnosis card (summary, evidence w/ severity left-border, confidence bar, human-review pill); fixes card (before→after, Δ%, 5-dot cost/disruption, "Recommended" top-fix, **not-estimable row shown**, method footnote); recommendation card; before/after toggle | ✅ |
| 5 | Tab/←→ switch, 150ms panel crossfade, interruptible flyTo, right panel 360px < 1280px | ✅ |
| 6 | On-load contract validation → red banner naming file+field; 5s Directions timeout → schematic dashed line + note; never white-screens; no localStorage | ✅ |
| 7 | No routing/drag/login/avatars/notifications, no UI kits, no localStorage | ✅ |

**Zero hardcoded case numbers.** The only static values in JS are reference *geometry*
(corridor + junction coordinates in `data.js`) — coordinates aren't in the contract, and the
spec explicitly permits the junction coords as a static list; every rendered *metric* comes
from the contract JSON.

**Honesty features wired from data, not hardcoded strings:** status pill (`status`), method
footnote (`simulate.method_label`), bottom disclosure strip (config constant), not-estimable
fix row (`_not_estimable`).

---

## 4. Testing — verified vs. not

**Verified in this environment:**
- All assets and all 5 contract files serve over HTTP 200; the `../contract/` relative path
  resolves from `/frontend/`.
- **Headless Edge smoke test** (served page, no token): full boot; all 5 tabs built; Case 1
  panel rendered from real contract values (`8.27`, `117.7`); correct badge ("Signal issue"),
  status pill ("Verified data"), metric labels, and "Tested fixes" card; **error banner stayed
  hidden** (contract validation passed). → `data.js` + `app.js` execute with no fatal JS errors
  on the default path.
- Contract re-validates clean (0 placeholders).

**NOT verified (so DoD §8 is NOT claimed complete):**
- The live Mapbox map — base tiles, 18 pins, junction diamonds/pulse, Directions routes, flow
  animation, camera flyTo, Case 2 dual-flow, Case 3 rain/incidents.
- Interactive tab crossfade, before/after toggle, and Case 4 table sort (logic reviewed, not
  executed).
- §8 "3 consecutive full walkthroughs with no console errors."

Reason: this environment has no JS runtime (no node/deno/bun) and no Mapbox token, and headless
mode cannot load Mapbox tiles without a token or drive click interactions.

---

## 5. How to finish DoD §8 (needs a Mapbox token + browser)

1. Paste your token into `frontend/js/config.js`
   (`window.KASHF_CONFIG = { mapboxToken: "pk.…" }`).
2. From the repo root (the folder containing both `frontend/` and `contract/`):
   `python -m http.server 8000`
3. Open `http://localhost:8000/frontend/index.html`.
4. With DevTools console open, click through all 5 tabs three times; also test the network
   fallback once (block requests / go offline → confirm the schematic dashed line + note).

If anything throws, send the console output and it will be fixed.

---

## 6. Status

**Contract: complete (5/5 verified, 0 placeholders). Frontend: built to spec in full; core
data/render path verified headless; live map + interaction walkthrough (§8) pending a Mapbox
token and an interactive browser run.**
