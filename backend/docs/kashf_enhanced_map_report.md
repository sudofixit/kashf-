# Kashf — Enhanced Map & Plain-English Upgrade — Completion Report

_Executed `kashf_enhanced_map_spec.md` in the required order: Part E (contract) → Parts A–D
(map/render) → Part F (test). Date: 2026-07-05._

---

## Part E — contract (validator output)

`generate_mistral_text.py` extended with a PASS 2 that generates a `plain` object and an
`annotations` object per case. Every numeric conversion is **pre-computed in Python**; Mistral
supplies wording only; a **faithfulness gate rejects any run** whose plain line omits the exact
computed number. `validate.py` extended to require the new fields.

```
RESULT: ALL FILES CONFORM | 0 placeholder field(s) across 5 files
  case_1..case_5  SCHEMA: OK  (status=verified)  PLACEHOLDERS: none
```

### The three reviewer-flagged lines — regenerated (same rules/gate)

| Field | Before (rejected) | After (shipped) |
|---|---|---|
| case_3 `annotations.after` | "Incident patrols cleared crashes in 24.6 minutes" *(inverted — framed the degraded 24.6-min response time as an achievement)* | **"Pre-stage crews: cut storm response below 24.6 minutes"** *(recommendation, not a claimed result; 24.6 framed as the problem)* |
| case_5 `annotations.beats[1]` | "Evenings stall for no signal fault" *(garbled)* | **"Airport Road full — no signal issue, volume only"** |
| case_5 `annotations.after` | "Add a lane: delay per km drops by more than half" → first regen slipped to past tense "Added lane… cut delay" | **"Add a lane: reduce per-kilometre delay, though at higher cost and disruption"** *(proposal, plain-first; the exact 3.25→1.33s/59% stays in `verdict_after`)* |

Kept as approved: Case 1 full set, Case 2's honest verdict ("main gain is fewer cars at risk of
gridlock, not a noticeably faster road"), Case 3's rainfall/visibility/speed problem beats.
Note: I kept the storm multiplier faithful as **2.5×** (24.6 / 9.7), not "tripled".

---

## Parts A–D — what was built (extending the existing frontend, not a rebuild)

**A1 Live traffic** — `mapbox.mapbox-traffic-v1` vector source added under our layers, congestion
coloured with desaturated palette tones at 0.45 opacity; a top-bar **"Live traffic" toggle**
(on by default) and the permanent disclosure *"Live conditions: Mapbox crowd data — our analysis
uses the RTA dataset."* On source failure (403/network) the toggle hides and the demo continues.

**A2 3D buildings** — `fill-extrusion` on the composite `building` layer, minzoom 14, height
fade-in, `#1A2438` at 0.7 opacity. **Per-case camera**: pitch 55 with a per-case bearing; Case 4
stays flat (pitch 0, top-down).

**B Story layer (Turf, ONE rAF loop)** — flow dots replaced by chevron **car markers** oriented
to travel bearing (`turf.along`/`turf.length`, planar fallback if the CDN fails). **B1 Ambient:**
3 gray cars per verified segment on all 5 segments, speed scaled by each corridor's real
`mean_vc` (higher vc = slower); on case select, non-active ambient dims to 20% and the active
segment's ambient is replaced by story cars. **B2 Case 1 signal theatre:** a red(6s)→green(3s)
signal light at JCT_MAMZ; cars queue before the stop line on red and only 2–3 clear per green so
the queue never drains (the phase-failure story) — "After" extends green to 6s and the queue
drains. **B3 Case 2:** both directions flow; "After" hides ~30% of entering cars (fewer cars in,
not a magic faster road). **B4 Case 3:** 3–4 crawling cars, rain overlay, ⚠ incident icons; the
toggle becomes **"Show response"** (patrol icon + response annotation, no fix). **B5 Case 4:** no
story cars, top-down. **B6 Case 5:** dense cars along the whole segment at uniform slow speed
(no bottleneck); "After" same count, faster.

**C Staged annotations** — panel-styled Mapbox marker cards anchored to route coordinates, beats
revealed at ~0/2.5/5s after the camera settles (400 ms fade-in), swapped for the single
`after` summary on toggle; all text and numbers come from the contract `annotations`.

**D Plain-English metrics** — each metric card now leads with the contract `plain` sentence
(15px, primary) and shows the technical value muted beneath (12px, e.g. "8.27% hours at LOS F");
the fixes card renders `plain.verdict_after` prominently; Case 4's narrative carries the plain
duty above its ranking table.

---

## Part F — performance & resilience

- **ONE `requestAnimationFrame` loop** drives every car. No `setInterval`/per-car timers, no
  `localStorage` (Part G respected).
- **Car cap ≤ 30, enforced at spawn.** Worst-case concurrent count is ~24 (5 segments × 3
  ambient = 15, minus the active segment's removed ambient, + ≤12 story), so **no degradation
  had to be applied**. The auto-degrade ladder is implemented and armed (FPS EMA < 42 for >2s):
  **reduce ambient → disable 3D → never touch the active story layer.**
- **Fallbacks:** traffic source failure → continue without it; Directions timeout (5s) →
  schematic dashed line + note; Turf CDN failure → planar geometry fallback; **map/WebGL failure
  → the panel still renders** (init no longer blocks the UI, resolves via an 8s timeout).

---

## Testing — verified vs. needs your browser

**Verified here (headless Edge, served):**
- All three reworked JS files parse; globals defined (`turf`, `mapboxgl`, `KashfData`,
  `KashfMap` with 7 fns); **`errors: []`** — no uncaught JS errors on boot.
- Full panel renders from the contract with **plain-first metrics and the verdict line**
  (`hasPlain: true`, `hasVerdict: true`), error banner hidden, contract re-validates clean.
- Fixed a real resilience gap found via the probe: the panel used to hang while `await`-ing map
  init; it now renders immediately and the map draws when ready.

**Could NOT verify here (headless has no WebGL, no interaction) — needs a real browser:**
- The live map visuals: traffic layer, 3D buildings, per-case camera pitch/bearing, the car
  animations and Case-1 signal queue, staged annotations, rain/incidents/patrol.
- DoD's **"3 clean full walkthroughs, no console errors, acceptable frame rate at 1366×768."**

**To finish the DoD (your machine):** the enhanced files are local (not yet pushed). Run
`python -m http.server 8000` from the repo root, open
`http://localhost:8000/frontend/index.html`, and click all 5 tabs ×3 with DevTools open,
watching the console and frame rate. If anything throws, send the console output.

The token is already committed, so pushing these files to GitHub Pages should not re-trigger
secret scanning — say the word and I'll deploy them.
