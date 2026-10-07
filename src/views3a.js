/* =====================================================================
   VIEWS 3a — Prospects · Product · Pricing rules · Portfolio
   ===================================================================== */

/* ---------------- Prospect ---------------- */
UI.pros = UI.pros || { name: 'Aditya Precision Castings Pvt. Ltd.', sector: 'Engineering', segment: 'Mid Corporate', region: 'West', rating: 'BBB', loan: 60, rate: 9.60, dep: 12, txnVol: 9000, txnVal: 70000, tf: 45, tfComm: 0.5, fee: 6, cost: 0.45 };
route(/^#\/prospects$/, () => {
  const p = UI.pros; const prospects = S.sims.filter(s => s.type === 'prospect');
  const num = (k, l, step = 'any', unit = '') => `<label>${l}${unit ? ` <small>(${unit})</small>` : ''}<input type="number" step="${step}" data-pros="${k}" value="${p[k]}"></label>`;
  const sel = (k, l, arr) => `<label>${l}<select data-pros="${k}">${arr.map(x => `<option ${x === p[k] ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`;
  const html = `<div class="grid-2-1"><section class="panel"><div class="panel-h"><h2>New prospect</h2><small class="muted">What commercial structure should the bank offer while meeting profitability and risk objectives?</small></div>
  <div class="form-grid"><label class="span2">Prospect name<input data-pros="name" value="${esc(p.name)}"></label>${sel('sector', 'Sector', Seed.SECTORS)}${sel('segment', 'Segment', Seed.SEGMENTS)}${sel('region', 'Region', Seed.REGIONS)}${sel('rating', 'Indicative risk rating', Object.keys(Seed.RATING_PD))}
  ${num('loan', 'Expected lending balance', 1, 'Cr')}${num('rate', 'Indicative lending rate', 0.05, '%')}${num('dep', 'Expected deposit balance', 1, 'Cr')}${num('txnVol', 'Transactions / month', 100)}${num('txnVal', 'Average transaction value', 1000, '₹')}${num('fee', 'Fee per transaction', 0.25, '₹')}${num('tf', 'Trade finance utilisation / year', 5, 'Cr')}${num('tfComm', 'Trade finance commission', 0.05, '%')}${num('cost', 'Estimated servicing cost', 0.01, 'Cr / year')}</div>
  <div class="row gap">${Auth.can('relationship.create') ? '<button class="btn primary" data-act="pros-create">Generate three commercial alternatives</button>' : `<small class="muted">${esc(Auth.why('relationship.create'))}</small>`}</div>
  <p class="muted sm">All prospect inputs are tagged as user assumptions. PD, LGD and risk weight are derived from the indicative rating (model-derived).</p></section>
  <section class="panel"><div class="panel-h"><h2>Prospect simulations</h2></div>${prospects.length ? `<ul class="attn">${prospects.map(s => `<li><a href="#/sim/${s.id}"><b>${esc(s.name)}</b><small>${statusPill(s.status)} ${fmtDate(s.createdAt)}</small></a></li>`).join('')}</ul>` : '<p class="muted">None yet. Fill in the prospect profile to create one.</p>'}</section></div>`;
  return { html, title: 'Prospect simulations', crumbs: '<span>Simulate</span>' };
});
function createProspect() {
  const p = UI.pros; const pd = Seed.RATING_PD[p.rating], rw = Seed.RATING_RW[p.rating];
  const b = { wcBal: +p.loan * 0.7, wcLimit: +p.loan * 0.7 * 1.3, wcRate: +p.rate, wcFtp: 6.7, tlBal: +p.loan * 0.3, tlRate: +p.rate + 0.25, tlFtp: 7.0, invBal: 0, invYield: 8.1,
    depBal: +p.dep, depRate: 0.4, depFtp: 5.5, txnVol: +p.txnVol, txnVal: +p.txnVal, txnFee: +p.fee, feeDiscPct: 0, condFeeOn: false, condFee: 3, condDep: 40, condVol: 25000,
    tfVol: +p.tf, tfComm: +p.tfComm, otherInc: +p.loan * 0.002, directCost: +p.cost * 0.6, servicingCost: +p.cost * 0.4, txnCostPer: 1.2, indirectCost: 0.05 + p.loan * 0.0026,
    pd, lgd: 45, ccf: 20, riskWeight: rw, riskMult: 100, cofBps: 0, fulfilPct: 85, attritionPct: 0, depCommit: +p.dep, txnCommit: +p.txnVol, tfCommit: +p.tf };
  const sim = { id: uid('S'), code: nextCode(), type: 'prospect', name: `${p.name} — opening offer`, customerId: null, prospect: { name: p.name, segment: p.segment, sector: p.sector, region: p.region, rating: p.rating },
    owner: S.userId, status: 'Simulated', createdAt: nowStamp(), updatedAt: nowStamp(), question: 'What commercial structure should the bank offer this prospect while meeting profitability and risk objectives?',
    baseline: b, baselineMeta: { id: `BL-PROS-${S.seq}`, asOf: fmtDate(nowStamp()), snapshot: 'Prospect profile (user entered)', model: 'Rating-derived PD/LGD · FTP curve Aug-26' },
    scenarios: [], selectedId: null, rationale: '', approvals: [], aiLog: [] };
  const all = Object.fromEntries(Object.keys(b).map(k => [k, 'USER']));
  sim.scenarios.push(Scen.make('Offer A · Lending-led', { ...b, wcRate: b.wcRate - 0.15, depBal: b.depBal * 0.5, txnVol: Math.round(b.txnVol * 0.5), tfVol: 0 }, all, 'Win the lending mandate first; operating accounts later.'));
  sim.scenarios.push(Scen.make('Offer B · Lending + operating account', { ...b, wcRate: b.wcRate - 0.25, depBal: b.depBal * 1.3, txnVol: Math.round(b.txnVol * 1.2) }, all, 'Sharper rate for the primary operating account.'));
  sim.scenarios.push(Scen.make('Offer C · Full relationship', { ...b, wcRate: b.wcRate - 0.35, depBal: b.depBal * 1.8, txnVol: Math.round(b.txnVol * 1.5), tfVol: b.tfVol * 1.4, txnFee: b.txnFee - 1 }, all, 'Best rate and fee for primary banker status including trade.'));
  S.sims.push(sim); audit('Prospect simulation created', { simId: sim.id, newV: '3 alternatives', status: 'Simulated' }); save();
  UI.scen = sim.scenarios[0].id; go(`#/sim/${sim.id}/compare`);
}

/* ---------------- Product simulation (Cash Management) ---------------- */
function productState() {
  if (!S.product) S.product = { costPerTxn: 2.1, fixedCost: 0.9, scen: [
    { id: 'P0', name: 'Current tariff (as billed)', ruleId: 'actual', el: 0 },
    { id: 'PA', name: 'Option A · Flat ₹5', ruleId: 'R-CM-5', el: -0.35 },
    { id: 'PB', name: 'Option B · ₹4.50 conditional on volume', ruleId: 'R-CM-450', el: -0.35 },
    { id: 'PC', name: 'Option C · Value-based tier', ruleId: 'R-CM-VALVOL', el: -0.35 },
    { id: 'PD', name: 'Option D · Slab by volume', ruleId: 'R-CM-SLAB', el: -0.35 } ], focus: 'PC' };
  return S.product;
}
route(/^#\/product$/, () => {
  const P = productState(); const ed = Auth.can('product.edit'); const cur = 'actual'; const ACTUAL = { id: 'actual', name: 'Current billed tariff: ₹4 LC · ₹6 MC · ₹8 SME' };
  const res = P.scen.map(s => ({ s, rule: s.ruleId === 'actual' ? 'actual' : S.rules.find(r => r.id === s.ruleId) || S.rules[0] })).map(x => ({ ...x, o: E.productSim(CUSTOMERS, x.rule, cur, x.s.el, P.costPerTxn, P.fixedCost) }));
  const b = res[0].o; const f = res.find(x => x.s.id === P.focus) || res[1];
  const html = `<section class="panel"><div class="panel-h"><h2>Cash management tariff review</h2><small class="muted">What happens if we change transaction pricing? ${CUSTOMERS.length} customers · billed today at ₹4 (Large Corporate), ₹6 (Mid Corporate) and ₹8 (SME) per transaction</small></div>
  <div class="filters"><label>Processing cost / txn <small>(₹)</small><input type="number" step="0.1" data-prod="costPerTxn" value="${P.costPerTxn}" ${ed ? '' : 'disabled'}></label><label>Fixed product cost <small>(Cr / yr)</small><input type="number" step="0.05" data-prod="fixedCost" value="${P.fixedCost}" ${ed ? '' : 'disabled'}></label>${ed ? '<label class="btn-l"><button class="btn" data-act="prod-add">Add option</button></label><label class="btn-l"><button class="btn primary" data-act="prod-save">Save to pipeline</button></label>' : `<small class="muted">${esc(Auth.why('product.edit'))}</small>`}<a class="lnk" href="#/pricing">Edit pricing rules</a></div>
  <div class="tbl-wrap"><table class="tbl cmp"><thead><tr><th></th>${res.map((x, i) => `<th><span class="swatch" style="background:${i ? SCEN_COLORS[(i - 1) % 6] : 'var(--base-c)'}"></span>${esc(x.s.name)}</th>`).join('')}</tr></thead><tbody>
  <tr><th>Pricing rule</th>${res.map(x => `<td>${ed && x.s.id !== 'P0' ? `<select data-prodrule="${x.s.id}">${S.rules.map(r => `<option value="${r.id}" ${r.id === x.s.ruleId ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>` : esc(x.rule === 'actual' ? ACTUAL.name : x.rule.name)}</td>`).join('')}</tr>
  <tr><th>Volume elasticity ${tag('MODEL')}</th>${res.map(x => `<td>${ed && x.s.id !== 'P0' ? `<input type="number" step="0.05" min="-2" max="0" value="${x.s.el}" data-prodel="${x.s.id}" class="num">` : fmt(x.s.el, 2)}</td>`).join('')}</tr>
  <tr><th>Average fee / txn</th>${res.map(x => `<td>₹${fmt(x.o.revenue * 1e7 / 12 / x.o.vol, 2)}</td>`).join('')}</tr>
  <tr><th>Transaction volume / month</th>${res.map(x => `<td>${int(x.o.vol)}<br>${dlt(x.o.vol, b.vol, { unit: 'txns' })}</td>`).join('')}</tr>
  <tr class="keyrow"><th>Fee revenue / year</th>${res.map(x => `<td>${cr(x.o.revenue)}<br>${dlt(x.o.revenue, b.revenue, { unit: 'Cr' })}</td>`).join('')}</tr>
  <tr><th>Product cost</th>${res.map(x => `<td>${cr(x.o.cost)}<br>${dlt(x.o.cost, b.cost, { unit: 'Cr', inverse: true })}</td>`).join('')}</tr>
  <tr class="keyrow"><th>Product profit</th>${res.map(x => `<td>${cr(x.o.profit)}<br>${dlt(x.o.profit, b.profit, { unit: 'Cr' })}</td>`).join('')}</tr>
  <tr><th>Customers paying less / more</th>${res.map(x => `<td><span class="pos-t">${x.o.better}</span> / <span class="neg-t">${x.o.worse}</span></td>`).join('')}</tr>
  <tr><th></th>${res.map(x => `<td>${x.s.id === P.focus ? '<span class="chip pref">Showing detail</span>' : `<button class="btn sm ghost" data-act="prod-focus" data-id="${x.s.id}">Customer impact</button>`}</td>`).join('')}</tr></tbody></table></div></section>
  <div class="grid-2"><section class="panel"><div class="panel-h"><h2>Profit and revenue by option</h2></div>${Chart.bars(res.map((x, i) => ({ label: x.s.name.replace(/^Option /, '').split(' · ')[0], values: [{ name: 'Revenue', color: 'var(--base-c)', v: x.o.revenue }, { name: 'Profit', color: i ? SCEN_COLORS[(i - 1) % 6] : 'var(--brand)', v: x.o.profit }] })), { h: 230, yFmt: v => fmt(v, 1) })}<p class="muted sm">Grey bars: revenue. Coloured bars: profit after processing and fixed cost.</p></section>
  <section class="panel"><div class="panel-h"><h2>Customer impact — ${esc(f.s.name)}</h2></div><div class="tbl-wrap tall"><table class="tbl"><thead><tr><th>Customer</th><th class="r">Fee / txn</th><th class="r">Volume response</th><th class="r">Annual fee change</th></tr></thead><tbody>
  ${f.o.impacts.map(i => `<tr title="${esc(i.trace.join('\n'))}"><td><b>${esc(i.c.name)}</b><small>${i.c.segment} · ${int(i.c.a.txnVol)} txns · ${cr(i.c.a.txnVol * i.c.a.txnVal / 1e7, 1)} / month</small></td><td class="r">₹${fmt(i.curPer, 2)} → ₹${fmt(i.newPer, 2)}</td><td class="r">${i.volChange > 0 ? '+' : ''}${fmt(i.volChange, 1)}%</td><td class="r ${i.newFee < i.curFee ? 'pos-t' : i.newFee > i.curFee ? 'neg-t' : ''}">${i.newFee - i.curFee >= 0 ? '+' : '−'}₹${fmt(Math.abs(i.newFee - i.curFee) * 100, 1)} L</td></tr>`).join('')}</tbody></table></div><p class="muted sm">Hover a row for the pricing-engine trace. Volume response = elasticity × % change in fee per transaction.</p></section></div>`;
  return { html, title: 'Product simulation', crumbs: '<span>Simulate</span>' };
});

/* ---------------- Pricing rule builder ---------------- */
UI.rule = UI.rule || 'R-CM-VALVOL'; UI.ruleTest = UI.ruleTest || { volume: 22000, avgValue: 85000, deposit: 25 };
function ruleSentence(r) {
  const unit = r.appliedTo === 'value' ? '% of value' : ' per transaction';
  const cond = r.conditions?.items?.length ? `IF ${r.conditions.items.map(c => `${E.METRIC_LABEL[c.metric].toLowerCase()} ${c.cmp} ${int(c.value)}`).join(` ${r.conditions.op} `)} THEN ` : '';
  let body = '';
  if (r.type === 'fixed') body = `charge ${r.appliedTo === 'value' ? `${r.rate}%` : `₹${r.rate}`}${unit} on ${r.appliedTo}`;
  if (r.type === 'percent') body = `charge ${r.pct}% of each transaction's value${r.min !== '' && r.min != null ? `, minimum ₹${int(r.min)}` : ''}${r.max !== '' && r.max != null ? `, maximum ₹${int(r.max)}` : ''}`;
  if (r.type === 'slab') body = `find the tier based on ${E.METRIC_LABEL[r.basedOn].toLowerCase()} and apply that tier's rate to the whole ${r.appliedTo}: ${r.tiers.map(t => `${t.from}–${t.to ?? '∞'} → ${r.appliedTo === 'value' ? t.rate + '%' : '₹' + t.rate}`).join('; ')}`;
  if (r.type === 'progressive') body = `charge each band of ${r.appliedTo} at its own rate: ${r.tiers.map(t => `${t.from}–${t.to ?? '∞'} → ${r.appliedTo === 'value' ? t.rate + '%' : '₹' + t.rate}`).join('; ')}`;
  return cond + body + (cond ? ` ELSE ₹${r.elseRate ?? 0} per transaction` : '');
}
route(/^#\/pricing$/, () => {
  const ed = Auth.can('rules.edit'); const r = S.rules.find(x => x.id === UI.rule) || S.rules[0]; UI.rule = r.id; const T = UI.ruleTest; const dis = ed ? '' : 'disabled';
  const ev = E.evaluatePricing(r, { volume: +T.volume, value: T.volume * T.avgValue, avgValue: +T.avgValue, deposit: +T.deposit });
  const tiers = ['slab', 'progressive'].includes(r.type);
  const html = `<div class="rules-grid"><section class="panel"><div class="panel-h"><h2>Rules</h2>${ed ? '<button class="btn sm" data-act="rule-new">New rule</button>' : ''}</div><ul class="rule-list">${S.rules.map(x => `<li><button class="${x.id === r.id ? 'on' : ''}" data-act="rule-pick" data-id="${x.id}"><b>${esc(x.name)}</b><small>${x.type} · ${x.status} · ${esc(x.owner)}</small></button></li>`).join('')}</ul></section>
  <section class="panel"><div class="panel-h"><h2>Rule builder</h2>${ed ? `<div class="row gap"><button class="btn sm ghost" data-act="rule-dup">Duplicate</button><button class="btn sm primary" data-act="rule-save">Save rule</button></div>` : `<small class="muted">${esc(Auth.why('rules.edit'))}</small>`}</div>
  <p class="sentence">${esc(ruleSentence(r))}</p>
  <div class="form-grid"><label class="span2">Rule name<input data-rule="name" value="${esc(r.name)}" ${dis}></label>
  <label>Pricing method<select data-rule="type" ${dis}>${[['fixed', 'Fixed'], ['percent', 'Percentage (with min / max)'], ['slab', 'Slab / absolute tier'], ['progressive', 'Progressive tier']].map(([k, l]) => `<option value="${k}" ${r.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <label>Based on<select data-rule="basedOn" ${dis}>${Object.entries(E.METRIC_LABEL).map(([k, l]) => `<option value="${k}" ${r.basedOn === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <label>Applied to<select data-rule="appliedTo" ${dis}><option value="volume" ${r.appliedTo === 'volume' ? 'selected' : ''}>Transaction volume (₹ per txn)</option><option value="value" ${r.appliedTo === 'value' ? 'selected' : ''}>Transaction value (% of value)</option></select></label>
  ${r.type === 'fixed' ? `<label>Rate<input type="number" step="0.05" data-rule="rate" value="${r.rate}" ${dis}></label>` : ''}
  ${r.type === 'percent' ? `<label>Percentage<input type="number" step="0.01" data-rule="pct" value="${r.pct}" ${dis}></label><label>Minimum ₹ per txn<input type="number" data-rule="min" value="${r.min ?? ''}" ${dis}></label><label>Maximum ₹ per txn<input type="number" data-rule="max" value="${r.max ?? ''}" ${dis}></label>` : ''}</div>
  ${tiers ? `<h3 class="sub">Tiers <small class="muted">(bounds in units of ${r.type === 'progressive' ? r.appliedTo : r.basedOn}${(r.type === 'progressive' ? r.appliedTo : r.basedOn) === 'value' || r.basedOn === 'deposit' ? ', ₹ Cr' : ''})</small></h3><table class="tbl mini"><thead><tr><th>From</th><th>To</th><th>Rate</th><th></th></tr></thead><tbody>${r.tiers.map((t, i) => `<tr><td><input type="number" data-tier="${i}" data-tk="from" value="${t.from}" ${dis}></td><td><input type="number" data-tier="${i}" data-tk="to" value="${t.to ?? ''}" placeholder="∞" ${dis}></td><td><input type="number" step="0.05" data-tier="${i}" data-tk="rate" value="${t.rate}" ${dis}></td><td>${ed ? `<button class="btn sm ghost" data-act="tier-del" data-i="${i}">Remove</button>` : ''}</td></tr>`).join('')}</tbody></table>${ed ? '<button class="btn sm" data-act="tier-add">Add tier</button>' : ''}` : ''}
  <h3 class="sub">Conditions</h3><div class="row gap"><select data-rule="condOp" style="width:auto" ${dis}><option ${r.conditions.op === 'AND' ? 'selected' : ''}>AND</option><option ${r.conditions.op === 'OR' ? 'selected' : ''}>OR</option></select><small class="muted">All conditions must hold (AND) or any one (OR). If not met, the fallback rate applies.</small></div>
  <table class="tbl mini"><tbody>${r.conditions.items.map((c, i) => `<tr><td><select data-cond="${i}" data-ck="metric" ${dis}>${Object.entries(E.METRIC_LABEL).map(([k, l]) => `<option value="${k}" ${c.metric === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td><td><select data-cond="${i}" data-ck="cmp" ${dis}>${['>=', '>', '<=', '<'].map(o => `<option ${c.cmp === o ? 'selected' : ''}>${o}</option>`).join('')}</select></td><td><input type="number" data-cond="${i}" data-ck="value" value="${c.value}" ${dis}></td><td>${ed ? `<button class="btn sm ghost" data-act="cond-del" data-i="${i}">Remove</button>` : ''}</td></tr>`).join('') || '<tr><td class="muted">No conditions — rule always applies.</td></tr>'}</tbody></table>
  <div class="row gap">${ed ? '<button class="btn sm" data-act="cond-add">Add condition</button>' : ''}${r.conditions.items.length ? `<label class="inline">Fallback ₹ per txn <input type="number" step="0.25" data-rule="elseRate" value="${r.elseRate ?? 6}" ${dis} class="num"></label>` : ''}</div></section>
  <section class="panel"><div class="panel-h"><h2>Test the rule</h2></div><div class="form-grid one"><label>Transactions / month<input type="number" data-rtest="volume" value="${T.volume}"></label><label>Average value ₹<input type="number" data-rtest="avgValue" value="${T.avgValue}"></label><label>Deposit balance ₹ Cr<input type="number" data-rtest="deposit" value="${T.deposit}"></label></div>
  <div class="result"><span>Monthly fee</span><b>₹${int(ev.fee)}</b><small>₹${fmt(ev.perTxn, 2)} per transaction · ₹${fmt(ev.fee * 12 / 1e7, 3)} Cr a year</small></div>
  <h3 class="sub">Calculation trace</h3><ol class="trace">${ev.trace.map(t => `<li>${esc(t)}</li>`).join('')}</ol><p class="muted sm">Monthly value ${cr(T.volume * T.avgValue / 1e7, 1)}. Defaults are Zenith Auto Components' actuals.</p></section></div>`;
  return { html, title: 'Pricing rule builder', crumbs: '<span>Configure</span>' };
});

/* ---------------- Portfolio ---------------- */
const PORTFOLIOS = { sme: ['SME Manufacturing', c => c.segment === 'SME' && c.sector !== 'Information Technology'], mid: ['Mid Corporate', c => c.segment === 'Mid Corporate'], lc: ['Large Corporate', c => c.segment === 'Large Corporate'], all: ['Whole wholesale book', () => true] };
route(/^#\/portfolio$/, () => {
  const L = S.portfolioLevers = S.portfolioLevers || { pf: 'sme', loanGrowth: 12, depGrowth: 8, pricingBps: -10, cofBps: 0, riskPct: 0, penetration: 10, mixShift: 20, exitLow: false };
  const ed = Auth.can('portfolio.edit'); const [pname, filt] = PORTFOLIOS[L.pf]; const custs = CUSTOMERS.filter(filt);
  const P = E.portfolio(custs, L, S.cfg); const b = P.base, s = P.sim;
  const lever = (k, l, min, max, step, unit) => `<div class="lever"><div class="row sb"><span>${l} ${tag('USER')}</span><b id="lv-${k}">${L[k] > 0 ? '+' : ''}${fmt(L[k], step < 1 ? 1 : 0)}${unit}</b></div><input type="range" min="${min}" max="${max}" step="${step}" value="${L[k]}" data-lever="${k}" ${ed ? '' : 'disabled'}></div>`;
  const kp = [['Revenue', b.revenue, s.revenue, 'Cr'], ['Profit before tax', b.pbt, s.pbt, 'Cr'], ['RAROC', b.raroc, s.raroc, 'pp'], ['RWA', b.rwa, s.rwa, 'Cr', true], ['Loan book', b.loans, s.loans, 'Cr'], ['Deposits', b.deposits, s.deposits, 'Cr'], ['Top-sector share', b.topShare, s.topShare, 'pp', true], ['Concentration (HHI)', b.hhi, s.hhi, 'hhi', true]];
  // heatmap sector × region RAROC (baseline)
  const heat = Seed.SECTORS.map(sec => ({ sec, cells: Seed.REGIONS.map(reg => { const cs = custs.filter(c => c.sector === sec && c.region === reg); if (!cs.length) return null; const t = E.aggregate(cs.map(c => E.simulate(c.a, null, S.cfg).kpi)); return { raroc: t.raroc, n: cs.length }; }) })).filter(r => r.cells.some(Boolean));
  const hc = v => v == null ? '' : v < 10 ? 'h1' : v < S.cfg.targetRaroc ? 'h2' : v < 20 ? 'h3' : 'h4';
  const html = `<div class="grid-1-2"><section class="panel"><div class="panel-h"><h2>Portfolio assumptions</h2></div>
  <label class="blk">Portfolio<select data-lever="pf" ${ed ? '' : 'disabled'}>${Object.entries(PORTFOLIOS).map(([k, v]) => `<option value="${k}" ${k === L.pf ? 'selected' : ''}>${v[0]} (${CUSTOMERS.filter(v[1]).length})</option>`).join('')}</select></label>
  ${lever('loanGrowth', 'Loan growth', -20, 40, 1, '%')}${lever('depGrowth', 'Deposit growth', -20, 40, 1, '%')}${lever('pricingBps', 'Average pricing change', -75, 75, 5, ' bps')}${lever('cofBps', 'Cost of funds shift', -100, 150, 5, ' bps')}${lever('riskPct', 'Risk cost change', -30, 60, 5, '%')}${lever('penetration', 'Product penetration (fees & trade)', -20, 50, 1, '%')}${lever('mixShift', 'Industry mix: move Textiles lending to Pharma', 0, 60, 5, '%')}
  <label class="chk"><input type="checkbox" data-lever="exitLow" ${L.exitLow ? 'checked' : ''} ${ed ? '' : 'disabled'}> Customer mix: exit relationships with RAROC below 8%</label>
  ${ed ? '<div class="row gap"><button class="btn primary" data-act="port-save">Save to pipeline</button></div>' : `<p class="muted sm">${esc(Auth.why('portfolio.edit'))}</p>`}</section>
  <div class="stack-col"><section class="panel"><div class="panel-h"><h2>${esc(pname)} — ${custs.length} customers</h2><small class="muted">${P.exited.length ? `${P.exited.length} exited: ${esc(P.exited.map(c => c.name).join(', '))}` : 'All customers retained'}</small></div>
  <div class="tiles four">${kp.map(k => `<div class="tile"><span>${k[0]}</span><b>${k[3] === 'pp' ? pct(k[2]) : k[3] === 'hhi' ? int(k[2]) : cr(k[2], 1)}</b>${k[3] === 'pp' ? dlt(k[2], k[1], { pp: true, inverse: k[4] }) : k[3] === 'hhi' ? dlt(k[2], k[1], { inverse: true }) : dlt(k[2], k[1], { unit: 'Cr', inverse: k[4] })}<small class="muted">was ${k[3] === 'pp' ? pct(k[1]) : k[3] === 'hhi' ? int(k[1]) : cr(k[1], 1)}</small></div>`).join('')}</div></section>
  <section class="panel"><div class="panel-h"><h2>By sector</h2></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Sector</th><th class="r">Customers</th><th class="r">Loans</th><th class="r">Share</th><th class="r">Profit</th><th class="r">RAROC</th></tr></thead><tbody>${P.sectors.map(x => `<tr><td>${x.sector}</td><td class="r">${x.n}</td><td class="r">${cr(x.simLoans, 1)}<br>${dlt(x.simLoans, x.baseLoans, { unit: 'Cr' })}</td><td class="r">${pct(x.simLoans / (s.loans || 1) * 100, 1)}</td><td class="r">${cr(x.simPbt)}<br>${dlt(x.simPbt, x.basePbt, { unit: 'Cr' })}</td><td class="r">${pct(x.simRaroc)}<br>${dlt(x.simRaroc, x.baseRaroc, { pp: true })}</td></tr>`).join('')}</tbody></table></div>
  ${Chart.bars(P.sectors.map(x => ({ label: x.sector.split(' ')[0], values: [{ name: 'Baseline loans', color: 'var(--base-c)', v: x.baseLoans }, { name: 'Simulated loans', color: SCEN_COLORS[0], v: x.simLoans }] })), { h: 190, yFmt: v => fmt(v, 0) })}</section>
  <section class="panel"><div class="panel-h"><h2>Risk-return heatmap</h2><small class="muted">Baseline RAROC by sector and region</small></div><div class="tbl-wrap"><table class="tbl heat"><thead><tr><th></th>${Seed.REGIONS.map(r => `<th>${r}</th>`).join('')}</tr></thead><tbody>${heat.map(r => `<tr><th>${r.sec}</th>${r.cells.map(c => `<td class="${c ? hc(c.raroc) : 'na'}">${c ? `${pct(c.raroc, 0)}<small>${c.n}</small>` : '–'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section></div></div>`;
  return { html, title: 'Portfolio simulation', crumbs: '<span>Simulate</span>' };
});
