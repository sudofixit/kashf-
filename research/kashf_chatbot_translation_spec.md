# Kashf — Translation Layer & "Ask Kashf" Chatbot Build Spec

*Two upgrades to the existing working frontend: (1) every technical variable renders
in plain English, (2) a live Mistral-powered chat drawer that reasons about the
active case. Extend frontend/ as it stands — do not rebuild anything.*

---

## Part 1 — Translation layer (do this first)

### 1.1 Create frontend/js/translations.js
One lookup object + one function, covering three categories. Verify each English
name against locations_reference.csv / signal_junctions_reference.csv road_name and
area fields — do not guess names, derive them from the reference files:

LOCATIONS (derive full set from reference files; examples):
  ITT_W1  → "Al Ittihad Road (westbound) — Al Mamzar"
  ITT_E1  → "Al Ittihad Road (eastbound) — Al Qiyadah"
  SZR_N1  → "Sheikh Zayed Road (northbound) — Trade Centre"
  SZR_S1  → "Sheikh Zayed Road (southbound) — Trade Centre"
  MAK_N1  → "Al Maktoum Bridge (northbound)"
  AIR_W1  → "Airport Road (westbound) — Al Garhoud"
  JCT_MAMZ → "Al Mamzar Junction"
  JCT_DEF  → "Defence Roundabout Signals"
  JCT_GARH → "Al Garhoud Junction"
  ... (all 18 corridors + 10 junctions)

TERMS:
  "LOS F" → "gridlock"        "LOS E" → "near-gridlock"    "LOS D" → "heavy traffic"
  vc_ratio / v/c → "road fullness"
  demand_vph → "vehicles wanting to use this road per hour"
  volume_vph → "vehicles actually getting through per hour"
  degree_of_saturation → "signal capacity used"
  phase_failures → "times the signal couldn't clear the queue"
  SCOOT-adaptive → "smart adaptive signal"    Fixed-time → "fixed-timing signal"

DIAGNOSIS TYPES:
  SIGNAL_ISSUE → "Signal timing problem"
  DEMAND_EXCEEDS_ADAPTIVE → "Too much traffic — even for a smart signal"
  WEATHER_INCIDENT → "Road impaired by weather / incident"
  NO_SIGNAL_ATTRIBUTABLE → "Capacity problem — not a signal fault"

Export: KashfTranslate.name(id), KashfTranslate.term(str), KashfTranslate.diag(type),
plus KashfTranslate.text(str) that replaces any known ID/term inside a longer string
(used for evidence lines and annotations that embed codes).

### 1.2 Apply at render time only
- app.js: every rendered location/junction name, badge, evidence line, tooltip,
  table row, and annotation passes through the translator. The contract JSON keeps
  the technical IDs — translation is display-only.
- Display convention everywhere: English name primary; the technical ID appears
  small and muted after it once per card/tooltip, e.g. "Al Mamzar Junction
  (JCT_MAMZ)" — judges with the dataset can still cross-reference.
- Case 4's table: name column shows English names; a narrow muted ID column stays
  (it is a data table).
- Map tooltips and annotation cards: translated names, same convention.
- Do NOT translate inside the small muted technical metric lines (e.g. "8.27%
  hours at LOS F" may remain) — those are the precision layer by design.

---

#
## Part 2 — Definition of done
- Zero raw variable codes visible as primary text anywhere in the UI (IDs may
  appear only in the muted secondary convention or Case 4's ID column)
- Existing walkthrough still clean: all 5 tabs × 3 rounds, no console errors,
  frame rate unaffected by the drawer
- 
