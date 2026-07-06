# Kashf — Feasibility Verification Report

_Independent, from-scratch verification against the real files in `CUD_RTA_Traffic_Dataset/datasets`. Every number below was computed directly from the data; no prior claim was taken as given. Verification only — no build code written._

**Flagship case:** Al Ittihad Road @ Al Mamzar (Dubai–Sharjah border).
**Verified IDs:** `location_id = ITT_W1` (traffic) ↔ `junction_id = JCT_MAMZ` (signal). See Step 3.

---

## Bottom line — five-stage verdict

| Stage | Verdict | One-line reason |
|---|---|---|
| **Triage** | ✅ **GO** | All congestion-severity fields (volume, demand, `vc_ratio`, LOS, TTI) exist, clean, 3 yrs hourly. |
| **Diagnose** | ⚠️ **GO WITH CAVEAT** | No land-use/POI field exists (Step 1); OSM only *partially* fills the gap (Step 4). Works via incident + signal-saturation + demand attribution; land-use causes stay qualitative/human-verified. |
| **Simulate** | ⚠️ **GO WITH CAVEAT** | Analytical capacity-delay fallback is fully supported and is the recommended path. No historical intervention to calibrate against (Step 2); SUMO not justified for v1. |
| **Rank** | ✅ **GO** | All inputs to a benefit/priority score exist; inherits only Simulate's model uncertainty. |
| **Learn** | ⚠️ **GO WITH CAVEAT** (closed-loop = ❌ **NO-GO** in v1) | No record of past interventions & outcomes exists. Historical backtesting + adaptive-on/off contrast are possible; learning from Kashf's *own* recommendations needs data that doesn't exist yet. |

**Overall:** Kashf is buildable on this dataset, and the flagship (ITT_W1 / JCT_MAMZ) is an unusually strong case because a congested corridor and a **Fixed-time** signal are co-located. The two real constraints to design around are (1) **no structured land-use data** and (2) **no historical intervention record** — both are inherent to the files, not fixable by cleaning.

---

## STEP 1 — Land-use / POI data in `locations_reference.csv`

**Every column (15):** `location_id`, `location_name`, `road_code`, `road_name`, `area`, `direction`, `num_lanes`, `free_flow_speed_kph`, `speed_limit_kph`, `capacity_vph`, `aadt_per_direction`, `profile_type`, `latitude`, `longitude`, `growth_key`. (18 rows.)

**Verdict: ❌ Genuine land-use / POI context does NOT exist in this file.**

Column-by-column, nothing encodes "adjacent to a mall / driveway merge / residential vs commercial frontage":
- `road_code`, `road_name`, `num_lanes`, `*_speed_kph`, `capacity_vph`, `aadt_per_direction` → **road classification & engineering geometry**, not land use.
- `area` → district label (Trade Centre, Al Mamzar…), not land use.
- `profile_type` → demand-shape code (`cin`, `cout`, `frgt`, `mix`, `leis`, `expo` = commuter-in/out, freight, mixed, leisure, expo). This is the **closest proxy** — it weakly implies surrounding activity (e.g. `leis` = Jumeirah Beach) — but it is a traffic-demand template, not POI/frontage context.
- `location_name` → free text that *occasionally* names a landmark ("@ 4th Interchange (Mall of Emirates)", "(DIFC)", "(Dubai Investment Park)"). Incidental orientation text, unstructured, not present for most rows, and not parseable as reliable land-use.

**Consequence for Diagnose:** any "physical/land-use cause" must come from outside this file (→ Step 4 OSM), or be reframed onto causes the data *does* support (signal saturation, incidents, capacity deficit).

---

## STEP 2 — Historical time dimension in `signal_timing_plans.csv`

**Columns (14):** `junction_id`, `junction_name`, `program`, `active_hours`, `cycle_length_s`, `phase_id`, `movement`, `green_s`, `yellow_s`, `all_red_s`, `min_green_s`, `max_green_s`, `coordination_offset_s`, `control_type`. (195 rows = 10 junctions × 5 programs × 3–4 phases.)

**There is no date, effective-date, version, or year column.** The multiple rows per junction are **time-of-day programs within one static, current configuration**:
- `program` ∈ {Early Morning, AM Peak, Midday, PM Peak, Evening}
- `active_hours` are **clock windows** (`00:00-06:00`, `06:00-10:00`, …), not calendar dates.

Each junction has exactly one plan set; the same `junction_id + program + phase` never recurs with a different green time at a different date.

**Verdict: ❌ A "before/after" natural experiment using historical timing-plan changes is NOT possible with this file.** There is no record that any plan ever changed during 2023–2025.

**Additional red flag (verified by inspection):** the green splits are a **shared template** — `JCT_MAMZ` (Fixed-time) has *identical* green/cycle values to the SCOOT-adaptive junctions (17/8/17/8 @ 70 s, 41/19/41/19 @ 140 s, …). Only `JCT_QUOZ` has genuinely distinct 3-phase values. So the timing "plans" are largely synthetic boilerplate; only the `control_type` label distinguishes the flagship's signal. Treat any timing-based simulation as **indicative, not calibrated to real junction-specific engineering.**

**Partial alternative (not a plan-change experiment):** `signal_performance_hourly` carries an hourly `adaptive_active` flag and `active_program`. At SCOOT junctions this enables an *adaptive-on vs adaptive-off* quasi-experiment — but the flagship `JCT_MAMZ` is Fixed-time, so this does not help the flagship.

---

## STEP 3 — Flagship real numbers (computed from `traffic_volume_hourly_2023/24/25`)

**ID confirmation (from the files themselves):**
- `locations_reference.csv` → **`ITT_W1`** = "Al Ittihad Rd @ Al Mamzar (Dubai-Sharjah border)", D89, area *Al Mamzar*, dir *WB (to Dubai)*, 5 lanes, capacity 7000 vph, lat/long **25.295 / 55.355**. (The paired `ITT_E1` is a *different* location — Al Qiyadah, EB to Sharjah — not the Al Mamzar crossing.)
- `signal_junctions_reference.csv` → **`JCT_MAMZ`** = "Al Mamzar Junction", area *Al Mamzar*, lat/long **25.294 / 55.35**, **Fixed-time**. This is **~0.52 km** from ITT_W1 (haversine, corrected 2026-07-05 — an earlier draft said "~0.1 km", which was an un-computed eyeball estimate) and shares the area → confirmed co-located signal. (`JCT_DEIRA` = "Deira / Al Ittihad Junction" is nearer the ITT_E1 end.)

**Method:** concatenated all 3 years (26,304 hourly rows for ITT_W1), then:
- `mean_gap = mean(demand_vph) − mean(volume_vph)`; cross-checked as `(Σdemand − Σvolume) / N`.
- `%LOS F = count(level_of_service == 'F') / N × 100`.

### Result — ITT_W1 (flagship)

| Metric | Value |
|---|---|
| Hours (2023–2025) | 26,304 |
| Mean `demand_vph` | 3,603.2 |
| Mean `volume_vph` | 3,485.5 |
| **Mean gap (demand − volume)** | **117.7 vph**  _(cross-check (ΣD−ΣV)/N = 117.7 ✓)_ |
| **% hours at LOS F** | **8.27%** (2,176 / 26,304) |
| LOS distribution | A 36.4% · B 12.9% · C 26.3% · D 12.0% · E 4.1% · **F 8.3%** |
| Mean `vc_ratio` / max | 0.498 / 1.05 |
| Mean `travel_time_index` | 1.172 |
| Mean `avg_speed_kph` | 70.6 |

**Critical nuance (be direct):** the 117.7 vph average is *low because unmet demand is rare-but-severe*. The gap is **> 0 in only 7.8% of hours**; in those hours it averages **1,506 vph** (max **5,660**). For 92% of hours `demand == volume` (a generation artifact — unmet demand only appears in the congested tail). So the flagship's problem is **peak-concentrated**, not chronic — Triage/Diagnose must look at the peak tail, not the annual mean, or it will understate the bottleneck.

**Worsening trend (real, monotonic):**

| Year | Mean gap (vph) | % LOS F |
|---|---|---|
| 2023 | 80.3 | 6.64% |
| 2024 | 117.7 | 7.99% |
| 2025 | 155.1 | 10.18% |

_(Reference — ITT_E1, Al Qiyadah/EB: mean gap 101.6 vph, LOS F 7.76%, same worsening trend.)_

---

## STEP 4 — Real Overpass API test (live query, run now)

Queried the live Overpass API (`overpass-api.de`) for everything within **350 m** of the flagship coordinate **25.295, 55.355** (highways, landuse, buildings, amenities, shops, signals). **The query succeeded and returned 85 real elements.**

| Category | What came back |
|---|---|
| Highways | `service` ×38, `footway` ×7, `tertiary` ×4, `unclassified` ×3, `construction` ×2, `secondary_link` ×1 |
| Land use | `commercial` ×2, `industrial` ×1 |
| Amenities | `parking` ×3, `parking_space` ×2, `fuel` ×1, `bench` ×1 |
| Shops | `convenience` ×1 |
| Buildings | 21 — **all untyped (`building=yes`)** |
| Traffic-signal nodes | **0** |
| Named features | Al Mamzar Beach Street (شارع شاطئ الممزر, tertiary), Street 33 (شارع 33, unclassified), **ENOC** (fuel), **ZOOM** (convenience) |

**Verdict: ⚠️ PARTIALLY USABLE for Diagnose.**

- **Usable:** the API is live, free, and returns real network geometry (road hierarchy, a `secondary_link` ramp/merge, dense service roads) plus some traffic-generators (a fuel station + convenience store, parking) and coarse `commercial`/`industrial` land-use polygons. Enough to enrich a *human-reviewed* Diagnose narrative for a specific location with qualitative physical context.
- **Not usable for automated land-use attribution:** the buildings are **all untyped** (`building=yes`) — i.e. exactly the residential-vs-commercial-frontage signal the concept wants is *absent*; land-use polygons are sparse; there is **no signal node** (OSM can't even confirm JCT_MAMZ here); and the nearest named road is *Al Mamzar Beach Street* with **no trunk/primary tag for Al Ittihad Road within 350 m** — strongly implying the dataset's lat/long is **offset from the actual motorway carriageway**. Automated attribution would risk blaming the wrong roadway.
- **Net:** a helpful *supplement* for a handful of flagship locations with human-in-the-loop verification and a road-snap step — **not** a reliable, at-scale, automated cause-identifier.

---

## STEP 5 — `incidents_log.csv` contents

**Verdict: ✅ It has a CATEGORIZED cause field (not free text) — and quantified impact fields.** Detailed enough for structured incident reasoning; NOT a substitute for structural/land-use context.

- **`incident_type`** — 8 clean categories: Vehicle Breakdown 933 · Minor Accident 751 · Stalled Vehicle 236 · Debris on Road 169 · Major Accident 152 · Road Closure (Planned) 114 · Flooding 64 · Vehicle Fire 20.
- **`severity`** — Low 1,326 · Medium 857 · High 256.
- **Quantified impact / context:** `duration_min`, `lanes_blocked`, `total_lanes`, `response_time_min`, `datetime_reported` + `datetime_cleared`, `is_peak_hour`, `weather_condition`, `precip_mm`, plus `location_id` + `road_code` + lat/long + `direction`.
- **No free-text narrative column** — every descriptive field is categorical/structured (better for reasoning, not worse).
- **Joinable:** on `location_id` (0 orphans) and expandable to an hourly mask via reported→cleared. Flagship has a usable sample: **185 incidents at ITT_W1, 189 at ITT_E1** over 3 years.

**Caveat for Diagnose:** incidents explain **transient** congestion spikes well. They do **not** explain the flagship's *recurring/structural* bottleneck (only ~0.7% of ITT_W1 hours are incident-affected, yet 8.3% are LOS F). So incident attribution is one input, not the whole diagnosis.

---

## STEP 6 — What Simulate can realistically use

**Fields available in `locations_reference.csv` for a capacity-delay fallback (verified for ITT_W1):** `capacity_vph = 7000`, `free_flow_speed_kph = 80`, `speed_limit_kph = 80`, `num_lanes = 5`, `aadt_per_direction = 96000` — plus, per hour from `traffic_volume_hourly`: `demand_vph`, `volume_vph`, `vc_ratio`, `avg_speed_kph`, `travel_time_index`; and from `signal_timing_plans`/`signal_performance` for JCT_MAMZ: `cycle_length_s`, green splits, `degree_of_saturation`, `avg_delay_s_per_veh`, `throughput_vph`.

This is **sufficient** for an analytical fallback: a **BPR volume-delay function** `t = t₀·(1 + α·(v/c)^β)`, deterministic **queueing delay** when demand > capacity, and **Webster/HCM signal delay** from the cycle/green data.

**Independent recommendation: use the analytical capacity-delay fallback for v1; do NOT attempt real SUMO integration.** Reasoning (my own judgment, not deferring to any prior opinion):
1. **Calibration payoff is weak.** SUMO's value is microscopic realism, but the only ground truth here is **hourly aggregates** — you cannot calibrate car-following/gap-acceptance from hourly means, so a SUMO model would be precise-looking but uncalibrated.
2. **No validation anchor.** Step 2 shows no historical timing change, so neither SUMO nor the analytical model can be validated against a real before/after. That removes SUMO's main advantage.
3. **Build cost is disproportionate.** SUMO needs a coded network + demand routing + signal programs + detectors for even one junction, and Step 4 shows OSM geometry there is coarse/offset — so network-building is itself a project. Against everything else Kashf must ship (Triage→Diagnose→Rank→Learn), that is poor ROI.
4. **The fallback is transparent and adequate** for *relative* scenario comparison ("retime JCT_MAMZ" / "add a lane"), which is what Rank needs.

Keep SUMO as a possible **later, single-location showcase**, not a v1 dependency.

---

## STEP 7 — Per-stage feasibility verdicts

### Triage — ✅ GO
Detecting and ranking congested locations/hours is fully supported: `volume_vph`, `demand_vph`, `vc_ratio`, `level_of_service`, `travel_time_index`, `avg_speed_kph` across 18 locations × 26,304 clean hourly rows (0 gaps, 0 dupes — reconfirmed). Flagship demonstrates detectability (LOS F 8.3%, worsening). **No blocker.**

### Diagnose — ⚠️ GO WITH CAVEAT
- **Blocker:** no structured land-use/POI field (Step 1); the OSM fallback is only *partially usable* and shows possible coordinate offset (Step 4).
- **What works:** attribution to **signal saturation** (`degree_of_saturation`, `phase_failures`, Fixed-time control at JCT_MAMZ), **incidents** (categorized `incident_type` + severity + lanes blocked, Step 5), and **capacity/demand deficit** (`vc_ratio`, demand−volume gap). The flagship is a *strong* diagnosis case because a congested corridor and a Fixed-time signal are co-located.
- **Fallback plan:** scope Diagnose to data-supported cause classes (signal / incident / capacity-demand / weather-calendar), and treat land-use/physical causes as **OSM-assisted hypotheses requiring human confirmation**, only for flagship-tier locations.
- **Structural caveat:** the 18 traffic locations and 10 signal junctions are **disjoint ID sets** (only 5 areas overlap). The flagship's clean corridor↔signal pairing is *not* generally available — for most locations there is no co-located signal to implicate.

### Simulate — ⚠️ GO WITH CAVEAT
- **Path:** analytical capacity-delay (BPR + queueing + Webster), fully supported by verified fields (Step 6). **SUMO is not recommended for v1** (weak calibration payoff, no validation anchor, disproportionate build).
- **Caveat/blocker:** no historical intervention to calibrate or validate against (Step 2), and timing plans are a shared template — so simulated effects are **indicative/relative, not validated absolutes**. State this in any output.

### Rank — ✅ GO
All inputs to a benefit/priority score exist: severity metrics (LOS F rate, `vc_ratio`, demand−volume gap, TTI), exposure (`aadt_per_direction`, volumes, Salik crossings/revenue), incident burden, and Simulate's estimated delay reduction. Mechanism (score→sort→prioritize) is fully supported. **Note:** the *impact* dimension inherits Simulate's model uncertainty — rank on **relative** benefit and show the uncertainty.

### Learn — ⚠️ GO WITH CAVEAT (true closed-loop = ❌ NO-GO for v1)
- **Blocker:** there is **no record of past interventions and their outcomes** — no timing-plan change history (Step 2), no labeled experiments. Learning from Kashf's *own* recommendations is **not possible with existing data**; it requires prospective data collected after deployment.
- **What is feasible now:** (a) **backtest** predictive/diagnostic models across the 3-year history; (b) **adaptive-on vs adaptive-off** quasi-experiment at SCOOT junctions via the hourly `adaptive_active` flag (does *not* apply to the Fixed-time flagship); (c) learn from natural demand variation and incident recovery.
- **Fallback plan:** ship Learn as a **historical backtesting + quasi-experiment harness now**, and **design the intervention-outcome logging schema in v1** so real closed-loop learning can begin the moment recommendations are acted on.

---

## Risks / red flags (ranked)

1. **No land-use data anywhere in the files (Step 1)** and OSM only partially covers it with a likely **coordinate offset** (Step 4). Diagnose's "physical/land-use cause" is the weakest link — keep it human-in-the-loop.
2. **No historical intervention record (Step 2).** Kills both a signal before/after natural experiment *and* true closed-loop Learn. Design around it; don't assume it.
3. **Synthetic-data fingerprints:** timing plans are a shared template across junctions; `demand == volume` except in the congested tail. Simulations and "unmet demand" analyses are **relative/indicative**, not ground truth — label them as such.
4. **Corridor↔junction sets are disjoint (18 vs 10, 5 shared areas).** The flagship's clean pairing is the exception; a general Diagnose can't assume a co-located signal exists.

## What was verified vs assumed
- **Verified from the raw files:** every column list (Steps 1, 2, 5, 6); flagship IDs by name+coordinates (Step 3); all flagship numbers computed over 26,304 rows with an arithmetic cross-check (Step 3); the live Overpass response (Step 4); incident category counts (Step 5).
- **Assumed:** nothing carried over from prior claims — IDs, gap, and LOS% were recomputed independently and matched no placeholder.
