# Kashf — Frontend (Enterprise Demo Console)

Single-page RTA operations console. Plain HTML + CSS + vanilla JS + Mapbox GL JS v3.
Every rendered value comes from the `contract/*.json` files — no hardcoded case data.

## Run it

1. **Add your Mapbox token.** Edit `js/config.js` and paste your token:
   ```js
   window.KASHF_CONFIG = { mapboxToken: "pk.your_real_token" };
   ```
   (`js/config.js` is gitignored; `js/config.example.js` is the template.)

2. **Serve from the repo root** (so both `frontend/` and `contract/` are reachable —
   the app fetches `../contract/*.json`):
   ```
   cd <repo root that contains both frontend/ and contract/>
   python -m http.server 8000
   ```

3. Open **http://localhost:8000/frontend/index.html**

> Opening `index.html` via `file://` will NOT work — browsers block `fetch()` of the
> contract JSON over `file://`. It must be served over HTTP.

## What you should see
- Top bar: **Kashf** wordmark, 5 scenario tabs, live clock, a green "Verified data" pill.
- Map (dark) with 18 corridor pins (colored by severity) and 10 junction diamonds
  (JCT_MAMZ and JCT_DEF pulse).
- Switch scenarios with the tabs or ←/→ keys. Each case flies to its route and animates
  flow dots. Case 2 shows both directions converging on JCT_DEF; Case 3 adds rain +
  incident icons; Case 4 is the pin overview with a sortable 18-corridor table; Case 5
  shows the "not estimable" fix row.
- Right panel renders diagnosis, tested fixes, recommendation, and a Before/After flow
  toggle — all from the contract.

## Resilience
- If the Mapbox token is missing, the panel still works and the map shows a token notice
  (no crash).
- If the Directions API times out (5s) or fails, the route falls back to a schematic
  dashed line with a note. The demo never white-screens.
- On load the app validates all 5 contract files; any problem shows a red banner naming
  the file and field.

## Files
```
frontend/
  index.html
  css/main.css
  js/config.js        (gitignored — your Mapbox token)
  js/config.example.js
  js/data.js          (contract load + validation + reference coords)
  js/map.js           (Mapbox init, pins, routes, flow animation, fallback)
  js/app.js           (tabs, panel rendering, toggle, sortable table)
```
