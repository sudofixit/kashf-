/* Kashf — chat.js  ·  "Ask Kashf" drawer
 * A slide-in chat that reasons about the ACTIVE case via Mistral. The API key is
 * read from window.KASHF_CONFIG.mistralKey (js/config.js, gitignored) — never
 * committed. With no key the drawer still opens but the input is disabled with a
 * quiet notice, so the public GitHub Pages build degrades cleanly.
 */
(function () {
  "use strict";
  const T = window.KashfTranslate;
  const KEY = (window.KASHF_CONFIG || {}).mistralKey || "";
  const API = "https://api.mistral.ai/v1/chat/completions";
  const MODEL = "mistral-large-latest";

  let activeCase = null;
  let systemPrompt = "";
  let history = [];          // {role:"user"|"assistant", content}
  let busy = false;

  // Suggested-question chips per case (static, plain-English).
  const CHIPS = {
    case_1_al_mamzar: ["Why retiming over lane addition?", "Explain phase failures.", "What is the confidence basis?"],
    case_2_szr_defence: ["What is the root cause?", "Is adaptive signalling sufficient?", "What is the confidence basis?"],
    case_3_storm: ["What caused the April 2024 disruption?", "Why is there no engineering fix?", "What did the operational response achieve?"],
    case_4_citywide_triage: ["Which corridor has highest severity?", "How is the severity index calculated?", "Define LOS F."],
    case_5_garhoud_no_signal: ["Why is signalling not the solution?", "What is the recommendation?", "What is the confidence basis?"]
  };
  const DEFAULT_CHIPS = ["What is the root cause?", "What is the recommendation?", "What is the confidence basis?"];

  // ---- glossary handed to the model so it uses plain names/terms --------------
  function glossary() {
    const names = Object.entries(Object.assign({}, T.LOCATIONS, T.JUNCTIONS))
      .map(([code, n]) => `${code} = ${n}`).join("; ");
    return "NAME GLOSSARY (always use the plain name, mention a code only if the user "
      + "uses it first): " + names + ". TERM GLOSSARY: LOS F = gridlock; vc / v-c ratio "
      + "= road fullness; degree of saturation = signal capacity used; phase failures = "
      + "times the signal couldn't clear the queue; Fixed-time = fixed-timing signal; "
      + "SCOOT-adaptive = smart adaptive signal.";
  }

  function buildSystemPrompt(c) {
    return [
      "You are Kashf, a traffic diagnosis assistant for Dubai's RTA, explaining your "
      + "analysis of ONE specific case to a possibly non-technical person.",
      "",
      "THE ACTIVE CASE (every figure you cite MUST come from this JSON):",
      JSON.stringify(c),
      "",
      glossary(),
      "",
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

  // ---- DOM -------------------------------------------------------------------
  let drawer, msgEl, inputEl, sendBtn, chipsEl, titleEl, fab;

  function injectUI() {
    fab = document.createElement("button");
    fab.id = "ask-kashf-fab";
    fab.type = "button";
    fab.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>Ask Kashf</span>';
    fab.addEventListener("click", open);
    document.body.appendChild(fab);

    drawer = document.createElement("aside");
    drawer.id = "ask-kashf-drawer";
    drawer.setAttribute("aria-hidden", "true");
    drawer.innerHTML =
      '<header class="akd-head"><div><div class="akd-title">Ask Kashf</div>'
      + '<div class="akd-sub" id="akd-case"></div></div>'
      + '<div class="akd-tag">AI traffic analyst</div>'
      + '<button class="akd-x" id="akd-x" type="button" aria-label="Close">&times;</button></header>'
      + '<div class="akd-msgs" id="akd-msgs"></div>'
      + '<div class="akd-chips" id="akd-chips"></div>'
      + '<form class="akd-foot" id="akd-form"><input id="akd-input" type="text" '
      + 'placeholder="Enter your question..." autocomplete="off" />'
      + '<button id="akd-send" type="submit" aria-label="Send">Send</button></form>';
    document.body.appendChild(drawer);

    msgEl = drawer.querySelector("#akd-msgs");
    inputEl = drawer.querySelector("#akd-input");
    sendBtn = drawer.querySelector("#akd-send");
    chipsEl = drawer.querySelector("#akd-chips");
    titleEl = drawer.querySelector("#akd-case");

    drawer.querySelector("#akd-x").addEventListener("click", close);
    drawer.querySelector("#akd-form").addEventListener("submit", (e) => {
      e.preventDefault(); const v = inputEl.value.trim(); if (v) send(v);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawer.classList.contains("open")) close();
    });
  }

  function open() {
    const tb = document.querySelector(".topbar");        // sit below the top bar, never over it
    if (tb) drawer.style.top = tb.offsetHeight + "px";
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    if (!KEY) { inputEl.focus(); return; }
    setTimeout(() => inputEl.focus(), 260);
  }
  function close() {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    fab.focus();
  }

  // ---- case switch -----------------------------------------------------------
  function onCase(c) {
    activeCase = c;
    systemPrompt = buildSystemPrompt(c);
    history = [];
    if (!drawer) return;
    const title = T.text(c.title || c.case_id || "");
    titleEl.textContent = title;
    msgEl.innerHTML = "";
    addSystemNote("Active case: " + title);
    if (!KEY) {
      addSystemNote("Live chat is enabled in the presented demo only. This public build has no active key.");
      inputEl.disabled = true; sendBtn.disabled = true;
      inputEl.placeholder = "Chat unavailable: no API key configured";
    } else {
      inputEl.disabled = false; sendBtn.disabled = false;
      inputEl.placeholder = "Enter your question...";
    }
    renderChips((CHIPS[c.case_id] || DEFAULT_CHIPS));
  }

  function renderChips(list) {
    chipsEl.innerHTML = "";
    if (!KEY) return;
    list.forEach((q) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "akd-chip"; b.textContent = q;
      b.addEventListener("click", () => send(q));
      chipsEl.appendChild(b);
    });
  }

  // ---- messages --------------------------------------------------------------
  function addSystemNote(text) {
    const d = document.createElement("div");
    d.className = "akd-note"; d.textContent = text;
    msgEl.appendChild(d); scroll();
  }
  function addBubble(role, text) {
    const d = document.createElement("div");
    d.className = "akd-bubble " + (role === "user" ? "user" : "kashf");
    d.innerHTML = role === "user" ? escapeHtml(text) : mdLite(text);
    msgEl.appendChild(d); scroll(); return d;
  }
  function typing() {
    const d = document.createElement("div");
    d.className = "akd-bubble kashf typing";
    d.innerHTML = '<span></span><span></span><span></span>';
    msgEl.appendChild(d); scroll(); return d;
  }
  function scroll() { msgEl.scrollTop = msgEl.scrollHeight; }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  // markdown-lite: bold + line breaks only (spec)
  function mdLite(s) {
    return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
  }

  // ---- the Mistral call ------------------------------------------------------
  async function send(text) {
    if (busy || !KEY || inputEl.disabled) return;
    busy = true; inputEl.value = ""; chipsEl.innerHTML = "";
    addBubble("user", text);
    history.push({ role: "user", content: text });
    const tip = typing();

    const messages = [{ role: "system", content: systemPrompt }].concat(history.slice(-12));
    try {
      const reply = await callMistral(messages);
      tip.remove();
      addBubble("kashf", reply);
      history.push({ role: "assistant", content: reply });
    } catch (err) {
      tip.remove();
      const msg = err && err.message === "timeout"
        ? "Request timed out. Please try again."
        : "Response unavailable. Please try again.";
      addBubble("kashf", msg);
      console.warn("Ask Kashf error:", err);
    } finally {
      busy = false;
      if (!inputEl.disabled) inputEl.focus();
    }
  }

  async function callMistral(messages) {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Authorization": "Bearer " + KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, temperature: 0.3, max_tokens: 400, messages }),
        signal: controller.signal
      });
      clearTimeout(to);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const content = data && data.choices && data.choices[0] && data.choices[0].message
        && data.choices[0].message.content;
      if (!content) throw new Error("empty response");
      return content.trim();
    } catch (e) {
      clearTimeout(to);
      if (e && e.name === "AbortError") throw new Error("timeout");
      throw e;
    }
  }

  // ---- boot ------------------------------------------------------------------
  function boot() {
    injectUI();
    if (window.KashfApp && window.KashfApp.activeCase && window.KashfApp.activeCase()) {
      onCase(window.KashfApp.activeCase());
    }
  }
  document.addEventListener("kashf:case", (e) => onCase(e.detail));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
