# Kashf

**Kashf** ("discovery" / "reveal" in Arabic) is an enterprise-grade traffic diagnostics demo console — a single-page operations dashboard that walks through root-cause diagnosis and "what-if" fix simulation for real road-network congestion scenarios, built for an RTA (Roads and Transport Authority) challenge demo.

The console is designed to look and feel like a product a government traffic authority could actually deploy: dark, restrained, data-driven, and honest about the limits of its own model (no invented numbers, no hidden fallback states — every claim on screen traces back to the underlying dataset).

## What it does

Kashf walks a live audience through five pre-built case studies drawn from an RTA traffic dataset (26,304 hours × 18 corridors, 2023–2025). For each case it:

1. **Diagnoses** the likely cause of congestion (signal timing, demand exceeding adaptive capacity, weather/incident, or non-attributable) with a confidence score and supporting evidence.
2. **Simulates fixes** — testing candidate interventions and showing indicative before/after impact on volume-to-capacity ratio and delay.
3. **Recommends** the best-performing fix, while clearly flagging any candidate that isn't reliably estimable with the model.

A live Mapbox view animates traffic flow along the affected corridors so the diagnosis and simulation results have a spatial, visual anchor.

### The five scenarios

| Case | Scenario | Focus |
|---|---|---|
| 1 | Al Mamzar | Signal-timing root cause |
| 2 | SZR Defence | Demand exceeding adaptive signal capacity (bidirectional) |
| 3 | April 2024 Storm | Weather-driven incident, with rain overlay |
| 4 | Citywide triage | Ranked table across all 18 corridors, no single route |
| 5 | Garhoud (Airport Rd) | Case with a non-estimable fix candidate |

## Tech stack

- **Frontend:** plain HTML + CSS + vanilla JavaScript (no framework, by design)
- **Map:** Mapbox GL JS v3 (dark style) for corridor pins, route geometry, and animated traffic flow
- **Charts:** Chart.js, used sparingly and only where it adds clarity
- **Data layer:** Python, used to prepare/validate the case data behind the demo
- **Data contract:** all case data is read from JSON files in `contract/` — the frontend renders only what's in the contract, with zero hardcoded figures in HTML/JS

## Repository structure

```
kashf-/
├── contract/     # JSON data contracts for each case — the single source of truth
├── docs/         # Supporting documentation
├── frontend/     # HTML/CSS/JS console (index.html, css/main.css, js/app.js, js/map.js, js/data.js)
├── index.html    # Entry point
├── kashf_frontend_build_spec.md   # Detailed frontend build spec (design system, layout, interaction rules)
└── salik_sense_problem_solution_phases.md   # Problem/solution framing for the project
```

## Getting started

Since this is a static frontend driven by local JSON contracts, no build step is required.

1. Clone the repo:
   ```bash
   git clone https://github.com/sudofixit/kashf-.git
   cd kashf-
   ```
2. Add a Mapbox access token in a local, gitignored `config.js` inside `frontend/` (see the build spec for the expected shape) — a token is required for the map to render.
3. Serve the `frontend/` directory with any static file server (opening `index.html` directly may hit CORS/fetch restrictions when loading the contract JSON), e.g.:
   ```bash
   cd frontend
   python3 -m http.server 8000
   ```
4. Open `http://localhost:8000` in a browser.

## Design principles

- **Contract-driven, not hardcoded** — every number, badge, and label on screen comes from `contract/*.json`. If a required field is missing, the UI raises a visible error banner rather than silently showing a blank.
- **Honest by default** — the console never overstates what the model can do: non-estimable fix candidates are shown (not hidden), forecasts are labeled indicative, and a permanent footer discloses the data source and its limitations.
- **Resilient on demo day** — network failures (e.g. the routing API) fall back gracefully to schematic lines rather than breaking the page, and all five scenarios are validated on load.

See [`kashf_frontend_build_spec.md`](./kashf_frontend_build_spec.md) for the full design system, layout, and interaction specification, and [`salik_sense_problem_solution_phases.md`](./salik_sense_problem_solution_phases.md) for the problem/solution background.

## Status

This is a demo/prototype built for a challenge walkthrough, not a production system. No releases have been published yet.

## License

No license has been specified for this repository yet.
