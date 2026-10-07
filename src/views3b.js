/* =====================================================================
   VIEWS 3b — Campaign · Enterprise stress · Library · Approvals ·
              Decision package · Outcomes · Audit · Administration
   ===================================================================== */

/* ---------------- Campaign ---------------- */
const CAMP_IN = [['targetCustomers', 'Target customers', 1, ''], ['populationPct', 'Campaign population', 5, '%'], ['responsePct', 'Expected response rate', 0.5, '%'], ['upliftLakh', 'Deposit uplift per responder', 5, '₹ L'], ['promoRate', 'Promotional interest rate', 0.05, '%'], ['oldRate', 'Rate on existing balances', 0.05, '%'], ['ftpCredit', 'FTP credit (1-year TD)', 0.05, '%'], ['cannibalPct', 'Cannibalisation of existing balances', 1, '%'], ['retentionPct', 'Retention at promo expiry', 5, '%'], ['crossSellPct', 'Cross-sell take-up', 1, '%'], ['crossSellRevLakh', 'Revenue per cross-sell', 0.1, '₹ L'], ['fixedCost', 'Fixed campaign cost', 0.05, '₹ Cr'], ['contactCostInr', 'Cost per contact', 50, '₹']];
function campState() {
  if (!S.campaign) { const base = { targetCustomers: 1200, populationPct: 60, responsePct: 12, upliftLakh: 90, promoRate: 6.5, oldRate: 5.0, ftpCredit: 7.4, fixedCost: 0.25, contactCostInr: 1200, retentionPct: 70, cannibalPct: 15, crossSellPct: 20, crossSellRevLakh: 2.5 };
    S.campaign = { v: [{ name: 'Conservative', p: { ...base, responsePct: 8, upliftLakh: 70, retentionPct: 60 } }, { name: 'Base case', p: base }, { name: 'Aggressive rate', p: { ...base, promoRate: 6.9, responsePct: 17, upliftLakh: 110, cannibalPct: 25 } }] }; }
  return S.campaign;
}
route(/^#\/campaign$/, () => {
  const C = campState(); const ed = Auth.can('campaign.edit'); const R = C.v.map(x => E.campaign(x.p));
  const out = [['Customers contacted', r => int(r.contacted)], ['Responders', r => int(r.responders)], ['Gross new balances', r => cr(r.grossNew, 1)], ['Incremental balances (net of cannibalisation)', r => cr(r.incremental, 1)], ['Balances retained after promo', r => cr(r.yearEndBal, 1)], ['Incremental NII', r => cr(r.nii)], ['Cross-sell revenue', r => cr(r.crossSell)], ['Incremental revenue', r => cr(r.revenue), 'key'], ['Incremental cost (incl. repricing of existing balances)', r => cr(r.cost)], ['Expected profit', r => `<span class="${r.profit >= 0 ? 'pos-t' : 'neg-t'}">${cr(r.profit)}</span>`, 'key'], ['Campaign ROI', r => pct(r.roi, 0), 'key'], ['Break-even response rate', r => pct(r.breakEven, 1)]];
  const lines = C.v.map((x, i) => ({ name: x.name, color: SCEN_COLORS[i], points: Array.from({ length: 13 }, (_, j) => ({ x: j * 2, y: E.campaign({ ...x.p, responsePct: j * 2 }).profit })) }));
  const html = `<section class="panel"><div class="panel-h"><h2>SME deposit growth campaign</h2><small class="muted">Inputs are user assumptions except the FTP credit (Treasury) and retention (behavioural model)</small>${ed ? '<button class="btn primary" data-act="camp-save">Save to pipeline</button>' : ''}</div>
  <div class="tbl-wrap"><table class="tbl cmp"><thead><tr><th>Inputs</th>${C.v.map((x, i) => `<th><span class="swatch" style="background:${SCEN_COLORS[i]}"></span>${esc(x.name)}</th>`).join('')}</tr></thead><tbody>
  ${CAMP_IN.map(([k, l, st, u]) => `<tr><th>${l}${u ? ` <small>(${u})</small>` : ''} ${tag(k === 'ftpCredit' ? 'OBS' : k === 'retentionPct' ? 'MODEL' : 'USER')}</th>${C.v.map((x, i) => `<td><input type="number" class="num" step="${st}" value="${x.p[k]}" data-camp="${i}" data-k="${k}" ${ed ? '' : 'disabled'}></td>`).join('')}</tr>`).join('')}
  <tr class="sep"><th colspan="${C.v.length + 1}">Outputs</th></tr>
  ${out.map(([l, f, kind]) => `<tr class="${kind === 'key' ? 'keyrow' : ''}"><th>${l}</th>${R.map(r => `<td>${f(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>
  <section class="panel"><div class="panel-h"><h2>Profit versus response rate</h2><small class="muted">Where each line crosses zero is its break-even response rate</small></div>${Chart.line({ series: lines, h: 250, xFmt: v => v + '%', yFmt: v => fmt(v, 2), target: 0, xLabel: 'Response rate' })}
  <p class="insight">The base case breaks even at a ${pct(R[1].breakEven, 1)} response rate against an assumed ${pct(C.v[1].p.responsePct, 0)}. The aggressive rate attracts more money but ${R[2].profit < R[1].profit ? 'earns less' : 'earns more'} because ${pct(C.v[2].p.cannibalPct, 0)} of it is existing balances being repriced upward.</p></section>`;
  return { html, title: 'Campaign simulation', crumbs: '<span>Simulate</span>' };
});

/* ---------------- Enterprise stress ---------------- */
UI.ent = UI.ent || { name: 'CFO combined stress', shocks: { rateBps: -100, cofBps: 50, riskPct: 15, depPct: 0, txnPct: 0 }, cmp: [] };
route(/^#\/enterprise$/, () => {
  const X = UI.ent; const sh = X.shocks; const R = E.enterpriseStress(CUSTOMERS, sh, S.cfg); const b = R.base, s = R.stressed; const can = Auth.can('stress.save');
  const shk = (k, l, min, max, step, u) => `<div class="lever"><div class="row sb"><span>${l}</span><b>${sh[k] > 0 ? '+' : ''}${sh[k]}${u}</b></div><input type="range" min="${min}" max="${max}" step="${step}" value="${sh[k]}" data-shock="${k}"></div>`;
  const kp = [['NII', b.nii, s.nii], ['Revenue', b.revenue, s.revenue], ['Profit before tax', b.pbt, s.pbt], ['RAROC', b.raroc, s.raroc, 'pp'], ['RWA', b.rwa, s.rwa, 'Cr', true], ['Capital consumed', b.capital, s.capital, 'Cr', true]];
  const cmpRuns = S.stressRuns.filter(r => X.cmp.includes(r.id));
  const html = `<div class="grid-1-2"><section class="panel"><div class="panel-h"><h2>Stress scenario</h2></div>
  <div class="tpl-btns">${E.STRESS_TEMPLATES.map(t => `<button class="btn sm ghost" data-act="ent-tpl" data-id="${t.id}">${esc(t.name)}</button>`).join('')}</div>
  ${shk('rateBps', 'Benchmark rate shock', -200, 200, 25, ' bps')}${shk('cofBps', 'Cost of funds shock', -100, 150, 5, ' bps')}${shk('riskPct', 'Risk cost change', -30, 100, 5, '%')}${shk('depPct', 'Deposit balances', -30, 20, 1, '%')}${shk('txnPct', 'Transaction volumes', -40, 20, 1, '%')}
  <label class="blk">Run name<input id="ent-name" value="${esc(X.name)}"></label>
  ${can ? '<button class="btn primary" data-act="ent-save">Save stress run</button>' : `<p class="muted sm">${esc(Auth.why('stress.save'))}</p>`}
  <p class="muted sm">Pass-through: floating loans reprice 75% of a rate move, loan FTP 50%, deposit FTP credit 100%, customer deposit rates 30%.</p></section>
  <div class="stack-col"><section class="panel"><div class="panel-h"><h2>Enterprise impact — ${CUSTOMERS.length} relationships</h2></div>
  <div class="tiles three">${kp.map(k => `<div class="tile"><span>${k[0]}</span><b>${k[3] === 'pp' ? pct(k[2]) : cr(k[2], 1)}</b>${k[3] === 'pp' ? dlt(k[2], k[1], { pp: true }) : dlt(k[2], k[1], { unit: 'Cr', inverse: k[4] })}<small class="muted">was ${k[3] === 'pp' ? pct(k[1]) : cr(k[1], 1)}</small></div>`).join('')}</div></section>
  <div class="grid-2"><section class="panel"><div class="panel-h"><h2>Most impacted segments</h2></div><table class="tbl"><thead><tr><th>Segment</th><th class="r">Profit change</th><th class="r">Stressed RAROC</th></tr></thead><tbody>${R.segments.map(g => `<tr><td>${g.name}</td><td class="r neg-t">${cr(g.dPbt)} <small>${fmt(g.dPct, 1)}%</small></td><td class="r">${pct(g.st.raroc)}</td></tr>`).join('')}</tbody></table>
  <h3 class="sub">By sector</h3><table class="tbl"><tbody>${R.sectors.map(g => `<tr><td>${g.name}</td><td class="r ${g.dPbt < 0 ? 'neg-t' : 'pos-t'}">${cr(g.dPbt)} <small>${fmt(g.dPct, 1)}%</small></td></tr>`).join('')}</tbody></table></section>
  <section class="panel"><div class="panel-h"><h2>Most impacted products</h2></div>${Chart.tornado(R.products.map(p => ({ label: p.name, lo: Math.min(0, p.d), hi: Math.max(0, p.d) })), { w: 440, padL: 150 })}<p class="muted sm">Change in profit contribution by product line. Expected loss shown as its effect on profit.</p></section></div></div></div>
  <section class="panel"><div class="panel-h"><h2>Saved stress runs</h2><small class="muted">Select two or more to compare</small></div>${S.stressRuns.length ? `<table class="tbl"><thead><tr><th></th><th>Name</th><th>Shocks</th><th class="r">Profit change</th><th class="r">RAROC</th><th>Saved by</th><th></th></tr></thead><tbody>${S.stressRuns.map(r => `<tr><td><input type="checkbox" data-act="ent-cmp" data-id="${r.id}" ${X.cmp.includes(r.id) ? 'checked' : ''} aria-label="Compare"></td><td><b>${esc(r.name)}</b><small class="code">${r.id}</small></td><td>${esc(shockText(r.shocks))}</td><td class="r neg-t">${cr(r.dPbt)}</td><td class="r">${pct(r.raroc)}</td><td>${esc(r.by)} · ${fmtDate(r.at)}</td><td><button class="btn sm ghost" data-act="ent-load" data-id="${r.id}">Load</button> <button class="btn sm ghost" data-act="ent-rename" data-id="${r.id}">Rename</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">No saved runs yet. Save the current run to compare it later.</p>'}
  ${cmpRuns.length > 1 ? `<h3 class="sub">Comparison</h3><div class="tbl-wrap"><table class="tbl cmp"><thead><tr><th></th><th>Unstressed</th>${cmpRuns.map(r => `<th>${esc(r.name)}</th>`).join('')}</tr></thead><tbody>${['nii', 'revenue', 'pbt', 'raroc', 'rwa', 'capital'].map(k => { const base = E.enterpriseStress(CUSTOMERS, {}, S.cfg).base; return `<tr><th>${{ nii: 'NII', revenue: 'Revenue', pbt: 'Profit before tax', raroc: 'RAROC', rwa: 'RWA', capital: 'Capital' }[k]}</th><td>${k === 'raroc' ? pct(base[k]) : cr(base[k], 1)}</td>${cmpRuns.map(r => { const v = E.enterpriseStress(CUSTOMERS, r.shocks, S.cfg).stressed[k]; return `<td>${k === 'raroc' ? pct(v) : cr(v, 1)}<br>${k === 'raroc' ? dlt(v, base[k], { pp: true }) : dlt(v, base[k], { unit: 'Cr', inverse: ['rwa', 'capital'].includes(k) })}</td>`; }).join('')}</tr>`; }).join('')}</tbody></table></div>` : ''}</section>`;
  return { html, title: 'Enterprise stress simulation', crumbs: '<span>Simulate</span>' };
});
const shockText = s => [s.rateBps && `rates ${s.rateBps > 0 ? '+' : ''}${s.rateBps} bps`, s.cofBps && `COF ${s.cofBps > 0 ? '+' : ''}${s.cofBps} bps`, s.riskPct && `risk ${s.riskPct > 0 ? '+' : ''}${s.riskPct}%`, s.depPct && `deposits ${s.depPct}%`, s.txnPct && `transactions ${s.txnPct}%`].filter(Boolean).join(', ') || 'No shock';

/* ---------------- Scenario library ---------------- */
route(/^#\/library$/, () => {
  const dest = { Relationship: '#/customer/CORP000184', Prospect: '#/prospects', Product: '#/product', Campaign: '#/campaign', Portfolio: '#/portfolio', Enterprise: '#/enterprise' };
  const html = `<section class="panel"><div class="panel-h"><h2>Scenario templates</h2><small class="muted">Reusable starting points with governed variable sets</small></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Template</th><th>Purpose</th><th>Personas</th><th>Variables</th><th>Owner</th><th>Last modified</th><th>Status</th><th></th></tr></thead><tbody>
  ${Seed.TEMPLATES.map(t => `<tr><td><b>${esc(t.name)}</b><small class="code">${t.id} · ${t.kind}</small></td><td>${esc(t.purpose)}</td><td>${esc(t.personas)}</td><td>${esc(t.variables)}</td><td>${esc(t.owner)}</td><td class="nowrap">${t.modified}</td><td>${statusPill(t.status === 'Published' ? 'Approved' : 'Draft').replace('Approved', 'Published')}</td><td><a class="btn sm ghost" href="${dest[t.kind]}">Use</a></td></tr>`).join('')}</tbody></table></div>
  <p class="muted sm">Relationship templates open Customer 360; the renewal template is offered when you create a simulation.</p></section>
  <section class="panel"><div class="panel-h"><h2>Stress templates</h2></div><table class="tbl"><tbody>${E.STRESS_TEMPLATES.map(t => `<tr><td><b>${esc(t.name)}</b></td><td>${esc(shockText(t.shocks))}</td></tr>`).join('')}</tbody></table></section>`;
  return { html, title: 'Scenario library', crumbs: '<span>Govern</span>' };
});

/* ---------------- Approvals workbench ---------------- */
UI.apf = UI.apf || '';
route(/^#\/approvals$/, () => {
  const u = me();
  const queue = S.sims.filter(s => { const p = s.approvals?.find(a => a.status === 'Pending'); return p && p.role === u.role; });
  const list = S.sims.filter(s => !UI.apf || s.status === UI.apf).sort((p, q) => q.updatedAt.localeCompare(p.updatedAt));
  const html = `<section class="panel"><div class="panel-h"><h2>Your approval queue</h2><small class="muted">${esc(Seed.ROLES[u.role])} · maker-checker ${S.cfg.makerChecker ? 'enforced' : 'off'}</small></div>
  ${queue.length ? `<table class="tbl"><thead><tr><th>Simulation</th><th>Submitted by</th><th>Step</th><th>Reason</th><th class="r">Profit impact</th><th></th></tr></thead><tbody>${queue.map(s => { const p = s.approvals.find(a => a.status === 'Pending'); const self = S.cfg.makerChecker && s.owner === u.id; return `<tr><td><b>${esc(s.name)}</b><small class="code">${s.code}</small></td><td>${esc(userById(s.owner).name)}</td><td>${esc(p.label)}</td><td>${esc(p.reason)}</td><td class="r">${cr(Scen.impact(s))}</td><td>${self ? '<span class="lock">Own simulation</span>' : `<a class="btn sm primary" href="#/sim/${s.id}/decision">Review</a>`}</td></tr>`; }).join('')}</tbody></table>` : `<p class="muted">Nothing is waiting for ${esc(Seed.ROLES[u.role])}. Pending items for other roles are listed below.</p>`}</section>
  <section class="panel"><div class="panel-h"><h2>All decisions</h2><div class="seg-f">${['', ...Workflow.STATUSES].map(s => `<button class="${UI.apf === s ? 'on' : ''}" data-act="apf" data-s="${s}">${s || 'All'}</button>`).join('')}</div></div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Simulation</th><th>Type</th><th>Owner</th><th>Status</th><th>Next step</th><th>Updated</th><th class="r">Profit impact</th><th></th></tr></thead><tbody>${list.map(s => { const p = s.approvals?.find(a => a.status === 'Pending'); return `<tr class="click" data-go="${simLink(s)}"><td><b>${esc(s.name)}</b><small class="code">${s.code}</small></td><td>${TYPE_LABEL[s.type]}</td><td>${esc(userById(s.owner).name)}</td><td>${statusPill(s.status)}</td><td>${p ? esc(Seed.ROLES[p.role]) : '–'}</td><td>${fmtDate(s.updatedAt)}</td><td class="r">${cr(Scen.impact(s))}</td><td>${s.packageId ? `<a class="lnk" href="#/package/${s.id}">${s.packageId}</a>` : ''}</td></tr>`; }).join('')}</tbody></table></div></section>`;
  return { html, title: 'Decisions & approvals', crumbs: '<span>Govern</span>' };
});

/* ---------------- Decision package ---------------- */
route(/^#\/package\/([\w-]+)$/, id => {
  const sim = simById(id); if (!sim?.baseline) return { html: '<div class="panel empty">Decision packages are available for relationship and prospect simulations.</div>', title: 'Decision package' };
  const final = ['Approved', 'Executed', 'Monitoring'].includes(sim.status); const c = custById(sim.customerId) || sim.prospect; const b = sim.baseline;
  const base = E.simulate(b, b, S.cfg); const sel = sim.scenarios.find(s => s.id === sim.selectedId) || AI.strongest(sim).top?.s; const r = sel ? E.simulate(sel.a, b, S.cfg) : base;
  const changed = sel ? Seed.FIELDS.filter(f => sel.a[f.k] !== b[f.k]) : [];
  const unchangedKey = Seed.FIELDS.filter(f => ['wcFtp', 'depFtp', 'pd', 'lgd', 'riskWeight', 'indirectCost'].includes(f.k));
  const warns = sel ? E.warnings(r, base, sel.a, b, S.cfg, Scen.meta(sim)) : [];
  const drv = sel ? E.drivers(sel.a, b, S.cfg).slice(0, 5) : [];
  const sens = sel ? E.sensitivity(sel.a, b, S.cfg, 'depBal', Math.max(0, Math.round(b.depBal * 0.6)), Math.round(Math.max(sel.a.depBal, b.depBal) * 1.3), 5, 'raroc') : [];
  const stress = sel ? E.STRESS_TEMPLATES.slice(0, 6).map(t => ({ t, x: E.stressOne(sel.a, S.cfg, t.shocks) })) : [];
  const req = sim.approvals?.length ? sim.approvals : sel ? E.requiredApprovals(sel.a, b, r, base, S.cfg).map(x => ({ ...x, status: 'Not submitted' })) : [];
  const k = r.kpi, bk = base.kpi;
  const sec = (t, body) => `<section class="dp-sec"><h2>${t}</h2>${body}</section>`;
  const html = `<div class="dp-tools noprint"><a class="btn ghost" href="#/sim/${sim.id}/decision">Back to simulation</a><button class="btn primary" data-act="print">Print or save as PDF</button></div>
  <article class="dp ${final ? '' : 'draft'}">${final ? '' : '<div class="wm">Draft — not approved</div>'}
  <header class="dp-head"><div><span class="prism-mark"></span><b>ValueMap Prism · Decision package</b></div><div class="r"><b>${sim.packageId || 'Preview'}</b><small>${sim.code} · generated ${fmtDT(nowStamp())}</small></div></header>
  <h1>${esc(sim.name)}</h1><p class="dp-q">${esc(sim.question)}</p>
  ${sec('Decision context', `<dl class="facts"><div><dt>Customer</dt><dd>${esc(c?.name)}${c?.id ? ` (${c.id})` : ''}</dd></div><div><dt>Segment · sector</dt><dd>${esc(c?.segment)} · ${esc(c?.sector)}</dd></div><div><dt>Decision owner</dt><dd>${esc(userById(sim.owner).name)}, ${Seed.ROLES[userById(sim.owner).role]}</dd></div><div><dt>Date</dt><dd>${fmtDate(sim.approvedAt || sim.submittedAt || nowStamp())}</dd></div><div><dt>Baseline</dt><dd>${sim.baselineMeta.id} · as of ${sim.baselineMeta.asOf}</dd></div><div><dt>Data snapshot · models</dt><dd>${sim.baselineMeta.snapshot} · ${esc(sim.baselineMeta.model)}</dd></div></dl>`)}
  ${sec('Baseline position', `<table class="tbl"><tbody><tr><th>Loans</th><td>${cr(b.wcBal + b.tlBal, 1)} (WC ${pct(b.wcRate, 2)})</td><th>Revenue</th><td>${cr(bk.revenue)}</td></tr><tr><th>Deposits</th><td>${cr(b.depBal, 1)}</td><th>Profit before tax</th><td>${cr(bk.pbt)}</td></tr><tr><th>Transactions / month</th><td>${int(b.txnVol)}</td><th>RAROC</th><td>${pct(bk.raroc)}</td></tr><tr><th>Trade finance / year</th><td>${cr(b.tfVol, 1)}</td><th>RWA</th><td>${cr(bk.rwa, 1)}</td></tr></tbody></table>`)}
  ${sec('Assumptions', sel ? `<table class="tbl"><thead><tr><th>Variable</th><th>Baseline</th><th>Selected scenario</th><th>Classification</th><th>Source</th></tr></thead><tbody>${[...changed, ...unchangedKey.filter(f => !changed.includes(f))].map(f => `<tr><td>${esc(f.label)}</td><td>${fieldFmt(f, b[f.k])}</td><td><b>${fieldFmt(f, sel.a[f.k])}</b></td><td>${tag(sel.cls[f.k] || (sel.a[f.k] !== b[f.k] ? 'USER' : f.cls || 'OBS'))}</td><td><small>${esc(Seed.SOURCES.find(s => s.id === f.src).name)}</small></td></tr>`).join('')}</tbody></table>` : '<p>No scenario selected.</p>')}
  ${sec('Scenarios evaluated and comparison', compareTable(sim))}
  ${sec('Financial impact', `<div class="tiles four">${[['Revenue', k.revenue, bk.revenue], ['Profit before tax', k.pbt, bk.pbt], ['Economic value added', k.eva, bk.eva], ['NII', k.nii, bk.nii]].map(t => `<div class="tile"><span>${t[0]}</span><b>${cr(t[1])}</b>${dlt(t[1], t[2], { unit: 'Cr' })}</div>`).join('')}</div>`)}
  ${sec('Customer impact', sel ? `<p>Working-capital rate ${pct(b.wcRate, 2)} → <b>${pct(sel.a.wcRate, 2)}</b> (${Math.round((b.wcRate - sel.a.wcRate) * 100)} bps), saving the customer about ${cr(b.wcBal * (b.wcRate - sel.a.wcRate) / 100)} a year in interest. In return the customer commits to deposits of ${cr(sel.a.depCommit, 1)}, ${int(sel.a.txnCommit)} transactions a month and ${cr(sel.a.tfCommit, 0)} of trade finance a year — today it delivers ${pct(k.commitCoverage, 0)} of these.</p>` : '')}
  ${sec('Risk and capital impact', `<table class="tbl"><tbody><tr><th>RAROC</th><td>${pct(bk.raroc)} → <b>${pct(k.raroc)}</b> (target ${S.cfg.targetRaroc}%)</td></tr><tr><th>RWA</th><td>${cr(bk.rwa, 1)} → <b>${cr(k.rwa, 1)}</b></td></tr><tr><th>Economic capital</th><td>${cr(bk.capital)} → <b>${cr(k.capital)}</b> at ${S.cfg.capitalRatio}% of RWA</td></tr><tr><th>Expected loss</th><td>${cr(bk.el)} → <b>${cr(k.el)}</b></td></tr></tbody></table>`)}
  ${sec('Sensitivity analysis', sel ? `<div class="grid-2"><div>${Chart.line({ series: [{ name: 'RAROC', color: 'var(--brand)', points: sens }], h: 200, yFmt: v => fmt(v, 1) + '%', xFmt: v => fmt(v, 0), target: S.cfg.targetRaroc, xLabel: 'Deposit balance (Cr)' })}</div><div><h3 class="sub">Key drivers of profit</h3><table class="tbl mini"><tbody>${drv.map(d => `<tr><td>${esc(d.label)}</td><td class="r">±${cr(d.range / 2)}</td></tr>`).join('')}</tbody></table><h3 class="sub">Stress results</h3><table class="tbl mini"><tbody>${stress.map(s => `<tr><td>${esc(s.t.name)}</td><td class="r">${cr(s.x.stressed.pbt)}</td><td class="r">${pct(s.x.stressed.raroc)}</td></tr>`).join('')}</tbody></table></div></div>${(sim.sensRuns || []).length ? `<p class="muted sm">Saved sensitivity runs: ${sim.sensRuns.map(x => `${x.id} (${esc(x.label)})`).join('; ')}</p>` : ''}` : '')}
  ${sec('Key risks', warns.length ? `<ul class="warns">${warns.map(x => `<li class="w-${x.level}"><b>${x.type}</b>${esc(x.text)}</li>`).join('')}</ul>` : '<p>No rule-based warnings.</p>')}
  ${sec('AI recommendation', `<p class="ai-note"><span class="cls cls-AI">AI recommended</span> ${esc(AI.strongest(sim).text)}</p><p class="muted sm">${esc(AI.mode)}. Recommendation is advisory; the decision below was made by the owner and approvers.</p>`)}
  ${sec('Selected scenario and decision rationale', `<p><b>${esc(sel?.name || '–')}</b> (version ${sel?.version || '–'})</p><blockquote>${esc(sim.rationale || 'Rationale not yet entered.')}</blockquote>`)}
  ${sec('Approvals', `<table class="tbl"><thead><tr><th>Step</th><th>Reason</th><th>Status</th><th>By</th><th>Comment</th></tr></thead><tbody>${req.map(a => `<tr><td>${esc(a.label)}</td><td>${esc(a.reason)}</td><td>${statusPill(a.status === 'Pending' ? 'Awaiting' : a.status)}</td><td>${esc(a.by || '–')}${a.at ? `<small>${fmtDT(a.at)}</small>` : ''}</td><td>${esc(a.comment || '')}</td></tr>`).join('')}</tbody></table><p>Approval status: ${statusPill(sim.status)}</p>`)}
  ${sec('Audit timeline', auditTable(S.audit.filter(a => a.simId === sim.id).slice().reverse()))}
  <footer class="dp-foot">Demonstration data — not actual bank data. Simplified management-accounting calculations; not regulatory capital, Basel or IFRS 9 figures.</footer></article>`;
  return { html, title: 'Decision package', crumbs: `<a href="#/approvals">Decisions & approvals</a>` };
});

/* ---------------- Outcome tracking ---------------- */
route(/^#\/outcomes$/, () => {
  const items = S.outcomes.filter(o => simById(o.simId)).map(o => ({ o, v: Outcomes.view(o) }));
  const cur = items.find(x => x.o.id === UI.oc) || items[0];
  const cls = s => s === 'Above expectation' ? 'above' : s === 'On track' ? 'ontrack' : 'below';
  const camp = E.campaign({ targetCustomers: 1200, populationPct: 60, responsePct: 12, upliftLakh: 90, promoRate: 6.5, oldRate: 5.0, ftpCredit: 7.4, fixedCost: 0.25, contactCostInr: 1200, retentionPct: 70, cannibalPct: 15, crossSellPct: 20, crossSellRevLakh: 2.5 });
  const html = `<div class="grid-1-2"><section class="panel"><div class="panel-h"><h2>Decisions being monitored</h2></div><ul class="oc-list">${items.map(x => `<li><button class="${x === cur ? 'on' : ''}" data-act="oc-pick" data-id="${x.o.id}"><b>${esc(x.v.sim.name)}</b><small>${x.v.sim.code} · approved ${fmtDate(x.v.sim.approvedAt)} · ${x.o.months} months observed</small><span class="oc ${cls(x.v.status)}">${x.v.status}</span></button></li>`).join('')}
  <li><div class="oc-static"><b>SME deposit growth campaign — Q2</b><small>SIM-1012 · campaign · 4 months observed</small><span class="oc ontrack">On track</span><small>Incremental balances ${cr(camp.incremental * 0.96, 1)} vs ${cr(camp.incremental, 1)} expected (−4%).</small></div></li></ul></section>
  ${cur ? `<div class="stack-col"><section class="panel"><div class="panel-h"><h2>Expected vs actual — ${esc(cur.v.sim.name)}</h2><span class="oc ${cls(cur.v.status)}">${cur.v.status}</span></div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>KPI</th><th class="r">Expected</th><th class="r">Actual</th><th class="r">Variance</th></tr></thead><tbody>${cur.v.rows.map(r => `<tr><td>${r.k}</td><td class="r">${r.f(r.e)}</td><td class="r">${r.f(r.a)}</td><td class="r ${r.v < -2 ? 'neg-t' : r.v > 2 ? 'pos-t' : ''}">${r.v > 0 ? '+' : ''}${fmt(r.v, 1)}${r.pp ? ' pp' : '%'}</td></tr>`).join('')}</tbody></table></div>
  <p class="ai-note"><span class="cls cls-AI">AI recommended</span> ${esc(cur.v.text)}</p><p class="muted sm">Actuals are mock source-system values as of ${cur.o.asOf}. Explanation generated deterministically from the variances.</p></section>
  <section class="panel"><div class="panel-h"><h2>Profit: baseline, expected and actual</h2></div>${Chart.bars([{ label: 'Profit before tax', values: [{ name: 'Pre-decision baseline', color: 'var(--base-c)', v: cur.v.base.pbt }, { name: 'Expected', color: SCEN_COLORS[0], v: cur.v.exp.pbt }, { name: 'Actual', color: SCEN_COLORS[2], v: cur.v.act.pbt }] }, { label: 'Revenue', values: [{ name: 'Pre-decision baseline', color: 'var(--base-c)', v: cur.v.base.revenue }, { name: 'Expected', color: SCEN_COLORS[0], v: cur.v.exp.revenue }, { name: 'Actual', color: SCEN_COLORS[2], v: cur.v.act.revenue }] }], { h: 210, yFmt: v => fmt(v, 1) })}
  <div class="legend"><span><i style="background:var(--base-c)"></i>Pre-decision baseline</span><span><i style="background:${SCEN_COLORS[0]}"></i>Expected</span><span><i style="background:${SCEN_COLORS[2]}"></i>Actual</span></div></section></div>` : '<section class="panel empty">No decisions are being monitored yet. Approve and execute a simulation, then start monitoring.</section>'}</div>`;
  return { html, title: 'Outcome tracking', crumbs: '<span>Govern</span>' };
});

/* ---------------- Audit trail ---------------- */
UI.auq = UI.auq || '';
route(/^#\/audit$/, () => {
  const q = UI.auq.toLowerCase(); const rows = S.audit.filter(a => !q || [a.user, a.action, a.scenario, a.oldV, a.newV, a.rationale, simById(a.simId)?.code].join(' ').toLowerCase().includes(q));
  return { html: `<section class="panel"><div class="filters"><label class="grow">Filter<input id="auq" value="${esc(UI.auq)}" placeholder="User, action, scenario or SIM code"></label></div>${auditTable(rows.slice(0, 300))}<p class="muted sm">${rows.length} events. Every assumption change, AI acceptance or override, submission, approval and status change is recorded.</p></section>`, title: 'Audit trail', crumbs: '<span>Govern</span>' };
});

/* ---------------- Administration ---------------- */
function selfTests() {
  const t = []; const ok = (name, cond, detail) => t.push({ name, pass: !!cond, detail });
  const ctx = { volume: 22000, value: 22000 * 85000, avgValue: 85000, deposit: 25 };
  ok('Pricing · fixed fee', E.evaluatePricing({ type: 'fixed', rate: 5, appliedTo: 'volume' }, ctx).fee === 110000, '22,000 × ₹5 = ₹1,10,000');
  ok('Pricing · percentage of value', Math.abs(E.evaluatePricing({ type: 'percent', pct: 0.25, appliedTo: 'value' }, { ...ctx, volume: 10, value: 1e6, avgValue: 1e5 }).fee - 2500) < 1e-6, '0.25% × ₹10 L = ₹2,500');
  ok('Pricing · min / max', E.evaluatePricing({ type: 'percent', pct: 0.25, min: 500, max: 5000, appliedTo: 'value' }, { volume: 2, value: 2 * 10000, avgValue: 10000 }).fee === 1000, '₹25 per txn floored to ₹500 × 2');
  ok('Pricing · slab', E.evaluatePricing(Seed.RULES[3], { ...ctx, volume: 3000 }).fee === 18000, '3,000 txns in tier 2 → ₹6 on all');
  ok('Pricing · progressive', E.evaluatePricing(Seed.RULES[4], { ...ctx, volume: 6000 }).fee === 36000, '1,000×8 + 4,000×6 + 1,000×4');
  ok('Pricing · based-on value, applied-to volume', E.evaluatePricing(Seed.RULES[5], ctx).fee === 88000, '₹187 Cr > ₹20 Cr → ₹4 × 22,000');
  ok('Pricing · AND condition not met → fallback', E.evaluatePricing(Seed.RULES[7], ctx).fee === 132000, 'Deposit 25 < 40 → ₹6');
  ok('Pricing · AND condition met', E.evaluatePricing(Seed.RULES[7], { ...ctx, volume: 26000, deposit: 45 }).fee === 78000, '₹3 × 26,000');
  const b = Seed.buildCustomers()[0].a; const cfg = Seed.CONFIG; const k = E.simulate(b, b, cfg).kpi;
  ok('Financial · lending contribution', Math.abs(k.lendingNII - 3.55) < 1e-9, '100×(9.25−6.70)% + 40×(9.50−7.00)% = 3.55 Cr');
  ok('Financial · deposit funding value', Math.abs(k.depValue - 1.375) < 1e-9, '25 × (5.50 − 0)% = 1.375 Cr');
  ok('Financial · transaction revenue', Math.abs(k.txnFeeRev - 0.1584) < 1e-9, '22,000 × ₹6 × 12 = 0.1584 Cr');
  ok('Financial · trade finance fee', Math.abs(k.tfFee - 0.54) < 1e-9, '120 × 0.45% = 0.54 Cr');
  ok('Financial · profit identity', Math.abs(k.pbt - (k.revenue - k.totalCost - k.el)) < 1e-9, 'Revenue − cost − expected loss');
  ok('Financial · RAROC identity', Math.abs(k.raroc - k.pat / k.capital * 100) < 1e-9, 'PAT ÷ (RWA × capital ratio)');
  const sc = Seed.renewalScenarios(b).map(s => E.simulate(s.a, b, cfg).kpi);
  ok('Scenario · price cut alone lowers profit', sc[0].pbt < k.pbt, `A ${fmt(sc[0].pbt)} < base ${fmt(k.pbt)}`);
  ok('Scenario · lowest price, strongest economics', sc[2].pbt > sc[1].pbt && sc[1].pbt > k.pbt && sc[2].raroc > sc[1].raroc, `C ${fmt(sc[2].pbt)} > B ${fmt(sc[1].pbt)} > base`);
  ok('Scenario · deterministic', JSON.stringify(E.simulate(b, b, cfg).kpi) === JSON.stringify(E.simulate(b, b, cfg).kpi), 'Same inputs → same outputs');
  const fakeSim = { owner: S.userId, approvals: [{ role: me().role, status: 'Pending', stage: 'approve' }] };
  ok('Workflow · maker cannot approve own simulation', !S.cfg.makerChecker || !Auth.can('approval.act', { sim: fakeSim, step: fakeSim.approvals[0] }), 'Checked with the current persona as maker');
  return t;
}
route(/^#\/admin$/, () => {
  const ed = Auth.can('admin.edit'); const c = S.cfg; const tests = selfTests(); const pass = tests.filter(t => t.pass).length;
  const cf = (k, l, u, step = 1) => `<label>${l}${u ? ` <small>(${u})</small>` : ''}<input type="number" step="${step}" data-cfg="${k}" value="${c[k]}" ${ed ? '' : 'disabled'}></label>`;
  const perms = [['Create relationship simulation', 'relationship.create'], ['Approve (role-matched, not own)', null, ['PM', 'RISK', 'BH', 'RH']], ['Edit product tariffs', 'product.edit'], ['Edit pricing rules', 'rules.edit'], ['Edit portfolio', 'portfolio.edit'], ['Edit campaigns', 'campaign.edit'], ['Save enterprise stress runs', 'stress.save'], ['Change configuration', 'admin.edit']];
  const roleCan = (role, act) => { const keep = S.userId; const u = Seed.USERS.find(x => x.role === role); S.userId = u.id; const r = Auth.can(act); S.userId = keep; return r; };
  const html = `<div class="grid-2"><section class="panel"><div class="panel-h"><h2>Thresholds and policy</h2>${ed ? '' : `<small class="muted">${esc(Auth.why('admin.edit'))} Switch to Vikram Sinha or Rajiv Menon to edit.</small>`}</div>
  <div class="form-grid">${cf('targetRaroc', 'Target RAROC', '%', 0.5)}${cf('minRelProfit', 'Minimum relationship profit', '₹ Cr', 0.1)}${cf('pricingExceptionBps', 'Pricing exception → Pricing Manager', 'bps')}${cf('businessHeadBps', 'Pricing exception → Business Head', 'bps')}${cf('rwaReviewCr', 'RWA increase → Risk review', '₹ Cr')}${cf('capitalRatio', 'Economic capital ratio', '% of RWA', 0.5)}${cf('taxRate', 'Tax rate', '%')}${cf('hurdleRate', 'Cost of equity (EVA hurdle)', '%', 0.5)}${cf('staleDays', 'Data stale after', 'days')}</div>
  <label class="chk"><input type="checkbox" data-cfg="makerChecker" ${c.makerChecker ? 'checked' : ''} ${ed ? '' : 'disabled'}> Maker-checker: creators cannot approve their own simulations</label>
  <label class="chk"><input type="checkbox" data-cfg="rhReview" ${c.rhReview ? 'checked' : ''} ${ed ? '' : 'disabled'}> Relationship Head review before approval</label>
  <p class="muted sm">Thresholds drive warnings and approval routing everywhere; nothing is hard-coded in screens.</p>
  <div class="row gap"><button class="btn danger" data-act="reset-demo">Reset demo data</button></div></section>
  <section class="panel"><div class="panel-h"><h2>Engine self-tests</h2><span class="${pass === tests.length ? 'pos-t' : 'neg-t'}"><b>${pass} / ${tests.length} passing</b></span></div><table class="tbl mini"><tbody>${tests.map(t => `<tr><td>${t.pass ? '<span class="pos-t">Pass</span>' : '<span class="neg-t">Fail</span>'}</td><td>${esc(t.name)}</td><td><small>${esc(t.detail)}</small></td></tr>`).join('')}</tbody></table></section></div>
  <div class="grid-2"><section class="panel"><div class="panel-h"><h2>Mock source systems and data quality</h2></div><table class="tbl"><thead><tr><th>Source</th><th>As of</th><th>Age</th><th>Quality</th></tr></thead><tbody>${Seed.SOURCES.map(s => `<tr><td>${esc(s.name)}</td><td>${s.asOf}</td><td>${s.ageDays} days</td><td><span class="dq dq-${s.ageDays > c.staleDays && s.id === 'TFP' ? 'Stale' : s.quality}">${s.ageDays > c.staleDays && s.id === 'TFP' ? 'Stale' : s.quality}</span></td></tr>`).join('')}</tbody></table>
  <h3 class="sub">Data classification</h3><p>${Object.keys(CLS).map(tag).join(' ')}</p></section>
  <section class="panel"><div class="panel-h"><h2>Roles and permissions</h2></div><div class="tbl-wrap"><table class="tbl mini perm"><thead><tr><th></th>${Object.keys(Seed.ROLES).map(r => `<th title="${Seed.ROLES[r]}">${r}</th>`).join('')}</tr></thead><tbody>${perms.map(p => `<tr><td>${p[0]}</td>${Object.keys(Seed.ROLES).map(r => `<td>${(p[1] ? roleCan(r, p[1]) : p[2].includes(r)) ? '●' : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section></div>
  <section class="panel"><div class="panel-h"><h2>Calculation assumptions</h2></div><div class="prose">
  <p>Lending NII = balance × (customer rate − FTP − cost-of-funds shift). Deposit funding value = balance × (FTP credit + ½ × COF shift − customer rate). Transaction fees come from the pricing rule engine; trade finance commission = annual volume × commission %.</p>
  <p>Profit before tax = revenue − direct and servicing cost − processing cost per transaction − allocated indirect cost − expected loss. Expected loss = EAD × PD × LGD × risk-cost multiplier, where EAD = funded balances + undrawn × CCF + trade finance outstanding (25% of annual volume) × 20%.</p>
  <p>RWA = EAD × risk weight. Economic capital = RWA × ${c.capitalRatio}%. RAROC = profit after ${c.taxRate}% tax ÷ economic capital. EVA = profit after tax − capital × ${c.hurdleRate}%. Commitment fulfilment probability scales only the uplift above baseline.</p>
  <p>Known POC limitations: annual steady-state view without timing or discounting; no behavioural balance run-off beyond the attrition input; simplified pass-through for rate stress; no regulatory capital, Basel, IFRS 9 or ALM calculations; AI assistant is deterministic with no language model connected; data is synthetic and resets from a fixed seed.</p></div></section>`;
  return { html, title: 'Administration', crumbs: '<span>Configure</span>' };
});
