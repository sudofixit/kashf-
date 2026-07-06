/* Kashf — data.js
 * Loads the five contract JSON files, validates them (same spirit as
 * contract/validate.py: parse + required fields), and exposes the parsed cases
 * plus the small pieces of REFERENCE GEOMETRY (corridor/junction coordinates) and
 * UI copy the renderer needs.
 *
 * IMPORTANT: no case *metric* is hardcoded here. LOCATION_COORDS and JUNCTIONS are
 * reference map coordinates only (they live in the RTA reference tables, not in the
 * contract), used purely to place pins. Every rendered number comes from the contract.
 */
(function () {
  "use strict";

  // ---- Reference geometry (map placement only) — [lng, lat] ----------------
  // 18 corridor count-site coordinates (locations_reference.csv).
  const LOCATION_COORDS = {
    SZR_N1: [55.282, 25.223], SZR_S1: [55.2832, 25.2228], SZR_N2: [55.279, 25.211],
    SZR_S2: [55.2802, 25.2108], SZR_N4: [55.2, 25.118], SZR_S4: [55.2012, 25.1178],
    EKR_N1: [55.27, 25.186], EKR_S1: [55.235, 25.149], MBZ_E1: [55.17, 24.99],
    EMR_E1: [55.44, 25.17],
    // Al Ittihad Road pins snapped to the actual carriageway (Al Mamzar / Al Qiyadah ends).
    ITT_W1: [55.35957550284009, 25.28847284318247], ITT_E1: [55.3401479077066, 25.26701319534],
    AIR_W1: [55.352, 25.248], GAR_N1: [55.33, 25.233], MAK_N1: [55.317, 25.24],
    BBC_S1: [55.29, 25.192], JBR_X1: [55.248, 25.208], DWC_X1: [55.161, 24.896]
  };

  // 10 signal junctions (signal_junctions_reference.csv).
  const JUNCTIONS = [
    { id: "JCT_DEF", name: "Defence Roundabout Signals", area: "Trade Centre", coords: [55.2845, 25.2235], control: "SCOOT-adaptive" },
    { id: "JCT_SAFA", name: "Al Safa Junction", area: "Al Safa", coords: [55.252, 25.188], control: "SCOOT-adaptive" },
    { id: "JCT_WASL", name: "Al Wasl / Al Hadiqa Junction", area: "Al Wasl", coords: [55.244, 25.196], control: "Fixed-time" },
    { id: "JCT_OUD", name: "Oud Metha Junction", area: "Oud Metha", coords: [55.312, 25.235], control: "SCOOT-adaptive" },
    { id: "JCT_GARH", name: "Al Garhoud Junction", area: "Garhoud", coords: [55.346, 25.241], control: "SCOOT-adaptive" },
    { id: "JCT_MAMZ", name: "Al Mamzar Junction", area: "Al Mamzar", coords: [55.35, 25.294], control: "Fixed-time" },
    { id: "JCT_QUOZ", name: "Al Quoz Junction", area: "Al Quoz", coords: [55.233, 25.143], control: "Fixed-time" },
    { id: "JCT_BARSHA", name: "Al Barsha Junction", area: "Al Barsha", coords: [55.198, 25.112], control: "SCOOT-adaptive" },
    { id: "JCT_KARAMA", name: "Karama / Trade Centre Junction", area: "Karama", coords: [55.304, 25.247], control: "SCOOT-adaptive" },
    { id: "JCT_DEIRA", name: "Deira / Al Ittihad Junction", area: "Deira", coords: [55.334, 25.271], control: "Fixed-time" }
  ];

  // Junctions that pulse at rest (the two stressed signals in the demo).
  const PULSE_JUNCTIONS = ["JCT_MAMZ", "JCT_DEF"];

  // ---- UI copy / config (not case data) ------------------------------------
  const TAB_ORDER = [
    { file: "case_1_al_mamzar.json", label: "Al Mamzar" },
    { file: "case_2_szr_defence.json", label: "SZR Defence" },
    { file: "case_3_storm.json", label: "April 2024 Storm" },
    { file: "case_4_citywide_triage.json", label: "Citywide triage" },
    { file: "case_5_garhoud_no_signal.json", label: "Garhoud" }
  ];

  // Bottom strip — the three permanent honesty disclosures, from config not HTML.
  const DISCLOSURE_LINE =
    "Data: RTA challenge dataset 2023–2025 (26,304 hrs × 18 corridors) · " +
    "Forecast & simulation outputs are indicative · Display routes adjusted to road geometry";

  // Mandatory permanent disclosure for the Mapbox live-traffic base layer (Part A1).
  const TRAFFIC_DISCLOSURE =
    "Live conditions: Mapbox crowd data — our analysis uses the RTA dataset.";

  // Metric cards: plain-English line (from contract.plain[plainKey]) is primary; the
  // technical value + unit renders muted beneath it (Part D2).
  const METRICS = [
    { key: "los_f_pct", plainKey: "los_f", tech: (v) => `${v}% hours at LOS F` },
    { key: "demand_gap_vph", plainKey: "gap", tech: (v) => `${v} veh/hr unmet demand` },
    { key: "mean_vc", plainKey: "vc", tech: (v) => `${v} volume/capacity` }
  ];

  // Diagnosis badge styling by type.
  const BADGES = {
    SIGNAL_ISSUE: { cls: "badge-red", text: "Signal issue" },
    DEMAND_EXCEEDS_ADAPTIVE: { cls: "badge-amber", text: "Demand exceeds adaptive" },
    WEATHER_INCIDENT: { cls: "badge-accent", text: "Weather incident" },
    NO_SIGNAL_ATTRIBUTABLE: { cls: "badge-neutral", text: "No signal attributable" }
  };

  // density -> flow dot count. Spec: high=14, medium=8, low=4; "gridlock" (used by
  // the contract's before-states) extends the scale as the densest tier.
  const DENSITY_DOTS = { gridlock: 16, high: 14, medium: 8, low: 4 };

  // ---- Contract validation (mirror of contract/validate.py) ----------------
  const STANDARD_REQUIRED = [
    "case_id", "title", "status",
    "map.corridor_id", "map.junction_id", "map.route_anchors", "map.junction_point", "map.severity_color",
    "triage.rank", "triage.los_f_pct", "triage.demand_gap_vph", "triage.mean_vc", "triage.narrative",
    "diagnosis.type", "diagnosis.summary", "diagnosis.evidence", "diagnosis.confidence_pct", "diagnosis.human_review_required",
    "simulate.method", "simulate.method_label", "simulate.candidates",
    "rank.recommendation", "rank.top_fix",
    "flow_animation.before", "flow_animation.after"
  ];
  const CITYWIDE_REQUIRED = ["case_id", "title", "status", "triage_table"];

  function hasPath(obj, dotted) {
    let cur = obj;
    const parts = dotted.split(".");
    for (const p of parts) {
      if (cur === null || typeof cur !== "object" || !(p in cur)) return false;
      cur = cur[p];
    }
    return true; // present even if the value is null (junction_id/point may be null)
  }

  function validateCase(file, data) {
    const errs = [];
    const isCitywide = "triage_table" in data;
    const required = isCitywide ? CITYWIDE_REQUIRED : STANDARD_REQUIRED;
    for (const r of required) {
      if (!hasPath(data, r)) errs.push({ file, field: r, msg: "missing required field" });
    }
    if (data.status !== "verified" && data.status !== "partial") {
      errs.push({ file, field: "status", msg: `invalid status "${data.status}"` });
    }
    if (isCitywide && Array.isArray(data.triage_table) && data.triage_table.length !== 18) {
      errs.push({ file, field: "triage_table", msg: `expected 18 rows, got ${data.triage_table.length}` });
    }
    return errs;
  }

  // ---- Loader --------------------------------------------------------------
  async function loadContract() {
    const cases = {};
    const order = [];
    const errors = [];
    for (const tab of TAB_ORDER) {
      const url = "../backend/contract/" + tab.file;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        const errs = validateCase(tab.file, data);
        errors.push(...errs);
        cases[data.case_id] = data;
        order.push({ case_id: data.case_id, label: tab.label, file: tab.file });
      } catch (e) {
        errors.push({ file: tab.file, field: "(load)", msg: String(e && e.message ? e.message : e) });
      }
    }
    return { cases, order, errors };
  }

  window.KashfData = {
    LOCATION_COORDS, JUNCTIONS, PULSE_JUNCTIONS, TAB_ORDER, DISCLOSURE_LINE,
    TRAFFIC_DISCLOSURE, METRICS, BADGES, DENSITY_DOTS, loadContract
  };
})();
