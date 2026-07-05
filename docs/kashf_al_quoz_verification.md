# Kashf — Second Flagship Verification: Al Quoz (EKR_S1 / JCT_QUOZ)

_Independent re-derivation from the raw files. Methodology re-checked, not assumed to carry over from the Al Mamzar pass. Verification only — no build code._

---

## Bottom line

**Verdict: ❌ NOT STRONG ENOUGH as a co-equal second five-stage flagship.** Usable only in a reduced role as a low-severity **"coping corridor" contrast case** (that reduced role = ⚠️ GO WITH CAVEAT).

Al Quoz is a **real, verified co-located pair** in the same area, and JCT_QUOZ is genuinely the only junction with a non-template timing plan — but on the two dimensions that make a flagship demo compelling it is far weaker than Al Mamzar:
- **Congestion is ~7× milder** — LOS F **1.21%** vs 8.27%; the corridor is free-flowing 79% of the time (LOS A+B) at a mean **94.4 kph** on a 100 kph road.
- **The signal is not a bottleneck** — JCT_QUOZ ranks **#4 of 10** on saturation and logged just **2 phase failures in 3 years** (vs JCT_MAMZ's 315). There is almost nothing dysfunctional to diagnose or retime.

A flagship needs a severe, diagnosable bottleneck with an actionable cause. Al Quoz has a healthy corridor and a healthy signal, so the Diagnose→Simulate→Rank story has little substance here.

> ### ⚠️ Correction to the prior report
> This pass computed the **ITT_W1 → JCT_MAMZ** distance by haversine at **0.515 km**. The earlier `kashf_feasibility_report.md` stated "~0.1 km apart" — that was an un-computed eyeball estimate and is **wrong**; the true separation is ~0.5 km. It doesn't change the Al Mamzar verdict (still same-area, sub-km, strong), but the benchmark you referenced should be **0.5 km, not 0.1 km**. The Al Quoz pair (0.70 km) is looser than that corrected benchmark, not looser than 0.1 km.

---

## STEP 1 — Is the pairing real? ✅ Yes, but looser than the primary

| | EKR_S1 | JCT_QUOZ |
|---|---|---|
| Name | Al Khail Rd @ Al Quoz | Al Quoz Junction |
| Area | **Al Quoz** | **Al Quoz** ✅ match |
| Lat / Lon | 25.149 / 55.235 | 25.143 / 55.233 |
| Other | E44, SB (to Jebel Ali), 5 lanes, cap 10,000 vph, 100 kph | 3 approaches, peak 900 vph, **Fixed-time** |

- **Haversine distance = 0.697 km** (computed, not assumed).
- **Reference (corrected): ITT_W1 → JCT_MAMZ = 0.515 km.**
- Same area label, sub-kilometre → the pairing is **genuine, not just similarly named**. But at 0.70 km it is ~35% farther apart than the (corrected) primary, and note EKR_S1 is a **100 kph grade-separated expressway** segment (Al Khail Rd) while JCT_QUOZ is a surface junction — so the signal does not necessarily govern the EKR_S1 mainline flow. Weaker mechanistic link than the flagship.

## STEP 2 — EKR_S1 Triage numbers (full 2023–2025, 26,304 hours)

**Method:** `mean_gap = mean(demand) − mean(volume)`, cross-checked as `(Σdemand − Σvolume)/N`; `%LOS F = count(LOS=='F')/N`.

| Metric | EKR_S1 (Al Quoz) | ITT_W1 (Al Mamzar) — ref |
|---|---|---|
| Mean `demand_vph` | 3,566.9 | 3,603.2 |
| Mean `volume_vph` | 3,542.8 | 3,485.5 |
| **Mean gap (demand − volume)** | **24.2 vph** _(cross-check 24.2 ✓)_ | 117.7 vph |
| **% hours at LOS F** | **1.21%** (317 / 26,304) | 8.27% |
| Mean / max `vc_ratio` | **0.355 / 1.05** | 0.498 / 1.05 |
| Mean `travel_time_index` | 1.074 | 1.172 |
| Mean `avg_speed_kph` | 94.4 (of 100 free-flow) | 70.6 |
| LOS distribution | A 47.5% · B 31.9% · C 13.3% · D 4.4% · E 1.8% · **F 1.2%** | A 36% … **F 8.3%** |

**Trend (real, worsening — but from a low base):** mean gap 17.0 → 26.4 → 29.2 vph; LOS F 0.67% → 1.08% → 1.86% (2023→24→25). Like Al Mamzar, the gap is peak-concentrated (positive in only **1.5%** of hours, avg 1,609 vph when positive, max 8,212) — but the chronic burden is small: this corridor is uncongested the vast majority of the time.

**Read:** EKR_S1 is a **mostly free-flowing expressway segment**, not a chronic bottleneck. A 1.2% LOS F rate is a minor, occasional-peak problem — an order of magnitude below the flagship.

## STEP 3 — Is JCT_QUOZ's timing plan genuinely distinct? ✅ Confirmed (and stronger than reported)

Compared AM-Peak green-time vectors across all 10 junctions:
- **JCT_QUOZ = [52, 42, 30]** — 3 phases (NS Through / EW Through / EW Left), matching its 3 approaches, with engineered splits.
- **Every other junction = [41, 19, 41, 19]** — 4 phases, and **all 9 are byte-identical to each other** (`all_others_identical = True`). JCT_DEF, JCT_MAMZ, JCT_WASL … share one template.
- **JCT_QUOZ is distinct from all others: True.**

So the earlier observation was correct and, if anything, understated: JCT_QUOZ is the **sole** junction with a non-boilerplate plan. This is Al Quoz's one genuine asset — it's the best junction for a *signal-retiming methodology* demo because there are real, junction-specific splits to perturb rather than template values.

## STEP 4 — JCT_QUOZ control type & performance: middle-of-the-pack, NOT an underperformer

`control_type = **Fixed-time**` (confirmed in both reference and timing-plans files). Signal performance over 26,304 hours, ranked against all 10 junctions by mean degree-of-saturation:

| Rank | Junction | Control | Mean sat | Peak-hr sat | % hrs sat>0.9 | Mean delay (s) | Phase failures (3 yr) |
|---|---|---|---|---|---|---|---|
| #1 | **JCT_MAMZ** (primary) | Fixed-time | 0.343 | 0.543 | 1.59% | 19.27 | **315** |
| #2 | JCT_DEF | SCOOT | 0.330 | 0.524 | 1.11% | 18.95 | 130 |
| #3 | JCT_DEIRA | Fixed-time | 0.330 | 0.524 | 1.11% | 18.97 | 173 |
| **#4** | **JCT_QUOZ** | **Fixed-time** | **0.294** | **0.465** | **0.20%** | **18.12** | **2** |
| #5–#10 | GARH, KARAMA, SAFA, BARSHA, WASL, OUD | mixed | 0.29→0.24 | … | ≤0.08% | ≤18.0 | 0 |

- JCT_QUOZ is **#4 of 10** — comfortably mid-pack. Its peak saturation (0.465) and delay (18.1 s) are unremarkable, and it is oversaturated in only **0.2%** of hours.
- **Just 2 phase failures across 3 years** (vs the flagship's 315) — the signal is essentially **never in distress**.
- **Implication:** as a "the signal is broken, let's fix it" case, JCT_QUOZ is **weak** — there's negligible dysfunction to diagnose and little headroom for a retiming to show benefit. The distinct timing plan is nice for methodology, but the signal isn't the problem.

## STEP 5 — Incident coverage at EKR_S1: adequate

**135 incidents** over 2023–2025 (vs ITT_W1's 185 — ~27% fewer, but still a workable sample).
- **By type:** Vehicle Breakdown 59 · Minor Accident 29 · Stalled Vehicle 18 · Major Accident 13 · Road Closure (Planned) 8 · Debris on Road 7 · Flooding 1.
- **By severity:** Low 83 · Medium 36 · **High 16**.

Enough categorized incident data to support a Diagnose case — this dimension is **not** the weak link.

---

## STEP 6 — Direct verdict: Al Mamzar vs Al Quoz

| Dimension (what a flagship needs) | Al Mamzar (ITT_W1/JCT_MAMZ) | Al Quoz (EKR_S1/JCT_QUOZ) | Winner |
|---|---|---|---|
| Co-location distance | 0.515 km | 0.697 km | Mamzar (tighter) |
| Corridor congestion (LOS F) | **8.27%** | 1.21% | **Mamzar (7×)** |
| Demand−volume gap | **117.7 vph** | 24.2 vph | **Mamzar (5×)** |
| vc_ratio (mean) | 0.498 | 0.355 | Mamzar |
| Signal dysfunction (phase failures) | **315** | 2 | **Mamzar** |
| Signal saturation rank | #1 / 10 | #4 / 10 | Mamzar |
| Mechanistic link (signal↔corridor) | surface artery ↔ junction | 100 kph expressway ↔ surface junction | Mamzar (cleaner) |
| Incident sample | 185 | 135 | Mamzar (both adequate) |
| Distinct/engineered timing plan | ❌ template | ✅ only genuine one | **Al Quoz** |
| Worsening trend | yes | yes (low base) | tie |

**Conclusion — NOT STRONG ENOUGH to be a co-equal second five-stage demo case.** Al Quoz loses on the dimensions that carry a Diagnose→Simulate→Rank narrative: the corridor is mostly free-flowing (mean 94.4 kph, LOS F 1.2%) and the co-located signal is a healthy mid-pack performer with essentially zero phase failures. Both the "severe bottleneck" and the "broken signal to retime" hooks are largely absent, and the expressway↔surface-junction pairing is a weaker causal link than the flagship's.

**Where it IS usable (GO WITH CAVEAT, reduced role):**
1. A **contrast / control case** — "here is a comparable-volume corridor (demand ≈3,570 vph, nearly identical to the flagship's ≈3,600) that is *coping*," which sharpens why Al Mamzar is failing. Same demand, very different outcome — a genuinely useful narrative device.
2. A **signal-retiming methodology showcase** — JCT_QUOZ's unique non-template 3-phase plan is the best available junction to demonstrate the Simulate retiming mechanics, even if the benefit ceiling is low.
3. An **early-warning example** — the worsening trend (LOS F 0.67%→1.86%) lets Triage demonstrate catching a corridor *before* it becomes a crisis.

**Recommendation:** keep Al Mamzar as the sole full five-stage flagship. If a second location is wanted, either (a) use Al Quoz explicitly as the low-severity contrast case above, or (b) screen the other 16 locations for a better-matched severe corridor with a co-located, genuinely stressed signal before committing. The disjoint 18-corridor / 10-junction geography (only 5 shared areas) means clean co-located pairs are scarce — Al Mamzar may simply be the best one available.

### Verified vs assumed
- **Verified from raw files:** both coordinate pairs + haversine distances; all EKR_S1 traffic metrics over 26,304 rows with arithmetic cross-check; timing-plan green vectors for all 10 junctions; signal performance ranking across all 10 junctions; incident counts by type/severity.
- **Assumed:** nothing carried over from the Al Mamzar pass — and doing so surfaced a distance error in the prior report (corrected above).
