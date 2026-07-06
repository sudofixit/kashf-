/* Kashf — app.js
 * Orchestration: load contract, build tabs/clock/status, render the right panel from
 * the contract JSON (every value from data — no hardcoded metrics), scenario switching,
 * the before/after toggle, and the citywide sortable table.
 */
(function () {
  "use strict";
  const D = window.KashfData;
  const T = window.KashfTranslate;   // display-only plain-English layer (contract keeps the IDs)

  const state = {
    cases: {}, order: [], activeId: null,
    flowState: "before",
    sort: { key: "los_f_pct", dir: "desc" }
  };

  // ---- tiny DOM helpers ----------------------------------------------------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const SEV_CLASS = { red: "sev-red", amber: "sev-amber", green: "sev-green" };

  // ---- boot ----------------------------------------------------------------
  async function boot() {
    document.getElementById("bottom-strip").textContent = D.DISCLOSURE_LINE;
    startClock();

    const { cases, order, errors } = await D.loadContract();
    state.cases = cases; state.order = order;
    if (errors.length) showErrorBanner(errors);

    buildTabs();
    if (order.length) selectCase(order[0].case_id);   // render panel NOW — never wait on the map
    document.addEventListener("keydown", onKey);

    // Map initialises in parallel and must never block the panel. When it's ready, draw the
    // active case; if WebGL/network makes it hang, init resolves via its own timeout.
    window.KashfMap.init(cases).then((res) => {
      wireTrafficToggle();
      if (res && res.ok && state.activeId) {
        try { window.KashfMap.showCase(state.cases[state.activeId], state.flowState); } catch (e) { console.warn(e); }
      }
    }).catch((e) => console.warn("map init:", e));
  }

  // Live-traffic toggle + its permanent disclosure (only when the layer is available).
  function wireTrafficToggle() {
    const btn = document.getElementById("traffic-toggle");
    const disc = document.getElementById("traffic-disclosure");
    if (!window.KashfMap.isReady || !window.KashfMap.isReady() || !window.KashfMap.trafficAvailable()) return;
    btn.hidden = false;
    disc.textContent = D.TRAFFIC_DISCLOSURE;
    btn.addEventListener("click", () => {
      const on = btn.getAttribute("aria-pressed") !== "true";
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      try { window.KashfMap.setTraffic(on); } catch (e) { console.warn(e); }
    });
  }

  // ---- top bar -------------------------------------------------------------
  function startClock() {
    const el = document.getElementById("clock");
    const tick = () => {
      const d = new Date();
      const p = (n) => String(n).padStart(2, "0");
      el.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    };
    tick(); setInterval(tick, 1000);
  }

  function buildTabs() {
    const nav = document.getElementById("tabs");
    nav.innerHTML = "";
    state.order.forEach((o) => {
      const b = document.createElement("button");
      b.className = "tab"; b.type = "button"; b.textContent = o.label;
      b.setAttribute("role", "tab"); b.dataset.caseId = o.case_id;
      b.addEventListener("click", () => selectCase(o.case_id));
      nav.appendChild(b);
    });
  }

  function setStatusPill(caseData) {
    const pill = document.getElementById("status-pill");
    const verified = caseData.status === "verified";
    pill.className = "status-pill " + (verified ? "verified" : "partial");
    pill.textContent = verified ? "Verified data" : "Partial data";
  }

  function onKey(e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const ids = state.order.map((o) => o.case_id);
    let i = ids.indexOf(state.activeId);
    if (i < 0) return;
    i = e.key === "ArrowRight" ? (i + 1) % ids.length : (i - 1 + ids.length) % ids.length;
    selectCase(ids[i]);
  }

  // ---- scenario switch -----------------------------------------------------
  function selectCase(caseId) {
    const caseData = state.cases[caseId];
    if (!caseData) return;
    state.activeId = caseId;
    state.flowState = "before";

    document.querySelectorAll(".tab").forEach((t) =>
      t.classList.toggle("active", t.dataset.caseId === caseId));
    setStatusPill(caseData);

    const panel = document.getElementById("panel");
    panel.classList.add("fading");                    // 150ms crossfade
    setTimeout(() => {
      try { renderPanel(caseData); }
      catch (err) { showRenderError(caseData, err); }
      panel.classList.remove("fading");
    }, 150);

    try { window.KashfMap.showCase(caseData, "before"); }
    catch (err) { console.warn("map showCase:", err); }
  }

  // ---- panel rendering -----------------------------------------------------
  function renderPanel(c) {
    const panel = document.getElementById("panel");
    const isCitywide = Array.isArray(c.triage_table);
    const parts = [];

    parts.push(renderHeader(c, isCitywide));

    if (isCitywide) {
      parts.push(renderOverview(c));
      parts.push(renderTable(c));
    } else {
      parts.push(renderMetricRow(c));
      parts.push(renderDiagnosis(c));
      const hasFixes = c.simulate && Array.isArray(c.simulate.candidates) && c.simulate.candidates.length > 0;
      if (hasFixes) parts.push(renderFixes(c));
      parts.push(renderReco(c));
      // Cases with a fix get a Before/After toggle; the storm gets a "Show response" toggle.
      const hasToggle = hasFixes || c.case_id === "case_3_storm";
      if (hasToggle) parts.push(renderToggle(c));
    }

    panel.innerHTML = parts.join("");
    if (isCitywide) wireTableSort(c);
    else if ((c.simulate && c.simulate.candidates.length > 0) || c.case_id === "case_3_storm") wireToggle(c);
  }

  function renderHeader(c, isCitywide) {
    let badge = "";
    if (!isCitywide) {
      const b = D.BADGES[c.diagnosis.type];
      // Short badge label; the full plain-English diagnosis rides along as its tooltip.
      badge = b ? `<span class="badge ${b.cls}" title="${esc(T.diag(c.diagnosis.type))}">${esc(b.text)}</span>` : "";
    }
    return `<div class="case-header"><h1 class="case-title">${esc(T.text(c.title))}</h1>${badge}</div>`;
  }

  function renderMetricRow(c) {
    const isStorm = c.case_id === "case_3_storm";
    const plain = c.plain || {};
    const cards = D.METRICS.map((m) => {
      const val = c.triage[m.key];
      if (val === undefined) throw new Error("triage." + m.key + " missing");
      const primary = plain[m.plainKey];
      if (primary === undefined) throw new Error("plain." + m.plainKey + " missing");
      const qual = isStorm ? `<span class="m-qual"> · storm-day</span>` : "";
      // Plain-English primary (translated); technical value stays muted beneath (Part D2 —
      // the muted tech line is the precision layer and is left untranslated by design).
      return `<div class="metric"><div class="m-plain">${esc(T.text(primary))}</div>
                <div class="m-tech tabular">${esc(m.tech(val))}${qual}</div></div>`;
    }).join("");
    return `<div class="metric-row">${cards}</div>`;
  }

  function renderDiagnosis(c) {
    const dg = c.diagnosis;
    if (!dg || dg.summary === undefined) throw new Error("diagnosis.summary missing");
    const sevClass = SEV_CLASS[c.map.severity_color] || "sev-accent";
    const evClass = c.diagnosis.type === "WEATHER_INCIDENT" ? "sev-accent" : sevClass;
    const evidence = dg.evidence.map((e) => `<div class="ev ${evClass}">${esc(T.text(e))}</div>`).join("");
    const review = dg.human_review_required
      ? `<span class="review-pill">Human review required</span>` : "";
    return `<div class="card">
      <div class="section-label">Diagnosis</div>
      <p class="diag-summary">${esc(T.text(dg.summary))}</p>
      <div class="evidence">${evidence}</div>
      <div class="confidence">
        <div class="conf-track"><div class="conf-fill" style="width:${Number(dg.confidence_pct)}%"></div></div>
        <span class="conf-val tabular">${esc(dg.confidence_pct)}% confidence</span>
        ${review}
      </div></div>`;
  }

  function fixIsRecommended(c, cand) {
    const top = c.rank.top_fix;
    if (!top) return false;
    return cand.fix === top || cand.fix.startsWith(top) || cand.fix.indexOf(top) === 0 || top.indexOf(cand.fix) === 0;
  }

  function dots(n) {
    let out = '<span class="dotscale">';
    for (let i = 1; i <= 5; i++) out += `<span class="d ${i <= n ? "on" : ""}"></span>`;
    return out + "</span>";
  }

  function renderFixes(c) {
    const rows = c.simulate.candidates.map((cand) => {
      const notEst = cand.before.vc === null || cand._not_estimable;
      const rec = fixIsRecommended(c, cand);
      let metrics = "", delta = "", note = "";
      if (notEst) {
        note = `<div class="not-est-note">Not estimable with this model</div>`;
      } else {
        const b = cand.before, a = cand.after;
        const dPct = Math.round((a.delay_s - b.delay_s) / b.delay_s * 100);
        const cls = dPct < 0 ? "good" : dPct > 0 ? "bad" : "neutral";
        delta = `<span class="fix-delta ${cls} tabular">${dPct > 0 ? "+" : ""}${dPct}% delay</span>`;
        metrics = `<div class="fix-metrics tabular">
            <span>fullness <b>${esc(b.vc)}</b><span class="arrow">→</span><b>${esc(a.vc)}</b></span>
            <span>delay <b>${esc(b.delay_s)}s</b><span class="arrow">→</span><b>${esc(a.delay_s)}s</b></span>
          </div>`;
      }
      return `<div class="fix ${rec ? "recommended" : ""} ${notEst ? "not-estimable" : ""}">
        <div class="fix-head">
          <span class="fix-name">${esc(T.text(cand.fix))}</span>
          ${rec ? '<span class="fix-rec-label">Recommended</span>' : delta}
        </div>
        ${metrics}${note}
        <div class="fix-scores">
          <span>Cost ${dots(Number(cand.cost_score) || 0)}</span>
          <span>Disruption ${dots(Number(cand.disruption_score) || 0)}</span>
        </div></div>`;
    }).join("");
    const verdict = (c.plain && c.plain.verdict_after)
      ? `<div class="verdict-after">${esc(T.text(c.plain.verdict_after))}</div>` : "";
    const foot = c.simulate.method_label
      ? `<div class="method-footnote">${esc(c.simulate.method_label)}</div>` : "";
    return `<div class="card"><div class="section-label">Tested fixes</div>${rows}${verdict}${foot}</div>`;
  }

  function renderReco(c) {
    if (!c.rank || c.rank.recommendation === undefined) throw new Error("rank.recommendation missing");
    return `<div class="card reco"><div class="section-label">Recommendation</div>
      <p class="reco-text">${esc(T.text(c.rank.recommendation))}</p></div>`;
  }

  function toggleHint(c, s) {
    if (c.case_id === "case_3_storm") {
      return s === "after"
        ? "Operational response — patrols and diversions (no engineering fix applies here)."
        : "Storm-day flow across the bridge — click 'Show response' for the actions.";
    }
    const blk = (c.flow_animation || {})[s] || {};
    return `flow: ${blk.density || "—"} density, ${blk.speed_factor}× free-flow speed`;
  }

  function renderToggle(c) {
    const storm = c.case_id === "case_3_storm";
    const l0 = storm ? "Storm view" : "Before conditions";
    const l1 = storm ? "Show response" : "After top fix";
    return `<div class="card">
      <div class="section-label">${storm ? "Scenario" : "Scenario flow"}</div>
      <div class="toggle-wrap">
        <div class="toggle" role="group" aria-label="${storm ? "Storm / response" : "Before / after"}">
          <button type="button" data-flow="before" class="active">${esc(l0)}</button>
          <button type="button" data-flow="after">${esc(l1)}</button>
        </div>
      </div>
      <div class="toggle-hint" id="toggle-hint">${esc(toggleHint(c, "before"))}</div>
    </div>`;
  }

  function wireToggle(c) {
    const hint = document.getElementById("toggle-hint");
    document.querySelectorAll('.toggle button[data-flow]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const s = btn.dataset.flow;
        state.flowState = s;
        document.querySelectorAll('.toggle button[data-flow]').forEach((b) =>
          b.classList.toggle("active", b === btn));
        hint.textContent = toggleHint(c, s);
        try { window.KashfMap.setFlowState(c, s); } catch (e) { console.warn(e); }
      });
    });
  }

  // ---- citywide overview + table -------------------------------------------
  function renderOverview(c) {
    if (c.narrative === undefined) throw new Error("narrative missing");
    return `<div class="card"><div class="section-label">Citywide summary</div>
      <p class="overview-text">${esc(T.text(c.narrative))}</p></div>`;
  }

  function renderTable(c) {
    const dir = state.sort.dir;
    const rows = c.triage_table.slice().sort((x, y) =>
      dir === "desc" ? y.los_f_pct - x.los_f_pct : x.los_f_pct - y.los_f_pct);
    const body = rows.map((r) => `<tr>
        <td class="l"><span class="sev-dot ${esc(r.severity_color)}"></span>${esc(T.name(r.location_id))}</td>
        <td class="l id-col">${esc(r.location_id)}</td>
        <td class="l">${esc(r.area)}</td>
        <td class="val tabular">${esc(r.los_f_pct)}</td>
        <td class="val tabular">${esc(r.demand_gap_vph)}</td>
      </tr>`).join("");
    const caret = dir === "desc" ? "▾" : "▴";
    // English name is the primary column; the raw ID stays as a narrow muted data column.
    return `<div class="card"><div class="section-label">Corridor triage — all 18</div>
      <table class="triage-table"><thead><tr>
        <th class="l">Corridor</th><th class="l id-col">ID</th><th class="l">Area</th>
        <th class="sortable" id="sort-losf">% LOS F <span class="sort-caret">${caret}</span></th>
        <th>Gap vph</th>
      </tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function wireTableSort(c) {
    const th = document.getElementById("sort-losf");
    if (!th) return;
    th.addEventListener("click", () => {
      state.sort.dir = state.sort.dir === "desc" ? "asc" : "desc";
      const panel = document.getElementById("panel");
      // re-render just the table region by re-rendering the panel (cheap, 18 rows)
      try { renderPanel(c); } catch (err) { showRenderError(c, err); }
      void panel;
    });
  }

  // ---- error surfaces ------------------------------------------------------
  function showErrorBanner(errors) {
    const el = document.getElementById("error-banner");
    const items = errors.map((e) => `<li>${esc(e.file)} — ${esc(e.field)}: ${esc(e.msg)}</li>`).join("");
    el.innerHTML = `Contract validation issues (${errors.length}). Affected cases may be incomplete:<ul>${items}</ul>`;
    el.hidden = false;
  }

  function showRenderError(caseData, err) {
    const el = document.getElementById("error-banner");
    el.innerHTML = `Render error in ${esc(caseData && caseData.case_id)} — ${esc(err && err.message)}`;
    el.hidden = false;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
