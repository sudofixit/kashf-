# <img src="https://img.icons8.com/ios-filled/50/ffffff/search--v1.png" alt="Kashf Icon" width="32" height="32"/> Kashf

**Kashf** ("discovery" / "reveal" in Arabic) is an enterprise-grade traffic diagnostics demo console — a single-page operations dashboard that walks through root-cause diagnosis and "what-if" fix simulation for real road-network congestion scenarios, built for an RTA (Roads and Transport Authority) challenge demo.

The console is designed to look and feel like a product a government traffic authority could actually deploy: dark, restrained, data-driven, and honest about the limits of its own model (no invented numbers, no hidden fallback states — every claim on screen traces back to the underlying dataset).

---

## 🎯 What it does

Kashf walks a live audience through **five pre-built case studies** drawn from an RTA traffic dataset (26,304 hours × 18 corridors, 2023–2025). For each case it:

1. 🔍 **Diagnoses** the likely cause of congestion (signal timing, demand exceeding adaptive capacity, weather/incident, or non-attributable) with a confidence score and supporting evidence
2. 🧪 **Simulates fixes** — testing candidate interventions and showing indicative before/after impact on volume-to-capacity ratio and delay
3. ⭐ **Recommends** the best-performing fix, while clearly flagging any candidate that isn't reliably estimable with the model

A live Mapbox view animates traffic flow along the affected corridors so the diagnosis and simulation results have a spatial, visual anchor.

### 📋 The Five Scenarios

| # | Scenario | Focus |
|---|---|---|
| 1 | **Al Mamzar** | Signal-timing root cause |
| 2 | **SZR Defence** | Demand exceeding adaptive signal capacity (bidirectional) |
| 3 | **April 2024 Storm** | Weather-driven incident, with rain overlay |
| 4 | **Citywide triage** | Ranked table across all 18 corridors, no single route |
| 5 | **Garhoud (Airport Rd)** | Case with a non-estimable fix candidate |

## 🛠️ Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | Plain HTML + CSS + Vanilla JavaScript | No framework by design for lightweight, direct control |
| **Mapping** | Mapbox GL JS v3 (dark style) | Corridor pins, route geometry, animated traffic flow |
| **Charts** | Chart.js | Used sparingly, only where it adds clarity |
| **Data Layer** | Python | Prepare and validate case data behind the demo |
| **Data Contract** | JSON files in `contract/` | Single source of truth; frontend renders only from contract |

## 📁 Repository Structure

```
kashf-/
├── contract/                    # JSON data contracts for each case — the single source of truth
├── docs/                        # Supporting documentation
├── frontend/                    # HTML/CSS/JS console
│   ├── index.html               # Main entry point
│   ├── css/
│   │   └── main.css            # Primary stylesheet
│   └── js/
│       ├── app.js              # Main application logic
│       ├── map.js              # Mapbox integration
│       └── data.js             # Data handling
├── index.html                   # Root entry point
├── kashf_frontend_build_spec.md # Detailed frontend build spec (design system, layout, interaction rules)
└── salik_sense_problem_solution_phases.md # Problem/solution framing for the project
```

## 🚀 Getting Started

Since this is a static frontend driven by local JSON contracts, **no build step is required**.

### Prerequisites
- Git
- Python 3 (for local server)
- Mapbox access token (required for map rendering)

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sudofixit/kashf-.git
   cd kashf-
   ```

2. **Add Mapbox access token:**
   - Create a `config.js` file inside `frontend/` (this file is in `.gitignore`)
   - Add your Mapbox access token in the expected format (see build spec for details)
   - *Note: A valid token is required for the map to render properly*

3. **Start a local server:**
   ```bash
   cd frontend
   python3 -m http.server 8000
   ```
   > ⚠️ **Important:** Opening `index.html` directly may hit CORS/fetch restrictions when loading the contract JSON files. Always use a local server.

4. **Open in browser:**
   Navigate to `http://localhost:8000` in your browser.

## 🎨 Design Principles

Kashf follows a strict philosophy that ensures reliability and transparency:

| Principle | Description |
|-----------|-------------|
| **📋 Contract-driven** | Every number, badge, and label comes from `contract/*.json`. Missing required fields trigger visible error banners instead of blank spaces. |
| **🤝 Honest by default** | Never overstates model capabilities: non-estimable fixes are shown (not hidden), forecasts are labeled as indicative, and a permanent footer discloses data sources and limitations. |
| **🛡️ Resilient on demo day** | Network failures (e.g., routing API) fall back gracefully to schematic lines; all five scenarios are validated on load. |

### Learn More
- [📖 Full Design System & Specifications](./kashf_frontend_build_spec.md) — Detailed frontend build spec, design system, layout, and interaction rules
- [📝 Problem & Solution Background](./salik_sense_problem_solution_phases.md) — Comprehensive framing for the project

---

## 📊 Project Status

> ⚠️ **Current Status:** Demo/Prototype
>
> Kashf is currently a **challenge walkthrough prototype** and not a production system. No official releases have been published yet.

---

## 📜 License

> ⚠️ **Status:** No license specified
>
> No license has been specified for this repository yet. Contributors should clarify licensing terms before use in production environments.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests to help improve this project.

---

<div align="center">

**Built with ❤️ for the RTA Challenge Demo**

*Kashf - Discover the insights hidden in traffic data*

</div>