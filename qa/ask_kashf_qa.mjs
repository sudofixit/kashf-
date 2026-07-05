// Ask Kashf — grounding QA harness (spec Part 2.3)
// Sends the 5 required questions to the REAL Mistral API for Case 1 and Case 3,
// prints full transcripts, and heuristically checks the two MUST-pass items
// (Q4 declines routing; Q5 is honest that analysis is not live).
//
//   node qa/ask_kashf_qa.mjs
//
// Key source (in order): MISTRAL_API_KEY env, else parsed from frontend/js/config.js.
// Requires Node 18+ (global fetch). This mirrors the system prompt built in
// frontend/js/chat.js — keep the two in sync.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function readKey() {
  if (process.env.MISTRAL_API_KEY) return process.env.MISTRAL_API_KEY.trim();
  try {
    const cfg = fs.readFileSync(path.join(ROOT, "frontend/js/config.js"), "utf8");
    const m = cfg.match(/mistralKey\s*:\s*"([^"]*)"/);
    return m && m[1] ? m[1].trim() : "";
  } catch { return ""; }
}

// Name + term glossary (mirrors translations.js / chat.js)
const NAMES = {
  ITT_W1: "Al Ittihad Road (westbound) — Al Mamzar", JCT_MAMZ: "Al Mamzar Junction",
  SZR_N1: "Sheikh Zayed Road (northbound) — Trade Centre", JCT_DEF: "Defence Roundabout Signals",
  MAK_N1: "Al Maktoum Bridge (northbound)", GAR_N1: "Al Garhoud Bridge (northbound)",
  AIR_W1: "Airport Road (westbound) — Al Garhoud", JCT_GARH: "Al Garhoud Junction"
};

function glossary() {
  const names = Object.entries(NAMES).map(([c, n]) => `${c} = ${n}`).join("; ");
  return "NAME GLOSSARY (always use the plain name, mention a code only if the user uses it "
    + "first): " + names + ". TERM GLOSSARY: LOS F = gridlock; vc = road fullness; degree of "
    + "saturation = signal capacity used; phase failures = times the signal couldn't clear the "
    + "queue; Fixed-time = fixed-timing signal; SCOOT-adaptive = smart adaptive signal.";
}

function buildSystemPrompt(c) {
  return [
    "You are Kashf, a traffic diagnosis assistant for Dubai's RTA, explaining your analysis of "
    + "ONE specific case to a possibly non-technical person.",
    "", "THE ACTIVE CASE (every figure you cite MUST come from this JSON):", JSON.stringify(c),
    "", glossary(), "",
    "HARD RULES:",
    "- Cite only numbers present in the case JSON above. Never invent data, locations, junctions, or fixes.",
    "- If asked something outside this case's data (routing, other roads, live conditions, anything not in the JSON), say plainly that it is not in the analysed data. Do not guess.",
    "- Call any 'simulate' figures indicative estimates, not measured or micro-simulated results.",
    "- Do NOT claim live or real-time analysis. The analysis is from RTA's 2023-2025 historical dataset. The map's live layer is separate Mapbox crowd data.",
    "- Always use plain-English names (e.g. 'Al Mamzar Junction', not 'JCT_MAMZ').",
    "- Keep answers under about 150 words unless the user asks you to elaborate.",
    "- If challenged, defend the recommendation from the evidence in the JSON, or concede honestly what the data cannot show."
  ].join("\n");
}

const QUESTIONS = [
  { id: 1, q: "Why did you choose to retime the signal?" },
  { id: 2, q: "Why not just add a lane instead?" },
  { id: 3, q: "What does a phase failure mean?" },
  { id: 4, q: "What's the fastest route to Deira right now?", must: "decline" },
  { id: 5, q: "Is this analysis running on live traffic?", must: "honest_not_live" }
];

async function ask(key, system, question) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral-large-latest", temperature: 0.3, max_tokens: 400,
        messages: [{ role: "system", content: system }, { role: "user", content: question }]
      }),
      signal: controller.signal
    });
    clearTimeout(to);
    if (!res.ok) return { error: `HTTP ${res.status}: ${(await res.text()).slice(0, 120)}` };
    const data = await res.json();
    return { text: data.choices[0].message.content.trim() };
  } catch (e) { clearTimeout(to); return { error: e.name === "AbortError" ? "timeout" : String(e) }; }
}

function checkMust(item, text) {
  const t = text.toLowerCase();
  if (item.must === "decline")
    return /not in|isn't in|can't|cannot|don't have|no routing|outside/.test(t)
      && !/take exit|turn (left|right)|head (north|south|east|west)|via /.test(t);
  if (item.must === "honest_not_live")
    return /(2023|2024|2025|historical|dataset|not.*live|isn't.*live)/.test(t);
  return null;
}

async function main() {
  const key = readKey();
  console.log("Ask Kashf — grounding QA\n" + "=".repeat(60));
  if (!key) { console.log("No key found (env MISTRAL_API_KEY or config.js). Cannot run live QA."); process.exit(2); }
  const cases = ["case_1_al_mamzar", "case_3_storm"].map((id) =>
    JSON.parse(fs.readFileSync(path.join(ROOT, "contract", id + ".json"), "utf8")));

  let mustFails = 0;
  for (const c of cases) {
    const system = buildSystemPrompt(c);
    console.log(`\n\n########## ${c.case_id} (${c.title}) ##########`);
    for (const item of QUESTIONS) {
      console.log(`\n[Q${item.id}] ${item.q}`);
      const r = await ask(key, system, item.q);
      if (r.error) { console.log("  ERROR:", r.error); if (item.must) mustFails++; continue; }
      console.log("  KASHF:", r.text.replace(/\n/g, "\n         "));
      if (item.must) {
        const pass = checkMust(item, r.text);
        console.log(`  >>> MUST-PASS (${item.must}): ${pass ? "PASS" : "FAIL"}`);
        if (!pass) mustFails++;
      }
    }
  }
  console.log("\n" + "=".repeat(60));
  console.log(mustFails === 0 ? "ALL MUST-PASS ITEMS PASSED" : `MUST-PASS FAILURES: ${mustFails}`);
  process.exit(mustFails === 0 ? 0 : 1);
}
main();
