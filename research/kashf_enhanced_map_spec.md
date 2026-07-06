# Kashf — Enhanced Map & Plain-English Build Spec (MVP upgrade)

*Upgrade of the existing working frontend. Do not rebuild from scratch — extend
frontend/ as it stands. Every number remains contract-driven; nothing hardcoded.*

---

## Part A — Live traffic base layer + 3D buildings

### A1. Traffic layer
- Add the Mapbox Traffic v1 vector tileset as a source on top of the existing
  dark-v11 style (preferred over switching to traffic-night-v2, so our existing
  dark palette and layers stay untouched):
  source URL: mapbox://mapbox.mapbox-traffic-v1
- Style congestion by class: low → muted green, moderate → amber, heavy/severe →
  red, using desaturated versions of our palette vars so live traffic reads as a
  quiet base layer, ~45% opacity — it must never shout louder than our story layer.
- Add a small toggle in the top bar: "Live traffic" (on by default). Label under
  the toggle or in the bottom strip: "Live conditions: Mapbox crowd data — our
  analysis uses the RTA dataset." This disclosure is mandatory and permanent.
- If the traffic source fails to load (403/network): hide the toggle, log a
  console warning, continue without it. Never break the demo.

### A2. 3D buildings
- Add the standard fill-extrusion buildings layer (composite source, 'building'
  layer, filter extrude=true), minzoom 14, interpolated height fade-in as per the
  official Mapbox 3D buildings example.
- Color: var(--bg-2)-ish tone at 0.7 opacity — subtle skyline, not a hero element.
- Camera per case: when a case is selected, ease to pitch 55, bearing chosen per
  case for the best road view (pick sensible values; Case 4 citywide stays flat
  pitch 0 top-down).

---

## Part B — Story layer (per-case delay theatre)

Replace the current flow-dot animation with car markers animated along the real
route geometry using Turf.js (turf.along / turf.length — the official Mapbox
"animate a point along a route" pattern). Load Turf from CDN. One shared
requestAnimationFrame loop drives ALL cars — never one timer per car.

Car marker: small rotated triangle/chevron symbol oriented to bearing of travel
(compute bearing from consecutive geometry points), ~10px, in the case's severity
color. Ambient cars (below): same shape, gray, 40% opacity, 8px.

### B1. Ambient layer (always on)
- 3-5 gray cars per verified segment, all 5 segments, slow constant drift, speed
  scaled by each corridor's real mean_vc from the contract (higher vc = slower).
- When a case is selected: ambient cars on NON-active segments dim to 20% opacity.
  The active segment's ambient cars are removed (replaced by story cars).

### B2. Case 1 — Al Mamzar: FULL SIGNAL THEATRE (option b, locked)
- A signal indicator rendered at the JCT_MAMZ junction point: small circle that
  cycles red (6s) → green (3s) in "Before" state.
- Cars flow along Al Ittihad Rd toward the junction. On red: cars decelerate and
  stack into a visible queue before the junction point (maintain spacing, no
  overlap). On green: the first 2-3 cars clear, then red returns with cars still
  queued — the queue never fully drains. That IS the phase-failure story.
- "After" state: green extends (6s red → 6s green), queue drains fully each cycle,
  flow visibly smoother.
- Staged annotations (see Part C) narrate the beats.
- Code comment: "Signal cycle timing is illustrative choreography of a verified
  phenomenon (315 phase failures); not a micro-simulation."

### B3. Case 2 — SZR Defence
- Both directions flow simultaneously (existing dual-route). Dense traffic both
  ways converging past the JCT_DEF diamond.
- "After" (demand management): car COUNT visibly drops (~30% fewer cars enter),
  speeds rise slightly. The honest visual: fewer cars in, not a magically faster
  road.

### B4. Case 3 — Storm (Al Maktoum Bridge)
- FEW cars (3-4), moving very slowly across the bridge — near-empty yet crawling.
- Keep the existing rain overlay. Add 2-3 small ⚠ incident icons at points along
  the bridge geometry.
- No before/after fix toggle for this case: instead the toggle is relabeled
  "Show response" → annotations shift to the response actions (patrols, Metro
  alert) and a patrol icon appears near the bridge.
- Slow cinematic camera: on case load, gentle 8-second pan along the bridge
  (interruptible, as per existing interaction rules).

### B5. Case 4 — Citywide
- No story cars. Top-down pitch 0. Live traffic layer + colored pins + ambient
  cars carry this view.

### B6. Case 5 — Garhoud
- Cars densely packed along the WHOLE segment at uniform slow speed — no queue
  point, no bottleneck. Visually distinct from Case 1's junction pile-up: the
  road is just full end to end.
- "After" (added capacity): same car count, visibly faster and better spaced.

---

## Part C — Staged map annotations ("traffic builds" narrative)

- Small annotation cards anchored to map coordinates (Mapbox Marker with custom
  HTML, styled like our panel cards: bg-2, border, 12px, max-width 240px).
- Each case defines a 3-beat sequence, appearing at 0s / 2.5s / 5s after the
  camera settles, each fading in over 400ms. Previous case's annotations are
  removed on switch.
- Beat content comes from a new "annotations" array added to each contract case
  file (see Part E). Examples of the intended voice:
  - Case 1: "Morning peak builds on Al Ittihad Rd" → "Queue forming — signal
    can't clear it" → "315 phase failures logged in 3 years"
  - Case 3: "Only 35% full — yet crawling" → "The road is impaired, not
    congested" → "A signal fix would do nothing here"
- On "After"/"Show response": one summary annotation replaces the beats (e.g.
  "Retimed signal — delay down 20%").
- All numbers inside annotations must come from the contract file, not be typed
  into JS.

---

## Part D — Plain-English metric layer

### D1. Contract change
Add to each case JSON a "plain" object translating the technical metrics:
{
  "plain": {
    "headline": "...",             // one-sentence case summary in plain English
    "los_f":   "Gridlocked 1 in every 12 hours",
    "gap":     "117 drivers every hour want this road but can't fit",
    "vc":      "Running at half its capacity on average — far over at peaks",
    "verdict_after": "Delay per car: 36s → 29s — 20% better, at minimal cost"
  }
}
Generate these with Mistral using the same grounded script/system-prompt pattern
as before (glossary included, cite only input numbers, 3-run consistency check).
Rules for the generation: numbers must be faithful conversions of the real values
(8.27% → "1 in every 12 hours" is correct math; verify each), no exaggeration, no
invented comparisons. Cases without simulate candidates omit verdict_after.

### D2. Rendering
- Metric cards: plain-English line becomes the PRIMARY text (15px, text-hi);
  the technical value renders below it, small and muted (12px, text-low,
  tabular): "8.27% hours at LOS F". Plain first, precision underneath.
- The fixes card gets the verdict_after line rendered prominently under the
  before→after numbers.
- Case 4's table keeps technical columns (it's a ranking table) but its Mistral
  narrative above the table carries the plain-English duty.

---

## Part E — Contract updates (do these FIRST, before frontend work)

1. Add "annotations" arrays (3 beats + 1 after-beat) and "plain" objects to all
   5 case files. Generate text via the existing generate_mistral_text.py pattern
   (extend the script), same hard rules + glossary, 3-run stability check, then
   human-readable diff in the report.
2. Re-run contract/validate.py extended to require the new fields. All files must
   remain status "verified" with real content — placeholders only if something
   cannot be honestly generated, flagged loudly.

---

## Part F — Performance & resilience (hard requirements)

- ONE requestAnimationFrame loop total. Cap: ≤ 30 animated cars on screen.
- Test at 1366×768. If frame rate visibly stutters with traffic + 3D + cars, the
  degradation order is: reduce ambient cars → disable 3D buildings → never
  degrade the active case's story layer.
- All new layers respect the existing fallback rules: traffic source failure →
  continue without; geometry fetch failure → existing dashed-line fallback.
- No console errors across 3 full walkthroughs (all 5 tabs, before/after toggles,
  traffic toggle) — same DoD standard as the original build.

## Part G — What NOT to do
- Do not claim or imply the live traffic layer feeds our diagnosis engine.
- Do not add routes/geometry beyond the 5 verified segments.
- Do not per-car timers, no setInterval animation, no localStorage.
- Do not let annotations or cars cover the right panel's content area.

## Definition of done
- Live traffic renders over dark style with toggle + disclosure line
- 3D buildings appear at case zoom, camera pitches per case
- All 5 cases show their distinct story behavior (B2-B6) with staged annotations
- Plain-English metrics render primary with technical values beneath
- Contract validates with the new fields, all files verified
- 3 clean full walkthroughs, no console errors, acceptable frame rate at 1366×768
