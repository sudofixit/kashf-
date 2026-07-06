/* Kashf — translations.js
 * DISPLAY-ONLY plain-English layer. The contract JSON keeps the technical IDs and
 * variable codes; this module renders them in plain English at render time. Nothing
 * here mutates case data.
 *
 * Names are DERIVED from the RTA reference tables, not guessed:
 *   - corridors: locations_reference.csv (road_name + direction + area)
 *   - junctions: signal_junctions_reference.csv (junction_name, verbatim)
 *
 * Exports (window.KashfTranslate):
 *   name(id)   → plain English location/junction name  ("Al Mamzar Junction")
 *   term(str)  → plain English for one technical term   ("Fixed-time" → "fixed-timing signal")
 *   diag(type) → plain English diagnosis label
 *   text(str)  → replaces every known ID/term embedded in a longer string (evidence,
 *                summaries, recommendations, fix names, annotations, the citywide narrative)
 */
(function () {
  "use strict";

  // ---- Names (18 corridors + 10 junctions) ---------------------------------
  // Corridors: "<road_name> (<direction>) — <area>". Bridges/crossings omit the
  // redundant area; the two "Both (sample)" corridors omit the direction.
  const NAMES = {
    // Sheikh Zayed Road (E11)
    SZR_N1: "Sheikh Zayed Road (northbound) — Trade Centre",
    SZR_S1: "Sheikh Zayed Road (southbound) — Trade Centre",
    SZR_N2: "Sheikh Zayed Road (northbound) — DIFC",
    SZR_S2: "Sheikh Zayed Road (southbound) — DIFC",
    SZR_N4: "Sheikh Zayed Road (northbound) — Al Barsha",
    SZR_S4: "Sheikh Zayed Road (southbound) — Al Barsha",
    // Al Khail Road (E44)
    EKR_N1: "Al Khail Road (northbound) — Business Bay",
    EKR_S1: "Al Khail Road (southbound) — Al Quoz",
    // Cross-city arterials / rings
    MBZ_E1: "Mohammed Bin Zayed Road (eastbound) — DIP",
    EMR_E1: "Emirates Road (eastbound) — Al Awir",
    ITT_W1: "Al Ittihad Road (westbound) — Al Mamzar",
    ITT_E1: "Al Ittihad Road (eastbound) — Al Qiyadah",
    AIR_W1: "Airport Road (westbound) — Al Garhoud",
    // Creek crossings (area omitted — the structure names the place)
    GAR_N1: "Al Garhoud Bridge (northbound)",
    MAK_N1: "Al Maktoum Bridge (northbound)",
    BBC_S1: "Business Bay Crossing (southbound)",
    // Both-direction sample sites (no single direction)
    JBR_X1: "Jumeirah Beach Road — Jumeirah",
    DWC_X1: "Expo Road — Dubai South",

    // Signal junctions (junction_name verbatim from the reference table)
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

  // ---- Terms ---------------------------------------------------------------
  // Exact-match lookup used by term() (e.g. a junction's control_type label).
  const TERMS = {
    "LOS F": "gridlock",
    "LOS E": "near-gridlock",
    "LOS D": "heavy traffic",
    "vc_ratio": "road fullness",
    "v/c": "road fullness",
    "demand_vph": "vehicles wanting to use this road per hour",
    "volume_vph": "vehicles actually getting through per hour",
    "degree_of_saturation": "signal capacity used",
    "phase_failures": "times the signal couldn't clear the queue",
    "SCOOT-adaptive": "smart adaptive signal",
    "Fixed-time": "fixed-timing signal"
  };

  // ---- Diagnosis types -----------------------------------------------------
  const DIAG = {
    SIGNAL_ISSUE: "Signal timing problem",
    DEMAND_EXCEEDS_ADAPTIVE: "Too much traffic — even for a smart signal",
    WEATHER_INCIDENT: "Road impaired by weather / incident",
    NO_SIGNAL_ATTRIBUTABLE: "Capacity problem — not a signal fault"
  };

  // ---- Inline replacements for text() --------------------------------------
  // Ordered longest-/phrase-first so partial forms never win. The control-type
  // phrases fold the trailing "signal" so we never emit "signal signal".
  const INLINE = [
    [/Fixed-time signal/gi, "fixed-timing signal"],
    [/SCOOT-adaptive signal/gi, "smart adaptive signal"],
    [/Fixed-time/gi, "fixed-timing signal"],
    [/SCOOT-adaptive/gi, "smart adaptive signal"],
    [/degree_of_saturation/g, "signal capacity used"],
    [/phase_failures/g, "times the signal couldn't clear the queue"],
    // NB: the spaced author phrase "phase failures" is already plain English and reads as a
    // noun ("frequent phase failures") — expanding it inline would break grammar, so leave it.
    [/los_f_pct/g, "gridlock-hour share"],
    [/demand_vph/g, "vehicles wanting to use this road per hour"],
    [/volume_vph/g, "vehicles actually getting through per hour"],
    [/vc_ratio/g, "road fullness"],
    [/v\/c/g, "road fullness"],
    [/LOS F/g, "gridlock"],
    [/LOS E/g, "near-gridlock"],
    [/LOS D/g, "heavy traffic"]
  ];

  // Codes that, when they appear as a bare "(CODE)" parenthetical, are a redundant
  // cross-reference in prose — the descriptive word already precedes them, so we drop
  // the parenthetical (the ID stays visible in the table / tooltips / muted convention).
  const PAREN_CODES = new Set(
    Object.keys(NAMES).concat(["LOS F", "LOS E", "LOS D", "los_f_pct",
      "vc_ratio", "v/c", "demand_vph", "volume_vph", "degree_of_saturation",
      "phase_failures", "Fixed-time", "SCOOT-adaptive"])
  );

  // Word-boundary matcher for every location/junction ID (longest first).
  const ID_KEYS = Object.keys(NAMES).sort((a, b) => b.length - a.length);
  const ID_RE = new RegExp("\\b(" + ID_KEYS.join("|") + ")\\b", "g");

  // ---- API -----------------------------------------------------------------
  function name(id) {
    if (id === null || id === undefined) return "";
    return NAMES[id] || String(id);
  }

  function term(str) {
    if (str === null || str === undefined) return "";
    const k = String(str);
    return TERMS[k] !== undefined ? TERMS[k] : k;
  }

  function diag(type) {
    if (type === null || type === undefined) return "";
    return DIAG[type] || String(type);
  }

  function text(str) {
    if (str === null || str === undefined) return "";
    let s = String(str);
    // 1) Clean redundant codes out of parentheticals:
    //    "(ITT_W1)"            → dropped entirely (a name already precedes it in prose)
    //    "(Al Maktoum Bridge, MAK_N1)" → "(Al Maktoum Bridge)" (strip the redundant code segment)
    //    every other parenthetical (stats, dates, notes) is kept verbatim.
    s = s.replace(/\s*\(([^()]+)\)/g, (m, inner) => {
      const raw = inner.trim();
      if (PAREN_CODES.has(raw)) return "";
      const segs = raw.split(",").map((x) => x.trim());
      if (segs.length > 1 && segs.some((x) => PAREN_CODES.has(x)) && segs.some((x) => x && !PAREN_CODES.has(x))) {
        return " (" + segs.filter((x) => x && !PAREN_CODES.has(x)).join(", ") + ")";
      }
      return m;
    });
    // 2) Expand bare terms / variable codes.
    for (const [re, rep] of INLINE) s = s.replace(re, rep);
    // 3) Expand bare location/junction IDs to their plain names.
    s = s.replace(ID_RE, (m) => NAMES[m] || m);
    return s;
  }

  window.KashfTranslate = { name, term, diag, text, NAMES, TERMS, DIAG };
})();
