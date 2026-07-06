# Salik Sense — Problem, Solution, Build Phases

*RTA x CUD 4IR Mobility Student Challenge*

---

## 1. The Problem

Dubai's RTA has already built world-class infrastructure for **sensing** and **predicting**:

- **EC3** (Enterprise Command and Control Centre) — a ~USD 90M facility unifying 35+ live data sources
- **UTC-UX Fusion** — adaptive signal control, Phase 1 live (16–37% flow improvement)
- **Transport Data Analysis Laboratory** (launched Dec 2025, inside EC3) — produces "predictive indicators that support decision-making"
- **Salik dynamic pricing** — live variable tolling
- **S'hail app** — multimodal journey planning

What RTA's public materials do **not** describe is a layer that takes all of this and **decides**. Their own language is explicit: these systems produce indicators that *support* decision-making — the operator still manually cross-references separate dashboards, diagnoses the cause, and picks an action, under time pressure, in their own head.

**The gap:** no single system fuses live conditions, forecasts them forward, diagnoses the *type* of problem (signal vs. weather vs. incident), and hands the operator one explained, approvable recommendation.

---

## 2. The Solution — Salik Sense

A two-model reasoning copilot that sits on top of RTA's existing systems, not a replacement for any of them.

> **"EC3 has the data. We give your operators the language to act on it."**

### Model A — Prediction (the forecaster)

- **What:** a single, unified Random Forest model trained across all corridors and junctions, with `location_id` and road/junction attributes as input features — not a separate model per location.
- **Why unified, not split:** tree-based models learn location-specific behavior from the location features themselves. Splitting into per-corridor models fragments the training data across 18+ locations, increasing the risk of overfitting on thinner-data corridors — a real risk given the professor's blind 20% test. One model trained on everything is more robust and is one thing to validate and defend, not eighteen.
- **What it does:** forecasts key metrics (e.g. speed, saturation) ~30 minutes ahead, using weather, calendar, and historical patterns as inputs.
- **Output:** a number — the prediction — nothing else. Model A does no reasoning, no explanation.

### Model B — Reasoning (Mistral, the copilot)

- **What:** a single Mistral agent — not multiple specialized agents — using one well-built system prompt.
- **Why one agent, not several:** splitting diagnosis across multiple LLM calls (a "weather agent," a "signal agent," etc.) adds latency, cost, and more places for outputs to drift inconsistent, without a proven accuracy benefit at this scale. One call reasoning over a complete, structured bundle is simpler to keep consistent and easier to defend.
- **Input:** a fused JSON "bundle" — Model A's forecast + live/replay traffic, signal, weather, incident, Salik, metro, and calendar data.
- **What it does:** diagnoses the most-stressed point, classifies the diagnosis type (SIGNAL / ROUTING / WEATHER / DEMAND / RECURRING_PEAK), and recommends the lever — the diagnosis type dictates the lever, not a hardcoded threshold.
- **Output:** one structured Action Card (situation, why, recommended action, confidence).

### Human-in-the-loop (non-negotiable)

The operator console shows the Action Card and requires Approve / Modify / Reject. Nothing dispatches to signals, patrol, Metro, or VMS without a logged human decision. Every decision is written to an immutable audit log (recommendation + decision + operator ID + timestamp).

### What was deliberately cut

The what-if simulator (testing hypothetical scenarios like shifted work hours) is **out of scope** for this build. It was a strong idea, but the team is prioritizing one thing done well — a validated, defensible prediction model — over a broader feature set, especially given the professor's accuracy test.

### The validation plan

The professor will provide 80% of the dataset for training and hold back 20% as ground truth. Model A will be **frozen** before that 20% is seen, run once against it with no retraining or peeking, and the resulting accuracy (MAE/MAPE) becomes the headline, independently-verifiable proof point for the pitch — stronger than any self-reported number.

---

## 3. Build Phases

### Phase 0 — Lock the decisions
- Model A: one unified model, location as a feature
- Model B: one Mistral agent, one system prompt with diagnosis classification built in
- Simulator: officially out of scope
- Rule: the professor's 20% is never touched until final evaluation

### Phase 1 — Data prep + internal holdout
- Load and clean the 80% training data
- Build features: location attributes, hour, day-of-week, weather, calendar flags (holiday/Ramadan/DSF/school), incident presence
- Normalize the `area` free-text field (known inconsistency: "Al Garhoud" vs "Garhoud")
- Split the 80% into your **own** internal train/test so you get an honest accuracy read before the professor's real test

### Phase 2 — Train Model A
- Train the unified Random Forest on the internal training split
- Validate against the internal holdout; record a real, current MAE/MAPE
- Freeze the trained model file once stable — no further tuning without re-validating

### Phase 3 — Bundle Builder + Detector
- Fuse live/replay data + Model A's forecast + weather/incidents/signals/Salik/metro/calendar into one JSON bundle
- Build the "worth flagging" rule using a **conditional baseline** (per corridor × hour × day-of-week) compared against the *predicted* value — never a flat threshold across the whole network

### Phase 4 — Model B (Mistral reasoning)
- Write and test the system prompt: bundle in → diagnosis_type + severity + confidence + Action Card JSON out
- Low temperature, strict JSON output
- Test each diagnosis type repeatedly (10+ runs) for consistency before moving on

### Phase 5 — Operator console
- Build the UI: diagnosis, plain-language why, recommended action, confidence
- Wire Approve / Modify / Reject to Model B's output

### Phase 6 — Dispatch + Audit
- Route approved actions to the correct desk (signals / patrol / Metro / VMS)
- Log every recommendation + decision + operator ID + timestamp, immutably

### Phase 7 — The real test
- Run the frozen Model A against the professor's 20% exactly as-is
- Report the resulting MAE/MAPE as the headline accuracy claim — independently verified, not self-reported

### Phase 8 — Polish and rehearse
- No new features from this point on
- Fix visual polish, timing, consistency of Mistral outputs, and full dress rehearsals only

---

*One page, one plan. Every number in the pitch should trace back to a phase above.*
