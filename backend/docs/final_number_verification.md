# Final Number Verification — two demo-contract figures settled

_Computed directly from the raw files in `CUD_RTA_Traffic_Dataset/datasets`. Both values feed the demo contract, so each is shown with its full calculation. Date: 2026-07-05._

---

## TASK 1 — April 2024 storm incident response time

**Source:** `incidents_log.csv` (2,439 incident rows total, 2023–2025), filtered on
`datetime_reported` within **16–17 April 2024** (`>= 2024-04-16 00:00` and `< 2024-04-18 00:00`).

| Metric | Value |
|---|---|
| Total incidents in the storm window (16–17 Apr) | **96** |
| Count on the worst single day | **61** (16 Apr 2024) — vs 35 on 17 Apr |
| **Mean `response_time_min`, storm window** | **24.6 min** (exact 24.6354) |
| Mean `response_time_min`, all 3 years (comparison) | **9.7 min** (exact 9.6503) |

**Calculation (storm window):**
```
Σ response_time_min = 2365
n                    = 96
mean = 2365 / 96     = 24.6354  →  24.6 min
```

**Discrepancy verdict:** the correct figure is **24.6 min**.
- **24.6 min — MATCHES** the computed value exactly.
- **25.7 min — does NOT match.** It is not reproducible from a 16–17 April filter on
  `response_time_min` and should be discarded. (Most likely it came from a slightly different
  window or an incident subset; either way it is wrong for the stated definition.)

**Context worth noting for the demo:** storm-window response time (24.6 min) is **~2.5× the
all-years baseline** (9.7 min), and incidents cluster hard on the first storm day (61 of 96).
That contrast is the story — the number itself is 24.6.

---

## TASK 2 — Al Mamzar corridor–junction pair distance

**Coordinates used (straight from the reference files):**

| Entity | Source file | latitude | longitude |
|---|---|---|---|
| **ITT_W1** (Al Ittihad Rd @ Al Mamzar) | `locations_reference.csv` | 25.295 | 55.355 |
| **JCT_MAMZ** (Al Mamzar Junction) | `signal_junctions_reference.csv` | 25.294 | 55.350 |

**Haversine calculation** (R = 6371.0088 km):
```
dlat  = 25.294 − 25.295 = −0.001°
dlong = 55.350 − 55.355 = −0.005°
a = sin²(dlat/2) + cos(25.295°)·cos(25.294°)·sin²(dlong/2)
d = 2R·asin(√a) = 0.5148 km  ≈ 515 m
```

**Discrepancy verdict:** the correct value is **0.515 km** (514.8 m).
- **0.515 km — CORRECT.** Reproduced exactly from the two reference files.
- **~0.1 km — WRONG.** Not a coordinate-source or wrong-junction error — it is a
  **latitude-only mistake.** The two points share nearly identical latitude (25.295 vs 25.294,
  Δ = 0.001° ≈ 0.111 km), so anyone eyeballing or computing only the latitude gap lands on
  "~0.1 km." But the real separation is dominated by the **longitude** gap (Δ = 0.005° ≈ 0.503 km
  at this latitude), which the 0.1 km estimate ignored.

**Component check (why 0.1 km is a trap):**
```
latitude gap only : 0.001° × 111.19            = 0.111 km   ← the bogus "~0.1 km"
longitude gap only: 0.005° × 111.32 × cos(25.29°) = 0.503 km   ← the part that was dropped
full haversine    :                               = 0.515 km   ← correct
```

**Ruled out as sources of the error:**
- Wrong junction: ITT_W1 → **JCT_DEIRA** = 3.40 km (not ~0.1 km either), so a junction mix-up
  did not produce the 0.1 km.
- Lat/long swap: swapping both gives 0.560 km, not 0.1 km.

So the 0.1 km was an **un-computed eyeball / latitude-only estimate**, not a different data source.

---

## Bottom line for the demo contract

| Figure | Use this value | Rejected |
|---|---|---|
| April 2024 storm mean response time | **24.6 min** | 25.7 min |
| ITT_W1 ↔ JCT_MAMZ pair distance | **0.515 km** | ~0.1 km |
