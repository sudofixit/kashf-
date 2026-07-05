/* Kashf — translations.js
 * Display-only translation layer. The contract JSON keeps the technical IDs;
 * this turns them into plain English at render time so judges never meet a raw
 * code or an unexplained acronym.
 *
 * Names are DERIVED from the dataset reference files (locations_reference.csv
 * road_name/direction/area, signal_junctions_reference.csv junction_name) — not
 * guessed. Exposes KashfTranslate.name / .term / .diag / .text.
 */
(function () {
  "use strict";

  // Corridor (location_id) → "Road (direction) — Area", from the reference file.
  const LOCATIONS = {
    SZR_N1: "Sheikh Zayed Road (northbound) — Trade Centre",
    SZR_S1: "Sheikh Zayed Road (southbound) — Trade Centre",
    SZR_N2: "Sheikh Zayed Road (northbound) — DIFC",
    SZR_S2: "Sheikh Zayed Road (southbound) — DIFC",
    SZR_N4: "Sheikh Zayed Road (northbound) — Al Barsha",
    SZR_S4: "Sheikh Zayed Road (southbound) — Al Barsha",
    EKR_N1: "Al Khail Road (northbound) — Business Bay",
    EKR_S1: "Al Khail Road (southbound) — Al Quoz",
    MBZ_E1: "Mohammed Bin Zayed Road — Dubai Investment Park",
    EMR_E1: "Emirates Road — Al Awir",
    ITT_W1: "Al Ittihad Road (westbound) — Al Mamzar",
    ITT_E1: "Al Ittihad Road (eastbound) — Al Qiyadah",
    AIR_W1: "Airport Road (westbound) — Al Garhoud",
    GAR_N1: "Al Garhoud Bridge (northbound)",
    MAK_N1: "Al Maktoum Bridge (northbound)",
    BBC_S1: "Business Bay Crossing (southbound)",
    JBR_X1: "Jumeirah Beach Road — Jumeirah",
    DWC_X1: "Expo Road — Dubai South"
  };

  // Junction (junction_id) → junction_name, verbatim from the reference file.
  const JUNCTIONS = {
    JCT_DEF: "Defence Roundabout Signals",
    JCT_SAFA: "Al Safa Junction",
    JCT_WASL: "Al Wasl / Al Hadiqa Junction",
    JCT_OUD: "Oud Metha Junction",
    JCT_GARH: "Al Garhoud Junction",
    JCT_MAMZ: "Al Mamzar Junction",
    JCT_QUOZ: "Al Quoz Junction",
    JCT_BARSHA: "Al Barsha Junction",
    JCT_KARAMA: "Karama / Trade Centre Junction",
    JCT_DEIRA: "Deira / Al Ittihad Junction"
  };

  const NAMES = Object.assign({}, LOCATIONS, JUNCTIONS);
  // Longest codes first so no code is a prefix-collision of another.
  const NAME_CODES = Object.keys(NAMES).sort((a, b) => b.length - a.length);

  // Technical terms → plain English (for prose; muted precision lines may keep the
  // technical form by design).
  const TERMS = {
    "LOS F": "gridlock",
    "LOS E": "near-gridlock",
    "LOS D": "heavy traffic",
    "degree of saturation": "signal capacity used",
    "degree_of_saturation": "signal capacity used",
    "phase failures": "times the signal couldn't clear the queue",
    "phase_failures": "times the signal couldn't clear the queue",
    "demand_vph": "vehicles wanting to use this road per hour",
    "volume_vph": "vehicles actually getting through per hour",
    "vc_ratio": "road fullness",
    "v/c ratio": "road fullness",
    "v/c": "road fullness",
    "SCOOT-adaptive": "smart adaptive",
    "SCOOT": "smart adaptive",
    "Fixed-time": "fixed-timing",
    "fixed-time": "fixed-timing"
  };
  const TERM_KEYS = Object.keys(TERMS).sort((a, b) => b.length - a.length);

  // Diagnosis type enums → plain English.
  const DIAG = {
    SIGNAL_ISSUE: "Signal timing problem",
    DEMAND_EXCEEDS_ADAPTIVE: "Too much traffic — even for a smart signal",
    WEATHER_INCIDENT: "Road impaired by weather / incident",
    NO_SIGNAL_ATTRIBUTABLE: "Capacity problem — not a signal fault"
  };

  function name(id) { return NAMES[id] || id; }
  function term(str) { return TERMS[str] || str; }
  function diag(type) { return DIAG[type] || type; }

  // Replace any known ID or term inside a longer string. Codes first, then terms,
  // each longest-first to avoid partial overlaps.
  function text(str) {
    let out = String(str);
    for (const code of NAME_CODES) out = out.split(code).join(NAMES[code]);
    for (const key of TERM_KEYS) out = out.split(key).join(TERMS[key]);
    return out;
  }

  window.KashfTranslate = { name, term, diag, text, LOCATIONS, JUNCTIONS };
})();
