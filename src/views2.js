/* =====================================================================
   VIEWS 2 — Workspace tabs
   ===================================================================== */
const COMPARE_ROWS = [
  ['Lending rate (WC)', s => s.a.wcRate, v => pct(v, 2), { bps: true, neutral: true }],
  ['Loan outstanding', s => s.a.wcBal + s.a.tlBal, v => cr(v, 1), { unit: 'Cr' }],
  ['Deposit balance', s => s.a.depBal, v => cr(v, 1), { unit: 'Cr' }],
  ['Transaction volume / month', s => s.a.txnVol, int, { unit: 'txns' }],
  ['Trade finance volume', s => s.a.tfVol, v => cr(v, 1), { unit: 'Cr' }],
  ['Revenue', (s, k) => k.revenue, v => cr(v), { unit: 'Cr' }, 'money'],
  ['Net interest income', (s, k) => k.nii, v => cr(v), { unit: 'Cr' }, 'money'],
  ['Fee income', (s, k) => k.feeIncome, v => cr(v), { unit: 'Cr' }, 'money'],
  ['Total cost', (s, k) => k.totalCost, v => cr(v), { unit: 'Cr', inverse: true }, 'money'],
  ['Expected loss', (s, k) => k.el, v => cr(v), { unit: 'Cr', inverse: true }, 'money'],
  ['Profit before tax', (s, k) => k.pbt, v => cr(v), { unit: 'Cr' }, 'key'],
  ['RAROC', (s, k) => k.raroc, v => pct(v), { pp: true }, 'key'],
  ['RWA', (s, k) => k.rwa, v => cr(v, 1), { unit: 'Cr', inverse: true }],
  ['Economic value added', (s, k) => k.eva, v => cr(v), { unit: 'Cr' }, 'money'],
  ['Commitment coverage today', (s, k) => k.commitCoverage, v => pct(v, 0), { pp: true }],
];
function compareTable(sim, { selectable = false } = {}) {
  const { base, list } = Scen.results(sim); const bs = { a: sim.baseline };
  const best = list.length ? list.slice().sort((p, q) => q.r.kpi.eva - p.r.kpi.eva)[0].s.id : null;
  return `<div class="tbl-wrap"><table class="tbl cmp"><thead><tr><th></th><th><span class="swatch" style="background:var(--base-c)"></span>Baseline</th>${list.map(x => `<th><span class="swatch" style="background:${Scen.color(sim, x.s)}"></span>${esc(x.s.name)}${x.s.id === best ? ' <span class="chip best">Strongest EVA</span>' : ''}</th>`).join('')}</tr></thead><tbody>
  ${COMPARE_ROWS.map(([label, get, f, o, kind]) => { const bv = get(bs, base.kpi); return `<tr class="${kind === 'key' ? 'keyrow' : ''}"><th>${label}</th><td>${f(bv)}</td>${list.map(x => { const v = get(x.s, x.r.kpi); return `<td>${f(v)}<br>${dlt(v, bv, o)}</td>`; }).join('')}</tr>`; }).join('')}
  <tr><th>Warnings</th><td></td>${list.map(x => { const w = E.warnings(x.r, base, x.s.a, sim.baseline, S.cfg, Scen.meta(sim)).filter(y => y.level !== 'info'); return `<td>${w.length ? `<span class="wcount">${w.length}</span> ${[...new Set(w.map(y => y.type))].join(', ')}` : '<span class="muted">None</span>'}</td>`; }).join('')}</tr>
  ${selectable ? `<tr><th></th><td></td>${list.map(x => `<td>${sim.selectedId === x.s.id ? '<span class="chip pref">Preferred</span>' : Auth.can('scenario.edit', { sim }) ? `<button class="btn sm" data-act="select-scen" data-id="${x.s.id}">Select as preferred</button>` : ''}</td>`).join('')}</tr>` : ''}
  </tbody></table></div>`;
}
function wsCompare(sim) {
  const { base, list } = Scen.results(sim);
  if (!list.length) return { html: '<div class="panel empty">Add a scenario to compare alternatives against the baseline.</div>' };
  const bar = (label, pick, yFmt, target) => Chart.bars([{ label, values: [{ name: 'Baseline', color: 'var(--base-c)', v: pick(base.kpi) }, ...list.map(x => ({ name: x.s.name, color: Scen.color(sim, x.s), v: pick(x.r.kpi) }))] }], { w: 360, h: 210, yFmt, target });
  return { html: `<section class="panel"><div class="panel-h"><h2>Scenario comparison</h2><small class="muted">Absolute and percentage variance against baseline</small></div>${compareTable(sim, { selectable: true })}</section>
  <div class="grid-3"><section class="panel"><h3 class="sub">Profit before tax</h3>${bar('Profit (Cr)', k => k.pbt, v => fmt(v, 1))}</section><section class="panel"><h3 class="sub">RAROC</h3>${bar('RAROC', k => k.raroc, v => fmt(v, 0) + '%', S.cfg.targetRaroc)}</section><section class="panel"><h3 class="sub">Revenue</h3>${bar('Revenue (Cr)', k => k.revenue, v => fmt(v, 1))}</section></div>` };
}

/* ---------------- Sensitivity ---------------- */
function wsSens(sim) {
  const list = sim.scenarios; if (!list.length) return { html: '<div class="panel empty">Add a scenario first.</div>' };
  const def = list.find(s => s.id === sim.selectedId) || list[list.length - 1];
  UI.sens = UI.sens && UI.sens.simId === sim.id ? UI.sens : { simId: sim.id, scen: def.id, kpi: 'pbt', v: 'depBal', from: 20, to: 60, step: 5, ran: true };
  const P = UI.sens; const sc = list.find(s => s.id === P.scen) || def;
  const VAR_DEF = { wcRate: [8.5, 9.5, 0.05], depBal: [20, 60, 5], txnVol: [15000, 35000, 2500], cofBps: [-100, 100, 25], riskMult: [50, 200, 25], tfVol: [80, 200, 20], fulfilPct: [40, 100, 10] };
  const pts = E.sensitivity(sc.a, sim.baseline, S.cfg, P.v, +P.from, +P.to, +P.step, P.kpi);
  const ptsB = E.sensitivity(sim.baseline, sim.baseline, S.cfg, P.v, +P.from, +P.to, +P.step, P.kpi);
  const V = E.SENS_VARS[P.v]; const isPct = P.kpi === 'raroc'; const yF = v => isPct ? fmt(v, 1) + '%' : fmt(v, 2);
  const xF = v => V.unit === 'txns' ? (v / 1000).toFixed(1) + 'k' : fmt(v, V.dec);
  // breakeven vs target / baseline
  const baseK = E.simulate(sim.baseline, sim.baseline, S.cfg).kpi;
  const cross = (() => { const tgt = P.kpi === 'raroc' ? S.cfg.targetRaroc : baseK[P.kpi]; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if ((a.y - tgt) * (b.y - tgt) <= 0 && a.y !== b.y) return { x: a.x + (tgt - a.y) / (b.y - a.y) * (b.x - a.x), tgt }; } return null; })();
  const html = `<section class="panel"><div class="panel-h"><h2>Sensitivity analysis</h2><small class="muted">Repeated deterministic runs of the simulation engine</small></div>
  <div class="filters"><label>Scenario<select data-sens="scen">${list.map(s => `<option value="${s.id}" ${s.id === sc.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
  <label>Target KPI<select data-sens="kpi">${Object.entries(E.KPIS).map(([k, l]) => `<option value="${k}" ${k === P.kpi ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <label>Variable<select data-sens="v" data-defs='${JSON.stringify(VAR_DEF)}'>${Object.entries(E.SENS_VARS).map(([k, x]) => `<option value="${k}" ${k === P.v ? 'selected' : ''}>${x.label}</option>`).join('')}</select></label>
  <label>From<input type="number" data-sens="from" value="${P.from}" step="any"></label><label>To<input type="number" data-sens="to" value="${P.to}" step="any"></label><label>Step<input type="number" data-sens="step" value="${P.step}" step="any"></label>
  <label class="btn-l"><button class="btn primary" data-act="sens-run">Run sensitivity</button></label><label class="btn-l"><button class="btn ghost" data-act="sens-save">Save to decision package</button></label></div>
  <div class="grid-2-1"><div>${Chart.line({ series: [{ name: esc(sc.name), color: Scen.color(sim, sc), points: pts }, { name: 'Baseline', color: 'var(--base-c)', points: ptsB, dash: true, dots: false }], h: 280, xFmt: xF, yFmt: yF, xLabel: `${V.label} (${V.unit})`, target: P.kpi === 'raroc' ? S.cfg.targetRaroc : null, marker: sc.a[P.v] >= +P.from && sc.a[P.v] <= +P.to ? sc.a[P.v] : null })}
  <p class="insight">${cross ? `${E.KPIS[P.kpi]} for ${esc(sc.name)} crosses ${P.kpi === 'raroc' ? `the ${S.cfg.targetRaroc}% target` : `the baseline value (${yF(cross.tgt)})`} at ${V.label.toLowerCase()} ≈ <b>${xF(cross.x)} ${V.unit}</b>.` : `${E.KPIS[P.kpi]} stays ${pts[0] && pts[0].y > (P.kpi === 'raroc' ? S.cfg.targetRaroc : baseK[P.kpi]) ? 'above' : 'below'} ${P.kpi === 'raroc' ? 'target' : 'baseline'} across the whole range.`} Dashed line: baseline structure with the same variable flexed.</p></div>
  <div class="tbl-wrap tall"><table class="tbl"><thead><tr><th>${esc(V.label)}</th><th class="r">${E.KPIS[P.kpi]}</th><th class="r">vs baseline</th></tr></thead><tbody>${pts.map(p => `<tr><td>${xF(p.x)} ${V.unit}</td><td class="r">${yF(p.y)}</td><td class="r">${isPct ? dlt(p.y, baseK.raroc, { pp: true }) : dlt(p.y, baseK[P.kpi], { unit: 'Cr', showPct: false })}</td></tr>`).join('')}</tbody></table></div></div></section>
  ${(sim.sensRuns || []).length ? `<section class="panel"><div class="panel-h"><h2>Saved sensitivity runs</h2></div><table class="tbl"><thead><tr><th>Run</th><th>Scenario</th><th>KPI</th><th>Variable & range</th><th>Saved</th></tr></thead><tbody>${sim.sensRuns.map(r => `<tr><td>${r.id}</td><td>${esc(r.scen)}</td><td>${E.KPIS[r.kpi]}</td><td>${esc(r.label)}</td><td>${fmtDT(r.at)}</td></tr>`).join('')}</tbody></table></section>` : ''}`;
  return { html };
}

/* ---------------- Drivers ---------------- */
function wsDrivers(sim) {
  const list = sim.scenarios; if (!list.length) return { html: '<div class="panel empty">Add a scenario first.</div>' };
  const sc = list.find(s => s.id === (UI.drvScen || sim.selectedId)) || list[list.length - 1];
  const kpi = UI.drvKpi || 'pbt';
  const rows = E.drivers(sc.a, sim.baseline, S.cfg, kpi);
  const fmtV = kpi === 'raroc' ? v => `${fmt(v, 2)} pp` : v => cr(v);
  return { html: `<section class="panel"><div class="panel-h"><h2>Key drivers</h2><small class="muted">Each variable flexed independently around ${esc(sc.name)}; bars show change in ${kpi === 'raroc' ? 'RAROC' : 'profit before tax'}</small></div>
  <div class="filters"><label>Scenario<select data-drv="scen">${list.map(s => `<option value="${s.id}" ${s.id === sc.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label><label>Measure<select data-drv="kpi"><option value="pbt" ${kpi === 'pbt' ? 'selected' : ''}>Profit before tax</option><option value="raroc" ${kpi === 'raroc' ? 'selected' : ''}>RAROC</option></select></label></div>
  ${Chart.tornado(rows, { fmtV })}
  <p class="insight">The largest single lever is <b>${esc(rows[0].label.replace(/ \(.*/, '').toLowerCase())}</b> (±${fmtV(rows[0].range / 2)}), followed by ${esc(rows[1].label.replace(/ \(.*/, '').toLowerCase())} and ${esc(rows[2].label.replace(/ \(.*/, '').toLowerCase())}. A 10 bps pricing move is worth ${fmtV(rows.find(r => r.key === 'wcRate').range / 2)} — compare this with the deposit lever when negotiating.</p></section>` };
}

/* ---------------- Stress ---------------- */
function wsStress(sim) {
  const cols = [{ id: 'base', name: 'Baseline', a: sim.baseline, color: 'var(--base-c)' }, ...sim.scenarios.map(s => ({ id: s.id, name: s.name, a: s.a, color: Scen.color(sim, s) }))];
  const T = E.STRESS_TEMPLATES;
  const cell = (a, sh, key) => { const r = E.stressOne(a, S.cfg, sh); return { v: r.stressed[key], d: r.stressed[key] - r.base[key], raroc: r.stressed.raroc }; };
  const key = UI.stressKpi || 'pbt';
  return { html: `<section class="panel"><div class="panel-h"><h2>Stress each alternative</h2><small class="muted">Reusable stress templates applied to every scenario</small></div>
  <div class="filters"><label>Show<select data-stress="kpi"><option value="pbt" ${key === 'pbt' ? 'selected' : ''}>Profit before tax</option><option value="raroc" ${key === 'raroc' ? 'selected' : ''}>RAROC</option><option value="nii" ${key === 'nii' ? 'selected' : ''}>NII</option></select></label></div>
  <div class="tbl-wrap"><table class="tbl cmp"><thead><tr><th>Stress template</th>${cols.map(c => `<th><span class="swatch" style="background:${c.color}"></span>${esc(c.name)}</th>`).join('')}</tr></thead><tbody>
  <tr class="keyrow"><th>Unstressed</th>${cols.map(c => { const k = E.simulate(c.a, null, S.cfg).kpi; return `<td>${key === 'raroc' ? pct(k.raroc) : cr(k[key])}</td>`; }).join('')}</tr>
  ${T.map(t => `<tr><th>${esc(t.name)}</th>${cols.map(c => { const x = cell(c.a, t.shocks, key); return `<td>${key === 'raroc' ? pct(x.v) : cr(x.v)}<br><span class="delta ${x.d < 0 ? 'neg' : 'pos'}">${key === 'raroc' ? `${x.d > 0 ? '+' : ''}${fmt(x.d, 1)} pp` : `${x.d > 0 ? '+' : '−'}₹${fmt(Math.abs(x.d), 2)} Cr`}</span>${x.raroc < S.cfg.targetRaroc ? ' <span class="flag" title="RAROC below target">below target</span>' : ''}</td>`; }).join('')}</tr>`).join('')}
  </tbody></table></div>
  <p class="insight">Relationship structures with more deposits are more exposed to rate cuts (deposit funding value reprices fully) but more resilient to funding shocks. Pass-through assumptions are documented under Administration.</p></section>` };
}

/* ---------------- AI assistant ---------------- */
function aiCard(m) {
  if (m.who === 'user') return `<div class="msg user"><p>${esc(m.text)}</p></div>`;
  return `<div class="msg ai"><div class="ai-h"><span class="cls cls-AI">AI recommended</span><small>${esc(AI.mode)}</small></div>${m.html}</div>`;
}
function wsAI(sim) {
  sim.aiLog = sim.aiLog || [];
  const editable = Auth.can('scenario.edit', { sim });
  const prompts = [['gen', 'Create three renewal options that keep RAROC above 16% while improving relationship revenue'], ['best', 'Which scenario provides the strongest overall relationship economics?'], ['explain', 'Why is the preferred scenario more profitable?'], ['suggest', 'Suggest assumptions based on customer history'], ['summary', 'Write an executive summary']];
  return { html: `<div class="grid-2-1"><section class="panel ai-panel"><div class="panel-h"><h2>AI simulation assistant</h2><small class="muted">Suggestions are grounded in this simulation's results and never change assumptions without your confirmation.</small></div>
  <div class="chat" id="chat">${sim.aiLog.length ? sim.aiLog.map(aiCard).join('') : `<div class="empty">Ask a question or pick a prompt. The assistant reads the baseline, scenarios and engine results for ${esc(sim.name)}.</div>`}</div>
  <div class="chat-in"><input id="ai-q" placeholder="Ask about this simulation, or describe a change: “cut rate by 20 bps and add ₹10 Cr deposits”"><button class="btn primary" data-act="ai-ask">Ask</button></div></section>
  <aside class="panel"><div class="panel-h"><h2>Prompts</h2></div><div class="prompts">${prompts.map(p => `<button class="prompt" data-act="ai-prompt" data-k="${p[0]}">${esc(p[1])}</button>`).join('')}</div>
  <p class="muted sm">No language model is connected in this demo. Responses come from a deterministic Prism rules engine using the calculation results, so the same inputs always return the same answer. An LLM can be plugged in behind the same AIService interface.</p>${editable ? '' : `<p class="muted sm">${esc(Auth.why('scenario.edit', { sim }))} Suggestions can be read but not applied.</p>`}</aside></div>` ,
    after: () => { const ch = $('#chat'); if (ch) ch.scrollTop = ch.scrollHeight; } };
}
function aiRespond(sim, kind, text) {
  const editable = Auth.can('scenario.edit', { sim }); let html = '';
  if (kind === 'gen') {
    const opts = AI.generate(sim, 16); UI.aiOpts = opts;
    html = `<p>Three structures that keep RAROC at or above 16% and lift revenue above baseline. Each is the smallest deposit ask that meets both constraints.</p>${opts.map((o, i) => o.feasible ? `<div class="aiopt"><div class="row sb"><b>${esc(o.name)}</b><span>${pct(o.k.raroc)} RAROC · ${cr(o.k.pbt)} profit</span></div><p>${esc(o.reason)}</p><ul class="parsed">${o.changed.map(k => { const f = Seed.FIELDS.find(x => x.k === k); return `<li>${esc(f.label)}: ${fieldFmt(f, sim.baseline[k])} → <b>${fieldFmt(f, o.a[k])}</b></li>`; }).join('')}</ul><small class="muted">${esc(o.caveat)}</small>${editable ? `<div><button class="btn sm" data-act="ai-add" data-i="${i}">Review & add as scenario</button></div>` : ''}</div>` : `<div class="aiopt"><b>${esc(o.name)}</b><p>${esc(o.reason)}</p></div>`).join('')}`;
  } else if (kind === 'best') {
    const st = AI.strongest(sim); html = `<p>${esc(st.text)}</p>${st.rank.length ? `<table class="tbl mini"><thead><tr><th>Rank</th><th>Scenario</th><th class="r">Profit</th><th class="r">RAROC</th><th class="r">EVA</th><th class="r">Profit at 80% fulfilment</th></tr></thead><tbody>${st.rank.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.s.name)}</td><td class="r">${cr(x.k.pbt)}</td><td class="r">${pct(x.k.raroc)}</td><td class="r">${cr(x.k.eva)}</td><td class="r">${cr(x.k80.pbt)}</td></tr>`).join('')}</tbody></table>` : ''}`;
  } else if (kind === 'explain') {
    const sc = sim.scenarios.find(s => s.id === sim.selectedId) || AI.strongest(sim).top?.s || sim.scenarios[0];
    if (!sc) html = '<p>Add a scenario first.</p>'; else { const ex = AI.explain(sim, sc); html = `<p>${esc(ex.text)}</p><div class="drivers-mini">${ex.comps.map(c => `<div><span>${esc(c[0])}</span><i class="${c[1] >= 0 ? 'p' : 'n'}" style="width:${Math.min(100, Math.abs(c[1]) / Math.max(...ex.comps.map(x => Math.abs(x[1]))) * 100)}%"></i><b>${c[1] >= 0 ? '+' : '−'}${cr(Math.abs(c[1]))}</b></div>`).join('')}</div>`; }
  } else if (kind === 'suggest') {
    const sg = AI.suggest(sim); UI.aiSug = sg; const tgt = sim.scenarios.find(s => s.id === UI.scen);
    html = sg.map((x, i) => `<div class="aiopt"><p>${esc(x.text)}</p>${editable && tgt ? `<button class="btn sm" data-act="ai-apply" data-i="${i}">Apply “${esc(x.label)}” to ${esc(tgt.name)}</button>` : ''}</div>`).join('') + (editable && !sim.scenarios.find(s => s.id === UI.scen) ? '<p class="muted sm">Select a scenario on the Scenarios tab to apply suggestions.</p>' : '');
  } else if (kind === 'summary') {
    html = `<p>${esc(AI.summary(sim))}</p>`;
  } else if (kind === 'nl') {
    const parsed = AI.parse(text); UI.nlParsed = parsed;
    html = parsed.length ? `<p>I read this as a change to the baseline. Review before running:</p><ul class="parsed">${parsed.map(p => `<li>${esc(p.label)}: <b>${esc(p.display)}</b></li>`).join('')}</ul>${editable ? `<button class="btn sm primary" data-act="nl-confirm">Confirm & run simulation</button>` : ''}` : '<p>I could not find a variable and amount in that request. Try “reduce lending rate by 30 bps and increase deposits by INR 15 Cr”.</p>';
  }
  return html;
}
function routeFreeText(q) {
  const t = q.toLowerCase();
  if (/(create|generate|build).*(option|scenario|alternative)/.test(t)) return 'gen';
  if (/(strongest|best|which scenario|recommend)/.test(t)) return 'best';
  if (/(why|explain)/.test(t)) return 'explain';
  if (/(suggest|assumption|range)/.test(t)) return 'suggest';
  if (/(summary|summar|executive)/.test(t)) return 'summary';
  return 'nl';
}

/* ---------------- Decision & approval ---------------- */
function approvalTimeline(sim) {
  const ev = [{ t: 'Created', by: userById(sim.owner).name, at: sim.createdAt, st: 'done' }];
  if (sim.submittedAt) ev.push({ t: 'Submitted with rationale', by: userById(sim.owner).name, at: sim.submittedAt, st: 'done', c: sim.rationale });
  (sim.approvals || []).forEach(a => ev.push({ t: a.label, by: a.by || Seed.ROLES[a.role], at: a.at, st: a.status === 'Pending' ? 'pending' : a.status === 'Rejected' ? 'rej' : 'done', c: a.comment, reason: a.reason, status: a.status }));
  if (['Executed', 'Monitoring'].includes(sim.status)) ev.push({ t: 'Executed', by: userById(sim.owner).name, at: sim.executedAt, st: 'done' });
  if (sim.status === 'Monitoring') ev.push({ t: 'Outcome monitoring', by: 'Prism', st: 'done' });
  return `<ol class="timeline">${ev.map(e => `<li class="${e.st}"><div><b>${esc(e.t)}</b>${e.status ? ` ${statusPill(e.status === 'Pending' ? 'Awaiting' : e.status)}` : ''}<small>${esc(e.by)}${e.at ? ` · ${fmtDT(e.at)}` : ''}${e.reason ? ` · ${esc(e.reason)}` : ''}</small>${e.c ? `<blockquote>${esc(e.c)}</blockquote>` : ''}</div></li>`).join('')}</ol>`;
}
function wsDecision(sim) {
  const editable = Auth.can('scenario.edit', { sim }); const b = sim.baseline;
  const sel = sim.scenarios.find(s => s.id === sim.selectedId);
  const base = E.simulate(b, b, S.cfg); const res = sel ? E.simulate(sel.a, b, S.cfg) : null;
  const warns = sel ? E.warnings(res, base, sel.a, b, S.cfg, Scen.meta(sim)) : [];
  const req = sel ? E.requiredApprovals(sel.a, b, res, base, S.cfg) : [];
  const pending = sim.approvals?.find(a => a.status === 'Pending');
  const canAct = pending && Auth.can('approval.act', { sim, step: pending });
  let left;
  if (['Draft', 'Simulated', 'Rejected'].includes(sim.status)) {
    left = `<section class="panel"><div class="panel-h"><h2>Select the preferred scenario</h2></div>
    ${sim.scenarios.length ? `<div class="pick">${sim.scenarios.map(s => { const k = E.simulate(s.a, b, S.cfg).kpi; return `<label class="pick-i ${sim.selectedId === s.id ? 'on' : ''}" style="--c:${Scen.color(sim, s)}"><input type="radio" name="pref" value="${s.id}" data-act="select-scen" data-id="${s.id}" ${sim.selectedId === s.id ? 'checked' : ''} ${editable ? '' : 'disabled'}><span><b>${esc(s.name)}</b><small>${cr(k.pbt)} profit · ${pct(k.raroc)} RAROC · ${pct(s.a.wcRate, 2)} WC rate</small></span></label>`; }).join('')}</div>` : '<p class="muted">Add scenarios first.</p>'}
    ${sel ? `<h3 class="sub">Decision rationale</h3><textarea id="rationale" rows="4" ${editable ? '' : 'disabled'} placeholder="Why this scenario? What has the customer agreed to, and how will commitments be monitored?">${esc(sim.rationale || '')}</textarea>
    <h3 class="sub">Warnings to acknowledge</h3>${warns.length ? `<ul class="warns">${warns.map(x => `<li class="w-${x.level}"><b>${x.type}</b>${esc(x.text)}</li>`).join('')}</ul>` : '<p class="muted sm">None.</p>'}
    <h3 class="sub">Approval route (from configuration)</h3><ul class="route">${req.map(r => `<li><b>${Seed.ROLES[r.role]}</b><small>${esc(r.reason)}</small></li>`).join('')}</ul>
    ${sim.status === 'Rejected' ? `<p class="warn-inline">This simulation was rejected. Revise the scenario, then resubmit.</p>` : ''}
    <div class="row gap">${editable ? `<button class="btn primary" data-act="submit">Submit for approval</button>` : `<small class="muted">${esc(Auth.why('scenario.edit', { sim }))}</small>`}</div>` : ''}</section>`;
  } else {
    left = `<section class="panel"><div class="panel-h"><h2>Selected: ${esc(sel?.name || '–')}</h2>${statusPill(sim.status)}</div>
    ${sel ? `<div class="tiles sm">${[['Profit before tax', cr(res.kpi.pbt), dlt(res.kpi.pbt, base.kpi.pbt, { unit: 'Cr' })], ['RAROC', pct(res.kpi.raroc), dlt(res.kpi.raroc, base.kpi.raroc, { pp: true })], ['Revenue', cr(res.kpi.revenue), dlt(res.kpi.revenue, base.kpi.revenue, { unit: 'Cr' })], ['WC rate', pct(sel.a.wcRate, 2), `<span class="delta flat">${Math.round((b.wcRate - sel.a.wcRate) * 100)} bps concession</span>`]].map(t => `<div class="tile"><span>${t[0]}</span><b>${t[1]}</b>${t[2]}</div>`).join('')}</div>` : ''}
    <h3 class="sub">Rationale</h3><blockquote>${esc(sim.rationale)}</blockquote>
    ${sim.warningsAtSubmit?.length ? `<h3 class="sub">Warnings shown at submission</h3><ul class="warns">${sim.warningsAtSubmit.map(t => `<li class="w-med">${esc(t)}</li>`).join('')}</ul>` : ''}
    ${pending ? `<div class="approve-box"><h3 class="sub">${esc(pending.label)}</h3>${canAct ? `<textarea id="appr-comment" rows="3" placeholder="Comment (required)"></textarea><div class="row gap"><button class="btn primary" data-act="approve" data-d="approve">${pending.stage === 'review' ? 'Mark reviewed' : 'Approve'}</button><button class="btn danger" data-act="approve" data-d="reject">Reject</button></div>` : `<p class="lock">${esc(Auth.why('approval.act', { sim, step: pending }))}${me().role !== pending.role ? ' Switch persona from the profile menu to act as the approver.' : ''}</p>`}</div>` : ''}
    <div class="row gap">${Auth.can('sim.execute', { sim }) ? '<button class="btn" data-act="execute">Mark as executed</button>' : ''}${Auth.can('sim.monitor', { sim }) ? '<button class="btn" data-act="monitor">Start outcome monitoring</button>' : ''}${sim.status === 'Monitoring' ? '<a class="btn ghost" href="#/outcomes">View outcome</a>' : ''}${['Approved', 'Executed', 'Monitoring'].includes(sim.status) ? `<a class="btn primary" href="#/package/${sim.id}">Open decision package</a>` : ''}</div></section>`;
  }
  return { html: `<div class="grid-2-1">${left}<section class="panel"><div class="panel-h"><h2>Approval timeline</h2><small class="muted">Maker-checker ${S.cfg.makerChecker ? 'on' : 'off'}</small></div>${approvalTimeline(sim)}</section></div>` };
}

/* ---------------- Audit ---------------- */
function auditTable(rows) {
  return rows.length ? `<div class="tbl-wrap"><table class="tbl audit"><thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Scenario</th><th>Old value</th><th>New value</th><th>Rationale / comment</th></tr></thead><tbody>${rows.map(r => { const s = simById(r.simId); return `<tr><td class="nowrap">${fmtDT(r.ts)}</td><td><b>${esc(r.user)}</b><small>${esc(r.role)}</small></td><td>${esc(r.action)}${s ? `<small class="code">${s.code}</small>` : ''}</td><td>${esc(r.scenario)}</td><td>${esc(r.oldV)}</td><td>${esc(r.newV)}</td><td>${esc(r.rationale)}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted">No audit events yet.</p>';
}
function wsAudit(sim) {
  return { html: `<section class="panel"><div class="panel-h"><h2>Audit history for ${sim.code}</h2><small class="muted">Baseline ${sim.baselineMeta.id} · snapshot ${sim.baselineMeta.snapshot} · ${esc(sim.baselineMeta.model)}</small></div>${auditTable(S.audit.filter(a => a.simId === sim.id))}</section>` };
}
