/* Kashf — map.js (enhanced)
 * Mapbox dark base + LIVE TRAFFIC layer (A1) + 3D buildings (A2) + per-case camera,
 * network pins & junction diamonds, real route geometry (Directions API, cached), and a
 * Turf-driven car/story layer (B) with staged annotations (C). ONE requestAnimationFrame
 * loop drives every car (Part F). All rendered numbers come from the contract; this file
 * only owns geometry, motion and camera.
 *
 * NOTE (spec §3 + §G): corridor routes are drawn on the carriageway; JCT diamonds are a
 * SEPARATE surface facility — the route line is never drawn through the junction marker.
 * The live-traffic layer is a Mapbox crowd-data BASE layer only; it never feeds our
 * diagnosis (disclosure is permanent in the bottom strip).
 */
(function () {
  "use strict";
  const D = window.KashfData;
  const SEV_HEX = { red: "#EF4444", amber: "#F59E0B", green: "#22C55E" };
  const GRAY = "#7C89A0";
  const AMBIENT_PER_SEG = 3;   // 3-5 per segment; 3 keeps us well under the cap
  const MAX_CARS = 30;         // Part F hard cap
  const FLOW_BASE = 1;         // unused placeholder kept for clarity

  let map = null, ready = false, tokenOk = false, trafficOk = false;
  let buildings3dOn = true, ambientPerSeg = AMBIENT_PER_SEG;
  const routeCache = {};
  let segments = [];           // all 5 verified segments (ambient lives here always)
  let ambientCars = [];        // gray cars on every segment
  let story = null;            // { caseId, cars:[], seg, seg2, signal, ... }
  let annTimers = [], annMarkers = [];
  let incidentMarkers = [], patrolMarker = null, signalMarker = null;
  let rafId = null, lastTs = 0, activeCaseId = null;
  const junctionMarkers = [];
  // FPS monitor (Part F auto-degrade)
  let fpsEMA = 60, degradeStep = 0, lowSince = 0;

  function tokenValid() {
    const t = window.KASHF_CONFIG && window.KASHF_CONFIG.mapboxToken;
    return typeof t === "string" && t.length > 20 && !t.includes("PASTE_YOUR");
  }
  const hasTurf = () => typeof turf !== "undefined";

  // ---------- init ----------
  function init(cases) {
    return new Promise((resolve) => {
      if (typeof mapboxgl === "undefined") { warn("Mapbox GL failed to load. Panel data still works."); return resolve({ ok: false }); }
      if (!tokenValid()) { warn("Add your Mapbox token to js/config.js to enable the map. Panel data still works."); return resolve({ ok: false }); }
      tokenOk = true;
      mapboxgl.accessToken = window.KASHF_CONFIG.mapboxToken;
      // Mapbox tokens are normally URL-restricted to the deploy domain, so on localhost the
      // vector tiles 403 and the map goes grey. Fall back to token-free dark raster tiles for
      // local preview; the deployed (GitHub Pages) build uses the full Mapbox vector style.
      const isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname);
      const localStyle = {
        version: 8,
        glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
        sources: { basemap: { type: "raster", tileSize: 256,
          tiles: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
                  "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
                  "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"],
          attribution: "© OpenStreetMap © CARTO" } },
        layers: [{ id: "basemap", type: "raster", source: "basemap" }]
      };
      map = new mapboxgl.Map({ container: "map",
        style: isLocal ? localStyle : "mapbox://styles/mapbox/dark-v11",
        center: [55.31, 25.24], zoom: 11.3, pitch: 0, attributionControl: false });
      // If the style/WebGL never loads (headless, blocked GL, network), resolve anyway so the
      // rest of the app is never blocked.
      const failTimer = setTimeout(() => { if (!ready) { warn("Map could not initialise (WebGL/network). Panel data still works."); resolve({ ok: false }); } }, 8000);
      map.on("load", () => {
        clearTimeout(failTimer);
        ready = true;
        addTrafficLayer();
        add3DBuildings();
        addNetworkPins(cases);
        addJunctions();
        buildSegments(cases);
        startLoop();
        resolve({ ok: true });                 // UI must never wait for route geometry
        primeAllRoutes().then(spawnAmbient).catch((e) => console.warn("route prime:", e));
      });
      map.on("error", (e) => { void e; });  // swallow benign tile aborts (no console noise)
    });
  }

  // ---------- A1: live traffic ----------
  function addTrafficLayer() {
    try {
      map.addSource("mapbox-traffic", { type: "vector", url: "mapbox://mapbox.mapbox-traffic-v1" });
      // Added before our pins/story layers exist, so it naturally sits UNDER them — a quiet
      // desaturated base layer (~45% opacity). No beforeId needed.
      map.addLayer({
        id: "live-traffic", type: "line", source: "mapbox-traffic", "source-layer": "traffic",
        layout: { "line-cap": "round" },
        paint: {
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.2, 16, 4],
          "line-opacity": 0.45,
          "line-color": ["match", ["get", "congestion"],
            "low", "#3f7d5c", "moderate", "#b9862f", "heavy", "#b3453f", "severe", "#a13a34", "#4a5568"]
        }
      });
      trafficOk = true;
    } catch (e) { trafficOk = false; console.warn("live traffic unavailable:", e && e.message); }
    // detect source load failure (403/network) → hide toggle, continue
    map.on("error", (ev) => {
      if (ev && ev.sourceId === "mapbox-traffic") {
        trafficOk = false;
        const t = document.getElementById("traffic-toggle"); if (t) t.hidden = true;
        console.warn("live-traffic source failed to load — continuing without it.");
      }
    });
  }
  function setTraffic(on) {
    if (!trafficOk || !map.getLayer("live-traffic")) return;
    map.setLayoutProperty("live-traffic", "visibility", on ? "visible" : "none");
  }
  function trafficAvailable() { return trafficOk; }

  // ---------- A2: 3D buildings ----------
  function add3DBuildings() {
    try {
      const layers = map.getStyle().layers;
      let labelLayer;
      for (const l of layers) { if (l.type === "symbol" && l.layout && l.layout["text-field"]) { labelLayer = l.id; break; } }
      map.addLayer({
        id: "3d-buildings", source: "composite", "source-layer": "building",
        filter: ["==", "extrude", "true"], type: "fill-extrusion", minzoom: 14,
        paint: {
          "fill-extrusion-color": "#1A2438",
          "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 14, 0, 15.5, ["get", "height"]],
          "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 14, 0, 15.5, ["get", "min_height"]],
          "fill-extrusion-opacity": 0.7
        }
      }, labelLayer);
    } catch (e) { console.warn("3D buildings unavailable:", e && e.message); }
  }
  function set3D(on) {
    buildings3dOn = on;
    if (map.getLayer("3d-buildings")) map.setLayoutProperty("3d-buildings", "visibility", on ? "visible" : "none");
  }

  // ---------- pins + junctions ----------
  function addNetworkPins(cases) {
    const cw = Object.values(cases).find((c) => Array.isArray(c.triage_table));
    const feats = (cw ? cw.triage_table : []).map((r) => {
      const c = D.LOCATION_COORDS[r.location_id];
      return c ? { type: "Feature", geometry: { type: "Point", coordinates: c },
        properties: { location_id: r.location_id, area: r.area, los_f_pct: r.los_f_pct,
          demand_gap_vph: r.demand_gap_vph, severity_color: r.severity_color } } : null;
    }).filter(Boolean);
    map.addSource("corridors", { type: "geojson", data: { type: "FeatureCollection", features: feats } });
    map.addLayer({ id: "corridor-pins", type: "circle", source: "corridors", paint: {
      "circle-radius": 7,
      "circle-color": ["match", ["get", "severity_color"], "red", SEV_HEX.red, "amber", SEV_HEX.amber, "green", SEV_HEX.green, "#94A3B8"],
      "circle-stroke-width": 1.5,
      "circle-stroke-color": ["match", ["get", "severity_color"], "red", "#B91C1C", "amber", "#B45309", "green", "#15803D", "#475569"] } });
    const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 14 });
    map.on("mousemove", "corridor-pins", (e) => {
      map.getCanvas().style.cursor = "pointer";
      const p = e.features[0].properties;
      popup.setLngLat(e.features[0].geometry.coordinates).setHTML(
        `<div class="map-tooltip"><div class="tt-id">${(window.KashfTranslate ? window.KashfTranslate.name(p.location_id) : p.location_id)}</div><div class="tt-area">${p.area}</div>
         <div class="tt-row">% hours at gridlock <b>${p.los_f_pct}</b></div>
         <div class="tt-row">unmet demand <b>${p.demand_gap_vph}</b></div></div>`).addTo(map);
    });
    map.on("mouseleave", "corridor-pins", () => { map.getCanvas().style.cursor = ""; popup.remove(); });
  }
  function addJunctions() {
    D.JUNCTIONS.forEach((j) => {
      const el = document.createElement("div");
      el.className = "jct-marker" + (D.PULSE_JUNCTIONS.includes(j.id) ? " pulse" : "");
      el.title = window.KashfTranslate ? window.KashfTranslate.text(`${j.name} — ${j.control}`) : `${j.name} — ${j.control}`;
      junctionMarkers.push(new mapboxgl.Marker({ element: el }).setLngLat(j.coords).addTo(map));
    });
  }

  // ---------- segments (all 5 verified) ----------
  function buildSegments(cases) {
    // bakedGeom: pre-fetched OSRM road geometry (array of [lng,lat]) baked into the contract JSON.
    // When present it is used in ensureRoute() instead of the Mapbox Directions API (which is
    // URL-restricted on localhost). Falls back to the two-point schematic line when absent.
    const add = (id, caseId, anchors, vc, color, bakedGeom) => { if (Array.isArray(anchors)) segments.push({ id, caseId, anchors, vc, color, bakedGeom: bakedGeom || null }); };
    const c1 = cases["case_1_al_mamzar"], c2 = cases["case_2_szr_defence"],
          c3 = cases["case_3_storm"], c5 = cases["case_5_garhoud_no_signal"];
    if (c1) add("case_1_al_mamzar", "case_1_al_mamzar", c1.map.route_anchors, c1.triage.mean_vc, c1.map.severity_color, c1.map.route_geometry);
    if (c2) {
      add("case_2_main", "case_2_szr_defence", c2.map.route_anchors, c2.triage.mean_vc, c2.map.severity_color, c2.map.route_geometry);
      if (c2.secondary_corridor) add("case_2_sec", "case_2_szr_defence", c2.secondary_corridor.route_anchors, c2.secondary_corridor.mean_vc, c2.map.severity_color, c2.secondary_corridor.route_geometry);
    }
    if (c3) add("case_3_storm", "case_3_storm", c3.map.route_anchors, c3.triage.mean_vc, c3.map.severity_color, c3.map.route_geometry);
    if (c5) add("case_5_garhoud_no_signal", "case_5_garhoud_no_signal", c5.map.route_anchors, c5.triage.mean_vc, c5.map.severity_color, c5.map.route_geometry);
  }

  async function fetchRoute(key, a, b) {
    if (routeCache[key]) return routeCache[key];
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${a[0]},${a[1]};${b[0]},${b[1]}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(url, { signal: ctrl.signal }); clearTimeout(timer);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const j = await res.json();
      const coords = j.routes && j.routes[0] && j.routes[0].geometry.coordinates;
      if (!coords || coords.length < 2) throw new Error("no geometry");
      routeCache[key] = { coords, fallback: false };
    } catch (e) { routeCache[key] = { coords: [a, b], fallback: true }; }
    return routeCache[key];
  }

  async function ensureRoute(s) {
    if (!s || s.coords) return s;
    // Prefer baked OSRM geometry (written by scripts/bake_routes.mjs) — works on localhost
    // without a URL-restricted Mapbox token. Falls back to the live Directions API, and if
    // that also fails, to a two-point schematic line (fallback: true triggers the map note).
    if (s.bakedGeom && s.bakedGeom.length >= 2) {
      s.coords = s.bakedGeom; s.fallback = false;
    } else {
      const geo = await fetchRoute(s.id, s.anchors[0], s.anchors[1]);
      s.coords = geo.coords; s.fallback = geo.fallback;
    }
    if (hasTurf()) { s.tline = turf.lineString(s.coords); s.lenKm = Math.max(turf.length(s.tline, { units: "kilometers" }), 0.001); }
    const cum = [0]; let tot = 0;
    for (let i = 1; i < s.coords.length; i++) { tot += Math.hypot(s.coords[i][0] - s.coords[i - 1][0], s.coords[i][1] - s.coords[i - 1][1]); cum.push(tot); }
    s.cum = cum; s.tot = tot || 1e-6;
    return s;
  }
  async function primeAllRoutes() { for (const s of segments) await ensureRoute(s); }

  // geometry helpers (Turf primary per spec; planar fallback if the CDN failed)
  function alongFrac(s, f) {
    f = Math.max(0, Math.min(1, f));
    if (hasTurf() && s.tline) return turf.along(s.tline, f * s.lenKm, { units: "kilometers" }).geometry.coordinates;
    const d = f * s.tot; let i = 1; while (i < s.cum.length && s.cum[i] < d) i++;
    if (i >= s.coords.length) return s.coords[s.coords.length - 1];
    const seg = s.cum[i] - s.cum[i - 1], t = seg > 0 ? (d - s.cum[i - 1]) / seg : 0;
    return [s.coords[i - 1][0] + (s.coords[i][0] - s.coords[i - 1][0]) * t, s.coords[i - 1][1] + (s.coords[i][1] - s.coords[i - 1][1]) * t];
  }
  function bearingDeg(a, b) {
    const r = Math.PI / 180, y = Math.sin((b[0] - a[0]) * r) * Math.cos(b[1] * r);
    const x = Math.cos(a[1] * r) * Math.sin(b[1] * r) - Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos((b[0] - a[0]) * r);
    return Math.atan2(y, x) * 180 / Math.PI;
  }
  function headingAt(s, f) { const p1 = alongFrac(s, f), p2 = alongFrac(s, Math.min(f + 0.03, 1)); return bearingDeg(p1, p2); }
  function stopLineFrac(s, pt) {
    if (hasTurf() && s.tline && pt) { try { const np = turf.nearestPointOnLine(s.tline, turf.point(pt), { units: "kilometers" }); return Math.min(0.92, np.properties.location / s.lenKm); } catch (e) { /* fall through */ } }
    return 0.88;
  }

  // ---------- car factory ----------
  function makeCar(color, sizePx, opacity) {
    const el = document.createElement("div");
    el.className = "car";
    const w = sizePx * 0.5;
    el.style.borderLeftWidth = w + "px"; el.style.borderRightWidth = w + "px";
    el.style.borderBottomWidth = sizePx + "px"; el.style.borderBottomColor = color;
    el.style.opacity = opacity;
    const marker = new mapboxgl.Marker({ element: el, rotationAlignment: "map", pitchAlignment: "map" });
    return { el, marker };
  }

  // ---------- ambient (B1) — all segments, always ----------
  function spawnAmbient() {
    clearAmbient();
    segments.forEach((s) => {
      for (let i = 0; i < ambientPerSeg; i++) {
        const { el, marker } = makeCar(GRAY, 8, 0.4);
        const crossSec = 22 + s.vc * 34;               // higher vc = slower
        ambientCars.push({ s, f: Math.random(), speed: 1 / crossSec, marker, el, base: 0.4 });
        marker.setLngLat(alongFrac(s, 0)).addTo(map);
      }
    });
  }
  function clearAmbient() { ambientCars.forEach((c) => c.marker.remove()); ambientCars = []; }
  function dimAmbient(activeIds) {
    ambientCars.forEach((c) => {
      const active = activeIds.indexOf(c.s.id) >= 0;
      c.hidden = active;                       // active-segment ambient hidden (story replaces it)
      c.el.style.display = active ? "none" : "";
      c.el.style.opacity = active ? 0 : 0.2;   // non-active dim to 20%
    });
  }
  function undimAmbient() { ambientCars.forEach((c) => { c.hidden = false; c.el.style.display = ""; c.el.style.opacity = c.base; }); }

  // ---------- story per case (B2-B6) ----------
  function spawnStoryCars(caseData) {
    const cars = [];
    const cid = caseData.case_id;
    const push = (s, f, speed, extra) => { const { el, marker } = makeCar(SEV_HEX[s.color] || SEV_HEX.red, 10, 0.95); marker.setLngLat(alongFrac(s, f)).addTo(map); cars.push(Object.assign({ s, f, speed, marker, el }, extra || {})); };

    if (cid === "case_1_al_mamzar") {
      const s = seg("case_1_al_mamzar");
      const stop = stopLineFrac(s, (caseData.map.junction_point));
      const n = 9;
      for (let i = 0; i < n; i++) push(s, (i / n) * stop, 1 / 14, {});   // packed approaching the stop line
      return { cars, seg: s, mode: "signal", stop, cyc: signalCycle("before") };
    }
    if (cid === "case_2_szr_defence") {
      const a = seg("case_2_main"), b = seg("case_2_sec");
      const n = 6;
      for (let i = 0; i < n; i++) { push(a, i / n, 1 / 20, {}); if (b) push(b, i / n, 1 / 20, {}); }
      return { cars, seg: a, seg2: b, mode: "flow", baseCount: cars.length };
    }
    if (cid === "case_3_storm") {
      const s = seg("case_3_storm");
      for (let i = 0; i < 4; i++) push(s, i / 4, 1 / 42, {});            // few, crawling
      return { cars, seg: s, mode: "crawl" };
    }
    if (cid === "case_5_garhoud_no_signal") {
      const s = seg("case_5_garhoud_no_signal");
      const n = 12;
      for (let i = 0; i < n; i++) push(s, i / n, 1 / 30, {});           // dense, whole segment, uniform
      return { cars, seg: s, mode: "uniform", n };
    }
    return { cars, mode: "none" };  // case 4: no story cars
  }
  function seg(id) { return segments.find((s) => s.id === id); }
  function signalCycle(state) { return state === "after" ? { red: 6, green: 6 } : { red: 6, green: 3 }; }

  // ---------- the ONE animation loop ----------
  function startLoop() { if (rafId) return; lastTs = performance.now(); rafId = requestAnimationFrame(step); }
  function step(now) {
    const dt = Math.min((now - lastTs) / 1000, 0.05); lastTs = now;
    monitorFps(now, dt);
    // ambient
    for (const c of ambientCars) { if (c.hidden) continue; c.f += c.speed * dt; if (c.f > 1) c.f -= 1; place(c); }
    // story
    if (story && story.cars.length) updateStory(dt, now);
    rafId = requestAnimationFrame(step);
  }
  function place(c) { const pos = alongFrac(c.s, c.f); c.marker.setLngLat(pos); c.marker.setRotation(headingAt(c.s, c.f)); }

  function updateStory(dt, now) {
    if (story.mode === "signal") return updateSignal(dt, now);
    if (story.mode === "uniform") {
      // dense, even spacing along the WHOLE segment at uniform speed (Case 5 — road full
      // end to end, no bottleneck). Equal speed preserves the even spacing.
      story.cars.forEach((c) => { if (c.hidden) return; c.f += c.speed * dt; if (c.f > 1) c.f -= 1; place(c); });
      return;
    }
    // flow / crawl: independent drift, recycle at end
    story.cars.forEach((c) => { if (c.hidden) return; c.f += c.speed * dt; if (c.f > 1) c.f -= 1; place(c); });
  }

  function updateSignal(dt, now) {
    const { red, green } = story.cyc, cyc = red + green;
    const phase = (now / 1000) % cyc, isGreen = phase >= red;
    if (signalMarker) signalMarker.getElement().style.background = isGreen ? SEV_HEX.green : SEV_HEX.red;
    const stop = story.stop, gap = 0.045;
    // process front (highest f) to back so each yields to the one ahead / the stop line
    const cars = story.cars.slice().sort((a, b) => b.f - a.f);
    let aheadF = Infinity;
    for (const c of cars) {
      let target = c.f + c.speed * dt;
      if (aheadF !== Infinity) target = Math.min(target, aheadF - gap);   // car-following spacing
      if (!isGreen && c.f <= stop) target = Math.min(target, stop);        // red: cannot cross stop line
      c.f = Math.max(c.f, Math.min(target, 1.0));
      if (c.f >= 1.0) c.f = 0;                                             // recycle from the start (keeps supply)
      aheadF = c.f;
      place(c);
    }
  }

  // ---------- camera per case (A2) ----------
  const CAM = {
    case_1_al_mamzar: { pitch: 55, bearing: 40 },
    case_2_szr_defence: { pitch: 55, bearing: 305 },
    case_3_storm: { pitch: 60, bearing: 55 },
    case_5_garhoud_no_signal: { pitch: 55, bearing: 200 }
  };
  function cameraFor(caseData) {
    if (Array.isArray(caseData.triage_table)) { map.easeTo({ center: [55.31, 25.24], zoom: 11.3, pitch: 0, bearing: 0, duration: 1200, essential: true }); return; }
    const segs = activeSegs(caseData).map(seg).filter(Boolean);
    const all = []; segs.forEach((s) => (s.coords || []).forEach((c) => all.push(c)));
    if (!all.length) return;
    const b = all.reduce((acc, c) => acc.extend(c), new mapboxgl.LngLatBounds(all[0], all[0]));
    const cam = CAM[caseData.case_id] || { pitch: 55, bearing: 0 };
    map.fitBounds(b, { padding: 90, pitch: cam.pitch, bearing: cam.bearing, duration: 1200, essential: true, maxZoom: 15.5 });
    // Case 3: gentle 8s cinematic pan along the bridge (interruptible — a new camera call cancels it)
    if (caseData.case_id === "case_3_storm") {
      clearTimeout(story && story._panT);
      const t = setTimeout(() => { if (story && story.caseId === "case_3_storm") map.easeTo({ bearing: cam.bearing + 25, duration: 8000, easing: (x) => x, essential: true }); }, 1400);
      if (story) story._panT = t;
    }
  }
  function activeSegs(caseData) {
    if (caseData.case_id === "case_2_szr_defence") return ["case_2_main", "case_2_sec"];
    return [caseData.case_id];
  }

  // ---------- show a case ----------
  async function showCase(caseData, flowState) {
    if (!ready) return;
    clearStory();
    activeCaseId = caseData.case_id;
    const isStorm = caseData.case_id === "case_3_storm";
    document.getElementById("rain-overlay").hidden = !isStorm;

    if (Array.isArray(caseData.triage_table)) {  // case 4: pins overview, ambient carries it
      undimAmbient(); cameraFor(caseData);
      scheduleAnnotations(caseData, "before");   // beats anchored at the top-3 corridor pins
      return;
    }
    const actIds = activeSegs(caseData);
    dimAmbient(actIds);
    await Promise.all(actIds.map((id) => ensureRoute(seg(id))));  // load active geometry on demand
    if (activeCaseId !== caseData.case_id) return;                // superseded during fetch
    story = spawnStoryCars(caseData); story.caseId = caseData.case_id;
    enforceCap();

    // signal light (case 1)
    if (story.mode === "signal" && caseData.map.junction_point) {
      const el = document.createElement("div"); el.className = "signal-light";
      signalMarker = new mapboxgl.Marker({ element: el }).setLngLat(caseData.map.junction_point).addTo(map);
    }
    // storm incidents + rain (case 3)
    if (isStorm) addIncidents(seg("case_3_storm"));

    cameraFor(caseData);
    const note = document.getElementById("map-note");
    if (actIds.map(seg).some((s) => s && s.fallback)) { note.textContent = "Route geometry unavailable — schematic line shown."; note.hidden = false; } else note.hidden = true;

    scheduleAnnotations(caseData, flowState || "before");
    if (flowState === "after") setFlowState(caseData, "after");
  }

  // ---------- before/after (and case-3 "show response") ----------
  function setFlowState(caseData, state) {
    if (!story) return;
    if (story.mode === "signal") { story.cyc = signalCycle(state); }
    else if (story.mode === "flow") {
      // ~30% fewer cars ENTER after demand management (honest: fewer cars in, not a magic
      // faster road). Hide/show (reversible) rather than destroy.
      const show = state === "after" ? Math.round(story.baseCount * 0.7) : story.baseCount;
      story.cars.forEach((c, i) => {
        c.hidden = i >= show; c.el.style.display = c.hidden ? "none" : "";
        c.speed = state === "after" ? 1 / 17 : 1 / 20;
      });
    } else if (story.mode === "uniform") {
      story.cars.forEach((c) => { c.speed = state === "after" ? 1 / 18 : 1 / 30; });  // same count, faster + better spaced
      story.spread = state === "after" ? 1 / story.n : (1 / story.n) * 0.7;
    } else if (story.mode === "crawl") {
      // case 3: "show response" — patrol appears; annotations already swapped by caller
      if (state === "after") addPatrol(seg("case_3_storm")); else removePatrol();
    }
    swapAnnotations(caseData, state);
  }

  // ---------- staged annotations (Part C) ----------
  function scheduleAnnotations(caseData, state) {
    clearAnnotations();
    const beats = (caseData.annotations && caseData.annotations.beats) || [];
    if (state === "after") { swapAnnotations(caseData, "after"); return; }
    const anchors = annotationAnchors(caseData);
    beats.slice(0, 3).forEach((text, i) => {
      const t = setTimeout(() => addAnnotation(anchors[i] || anchors[anchors.length - 1], text), 1400 + i * 2500);
      annTimers.push(t);
    });
  }
  function swapAnnotations(caseData, state) {
    clearAnnotations();
    if (state !== "after") { scheduleAnnotations(caseData, "before"); return; }
    const after = caseData.annotations && caseData.annotations.after;
    if (after) { const a = annotationAnchors(caseData); addAnnotation(a[1] || a[0], after); }
  }
  function annotationAnchors(caseData) {
    if (Array.isArray(caseData.triage_table)) {
      const top = ["ITT_W1", "ITT_E1", "AIR_W1"].map((id) => D.LOCATION_COORDS[id]).filter(Boolean);
      return top.length ? top : [[55.31, 25.24]];
    }
    const s = seg(activeSegs(caseData)[0]);
    if (!s) return [[55.31, 25.24]];
    return [alongFrac(s, 0.28), alongFrac(s, 0.55), alongFrac(s, 0.82)];
  }
  function addAnnotation(coord, text) {
    if (!coord) return;
    const el = document.createElement("div"); el.className = "annot-card"; el.textContent = text;
    const m = new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat(coord).addTo(map);
    requestAnimationFrame(() => el.classList.add("show"));
    annMarkers.push(m);
  }
  function clearAnnotations() { annTimers.forEach(clearTimeout); annTimers = []; annMarkers.forEach((m) => m.remove()); annMarkers = []; }

  // ---------- storm incidents / patrol ----------
  function addIncidents(s) {
    if (!s) return;
    [0.35, 0.55, 0.72].forEach((f) => {
      const el = document.createElement("div"); el.className = "incident-icon"; el.textContent = "⚠";
      incidentMarkers.push(new mapboxgl.Marker({ element: el }).setLngLat(alongFrac(s, f)).addTo(map));
    });
  }
  function addPatrol(s) { if (!s || patrolMarker) return; const el = document.createElement("div"); el.className = "patrol-icon"; el.textContent = "🚓"; patrolMarker = new mapboxgl.Marker({ element: el }).setLngLat(alongFrac(s, 0.5)).addTo(map); }
  function removePatrol() { if (patrolMarker) { patrolMarker.remove(); patrolMarker = null; } }

  // ---------- cleanup ----------
  function clearStory() {
    document.getElementById("map-note").hidden = true;
    if (story) { clearTimeout(story._panT); story.cars.forEach((c) => c.marker.remove()); story = null; }
    if (signalMarker) { signalMarker.remove(); signalMarker = null; }
    incidentMarkers.forEach((m) => m.remove()); incidentMarkers = [];
    removePatrol();
    clearAnnotations();
  }

  // ---------- Part F: cap + auto-degrade ----------
  function totalCars() { return ambientCars.filter((c) => !c.hidden).length + (story ? story.cars.length : 0); }
  function enforceCap() {
    while (totalCars() > MAX_CARS) {
      const vis = ambientCars.filter((c) => !c.hidden);
      if (!vis.length) break;
      const c = vis[vis.length - 1]; c.hidden = true; c.el.style.display = "none";
    }
  }
  function monitorFps(now, dt) {
    if (dt <= 0) return;
    fpsEMA = fpsEMA * 0.9 + (1 / dt) * 0.1;
    if (fpsEMA < 42) {
      if (!lowSince) lowSince = now;
      else if (now - lowSince > 2000) { degrade(); lowSince = 0; }
    } else lowSince = 0;
  }
  function degrade() {
    // order: reduce ambient → disable 3D → never touch the active story layer
    if (degradeStep === 0) { ambientPerSeg = 1; spawnAmbient(); if (story) dimAmbient(activeSegs({ case_id: story.caseId })); degradeStep = 1; console.info("perf: reduced ambient cars"); }
    else if (degradeStep === 1) { set3D(false); degradeStep = 2; console.info("perf: disabled 3D buildings"); }
  }

  function warn(msg) { const el = document.getElementById("map-token-warning"); if (el) { el.textContent = msg; el.hidden = false; } }

  window.KashfMap = { init, showCase, setFlowState, setTraffic, set3D, trafficAvailable, isReady: () => ready };
})();
