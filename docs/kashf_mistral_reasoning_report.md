# Kashf — Mistral Reasoning Task Report

_Filling the 73 PLACEHOLDER fields in `contract/`: settled numbers, storm corridor, analytical Simulate, deterministic confidence, and grounded Mistral text. Date: 2026-07-05._

---

## HEADLINE — final status

**73 placeholders → 0. All five files are `status: "verified"`.** No file was force-flipped;
each flipped only when its last placeholder was genuinely filled.

| File | status | placeholders |
|---|---|---|
| case_1_al_mamzar | **verified** | none |
| case_2_szr_defence | **verified** | none |
| case_3_storm | **verified** | none |
| case_4_citywide_triage | **verified** | none |
| case_5_garhoud_no_signal | **verified** | none |

The Mistral API key was supplied mid-task (`contract/.env`); all 13 text fields were generated
with `mistral-large-latest`, temperature 0.2, JSON mode, 3 runs per case. The three pending
`route_anchors` (SZR southbound, MAK_N1, AIR_W1) were then supplied from the Mapbox
display-anchor check and written in, clearing the last placeholders.

**Verified Mapbox anchors written in** (format `[lng, lat]`):
- case_2 secondary (SZR_S1 southbound): `[[55.283953, 25.224351], [55.272668, 25.207789]]`
- case_3 (MAK_N1): `[[55.320805, 25.251252], [55.326906, 25.259271]]`
- case_5 (AIR_W1): `[[55.344955, 25.251739], [55.334415, 25.257095]]`
(case_1 ITT_W1 and case_2-main SZR_N1 anchors were already in-file and matched the check.)

---

## STEP 1 — Settled numbers written in

- `case_3`: response-time evidence now *"Storm-window response time 24.6 min vs 9.7 min 3-year
  baseline (2.5x); 61 of 96 incidents on the first day."*
- `case_1`: evidence gains *"Corridor-junction pair distance 0.515 km."*

---

## STEP 2 — Case 3 storm corridor: **MAK_N1 (Al Maktoum Bridge)**

Method: mean corridor speed on 16 Apr 2024 vs each corridor's 2024 non-storm baseline. Storm
window confirmed in `weather_hourly_2024`: **200 mm rain** (peak 28.5 mm/h), thunderstorm,
visibility 1 km.

| Corridor (task candidate set) | ff | baseline mean spd | storm mean spd | **drop** | storm min |
|---|---|---|---|---|---|
| **MAK_N1** | 60 | 55.3 | 27.8 | **−49.7%** | 8.1 |
| ITT_W1 | 80 | 70.6 | 36.6 | −48.1% | 9.8 |
| GAR_N1 | 80 | 73.3 | 49.9 | −31.9% | 15.3 |
| SZR_N1 | 105 | 96.5 | 78.3 | −18.9% | 52.5 |

**Why MAK_N1:** biggest speed collapse in the candidate set; storm-day **mean vc just 0.379**
(clean weather-not-demand signature); a flood-prone bridge; diverse from the Case 1 flagship.
**Transparency (in the file `_comment`):** across all 18 corridors MAK_N1's drop ranks 4th
(three non-candidate leisure/outlier roads dropped more off a low base), so `triage.rank` = **4**,
not a misleading "1". Storm-day triage (16 Apr, 24 h): `los_f 4.17 · gap 357.0 · vc 0.379 · red`.
`route_anchors` flagged for a Mapbox check (MAK_N1 has no verified anchors → stays partial).

---

## STEP 3 — Simulate (analytical, HCM/Webster + BPR — never Mistral)

| Case | Candidate | before vc / delay | after vc / delay | Δdelay | cost | disr |
|---|---|---|---|---|---|---|
| **1** | Retime JCT_MAMZ (green reallocation) ⭐ | 0.763 / 36.4 s | 0.626 / 29.1 s | −20% | 1 | 1 |
| **1** | Upgrade to adaptive (SCOOT) | 0.763 / 36.4 s | 0.521 / 22.8 s | −37% | 3 | 2 |
| **2** | Demand management, −10% peak ⭐ | 0.736 / 34.5 s | 0.662 / 33.1 s | −4% | 2 | 1 |
| **2** | Capacity +20% approach | 0.736 / 34.5 s | 0.613 / 32.1 s | −7% | 4 | 4 |
| **5** | Capacity +25% (add lane) ⭐ | 0.833 / 3.25 s·km⁻¹ | 0.666 / 1.33 s·km⁻¹ | −59% | 4 | 4 |
| **5** | Incident response | *not estimable* | *not estimable* | — | 2 | 2 |

⭐ = `rank.top_fix`. Before-states grounded in observed top-decile-saturation hours (junctions)
or observed p90 v/c (corridor). Honest results baked into JSON `_comment`s: Case 2 is
demand/capacity **not** retiming (diagnosis = demand exceeds adaptive), and average delay barely
moves while saturation drops more; Case 5's incident-response candidate is left **unestimated**
(`_not_estimable`) rather than invented, because BPR can't model incident clearance.
Cases 3 & 4 have no fix candidates (`candidates: []` / triage-only). 1–5 cost/disruption rubric
and the flow_animation (observed LOS-band speeds) are documented in each file.

---

## STEP 5 — Confidence (deterministic, documented in each `_confidence_basis`)

```
confidence_pct = clamp( 40 + 15 × n_supporting_signals − 10 × indirect_link , 0 , 95 )
```

| Case | diagnosis | n | indirect | confidence |
|---|---|---|---|---|
| 1 | SIGNAL_ISSUE | 4 | 0 | **95** |
| 2 | DEMAND_EXCEEDS_ADAPTIVE | 3 | 1 | **75** |
| 5 | NO_SIGNAL_ATTRIBUTABLE | 3 | 1 | **75** |

Case 3 keeps its verified **55** (human_review_required = true).

---

## STEP 4 — Mistral text: generated, QA-checked, corrected

`contract/generate_mistral_text.py` (mistral-large-latest, temp 0.2, JSON mode, 3 runs/case,
429-backoff, skips filled cases, touches **no number**). Hard rules in the system prompt: cite
only input numbers; never invent a number/location/cause/fix; don't re-diagnose; call simulate
numbers indicative; flag uncertainty; plain sentences.

**QA catch (why a second pass was run):** the first generation passed the stability gate but
contained two factual errors on review — cases 1 & 2 described `los_f_pct` as "% at free-flow"
(it is % at LOS **F / gridlock** — inverted), and case 4 miscounted the table ("9 amber… 5 zero"
vs the true 10 amber / 3 zero). Root cause: the case JSONs carry numbers but no field
*definitions*. Fix: added a **GLOSSARY** to the system prompt (defining `los_f_pct` etc.) and fed
case 4 **pre-computed counts** so the model never counts rows itself. Regenerated; all five now
correct.

**Three sample outputs (one per text type, post-correction):**

- **narrative (case_1):** "Al Ittihad Road at Al Mamzar (Dubai–Sharjah border) is the RTA's
  worst-performing corridor-junction pair, with 8.27% of hours at gridlock (LOS F) and an unmet
  demand of 117.7 vehicles per hour. The mean volume-to-capacity ratio of 0.498 masks severe
  peak-hour oversaturation, as the junction logs 315 phase failures in three years—the highest
  of any signal in the network."
- **summary (case_2):** "This junction on Sheikh Zayed Road is experiencing demand that exceeds
  the capacity of its SCOOT-adaptive signal control, leading to frequent phase failures and
  severe congestion. The tight co-location of the corridor and junction (0.258 km) amplifies the
  impact, with evidence of 130 phase failures over the past three years supporting this diagnosis."
- **recommendation (case_5):** "The top recommended fix is to add a running lane on AIR_W1 to
  improve corridor capacity, which is analytically estimated to reduce the degree of saturation
  from 0.833 to 0.666 and cut extra travel delay from 3.25 to 1.33 seconds per km. This is a
  high-cost, high-disruption option (cost score 4, disruption score 4)… incident-driven delays
  remain unestimated and may require separate operational improvements… not captured in this
  analytical model."

Case 4 narrative (verifying the count fix): "…shows 4 at red severity, 10 at amber, and 4 at
green… Three corridors—DWC_X1, EMR_E1, and MBZ_E1—experienced no gridlock hours at all, with
los_f_pct exactly 0.00." ✓ All diagnosis types were preserved across runs.

---

## STEP 6 — Final validator output

```
RESULT: ALL FILES CONFORM | 0 placeholder field(s) across 5 files
  case_1_al_mamzar         SCHEMA OK  status=verified   placeholders: none
  case_2_szr_defence       SCHEMA OK  status=verified   placeholders: none
  case_3_storm             SCHEMA OK  status=verified   placeholders: none
  case_4_citywide_triage   SCHEMA OK  status=verified   placeholders: none
  case_5_garhoud_no_signal SCHEMA OK  status=verified   placeholders: none
```

---

## Complete

All 73 placeholders are filled: settled numbers, the MAK_N1 storm corridor, analytical Simulate
outputs, deterministic confidence, grounded (QA-corrected) Mistral text, and the five verified
Mapbox route-anchor pairs. Every case file is `status: "verified"` and the contract is ready for
the frontend to render real content only.
