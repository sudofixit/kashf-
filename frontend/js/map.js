/* Kashf — map.js
 * Mapbox init, network pins, junction diamonds, per-case route geometry (Mapbox
 * Directions API, cached in memory), flow-dot animation, and the case-3 rain +
 * incident overlays. Every displayed value originates from the contract; this file
 * only handles geometry and motion.
 */
(function () {
  "use strict";

  const D = window.KashfData;
  const SEV_HEX = { red: "#EF4444", amber: "#F59E0B", green: "#22C55E" };
  const SEV_STROKE = { red: "#B91C1C", amber: "#B45309", green: "#15803D" };
  const FLOW_BASE_MS = 4200; // dot traversal time = FLOW_BASE_MS / speed_factor

  let map = null;
  let ready = false;
  let tokenOk = false;
  const routeCache = {};          // caseId+idx -> {coords, fallback}
  let active = null;              // { caseId, routes:[...], rafId, incidentMarkers:[] }
  const junctionMarkers = [];

  function tokenValid() {
    const t = window.KASHF_CONFIG && window.KASHF_CONFIG.mapboxToken;
    return typeof t === "string" && t.length > 20 && !t.includes("PASTE_YOUR");
  }

  // ---- init ----------------------------------------------------------------
  function init(cases) {
    return new Promise((resolve) => {
      if (typeof mapboxgl === "undefined") {
        showTokenWarning("Mapbox GL failed to load (offline?). Panel data still works.");
        resolve({ ok: false });
        return;
      }
      if (!tokenValid()) {
        showTokenWarning("Add your Mapbox token to js/config.js to enable the map. Panel data still works.");
        resolve({ ok: false });
        return;
      }
      tokenOk = true;
      mapboxgl.accessToken = window.KASHF_CONFIG.mapboxToken;
      map = new mapboxgl.Map({
        container: "map",
        style: "mapbox://styles/mapbox/dark-v11",
        center: [55.31, 25.24],
        zoom: 11.3,
        attributionControl: false
      });
      map.on("load", () => {
        ready = true;
        addNetworkPins(cases);
        addJunctions();
        resolve({ ok: true });
      });
      map.on("error", (e) => { /* keep console clean of benign tile aborts */ void e; });
    });
  }

  // ---- Layer 1: corridor pins + junction diamonds --------------------------
  function addNetworkPins(cases) {
    const citywide = Object.values(cases).find((c) => Array.isArray(c.triage_table));
    const feats = (citywide ? citywide.triage_table : []).map((row) => {
      const coord = D.LOCATION_COORDS[row.location_id];
      return coord ? {
        type: "Feature",
        geometry: { type: "Point", coordinates: coord },
        properties: {
          location_id: row.location_id, area: row.area,
          los_f_pct: row.los_f_pct, demand_gap_vph: row.demand_gap_vph,
          severity_color: row.severity_color
        }
      } : null;
    }).filter(Boolean);

    map.addSource("corridors", { type: "geojson", data: { type: "FeatureCollection", features: feats } });
    map.addLayer({
      id: "corridor-pins", type: "circle", source: "corridors",
      paint: {
        "circle-radius": 7,
        "circle-color": ["match", ["get", "severity_color"], "red", SEV_HEX.red, "amber", SEV_HEX.amber, "green", SEV_HEX.green, "#94A3B8"],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": ["match", ["get", "severity_color"], "red", SEV_STROKE.red, "amber", SEV_STROKE.amber, "green", SEV_STROKE.green, "#475569"]
      }
    });

    const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 14 });
    map.on("mousemove", "corridor-pins", (e) => {
      map.getCanvas().style.cursor = "pointer";
      const p = e.features[0].properties;
      popup.setLngLat(e.features[0].geometry.coordinates).setHTML(
        `<div class="map-tooltip">
           <div class="tt-id">${p.location_id}</div>
           <div class="tt-area">${p.area}</div>
           <div class="tt-row">% hours at gridlock <b>${p.los_f_pct}</b></div>
           <div class="tt-row">unmet demand <b>${p.demand_gap_vph}</b></div>
         </div>`).addTo(map);
    });
    map.on("mouseleave", "corridor-pins", () => { map.getCanvas().style.cursor = ""; popup.remove(); });
  }

  function addJunctions() {
    D.JUNCTIONS.forEach((j) => {
      const el = document.createElement("div");
      el.className = "jct-marker" + (D.PULSE_JUNCTIONS.includes(j.id) ? " pulse" : "");
      el.title = `${j.name} — ${j.control}`;
      const m = new mapboxgl.Marker({ element: el }).setLngLat(j.coords).addTo(map);
      junctionMarkers.push(m);
    });
  }

  // ---- route geometry (Directions API, cached) -----------------------------
  async function fetchRoute(cacheKey, a, b) {
    if (routeCache[cacheKey]) return routeCache[cacheKey];
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${a[0]},${a[1]};${b[0]},${b[1]}` +
      `?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000); // 5s per spec §6
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      const coords = json.routes && json.routes[0] && json.routes[0].geometry.coordinates;
      if (!coords || coords.length < 2) throw new Error("no geometry");
      routeCache[cacheKey] = { coords, fallback: false };
    } catch (e) {
      // Resilience §6: schematic straight dashed line — never break the demo.
      routeCache[cacheKey] = { coords: [a, b], fallback: true };
    }
    return routeCache[cacheKey];
  }

  // polyline distance helpers (planar lng/lat — fine over these short segments)
  function cumulative(coords) {
    const cum = [0]; let total = 0;
    for (let i = 1; i < coords.length; i++) {
      total += Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1]);
      cum.push(total);
    }
    return { cum, total };
  }
  function pointAt(coords, cum, total, d) {
    if (total === 0) return coords[0];
    d = ((d % total) + total) % total;
    let i = 1; while (i < cum.length && cum[i] < d) i++;
    if (i >= coords.length) return coords[coords.length - 1];
    const seg = cum[i] - cum[i - 1];
    const t = seg > 0 ? (d - cum[i - 1]) / seg : 0;
    return [coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t,
            coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t];
  }

  // ---- show a case ---------------------------------------------------------
  async function showCase(caseData, flowState) {
    if (!ready) return;
    clearActive();

    const isStorm = caseData.case_id === "case_3_storm";
    document.getElementById("rain-overlay").hidden = !isStorm;

    // Build the route specs from CONTRACT anchors (never hardcoded here).
    // NOTE: corridor routes are drawn on the carriageway; the JCT diamonds are a
    // SEPARATE real-world facility (surface junction) — we never route the line
    // through the junction marker, only show them as neighbours.
    const specs = [];
    if (caseData.map && Array.isArray(caseData.map.route_anchors)) {
      specs.push({ anchors: caseData.map.route_anchors, color: caseData.map.severity_color });
    }
    if (caseData.secondary_corridor && Array.isArray(caseData.secondary_corridor.route_anchors)) {
      specs.push({ anchors: caseData.secondary_corridor.route_anchors, color: caseData.map.severity_color });
    }

    active = { caseId: caseData.case_id, routes: [], rafId: null, incidentMarkers: [] };

    if (specs.length === 0) {
      // Case 4 (citywide) — pin overview, fly to the whole network.
      map.flyTo({ center: [55.31, 25.24], zoom: 11.3, duration: 1200, essential: true });
      return;
    }

    let anyFallback = false;
    const allCoords = [];
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      const geo = await fetchRoute(caseData.case_id + ":" + i, s.anchors[0], s.anchors[1]);
      if (active === null || active.caseId !== caseData.case_id) return; // superseded mid-fetch
      anyFallback = anyFallback || geo.fallback;
      const { cum, total } = cumulative(geo.coords);
      const routeSrc = "route-" + i, flowSrc = "flow-" + i;

      map.addSource(routeSrc, { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: geo.coords } } });
      map.addLayer({
        id: routeSrc, type: "line", source: routeSrc,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": SEV_HEX[s.color] || SEV_HEX.red,
          "line-width": 5, "line-opacity": 0.6
        }
      });
      // schematic fallback: dashed; real geometry stays solid (default).
      if (geo.fallback) map.setPaintProperty(routeSrc, "line-dasharray", [2, 2]);
      map.addSource(flowSrc, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: flowSrc, type: "circle", source: flowSrc,
        paint: { "circle-radius": 5, "circle-color": SEV_HEX[s.color] || SEV_HEX.red, "circle-opacity": 0.95 }
      });

      active.routes.push({ coords: geo.coords, cum, total, flowSrc, dotCount: 8, traversalMs: FLOW_BASE_MS });
      geo.coords.forEach((c) => allCoords.push(c));
    }

    // Storm: incident cluster near the bridge (from the route midpoint).
    if (isStorm) addIncidentCluster(active.routes[0]);

    // Camera: fit the route(s).
    const b = allCoords.reduce((acc, c) => acc.extend(c), new mapboxgl.LngLatBounds(allCoords[0], allCoords[0]));
    map.fitBounds(b, { padding: 80, duration: 1200, essential: true, maxZoom: 14.5 });

    // Note line for schematic fallback.
    const note = document.getElementById("map-note");
    if (anyFallback) { note.textContent = "Route geometry unavailable — schematic line shown."; note.hidden = false; }
    else note.hidden = true;

    setFlowState(caseData, flowState || "before");
    startAnimation();
  }

  function addIncidentCluster(route) {
    if (!route) return;
    const mid = pointAt(route.coords, route.cum, route.total, route.total * 0.5);
    const offsets = [[0, 0], [0.0016, 0.0009], [-0.0014, 0.0011], [0.0009, -0.0013]];
    offsets.forEach((o) => {
      const el = document.createElement("div");
      el.textContent = "⚠";
      el.style.cssText = "font-size:14px;line-height:1;filter:drop-shadow(0 0 2px #000);";
      const m = new mapboxgl.Marker({ element: el }).setLngLat([mid[0] + o[0], mid[1] + o[1]]).addTo(map);
      active.incidentMarkers.push(m);
    });
  }

  // ---- before/after flow state (density + speed from contract) -------------
  function setFlowState(caseData, state) {
    if (!active || !caseData.flow_animation) return;
    const block = caseData.flow_animation[state] || caseData.flow_animation.before;
    if (!block) return;
    const dotCount = D.DENSITY_DOTS[block.density] || 8;
    const sf = typeof block.speed_factor === "number" ? block.speed_factor : 0.6;
    const traversalMs = FLOW_BASE_MS / Math.max(sf, 0.05);
    active.routes.forEach((r) => { r.dotCount = dotCount; r.traversalMs = traversalMs; });
  }

  function startAnimation() {
    if (!active) return;
    const step = (now) => {
      if (!active) return;
      active.routes.forEach((r) => {
        const feats = [];
        for (let i = 0; i < r.dotCount; i++) {
          const phase = i / r.dotCount;
          const d = (((now / r.traversalMs) + phase) % 1) * r.total;
          feats.push({ type: "Feature", geometry: { type: "Point", coordinates: pointAt(r.coords, r.cum, r.total, d) } });
        }
        const src = map.getSource(r.flowSrc);
        if (src) src.setData({ type: "FeatureCollection", features: feats });
      });
      active.rafId = requestAnimationFrame(step);
    };
    active.rafId = requestAnimationFrame(step);
  }

  function clearActive() {
    document.getElementById("map-note").hidden = true;
    if (!active) return;
    if (active.rafId) cancelAnimationFrame(active.rafId);
    active.routes.forEach((r, i) => {
      ["route-" + i, "flow-" + i].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
      });
    });
    active.incidentMarkers.forEach((m) => m.remove());
    active = null;
  }

  function showTokenWarning(msg) {
    const el = document.getElementById("map-token-warning");
    el.textContent = msg; el.hidden = false;
  }

  window.KashfMap = { init, showCase, setFlowState, isReady: () => ready };
})();
