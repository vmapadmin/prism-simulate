/* =====================================================================
   PRISM SIMULATE — APPLICATION CORE
   State · Repository (localStorage) · AuthZ · Audit · Scenario ·
   Workflow · Outcome · AI services · Chart helpers · Shell & router
   ===================================================================== */
const E = Engine;
const STORE_KEY = 'prism-simulate-poc-v4';
const SCEN_COLORS = ['#3F6FB5', '#7A58B8', '#C27A12', '#1C8C8C', '#B04A7A', '#5E7F2E'];
const BASE_COLOR = 'var(--base-c)';
const CLS = { OBS: 'Observed', CALC: 'Calculated', MODEL: 'Model-derived', USER: 'User assumption', AI: 'AI recommended' };

/* ---------------- utilities ---------------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v, d = 2) => (v == null || isNaN(v) || !isFinite(v)) ? '–' : Number(v).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
const cr = (v, d = 2) => (v == null || isNaN(v)) ? '–' : `${v < -Math.pow(10, -d) / 2 ? '−' : ''}₹${fmt(Math.abs(v), d)} Cr`;
const pct = (v, d = 1) => (v == null || isNaN(v) || !isFinite(v)) ? '–' : `${fmt(v, d)}%`;
const int = v => fmt(v, 0);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const nowStamp = () => { const d = new Date(); return d.toISOString(); };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = iso => { if (!iso) return '–'; const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}-${MON[d.getMonth()]}-${d.getFullYear()}`; };
const fmtDT = iso => { if (!iso) return '–'; const d = new Date(iso); return `${fmtDate(iso)} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`; };
function fieldFmt(f, v) {
  if (f.unit === 'bool') return v ? 'On' : 'Off';
  if (f.unit === '%') return pct(v, f.step < 0.1 ? 2 : 1);
  if (f.unit === 'Cr') return cr(v, v >= 100 ? 1 : 2);
  if (f.unit === 'txns') return int(v);
  if (f.unit === 'bps') return `${v > 0 ? '+' : ''}${int(v)} bps`;
  if (f.unit === '₹') return `₹${fmt(v, v >= 1000 ? 0 : 2)}`;
  return fmt(v);
}
/** Delta pill. inverse=true when a decrease is good (costs, RWA). */
function dlt(v, base, o = {}) {
  const d = v - base; if (!isFinite(d)) return '';
  const p = base ? d / Math.abs(base) * 100 : 0;
  const good = o.inverse ? d < 0 : d > 0; const flat = Math.abs(d) < (o.eps ?? 1e-4);
  const cls = flat || o.neutral ? 'flat' : good ? 'pos' : 'neg';
  const abs = o.bps ? `${d > 0 ? '+' : '−'}${fmt(Math.abs(d) * 100, 0)} bps` : o.pp ? `${d > 0 ? '+' : ''}${fmt(d, 1)} pp` : o.unit === 'Cr' ? `${d > 0 ? '+' : '−'}₹${fmt(Math.abs(d), 2)} Cr` : o.unit === 'txns' ? `${d > 0 ? '+' : '−'}${int(Math.abs(d))}` : `${d > 0 ? '+' : ''}${fmt(d, 2)}`;
  return `<span class="delta ${cls}">${flat ? 'no change' : abs}${!flat && !o.pp && !o.bps && o.showPct !== false ? ` <em>${p > 0 ? '+' : ''}${fmt(p, 1)}%</em>` : ''}</span>`;
}
const tag = c => `<span class="cls cls-${c}" title="${esc(CLS[c])}">${esc(CLS[c])}</span>`;
const statusPill = s => `<span class="status st-${s.replace(/\s/g, '')}">${esc(s)}</span>`;

/* ---------------- state & repository ---------------- */
let S = null;
const CUSTOMERS = Seed.buildCustomers();
const custById = id => CUSTOMERS.find(c => c.id === id);
const userById = id => Seed.USERS.find(u => u.id === id);
const byRole = r => Seed.USERS.find(u => u.role === r);

function freshState() {
  const st = { userId: null, cfg: { ...Seed.CONFIG }, sims: [], audit: [], outcomes: [], rules: JSON.parse(JSON.stringify(Seed.RULES)), stressRuns: [], seq: 1026, notices: [],
    product: null, campaign: null, portfolioLevers: null };
  S = st; seedSimulations(); return st;
}
function save() { try { const { ...copy } = S; localStorage.setItem(STORE_KEY, JSON.stringify(copy)); } catch (e) { /* storage unavailable: session-only */ } }
function load() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) { S = JSON.parse(raw); if (S && S.sims) return; } } catch (e) { /* ignore */ }
  freshState(); save();
}
const me = () => userById(S.userId);
const simById = id => S.sims.find(s => s.id === id);
const nextCode = () => `SIM-${++S.seq}`;
const uid = p => `${p}-${Math.random().toString(36).slice(2, 8)}`;

/* ---------------- authorization (single place) ---------------- */
const Auth = {
  can(action, ctx = {}) {
    const u = me(); if (!u) return false; const r = u.role; const sim = ctx.sim;
    switch (action) {
      case 'relationship.create': return ['RM', 'RH'].includes(r);
      case 'scenario.edit': return !!sim && sim.owner === u.id && ['Draft', 'Simulated', 'Rejected'].includes(sim.status);
      case 'sim.submit': return !!sim && sim.owner === u.id && ['Draft', 'Simulated', 'Rejected'].includes(sim.status) && !!sim.selectedId;
      case 'approval.act': {
        const step = ctx.step; if (!sim || !step || step.status !== 'Pending') return false;
        if (step.role !== r) return false;
        if (S.cfg.makerChecker && sim.owner === u.id) return false;
        const order = sim.approvals.findIndex(x => x.status === 'Pending'); return sim.approvals[order] === step;
      }
      case 'sim.execute': return !!sim && sim.status === 'Approved' && (sim.owner === u.id || r === 'BH');
      case 'sim.monitor': return !!sim && sim.status === 'Executed' && (sim.owner === u.id || r === 'BH');
      case 'product.edit': return ['PROD', 'PM'].includes(r);
      case 'rules.edit': return ['PROD', 'PM'].includes(r);
      case 'portfolio.edit': return ['PORT', 'CFO', 'BH'].includes(r);
      case 'campaign.edit': return ['PROD', 'PORT', 'RM'].includes(r);
      case 'stress.save': return ['CFO', 'RISK', 'BH', 'PORT'].includes(r);
      case 'admin.edit': return ['CFO', 'BH'].includes(r);
      default: return false;
    }
  },
  why(action, ctx = {}) {
    const u = me(); const sim = ctx.sim;
    if (action === 'approval.act' && sim && S.cfg.makerChecker && sim.owner === u.id) return 'Maker-checker: you created this simulation, so you cannot approve it.';
    if (action === 'approval.act' && ctx.step && ctx.step.role !== u.role) return `Waiting for ${Seed.ROLES[ctx.step.role]}.`;
    if (action === 'scenario.edit' && sim && sim.owner !== u.id) return `Read-only: owned by ${userById(sim.owner)?.name}.`;
    if (action === 'scenario.edit' && sim) return `Read-only while ${sim.status.toLowerCase()}.`;
    return `Not available to ${Seed.ROLES[u.role]}.`;
  },
};

/* ---------------- audit ---------------- */
function audit(action, o = {}) {
  S.audit.unshift({ id: uid('AU'), ts: o.ts || nowStamp(), user: o.user || me()?.name || 'System', role: o.role || (me() ? Seed.ROLES[me().role] : ''), action, simId: o.simId || null, scenario: o.scenario || '', oldV: o.oldV ?? '', newV: o.newV ?? '', rationale: o.rationale || '', status: o.status || '' });
  if (S.audit.length > 800) S.audit.length = 800;
}

/* ---------------- scenario service ---------------- */
const Scen = {
  make(name, a, cls = {}, note = '') { return { id: uid('SC'), name, a: { ...a }, cls: { ...cls }, note, version: 1, versions: [{ v: 1, at: nowStamp(), by: me()?.name || 'System', note: 'Created', a: { ...a } }] }; },
  results(sim) {
    const b = sim.baseline; const base = E.simulate(b, b, S.cfg);
    return { base, list: sim.scenarios.map(s => ({ s, r: E.simulate(s.a, b, S.cfg) })) };
  },
  color(sim, sc) { const i = sim.scenarios.indexOf(sc); return SCEN_COLORS[(i < 0 ? 0 : i) % SCEN_COLORS.length]; },
  meta(sim) { const c = custById(sim.customerId); const stale = Seed.SOURCES.filter(s => s.ageDays > S.cfg.staleDays && ['TFP'].includes(s.id)); return { peakDep: c?.peakDep, peakTxn: c?.peakTxn, staleSources: sim.type === 'relationship' ? stale : [] }; },
  impact(sim) {
    if (!sim.scenarios?.length || !sim.baseline) return sim.impact ?? 0;
    const { base, list } = Scen.results(sim); const sel = list.find(x => x.s.id === sim.selectedId) || list.slice().sort((p, q) => q.r.kpi.pbt - p.r.kpi.pbt)[0];
    return sel ? sel.r.kpi.pbt - base.kpi.pbt : 0;
  },
  revImpact(sim) {
    if (!sim.scenarios?.length || !sim.baseline) return sim.revImpact ?? 0;
    const { base, list } = Scen.results(sim); const sel = list.find(x => x.s.id === sim.selectedId) || list.slice().sort((p, q) => q.r.kpi.pbt - p.r.kpi.pbt)[0];
    return sel ? sel.r.kpi.revenue - base.kpi.revenue : 0;
  },
};

function newRelationshipSim(c, opts = {}) {
  const b = { ...c.a };
  const sim = { id: uid('S'), code: opts.code || nextCode(), type: opts.type || 'relationship', name: opts.name || `${c.name.replace(/ (Ltd\.|Co\.)$/, '')} — relationship renewal`, customerId: c.id,
    owner: opts.owner || S.userId, status: 'Draft', createdAt: opts.createdAt || nowStamp(), updatedAt: opts.createdAt || nowStamp(), question: opts.question || 'The customer is asking for improved pricing. What can the bank offer while maintaining acceptable total relationship economics?',
    baseline: b, baselineMeta: { id: `BL-${c.id}-2608`, asOf: Seed.AS_OF, snapshot: `SNAP-${c.id.slice(-4)}-0831`, model: 'Risk Engine v3.2 · FTP curve Aug-26 · Pricing engine 1.4' },
    scenarios: [], selectedId: null, rationale: '', approvals: [], aiLog: [], stressSaved: [] };
  if (opts.template === 'renewal') {
    Seed.renewalScenarios(b).forEach(t => { const cls = {}; t.changed.forEach(k => cls[k] = 'USER'); sim.scenarios.push(Scen.make(t.name, t.a, cls, t.note)); });
    sim.status = 'Simulated';
  } else if (opts.template !== 'none') {
    sim.scenarios.push(Scen.make('Scenario A', b, {}, 'Copy of baseline — edit assumptions to model an alternative.'));
    sim.status = 'Simulated';
  }
  return sim;
}

/* ---------------- workflow service ---------------- */
const Workflow = {
  STATUSES: ['Draft', 'Simulated', 'Under Review', 'Awaiting Approval', 'Approved', 'Rejected', 'Executed', 'Monitoring'],
  submit(sim, rationale) {
    const sel = sim.scenarios.find(s => s.id === sim.selectedId); const b = sim.baseline;
    const base = E.simulate(b, b, S.cfg), res = E.simulate(sel.a, b, S.cfg);
    sim.approvals = E.requiredApprovals(sel.a, b, res, base, S.cfg).map(x => ({ ...x, status: 'Pending', by: null, at: null, comment: '' }));
    sim.rationale = rationale; sim.submittedAt = nowStamp();
    sel.versions.push({ v: ++sel.version, at: nowStamp(), by: me().name, note: 'Frozen on submission', a: { ...sel.a } });
    sim.warningsAtSubmit = E.warnings(res, base, sel.a, b, S.cfg, Scen.meta(sim)).map(w => w.text);
    Workflow.refresh(sim);
    audit('Submitted for approval', { simId: sim.id, scenario: sel.name, oldV: 'Simulated', newV: sim.status, rationale, status: sim.status });
    notify(`Submitted ${sim.code}. Routed to ${sim.approvals.map(a => Seed.ROLES[a.role]).join(', ')}.`);
  },
  refresh(sim) {
    const pending = sim.approvals.filter(a => a.status === 'Pending');
    if (sim.approvals.some(a => a.status === 'Rejected')) sim.status = 'Rejected';
    else if (!pending.length) { sim.status = 'Approved'; sim.approvedAt = nowStamp(); }
    else sim.status = pending[0].stage === 'review' ? 'Under Review' : 'Awaiting Approval';
    sim.updatedAt = nowStamp();
  },
  act(sim, step, decision, comment) {
    const old = sim.status;
    step.status = decision === 'approve' ? (step.stage === 'review' ? 'Reviewed' : 'Approved') : 'Rejected';
    step.by = me().name; step.at = nowStamp(); step.comment = comment;
    Workflow.refresh(sim);
    const sel = sim.scenarios.find(s => s.id === sim.selectedId);
    audit(`${Seed.ROLES[me().role]} ${step.status.toLowerCase()} ${sel?.name || ''}`.trim(), { simId: sim.id, scenario: sel?.name, oldV: old, newV: sim.status, rationale: comment, status: sim.status });
    if (sim.status === 'Approved') { sim.packageId = `DP-${sim.code.slice(4)}`; audit('Decision package generated', { simId: sim.id, scenario: sel?.name, newV: sim.packageId, status: 'Approved', user: 'Prism Workflow' }); }
  },
  execute(sim) { const o = sim.status; sim.status = 'Executed'; sim.executedAt = nowStamp(); audit('Marked as executed in source systems (mock)', { simId: sim.id, oldV: o, newV: 'Executed', status: 'Executed' }); },
  monitor(sim) { const o = sim.status; sim.status = 'Monitoring'; Outcomes.create(sim); audit('Outcome monitoring started', { simId: sim.id, oldV: o, newV: 'Monitoring', status: 'Monitoring' }); },
};

/* ---------------- outcome / learning loop ---------------- */
const Outcomes = {
  create(sim, forced) {
    const sel = sim.scenarios.find(s => s.id === sim.selectedId); if (!sel) return;
    const r = E.prng(sim.code.split('').reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7));
    const f = forced || { depBal: 0.88 + r() * 0.1, txnVol: 0.93 + r() * 0.1, tfVol: 0.95 + r() * 0.2 };
    const act = { ...sel.a, depBal: sel.a.depBal * (f.depBal ?? 1), txnVol: Math.round(sel.a.txnVol * (f.txnVol ?? 1)), tfVol: sel.a.tfVol * (f.tfVol ?? 1) };
    if (forced?.abs) Object.assign(act, forced.abs);
    S.outcomes.unshift({ id: uid('OC'), simId: sim.id, months: forced?.months ?? 1, expectedA: { ...sel.a }, actualA: act, asOf: forced?.asOf || Seed.AS_OF });
  },
  view(o) {
    const sim = simById(o.simId); const b = sim.baseline;
    const exp = E.simulate(o.expectedA, b, S.cfg).kpi, act = E.simulate(o.actualA, b, S.cfg).kpi, base = E.simulate(b, b, S.cfg).kpi;
    const rows = [
      { k: 'Deposits', e: o.expectedA.depBal, a: o.actualA.depBal, f: v => cr(v, 1) },
      { k: 'Transactions / month', e: o.expectedA.txnVol, a: o.actualA.txnVol, f: int },
      { k: 'Trade finance / year', e: o.expectedA.tfVol, a: o.actualA.tfVol, f: v => cr(v, 1) },
      { k: 'Revenue', e: exp.revenue, a: act.revenue, f: v => cr(v) },
      { k: 'Profit before tax', e: exp.pbt, a: act.pbt, f: v => cr(v) },
      { k: 'RAROC', e: exp.raroc, a: act.raroc, f: v => pct(v), pp: true },
    ].map(x => ({ ...x, v: x.pp ? x.a - x.e : (x.a - x.e) / Math.abs(x.e) * 100 }));
    const pv = (act.pbt - exp.pbt) / Math.abs(exp.pbt) * 100;
    const status = pv >= 2 ? 'Above expectation' : pv >= -5 ? 'On track' : 'Below expectation';
    // Deterministic explanation built from the variances
    const parts = []; const dep = rows[0], txn = rows[1], tf = rows[2];
    const shortfalls = [dep, txn, tf].filter(x => x.v < -2).map(x => `${x.k.toLowerCase()} (${fmt(x.v, 1)}%)`);
    const beats = [dep, txn, tf].filter(x => x.v > 2).map(x => `${x.k.toLowerCase()} (+${fmt(x.v, 1)}%)`);
    parts.push(act.pbt >= base.pbt ? `Relationship profit of ${cr(act.pbt)} remains above the pre-decision baseline of ${cr(base.pbt)}` : `Relationship profit of ${cr(act.pbt)} has fallen below the pre-decision baseline of ${cr(base.pbt)}`);
    if (shortfalls.length) parts.push(`despite lower-than-expected ${shortfalls.join(' and ')}`);
    if (beats.length) parts.push(`because ${beats.join(' and ')} exceeded plan`);
    let text = parts.join(' ') + '.';
    if (dep.v < -5) text += ` Deposit delivery is the main gap; consider a commitment review with the customer before the next pricing reset.`;
    text += ` Learning signal: the fulfilment model assumed 100% delivery; observed delivery suggests ${fmt(clamp(70 + (dep.v + txn.v) * 1.5 + 25, 50, 100), 0)}% for similar ${custById(sim.customerId)?.segment || ''} renewals.`;
    return { rows, status, text, exp, act, base, sim };
  },
};

/* ---------------- AI service (deterministic, grounded in engine results) ---------------- */
const AI = {
  mode: 'Prism rules engine · no LLM connected',
  generate(sim, target = 16) {
    const b = sim.baseline; const base = E.simulate(b, b, S.cfg).kpi; const c = custById(sim.customerId);
    const plans = [
      { bps: 25, txn: 0.10, tf: 0, name: 'AI · Price-led' },
      { bps: 35, txn: 0.15, tf: 0.10, name: 'AI · Balanced' },
      { bps: 40, txn: 0.25, tf: 0.20, name: 'AI · Relationship-led' },
    ];
    return plans.map(p => {
      let found = null;
      for (let dep = Math.round(b.depBal); dep <= b.depBal + 60; dep += 1) {
        const a = { ...b, wcRate: +(b.wcRate - p.bps / 100).toFixed(2), depBal: dep, depCommit: Math.max(b.depCommit, dep), txnVol: Math.round(b.txnVol * (1 + p.txn) / 100) * 100, tfVol: +(b.tfVol * (1 + p.tf)).toFixed(1) };
        a.txnCommit = Math.max(b.txnCommit, a.txnVol); a.tfCommit = Math.max(b.tfCommit, a.tfVol);
        const k = E.simulate(a, b, S.cfg).kpi;
        if (k.raroc >= target && k.revenue > base.revenue) { found = { a, k }; break; }
      }
      if (!found) return { ...p, feasible: false, reason: `No deposit level up to +₹60 Cr keeps RAROC ≥ ${target}% with a ${p.bps} bps concession.` };
      const changed = ['wcRate', 'depBal', 'depCommit', 'txnVol', 'txnCommit', 'tfVol', 'tfCommit'].filter(k => found.a[k] !== b[k]);
      const overPeak = c?.peakDep ? (found.a.depBal / c.peakDep - 1) * 100 : 0;
      return { ...p, feasible: true, a: found.a, k: found.k, changed,
        reason: `${p.bps} bps concession; smallest deposit balance that keeps RAROC ≥ ${target}% while lifting revenue is ${cr(found.a.depBal, 0)}${p.txn ? `, with transactions +${p.txn * 100}%` : ''}${p.tf ? ` and trade finance +${p.tf * 100}%` : ''}.`,
        caveat: overPeak > 10 ? `Deposit level is ${fmt(overPeak, 0)}% above the customer's historical peak.` : 'Within the customer\u2019s historical deposit range.' };
    });
  },
  explain(sim, sc) {
    const b = sim.baseline; const base = E.simulate(b, b, S.cfg).kpi; const k = E.simulate(sc.a, b, S.cfg).kpi;
    const comps = [
      ['lending NII (pricing & utilisation)', k.lendingNII - base.lendingNII], ['deposit funding value', k.depValue - base.depValue], ['transaction fees', k.txnFeeRev - base.txnFeeRev],
      ['trade finance commission', k.tfFee - base.tfFee], ['other income', k.otherInc - base.otherInc], ['operating cost', -(k.totalCost - base.totalCost)], ['expected loss', -(k.el - base.el)],
    ].filter(x => Math.abs(x[1]) > 0.005).sort((p, q) => Math.abs(q[1]) - Math.abs(p[1]));
    const d = k.pbt - base.pbt;
    let t = `${sc.name} ${d >= 0 ? 'adds' : 'removes'} ${cr(Math.abs(d))} of profit before tax versus baseline (${cr(base.pbt)} → ${cr(k.pbt)}). `;
    const pos = comps.filter(x => x[1] > 0), neg = comps.filter(x => x[1] < 0);
    if (pos.length) t += `Gains come from ${pos.map(x => `${x[0]} (+${cr(x[1])})`).join(', ')}. `;
    if (neg.length) t += `These are partly offset by ${neg.map(x => `${x[0]} (−${cr(Math.abs(x[1]))})`).join(', ')}. `;
    t += `RAROC moves from ${pct(base.raroc)} to ${pct(k.raroc)} because capital changes only ${cr(k.capital - base.capital)} while after-tax profit changes ${cr(k.pat - base.pat)}.`;
    if (k.commitCoverage < 75) t += ` Note: today the customer delivers only ${pct(k.commitCoverage, 0)} of the commitments this scenario relies on.`;
    return { text: t, comps };
  },
  strongest(sim) {
    const b = sim.baseline; const base = E.simulate(b, b, S.cfg).kpi;
    const rank = sim.scenarios.map(s => {
      const k = E.simulate(s.a, b, S.cfg).kpi; const k80 = E.simulate({ ...s.a, fulfilPct: 80 }, b, S.cfg).kpi;
      return { s, k, k80 };
    }).sort((p, q) => q.k.eva - p.k.eva);
    if (!rank.length) return { text: 'Add at least one scenario to compare.', rank };
    const top = rank[0]; const robust = rank.slice().sort((p, q) => q.k80.eva - p.k80.eva)[0];
    const lowestRate = rank.slice().sort((p, q) => p.s.a.wcRate - q.s.a.wcRate)[0];
    let t = `${top.s.name} provides the strongest overall relationship economics: profit ${cr(top.k.pbt)} (${top.k.pbt >= base.pbt ? '+' : ''}${cr(top.k.pbt - base.pbt)} vs baseline), RAROC ${pct(top.k.raroc)} and economic value added ${cr(top.k.eva)}. `;
    if (lowestRate.s.id === top.s.id && top.s.a.wcRate < b.wcRate) t += `It carries the lowest lending rate (${pct(top.s.a.wcRate, 2)}), showing that the deepest concession can still win when balances and cross-product commitments are secured. `;
    t += robust.s.id === top.s.id ? `The ranking holds if only 80% of committed uplifts are delivered (profit ${cr(top.k80.pbt)}).` : `If only 80% of committed uplifts are delivered, ${robust.s.name} becomes stronger (EVA ${cr(robust.k80.eva)} vs ${cr(top.k80.eva)}) — commitment delivery is the key risk.`;
    const breaches = rank.filter(x => x.k.raroc < S.cfg.targetRaroc).map(x => x.s.name);
    if (breaches.length) t += ` ${breaches.join(', ')} fall${breaches.length === 1 ? 's' : ''} below the ${S.cfg.targetRaroc}% RAROC target.`;
    return { text: t, rank, top };
  },
  suggest(sim) {
    const c = custById(sim.customerId); const b = sim.baseline;
    const g = c ? (c.trend[11].txn / c.trend[0].txn - 1) * 100 : 10; const util = b.wcBal / b.wcLimit * 100;
    const lo = Math.max(5, Math.round((g + 3) / 5) * 5), hi = lo + 10;
    return [
      { key: 'txnVol', text: `Based on ${fmt(g, 0)}% transaction growth over the last 12 months and ${fmt(util, 0)}% working-capital utilisation, consider modelling transaction volume growth between ${lo}% and ${hi}%.`, value: Math.round(b.txnVol * (1 + (lo + hi) / 200) / 100) * 100, label: `Transactions +${(lo + hi) / 2}%` },
      { key: 'depBal', text: `The customer's peak average deposit balance was ${cr(c?.peakDep || b.depBal, 0)}. A commitment above ${cr((c?.peakDep || b.depBal) * 1.25, 0)} has low historical support; ${cr(Math.round((c?.peakDep || b.depBal) * 1.2), 0)} is a stretch but defensible ask.`, value: Math.round((c?.peakDep || b.depBal) * 1.2), label: `Deposits ${cr(Math.round((c?.peakDep || b.depBal) * 1.2), 0)}` },
      { key: 'fulfilPct', text: 'Similar mid-corporate renewals delivered about 80% of committed uplift in the first year (outcome tracking). Model fulfilment at 80% to see a probability-weighted view.', value: 80, label: 'Fulfilment 80%' },
    ];
  },
  summary(sim) {
    const st = AI.strongest(sim); const c = custById(sim.customerId); const b = sim.baseline;
    if (!st.top) return st.text;
    const t = st.top; const bps = Math.round((b.wcRate - t.s.a.wcRate) * 100);
    return `${c?.name || 'The customer'} requested improved working-capital pricing. ${sim.scenarios.length} alternatives were simulated against a baseline profit of ${cr(E.simulate(b, b, S.cfg).kpi.pbt)} and RAROC of ${pct(E.simulate(b, b, S.cfg).kpi.raroc)}. ${t.s.name} is recommended: a ${bps} bps concession exchanged for ${cr(t.s.a.depBal, 0)} deposits and ${int(t.s.a.txnVol)} transactions a month, producing ${cr(t.k.pbt)} profit and ${pct(t.k.raroc)} RAROC. Key risk: delivery of commitments (today ${pct(t.k.commitCoverage, 0)} covered). Approval needed from ${E.requiredApprovals(t.s.a, b, { kpi: t.k }, E.simulate(b, b, S.cfg), S.cfg).map(a => Seed.ROLES[a.role]).join(', ')}.`;
  },
  parse(text) {
    const VARS = [
      { re: /(term[- ]loan)/, key: 'tlRate', label: 'Term loan rate', kind: 'rate' },
      { re: /(lending|loan|working[- ]capital|\bwc\b|pricing|interest rate|\brate\b|price)/, key: 'wcRate', label: 'Working capital rate', kind: 'rate' },
      { re: /(deposit|casa|balances?)/, key: 'depBal', label: 'Deposit balance', kind: 'amount' },
      { re: /(transaction|txn|payments?)/, key: 'txnVol', label: 'Transaction volume', kind: 'count' },
      { re: /(trade finance|\btf\b|trade)/, key: 'tfVol', label: 'Trade finance volume', kind: 'amount' },
      { re: /(cost of funds|\bcof\b|funding)/, key: 'cofBps', label: 'Cost of funds shift', kind: 'bps' },
      { re: /(risk cost|expected loss|credit cost)/, key: 'riskMult', label: 'Risk cost', kind: 'mult' },
      { re: /(fee|tariff|charge)/, key: 'txnFee', label: 'Cash management fee', kind: 'price' },
    ];
    const out = []; let verbSign = 1;
    const clauses = text.toLowerCase().replace(/basis points?/g, 'bps').split(/,|;|\band\b|\bthen\b/);
    clauses.forEach(cl => {
      if (/(reduce|cut|lower|decrease|drop|fall|less|minus|down)/.test(cl)) verbSign = -1;
      else if (/(increase|raise|add|grow|higher|more|plus|up|boost)/.test(cl)) verbSign = 1;
      const v = VARS.find(x => x.re.test(cl)); if (!v) return;
      const m = cl.match(/([+-]?\d+(?:\.\d+)?)\s*(bps|bp|%|cr|crore|k|txns?)?/); if (!m) return;
      let num = parseFloat(m[1]); const unit = (m[2] || '').replace('crore', 'cr');
      const sign = /^[+-]/.test(m[1]) ? 1 : verbSign; num *= sign;
      if (out.some(o => o.key === v.key)) return;
      out.push({ key: v.key, label: v.label, kind: v.kind, num, unit });
    });
    return out.map(o => {
      if (o.kind === 'rate') { const bps = o.unit === '%' ? o.num * 100 : o.num; return { ...o, op: 'add', value: bps / 100, display: `${bps > 0 ? '+' : ''}${fmt(bps, 0)} bps` }; }
      if (o.kind === 'bps') return { ...o, op: 'add', value: o.num, display: `${o.num > 0 ? '+' : ''}${fmt(o.num, 0)} bps` };
      if (o.kind === 'price') return { ...o, op: o.unit === '%' ? 'pct' : 'add', value: o.num, display: o.unit === '%' ? `${o.num > 0 ? '+' : ''}${o.num}%` : `${o.num > 0 ? '+' : '−'}₹${Math.abs(o.num)} per txn` };
      if (o.kind === 'mult') return { ...o, op: 'pct', value: o.num, display: `${o.num > 0 ? '+' : ''}${o.num}%` };
      if (o.unit === '%') return { ...o, op: 'pct', value: o.num, display: `${o.num > 0 ? '+' : ''}${o.num}%` };
      if (o.kind === 'count') return { ...o, op: 'add', value: o.unit === 'k' ? o.num * 1000 : o.num, display: `${o.num > 0 ? '+' : ''}${int(o.unit === 'k' ? o.num * 1000 : o.num)} / month` };
      return { ...o, op: 'add', value: o.num, display: `${o.num > 0 ? '+' : '−'}₹${fmt(Math.abs(o.num), 0)} Cr` };
    });
  },
  applyParsed(a, parsed) {
    const n = { ...a };
    parsed.forEach(p => {
      if (p.key === 'riskMult') n.riskMult = a.riskMult * (1 + p.value / 100);
      else if (p.op === 'pct') n[p.key] = a[p.key] * (1 + p.value / 100);
      else n[p.key] = a[p.key] + p.value;
      if (p.key === 'txnVol') n.txnVol = Math.round(n.txnVol);
      if (p.key === 'depBal' && n.depBal > a.depCommit) n.depCommit = n.depBal;
      if (p.key === 'txnVol' && n.txnVol > a.txnCommit) n.txnCommit = n.txnVol;
      if (p.key === 'tfVol' && n.tfVol > a.tfCommit) n.tfCommit = n.tfVol;
    });
    return n;
  },
};

/* ---------------- seeded simulations, outcomes and audit ---------------- */
function seedSimulations() {
  const d = (s) => new Date(s + 'T10:30:00').toISOString();
  const find = n => CUSTOMERS.find(c => c.name.startsWith(n));
  const mk = (cn, o) => {
    const c = find(cn); const sim = newRelationshipSim(c, { owner: o.owner || 'u-rm', createdAt: d(o.date), code: o.code, name: o.name, template: 'none' });
    const b = sim.baseline;
    o.scen.forEach((x, i) => sim.scenarios.push({ ...Scen.make(x.n || `Scenario ${'ABC'[i]}`, { ...b, ...x.ch(b) }, Object.fromEntries(Object.keys(x.ch(b)).map(k => [k, 'USER'])), x.note || ''), versions: [{ v: 1, at: d(o.date), by: userById(o.owner || 'u-rm').name, note: 'Created', a: { ...b, ...x.ch(b) } }] }));
    sim.status = 'Simulated'; sim.updatedAt = d(o.date);
    if (o.sel != null) sim.selectedId = sim.scenarios[o.sel].id;
    S.sims.push(sim);
    audit('Simulation created', { simId: sim.id, ts: d(o.date), user: userById(sim.owner).name, role: Seed.ROLES[userById(sim.owner).role], newV: 'Draft', status: 'Draft' });
    if (o.flow) {
      const sel = sim.scenarios[o.sel]; const base = E.simulate(b, b, S.cfg), res = E.simulate(sel.a, b, S.cfg);
      sim.approvals = E.requiredApprovals(sel.a, b, res, base, { ...S.cfg, rhReview: !!o.rh }).map(x => ({ ...x, status: 'Pending', by: null, at: null, comment: '' }));
      sim.rationale = o.rationale || 'Concession is funded by incremental balances and fee income.'; sim.submittedAt = d(o.date);
      audit('Submitted for approval', { simId: sim.id, ts: d(o.date), user: userById(sim.owner).name, role: 'Relationship Manager', scenario: sel.name, oldV: 'Simulated', newV: 'Awaiting Approval', rationale: sim.rationale });
      o.flow.forEach(([decision, comment, date]) => {
        const step = sim.approvals.find(a => a.status === 'Pending'); if (!step) return;
        const u = byRole(step.role); step.status = decision === 'reject' ? 'Rejected' : step.stage === 'review' ? 'Reviewed' : 'Approved'; step.by = u.name; step.at = d(date); step.comment = comment;
        audit(`${Seed.ROLES[step.role]} ${step.status.toLowerCase()} ${sel.name}`, { simId: sim.id, ts: d(date), user: u.name, role: Seed.ROLES[u.role], scenario: sel.name, rationale: comment });
      });
      Workflow.refresh(sim); if (sim.status === 'Approved') { sim.packageId = `DP-${sim.code.slice(4)}`; sim.approvedAt = d(o.flow[o.flow.length - 1][2]); }
      if (o.final) { sim.status = o.final; audit(o.final === 'Executed' ? 'Marked as executed in source systems (mock)' : 'Outcome monitoring started', { simId: sim.id, ts: d(o.flow[o.flow.length - 1][2]), user: userById(sim.owner).name, newV: o.final }); }
    }
    return sim;
  };
  const orionLike = CUSTOMERS.find(c => c.segment === 'Mid Corporate' && c.id !== 'CORP000184' && c.a.depBal < 34 && c.a.depBal > 12 && c.a.txnVol > 12000 && c.a.txnVol < 25000) || CUSTOMERS[5];
  const s1 = mk(orionLike.name, { code: 'SIM-1007', date: '2026-03-02', name: `${orionLike.name} — FY26 renewal`, sel: 1, scen: [
    { ch: b => ({ wcRate: +(b.wcRate - 0.2).toFixed(2) }) },
    { ch: b => ({ wcRate: +(b.wcRate - 0.3).toFixed(2), depBal: 40, depCommit: 40, txnVol: 26400, txnCommit: 26400 }) }],
    flow: [['approve', 'Concession within policy; deposit commitment documented in the sanction letter.', '2026-03-05']], final: 'Monitoring' });
  Outcomes.create(s1, { months: 5, asOf: Seed.AS_OF, abs: { depBal: 37, txnVol: 25100, tfVol: s1.scenarios[1].a.tfVol * 1.18 } });
  const s2 = mk('Deccan Gears', { code: 'SIM-1011', date: '2026-04-11', sel: 0, scen: [{ n: 'Scenario A · Bundle', ch: b => ({ wcRate: +(b.wcRate - 0.15).toFixed(2), condFeeOn: true, condDep: Math.round(b.depBal * 1.1), condVol: Math.round(b.txnVol * 1.1), condFee: 4, depBal: +(b.depBal * 1.15).toFixed(1), txnVol: Math.round(b.txnVol * 1.15) }) }],
    flow: [['approve', 'Bundle pricing approved.', '2026-04-14']], final: 'Monitoring' });
  Outcomes.create(s2, { months: 4, asOf: Seed.AS_OF, depBal: 1.06, txnVol: 1.04, tfVol: 1.08 });
  mk('Coromandel Weaves', { code: 'SIM-1015', date: '2026-06-18', sel: 0, scen: [{ n: 'Scenario A · Price match', ch: b => ({ wcRate: +(b.wcRate - 0.6).toFixed(2) }) }],
    flow: [['reject', 'RAROC falls below target and no offsetting balances are committed. Revisit with deposit commitment.', '2026-06-20']] });
  mk('Konark Auto', { code: 'SIM-1018', date: '2026-08-07', sel: 1, scen: [{ ch: b => ({ wcRate: +(b.wcRate - 0.1).toFixed(2) }) }, { ch: b => ({ wcRate: +(b.wcRate - 0.3).toFixed(2), depBal: +(b.depBal * 1.4).toFixed(1), depCommit: +(b.depBal * 1.4).toFixed(1) }) }],
    flow: [['approve', 'Approved subject to quarterly commitment review.', '2026-08-10']] });
  mk('Vardhan Precision', { code: 'SIM-1021', date: '2026-09-14', sel: 1, scen: [{ ch: b => ({ wcRate: +(b.wcRate - 0.25).toFixed(2) }) }, { ch: b => ({ wcRate: +(b.wcRate - 0.35).toFixed(2), depBal: +(b.depBal * 1.3).toFixed(1), depCommit: +(b.depBal * 1.3).toFixed(1), txnVol: Math.round(b.txnVol * 1.2), txnCommit: Math.round(b.txnVol * 1.2) }) }], flow: [] });
  mk('Indus Denim', { code: 'SIM-1022', date: '2026-09-18', owner: 'u-rm', sel: 0, rh: true, scen: [{ ch: b => ({ wcRate: +(b.wcRate - 0.2).toFixed(2), tfVol: +(b.tfVol * 1.2).toFixed(1), tfCommit: +(b.tfVol * 1.2).toFixed(1) }) }], flow: [] });
  mk('Chola Brake', { code: 'SIM-1024', date: '2026-09-22', sel: null, scen: [{ ch: b => ({ wcRate: +(b.wcRate - 0.15).toFixed(2) }) }, { ch: b => ({ depBal: +(b.depBal * 1.2).toFixed(1) }) }] });
  const s8 = mk('Shivalik Radiators', { code: 'SIM-1025', date: '2026-09-25', sel: null, scen: [] }); s8.status = 'Draft';
  // Non-relationship pipeline items (summaries; full models live on their pages)
  const extra = [
    { code: 'SIM-1012', type: 'campaign', name: 'SME deposit growth campaign — Q2', owner: 'u-prod', status: 'Monitoring', date: '2026-05-02', impact: 0.43, revImpact: 0.94, scope: 'SME · all regions' },
    { code: 'SIM-1016', type: 'enterprise', name: 'Rate cycle review — −100 bps', owner: 'u-cfo', status: 'Executed', date: '2026-07-01', impact: -62.4, revImpact: -58.1, scope: 'Enterprise' },
    { code: 'SIM-1020', type: 'product', name: 'Cash management tariff review FY27', owner: 'u-prod', status: 'Simulated', date: '2026-09-09', impact: 0.62, revImpact: 0.55, scope: 'Cash Management' },
    { code: 'SIM-1023', type: 'portfolio', name: 'SME manufacturing growth plan', owner: 'u-port', status: 'Under Review', date: '2026-09-20', impact: 2.1, revImpact: 3.4, scope: 'SME Manufacturing' },
  ];
  extra.forEach(x => { S.sims.push({ id: uid('S'), code: x.code, type: x.type, name: x.name, owner: x.owner, status: x.status, createdAt: d(x.date), updatedAt: d(x.date), impact: x.impact, revImpact: x.revImpact, scope: x.scope, scenarios: [], approvals: [] });
    audit('Simulation created', { simId: S.sims[S.sims.length - 1].id, ts: d(x.date), user: userById(x.owner).name, role: Seed.ROLES[userById(x.owner).role], newV: x.status }); });
  S.outcomes.reverse();
  S.audit.sort((p, q) => q.ts.localeCompare(p.ts));
}

/* ---------------- chart helpers (inline SVG, theme-aware) ---------------- */
const Chart = {
  line({ series, w = 640, h = 240, xFmt = v => v, yFmt = v => fmt(v, 1), target, xLabel = '', marker }) {
    const pad = { l: 58, r: 16, t: 14, b: 34 };
    const xs = series.flatMap(s => s.points.map(p => p.x)), ys = series.flatMap(s => s.points.map(p => p.y)).concat(target != null ? [target] : []);
    if (!xs.length) return '<div class="empty">No data</div>';
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (x0 === x1) x1 = x0 + 1; const yp = (y1 - y0) * 0.12 || Math.abs(y1) * 0.1 || 1; y0 -= yp; y1 += yp;
    const X = v => pad.l + (v - x0) / (x1 - x0) * (w - pad.l - pad.r), Y = v => h - pad.b - (v - y0) / (y1 - y0) * (h - pad.t - pad.b);
    const ticks = 5; let g = '';
    for (let i = 0; i <= ticks; i++) { const v = y0 + (y1 - y0) * i / ticks; g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${pad.l - 8}" y="${Y(v) + 4}" class="ax" text-anchor="end">${esc(yFmt(v))}</text>`; }
    const uniqX = [...new Set(xs)].sort((a, b) => a - b); const every = Math.ceil(uniqX.length / 8);
    uniqX.forEach((v, i) => { if (i % every === 0 || i === uniqX.length - 1) g += `<text x="${X(v)}" y="${h - pad.b + 18}" class="ax" text-anchor="middle">${esc(xFmt(v))}</text>`; });
    if (target != null) g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(target)}" y2="${Y(target)}" class="target"/><text x="${w - pad.r}" y="${Y(target) - 5}" class="ax tgt" text-anchor="end">Target ${esc(yFmt(target))}</text>`;
    if (marker != null) g += `<line x1="${X(marker)}" x2="${X(marker)}" y1="${pad.t}" y2="${h - pad.b}" class="marker"/><text x="${X(marker) + 4}" y="${pad.t + 10}" class="ax">Current</text>`;
    series.forEach(s => {
      const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
      g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2}" ${s.dash ? 'stroke-dasharray="4 4"' : ''}/>`;
      if (s.dots !== false) s.points.forEach(p => g += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3" fill="${s.color}"><title>${esc(s.name)}: ${esc(xFmt(p.x))} → ${esc(yFmt(p.y))}</title></circle>`);
    });
    if (xLabel) g += `<text x="${(w + pad.l) / 2}" y="${h - 2}" class="ax" text-anchor="middle">${esc(xLabel)}</text>`;
    return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" preserveAspectRatio="xMidYMid meet">${g}</svg>`;
  },
  tornado(rows, { w = 640, padL = 220, fmtV = v => cr(v) } = {}) {
    const rowH = 30, pad = { l: padL, r: 70, t: 22 }; const h = pad.t + rows.length * rowH + 10;
    const m = Math.max(...rows.map(r => Math.max(Math.abs(r.lo), Math.abs(r.hi))), 0.0001);
    const cx = pad.l + (w - pad.l - pad.r) / 2, half = (w - pad.l - pad.r) / 2; let g = `<line x1="${cx}" x2="${cx}" y1="${pad.t - 8}" y2="${h - 6}" class="axis"/>`;
    g += `<text x="${cx - 6}" y="12" class="ax" text-anchor="end">Downside</text><text x="${cx + 6}" y="12" class="ax">Upside</text>`;
    rows.forEach((r, i) => {
      const y = pad.t + i * rowH; const lo = Math.min(r.lo, r.hi), hi = Math.max(r.lo, r.hi);
      g += `<text x="${pad.l - 10}" y="${y + 18}" class="lbl" text-anchor="end">${esc(r.label)}</text>`;
      g += `<rect x="${cx + lo / m * half}" y="${y + 6}" width="${Math.max(1, -lo / m * half)}" height="18" class="bar-neg"><title>${esc(fmtV(lo))}</title></rect>`;
      g += `<rect x="${cx}" y="${y + 6}" width="${Math.max(1, hi / m * half)}" height="18" class="bar-pos"><title>${esc(fmtV(hi))}</title></rect>`;
      g += `<text x="${w - 4}" y="${y + 19}" class="ax" text-anchor="end">±${esc(fmtV(Math.abs(hi - lo) / 2))}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img">${g}</svg>`;
  },
  waterfall(steps, { w = 640, h = 230 } = {}) {
    const pad = { l: 12, r: 12, t: 22, b: 46 }; let run = 0; const bars = [];
    steps.forEach(s => { if (s.total) { bars.push({ ...s, from: 0, to: s.value }); run = s.value; } else { bars.push({ ...s, from: run, to: run + s.value }); run += s.value; } });
    const all = bars.flatMap(b => [b.from, b.to]); const y0 = Math.min(0, ...all), y1 = Math.max(...all) * 1.08;
    const bw = (w - pad.l - pad.r) / bars.length; const Y = v => h - pad.b - (v - y0) / (y1 - y0) * (h - pad.t - pad.b);
    let g = `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(0)}" y2="${Y(0)}" class="axis"/>`;
    bars.forEach((b, i) => {
      const x = pad.l + i * bw + bw * 0.16, top = Math.min(Y(b.from), Y(b.to)), hh = Math.max(1.5, Math.abs(Y(b.from) - Y(b.to)));
      const cls = b.total ? 'bar-total' : b.value >= 0 ? 'bar-pos' : 'bar-neg';
      g += `<rect x="${x}" y="${top}" width="${bw * 0.68}" height="${hh}" class="${cls}"><title>${esc(b.label)}: ${esc(cr(b.value))}</title></rect>`;
      g += `<text x="${x + bw * 0.34}" y="${top - 5}" class="ax" text-anchor="middle">${b.value < 0 ? '−' : ''}${fmt(Math.abs(b.value), 2)}</text>`;
      const words = b.label.split(' '); const l1 = words.slice(0, 2).join(' '), l2 = words.slice(2).join(' ');
      g += `<text x="${x + bw * 0.34}" y="${h - pad.b + 16}" class="ax" text-anchor="middle">${esc(l1)}</text>`;
      if (l2) g += `<text x="${x + bw * 0.34}" y="${h - pad.b + 29}" class="ax" text-anchor="middle">${esc(l2)}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img">${g}</svg>`;
  },
  bars(groups, { w = 640, h = 220, yFmt = v => fmt(v, 1), target } = {}) {
    // groups: [{label, values:[{name,color,v}]}]
    const pad = { l: 52, r: 10, t: 16, b: 34 }; const vals = groups.flatMap(g => g.values.map(v => v.v)).concat(target != null ? [target] : []);
    const y0 = Math.min(0, ...vals), y1 = Math.max(...vals) * 1.12 || 1; const Y = v => h - pad.b - (v - y0) / (y1 - y0) * (h - pad.t - pad.b);
    const gw = (w - pad.l - pad.r) / groups.length; let g = '';
    for (let i = 0; i <= 4; i++) { const v = y0 + (y1 - y0) * i / 4; g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${pad.l - 6}" y="${Y(v) + 4}" class="ax" text-anchor="end">${esc(yFmt(v))}</text>`; }
    groups.forEach((gr, i) => {
      const n = gr.values.length; const bw = gw * 0.72 / n;
      gr.values.forEach((v, j) => { const x = pad.l + i * gw + gw * 0.14 + j * bw; const top = Math.min(Y(0), Y(v.v)); g += `<rect x="${x}" y="${top}" width="${bw - 2}" height="${Math.max(1, Math.abs(Y(v.v) - Y(0)))}" fill="${v.color}"><title>${esc(v.name)}: ${esc(yFmt(v.v))}</title></rect>`; });
      g += `<text x="${pad.l + i * gw + gw / 2}" y="${h - pad.b + 18}" class="ax" text-anchor="middle">${esc(gr.label)}</text>`;
    });
    if (target != null) g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(target)}" y2="${Y(target)}" class="target"/><text x="${w - pad.r}" y="${Y(target) - 4}" class="ax tgt" text-anchor="end">Target ${esc(yFmt(target))}</text>`;
    return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img">${g}</svg>`;
  },
  spark(vals, { w = 120, h = 32, color = 'var(--brand)' } = {}) {
    const a = Math.min(...vals), b = Math.max(...vals) || 1; const X = i => i / (vals.length - 1) * (w - 4) + 2, Y = v => h - 3 - (v - a) / ((b - a) || 1) * (h - 6);
    return `<svg viewBox="0 0 ${w} ${h}" class="spark"><path d="${vals.map((v, i) => `${i ? 'L' : 'M'}${X(i)},${Y(v)}`).join('')}" fill="none" stroke="${color}" stroke-width="1.6"/></svg>`;
  },
  stack(parts) {
    const t = parts.reduce((s, p) => s + Math.max(0, p.v), 0) || 1;
    return `<div class="stackbar">${parts.map(p => `<span style="flex:${Math.max(0, p.v) / t};background:${p.color}" title="${esc(p.name)}: ${esc(cr(p.v))} (${fmt(p.v / t * 100, 0)}%)"></span>`).join('')}</div><div class="legend">${parts.map(p => `<span><i style="background:${p.color}"></i>${esc(p.name)} ${fmt(p.v / t * 100, 0)}%</span>`).join('')}</div>`;
  },
};

/* ---------------- modal & toast ---------------- */
let modalHandler = null;
function openModal({ title, body, confirm = 'Confirm', cancel = 'Cancel', onConfirm, danger }) {
  modalHandler = onConfirm;
  $('#modal').innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="mt"><h3 id="mt">${esc(title)}</h3><div class="modal-body">${body}</div><div class="modal-err" id="modal-err"></div><div class="modal-actions"><button class="btn ghost" data-act="modal-close">${esc(cancel)}</button>${onConfirm ? `<button class="btn ${danger ? 'danger' : 'primary'}" data-act="modal-ok">${esc(confirm)}</button>` : ''}</div></div>`;
  $('#modal').classList.add('open'); setTimeout(() => ($('#modal input, #modal textarea, #modal select') || $('#modal .btn.primary'))?.focus(), 30);
}
function closeModal() { $('#modal').classList.remove('open'); $('#modal').innerHTML = ''; modalHandler = null; }
function modalValues() { const o = {}; document.querySelectorAll('#modal [name]').forEach(el => o[el.name] = el.type === 'checkbox' ? el.checked : el.value); return o; }
function notify(msg, kind = 'ok') { const t = document.createElement('div'); t.className = `toast ${kind}`; t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.classList.add('out'), 3600); setTimeout(() => t.remove(), 4100); }

/* ---------------- router & shell ---------------- */
const ROUTES = [];
const route = (re, fn, meta) => ROUTES.push({ re, fn, meta });
const go = h => { if (location.hash === h) render(); else location.hash = h; };
const UI = { tab: 'build', scen: null, sens: null, product: null };

const NAV = [
  { h: '#/home', t: 'Decision centre', i: 'M3 12l9-8 9 8M5 10v10h14V10' },
  { sec: 'Simulate' },
  { h: '#/customers', t: 'Relationships', i: 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21c0-4 4-6 8-6s8 2 8 6', m: /^#\/(customers|customer|sim)/ },
  { h: '#/prospects', t: 'Prospects', i: 'M12 5v14M5 12h14' },
  { h: '#/product', t: 'Products', i: 'M4 7h16v12H4zM4 7l2-3h12l2 3' },
  { h: '#/portfolio', t: 'Portfolios', i: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { h: '#/campaign', t: 'Campaigns', i: 'M3 11l15-6v14L3 13zM7 13v5' },
  { h: '#/enterprise', t: 'Enterprise stress', i: 'M13 2L3 14h8l-1 8 10-12h-8z' },
  { sec: 'Govern' },
  { h: '#/library', t: 'Scenario library', i: 'M4 4h6v16H4zM14 4h6v16h-6z' },
  { h: '#/approvals', t: 'Decisions & approvals', i: 'M5 13l4 4L19 7', m: /^#\/(approvals|package)/ },
  { h: '#/outcomes', t: 'Outcome tracking', i: 'M3 17l6-6 4 4 8-8' },
  { h: '#/audit', t: 'Audit trail', i: 'M6 3h9l4 4v14H6zM9 12h7M9 16h7' },
  { sec: 'Configure' },
  { h: '#/pricing', t: 'Pricing rules', i: 'M4 6h16M4 12h10M4 18h6' },
  { h: '#/admin', t: 'Administration', i: 'M12 8a4 4 0 100 8 4 4 0 000-8zM3 12h2M19 12h2M12 3v2M12 19v2' },
];
const icon = d => `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="${d}"/></svg>`;

function shell(inner, title, crumbs = '') {
  const u = me(); const h = location.hash || '#/home';
  const pendingMine = S.sims.filter(s => s.approvals?.some((a, i) => a.status === 'Pending' && s.approvals.findIndex(x => x.status === 'Pending') === i && a.role === u.role)).length;
  const nav = NAV.map(n => n.sec ? `<div class="nav-sec">${n.sec}</div>` : `<a href="${n.h}" class="nav-i ${(n.m ? n.m.test(h) : h.startsWith(n.h)) ? 'on' : ''}">${icon(n.i)}<span>${n.t}</span>${n.h === '#/approvals' && pendingMine ? `<b class="badge">${pendingMine}</b>` : ''}</a>`).join('');
  return `<aside class="side"><a class="brand" href="#/home"><span class="prism-mark" aria-hidden="true"></span><span><b>ValueMap Prism</b><small>Simulate</small></span></a><nav>${nav}</nav><div class="side-foot">Demonstration data — not actual bank data</div></aside>
  <div class="main"><header class="top"><div class="crumbs">${crumbs}<h1>${esc(title)}</h1></div><div class="top-r"><span class="demo-flag">Demo data · as of ${Seed.AS_OF}</span><button class="persona" data-act="persona-menu" aria-haspopup="true"><span class="av">${u.name.split(' ').map(x => x[0]).join('')}</span><span><b>${esc(u.name)}</b><small>${esc(Seed.ROLES[u.role])}</small></span><svg viewBox="0 0 24 24" class="ico sm"><path d="M6 9l6 6 6-6"/></svg></button><div class="persona-menu" id="pmenu">${Seed.USERS.map(x => `<button data-act="switch-user" data-id="${x.id}" class="${x.id === u.id ? 'on' : ''}"><b>${esc(x.name)}</b><small>${esc(Seed.ROLES[x.role])} · ${esc(x.scope)}</small></button>`).join('')}<button data-act="logout" class="lo">Back to persona selection</button></div></div></header>
  <main class="content" id="content">${inner}</main></div>`;
}

function loginView() {
  return `<div class="login"><div class="login-l"><div class="brand big"><span class="prism-mark"></span><span><b>ValueMap Prism</b><small>Simulate</small></span></div>
  <h1 class="login-h">Ask “what if?” before deciding “what next?”</h1>
  <p class="login-p">Model the full economics of a relationship, product or portfolio before a commercial decision is made — then govern it, approve it and track whether it delivered.</p>
  <ol class="cycle">${['Baseline', 'Assumptions', 'Simulation', 'Comparison', 'Decision', 'Approval', 'Outcome'].map((x, i) => `<li style="--c:${['var(--base-c)', ...SCEN_COLORS][i]}">${x}</li>`).join('')}</ol>
  <p class="fine">Proof of concept with synthetic data. Calculations are simplified management-accounting views, not regulatory capital or IFRS 9 figures.</p></div>
  <div class="login-r"><h2>Sign in as a demo persona</h2><div class="personas">${Seed.USERS.map(u => `<button class="pcard" data-act="login" data-id="${u.id}"><span class="av">${u.name.split(' ').map(x => x[0]).join('')}</span><span><b>${esc(u.name)}</b><em>${esc(Seed.ROLES[u.role])}</em><small>${esc(u.desc)}</small></span></button>`).join('')}</div>
  <p class="fine">Start with Ananya Mehta for the primary relationship-renewal demo.</p></div></div>`;
}

function render() {
  const root = $('#app');
  try {
    if (!S.userId) { root.className = 'login-mode'; root.innerHTML = loginView(); return; }
    root.className = '';
    const h = location.hash || '#/home';
    const r = ROUTES.find(x => x.re.test(h)) || ROUTES[0];
    const m = h.match(r.re) || [];
    const out = r.fn(...m.slice(1));
    root.innerHTML = shell(out.html, out.title, out.crumbs || '');
    out.after && out.after();
    const routeKey = h.split('/').slice(0, 3).join('/'); if (routeKey !== render.last) { window.scrollTo(0, 0); render.last = routeKey; }
  } catch (err) {
    console.error(err);
    root.innerHTML = shell(`<div class="panel error-state"><h2>This screen could not be displayed</h2><p>Something in the demo state is inconsistent. Reset the demo data from Administration, or go back to the Decision centre.</p><div class="row"><a class="btn primary" href="#/home">Go to Decision centre</a><button class="btn ghost" data-act="reset-demo">Reset demo data</button></div><details><summary>Technical detail</summary><pre>${esc(err.message)}</pre></details></div>`, 'Something went wrong');
  }
}
