/* =====================================================================
   EVENTS — UI actions → application services (audit + authorization)
   ===================================================================== */
let modalCancel = null;
const curSim = () => { const m = (location.hash || '').match(/^#\/sim\/([\w-]+)/); return m ? simById(m[1]) : null; };
const curScen = sim => sim?.scenarios.find(s => s.id === UI.scen);
const touch = sim => { sim.updatedAt = nowStamp(); if (sim.status === 'Draft' && sim.scenarios.length) sim.status = 'Simulated'; save(); };
const fieldOf = k => Seed.FIELDS.find(f => f.k === k);
const letters = 'ABCDEF';
function refocus(id) { const el = document.getElementById(id); if (el) { el.focus(); const v = el.value; el.value = ''; el.value = v; } }
function traceModal(title, rows, extra = '') {
  openModal({ title, cancel: 'Close', body: `<table class="tbl trace-t"><tbody>${rows.map(([l, v, n]) => `<tr class="${/^=/.test(l) ? 'tot' : ''}"><td>${esc(l)}</td><td class="r">${v == null ? '' : cr(v, 3)}</td><td><small>${esc(n || '')}</small></td></tr>`).join('')}</tbody></table>${extra}<p class="muted sm">Deterministic calculation from the Prism simulation engine. Simplified management view — not a regulatory figure.</p>` });
}

document.addEventListener('click', e => {
  const pm = $('#pmenu'); if (pm && !e.target.closest('.persona') && !e.target.closest('#pmenu')) pm.classList.remove('open');
  const goRow = e.target.closest('[data-go]');
  const el = e.target.closest('[data-act]');
  if (goRow && !el && !e.target.closest('a,button,input,select')) { go(goRow.dataset.go); return; }
  if (!el) { if (e.target.id === 'modal') { closeModal(); } return; }
  const act = el.dataset.act; const id = el.dataset.id; const sim = curSim();
  const A = ACTIONS[act]; if (A) { if (el.tagName !== 'INPUT') e.preventDefault(); A(el, sim, id); }
});

const ACTIONS = {
  'login': (el, s, id) => { S.userId = id; audit('Signed in', { newV: Seed.ROLES[me().role] }); save(); if (!location.hash || location.hash === '#/') location.hash = '#/home'; render(); },
  'persona-menu': () => $('#pmenu').classList.toggle('open'),
  'switch-user': (el, s, id) => { const old = me().name; S.userId = id; audit('Switched persona', { oldV: old, newV: `${me().name} (${Seed.ROLES[me().role]})` }); save(); notify(`Now acting as ${me().name}, ${Seed.ROLES[me().role]}.`); render(); },
  'logout': () => { S.userId = null; save(); render(); },
  'modal-close': () => { const c = modalCancel; modalCancel = null; closeModal(); c && c(); },
  'modal-ok': () => { const v = modalValues(); const r = modalHandler && modalHandler(v); if (r === false) return; modalCancel = null; closeModal(); },
  'print': () => window.print(),
  'reset-demo': () => openModal({ title: 'Reset demo data', danger: true, confirm: 'Reset', body: '<p>Restores the seeded customers, simulations, approvals and outcomes. Your changes in this browser will be lost.</p>', onConfirm: () => { const u = S.userId; try { localStorage.removeItem(STORE_KEY); } catch (e) { } freshState(); S.userId = u; UI.sens = null; save(); notify('Demo data reset.'); go('#/home'); } }),

  /* simulations */
  'new-sim': (el, s, id) => {
    const c = custById(id);
    openModal({ title: `New simulation — ${c.name}`, confirm: 'Create simulation', body: `<label class="blk">Simulation name<input name="name" value="${esc(c.name.replace(/ (Ltd\.|Co\.)$/, ''))} — FY27 pricing renewal"></label>
      <label class="blk">Business question<textarea name="q" rows="2">The customer is asking for a 40 bps reduction in working-capital pricing. What can the bank offer while maintaining acceptable total relationship economics?</textarea></label>
      <fieldset class="blk"><legend>Start from</legend><label class="radio"><input type="radio" name="tpl" value="renewal" checked> Relationship renewal template — Scenario A (price only), B (price for deposits), C (full relationship)</label><label class="radio"><input type="radio" name="tpl" value="blank"> One scenario copied from the baseline</label></fieldset>
      <p class="muted sm">The baseline is frozen from snapshot ${Seed.AS_OF}. You can add, clone and edit scenarios afterwards.</p>`,
      onConfirm: v => {
        const tpl = document.querySelector('#modal [name=tpl]:checked').value;
        const sim = newRelationshipSim(c, { name: v.name, question: v.q, template: tpl === 'renewal' ? 'renewal' : 'blank' });
        S.sims.push(sim); audit('Simulation created', { simId: sim.id, newV: `Baseline ${sim.baselineMeta.id}`, status: sim.status });
        sim.scenarios.forEach(sc => audit(`Scenario added: ${sc.name}`, { simId: sim.id, scenario: sc.name, rationale: sc.note }));
        UI.scen = sim.scenarios[0]?.id || 'base'; save(); go(`#/sim/${sim.id}/build`);
      } });
  },
  'pick-scen': (el, sim, id) => { UI.scen = id; render(); },
  'scen-add': (el, sim) => {
    if (sim.scenarios.length >= 6) return notify('Up to six scenarios per simulation in this POC.', 'err');
    const used = sim.scenarios.map(s => s.name); const L = [...letters].find(l => !used.some(n => n.startsWith(`Scenario ${l}`))) || 'X';
    const sc = Scen.make(`Scenario ${L}`, sim.baseline, {}, 'Copy of baseline.'); sim.scenarios.push(sc); UI.scen = sc.id;
    audit(`Scenario added: ${sc.name}`, { simId: sim.id, scenario: sc.name }); touch(sim); render();
  },
  'scen-clone': (el, sim) => {
    const cur = curScen(sim); if (!cur || sim.scenarios.length >= 6) return;
    const sc = Scen.make(`${cur.name} (copy)`, cur.a, cur.cls, `Cloned from ${cur.name} v${cur.version}.`); sim.scenarios.push(sc); UI.scen = sc.id;
    audit('Scenario cloned', { simId: sim.id, scenario: sc.name, oldV: cur.name }); touch(sim); render();
  },
  'scen-rename': (el, sim) => { const cur = curScen(sim); openModal({ title: 'Rename scenario', confirm: 'Rename', body: `<label class="blk">Name<input name="n" value="${esc(cur.name)}"></label>`, onConfirm: v => { if (!v.n.trim()) return false; audit('Scenario renamed', { simId: sim.id, scenario: v.n, oldV: cur.name, newV: v.n }); cur.name = v.n.trim(); touch(sim); render(); } }); },
  'scen-delete': (el, sim) => { const cur = curScen(sim); openModal({ title: `Delete ${cur.name}?`, danger: true, confirm: 'Delete scenario', body: '<p>The scenario and its versions are removed. The audit trail keeps a record.</p>', onConfirm: () => { sim.scenarios = sim.scenarios.filter(s => s !== cur); if (sim.selectedId === cur.id) sim.selectedId = null; audit('Scenario deleted', { simId: sim.id, scenario: cur.name }); UI.scen = sim.scenarios[0]?.id || 'base'; touch(sim); render(); } }); },
  'scen-version': (el, sim) => { const cur = curScen(sim); openModal({ title: `Save version of ${cur.name}`, confirm: 'Save version', body: `<label class="blk">Version note<input name="n" placeholder="e.g. Customer counter-offer 22-Sep"></label>`, onConfirm: v => { cur.versions.push({ v: ++cur.version, at: nowStamp(), by: me().name, note: v.n || 'Saved', a: { ...cur.a } }); audit(`Scenario version saved (v${cur.version})`, { simId: sim.id, scenario: cur.name, rationale: v.n }); touch(sim); render(); } }); },
  'scen-history': (el, sim) => {
    const cur = curScen(sim); if (!cur) return; const ed = Auth.can('scenario.edit', { sim });
    openModal({ title: `Versions — ${cur.name}`, cancel: 'Close', body: `<table class="tbl"><thead><tr><th>Version</th><th>Saved</th><th>By</th><th>Note</th><th>WC rate</th><th>Deposits</th><th></th></tr></thead><tbody>${cur.versions.slice().reverse().map(v => `<tr><td>v${v.v}</td><td>${fmtDT(v.at)}</td><td>${esc(v.by)}</td><td>${esc(v.note)}</td><td>${pct(v.a.wcRate, 2)}</td><td>${cr(v.a.depBal, 1)}</td><td>${ed && v.v !== cur.version ? `<button class="btn sm ghost" data-act="scen-restore" data-v="${v.v}">Restore</button>` : ''}</td></tr>`).join('')}</tbody></table>` });
  },
  'scen-restore': (el, sim) => { const cur = curScen(sim); const v = cur.versions.find(x => x.v === +el.dataset.v); cur.a = { ...v.a }; cur.versions.push({ v: ++cur.version, at: nowStamp(), by: me().name, note: `Restored v${v.v}`, a: { ...cur.a } }); audit(`Scenario restored to v${v.v}`, { simId: sim.id, scenario: cur.name }); closeModal(); touch(sim); render(); },
  'trace': (el, sim) => {
    const cur = curScen(sim); const r = E.simulate(cur ? cur.a : sim.baseline, sim.baseline, S.cfg); const k = el.dataset.k;
    traceModal(`How was this calculated? — ${{ revenue: 'Revenue', nii: 'Net interest income', profit: 'Relationship profit', raroc: 'RAROC', rwa: 'RWA' }[k]} (${cur ? cur.name : 'Baseline'})`, r.trace[k], k === 'revenue' ? `<h3 class="sub">Pricing engine trace</h3><ol class="trace">${r.trace.pricing.map(t => `<li>${esc(t)}</li>`).join('')}</ol>` : '');
  },
  'trace-c': (el, s, id) => { const c = custById(id); traceModal(`How was this calculated? — ${c.name}`, E.simulate(c.a, null, S.cfg).trace[el.dataset.k]); },
  'nl-parse': (el, sim) => {
    const text = $('#nl').value.trim(); if (!text) return notify('Type a change first, e.g. “reduce lending rate by 30 bps”.', 'err');
    const parsed = AI.parse(text); const cur = curScen(sim);
    if (!parsed.length) return openModal({ title: 'Nothing recognised', cancel: 'Close', body: '<p>I could not find a variable with an amount. Try: “Reduce lending rate by 30 basis points, increase deposits by INR 15 Cr and transactions by 20%”.</p>' });
    const next = AI.applyParsed(cur.a, parsed);
    openModal({ title: 'Parsed assumptions', confirm: 'Confirm & run simulation', body: `<p class="muted">“${esc(text)}”</p><table class="tbl"><thead><tr><th>Variable</th><th>Change</th><th>From</th><th>To</th></tr></thead><tbody>${parsed.map(p => { const f = fieldOf(p.key); return `<tr><td>${esc(p.label)}</td><td><b>${esc(p.display)}</b></td><td>${fieldFmt(f, cur.a[p.key])}</td><td>${fieldFmt(f, next[p.key])}</td></tr>`; }).join('')}</tbody></table><p class="muted sm">Applied to ${esc(cur.name)}. Nothing changes until you confirm.</p>`,
      onConfirm: () => { parsed.forEach(p => { const f = fieldOf(p.key); audit(`${me().name} changed ${f.label.toLowerCase()} from ${fieldFmt(f, cur.a[p.key])} to ${fieldFmt(f, next[p.key])} (natural language)`, { simId: sim.id, scenario: cur.name, oldV: fieldFmt(f, cur.a[p.key]), newV: fieldFmt(f, next[p.key]), rationale: text }); cur.cls[p.key] = 'USER'; }); ['depCommit', 'txnCommit', 'tfCommit'].forEach(k => { if (next[k] !== cur.a[k]) cur.cls[k] = 'USER'; }); cur.a = next; touch(sim); render(); } });
  },
  'select-scen': (el, sim, id) => { if (!Auth.can('scenario.edit', { sim })) return; const old = sim.scenarios.find(s => s.id === sim.selectedId)?.name; sim.selectedId = id; const n = sim.scenarios.find(s => s.id === id).name; audit('Preferred scenario selected', { simId: sim.id, scenario: n, oldV: old || '–', newV: n }); touch(sim); render(); },
  'submit': (el, sim) => {
    const rat = $('#rationale').value.trim(); if (rat.length < 15) return notify('Add a decision rationale (at least a sentence) before submitting.', 'err');
    sim.rationale = rat; const sel = curSimSel(sim); const b = sim.baseline; const base = E.simulate(b, b, S.cfg), res = E.simulate(sel.a, b, S.cfg);
    const req = E.requiredApprovals(sel.a, b, res, base, S.cfg); const w = E.warnings(res, base, sel.a, b, S.cfg, Scen.meta(sim)).filter(x => x.level !== 'info');
    const miss = custById(sim.customerId)?.missing?.length;
    openModal({ title: `Submit ${sel.name} for approval`, confirm: 'Submit for approval', body: `<p>Routing: ${req.map(r => `<b>${Seed.ROLES[r.role]}</b>`).join(' → ')}.</p>${w.length ? `<p>You are acknowledging ${w.length} warning${w.length > 1 ? 's' : ''}:</p><ul class="warns">${w.map(x => `<li class="w-${x.level}"><b>${x.type}</b>${esc(x.text)}</li>`).join('')}</ul>` : ''}${miss ? '<label class="chk"><input type="checkbox" name="ack"> I confirm the estimated PD has been checked with Risk</label>' : ''}<p class="muted sm">The selected scenario is frozen as a new version on submission.</p>`,
      onConfirm: v => { if (miss && !v.ack) { $('#modal-err').textContent = 'Confirm the estimated PD before submitting.'; return false; } Workflow.submit(sim, rat); save(); render(); } });
  },
  'approve': (el, sim) => {
    const step = sim.approvals.find(a => a.status === 'Pending'); if (!Auth.can('approval.act', { sim, step })) return notify(Auth.why('approval.act', { sim, step }), 'err');
    const c = $('#appr-comment').value.trim(); if (!c) return notify(`A comment is required to ${el.dataset.d === 'reject' ? 'reject' : 'approve'}.`, 'err');
    Workflow.act(sim, step, el.dataset.d, c); save(); notify(sim.status === 'Approved' ? `Approved. Decision package ${sim.packageId} generated.` : sim.status === 'Rejected' ? 'Rejected and returned to the owner.' : `Recorded. Next: ${Seed.ROLES[sim.approvals.find(a => a.status === 'Pending').role]}.`); render();
  },
  'execute': (el, sim) => { Workflow.execute(sim); save(); render(); },
  'monitor': (el, sim) => { Workflow.monitor(sim); save(); notify('Outcome monitoring started with mock actuals.'); render(); },

  /* sensitivity */
  'sens-run': () => { document.querySelectorAll('[data-sens]').forEach(i => { if (i.tagName === 'INPUT') UI.sens[i.dataset.sens] = +i.value; }); if (UI.sens.step <= 0 || UI.sens.to <= UI.sens.from) return notify('Set a range with “to” above “from” and a positive step.', 'err'); render(); },
  'sens-save': (el, sim) => { const P = UI.sens; const V = E.SENS_VARS[P.v]; sim.sensRuns = sim.sensRuns || []; const run = { id: `SR-${sim.code.slice(4)}-${sim.sensRuns.length + 1}`, scen: sim.scenarios.find(s => s.id === P.scen)?.name, kpi: P.kpi, label: `${V.label} ${P.from}–${P.to} ${V.unit}, step ${P.step}`, at: nowStamp() }; sim.sensRuns.push(run); audit('Sensitivity run saved', { simId: sim.id, scenario: run.scen, newV: run.id, rationale: run.label }); save(); notify(`Saved ${run.id} to the decision package.`); render(); },

  /* AI */
  'ai-prompt': (el, sim) => aiTurn(sim, el.textContent.trim(), el.dataset.k),
  'ai-ask': (el, sim) => { const q = $('#ai-q').value.trim(); if (!q) return; aiTurn(sim, q, routeFreeText(q)); },
  'ai-add': (el, sim) => {
    const o = UI.aiOpts[+el.dataset.i];
    openModal({ title: `Add ${o.name} as a scenario?`, confirm: 'Add scenario', body: `<p>${esc(o.reason)}</p><ul class="parsed">${o.changed.map(k => { const f = fieldOf(k); return `<li>${esc(f.label)}: ${fieldFmt(f, sim.baseline[k])} → <b>${fieldFmt(f, o.a[k])}</b> ${tag('AI')}</li>`; }).join('')}</ul><p class="muted sm">Values will be tagged “AI recommended”. Editing them later asks for an override rationale.</p>`,
      onConfirm: () => { if (sim.scenarios.length >= 6) { notify('Up to six scenarios.', 'err'); return; } const sc = Scen.make(o.name, o.a, Object.fromEntries(o.changed.map(k => [k, 'AI'])), o.reason); sim.scenarios.push(sc); UI.scen = sc.id; audit('Accepted AI-recommended scenario', { simId: sim.id, scenario: sc.name, rationale: o.reason }); touch(sim); notify(`${sc.name} added.`); render(); } });
  },
  'ai-apply': (el, sim) => {
    const sg = UI.aiSug[+el.dataset.i]; const cur = curScen(sim); if (!cur) return; const f = fieldOf(sg.key);
    openModal({ title: 'Apply AI suggestion?', confirm: 'Apply to scenario', body: `<p>${esc(sg.text)}</p><p>${esc(f.label)}: ${fieldFmt(f, cur.a[sg.key])} → <b>${fieldFmt(f, sg.value)}</b> ${tag('AI')}</p>`,
      onConfirm: () => { const old = cur.a[sg.key]; cur.a[sg.key] = sg.value; cur.cls[sg.key] = 'AI'; if (sg.key === 'depBal' && sg.value > cur.a.depCommit) { cur.a.depCommit = sg.value; cur.cls.depCommit = 'AI'; } if (sg.key === 'txnVol' && sg.value > cur.a.txnCommit) { cur.a.txnCommit = sg.value; cur.cls.txnCommit = 'AI'; } audit(`Applied AI assumption: ${f.label}`, { simId: sim.id, scenario: cur.name, oldV: fieldFmt(f, old), newV: fieldFmt(f, sg.value), rationale: sg.text }); touch(sim); notify('Applied. The value is tagged AI recommended.'); render(); } });
  },
  'nl-confirm': (el, sim) => {
    const parsed = UI.nlParsed; if (!parsed?.length) return; if (sim.scenarios.length >= 6) return notify('Up to six scenarios.', 'err');
    const a = AI.applyParsed(sim.baseline, parsed); const sc = Scen.make(`Scenario · ${parsed.map(p => p.display).join(', ')}`.slice(0, 60), a, Object.fromEntries(parsed.map(p => [p.key, 'USER'])), 'Created from a natural-language request.');
    sim.scenarios.push(sc); UI.scen = sc.id; audit('Scenario created from natural language', { simId: sim.id, scenario: sc.name, rationale: parsed.map(p => `${p.label} ${p.display}`).join('; ') }); touch(sim);
    sim.aiLog.push({ who: 'ai', html: `<p>Ran ${esc(sc.name)}: profit ${cr(E.simulate(a, sim.baseline, S.cfg).kpi.pbt)}, RAROC ${pct(E.simulate(a, sim.baseline, S.cfg).kpi.raroc)}. It is now on the Scenarios tab.</p>` }); save(); render();
  },

  /* prospects, product, rules */
  'pros-create': () => createProspect(),
  'prod-add': () => { const P = productState(); if (P.scen.length >= 7) return; const n = P.scen.length; P.scen.push({ id: 'P' + n + Date.now() % 1000, name: `Option ${letters[n - 1] || n} · Progressive`, ruleId: 'R-CM-PROG', el: -0.35 }); save(); render(); },
  'prod-focus': (el, s, id) => { productState().focus = id; save(); render(); },
  'prod-save': () => { const P = productState(); const cur = 'actual'; const f = P.scen.find(x => x.id === P.focus); const o = E.productSim(CUSTOMERS, f.ruleId === 'actual' ? 'actual' : S.rules.find(r => r.id === f.ruleId), cur, f.el, P.costPerTxn, P.fixedCost);
    const sim = { id: uid('S'), code: nextCode(), type: 'product', name: `Cash management tariff — ${f.name}`, owner: S.userId, status: 'Simulated', createdAt: nowStamp(), updatedAt: nowStamp(), impact: o.profit - o.baseProfit, revImpact: o.revenue - o.baseRevenue, scope: 'Cash Management', scenarios: [], approvals: [] };
    S.sims.push(sim); audit('Product simulation saved', { simId: sim.id, scenario: f.name, newV: `Profit ${cr(o.profit - o.baseProfit)} vs current` }); save(); notify(`Saved ${sim.code} to the decision pipeline.`); },
  'rule-pick': (el, s, id) => { UI.rule = id; render(); },
  'rule-new': () => { const r = { id: `R-${Date.now() % 100000}`, name: 'New rule', type: 'fixed', rate: 5, appliedTo: 'volume', basedOn: 'volume', tiers: [], conditions: { op: 'AND', items: [] }, status: 'Draft', owner: me().name }; S.rules.push(r); UI.rule = r.id; audit('Pricing rule created', { newV: r.id }); save(); render(); },
  'rule-dup': () => { const r = JSON.parse(JSON.stringify(S.rules.find(x => x.id === UI.rule))); r.id = `R-${Date.now() % 100000}`; r.name += ' (copy)'; r.status = 'Draft'; r.owner = me().name; S.rules.push(r); UI.rule = r.id; audit('Pricing rule duplicated', { newV: r.id }); save(); render(); },
  'rule-save': () => { const r = S.rules.find(x => x.id === UI.rule); audit('Pricing rule saved', { newV: `${r.id}: ${ruleSentence(r)}` }); save(); notify('Rule saved. Product simulations using it are recalculated.'); render(); },
  'tier-add': () => { const r = S.rules.find(x => x.id === UI.rule); const last = r.tiers[r.tiers.length - 1]; if (last && last.to == null) last.to = (+last.from || 0) + 1000; r.tiers.push({ from: last ? +last.to : 0, to: null, rate: last ? Math.max(0, last.rate - 1) : 5 }); render(); },
  'tier-del': el => { const r = S.rules.find(x => x.id === UI.rule); r.tiers.splice(+el.dataset.i, 1); render(); },
  'cond-add': () => { const r = S.rules.find(x => x.id === UI.rule); r.conditions.items.push({ metric: 'volume', cmp: '>=', value: 20000 }); if (r.elseRate == null) r.elseRate = 6; render(); },
  'cond-del': el => { const r = S.rules.find(x => x.id === UI.rule); r.conditions.items.splice(+el.dataset.i, 1); render(); },

  /* portfolio, campaign, enterprise */
  'port-save': () => { const L = S.portfolioLevers; const P = E.portfolio(CUSTOMERS.filter(PORTFOLIOS[L.pf][1]), L, S.cfg);
    const sim = { id: uid('S'), code: nextCode(), type: 'portfolio', name: `${PORTFOLIOS[L.pf][0]} — portfolio plan`, owner: S.userId, status: 'Simulated', createdAt: nowStamp(), updatedAt: nowStamp(), impact: P.sim.pbt - P.base.pbt, revImpact: P.sim.revenue - P.base.revenue, scope: PORTFOLIOS[L.pf][0], scenarios: [], approvals: [] };
    S.sims.push(sim); audit('Portfolio simulation saved', { simId: sim.id, newV: `Profit ${cr(sim.impact)}; RAROC ${pct(P.sim.raroc)}`, rationale: JSON.stringify(L) }); save(); notify(`Saved ${sim.code}.`); },
  'camp-save': () => { const C = campState(); const r = E.campaign(C.v[1].p);
    const sim = { id: uid('S'), code: nextCode(), type: 'campaign', name: 'SME deposit growth campaign — Q4', owner: S.userId, status: 'Simulated', createdAt: nowStamp(), updatedAt: nowStamp(), impact: r.profit, revImpact: r.revenue, scope: 'SME · all regions', scenarios: [], approvals: [] };
    S.sims.push(sim); audit('Campaign simulation saved', { simId: sim.id, newV: `ROI ${pct(r.roi, 0)}; break-even response ${pct(r.breakEven)}` }); save(); notify(`Saved ${sim.code}.`); },
  'ent-tpl': (el, s, id) => { const t = E.STRESS_TEMPLATES.find(x => x.id === id); UI.ent.shocks = { ...t.shocks }; UI.ent.name = t.name; render(); },
  'ent-save': () => { const name = $('#ent-name').value.trim() || 'Stress run'; const R = E.enterpriseStress(CUSTOMERS, UI.ent.shocks, S.cfg); const run = { id: `STR-${String(S.stressRuns.length + 1).padStart(3, '0')}`, name, shocks: { ...UI.ent.shocks }, dPbt: R.stressed.pbt - R.base.pbt, raroc: R.stressed.raroc, by: me().name, at: nowStamp() }; S.stressRuns.unshift(run); UI.ent.cmp.push(run.id); audit('Stress run saved', { newV: `${run.id} ${name}`, rationale: shockText(run.shocks) }); save(); notify(`Saved ${run.id}.`); render(); },
  'ent-cmp': (el, s, id) => { const c = UI.ent.cmp; UI.ent.cmp = c.includes(id) ? c.filter(x => x !== id) : [...c, id]; render(); },
  'ent-load': (el, s, id) => { const r = S.stressRuns.find(x => x.id === id); UI.ent.shocks = { ...r.shocks }; UI.ent.name = r.name; render(); },
  'ent-rename': (el, s, id) => { const r = S.stressRuns.find(x => x.id === id); openModal({ title: 'Rename stress run', confirm: 'Rename', body: `<label class="blk">Name<input name="n" value="${esc(r.name)}"></label>`, onConfirm: v => { audit('Stress run renamed', { oldV: r.name, newV: v.n }); r.name = v.n; save(); render(); } }); },
  'apf': el => { UI.apf = el.dataset.s; render(); },
  'oc-pick': (el, s, id) => { UI.oc = id; render(); },
};
const curSimSel = sim => sim.scenarios.find(s => s.id === sim.selectedId);

function aiTurn(sim, q, kind) {
  sim.aiLog = sim.aiLog || []; sim.aiLog.push({ who: 'user', text: q });
  sim.aiLog.push({ who: 'ai', html: aiRespond(sim, kind, q) });
  audit('AI assistant query', { simId: sim.id, rationale: q, newV: { gen: 'Scenario generation', best: 'Scenario ranking', explain: 'Explanation', suggest: 'Assumption suggestions', summary: 'Executive summary', nl: 'Natural-language parse' }[kind] }); save(); render();
}

/* ---------------- inputs ---------------- */
UI.edit = {};
document.addEventListener('input', e => {
  const t = e.target; const sim = curSim();
  if (t.dataset.filter) { UI.cf[t.dataset.filter] = t.type === 'checkbox' ? t.checked : t.value; $('#ctable').innerHTML = customerTable(); return; }
  if (t.dataset.field && sim) {
    const cur = curScen(sim); if (!cur || !Auth.can('scenario.edit', { sim })) return; const k = t.dataset.field; const f = fieldOf(k);
    const v = t.type === 'checkbox' ? t.checked : parseFloat(t.value); if (t.type !== 'checkbox' && isNaN(v)) return;
    if (!(k in UI.edit)) UI.edit[k] = cur.a[k];
    cur.a[k] = v; document.querySelectorAll(`[data-field="${k}"]`).forEach(o => { if (o !== t && o.type !== 'checkbox') o.value = o.type === 'number' ? +Number(v).toFixed(4) : v; });
    const fb = $(`#fb-${k}`); if (fb) fb.innerHTML = v !== sim.baseline[k] ? `<small>was ${fieldFmt(f, sim.baseline[k])}</small>` : '<small class="muted">= baseline</small>';
    t.closest('.frow')?.classList.toggle('chg', v !== sim.baseline[k]);
    $('#impact').innerHTML = impactPanel(sim);
    if (t.type === 'checkbox') commitField(sim, cur, k);
    return;
  }
  if (t.dataset.lever) { const k = t.dataset.lever; if (t.type === 'range') { const L = S.portfolioLevers; L[k] = +t.value; const lb = $(`#lv-${k}`); if (lb) lb.textContent = `${L[k] > 0 ? '+' : ''}${L[k]}${k === 'pricingBps' || k === 'cofBps' ? ' bps' : '%'}`; } return; }
  if (t.dataset.shock) { UI.ent.shocks[t.dataset.shock] = +t.value; const lb = t.previousElementSibling?.querySelector('b'); if (lb) lb.textContent = `${+t.value > 0 ? '+' : ''}${t.value}${t.dataset.shock.endsWith('Bps') ? ' bps' : '%'}`; return; }
  if (t.id === 'auq') { UI.auq = t.value; render(); refocus('auq'); return; }
});
function commitField(sim, cur, k) {
  if (!(k in UI.edit)) return; const old = UI.edit[k]; delete UI.edit[k]; const nv = cur.a[k]; if (old === nv) return; const f = fieldOf(k);
  const log = rationale => { audit(cur.cls[k] === 'AI' ? `${me().name} overrode AI ${f.label.toLowerCase()} from ${fieldFmt(f, old)} to ${fieldFmt(f, nv)}` : `${me().name} changed ${f.label.toLowerCase()} from ${fieldFmt(f, old)} to ${fieldFmt(f, nv)}`, { simId: sim.id, scenario: cur.name, oldV: fieldFmt(f, old), newV: fieldFmt(f, nv), rationale }); cur.cls[k] = 'USER'; touch(sim); };
  if (cur.cls[k] === 'AI') {
    modalCancel = () => { cur.a[k] = old; render(); };
    openModal({ title: 'Override AI recommendation', confirm: 'Override', body: `<p>${esc(f.label)} was set by the AI assistant to <b>${fieldFmt(f, old)}</b>. You are changing it to <b>${fieldFmt(f, nv)}</b>.</p><label class="blk">Override rationale (required)<textarea name="r" rows="3" placeholder="e.g. Customer confirmed a lower ceiling in the 24-Sep meeting"></textarea></label>`,
      onConfirm: v => { if (!v.r.trim()) { $('#modal-err').textContent = 'A rationale is required to override an AI recommendation.'; return false; } log(v.r.trim()); render(); } });
  } else { log(''); const tg = document.querySelector(`[data-row="${k}"] .fl .cls`); if (tg) tg.outerHTML = tag('USER'); }
}
document.addEventListener('change', e => {
  const t = e.target; const sim = curSim();
  if (t.dataset.field && sim && t.type !== 'checkbox') { const cur = curScen(sim); if (cur) commitField(sim, cur, t.dataset.field); return; }
  if (t.dataset.sens) { const k = t.dataset.sens; if (t.tagName === 'SELECT') { UI.sens[k] = t.value; if (k === 'v') { const d = JSON.parse(t.dataset.defs)[t.value]; [UI.sens.from, UI.sens.to, UI.sens.step] = d; } render(); } else UI.sens[k] = +t.value; return; }
  if (t.dataset.drv) { if (t.dataset.drv === 'scen') UI.drvScen = t.value; else UI.drvKpi = t.value; render(); return; }
  if (t.dataset.stress) { UI.stressKpi = t.value; render(); return; }
  if (t.dataset.pros) { UI.pros[t.dataset.pros] = t.type === 'number' ? +t.value : t.value; return; }
  if (t.dataset.prod) { productState()[t.dataset.prod] = +t.value; save(); render(); return; }
  if (t.dataset.prodrule) { const s = productState().scen.find(x => x.id === t.dataset.prodrule); audit('Product option rule changed', { scenario: s.name, oldV: s.ruleId, newV: t.value }); s.ruleId = t.value; save(); render(); return; }
  if (t.dataset.prodel) { const s = productState().scen.find(x => x.id === t.dataset.prodel); s.el = clamp(+t.value, -2, 0); save(); render(); return; }
  if (t.dataset.rule) { const r = S.rules.find(x => x.id === UI.rule); const k = t.dataset.rule; const num = ['rate', 'pct', 'elseRate'].includes(k); const opt = ['min', 'max'].includes(k);
    if (k === 'condOp') r.conditions.op = t.value; else r[k] = num ? +t.value : opt ? (t.value === '' ? '' : +t.value) : t.value;
    if (k === 'type' && ['slab', 'progressive'].includes(t.value) && !r.tiers.length) r.tiers = [{ from: 0, to: 1000, rate: 8 }, { from: 1000, to: 5000, rate: 6 }, { from: 5000, to: null, rate: 4 }];
    if (k === 'type' && t.value === 'fixed' && r.rate == null) r.rate = 5; if (k === 'type' && t.value === 'percent') { r.pct ??= 0.25; r.appliedTo = 'value'; }
    render(); return; }
  if (t.dataset.tier) { const r = S.rules.find(x => x.id === UI.rule); const tr = r.tiers[+t.dataset.tier]; tr[t.dataset.tk] = t.value === '' && t.dataset.tk === 'to' ? null : +t.value; render(); return; }
  if (t.dataset.cond) { const r = S.rules.find(x => x.id === UI.rule); const c = r.conditions.items[+t.dataset.cond]; c[t.dataset.ck] = t.dataset.ck === 'value' ? +t.value : t.value; render(); return; }
  if (t.dataset.rtest) { UI.ruleTest[t.dataset.rtest] = +t.value; render(); return; }
  if (t.dataset.lever) { const L = S.portfolioLevers; const k = t.dataset.lever; L[k] = t.type === 'checkbox' ? t.checked : k === 'pf' ? t.value : +t.value; save(); render(); return; }
  if (t.dataset.shock) { render(); return; }
  if (t.dataset.camp) { const C = campState(); C.v[+t.dataset.camp].p[t.dataset.k] = +t.value; save(); render(); return; }
  if (t.dataset.cfg) { if (!Auth.can('admin.edit')) return; const k = t.dataset.cfg; const old = S.cfg[k]; S.cfg[k] = t.type === 'checkbox' ? t.checked : +t.value; audit(`Configuration changed: ${k}`, { oldV: String(old), newV: String(S.cfg[k]) }); save(); notify('Configuration updated. Warnings and routing now use the new value.'); render(); return; }
});
document.addEventListener('toggle', e => { const d = e.target; if (d.dataset?.group) UI.open[d.dataset.group] = d.open; }, true);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#modal').classList.contains('open')) ACTIONS['modal-close']();
  if (e.key === 'Enter' && e.target.id === 'ai-q') { e.preventDefault(); ACTIONS['ai-ask'](null, curSim()); }
  if (e.key === 'Enter' && e.target.id === 'nl') { e.preventDefault(); ACTIONS['nl-parse'](null, curSim()); }
});

/* ---------------- boot ---------------- */
load();
window.addEventListener('hashchange', render);
render();
