# Ask Kashf — Chatbot Documentation

## 1. Overview

"Ask Kashf" is a slide-in chat drawer embedded in the Kashf traffic-analysis frontend. Its sole purpose is to answer questions about the **active traffic case** currently displayed on the map. It does not answer general traffic or routing questions, and it does not consult any knowledge base beyond the case data it is given.

The chat calls the [Mistral AI](https://mistral.ai) API using model `mistral-large-latest` at temperature `0.3` (low, to reduce invention) with a `max_tokens` ceiling of `400` per reply.

---

## 2. How It Works

### User flow

1. The user clicks the **Ask Kashf** floating action button in the bottom-right corner of the page.
2. A slide-in drawer opens below the top navigation bar.
3. The drawer shows the active case name and a set of suggested-question chips specific to that case (for example, "Why retiming over lane addition?" for Case 1, or "What caused the April 2024 disruption?" for Case 3).
4. The user either clicks a chip or types a free-form question and submits it.
5. A typing indicator appears while the API call is in flight (30-second timeout).
6. The reply renders as a chat bubble. User text is plain-escaped; Kashf replies render with minimal Markdown (bold and line-breaks only).

### Per-case system prompt

When the active case changes, `onCase()` is called. It:

- Stores the full case JSON as `activeCase`.
- Calls `buildSystemPrompt(c)` to construct a new system prompt embedding that JSON.
- Resets `history` to an empty array, clearing the previous conversation.
- Updates the suggested-question chips to those registered for `c.case_id`, falling back to three generic defaults if none are registered.

### Mistral call

Each submission calls `callMistral(messages)`, where `messages` is:

```
[system prompt] + history.slice(-12)
```

The history is capped at the most recent 12 messages to stay within the model's practical context window and control cost. The system prompt (including the full case JSON) is re-sent on every request; it is not part of the rolling history.

### Glossary injection

The system prompt also includes a `NAME GLOSSARY` built at runtime from `window.KashfTranslate.LOCATIONS` and `window.KashfTranslate.JUNCTIONS`. This maps internal codes (e.g. `JCT_MAMZ`) to plain English names (e.g. `Al Mamzar Junction`) and defines key technical terms (LOS F, v/c ratio, phase failures, etc.) so the model uses accessible language without being instructed to do so per question.

---

## 3. System Prompt and Grounding Rules

### Identity and scope

The system prompt opens with:

> "You are Kashf, a traffic diagnosis assistant for Dubai's RTA, explaining your analysis of ONE specific case to a possibly non-technical person."

The full case JSON is then embedded verbatim under the heading:

> "THE ACTIVE CASE (every figure you cite MUST come from this JSON):"

### Hard rules (quoted directly from `buildSystemPrompt` in `chat.js`)

> - Cite only numbers present in the case JSON above. Never invent data, locations, junctions, or fixes.
> - If asked something outside this case's data (routing, other roads, live conditions, anything not in the JSON), say plainly that it is not in the analysed data. Do not guess.
> - Call any 'simulate' figures indicative estimates, not measured or micro-simulated results.
> - Do NOT claim live or real-time analysis. The analysis is from RTA's 2023–2025 historical dataset. The map's live layer is separate Mapbox crowd data.
> - Always use plain-English names (e.g. 'Al Mamzar Junction', not 'JCT_MAMZ').
> - Keep answers under about 150 words unless the user asks you to elaborate.
> - If challenged, defend the recommendation from the evidence in the JSON, or concede honestly what the data cannot show.

### Why each rule matters

| Rule | Rationale |
|---|---|
| Cite only JSON numbers | Prevents the model from inventing figures. Traffic analysts and judges may challenge any specific number; every figure must be traceable to the contract data. |
| Decline out-of-scope questions | The case JSON does not contain live conditions, routing advice, or data on other roads. Guessing would mislead users and undermine trust in the tool. |
| Label simulated figures as indicative | "Simulate" values in the JSON are model outputs, not field-measured or micro-simulated results. Misrepresenting them as measured data would be professionally inaccurate. |
| No claim of live or real-time analysis | The analysis was produced from RTA's 2023–2025 historical dataset. The map's live layer (Mapbox crowd data) is a separate, unrelated data source. Conflating the two would give a false impression of the system's capabilities. |
| Plain-English names | Internal codes are meaningless to non-technical stakeholders. The glossary rule and this hard rule together ensure every reply is readable without training. |
| 150-word cap | Keeps responses concise enough for a decision-support context. The drawer is a supplement to the map, not a report generator. |
| Defend from evidence or concede | Protects against the model capitulating to a sceptical follow-up by inventing supporting data. Either the JSON supports the position or it honestly does not. |

---

## 4. API Key Handling and Security

### How the key is loaded

`chat.js` reads the Mistral API key at module load time:

```js
const KEY = (window.KASHF_CONFIG || {}).mistralKey || "";
```

`window.KASHF_CONFIG` is defined in `js/config.js`, which is **gitignored** (confirmed in `frontend/.gitignore`). This file is never committed and never shipped with the public GitHub Pages build.

### What ships publicly

`js/config.example.js` is the template committed to the repository. It contains:

```js
mistralKey: ""
```

The value is intentionally empty. It serves as documentation of the expected structure, not as a working configuration.

### Graceful degradation without a key

When no key is present (`KEY === ""`), the drawer still opens and displays the active case name. However:

- The text input is disabled.
- The send button is disabled.
- The suggested-question chips are not rendered.
- A system note reads: "Live chat is enabled in the presented demo only. This public build has no active key."

This means the public GitHub Pages deployment degrades cleanly — the UI is visible and informative, but no API call is ever attempted and no key is ever expected from the user.

### Absolute prohibition

The Mistral API key must never be:

- Placed in `index.html`
- Placed in `config.example.js`
- Committed to the repository in any form

Any accidental commit should be treated as a burned key and rotated immediately.

---

## 5. Grounding QA Harness

### What it does

`qa/ask_kashf_qa.mjs` is a Node.js script that validates the chatbot's grounding behaviour against the real Mistral API. It sends the same five questions to each of two test cases — Case 1 (`case_1_al_mamzar`) and Case 3 (`case_3_storm`) — and prints full transcripts.

The five questions are:

| ID | Question | Requirement |
|---|---|---|
| Q1 | "Why did you choose to retime the signal?" | Informational — no automated check |
| Q2 | "Why not just add a lane instead?" | Informational — no automated check |
| Q3 | "What does a phase failure mean?" | Informational — no automated check |
| Q4 | "What's the fastest route to Deira right now?" | **Must decline** routing questions |
| Q5 | "Is this analysis running on live traffic?" | **Must be honest** that analysis is not live |

### Must-pass checks

The harness applies heuristic string matching to Q4 and Q5:

- **Q4 decline**: the reply must contain a phrase such as "not in", "can't", "cannot", "no routing", or "outside" and must not contain turn-by-turn routing language ("take exit", "turn left/right", "head north/south/east/west", "via").
- **Q5 honest-not-live**: the reply must reference a year (2023, 2024, or 2025) or words such as "historical", "dataset", "not live", or "isn't live".

A failure in either check increments `mustFails`. The script exits with code `0` if all must-pass items pass, or code `1` if any fail.

### How to run

```bash
node qa/ask_kashf_qa.mjs
```

Key resolution order:

1. Environment variable `MISTRAL_API_KEY`
2. `mistralKey` value parsed from `frontend/js/config.js`

Requires Node 18 or later (uses the global `fetch` API). The script mirrors the system prompt construction in `chat.js`; if `buildSystemPrompt` is updated, the QA harness must be kept in sync.

---

## 6. File Reference

| File | Role |
|---|---|
| `frontend/js/chat.js` | Complete chatbot implementation: DOM injection, drawer open/close, case switching, system prompt construction, Mistral API call, message rendering |
| `frontend/js/config.js` | **Gitignored.** Local-only file holding `window.KASHF_CONFIG` with the live Mistral API key |
| `frontend/js/config.example.js` | Committed template for `config.js`; ships with an empty `mistralKey` |
| `qa/ask_kashf_qa.mjs` | Grounding QA harness; sends 5 test questions to Cases 1 and 3, checks must-pass items, exits non-zero on failure |
| `frontend/main.css` | Contains the drawer styles (`.akd-*` class namespace) |

---

## 7. Current Status and Known Limitation

The implementation is complete:

- `chat.js` parses correctly with no syntax errors.
- API key handling is safe: no key is committed, the public build degrades cleanly, and the input is disabled rather than attempting a keyless call.
- The system prompt construction and grounding rules are in place and mirror the QA harness.

**Pending**: live QA transcripts have not yet been produced. The Mistral API key available during development returned HTTP 401 Unauthorized. The QA harness (`qa/ask_kashf_qa.mjs`) is ready to run; it requires a valid, active Mistral API key. Once a valid key is in place, run:

```bash
node qa/ask_kashf_qa.mjs
```

The output will include full transcripts for both test cases and a final `ALL MUST-PASS ITEMS PASSED` or failure count.

---

## 8. Running the Chat Locally

1. Copy the config template:
   ```bash
   cp frontend/js/config.example.js frontend/js/config.js
   ```

2. Open `frontend/js/config.js` and set your Mistral API key:
   ```js
   mistralKey: "your-actual-mistral-api-key-here"
   ```

3. Serve the frontend over HTTP (not `file://` — the Mistral API will be blocked by mixed-content restrictions on `file://` origins):
   ```bash
   npx serve frontend
   # or
   python3 -m http.server 8080 --directory frontend
   ```

4. Open `http://localhost:8080` (or whichever port your server uses) in a browser.

5. Select a case on the map, then click the **Ask Kashf** button in the bottom-right corner of the page.

The drawer will open, display the active case name and suggested-question chips, and accept free-form questions.
