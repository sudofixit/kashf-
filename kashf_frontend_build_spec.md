# Kashf — Frontend Build Spec (Enterprise Demo Console)

*The handoff document for Claude Code. Build exactly this. Every number and coordinate
in this spec is verified — do not invent, adjust, or "improve" any value.*

---

## 0. What this is

A single-page, enterprise-grade operations console for the Kashf demo — the screen an
RTA executive and technical judges watch during a live 5-case walkthrough. It must look
like a real product a government traffic authority would deploy, not a student project:
restrained, dark, precise, zero clutter.

**Stack (locked):**
- Plain HTML + CSS + vanilla JS (no React — per prior team decision, fastest and most
  reliable for the timeline)
- Mapbox GL JS v3 (dark style) — the map is the centerpiece
- Chart.js (via CDN) — only where a chart genuinely helps; no decorative charts
- All case data loaded from the `contract/*.json` files — the frontend renders ONLY
  what's in the contract. No hardcoded numbers anywhere in the HTML/JS.

**Files to produce:**
```
frontend/
  index.html
  css/main.css
  js/app.js          (scenario switching, panel rendering)
  js/map.js          (Mapbox init, routes, animation)
  js/data.js         (contract loading + validation on load)
```

---

## 1. Design system — "enterprise control room"

### Palette (CSS variables, exactly these)
```css
:root {
  --bg-0: #0B1220;        /* page background — deep navy, not pure black */
  --bg-1: #111A2C;        /* panel background */
  --bg-2: #1A2438;        /* card / elevated surface */
  --border: #24304A;      /* hairline borders */
  --text-hi: #E8EDF6;     /* primary text */
  --text-mid: #94A3B8;    /* secondary text */
  --text-low: #64748B;    /* muted labels */
  --accent: #3B82F6;      /* actions, links, selected state — restrained blue */
  --red: #EF4444;         /* severity red */
  --amber: #F59E0B;       /* severity amber */
  --green: #22C55E;       /* severity green */
  --red-bg: rgba(239,68,68,.12);
  --amber-bg: rgba(245,158,11,.12);
  --green-bg: rgba(34,197,94,.12);
}
```
Rules: no gradients, no glows, no drop shadows except one subtle shadow on the right
panel. Severity colors are the ONLY saturated colors on screen — everything else stays
in the navy/slate range. This restraint is what reads as "enterprise."

### Typography
- Font: "Inter" from Google Fonts (weights 400, 500, 600 only). Fallback: system-ui.
- Numbers in metric cards: font-variant-numeric: tabular-nums (so digits align).
- Sizes: 13px labels, 15px body, 22px metric values, 17px panel headings. Nothing
  larger except the metric values.
- Sentence case everywhere. No ALL CAPS except tiny 11px tracking-wide section labels
  (letter-spacing: 0.08em) — used sparingly.

### Spacing & shape
- 8px spacing grid. Cards: 10px radius, 1px var(--border) border, var(--bg-2) fill.
- Panel padding 20px. Card padding 16px. Gap between cards 12px.

---

## 2. Layout — one shell, three zones

```
┌──────────────────────────────────────────────────────────────┐
│ TOP BAR (56px): logo/wordmark "Kashf" + subtitle · scenario   │
│ tabs (5) · live clock · status pill                           │
├────────────────────────────────────┬─────────────────────────┤
│                                    │  RIGHT PANEL (400px)     │
│                                    │  scrollable              │
│         MAP (fills remaining)      │  · case title + badge    │
│         Mapbox GL dark             │  · metric cards row      │
│                                    │  · diagnosis card        │
│                                    │  · simulate/fix card     │
│                                    │  · recommendation card   │
│                                    │  · before/after toggle   │
├────────────────────────────────────┴─────────────────────────┤
│ BOTTOM STRIP (optional, 40px): data-source line               │
└──────────────────────────────────────────────────────────────┘
```

### Top bar
- Left: wordmark **Kashf** (600 weight) + muted subtitle "Root-cause diagnosis &
  scenario testing — RTA challenge demo"
- Center: 5 scenario tabs: "Al Mamzar" · "SZR Defence" · "April 2024 Storm" ·
  "Citywide triage" · "Garhoud". Active tab: accent underline (2px) + text-hi;
  inactive: text-mid. Keyboard: arrow keys switch tabs.
- Right: live clock (HH:MM:SS, tabular-nums) + a status pill reading the active case's
  contract `status` field: "Verified data" (green-bg pill) — this is the honesty badge,
  driven by the data, not hardcoded.

### Bottom strip
One muted line, always visible:
"Data: RTA challenge dataset 2023–2025 (26,304 hrs × 18 corridors) · Forecast &
simulation outputs are indicative · Display routes adjusted to road geometry"
This bakes the three honesty disclosures permanently into the UI.

---

## 3. The map (js/map.js)

- Mapbox GL JS v3, style: `mapbox://styles/mapbox/dark-v11`
- Token: read from a `config.js` (gitignored) — never hardcode in committed files
- Initial view: centered ~[55.31, 25.24], zoom 11.3 — frames all pins

### Layer 1 — network pins (always visible)
All 18 corridors from `case_4_citywide_triage.json`'s triage_table, plotted at their
dataset coordinates as circle markers:
- Fill by severity_color (red/amber/green vars), 7px radius, 1.5px darker stroke
- Hover: tooltip card (bg-2, border, 12px padding) showing location_id, area,
  los_f_pct, demand_gap_vph — values straight from the contract
- The 10 junctions (from a small static list in data.js with their reference coords)
  as diamond-shaped markers (rotated square), gray by default; JCT_MAMZ and JCT_DEF
  get a subtle 2s opacity pulse (0.5→1.0) — the only animation at rest

### Layer 2 — case route + flow animation (per active scenario)
When a scenario is selected:
1. Fetch the road geometry ONCE per case from Mapbox Directions API using the anchors
   below, cache in memory (and localStorage fallback is NOT allowed — cache in a JS
   object only). If offline/failed: draw a straight dashed line between anchors and
   show a small "route geometry unavailable — schematic line" note. Never break.
2. Draw the route as a 5px line in the case's severity color at 60% opacity.
3. Animate flow dots along the geometry: small 5px circles moving point-to-point along
   the returned coordinates. Density and speed come from the contract's
   flow_animation block (speed_factor scales traversal time; density maps to dot
   count: high=14, medium=8, low=4).
4. Camera: smooth flyTo the case's route (fitBounds with 80px padding, 1.2s ease).

### VERIFIED anchors (use exactly — lng,lat order)
| Case | Segment | Anchor A | Anchor B |
|---|---|---|---|
| 1 | ITT_W1 Al Ittihad Rd | 55.338, 25.268 | 55.355, 25.295 |
| 2 main | SZR_N1 northbound | 55.275898, 25.211992 | 55.287122, 25.228347 |
| 2 secondary | SZR_S1 southbound | 55.283953, 25.224351 | 55.272668, 25.207789 |
| 3 | MAK_N1 Al Maktoum Bridge | 55.320805, 25.251252 | 55.326906, 25.259271 |
| 5 | AIR_W1 Airport Rd | 55.344955, 25.251739 | 55.334415, 25.257095 |

Case 2 draws BOTH directions simultaneously (two flows converging on the JCT_DEF
diamond) — this is deliberate, it's the "both directions feeding one stressed junction"
visual. Case 4 draws no route — it's the pin overview with the right panel showing the
ranked table. Case 3 adds a subtle animated rain overlay ONLY while active (thin
semi-transparent streaks, CSS animation over the map container, pointer-events none) +
an incident icon cluster near the bridge.

### Junction display note
JCT markers sit at their reference coordinates. Do NOT draw the route line through the
junction diamond — corridor and junction are separate real-world facilities (expressway
vs surface junction). They are shown as neighbors, not as one road. Add this as a code
comment.

---

## 4. Right panel (js/app.js renders from contract JSON)

Rendered top to bottom per active case. Every value read from the JSON — the renderer
must throw a visible error banner if a field is missing, never silently show blank.

1. **Case header:** title (17px/600) + diagnosis-type badge. Badge colors:
   SIGNAL_ISSUE red-bg/red text · DEMAND_EXCEEDS_ADAPTIVE amber-bg/amber ·
   WEATHER_INCIDENT accent-bg/accent · NO_SIGNAL_ATTRIBUTABLE bg-2/text-mid ·
   citywide gets no badge.

2. **Metric cards row** (3 across, grid): los_f_pct ("% hours at gridlock"),
   demand_gap_vph ("unmet demand, veh/hr"), mean_vc ("volume/capacity"). 22px
   tabular-nums values, 13px muted labels. Case 3 labels its values "storm-day";
   case 4 replaces this row with the ranked 18-row table (compact rows: dot ·
   location_id · area · los_f_pct · gap; sortable by clicking the los_f column
   header; the active severity dot uses the palette colors).

3. **Diagnosis card:** section label "DIAGNOSIS", the Mistral summary text (15px,
   1.6 line-height), then the evidence list as compact rows with a 4px left border
   in the severity color. Confidence: thin horizontal bar (6px) filled to
   confidence_pct with the % as tabular text; if human_review_required, an amber
   pill "Human review required" sits next to it.

4. **Fixes card (cases 1/2/5):** section label "TESTED FIXES", one row per simulate
   candidate: fix name, before→after vc and delay (tabular, with a small → glyph),
   Δ% in the severity-appropriate color, cost/disruption as 5-dot scales. The
   top_fix row gets a subtle accent left border + "Recommended" 11px label. The
   method_label ("Capacity-delay calculation — indicative, not micro-simulated")
   renders as a muted footnote under the card — always visible, from the JSON.
   A not-estimable candidate renders greyed with "Not estimable with this model" —
   it must be SHOWN, not hidden; it's an honesty feature.

5. **Recommendation card:** section label "RECOMMENDATION", the Mistral
   rank.recommendation text. Quiet accent left border.

6. **Before/after control:** a segmented toggle (Before conditions / After top fix)
   that (a) switches the flow animation speed/density between the contract's
   before/after blocks and (b) swaps the metric highlight. Only for cases with
   simulate candidates. Default state: Before.

---

## 5. Interaction rules

- Scenario switch: tab click or ←/→ keys. Panel content crossfades (150ms), map
  flyTo runs, flow dots for the previous case are removed before the new ones mount.
- No modals, no drawers, no hidden content. Everything visible or one tab away.
- All animations ≤ 1.2s and interruptible. If the user switches tabs mid-fly, cancel
  and start the new transition.
- The demo must run smoothly on a laptop with the venue's projector resolution —
  test at 1366×768 as the minimum; the right panel may shrink to 360px below 1280px
  width.

## 6. Resilience (demo-day insurance)

- On load, js/data.js validates all 5 contract files (same checks as validate.py:
  parse, required fields). Any failure → a single red banner at top naming the file
  and field; the other cases still work.
- Directions API fetch: 5s timeout → schematic dashed fallback line + note (see §3).
  The demo NEVER white-screens because of network.
- No console errors on a clean run. No TODOs left in code.

## 7. What NOT to build

- No routing/shortest-path features, no draggable pins, no live data claims
- No login screen, no fake user avatars, no notification bells — mock chrome that
  implies features that don't exist reads as dishonest under questioning
- No third-party UI kits (Bootstrap/Tailwind CDN etc.) — hand-rolled CSS per §1 only
- No localStorage/sessionStorage anywhere

## 8. Definition of done

- All 5 scenarios render fully from contract JSON with zero hardcoded data values
- All 5 route geometries load and animate (and the fallback works — test by blocking
  the network once)
- Case 2 shows both directions converging; Case 3 shows rain overlay + storm-day
  labels; Case 4's table sorts; Case 5 shows the not-estimable row
- Status pill, method footnote, and bottom disclosure strip all render from
  data/config, not hardcoded strings scattered in HTML
- Runs 3 consecutive full walkthroughs (all tabs) with no console errors
