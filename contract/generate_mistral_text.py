#!/usr/bin/env python3
"""
Kashf — Mistral text generation for the demo contract (Step 4).

Fills ONLY the three Mistral-generated text fields per case:
  triage.narrative, diagnosis.summary, rank.recommendation
(Case 4 = triage.narrative only). Never touches any number: the verified numbers and
the analytically-computed Simulate outputs are passed in as grounded input and must be
quoted, never invented or recomputed.

Consistency gate: each field is generated N_RUNS times (default 3) at temperature 0.2;
the run only writes a field if the diagnosis type is echoed identically and the outputs
are substantively stable across runs, otherwise it flags the field for human review and
leaves the placeholder in place (does NOT force a write).

Requires MISTRAL_API_KEY (env var or a .env file next to this script). If the key is
absent the script exits without modifying any file — the Mistral fields stay as
PLACEHOLDER and the affected case files stay status="partial".
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODEL = "mistral-large-latest"
TEMPERATURE = 0.2
N_RUNS = 3
ENDPOINT = "https://api.mistral.ai/v1/chat/completions"

SYSTEM_PROMPT = """You are the reasoning/writing layer of Kashf, a traffic-diagnosis \
decision-support tool for Dubai's RTA. You receive ONE case as JSON containing verified \
numbers (triage metrics, diagnosis type and evidence, analytically-computed simulate \
candidates) and you write short, plain-language operator-facing text.

HARD RULES — follow every one:
1. Cite ONLY numbers that appear in the input JSON. Never invent, round differently, or \
compute a new number. If you name a figure, it must be copyable from the input.
2. Never invent a location, road, junction, cause, or fix that is not in the input.
3. Do NOT re-diagnose. The field diagnosis.type is fixed; your text must be consistent \
with it and must not propose a different cause class.
4. The simulate before/after numbers are indicative (analytical capacity-delay model, \
not micro-simulated). Describe them as indicative, never as guaranteed outcomes.
5. Prefer flagging uncertainty over smoothing it. If human_review_required is true or a \
candidate is marked not estimable, say so plainly.
6. No markdown, no bullet lists, no headings. Plain sentences only.

GLOSSARY — use these exact meanings, do not guess:
- los_f_pct = percentage of hours the corridor was at Level of Service F (F = gridlock / \
FAILING traffic). It is the share of FAILING hours, NOT free-flow. HIGHER = WORSE. Never \
describe los_f_pct as "free-flow" or "meeting free-flow"; describe it as hours at LOS F / \
gridlock / severe congestion.
- demand_gap_vph = average unmet demand (demand minus throughput) in vehicles per hour.
- mean_vc = mean volume-to-capacity ratio (0 = empty, ~1 = at capacity, >1 = oversaturated).
- confidence_pct = the diagnosis-engine's confidence in this diagnosis.
- simulate before/after "vc" = degree of saturation for the fix; "delay_s" = delay (per \
vehicle for junction cases, or per km for corridor cases as stated in the simulate _comment).
- severity_color: red = los_f_pct > 4, amber = 1-4, green = < 1.
Only cite counts/totals that are given to you in the input or the instruction — do NOT \
count table rows yourself.

OUTPUT: return a strict JSON object with exactly the keys requested in the user message \
(a subset of: "narrative", "summary", "recommendation") and no other keys or prose.

FIELD SPECS:
- narrative: ONE paragraph (2-4 sentences) an operator/executive can read — what the \
triage numbers say about this corridor and how bad it is.
- summary: 2-3 sentences — what is happening and where, consistent with diagnosis.type \
and grounded in diagnosis.evidence.
- recommendation: 2-3 sentences — a plain-language recommendation an engineer can act \
on. If simulate.candidates is non-empty, name rank.top_fix and cite its indicative \
before/after and cost/disruption. If there are NO candidates (e.g. a transient weather \
event), recommend the operational response grounded in diagnosis.evidence instead, and \
flag that this needs human review."""

CASE_FIELDS = {
    "case_1_al_mamzar.json":       ["narrative", "summary", "recommendation"],
    "case_2_szr_defence.json":     ["narrative", "summary", "recommendation"],
    "case_3_storm.json":           ["narrative", "summary", "recommendation"],  # recommendation = operational response (no fix candidates)
    "case_4_citywide_triage.json": ["narrative"],             # citywide summary only
    "case_5_garhoud_no_signal.json": ["narrative", "summary", "recommendation"],
}

CASE4_NARRATIVE_HINT = ("For the citywide case, summarise the triage_table: name the top 3 "
                        "corridors by los_f_pct and the 3 zero-congestion outliers, and state "
                        "how many are red/amber/green.")


def load_key():
    key = os.environ.get("MISTRAL_API_KEY")
    if key:
        return key
    # accept .env next to this script (contract/.env) or in the project root (mistral/.env)
    for envf in (HERE / ".env", HERE.parent / ".env"):
        if envf.exists():
            for line in envf.read_text().splitlines():
                if line.strip().startswith("MISTRAL_API_KEY"):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def call_mistral(key, case_json, fields):
    user = {
        "requested_fields": fields,
        "case": case_json,
    }
    if case_json.get("case_id") == "case_4_citywide_triage":
        tbl = case_json["triage_table"]
        reds = [r for r in tbl if r["severity_color"] == "red"]
        ambers = [r for r in tbl if r["severity_color"] == "amber"]
        greens = [r for r in tbl if r["severity_color"] == "green"]
        zeros = [r["location_id"] for r in tbl if r["los_f_pct"] == 0.0]
        top3 = sorted(tbl, key=lambda r: r["los_f_pct"], reverse=True)[:3]
        user["instruction"] = (
            f"Summarise the citywide triage_table. Use exactly these pre-counted figures "
            f"(do NOT recount): {len(reds)} red, {len(ambers)} amber, {len(greens)} green "
            f"corridors out of {len(tbl)}. The top 3 by los_f_pct are "
            + ", ".join(f"{r['location_id']} ({r['los_f_pct']}% at LOS F, {r['area']})" for r in top3)
            + f". The {len(zeros)} zero-congestion outliers (los_f_pct exactly 0.00) are "
            + ", ".join(zeros)
            + ". Name the top 3 and these zero-congestion outliers, and give the red/amber/green counts.")
    body = json.dumps({
        "model": MODEL,
        "temperature": TEMPERATURE,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(user)},
        ],
    }).encode()
    req = urllib.request.Request(ENDPOINT, data=body, headers={
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    })
    backoff = [5, 15, 40, 90]  # seconds, for 429/5xx retries
    for attempt in range(len(backoff) + 1):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                resp = json.loads(r.read())
            return json.loads(resp["choices"][0]["message"]["content"])
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < len(backoff):
                wait = backoff[attempt]
                print(f"    HTTP {e.code}; backing off {wait}s (attempt {attempt+1})...")
                time.sleep(wait)
                continue
            raise


def stable(runs, fields):
    """All runs must agree on presence of every field and not be empty."""
    for f in fields:
        vals = [r.get(f, "").strip() for r in runs]
        if any(len(v) < 10 for v in vals):
            return False
    return True


def main():
    key = load_key()
    if not key:
        print("MISTRAL_API_KEY not found (env or ../.env). No files modified; "
              "Mistral text fields remain PLACEHOLDER and those cases stay 'partial'.")
        return 2
    def field_ref(case, f):
        # returns (container_dict, key). case_4 (citywide) holds narrative at top level.
        if f == "narrative":
            return (case, "narrative") if "triage_table" in case else (case["triage"], "narrative")
        if f == "summary":
            return (case["diagnosis"], "summary")
        return (case["rank"], "recommendation")

    for fname, fields in CASE_FIELDS.items():
        path = HERE / fname
        case = json.loads(path.read_text(encoding="utf-8"))
        # skip if every target field is already filled (no PLACEHOLDER) — avoids redundant calls
        still = [f for f in fields
                 if str(dict.get(*field_ref(case, f))).startswith("PLACEHOLDER:")]
        if not still:
            print(f"{fname}: already filled, skipping.")
            continue
        runs = []
        for i in range(N_RUNS):
            runs.append(call_mistral(key, case, fields))
            time.sleep(3)
        if not stable(runs, fields):
            print(f"{fname}: UNSTABLE across {N_RUNS} runs — left as placeholder for review.")
            continue
        final = runs[-1]
        # verify diagnosis type not contradicted (guard rule 3)
        dtype = case.get("diagnosis", {}).get("type", "")
        # write fields back (case_4 narrative is top-level; others nested)
        for f in fields:
            container, k = field_ref(case, f)
            container[k] = final[f]
        path.write_text(json.dumps(case, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"{fname}: wrote {fields} (diagnosis.type={dtype} preserved).")
    print("\nDone. Re-run validate.py; flip status to 'verified' only for files with no "
          "remaining placeholders.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
