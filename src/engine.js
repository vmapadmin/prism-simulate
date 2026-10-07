/* =====================================================================
   PRISM SIMULATE — CALCULATION ENGINE (pure, deterministic, no DOM)
   Layers: PricingEngine · ProfitabilityEngine · RiskService ·
           SensitivityService · DriverService · StressService ·
           PortfolioEngine · CampaignEngine · ProductEngine
   All money in INR Crore (Cr) unless stated. 1 Cr = 1e7 INR.
   NOTE: simplified management-accounting formulas for demonstration.
         Not regulatory capital, IFRS 9 or Basel calculations.
   ===================================================================== */
const Engine = (() => {
  const CR = 1e7;
  const round = (x, d = 6) => Math.round(x * 10 ** d) / 10 ** d;

  /* ---------------- PRICING ENGINE ---------------- */
  const METRIC_LABEL = { volume: 'Monthly transaction volume', value: 'Monthly transaction value (Cr)', deposit: 'Deposit balance (Cr)' };
  function metricValue(ctx, m) {
    if (m === 'volume') return ctx.volume;
    if (m === 'value') return ctx.value / CR;
    if (m === 'deposit') return ctx.deposit;
    return 0;
  }
  function compare(v, op, t) {
    switch (op) { case '>=': return v >= t; case '>': return v > t; case '<=': return v <= t; case '<': return v < t; case '=': return v === t; default: return false; }
  }
  function checkConditions(cond, ctx) {
    if (!cond || !cond.items || !cond.items.length) return { ok: true, trace: [] };
    const res = cond.items.map(c => {
      const v = metricValue(ctx, c.metric); const ok = compare(v, c.cmp, Number(c.value));
      return { ok, text: `${METRIC_LABEL[c.metric]} = ${fmtN(v)} ${c.cmp} ${fmtN(c.value)} → ${ok ? 'met' : 'not met'}` };
    });
    const ok = cond.op === 'OR' ? res.some(r => r.ok) : res.every(r => r.ok);
    return { ok, trace: [...res.map(r => r.text), `${cond.op} combination → ${ok ? 'rule applies' : 'rule does not apply'}`] };
  }
  const fmtN = v => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-IN') : round(v, 2).toString());
  // rate: INR per transaction when appliedTo = volume; % of value when appliedTo = value
  function applyRate(rate, appliedTo, ctx) { return appliedTo === 'value' ? ctx.value * rate / 100 : rate * ctx.volume; }
  function rateText(rate, appliedTo) { return appliedTo === 'value' ? `${rate}% of value` : `₹${rate} per transaction`; }

  /** Evaluate a pricing rule for one month. Returns monthly fee in INR and a readable trace. */
  function evaluatePricing(rule, ctx) {
    const trace = [];
    const cond = checkConditions(rule.conditions, ctx);
    trace.push(...cond.trace);
    if (!cond.ok) {
      const fee = applyRate(Number(rule.elseRate || 0), 'volume', ctx);
      trace.push(`Fallback: ₹${rule.elseRate} × ${fmtN(ctx.volume)} txns = ₹${fmtN(fee)}`);
      return { fee, perTxn: ctx.volume ? fee / ctx.volume : 0, trace, applied: false };
    }
    let fee = 0; let tierIdx = -1;
    const appliedTo = rule.appliedTo || 'volume';
    switch (rule.type) {
      case 'fixed':
        fee = applyRate(Number(rule.rate), appliedTo, ctx);
        trace.push(`Fixed: ${rateText(rule.rate, appliedTo)} applied to ${appliedTo} = ₹${fmtN(fee)}`);
        break;
      case 'percent': {
        const pct = Number(rule.pct);
        const hasBounds = rule.min != null && rule.min !== '' || rule.max != null && rule.max !== '';
        if (hasBounds) {
          let per = ctx.avgValue * pct / 100; const raw = per;
          if (rule.min !== '' && rule.min != null) per = Math.max(per, Number(rule.min));
          if (rule.max !== '' && rule.max != null) per = Math.min(per, Number(rule.max));
          fee = per * ctx.volume;
          trace.push(`${pct}% × avg value ₹${fmtN(ctx.avgValue)} = ₹${fmtN(raw)} per txn; bounded [${rule.min ?? '–'}, ${rule.max ?? '–'}] → ₹${fmtN(per)}`);
          trace.push(`₹${fmtN(per)} × ${fmtN(ctx.volume)} txns = ₹${fmtN(fee)}`);
        } else {
          fee = ctx.value * pct / 100;
          trace.push(`${pct}% × monthly value ₹${fmtN(ctx.value)} = ₹${fmtN(fee)}`);
        }
        break;
      }
      case 'slab': {
        const basis = metricValue(ctx, rule.basedOn || 'volume');
        tierIdx = rule.tiers.findIndex(t => t.to == null || t.to === '' || basis <= Number(t.to));
        if (tierIdx < 0) tierIdx = rule.tiers.length - 1;
        const t = rule.tiers[tierIdx];
        fee = applyRate(Number(t.rate), appliedTo, ctx);
        trace.push(`Based on ${METRIC_LABEL[rule.basedOn || 'volume']} = ${fmtN(basis)} → tier ${tierIdx + 1} (${t.from}–${t.to ?? '∞'})`);
        trace.push(`Applied to ${appliedTo}: ${rateText(t.rate, appliedTo)} on the whole ${appliedTo} = ₹${fmtN(fee)}`);
        break;
      }
      case 'progressive': {
        // Each band of the applied-to quantity is charged at its own rate
        const q = appliedTo === 'value' ? ctx.value / CR : ctx.volume;
        rule.tiers.forEach((t, i) => {
          const from = Number(t.from); const to = t.to == null || t.to === '' ? Infinity : Number(t.to);
          const portion = Math.max(0, Math.min(q, to) - from);
          if (portion <= 0) return;
          const part = appliedTo === 'value' ? portion * CR * Number(t.rate) / 100 : portion * Number(t.rate);
          fee += part;
          trace.push(`Band ${i + 1} (${from}–${to === Infinity ? '∞' : to}): ${fmtN(portion)} × ${rateText(t.rate, appliedTo)} = ₹${fmtN(part)}`);
        });
        trace.push(`Progressive total = ₹${fmtN(fee)}`);
        break;
      }
      default: trace.push('Unknown rule type');
    }
    return { fee, perTxn: ctx.volume ? fee / ctx.volume : 0, trace, applied: true, tierIdx };
  }

  /* ---------------- PROFITABILITY ENGINE (relationship) ---------------- */
  function effective(a, base, k, f) { return base && a[k] > base[k] ? base[k] + (a[k] - base[k]) * f : a[k]; }

  /**
   * SimulationRequest: assumptions a, baseline b, config cfg
   * SimulationResult: kpi, lines, trace (per KPI), drivers-ready
   */
  function simulate(a, b, cfg) {
    const f = (a.fulfilPct ?? 100) / 100; // commitment fulfilment probability applied to uplifts only
    const cof = (a.cofBps || 0) / 100;     // parallel funding shift in % points
    const depBal = effective(a, b, 'depBal', f);
    const txnVol = effective(a, b, 'txnVol', f);
    const tfVol = effective(a, b, 'tfVol', f);
    const attr = 1 - (a.attritionPct || 0) / 100;

    // Lending
    const wcII = a.wcBal * a.wcRate / 100, wcFund = a.wcBal * (a.wcFtp + cof) / 100;
    const tlII = a.tlBal * a.tlRate / 100, tlFund = a.tlBal * (a.tlFtp + cof) / 100;
    const invII = a.invBal * a.invYield / 100, invFund = a.invBal * (a.wcFtp + cof) / 100;
    const interestIncome = wcII + tlII + invII;
    const fundingCost = wcFund + tlFund + invFund;
    const lendingNII = interestIncome - fundingCost;
    // Deposits: funding value = balance × (FTP credit − customer rate)
    const depValue = depBal * attr * (a.depFtp + cof * 0.5 - a.depRate) / 100;
    const nii = lendingNII + depValue;

    // Transaction banking via pricing engine
    const monthlyValue = txnVol * a.txnVal;
    const disc = 1 - (a.feeDiscPct || 0) / 100;
    const rule = a.condFeeOn
      ? { type: 'fixed', rate: a.condFee * disc, appliedTo: 'volume', elseRate: a.txnFee * disc, conditions: { op: 'AND', items: [{ metric: 'deposit', cmp: '>=', value: a.condDep }, { metric: 'volume', cmp: '>=', value: a.condVol }] } }
      : { type: 'fixed', rate: a.txnFee * disc, appliedTo: 'volume' };
    const pr = evaluatePricing(rule, { volume: txnVol, value: monthlyValue, avgValue: a.txnVal, deposit: depBal });
    const txnFeeRev = pr.fee * 12 / CR * attr;
    const tfFee = tfVol * a.tfComm / 100 * attr;
    const otherInc = a.otherInc;
    const feeIncome = txnFeeRev + tfFee + otherInc;
    const revenue = nii + feeIncome;

    // Costs
    const txnCost = txnVol * 12 * a.txnCostPer / CR;
    const directCost = a.directCost + a.servicingCost + txnCost;
    const indirectCost = a.indirectCost;
    const totalCost = directCost + indirectCost;

    // Risk & capital (simplified)
    const undrawn = Math.max(0, a.wcLimit - a.wcBal);
    const tfOut = tfVol * 0.25; // ~90-day average tenor
    const ead = a.wcBal + a.tlBal + a.invBal + undrawn * a.ccf / 100 + tfOut * 0.2;
    const el = ead * a.pd / 100 * a.lgd / 100 * (a.riskMult / 100);
    const rwa = ead * a.riskWeight / 100;
    const capital = rwa * cfg.capitalRatio / 100;
    const pbt = revenue - totalCost - el;
    const pat = pbt * (1 - cfg.taxRate / 100);
    const raroc = capital > 0 ? pat / capital * 100 : 0;
    const eva = pat - capital * cfg.hurdleRate / 100;

    // Commitment coverage today (baseline actual vs commitment asked)
    const ref = b || a;
    const cov = [ref.depBal / a.depCommit, ref.txnVol / a.txnCommit, ref.tfVol / a.tfCommit].map(x => Math.min(1, x || 0));
    const commitCoverage = cov.reduce((s, x) => s + x, 0) / cov.length * 100;

    const kpi = { interestIncome, fundingCost, lendingNII, depValue, nii, txnFeeRev, tfFee, otherInc, feeIncome, revenue, directCost, indirectCost, totalCost, el, ead, rwa, capital, pbt, pat, raroc, eva, commitCoverage, effDep: depBal, effTxn: txnVol, effTf: tfVol, txnPerFee: pr.perTxn };
    const c = v => `₹${round(v, 2).toFixed(2)} Cr`;
    const trace = {
      revenue: [['Lending interest income', interestIncome, `Σ balance × rate: WC ${a.wcBal}×${a.wcRate}% + TL ${a.tlBal}×${a.tlRate}%${a.invBal ? ` + Inv ${a.invBal}×${a.invYield}%` : ''}`], ['− Funding cost (FTP)', -fundingCost, `Σ balance × (FTP + shift ${round(cof * 100, 0)} bps)`], ['+ Deposit funding value', depValue, `${round(depBal, 2)} Cr × (FTP credit ${a.depFtp}% − customer rate ${a.depRate}%)`], ['+ Transaction fees', txnFeeRev, `${Math.round(txnVol).toLocaleString('en-IN')} txns × ₹${round(pr.perTxn, 2)} × 12`], ['+ Trade finance commission', tfFee, `${round(tfVol, 1)} Cr × ${a.tfComm}%`], ['+ Other income', otherInc, 'Processing & ancillary fees'], ['= Relationship revenue', revenue, '']],
      nii: [['Lending interest income', interestIncome, ''], ['− Funding cost (FTP)', -fundingCost, ''], ['= Lending NII', lendingNII, ''], ['+ Deposit funding value', depValue, `${round(depBal, 2)} Cr × ${round(a.depFtp + cof * 0.5 - a.depRate, 2)}% net`], ['= Net interest income', nii, '']],
      profit: [['Relationship revenue', revenue, 'Net of funding cost'], ['− Direct & servicing cost', -directCost, `Fixed ${round(a.directCost + a.servicingCost, 2)} Cr + ₹${a.txnCostPer}/txn processing`], ['− Allocated indirect cost', -indirectCost, 'Allocation key: relationship tier'], ['− Expected loss (risk cost)', -el, `EAD ${round(ead, 1)} × PD ${a.pd}% × LGD ${a.lgd}% × ${a.riskMult}%`], ['= Profit before tax', pbt, ''], [`− Tax @ ${cfg.taxRate}%`, -(pbt - pat), ''], ['= Risk-adjusted profit after tax', pat, '']],
      raroc: [['Risk-adjusted profit after tax', pat, ''], ['RWA', rwa, `EAD ${round(ead, 1)} Cr × risk weight ${a.riskWeight}%`], ['Allocated economic capital', capital, `RWA × ${cfg.capitalRatio}%`], ['RAROC = PAT ÷ capital', null, `${round(raroc, 2)}%`]],
      rwa: [['Funded exposure', a.wcBal + a.tlBal + a.invBal, 'WC + TL + investments'], ['Undrawn × CCF', undrawn * a.ccf / 100, `${round(undrawn, 1)} Cr × ${a.ccf}%`], ['Trade finance outstanding × 20%', tfOut * 0.2, `${round(tfVol, 1)} Cr × 25% tenor factor × 20%`], ['= EAD', ead, ''], ['× Risk weight', null, `${a.riskWeight}%`], ['= RWA', rwa, '']],
    };
    trace.pricing = pr.trace;
    return { kpi, trace, fmt: c };
  }

  /* ---------------- WARNINGS ---------------- */
  function warnings(res, baseRes, a, b, cfg, meta = {}) {
    const w = [];
    const k = res.kpi, bk = baseRes.kpi;
    const dp = (k.pbt - bk.pbt) / Math.abs(bk.pbt || 1) * 100;
    if (dp < -5) w.push({ level: 'high', type: 'Profitability', text: `Scenario reduces relationship profit by ${Math.abs(dp).toFixed(1)}%.` });
    if (k.raroc < cfg.targetRaroc) w.push({ level: 'high', type: 'RAROC', text: `RAROC ${k.raroc.toFixed(1)}% falls below configured target of ${cfg.targetRaroc}%.` });
    if (k.pbt < cfg.minRelProfit) w.push({ level: 'high', type: 'Profitability', text: `Profit ₹${k.pbt.toFixed(2)} Cr is below the minimum relationship profit of ₹${cfg.minRelProfit} Cr.` });
    if (meta.peakDep && a.depCommit > meta.peakDep * 1.1) w.push({ level: 'med', type: 'Commitment', text: `Required deposit commitment is ${((a.depCommit / meta.peakDep - 1) * 100).toFixed(0)}% above the customer's historical peak balance of ₹${meta.peakDep} Cr.` });
    if (meta.peakTxn && a.txnCommit > meta.peakTxn * 1.1) w.push({ level: 'med', type: 'Commitment', text: `Transaction commitment ${Math.round(a.txnCommit).toLocaleString('en-IN')}/month is ${((a.txnCommit / meta.peakTxn - 1) * 100).toFixed(0)}% above historical peak.` });
    const drwa = k.rwa - bk.rwa;
    if (drwa > cfg.rwaReviewCr) w.push({ level: 'high', type: 'Risk', text: `Scenario increases RWA by ₹${drwa.toFixed(1)} Cr (risk review threshold ₹${cfg.rwaReviewCr} Cr).` });
    const bps = Math.round((b.wcRate - a.wcRate) * 100);
    if (bps > cfg.pricingExceptionBps) w.push({ level: 'med', type: 'Pricing', text: `Working-capital rate is ${bps} bps below current pricing — pricing exception approval required.` });
    if ((a.fulfilPct ?? 100) < 100) w.push({ level: 'info', type: 'Behaviour', text: `Uplifts are weighted by a ${a.fulfilPct}% commitment-fulfilment probability.` });
    (meta.staleSources || []).forEach(s => w.push({ level: 'info', type: 'Data', text: `${s.name} data is ${s.ageDays} days old (as of ${s.asOf}).` }));
    return w;
  }

  /** Approval routing driven by configuration thresholds */
  function requiredApprovals(a, b, res, baseRes, cfg) {
    const bps = Math.round((b.wcRate - a.wcRate) * 100);
    const list = cfg.rhReview ? [{ role: 'RH', label: 'Relationship Head review', reason: 'Standard renewal review', stage: 'review' }] : [];
    if (bps > cfg.pricingExceptionBps) list.push({ role: 'PM', label: 'Pricing Manager approval', reason: `Pricing exception ${bps} bps > ${cfg.pricingExceptionBps} bps`, stage: 'approve' });
    if (res.kpi.rwa - baseRes.kpi.rwa > cfg.rwaReviewCr || res.kpi.raroc < cfg.targetRaroc) list.push({ role: 'RISK', label: 'Risk review', reason: res.kpi.raroc < cfg.targetRaroc ? 'RAROC below target' : 'RWA increase above threshold', stage: 'approve' });
    if (bps > cfg.businessHeadBps) list.push({ role: 'BH', label: 'Business Head approval', reason: `Pricing exception ${bps} bps > ${cfg.businessHeadBps} bps`, stage: 'approve' });
    if (!list.some(x => x.stage === 'approve')) list.push({ role: 'PM', label: 'Pricing Manager approval', reason: 'Within delegated authority — single approval', stage: 'approve' });
    return list;
  }

  /* ---------------- SENSITIVITY ---------------- */
  const SENS_VARS = {
    wcRate: { label: 'Working-capital lending rate', unit: '%', dec: 2 },
    depBal: { label: 'Deposit balance', unit: 'Cr', dec: 0 },
    txnVol: { label: 'Transaction volume / month', unit: 'txns', dec: 0 },
    cofBps: { label: 'Cost of funds shift', unit: 'bps', dec: 0 },
    riskMult: { label: 'Risk cost (% of modelled EL)', unit: '%', dec: 0 },
    tfVol: { label: 'Trade finance volume', unit: 'Cr', dec: 0 },
    fulfilPct: { label: 'Commitment fulfilment probability', unit: '%', dec: 0 },
  };
  const KPIS = { pbt: 'Profit before tax', raroc: 'RAROC', revenue: 'Revenue', nii: 'NII', eva: 'Economic value added' };
  function sensitivity(a, b, cfg, varKey, from, to, step, kpi) {
    const pts = []; if (step <= 0) return pts;
    const n = Math.min(200, Math.floor((to - from) / step + 1e-9));
    for (let i = 0; i <= n; i++) {
      const x = round(from + i * step, 4);
      const s = { ...a, [varKey]: x };
      if (varKey === 'depBal') s.depCommit = Math.max(a.depCommit, x);
      const r = simulate(s, b, cfg);
      pts.push({ x, y: r.kpi[kpi], raroc: r.kpi.raroc, pbt: r.kpi.pbt });
    }
    return pts;
  }

  /* ---------------- KEY DRIVERS (tornado) ---------------- */
  const DRIVERS = [
    { key: 'wcRate', label: 'Loan pricing (±10 bps)', lo: a => a.wcRate - 0.10, hi: a => a.wcRate + 0.10 },
    { key: 'depBal', label: 'Deposit balance (±10%)', lo: a => a.depBal * 0.9, hi: a => a.depBal * 1.1 },
    { key: 'txnVol', label: 'Transaction volume (±10%)', lo: a => a.txnVol * 0.9, hi: a => a.txnVol * 1.1 },
    { key: 'cofBps', label: 'Cost of funds (±25 bps)', lo: a => a.cofBps + 25, hi: a => a.cofBps - 25 },
    { key: 'riskMult', label: 'Risk cost (±25%)', lo: a => a.riskMult * 1.25, hi: a => a.riskMult * 0.75 },
    { key: 'tfVol', label: 'Trade finance volume (±10%)', lo: a => a.tfVol * 0.9, hi: a => a.tfVol * 1.1 },
    { key: 'wcBal', label: 'Working-capital utilisation (±10%)', lo: a => a.wcBal * 0.9, hi: a => Math.min(a.wcLimit, a.wcBal * 1.1) },
    { key: 'depFtp', label: 'Deposit FTP credit (±25 bps)', lo: a => a.depFtp - 0.25, hi: a => a.depFtp + 0.25 },
  ];
  function drivers(a, b, cfg, kpi = 'pbt') {
    const base = simulate(a, b, cfg).kpi[kpi];
    return DRIVERS.map(d => {
      const lo = simulate({ ...a, [d.key]: d.lo(a) }, b, cfg).kpi[kpi] - base;
      const hi = simulate({ ...a, [d.key]: d.hi(a) }, b, cfg).kpi[kpi] - base;
      return { key: d.key, label: d.label, lo, hi, range: Math.abs(hi - lo) };
    }).sort((x, y) => y.range - x.range);
  }

  /* ---------------- STRESS ---------------- */
  const STRESS_TEMPLATES = [
    { id: 'st-rate-up', name: 'Rate shock +100 bps', shocks: { rateBps: 100, cofBps: 0, riskPct: 0, depPct: 0, txnPct: 0 } },
    { id: 'st-rate-dn', name: 'Rate shock −100 bps', shocks: { rateBps: -100, cofBps: 0, riskPct: 0, depPct: 0, txnPct: 0 } },
    { id: 'st-cof', name: 'Funding shock: COF +75 bps', shocks: { rateBps: 0, cofBps: 75, riskPct: 0, depPct: 0, txnPct: 0 } },
    { id: 'st-risk', name: 'Credit stress: risk cost +25%', shocks: { rateBps: 0, cofBps: 0, riskPct: 25, depPct: 0, txnPct: 0 } },
    { id: 'st-dep', name: 'Deposit outflow −10%', shocks: { rateBps: 0, cofBps: 0, riskPct: 0, depPct: -10, txnPct: 0 } },
    { id: 'st-txn', name: 'Transaction decline −20%', shocks: { rateBps: 0, cofBps: 0, riskPct: 0, depPct: 0, txnPct: -20 } },
    { id: 'st-cfo', name: 'CFO combined: −100 bps rates, +50 bps COF, +15% risk', shocks: { rateBps: -100, cofBps: 50, riskPct: 15, depPct: 0, txnPct: 0 } },
  ];
  // Pass-through assumptions (documented): floating loan share 75%, loan FTP reprices 50% of a rate move,
  // deposit FTP credit reprices 100%, customer deposit rate beta 30%.
  function applyShocks(a, s) {
    const r = (s.rateBps || 0) / 100;
    return { ...a,
      wcRate: a.wcRate + r * 0.75, tlRate: a.tlRate + r * 0.75, wcFtp: a.wcFtp + r * 0.5, tlFtp: a.tlFtp + r * 0.5,
      depFtp: a.depFtp + r, depRate: Math.max(0, a.depRate + r * 0.3 * (a.depRate > 0 ? 1 : 0)),
      cofBps: (a.cofBps || 0) + (s.cofBps || 0),
      riskMult: a.riskMult * (1 + (s.riskPct || 0) / 100),
      depBal: a.depBal * (1 + (s.depPct || 0) / 100),
      txnVol: a.txnVol * (1 + (s.txnPct || 0) / 100),
    };
  }
  function stressOne(a, cfg, shocks) {
    const base = simulate(a, null, cfg); const st = simulate(applyShocks(a, shocks), null, cfg);
    return { base: base.kpi, stressed: st.kpi };
  }

  /* ---------------- AGGREGATION ---------------- */
  const SUM_KEYS = ['interestIncome', 'fundingCost', 'lendingNII', 'depValue', 'nii', 'txnFeeRev', 'tfFee', 'otherInc', 'feeIncome', 'revenue', 'totalCost', 'el', 'ead', 'rwa', 'capital', 'pbt', 'pat', 'eva'];
  function aggregate(kpis) {
    const t = {}; SUM_KEYS.forEach(k => t[k] = kpis.reduce((s, x) => s + x[k], 0));
    t.raroc = t.capital ? t.pat / t.capital * 100 : 0; return t;
  }

  /* ---------------- PORTFOLIO ENGINE ---------------- */
  function portfolio(customers, levers, cfg) {
    const L = { loanGrowth: 0, depGrowth: 0, pricingBps: 0, cofBps: 0, riskPct: 0, penetration: 0, mixShift: 0, exitLow: false, ...levers };
    const baseList = customers.map(c => ({ c, r: simulate(c.a, null, cfg).kpi }));
    // Mix shift: move X% of Textiles lending to Pharmaceuticals (pro rata)
    const tex = customers.filter(c => c.sector === 'Textiles');
    const pha = customers.filter(c => c.sector === 'Pharmaceuticals');
    const texLoans = tex.reduce((s, c) => s + c.a.wcBal + c.a.tlBal, 0);
    const phaLoans = pha.reduce((s, c) => s + c.a.wcBal + c.a.tlBal, 0) || 1;
    const moved = texLoans * L.mixShift / 100;
    const simList = customers.map((c, i) => {
      if (L.exitLow && baseList[i].r.raroc < 8) return { c, r: null, exited: true };
      const a = { ...c.a };
      const own = a.wcBal + a.tlBal;
      let mixF = 1;
      if (c.sector === 'Textiles') mixF = 1 - L.mixShift / 100;
      if (c.sector === 'Pharmaceuticals') mixF = 1 + moved / phaLoans;
      const g = (1 + L.loanGrowth / 100) * mixF;
      a.wcBal *= g; a.tlBal *= g; a.wcLimit *= g;
      a.depBal *= 1 + L.depGrowth / 100;
      a.wcRate += L.pricingBps / 100; a.tlRate += L.pricingBps / 100;
      a.cofBps = (a.cofBps || 0) + L.cofBps;
      a.riskMult *= 1 + L.riskPct / 100;
      a.txnVol *= 1 + L.penetration / 100; a.tfVol *= 1 + L.penetration / 100; a.otherInc *= 1 + L.penetration / 100;
      void own;
      return { c, r: simulate(a, null, cfg).kpi, a };
    });
    const base = aggregate(baseList.map(x => x.r));
    const live = simList.filter(x => x.r);
    const sim = aggregate(live.map(x => x.r));
    const loans = (list, pick) => list.reduce((s, x) => s + pick(x), 0);
    base.loans = loans(customers, c => c.a.wcBal + c.a.tlBal); sim.loans = loans(live, x => x.a.wcBal + x.a.tlBal);
    base.deposits = loans(customers, c => c.a.depBal); sim.deposits = loans(live, x => x.a.depBal);
    const bySector = {};
    customers.forEach((c, i) => {
      const s = bySector[c.sector] ||= { sector: c.sector, baseLoans: 0, simLoans: 0, basePbt: 0, simPbt: 0, baseCap: 0, simCap: 0, basePat: 0, simPat: 0, n: 0 };
      s.n++; s.baseLoans += c.a.wcBal + c.a.tlBal; s.basePbt += baseList[i].r.pbt; s.baseCap += baseList[i].r.capital; s.basePat += baseList[i].r.pat;
      const x = simList[i]; if (x.r) { s.simLoans += x.a.wcBal + x.a.tlBal; s.simPbt += x.r.pbt; s.simCap += x.r.capital; s.simPat += x.r.pat; }
    });
    const sectors = Object.values(bySector).map(s => ({ ...s, baseRaroc: s.basePat / s.baseCap * 100, simRaroc: s.simCap ? s.simPat / s.simCap * 100 : 0 }));
    const hhi = (key, tot) => sectors.reduce((h, s) => h + (s[key] / tot * 100) ** 2, 0);
    base.hhi = hhi('baseLoans', base.loans); sim.hhi = hhi('simLoans', sim.loans || 1);
    base.topShare = Math.max(...sectors.map(s => s.baseLoans / base.loans * 100));
    sim.topShare = Math.max(...sectors.map(s => s.simLoans / (sim.loans || 1) * 100));
    return { base, sim, sectors, exited: simList.filter(x => x.exited).map(x => x.c), count: live.length };
  }

  function enterpriseStress(customers, shocks, cfg) {
    const rows = customers.map(c => { const s = stressOne(c.a, cfg, shocks); return { c, ...s }; });
    const base = aggregate(rows.map(r => r.base)), stressed = aggregate(rows.map(r => r.stressed));
    const group = key => {
      const g = {};
      rows.forEach(r => { const k = r.c[key]; const x = g[k] ||= { name: k, base: [], st: [] }; x.base.push(r.base); x.st.push(r.stressed); });
      return Object.values(g).map(x => { const b = aggregate(x.base), s = aggregate(x.st); return { name: x.name, base: b, st: s, dPbt: s.pbt - b.pbt, dPct: (s.pbt - b.pbt) / Math.abs(b.pbt) * 100 }; }).sort((p, q) => p.dPct - q.dPct);
    };
    const products = [
      { name: 'Lending NII', key: 'lendingNII' }, { name: 'Deposit funding value', key: 'depValue' },
      { name: 'Transaction fees', key: 'txnFeeRev' }, { name: 'Trade finance fees', key: 'tfFee' }, { name: 'Expected loss', key: 'el', inverse: true },
    ].map(p => ({ ...p, base: base[p.key], st: stressed[p.key], d: (stressed[p.key] - base[p.key]) * (p.inverse ? -1 : 1) })).sort((x, y) => x.d - y.d);
    return { base, stressed, segments: group('segment'), sectors: group('sector'), products };
  }

  /* ---------------- PRODUCT (cash management) ENGINE ---------------- */
  function productSim(customers, rule, currentRule, elasticity, costPerTxn, fixedCost) {
    let revenue = 0, baseRevenue = 0, vol = 0, baseVol = 0; const impacts = [];
    customers.forEach(c => {
      const ctx0 = { volume: c.a.txnVol, value: c.a.txnVol * c.a.txnVal, avgValue: c.a.txnVal, deposit: c.a.depBal };
      const billed = r => r === 'actual' ? { type: 'fixed', rate: c.a.txnFee, appliedTo: 'volume' } : r; // 'actual' = each customer's billed tariff
      const cur = evaluatePricing(billed(currentRule), ctx0);
      const first = evaluatePricing(billed(rule), ctx0);
      const pctChange = cur.perTxn ? (first.perTxn - cur.perTxn) / cur.perTxn : 0;
      const newVol = Math.max(0, c.a.txnVol * (1 + elasticity * pctChange));
      const ctx1 = { ...ctx0, volume: newVol, value: newVol * c.a.txnVal };
      const nw = evaluatePricing(billed(rule), ctx1);
      baseRevenue += cur.fee * 12; revenue += nw.fee * 12; baseVol += c.a.txnVol; vol += newVol;
      impacts.push({ c, curFee: cur.fee * 12 / CR, newFee: nw.fee * 12 / CR, curPer: cur.perTxn, newPer: nw.perTxn, volChange: (newVol / c.a.txnVol - 1) * 100, trace: nw.trace });
    });
    const cost = x => x * 12 * costPerTxn / CR + fixedCost;
    const out = { revenue: revenue / CR, baseRevenue: baseRevenue / CR, vol, baseVol, cost: cost(vol), baseCost: cost(baseVol) };
    out.profit = out.revenue - out.cost; out.baseProfit = out.baseRevenue - out.baseCost;
    out.better = impacts.filter(i => i.newPer < i.curPer - 0.005).length; out.worse = impacts.filter(i => i.newPer > i.curPer + 0.005).length;
    out.impacts = impacts.sort((p, q) => (p.newFee - p.curFee) - (q.newFee - q.curFee));
    return out;
  }

  /* ---------------- CAMPAIGN ENGINE ---------------- */
  function campaign(p) {
    const contacted = p.targetCustomers * p.populationPct / 100;
    const responders = contacted * p.responsePct / 100;
    const grossNew = responders * p.upliftLakh / 100;             // Cr
    const cannibal = grossNew * p.cannibalPct / 100;               // existing money moving into promo
    const incremental = (grossNew - cannibal);
    const retainedAvg = incremental * (1 + p.retentionPct / 100) / 2; // average across year (linear decay to retained)
    const promoMargin = (p.ftpCredit - p.promoRate) / 100;
    const nii = retainedAvg * promoMargin;
    const cannibalCost = cannibal * (p.promoRate - p.oldRate) / 100;
    const crossSell = responders * p.crossSellPct / 100 * p.crossSellRevLakh / 100;
    const revenue = nii + crossSell;
    const cost = p.fixedCost + contacted * p.contactCostInr / CR + cannibalCost;
    const profit = revenue - cost;
    const roi = cost ? profit / cost * 100 : 0;
    // break-even response: profit is linear in response rate
    const perPct = (() => { const q = { ...p, responsePct: 1 }; const one = campaign.core(q); return one; })();
    const fixedPart = p.fixedCost + contacted * p.contactCostInr / CR;
    const breakEven = perPct > 0 ? fixedPart / perPct : Infinity;
    return { contacted, responders, grossNew, cannibal, incremental, retainedAvg, nii, crossSell, revenue, cost, cannibalCost, profit, roi, breakEven, yearEndBal: incremental * p.retentionPct / 100 };
  }
  // contribution per 1% response (excl. fixed and contact cost)
  campaign.core = p => {
    const contacted = p.targetCustomers * p.populationPct / 100; const responders = contacted * p.responsePct / 100;
    const grossNew = responders * p.upliftLakh / 100; const cannibal = grossNew * p.cannibalPct / 100; const inc = grossNew - cannibal;
    const nii = inc * (1 + p.retentionPct / 100) / 2 * (p.ftpCredit - p.promoRate) / 100;
    return nii + responders * p.crossSellPct / 100 * p.crossSellRevLakh / 100 - cannibal * (p.promoRate - p.oldRate) / 100;
  };

  /* ---------------- DETERMINISTIC PRNG (seed data, mock actuals) ---------------- */
  function prng(seed) { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t); r ^= r + Math.imul(r ^ r >>> 7, 61 | r); return ((r ^ r >>> 14) >>> 0) / 4294967296; }; }

  return { CR, round, evaluatePricing, checkConditions, simulate, warnings, requiredApprovals, sensitivity, drivers, SENS_VARS, KPIS, STRESS_TEMPLATES, applyShocks, stressOne, aggregate, portfolio, enterpriseStress, productSim, campaign, prng, METRIC_LABEL };
})();
if (typeof module !== 'undefined') module.exports = Engine;
