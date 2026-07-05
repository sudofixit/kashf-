#!/usr/bin/env node
/**
 * Bake real road geometry into the Kashf contract JSON files using the
 * token-free public OSRM API (router.project-osrm.org).
 *
 * For each case (excluding the citywide case_4 which has no route_anchors),
 * this script fetches the full driving route between each route_anchors pair
 * and writes the resulting GeoJSON coordinate array as a new sibling field:
 *   map.route_geometry              — primary corridor
 *   secondary_corridor.route_geometry — case 2 secondary corridor (when present)
 *
 * Existing fields are preserved; only the new *_geometry fields are added.
 * Failed OSRM calls are skipped gracefully (field left absent, no crash).
 *
 * Usage:  node scripts/bake_routes.mjs
 * Requires Node 18+ (global fetch).
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACT_DIR = resolve(__dirname, "../contract");

const CASE_FILES = [
  "case_1_al_mamzar.json",
  "case_2_szr_defence.json",
  "case_3_storm.json",
  "case_4_citywide_triage.json",
  "case_5_garhoud_no_signal.json",
];

/**
 * Call OSRM public API and return a GeoJSON coordinate array ([lng,lat][])
 * for the route between anchors[0] and anchors[1], or null on any failure.
 */
async function fetchOSRM(anchors, label) {
  const [a, b] = anchors;
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${a[0]},${a[1]};${b[0]},${b[1]}?geometries=geojson&overview=full`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const coords =
      j.routes && j.routes[0] && j.routes[0].geometry && j.routes[0].geometry.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) throw new Error("no usable coordinates returned");
    console.log(`  [OK]   ${label}: ${coords.length} points`);
    return coords;
  } catch (e) {
    clearTimeout(timer);
    console.warn(`  [SKIP] ${label}: ${e.message}`);
    return null;
  }
}

async function processCaseFile(filename) {
  const path = resolve(CONTRACT_DIR, filename);
  const raw = readFileSync(path, "utf-8");
  const data = JSON.parse(raw);

  // case_4 has no route_anchors — nothing to bake
  if (data.triage_table) {
    console.log(`${filename}: citywide case — skipped.`);
    return;
  }

  console.log(`\n${filename}:`);
  let modified = false;

  // Primary corridor
  if (Array.isArray(data.map?.route_anchors) && data.map.route_anchors.length >= 2) {
    const coords = await fetchOSRM(
      data.map.route_anchors,
      `${data.case_id} → map.route_geometry`
    );
    if (coords) {
      data.map.route_geometry = coords;
      modified = true;
    }
  }

  // Secondary corridor (case_2_szr_defence)
  if (
    data.secondary_corridor &&
    Array.isArray(data.secondary_corridor.route_anchors) &&
    data.secondary_corridor.route_anchors.length >= 2
  ) {
    const coords = await fetchOSRM(
      data.secondary_corridor.route_anchors,
      `${data.case_id} → secondary_corridor.route_geometry`
    );
    if (coords) {
      data.secondary_corridor.route_geometry = coords;
      modified = true;
    }
  }

  if (modified) {
    writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
    console.log(`  Wrote ${filename}`);
  } else {
    console.log(`  No changes (all OSRM calls failed or skipped).`);
  }
}

async function main() {
  console.log("=== bake_routes.mjs — OSRM geometry bake ===\n");
  for (const f of CASE_FILES) {
    await processCaseFile(f);
  }
  console.log("\n=== Done ===");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
