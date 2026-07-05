# Kashf — Second Flagship Screening (all 18 corridors × 10 junctions)

_Independent screen of every corridor and junction to find the best second full five-stage demo case, after Al Quoz (EKR_S1/JCT_QUOZ) was rejected as too mild. All numbers computed from the raw 2023–2025 files._

---

## Recommendation

### ✅ Use **SZR_N1 — Sheikh Zayed Rd @ 1st Interchange (Defence)** paired with **JCT_DEF (Defence Roundabout Signals)**, Trade Centre.

**Verdict: GO** as the second flagship. It's the strongest *diverse* case in the dataset — a different corridor and a different signal-control type from Al Mamzar, with a genuinely stressed co-located signal, tight co-location, and strong incident coverage.

| | Primary: Al Mamzar (ITT_W1/JCT_MAMZ) | **Rec: SZR Defence (SZR_N1/JCT_DEF)** | Rejected: Al Quoz (EKR_S1/JCT_QUOZ) |
|---|---|---|---|
| Corridor | Al Ittihad Rd (D89), 80 kph | **Sheikh Zayed Rd (E11), 105 kph** | Al Khail Rd (E44), 100 kph |
| LOS F % | 8.27% | **4.39%** | 1.21% |
| LOS E+F % | 12.35% | **6.53%** | 2.98% |
| Mean gap (vph) | 117.7 | **64.9** | 24.2 |
| Mean vc_ratio | 0.498 | **0.426** | 0.355 |
| Co-located signal | JCT_MAMZ | **JCT_DEF** | JCT_QUOZ |
| Signal control | Fixed-time | **SCOOT-adaptive** | Fixed-time |
| Signal phase failures (3 yr) | 315 (#1) | **130 (#3)** | 2 |
| Signal saturation rank | #1 / 10 | **#3 / 10** | #4 / 10 |
| Pair distance | 0.515 km | **0.258 km** | 0.697 km |
| Incidents (High) | 185 (19) | **151 (10)** | 135 (16) |

**Why this one:** its congestion is a real, sizeable bottleneck (4.4% LOS F, 3.6× Al Quoz), the neighbouring junction is genuinely stressed (130 phase failures — 65× Al Quoz's signal), they're tightly co-located (0.26 km, same area), and — crucially — it's a **different corridor with a SCOOT-adaptive signal**, so it demonstrates Kashf on a case that *isn't* a clone of the primary. Bonus: the opposite direction **SZR_S1** pairs to the same junction at **0.152 km** (the tightest pair in the whole dataset), so you can demo both directions of the Defence interchange.

> **The numerically-highest alternative is deliberately NOT recommended.** `ITT_E1` (Al Qiyadah, LOS F 7.76%, 189 incidents, JCT_DEIRA 173 failures at 0.52 km) scores higher on raw severity — but it is the **EB twin of the primary**: same Al Ittihad Road, same Dubai–Sharjah border crossing, opposite direction. As a "second" flagship it demonstrates nothing new. Pick it only if you specifically want to double down on the border-crossing theme rather than show breadth.

---

## Evidence

### All 18 corridors, by congestion severity (LOS F %)

| Loc | Area | Road | Dir | **LOS F%** | LOS E+F% | Mean gap | Mean vc | Incidents (High) | Nearest stressed signal? |
|---|---|---|---|---|---|---|---|---|---|
| **ITT_W1** | Al Mamzar | D89 | WB | **8.27** | 12.35 | 117.7 | 0.498 | 185 (19) | ✅ JCT_MAMZ (primary) |
| ITT_E1 | Al Qiyadah | D89 | EB | 7.76 | 11.43 | 101.6 | 0.469 | 189 (17) | ✅ JCT_DEIRA — but twin of primary |
| AIR_W1 | Al Garhoud | D89 | WB | 5.20 | 7.56 | 45.4 | 0.444 | 149 (15) | ❌ JCT_GARH 0 failures @ 0.99 km |
| **SZR_N1** | **Trade Centre** | **E11** | **NB** | **4.39** | 6.53 | 64.9 | 0.426 | 151 (10) | ✅ **JCT_DEF 130 failures @ 0.26 km** |
| SZR_N2 | DIFC | E11 | NB | 3.88 | 5.81 | 53.7 | 0.415 | 145 (11) | △ JCT_DEF but 1.50 km away |
| SZR_S1 | Trade Centre | E11 | SB | 3.80 | 6.32 | 67.5 | 0.408 | 142 (15) | ✅ JCT_DEF 130 failures @ 0.15 km |
| SZR_S2 | DIFC | E11 | SB | 3.46 | 6.00 | 60.2 | 0.402 | 136 (11) | △ JCT_DEF but 1.48 km away |
| SZR_N4 | Al Barsha | E11 | NB | 2.86 | 4.75 | 31.7 | 0.393 | 148 (13) | ❌ JCT_BARSHA 0 failures |
| SZR_S4 | Al Barsha | E11 | SB | 2.63 | 4.83 | 50.8 | 0.386 | 143 (13) | ❌ JCT_BARSHA 0 failures |
| GAR_N1 | Garhoud | D75 | NB | 2.19 | 5.41 | 24.3 | 0.437 | 165 (15) | ❌ nearest 1.82 km |
| EKR_N1 | Business Bay | E44 | NB | 1.77 | 3.50 | 11.1 | 0.367 | 109 (12) | ❌ nearest 1.83 km |
| MAK_N1 | Bur Dubai | D75 | NB | 1.60 | 4.16 | 18.1 | 0.423 | 137 (17) | ❌ JCT_OUD 0 failures |
| JBR_X1 | Jumeirah | D94 | Both | 1.51 | 2.91 | 7.8 | 0.353 | 110 (16) | ❌ nearest 1.39 km |
| EKR_S1 | Al Quoz | E44 | SB | 1.21 | 2.98 | 24.2 | 0.355 | 135 (16) | ❌ JCT_QUOZ 2 failures (rejected) |
| BBC_S1 | Business Bay | E11 | SB | 0.94 | 2.66 | 19.2 | 0.402 | 138 (18) | ❌ nearest 3.55 km |
| EMR_E1 | Al Awir | E611 | Both | 0.00 | 0.00 | 0.9 | 0.248 | 69 (9) | ❌ 12.3 km away |
| DWC_X1 | Dubai South | E77 | Both | 0.00 | 0.00 | 0.9 | 0.180 | 96 (15) | ❌ 24.3 km away |
| MBZ_E1 | DIP | E311 | Both | 0.00 | 0.03 | 1.8 | 0.282 | 92 (14) | ❌ 13.9 km away |

### All 10 junctions, by signal stress — only 3 are stressed at all

| Junction | Area | Control | Mean sat | Peak sat | % hrs >0.9 | Phase failures (3 yr) |
|---|---|---|---|---|---|---|
| JCT_MAMZ | Al Mamzar | Fixed-time | 0.343 | 0.543 | 1.59% | **315** |
| JCT_DEIRA | Deira | Fixed-time | 0.330 | 0.524 | 1.11% | **173** |
| **JCT_DEF** | **Trade Centre** | **SCOOT-adaptive** | **0.330** | **0.524** | **1.11%** | **130** |
| JCT_QUOZ | Al Quoz | Fixed-time | 0.294 | 0.465 | 0.20% | 2 |
| JCT_GARH / KARAMA / SAFA / BARSHA / WASL / OUD | — | mostly SCOOT | ≤0.29 | ≤0.45 | ≤0.08% | 0 |

**Structural reality:** signal dysfunction exists at only **3 of 10** junctions (JCT_MAMZ, JCT_DEIRA, JCT_DEF). A second flagship with a *stressed co-located signal* must attach to one of those three. JCT_MAMZ is the primary; JCT_DEIRA belongs to the primary's twin corridor; that leaves **JCT_DEF** as the one distinct stressed junction — and it happens to sit 0.26 km from a genuinely congested SZR corridor. That convergence is what makes SZR_N1/JCT_DEF the answer.

---

## Why the other severe corridors don't work as the second flagship

- **ITT_E1 (Al Qiyadah, 7.76%)** — strongest by numbers, but the EB twin of the primary (same road/border). No demonstrative diversity.
- **AIR_W1 (Al Garhoud, 5.20%)** — genuinely congested (3rd worst corridor), but its nearest junction JCT_GARH has **0 phase failures** and sits ~1 km away. Severe corridor, *no stressed signal to diagnose* — the "fix the signal" story is absent. Viable only as a **capacity/incident-driven** case, not a signal case.
- **SZR_N2 / SZR_S2 (DIFC, ~3.5–3.9%)** — congested, but ~1.5 km from JCT_DEF; the signal isn't a plausible local cause.
- **SZR_N4 / SZR_S4 (Al Barsha, ~2.7%)** — co-located with JCT_BARSHA (same area) but that junction has **0 phase failures** — same "healthy signal" problem as Al Quoz.
- Everything ≤2.2% LOS F is too mild (and mostly has no nearby signal at all — the 3 zero-congestion outliers are 12–24 km from any junction).

## Note on interpretation
SZR_N1 is a grade-separated expressway and JCT_DEF is the surface Defence junction — the same expressway-vs-surface nuance flagged for Al Quoz. The difference is that **here both the corridor and the signal are genuinely stressed** (4.4% LOS F; 130 phase failures on an *adaptive* signal), so there is real substance to diagnose on both — whereas Al Quoz had neither. That an adaptive (SCOOT) junction is still logging 130 phase failures is itself a strong Diagnose hook: "the adaptive control isn't fully coping under this demand."

## Verified vs assumed
- **Verified from raw files:** LOS/gap/vc for all 18 locations over 26,304 hours each; saturation/delay/phase-failures for all 10 junctions; haversine distance for every location→nearest-junction pair; incident counts per location.
- **Judgment applied:** the recommendation overrides raw score to reject ITT_E1 (primary's twin) in favour of a corridor that shows breadth — stated explicitly so you can override if you prefer maximum severity over diversity.
