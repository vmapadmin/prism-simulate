/* =====================================================================
   VIEWS 1 — Decision centre · Customers · Customer 360 · Workspace
   ===================================================================== */
const ACTIVE = ['Draft', 'Simulated', 'Under Review', 'Awaiting Approval', 'Rejected'];
const TYPE_LABEL = { relationship: 'Relationship', prospect: 'Prospect', product: 'Product', portfolio: 'Portfolio', campaign: 'Campaign', enterprise: 'Enterprise' };
const simLink = s => s.type === 'relationship' || s.type === 'prospect' ? `#/sim/${s.id}` : { product: '#/product', portfolio: '#/portfolio', campaign: '#/campaign', enterprise: '#/enterprise' }[s.type];
const simScope = s => s.customerId ? custById(s.customerId)?.name || s.prospect?.name : s.scope;

/* ---------------- Decision centre ---------------- */
route(/^#\/home$/, () => {
  const u = me(); const sims = S.sims;
  const active = sims.filter(s => ACTIVE.includes(s.status));
  const awaiting = sims.filter(s => ['Under Review', 'Awaiting Approval'].includes(s.status));
  const done = sims.filter(s => ['Approved', 'Executed', 'Monitoring'].includes(s.status));
  const revUp = active.reduce((t, s) => t + Math.max(0, Scen.revImpact(s)), 0), pbtUp = active.reduce((t, s) => t + Math.max(0, Scen.impact(s)), 0);
  const month = sims.filter(s => s.createdAt?.startsWith('2026-09')).length;
  const kpis = [['Active simulations', active.length, 'Draft to awaiting approval'], ['Awaiting approval', awaiting.length, 'Under review or with approvers'], ['Decisions completed', done.length, 'Approved, executed or monitoring'], ['Potential revenue uplift', cr(revUp, 1), 'Preferred scenarios, active pipeline'], ['Potential profit uplift', cr(pbtUp, 1), 'Profit before tax vs baseline'], ['Created this month', month, 'September 2026']];
  const mine = sims.filter(s => s.approvals?.length && (() => { const p = s.approvals.find(a => a.status === 'Pending'); return p && p.role === u.role; })());
  const drafts = sims.filter(s => s.owner === u.id && ACTIVE.includes(s.status));
  const pipe = Workflow.STATUSES.map(st => ({ st, n: sims.filter(s => s.status === st).length }));
  const maxN = Math.max(...pipe.map(p => p.n), 1);
  const quick = [['Simulate existing customer', '#/customers'], ['Simulate new prospect', '#/prospects'], ['Simulate product', '#/product'], ['Simulate portfolio', '#/portfolio'], ['Simulate campaign', '#/campaign'], ['Run stress test', '#/enterprise']];
  const recent = sims.slice().sort((p, q) => q.createdAt.localeCompare(p.createdAt)).slice(0, 10);
  const html = `
  <section class="hero-strip"><div><h2>Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${esc(u.name.split(' ')[0])}.</h2><p>${mine.length ? `${mine.length} decision${mine.length > 1 ? 's are' : ' is'} waiting for your ${u.role === 'RH' ? 'review' : 'approval'}.` : drafts.length ? `You have ${drafts.length} simulation${drafts.length > 1 ? 's' : ''} in progress.` : 'Nothing is waiting for you. Start a simulation below.'}</p></div>
  <div class="quick">${quick.map(q => `<a class="btn ${q[1] === '#/customers' && u.role === 'RM' ? 'primary' : 'ghost'}" href="${q[1]}">${q[0]}</a>`).join('')}</div></section>
  <section class="kpi-row">${kpis.map(k => `<div class="kpi"><span>${k[0]}</span><b>${k[1]}</b><small>${k[2]}</small></div>`).join('')}</section>
  <div class="grid-2-1">
    <section class="panel"><div class="panel-h"><h2>Recent simulations</h2><a href="#/approvals" class="lnk">All decisions</a></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Simulation</th><th>Customer / scope</th><th>Owner</th><th>Type</th><th>Status</th><th>Created</th><th class="r">Profit impact</th></tr></thead><tbody>
      ${recent.map(s => { const i = Scen.impact(s); return `<tr class="click" data-go="${simLink(s)}"><td><b>${esc(s.name)}</b><small class="code">${s.code}</small></td><td>${esc(simScope(s) || '–')}</td><td>${esc(userById(s.owner)?.name)}</td><td>${TYPE_LABEL[s.type]}</td><td>${statusPill(s.status)}</td><td class="nowrap">${fmtDate(s.createdAt)}</td><td class="r nowrap"><span class="${i >= 0 ? 'pos-t' : 'neg-t'}">${i >= 0 ? '+' : '−'}${cr(Math.abs(i))}</span></td></tr>`; }).join('')}
      </tbody></table></div></section>
    <div class="stack-col">
      <section class="panel"><div class="panel-h"><h2>Decision pipeline</h2></div>
        <div class="pipe">${pipe.map(p => `<div class="pipe-r"><span>${statusPill(p.st)}</span><i style="width:${p.n / maxN * 100}%"></i><b>${p.n}</b></div>`).join('')}</div></section>
      <section class="panel"><div class="panel-h"><h2>Needs your attention</h2></div>
        ${mine.length || drafts.length ? `<ul class="attn">${mine.map(s => `<li><a href="${simLink(s)}"><b>${esc(s.name)}</b><small>${statusPill(s.status)} submitted by ${esc(userById(s.owner).name)}</small></a></li>`).join('')}${drafts.filter(d => !mine.includes(d)).slice(0, 4).map(s => `<li><a href="${simLink(s)}"><b>${esc(s.name)}</b><small>${statusPill(s.status)} your simulation</small></a></li>`).join('')}</ul>` : `<p class="muted">You're clear. Switch persona from the profile menu to see other queues.</p>`}
      </section>
    </div>
  </div>`;
  return { html, title: 'Decision centre' };
});

/* ---------------- Customer search ---------------- */
UI.cf = { q: '', seg: '', sec: '', reg: '', mine: false };
function customerRows() {
  const f = UI.cf;
  return CUSTOMERS.filter(c => (!f.q || (c.name + c.id + c.city).toLowerCase().includes(f.q.toLowerCase())) && (!f.seg || c.segment === f.seg) && (!f.sec || c.sector === f.sec) && (!f.reg || c.region === f.reg) && (!f.mine || c.rm === me().name))
    .map(c => ({ c, k: E.simulate(c.a, null, S.cfg).kpi }));
}
function customerTable() {
  const rows = customerRows();
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Customer</th><th>Segment</th><th>Sector</th><th>Region</th><th>RM</th><th>Rating</th><th class="r">Loans</th><th class="r">Deposits</th><th class="r">Revenue</th><th class="r">RAROC</th><th>Simulations</th></tr></thead><tbody>
  ${rows.map(({ c, k }) => { const n = S.sims.filter(s => s.customerId === c.id).length; return `<tr class="click ${c.id === 'CORP000184' ? 'hl' : ''}" data-go="#/customer/${c.id}"><td><b>${esc(c.name)}</b><small class="code">${c.id}${c.groupId ? ` · ${esc(Seed.GROUPS.find(g => g.id === c.groupId).name)}` : ''}</small></td><td>${c.segment}</td><td>${c.sector}</td><td>${c.region}</td><td>${esc(c.rm)}</td><td>${c.rating}${c.missing?.length ? ' <span class="dq dq-Missing">PD missing</span>' : ''}</td><td class="r">${cr(c.a.wcBal + c.a.tlBal, 1)}</td><td class="r">${cr(c.a.depBal, 1)}</td><td class="r">${cr(k.revenue)}</td><td class="r ${k.raroc < S.cfg.targetRaroc ? 'neg-t' : ''}">${pct(k.raroc)}</td><td>${n || '–'}</td></tr>`; }).join('')}
  </tbody></table></div><p class="muted sm">${rows.length} of ${CUSTOMERS.length} customers</p>`;
}
route(/^#\/customers$/, () => {
  const f = UI.cf; const opt = (arr, v) => `<option value="">All</option>${arr.map(x => `<option ${x === v ? 'selected' : ''}>${x}</option>`).join('')}`;
  const html = `<section class="panel"><div class="filters"><label class="grow">Search<input id="cq" value="${esc(f.q)}" placeholder="Name, customer ID or city" data-filter="q"></label>
  <label>Segment<select data-filter="seg">${opt(Seed.SEGMENTS, f.seg)}</select></label><label>Sector<select data-filter="sec">${opt(Seed.SECTORS, f.sec)}</select></label><label>Region<select data-filter="reg">${opt(Seed.REGIONS, f.reg)}</select></label>
  <label class="chk"><input type="checkbox" data-filter="mine" ${f.mine ? 'checked' : ''}> My book only</label></div><div id="ctable">${customerTable()}</div></section>`;
  return { html, title: 'Relationships', crumbs: '<span>Simulate</span>' };
});

/* ---------------- Customer 360 ---------------- */
function lineage(f, c) {
  const src = Seed.SOURCES.find(s => s.id === f.src); const missing = c?.missing?.includes(f.k);
  return `${src.name} · as of ${src.asOf} · ${missing ? 'Missing' : src.quality}`;
}
route(/^#\/customer\/([\w-]+)$/, id => {
  const c = custById(id); if (!c) return { html: '<div class="panel empty">Customer not found.</div>', title: 'Customer' };
  const r = E.simulate(c.a, null, S.cfg); const k = r.kpi; const a = c.a;
  const sims = S.sims.filter(s => s.customerId === c.id);
  const products = [
    ['Working Capital Loan', 'Assets', cr(a.wcBal), `${pct(a.wcRate, 2)} · FTP ${pct(a.wcFtp, 2)}`, cr(a.wcBal * (a.wcRate - a.wcFtp) / 100), 'CBS', `Limit ${cr(a.wcLimit, 0)} · ${fmt(a.wcBal / a.wcLimit * 100, 0)}% utilised`],
    ['Term Loan', 'Assets', cr(a.tlBal), `${pct(a.tlRate, 2)} · FTP ${pct(a.tlFtp, 2)}`, cr(a.tlBal * (a.tlRate - a.tlFtp) / 100), 'CBS', ''],
    ['Current Account', 'Liabilities', cr(a.depBal), `Customer rate ${pct(a.depRate, 2)} · FTP credit ${pct(a.depFtp, 2)}`, cr(k.depValue), 'CBS', `Peak ${cr(c.peakDep, 1)}`],
    ['Cash Management', 'Transaction Banking', `${int(a.txnVol)} txns / month`, `₹${a.txnFee} per txn · avg value ₹${int(a.txnVal)}`, cr(k.txnFeeRev), 'CMS', `Monthly value ${cr(a.txnVol * a.txnVal / 1e7, 1)}`],
    ['Trade Finance (LC / BG)', 'Trade Finance', `${cr(a.tfVol, 1)} / year`, `Commission ${pct(a.tfComm, 2)}`, cr(k.tfFee), 'TFP', ''],
  ];
  const commits = [['Deposit balance', a.depBal, a.depCommit, v => cr(v, 1)], ['Transactions / month', a.txnVol, a.txnCommit, int], ['Trade finance / year', a.tfVol, a.tfCommit, v => cr(v, 0)]];
  const trendRev = c.trend.map((t, i) => { const kk = E.simulate({ ...a, depBal: t.dep, txnVol: t.txn }, null, S.cfg).kpi; return { x: i, y: kk.revenue, raroc: kk.raroc }; });
  const wf = [{ label: 'Lending NII', value: k.lendingNII }, { label: 'Deposit value', value: k.depValue }, { label: 'Fees & commission', value: k.feeIncome }, { label: 'Revenue', value: k.revenue, total: true }, { label: 'Direct cost', value: -k.directCost }, { label: 'Indirect cost', value: -k.indirectCost }, { label: 'Expected loss', value: -k.el }, { label: 'Profit before tax', value: k.pbt, total: true }];
  const stale = Seed.SOURCES.filter(s => s.ageDays > S.cfg.staleDays && s.id === 'TFP');
  const html = `
  <section class="c360-head panel"><div><div class="row gap"><h2 class="cname">${esc(c.name)}</h2><span class="chip">${c.rating}</span>${c.groupId ? `<span class="chip ghost">${esc(Seed.GROUPS.find(g => g.id === c.groupId).name)}</span>` : ''}</div>
    <dl class="facts"><div><dt>Customer ID</dt><dd>${c.id}</dd></div><div><dt>Segment</dt><dd>${c.segment}</dd></div><div><dt>Industry</dt><dd>${c.sector}</dd></div><div><dt>Region</dt><dd>${c.region} · ${c.city}</dd></div><div><dt>Relationship manager</dt><dd>${esc(c.rm)}</dd></div><div><dt>Relationship since</dt><dd>${c.since}</dd></div></dl></div>
    <div class="c360-cta">${Auth.can('relationship.create') ? `<button class="btn primary lg" data-act="new-sim" data-id="${c.id}">Create what-if simulation</button>` : `<button class="btn lg" disabled title="${esc(Auth.why('relationship.create'))}">Create what-if simulation</button><small class="muted">${esc(Auth.why('relationship.create'))}</small>`}<small class="muted">Baseline snapshot ${Seed.AS_OF}</small></div></section>
  ${c.missing?.length || stale.length ? `<div class="warn-bar">${c.missing?.length ? `<span class="w-high">Probability of default is missing in the Risk Engine feed. The segment average (${pct(a.pd, 2)}) is shown as Estimated — confirm with Risk before submission.</span>` : ''}${stale.map(s => `<span class="w-info">${s.name} data is ${s.ageDays} days old (as of ${s.asOf}).</span>`).join('')}</div>` : ''}
  <section class="kpi-row">${[['Relationship revenue', cr(k.revenue), 'CALC'], ['Net interest income', cr(k.nii), 'CALC'], ['Fee income', cr(k.feeIncome), 'CALC'], ['Profit before tax', cr(k.pbt), 'CALC'], ['RAROC', pct(k.raroc), 'CALC'], ['RWA', cr(k.rwa, 1), 'CALC']].map(x => `<div class="kpi"><span>${x[0]} ${tag(x[2])}</span><b>${x[1]}</b></div>`).join('')}</section>
  <div class="grid-2">
    <section class="panel"><div class="panel-h"><h2>Products held</h2></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Product</th><th>Balance / volume</th><th>Pricing</th><th class="r">Contribution</th><th>Source</th></tr></thead><tbody>
      ${products.map(p => { const src = Seed.SOURCES.find(s => s.id === p[5]); return `<tr><td><b>${p[0]}</b><small>${p[1]}${p[6] ? ` · ${p[6]}` : ''}</small></td><td>${p[2]}</td><td>${p[3]}</td><td class="r">${p[4]}</td><td>${tag('OBS')} <span class="dq dq-${src.quality}" title="${esc(src.name)} · as of ${src.asOf}">${src.quality}</span></td></tr>`; }).join('')}
    </tbody></table></div></section>
    <section class="panel"><div class="panel-h"><h2>Revenue to profit</h2><button class="lnk" data-act="trace-c" data-id="${c.id}" data-k="profit">How was this calculated?</button></div>${Chart.waterfall(wf)}
      ${Chart.stack([{ name: 'Lending NII', v: k.lendingNII, color: SCEN_COLORS[0] }, { name: 'Deposit value', v: k.depValue, color: SCEN_COLORS[1] }, { name: 'Cash management', v: k.txnFeeRev, color: SCEN_COLORS[3] }, { name: 'Trade finance', v: k.tfFee, color: SCEN_COLORS[2] }, { name: 'Other', v: k.otherInc, color: SCEN_COLORS[5] }])}</section>
  </div>
  <div class="grid-3">
    <section class="panel"><div class="panel-h"><h2>Commitments vs actual</h2></div>${commits.map(([l, act, com, f]) => { const p = com ? act / com * 100 : 0; return `<div class="commit"><div class="row sb"><span>${l}</span><span><b>${f(act)}</b> of ${f(com)}</span></div><div class="prog"><i style="width:${Math.min(100, p)}%" class="${p < 80 ? 'lo' : p < 95 ? 'mid' : ''}"></i></div><small class="${p < 80 ? 'neg-t' : 'muted'}">${fmt(p, 0)}% delivered</small></div>`; }).join('')}
      <p class="muted sm">Current pricing assumes these commitments. Source: CRM, as of ${Seed.AS_OF}.</p></section>
    <section class="panel"><div class="panel-h"><h2>Risk indicators</h2></div><dl class="kv">
      <div><dt>Internal rating</dt><dd>${c.rating} ${tag('MODEL')}</dd></div><div><dt>Probability of default</dt><dd>${pct(a.pd, 2)} ${c.missing?.includes('pd') ? '<span class="dq dq-Estimated">Estimated</span>' : tag('MODEL')}</dd></div>
      <div><dt>Loss given default</dt><dd>${pct(a.lgd, 0)} ${tag('MODEL')}</dd></div><div><dt>Exposure at default</dt><dd>${cr(k.ead, 1)} ${tag('CALC')}</dd></div>
      <div><dt>Expected loss</dt><dd>${cr(k.el)} ${tag('CALC')}</dd></div><div><dt>Risk weight</dt><dd>${pct(a.riskWeight, 0)} ${tag('CALC')}</dd></div>
      <div><dt>Economic capital</dt><dd>${cr(k.capital)} ${tag('CALC')}</dd></div><div><dt>WC utilisation</dt><dd>${fmt(a.wcBal / a.wcLimit * 100, 0)}% ${tag('OBS')}</dd></div></dl></section>
    <section class="panel"><div class="panel-h"><h2>Relationship trend</h2><small class="muted">Revenue, last 12 months</small></div>${Chart.line({ series: [{ name: 'Revenue (annualised)', color: 'var(--brand)', points: trendRev }], w: 400, h: 220, xFmt: i => Seed.MONTHS[i]?.split(' ')[0] || '', yFmt: v => fmt(v, 2) })}
      <p class="muted sm">Transactions grew ${fmt((c.trend[11].txn / c.trend[0].txn - 1) * 100, 0)}% over the year.</p></section>
  </div>
  <section class="panel"><div class="panel-h"><h2>Existing simulations</h2></div>${sims.length ? `<table class="tbl"><thead><tr><th>Simulation</th><th>Owner</th><th>Status</th><th>Created</th><th class="r">Profit impact</th></tr></thead><tbody>${sims.map(s => `<tr class="click" data-go="#/sim/${s.id}"><td><b>${esc(s.name)}</b><small class="code">${s.code}</small></td><td>${esc(userById(s.owner).name)}</td><td>${statusPill(s.status)}</td><td>${fmtDate(s.createdAt)}</td><td class="r">${cr(Scen.impact(s))}</td></tr>`).join('')}</tbody></table>` : `<p class="muted">No simulations yet for this customer. Use “Create what-if simulation” to model the renewal.</p>`}</section>`;
  return { html, title: c.name, crumbs: `<a href="#/customers">Relationships</a>` };
});

/* ---------------- Workspace ---------------- */
const STAGES = ['Baseline', 'Assumptions', 'Simulation', 'Comparison', 'Decision', 'Approval', 'Outcome'];
function stageOf(sim) { return { Draft: 1, Simulated: 3, 'Under Review': 5, 'Awaiting Approval': 5, Rejected: 4, Approved: 5, Executed: 6, Monitoring: 6 }[sim.status] ?? 2; }
function ribbon(sim) {
  const at = stageOf(sim); const done = sim.status === 'Approved' || sim.status === 'Executed' || sim.status === 'Monitoring';
  return `<ol class="ribbon" aria-label="Decision lifecycle">${STAGES.map((s, i) => `<li class="${i < at || (i === at && done && i !== 6) ? 'done' : i === at ? 'now' : ''}" style="--c:${['var(--base-c)', ...SCEN_COLORS][i]}">${s}</li>`).join('')}</ol>`;
}
const WS_TABS = [['build', 'Scenarios'], ['compare', 'Compare'], ['sens', 'Sensitivity'], ['drivers', 'Key drivers'], ['stress', 'Stress'], ['ai', 'AI assistant'], ['decision', 'Decision & approval'], ['audit', 'Audit']];

route(/^#\/sim\/([\w-]+)(?:\/(\w+))?$/, (id, tab) => {
  const sim = simById(id); if (!sim || !sim.baseline) return { html: '<div class="panel empty">Simulation not found. <a href="#/home">Back to Decision centre</a></div>', title: 'Simulation' };
  UI.tab = tab || UI.tabFor?.[id] || 'build'; UI.tabFor = { ...(UI.tabFor || {}), [id]: UI.tab };
  if (!UI.scen || (UI.scen !== 'base' && !sim.scenarios.find(s => s.id === UI.scen))) UI.scen = sim.scenarios[0]?.id || 'base';
  const c = custById(sim.customerId) || sim.prospect;
  const body = { build: wsBuild, compare: wsCompare, sens: wsSens, drivers: wsDrivers, stress: wsStress, ai: wsAI, decision: wsDecision, audit: wsAudit }[UI.tab](sim);
  const html = `${ribbon(sim)}
  <section class="ws-head"><div><div class="row gap"><h2>${esc(sim.name)}</h2>${statusPill(sim.status)}<span class="chip ghost">${TYPE_LABEL[sim.type]}</span></div>
  <p class="q">“${esc(sim.question)}”</p>
  <small class="muted">${sim.code} · owner ${esc(userById(sim.owner).name)} · baseline ${sim.baselineMeta.id} as of ${sim.baselineMeta.asOf} · snapshot ${sim.baselineMeta.snapshot} · ${esc(sim.baselineMeta.model)}</small></div>
  <div class="ws-head-r">${sim.customerId ? `<a class="btn ghost" href="#/customer/${sim.customerId}">Customer 360</a>` : ''}${['Approved', 'Executed', 'Monitoring'].includes(sim.status) ? `<a class="btn primary" href="#/package/${sim.id}">Decision package</a>` : `<a class="btn ghost" href="#/package/${sim.id}">Preview decision package</a>`}</div></section>
  <nav class="tabs" role="tablist">${WS_TABS.map(([k, l]) => `<a role="tab" href="#/sim/${sim.id}/${k}" class="${UI.tab === k ? 'on' : ''}">${l}${k === 'decision' && sim.approvals?.some(a => a.status === 'Pending') ? ' <i class="dot"></i>' : ''}</a>`).join('')}</nav>
  <div id="ws-body">${body.html}</div>`;
  return { html, title: c?.name || sim.name, crumbs: sim.customerId ? `<a href="#/customers">Relationships</a><a href="#/customer/${sim.customerId}">${esc(c.name)}</a>` : `<a href="#/prospects">Prospects</a>`, after: body.after };
});

function scenarioBar(sim, editable) {
  const chips = [`<button class="schip ${UI.scen === 'base' ? 'on' : ''}" data-act="pick-scen" data-id="base" style="--c:var(--base-c)"><i></i>Baseline</button>`,
    ...sim.scenarios.map(s => `<button class="schip ${UI.scen === s.id ? 'on' : ''}" data-act="pick-scen" data-id="${s.id}" style="--c:${Scen.color(sim, s)}"><i></i>${esc(s.name)}<small>v${s.version}</small>${sim.selectedId === s.id ? '<em class="pref">Preferred</em>' : ''}</button>`)];
  const cur = sim.scenarios.find(s => s.id === UI.scen);
  const acts = editable ? `<div class="sacts"><button class="btn sm" data-act="scen-add">Add scenario</button>${cur ? `<button class="btn sm ghost" data-act="scen-clone">Clone</button><button class="btn sm ghost" data-act="scen-rename">Rename</button><button class="btn sm ghost" data-act="scen-version">Save version</button><button class="btn sm ghost" data-act="scen-history">Versions</button><button class="btn sm ghost danger-t" data-act="scen-delete">Delete</button>` : ''}</div>` : `<div class="sacts"><small class="muted">${esc(Auth.why('scenario.edit', { sim }))}</small>${cur ? `<button class="btn sm ghost" data-act="scen-history">Versions</button>` : ''}</div>`;
  return `<div class="sbar"><div class="schips">${chips.join('')}</div>${acts}</div>`;
}

function wsBuild(sim) {
  const editable = Auth.can('scenario.edit', { sim }); const cur = sim.scenarios.find(s => s.id === UI.scen);
  const b = sim.baseline; const a = cur ? cur.a : b; const c = custById(sim.customerId);
  const groups = [...new Set(Seed.FIELDS.map(f => f.g))];
  UI.open = UI.open || { Loans: true, Deposits: true, Transactions: true, Pricing: true, 'Trade finance': true, Commitments: true, Behaviour: true };
  const row = f => {
    const v = a[f.k], bv = b[f.k]; const cls = cur ? (cur.cls[f.k] || (v !== bv ? 'USER' : (f.cls || 'OBS'))) : (f.cls || 'OBS');
    const missing = c?.missing?.includes(f.k);
    if (f.unit === 'bool') return `<div class="frow"><div class="fl"><span>${esc(f.label)}</span>${tag(cls)}</div><label class="switch"><input type="checkbox" data-field="${f.k}" ${v ? 'checked' : ''} ${editable && cur ? '' : 'disabled'}><i></i></label><div class="fb"><small>Baseline ${fieldFmt(f, bv)}</small></div></div>`;
    const d = v - bv;
    return `<div class="frow ${d ? 'chg' : ''}" data-row="${f.k}"><div class="fl"><span title="${esc(lineage(f, c))}">${esc(f.label)}</span>${missing ? '<span class="dq dq-Missing">Missing</span>' : tag(cls)}</div>
      ${cur ? `<div class="fc"><input type="range" min="${f.min}" max="${Math.max(f.max, v)}" step="${f.step}" value="${v}" data-field="${f.k}" ${editable ? '' : 'disabled'} aria-label="${esc(f.label)}"><input type="number" class="num" step="${f.step}" value="${+Number(v).toFixed(4)}" data-field="${f.k}" ${editable ? '' : 'disabled'} aria-label="${esc(f.label)} value"></div>` : `<div class="fc ro"><b>${fieldFmt(f, v)}</b><small class="muted">${esc(lineage(f, c))}</small></div>`}
      <div class="fb" id="fb-${f.k}">${cur ? (d ? `<small>was ${fieldFmt(f, bv)}</small>` : '<small class="muted">= baseline</small>') : ''}</div></div>`;
  };
  const html = `${scenarioBar(sim, editable)}
  <div class="ws-grid">
    <section class="panel assumptions"><div class="panel-h"><h2>${cur ? `Assumptions — ${esc(cur.name)}` : 'Baseline position'}</h2>${cur?.note ? `<small class="muted">${esc(cur.note)}</small>` : '<small class="muted">Observed and model-derived values with lineage. Select a scenario to edit.</small>'}</div>
      ${cur && editable ? `<div class="nl"><label for="nl">Describe a change in plain language</label><div class="row"><input id="nl" placeholder="Reduce lending rate by 30 basis points, increase deposits by INR 15 Cr and transactions by 20%"><button class="btn" data-act="nl-parse">Parse</button></div></div>` : ''}
      ${groups.map(g => { const fs = Seed.FIELDS.filter(f => f.g === g); const nChg = cur ? fs.filter(f => a[f.k] !== b[f.k]).length : 0; return `<details class="fgroup" ${UI.open[g] ? 'open' : ''} data-group="${g}"><summary>${g}${nChg ? ` <span class="nchg">${nChg} changed</span>` : ''}</summary>${fs.map(row).join('')}</details>`; }).join('')}
    </section>
    <section class="impact" id="impact">${impactPanel(sim)}</section>
  </div>`;
  return { html };
}

function impactPanel(sim) {
  const cur = sim.scenarios.find(s => s.id === UI.scen); const b = sim.baseline;
  const base = E.simulate(b, b, S.cfg); const r = cur ? E.simulate(cur.a, b, S.cfg) : base; const k = r.kpi, bk = base.kpi;
  const tiles = [['revenue', 'Revenue', cr(k.revenue), dlt(k.revenue, bk.revenue, { unit: 'Cr' }), 'revenue'], ['nii', 'Net interest income', cr(k.nii), dlt(k.nii, bk.nii, { unit: 'Cr' }), 'nii'], ['fee', 'Fee income', cr(k.feeIncome), dlt(k.feeIncome, bk.feeIncome, { unit: 'Cr' }), 'revenue'], ['cost', 'Total cost', cr(k.totalCost), dlt(k.totalCost, bk.totalCost, { unit: 'Cr', inverse: true }), 'profit'],
    ['pbt', 'Profit before tax', cr(k.pbt), dlt(k.pbt, bk.pbt, { unit: 'Cr' }), 'profit'], ['raroc', 'RAROC', pct(k.raroc), dlt(k.raroc, bk.raroc, { pp: true }), 'raroc'], ['rwa', 'RWA', cr(k.rwa, 1), dlt(k.rwa, bk.rwa, { unit: 'Cr', inverse: true }), 'rwa'], ['eva', 'Relationship value (EVA)', cr(k.eva), dlt(k.eva, bk.eva, { unit: 'Cr' }), 'raroc']];
  const w = cur ? E.warnings(r, base, cur.a, b, S.cfg, Scen.meta(sim)) : E.warnings(base, base, b, b, S.cfg, Scen.meta(sim));
  const bridge = [{ label: 'Baseline profit', value: bk.pbt, total: true }, { label: 'Lending NII', value: k.lendingNII - bk.lendingNII }, { label: 'Deposit value', value: k.depValue - bk.depValue }, { label: 'Fees & comm.', value: k.feeIncome - bk.feeIncome }, { label: 'Cost', value: -(k.totalCost - bk.totalCost) }, { label: 'Expected loss', value: -(k.el - bk.el) }, { label: cur ? 'Scenario profit' : 'Profit', value: k.pbt, total: true }];
  return `<div class="panel"><div class="panel-h"><h2>Impact ${cur ? `<span class="swatch" style="background:${Scen.color(sim, cur)}"></span>${esc(cur.name)}` : '— baseline'}</h2><small class="muted">Recalculated instantly · annualised</small></div>
    <div class="tiles">${tiles.map(t => `<div class="tile ${t[0] === 'pbt' || t[0] === 'raroc' ? 'key' : ''}"><span>${t[1]}</span><b>${t[2]}</b>${cur ? t[3] : ''}<button class="how" data-act="trace" data-k="${t[4]}">How was this calculated?</button></div>`).join('')}</div>
    <div class="cov"><span>Commitment coverage today</span><div class="prog"><i style="width:${k.commitCoverage}%" class="${k.commitCoverage < 70 ? 'lo' : k.commitCoverage < 90 ? 'mid' : ''}"></i></div><b>${pct(k.commitCoverage, 0)}</b></div>
    ${cur ? `<h3 class="sub">Profit bridge vs baseline</h3>${Chart.waterfall(bridge, { h: 210 })}` : ''}
    <h3 class="sub">Business warnings</h3>${w.length ? `<ul class="warns">${w.map(x => `<li class="w-${x.level}"><b>${x.type}</b>${esc(x.text)}</li>`).join('')}</ul>` : '<p class="muted sm">No warnings for this scenario.</p>'}</div>`;
}
