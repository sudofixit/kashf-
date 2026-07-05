#!/usr/bin/env python3
"""
Validator for the Kashf demo JSON contract.

Checks that every case_*.json file:
  1. parses as JSON,
  2. conforms to the shared schema (case_schema.json) — required fields present,
     correct high-level shape, case-4 triage_table and case-2 secondary_corridor
     handled as documented deviations,
  3. has a consistent `status` (must be "partial" while any placeholder remains,
     "verified" only when all placeholders are filled),
and lists every field still holding a placeholder value.

A placeholder is any string beginning with "PLACEHOLDER:". Run from anywhere; it
resolves paths relative to this file.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

CASE_FILES = [
    "case_1_al_mamzar.json",
    "case_2_szr_defence.json",
    "case_3_storm.json",
    "case_4_citywide_triage.json",
    "case_5_garhoud_no_signal.json",
]

# Required paths for a standard (single-corridor) case.
STANDARD_REQUIRED = [
    "case_id", "title", "status",
    "map.corridor_id", "map.junction_id", "map.route_anchors",
    "map.junction_point", "map.severity_color",
    "triage.rank", "triage.los_f_pct", "triage.demand_gap_vph",
    "triage.mean_vc", "triage.narrative",
    "diagnosis.type", "diagnosis.summary", "diagnosis.evidence",
    "diagnosis.confidence_pct", "diagnosis.human_review_required",
    "simulate.method", "simulate.method_label", "simulate.candidates",
    "rank.recommendation", "rank.top_fix",
    "flow_animation.before", "flow_animation.after",
]

# Required paths for the citywide (case 4) deviation.
CITYWIDE_REQUIRED = ["case_id", "title", "status", "triage_table"]

TRIAGE_ROW_KEYS = {"location_id", "area", "los_f_pct", "demand_gap_vph",
                   "mean_vc", "severity_color"}


def get_path(obj, dotted):
    cur = obj
    for part in dotted.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return (False, None)
        cur = cur[part]
    return (True, cur)


def is_placeholder(v):
    return isinstance(v, str) and v.startswith("PLACEHOLDER:")


def find_placeholders(obj, prefix=""):
    """Recursively yield dotted paths of every placeholder string."""
    out = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            out += find_placeholders(v, f"{prefix}.{k}" if prefix else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            out += find_placeholders(v, f"{prefix}[{i}]")
    elif is_placeholder(obj):
        out.append(prefix)
    return out


def expected_color(los):
    if los > 4:
        return "red"
    if los >= 1:
        return "amber"
    return "green"


def validate_file(path):
    errors = []
    with open(path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            return None, [f"JSON parse error: {e}"], []

    is_citywide = "triage_table" in data
    required = CITYWIDE_REQUIRED if is_citywide else STANDARD_REQUIRED
    for r in required:
        ok, _ = get_path(data, r)
        if not ok:
            errors.append(f"missing required field: {r}")

    # status enum
    status = data.get("status")
    if status not in ("partial", "verified"):
        errors.append(f"status must be 'partial' or 'verified', got {status!r}")

    # citywide table checks
    if is_citywide:
        table = data.get("triage_table", [])
        if not isinstance(table, list):
            errors.append("triage_table must be a list")
        else:
            if len(table) != 18:
                errors.append(f"triage_table should have 18 corridors, has {len(table)}")
            for i, row in enumerate(table):
                missing = TRIAGE_ROW_KEYS - set(row)
                if missing:
                    errors.append(f"triage_table[{i}] missing keys: {sorted(missing)}")
                    continue
                exp = expected_color(row["los_f_pct"])
                if row["severity_color"] != exp:
                    errors.append(
                        f"triage_table[{i}] ({row['location_id']}): severity_color "
                        f"{row['severity_color']!r} inconsistent with los_f_pct "
                        f"{row['los_f_pct']} (expected {exp!r})")

    # secondary_corridor (case 2) shape check, if present
    if "secondary_corridor" in data:
        sc = data["secondary_corridor"]
        for k in ("corridor_id", "los_f_pct", "demand_gap_vph", "mean_vc",
                  "pair_distance_km"):
            if k not in sc:
                errors.append(f"secondary_corridor missing key: {k}")

    placeholders = find_placeholders(data)

    # status consistency
    if placeholders and status == "verified":
        errors.append("status is 'verified' but placeholders still remain")
    if not placeholders and status == "partial":
        errors.append("no placeholders remain but status is still 'partial' "
                      "(should flip to 'verified')")

    return data, errors, placeholders


def main():
    all_ok = True
    total_placeholders = 0
    print("=" * 70)
    print("Kashf JSON contract validation")
    print("=" * 70)
    for fname in CASE_FILES:
        path = HERE / fname
        print(f"\n### {fname}")
        if not path.exists():
            print("  ERROR: file not found")
            all_ok = False
            continue
        data, errors, placeholders = validate_file(path)
        if errors:
            all_ok = False
            print(f"  SCHEMA: FAIL ({len(errors)} issue(s))")
            for e in errors:
                print(f"    - {e}")
        else:
            print(f"  SCHEMA: OK   (status={data.get('status')})")
        total_placeholders += len(placeholders)
        if placeholders:
            print(f"  PLACEHOLDERS ({len(placeholders)} still pending):")
            for p in placeholders:
                print(f"    - {p}")
        else:
            print("  PLACEHOLDERS: none")

    print("\n" + "=" * 70)
    print(f"RESULT: {'ALL FILES CONFORM' if all_ok else 'SCHEMA ISSUES FOUND'} | "
          f"{total_placeholders} placeholder field(s) across {len(CASE_FILES)} files")
    print("=" * 70)
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
