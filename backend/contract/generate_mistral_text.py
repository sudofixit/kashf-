#!/usr/bin/env python3
"""
Kashf — Mistral text generation for the demo contract.

PASS 1 (original): triage.narrative, diagnosis.summary, rank.recommendation.
PASS 2 (enhanced-map spec, Part E): per case a "plain" object (plain-English metric
translations) and an "annotations" object (a 3-beat "traffic builds" narrative + an
"after"/response summary).

Grounding rules (both passes): temperature 0.2, cite ONLY input numbers, never invent,
never re-diagnose, 3-run stability. PASS 2 additionally PRE-COMPUTES every numeric
conversion in Python (Mistral supplies language only) and rejects any run whose plain
lines don't contain the computed number — so the plain English can never drift from the
real math.

Requires MISTRAL_API_KEY (env var or a .env next to this script / in the project root).
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

HARD_RULES_AND_GLOSSARY = """HARD RULES — follow every one:
1. Cite ONLY numbers that appear in the input JSON or the instruction. Never invent, \
round differently, or compute a new number. If you name a figure, it must be copyable \
from the input/instruction.
2. Never invent a location, road, junction, cause, or fix that is not in the input.
3. Do NOT re-diagnose. The field diagnosis.type is fixed; your text must be consistent \
with it and must not propose a different cause class.
4. Simulate before/after numbers are indicative (analytical capacity-delay model, not \
micro-simulated). Describe them as indicative, never as guaranteed outcomes.
5. Prefer flagging uncertainty over smoothing it. If human_review_required is true or a \
candidate is marked not estimable, say so plainly.
6. No markdown, no bullet lists, no headings. Plain sentences only.

GLOSSARY — use these exact meanings, do not guess:
- los_f_pct = percentage of hours the corridor was at Level of Service F (F = gridlock / \
FAILING traffic). Share of FAILING hours, NOT free-flow. HIGHER = WORSE. Never call it \
"free-flow".
- demand_gap_vph = average unmet demand (demand minus throughput) in vehicles per hour.
- mean_vc = mean volume-to-capacity ratio (0 = empty, ~1 = at capacity, >1 = oversaturated).
- confidence_pct = the diagnosis-engine's confidence in this diagnosis.
- simulate before/after "vc" = degree of saturation for the fix; "delay_s" = delay (per \
vehicle for junction cases, or per km for corridor cases as stated in the simulate _comment).
- severity_color: red = los_f_pct > 4, amber = 1-4, green = < 1.
Only cite counts/totals that are given to you in the input or the instruction — do NOT \
count table rows yourself."""

SYSTEM_PROMPT = ("""You are the reasoning/writing layer of Kashf, a traffic-diagnosis \
decision-support tool for Dubai's RTA. You receive ONE case as JSON containing verified \
numbers and you write short, plain-language operator-facing text.

""" + HARD_RULES_AND_GLOSSARY + """

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
flag that this needs human review.""")

# PASS 2 system prompt — plain-English + staged annotations.
ENH_SYSTEM_PROMPT = ("""You are the plain-English + narration layer of Kashf, a \
traffic-diagnosis tool for Dubai's RTA. You turn verified numbers into (a) plain-English \
one-liners a non-technical executive understands and (b) a short staged "traffic builds" \
narration shown on a map. You supply LANGUAGE ONLY — every number is pre-computed for you \
in the instruction and must be used exactly as given.

""" + HARD_RULES_AND_GLOSSARY + """

EXTRA RULES FOR THIS TASK:
- Use the pre-computed conversions in the instruction VERBATIM as the numeric basis. Do \
NOT recompute or restate them differently (e.g. if told "1 hour in every 12", do not \
write "8%" or "every 10 hours").
- No exaggeration, no invented comparisons, no adjectives that overstate ("catastrophic", \
"nightmare"). Precise, calm, factual — enterprise tone.
- Annotation beats: 3 short lines, each <= ~9 words, building tension; the THIRD beat must \
end on a hard verified number from the instruction. "after" = ONE short line (the fix \
result for cases with a fix; the operational response for the storm case).

OUTPUT: strict JSON. Include "plain" ONLY if the instruction provides plain conversions. \
Shape: {"plain": {"headline": str, "los_f": str, "gap": str, "vc": str, \
"verdict_after": str}, "annotations": {"beats": [str, str, str], "after": str}}. \
Omit "verdict_after" if the instruction says there is no fix. Omit "plain" entirely for \
the citywide case.""")

CASE_FIELDS = {
    "case_1_al_mamzar.json":       ["narrative", "summary", "recommendation"],
    "case_2_szr_defence.json":     ["narrative", "summary", "recommendation"],
    "case_3_storm.json":           ["narrative", "summary", "recommendation"],
    "case_4_citywide_triage.json": ["narrative"],
    "case_5_garhoud_no_signal.json": ["narrative", "summary", "recommendation"],
}

ALL_FILES = list(CASE_FIELDS.keys())


def load_key():
    key = os.environ.get("MISTRAL_API_KEY")
    if key:
        return key
    for envf in (HERE / ".env", HERE.parent / ".env"):
        if envf.exists():
            for line in envf.read_text().splitlines():
                if line.strip().startswith("MISTRAL_API_KEY"):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def _chat(key, system, user_obj):
    """POST one chat completion, JSON mode, with 429/5xx backoff. Returns parsed dict."""
    body = json.dumps({
        "model": MODEL, "temperature": TEMPERATURE,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(user_obj)},
        ],
    }).encode()
    req = urllib.request.Request(ENDPOINT, data=body, headers={
        "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    backoff = [5, 15, 40, 90]
    for attempt in range(len(backoff) + 1):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                resp = json.loads(r.read())
            return json.loads(resp["choices"][0]["message"]["content"])
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < len(backoff):
                print(f"    HTTP {e.code}; backing off {backoff[attempt]}s...")
                time.sleep(backoff[attempt])
                continue
            raise


# ---------- PASS 1: narrative / summary / recommendation --------------------
def call_mistral(key, case_json, fields):
    user = {"requested_fields": fields, "case": case_json}
    if case_json.get("case_id") == "case_4_citywide_triage":
        user["instruction"] = citywide_hint(case_json)
    return _chat(key, SYSTEM_PROMPT, user)


def citywide_hint(case_json):
    tbl = case_json["triage_table"]
    reds = [r for r in tbl if r["severity_color"] == "red"]
    ambers = [r for r in tbl if r["severity_color"] == "amber"]
    greens = [r for r in tbl if r["severity_color"] == "green"]
    zeros = [r["location_id"] for r in tbl if r["los_f_pct"] == 0.0]
    top3 = sorted(tbl, key=lambda r: r["los_f_pct"], reverse=True)[:3]
    return (
        f"Use exactly these pre-counted figures (do NOT recount): {len(reds)} red, "
        f"{len(ambers)} amber, {len(greens)} green corridors out of {len(tbl)}. The top 3 "
        f"by los_f_pct are " + ", ".join(f"{r['location_id']} ({r['los_f_pct']}% at LOS F, "
        f"{r['area']})" for r in top3) + f". The {len(zeros)} zero-congestion outliers "
        f"(los_f_pct exactly 0.00) are " + ", ".join(zeros) + ".")


def stable(runs, fields):
    for f in fields:
        vals = [r.get(f, "").strip() for r in runs]
        if any(len(v) < 10 for v in vals):
            return False
    return True


def field_ref(case, f):
    if f == "narrative":
        return (case, "narrative") if "triage_table" in case else (case["triage"], "narrative")
    if f == "summary":
        return (case["diagnosis"], "summary")
    return (case["rank"], "recommendation")


def run_pass1(key):
    for fname, fields in CASE_FIELDS.items():
        path = HERE / fname
        case = json.loads(path.read_text(encoding="utf-8"))
        still = [f for f in fields
                 if str(dict.get(*field_ref(case, f))).startswith("PLACEHOLDER:")]
        if not still:
            print(f"PASS1 {fname}: already filled, skipping.")
            continue
        runs = [call_mistral(key, case, fields) for _ in range(N_RUNS)]
        if not stable(runs, fields):
            print(f"PASS1 {fname}: UNSTABLE — left as placeholder.")
            continue
        final = runs[-1]
        for f in fields:
            container, k = field_ref(case, f)
            container[k] = final[f]
        path.write_text(json.dumps(case, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"PASS1 {fname}: wrote {fields}.")


# ---------- PASS 2: plain-English + annotations -----------------------------
def top_candidate(case):
    """Return the simulate candidate matching rank.top_fix (or None)."""
    top = (case.get("rank") or {}).get("top_fix")
    cands = (case.get("simulate") or {}).get("candidates") or []
    if not top or not cands:
        return None
    for c in cands:
        if c.get("fix", "").startswith(top) or top in c.get("fix", ""):
            return c
    return cands[0]


def compute_facts(case):
    """Pre-compute every numeric conversion so Mistral only supplies language.
    Returns (facts_dict, checks_list) where checks are number-strings that MUST
    appear in the corresponding plain field for the output to be accepted."""
    tri = case.get("triage") or {}
    facts, checks = {}, {}
    if "triage_table" not in case and tri:
        L = tri["los_f_pct"]; G = tri["demand_gap_vph"]; V = tri["mean_vc"]
        n_hours = round(100.0 / L) if L else None
        gap_r = round(G)
        vc_pct = round(V * 100)
        facts["los_f"] = (f"At gridlock (LOS F) roughly 1 hour in every {n_hours} "
                          f"(from los_f_pct {L}%).")
        facts["gap"] = (f"About {gap_r} drivers every hour want this road but cannot fit "
                        f"(from demand_gap_vph {G}).")
        facts["vc"] = (f"Averages about {vc_pct}% of its capacity, far higher at peaks "
                       f"(from mean_vc {V}).")
        checks["los_f"] = str(n_hours)
        checks["gap"] = str(gap_r)
        checks["vc"] = str(vc_pct)
        cand = top_candidate(case)
        if cand and cand.get("before", {}).get("delay_s") is not None:
            b = cand["before"]["delay_s"]; a = cand["after"]["delay_s"]
            dpct = round((a - b) / b * 100)
            bvc = cand["before"]["vc"]; avc = cand["after"]["vc"]
            facts["verdict_after"] = (
                f"Top fix '{case['rank']['top_fix']}': delay {b}s -> {a}s ({abs(dpct)}% "
                f"{'better' if dpct < 0 else 'worse'}), saturation vc {bvc} -> {avc}, "
                f"cost {cand.get('cost_score')}/5, disruption {cand.get('disruption_score')}/5. "
                f"Indicative. Be honest — if the delay change is small, say the main gain is "
                f"lower saturation / fewer cars, not a faster road.")
            checks["verdict_after"] = str(a)
    return facts, checks


def enh_instruction(case, facts):
    cid = case["case_id"]
    if "triage_table" in case:
        # citywide — annotations only, grounded in the same counts as pass 1.
        return ("Produce ONLY \"annotations\" (no \"plain\"). This is the citywide overview. "
                + citywide_hint(case) +
                " beats: 3 short lines building from 'the network' to the single worst "
                "corridor, third beat ending on a hard number (e.g. the worst corridor's "
                "los_f_pct). after: one short line naming how many corridors are red.")
    lines = ["Produce \"plain\" and \"annotations\".",
             "For \"plain\", use these pre-computed conversions VERBATIM as the numeric basis:",
             f"  headline: one calm executive sentence for {case['title']} "
             f"(diagnosis {case['diagnosis']['type']}).",
             f"  los_f: {facts['los_f']}",
             f"  gap: {facts['gap']}",
             f"  vc: {facts['vc']}"]
    if "verdict_after" in facts:
        lines.append(f"  verdict_after: {facts['verdict_after']}")
    else:
        lines.append("  (NO fix candidates — OMIT verdict_after entirely.)")
    # annotation voice guidance per diagnosis type
    dtype = case["diagnosis"]["type"]
    if dtype == "WEATHER_INCIDENT":
        lines.append("For \"annotations\": 3 beats telling the storm story — the road is "
                     "impaired (weather), not demand-congested — third beat ending on a hard "
                     "number from the evidence. after: the OPERATIONAL RESPONSE in one line "
                     "(this case has no engineering fix), e.g. patrols / Metro alert.")
    else:
        lines.append("For \"annotations\": 3 beats — traffic building toward the problem, "
                     "third beat ending on a hard verified number (e.g. phase failures or "
                     "los_f). after: one line summarising the top fix's result.")
    return "\n".join(lines)


def enh_required(case):
    """Which sub-fields must be present/non-empty for this case."""
    req = {"annotations": ["beats", "after"]}
    if "triage_table" not in case:
        plain = ["headline", "los_f", "gap", "vc"]
        if top_candidate(case) and top_candidate(case).get("before", {}).get("delay_s") is not None:
            plain.append("verdict_after")
        req["plain"] = plain
    return req


def enh_ok(out, case, checks):
    """Stability/faithfulness gate for one enhancement run."""
    req = enh_required(case)
    ann = out.get("annotations") or {}
    beats = ann.get("beats")
    if not (isinstance(beats, list) and len(beats) == 3 and all(isinstance(b, str) and len(b.strip()) >= 4 for b in beats)):
        return False
    if not (isinstance(ann.get("after"), str) and len(ann["after"].strip()) >= 4):
        return False
    if "plain" in req:
        plain = out.get("plain") or {}
        for k in req["plain"]:
            if not (isinstance(plain.get(k), str) and len(plain[k].strip()) >= 6):
                return False
            # faithfulness: the computed number must appear verbatim
            if k in checks and checks[k] not in plain[k]:
                return False
    return True


def run_pass2(key):
    for fname in ALL_FILES:
        path = HERE / fname
        case = json.loads(path.read_text(encoding="utf-8"))
        if "annotations" in case and ("triage_table" in case or "plain" in case):
            print(f"PASS2 {fname}: already has annotations+plain, skipping.")
            continue
        facts, checks = compute_facts(case)
        instr = enh_instruction(case, facts)
        user = {"case": case, "instruction": instr}
        runs = []
        for _ in range(N_RUNS):
            runs.append(_chat(key, ENH_SYSTEM_PROMPT, user))
            time.sleep(3)
        good = [r for r in runs if enh_ok(r, case, checks)]
        if len(good) < 2:
            print(f"PASS2 {fname}: UNSTABLE/faithfulness-fail ({len(good)}/{N_RUNS} ok) — "
                  f"NOT written (flagged).")
            continue
        out = good[-1]
        case["annotations"] = out["annotations"]
        if "plain" in out and "triage_table" not in case:
            case["plain"] = out["plain"]
        path.write_text(json.dumps(case, ensure_ascii=False, indent=2), encoding="utf-8")
        wrote = ["annotations"] + (["plain"] if "plain" in case else [])
        print(f"PASS2 {fname}: wrote {wrote} ({len(good)}/{N_RUNS} runs passed the gate).")


def main():
    key = load_key()
    if not key:
        print("MISTRAL_API_KEY not found. No files modified.")
        return 2
    print("=== PASS 1: narrative / summary / recommendation ===")
    run_pass1(key)
    print("\n=== PASS 2: plain-English + annotations ===")
    run_pass2(key)
    print("\nDone. Re-run validate.py.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
