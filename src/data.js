/* =====================================================================
   PRISM SIMULATE — SYNTHETIC SEED DATA (Demonstration data, not bank data)
   Deterministic: generated from a fixed PRNG seed so every load is identical.
   ===================================================================== */
const Seed = (() => {
  const E = Engine;
  const AS_OF = '31-Aug-2026';

  const CONFIG = {
    targetRaroc: 15, minRelProfit: 3, pricingExceptionBps: 25, businessHeadBps: 50, rwaReviewCr: 10,
    capitalRatio: 13, taxRate: 25, hurdleRate: 14, makerChecker: true, rhReview: false, staleDays: 7,
  };

  const ROLES = {
    RM: 'Relationship Manager', PM: 'Pricing Manager', PROD: 'Product Manager', PORT: 'Portfolio Manager',
    RISK: 'Risk Manager', CFO: 'Chief Financial Officer', BH: 'Business Head', RH: 'Relationship Head',
  };
  const USERS = [
    { id: 'u-rm', name: 'Ananya Mehta', role: 'RM', scope: 'Mid Corporate · West', desc: 'Prices and renews client relationships.' },
    { id: 'u-pm', name: 'Rohan Shah', role: 'PM', scope: 'All segments', desc: 'Approves pricing exceptions against policy.' },
    { id: 'u-prod', name: 'Priya Kapoor', role: 'PROD', scope: 'Transaction Banking', desc: 'Owns cash management tariffs.' },
    { id: 'u-port', name: 'Amit Deshmukh', role: 'PORT', scope: 'SME Manufacturing', desc: 'Manages growth and mix of a portfolio.' },
    { id: 'u-risk', name: 'Neha Rao', role: 'RISK', scope: 'Wholesale credit', desc: 'Reviews capital and credit impact.' },
    { id: 'u-cfo', name: 'Vikram Sinha', role: 'CFO', scope: 'Enterprise', desc: 'Stress-tests enterprise earnings.' },
    { id: 'u-bh', name: 'Rajiv Menon', role: 'BH', scope: 'Wholesale Banking', desc: 'Final approver for large exceptions.' },
    { id: 'u-rh', name: 'Kavita Iyer', role: 'RH', scope: 'West region', desc: 'Reviews renewals in the region.' },
  ];

  const SECTORS = ['Auto Components', 'Pharmaceuticals', 'Engineering', 'Textiles', 'Information Technology'];
  const REGIONS = ['North', 'South', 'East', 'West'];
  const SEGMENTS = ['Large Corporate', 'Mid Corporate', 'SME'];
  const GROUPS = [
    { id: 'G01', name: 'Zenith Industrial Group' }, { id: 'G02', name: 'Kaveri Holdings' }, { id: 'G03', name: 'Sahyadri Group' },
    { id: 'G04', name: 'Indus Textile Consortium' }, { id: 'G05', name: 'Vardhan Enterprises' },
  ];
  const PRODUCT_GROUPS = [
    { group: 'Assets', items: ['Working Capital', 'Term Loan', 'Overdraft'] },
    { group: 'Liabilities', items: ['Current Account', 'Savings', 'Term Deposit'] },
    { group: 'Transaction Banking', items: ['Payments', 'Collections', 'Cash Management'] },
    { group: 'Trade Finance', items: ['Letter of Credit', 'Bank Guarantee', 'Export Finance'] },
  ];

  const SOURCES = [
    { id: 'CBS', name: 'Core Banking System', asOf: '31-Aug-2026', ageDays: 0, quality: 'Validated' },
    { id: 'CRM', name: 'CRM', asOf: '31-Aug-2026', ageDays: 0, quality: 'Validated' },
    { id: 'TFP', name: 'Trade Finance Platform', asOf: '17-Aug-2026', ageDays: 14, quality: 'Stale' },
    { id: 'CMS', name: 'Cash Management Platform', asOf: '31-Aug-2026', ageDays: 0, quality: 'Validated' },
    { id: 'FTP', name: 'Treasury / FTP', asOf: '31-Aug-2026', ageDays: 0, quality: 'Validated' },
    { id: 'RSK', name: 'Risk Engine (PD/LGD model v3.2)', asOf: '31-Jul-2026', ageDays: 31, quality: 'Validated' },
    { id: 'GL', name: 'Finance / GL (cost allocation)', asOf: '31-Jul-2026', ageDays: 31, quality: 'Estimated' },
    { id: 'PDP', name: 'Prism Data Platform', asOf: '31-Aug-2026', ageDays: 0, quality: 'Validated' },
    { id: 'MKT', name: 'External Market Data', asOf: '31-Aug-2026', ageDays: 0, quality: 'Validated' },
  ];

  /* Field catalogue: drives the assumption editor, classification and lineage */
  const FIELDS = [
    { g: 'Loans', k: 'wcBal', label: 'Working capital outstanding', unit: 'Cr', min: 0, max: 200, step: 1, src: 'CBS' },
    { g: 'Loans', k: 'wcLimit', label: 'Working capital limit', unit: 'Cr', min: 0, max: 250, step: 1, src: 'CBS' },
    { g: 'Loans', k: 'wcRate', label: 'Working capital rate', unit: '%', min: 7, max: 12, step: 0.05, src: 'CBS' },
    { g: 'Loans', k: 'tlBal', label: 'Term loan outstanding', unit: 'Cr', min: 0, max: 150, step: 1, src: 'CBS' },
    { g: 'Loans', k: 'tlRate', label: 'Term loan rate', unit: '%', min: 7, max: 12, step: 0.05, src: 'CBS' },
    { g: 'Deposits', k: 'depBal', label: 'Average deposit balance', unit: 'Cr', min: 0, max: 100, step: 1, src: 'CBS' },
    { g: 'Deposits', k: 'depRate', label: 'Customer deposit rate (blended)', unit: '%', min: 0, max: 8, step: 0.05, src: 'CBS' },
    { g: 'Transactions', k: 'txnVol', label: 'Transaction volume / month', unit: 'txns', min: 0, max: 60000, step: 100, src: 'CMS' },
    { g: 'Transactions', k: 'txnVal', label: 'Average transaction value', unit: '₹', min: 1000, max: 300000, step: 1000, src: 'CMS' },
    { g: 'Pricing', k: 'txnFee', label: 'Cash management fee / txn', unit: '₹', min: 0, max: 15, step: 0.25, src: 'CMS' },
    { g: 'Pricing', k: 'feeDiscPct', label: 'Fee discount / waiver', unit: '%', min: 0, max: 100, step: 5, src: 'CMS' },
    { g: 'Trade finance', k: 'tfVol', label: 'Trade finance volume / year', unit: 'Cr', min: 0, max: 400, step: 5, src: 'TFP' },
    { g: 'Trade finance', k: 'tfComm', label: 'Trade finance commission', unit: '%', min: 0, max: 1.5, step: 0.05, src: 'TFP' },
    { g: 'Investments', k: 'invBal', label: 'Investment balance (CP/NCD)', unit: 'Cr', min: 0, max: 100, step: 1, src: 'CBS' },
    { g: 'Investments', k: 'invYield', label: 'Investment yield', unit: '%', min: 6, max: 11, step: 0.05, src: 'MKT' },
    { g: 'Funding', k: 'wcFtp', label: 'FTP — working capital', unit: '%', min: 5, max: 9, step: 0.05, src: 'FTP' },
    { g: 'Funding', k: 'tlFtp', label: 'FTP — term loan', unit: '%', min: 5, max: 9, step: 0.05, src: 'FTP' },
    { g: 'Funding', k: 'depFtp', label: 'FTP credit on deposits', unit: '%', min: 3, max: 8, step: 0.05, src: 'FTP' },
    { g: 'Funding', k: 'cofBps', label: 'Cost of funds shift', unit: 'bps', min: -150, max: 150, step: 5, src: 'FTP', cls: 'USER' },
    { g: 'Cost', k: 'directCost', label: 'Direct cost', unit: 'Cr', min: 0, max: 3, step: 0.01, src: 'GL' },
    { g: 'Cost', k: 'servicingCost', label: 'Servicing cost', unit: 'Cr', min: 0, max: 3, step: 0.01, src: 'GL' },
    { g: 'Cost', k: 'indirectCost', label: 'Allocated indirect cost', unit: 'Cr', min: 0, max: 3, step: 0.01, src: 'GL' },
    { g: 'Cost', k: 'txnCostPer', label: 'Processing cost / txn', unit: '₹', min: 0, max: 5, step: 0.1, src: 'GL' },
    { g: 'Risk', k: 'pd', label: 'Probability of default', unit: '%', min: 0.05, max: 10, step: 0.05, src: 'RSK', cls: 'MODEL' },
    { g: 'Risk', k: 'lgd', label: 'Loss given default', unit: '%', min: 10, max: 75, step: 1, src: 'RSK', cls: 'MODEL' },
    { g: 'Risk', k: 'riskWeight', label: 'Risk weight', unit: '%', min: 20, max: 150, step: 5, src: 'RSK', cls: 'CALC' },
    { g: 'Risk', k: 'ccf', label: 'Credit conversion factor (undrawn)', unit: '%', min: 0, max: 100, step: 5, src: 'RSK', cls: 'CALC' },
    { g: 'Risk', k: 'riskMult', label: 'Risk cost vs modelled EL', unit: '%', min: 50, max: 200, step: 5, src: 'RSK', cls: 'USER' },
    { g: 'Commitments', k: 'depCommit', label: 'Deposit commitment', unit: 'Cr', min: 0, max: 100, step: 1, src: 'CRM' },
    { g: 'Commitments', k: 'txnCommit', label: 'Transaction commitment / month', unit: 'txns', min: 0, max: 60000, step: 100, src: 'CRM' },
    { g: 'Commitments', k: 'tfCommit', label: 'Trade finance commitment / year', unit: 'Cr', min: 0, max: 400, step: 5, src: 'CRM' },
    { g: 'Behaviour', k: 'fulfilPct', label: 'Commitment fulfilment probability', unit: '%', min: 0, max: 100, step: 5, src: 'PDP', cls: 'MODEL' },
    { g: 'Behaviour', k: 'attritionPct', label: 'Attrition risk on fee & deposit base', unit: '%', min: 0, max: 50, step: 1, src: 'PDP', cls: 'MODEL' },
    { g: 'Pricing', k: 'condFeeOn', label: 'Conditional fee rule (deposit AND volume)', unit: 'bool', src: 'CMS', cls: 'USER' },
    { g: 'Pricing', k: 'condFee', label: 'Conditional fee / txn', unit: '₹', min: 0, max: 10, step: 0.25, src: 'CMS' },
    { g: 'Pricing', k: 'condDep', label: 'Condition: deposit ≥', unit: 'Cr', min: 0, max: 100, step: 1, src: 'CMS' },
    { g: 'Pricing', k: 'condVol', label: 'Condition: volume ≥', unit: 'txns', min: 0, max: 60000, step: 500, src: 'CMS' },
  ];

  const RATING_PD = { 'A+': 0.25, 'A': 0.35, 'A-': 0.5, 'BBB+': 0.8, 'BBB': 1.1, 'BBB-': 1.6, 'BB+': 2.4, 'BB': 3.3 };
  const RATING_RW = { 'A+': 50, 'A': 50, 'A-': 50, 'BBB+': 100, 'BBB': 100, 'BBB-': 100, 'BB+': 150, 'BB': 150 };
  const RATING_SPREAD = { 'A+': 0.05, 'A': 0.15, 'A-': 0.3, 'BBB+': 0.55, 'BBB': 0.75, 'BBB-': 1.0, 'BB+': 1.4, 'BB': 1.8 };

  const ZENITH = {
    id: 'CORP000184', name: 'Zenith Auto Components Ltd.', segment: 'Mid Corporate', sector: 'Auto Components', region: 'West',
    rm: 'Ananya Mehta', since: 2019, rating: 'BBB+', groupId: 'G01', city: 'Pune', peakDep: 32, peakTxn: 24100,
    a: {
      wcBal: 100, wcLimit: 130, wcRate: 9.25, wcFtp: 6.70, tlBal: 40, tlRate: 9.50, tlFtp: 7.00, invBal: 0, invYield: 8.1,
      depBal: 25, depRate: 0, depFtp: 5.50, txnVol: 22000, txnVal: 85000, txnFee: 6, feeDiscPct: 0, condFeeOn: false, condFee: 3, condDep: 40, condVol: 25000,
      tfVol: 120, tfComm: 0.45, otherInc: 0.15, directCost: 0.30, servicingCost: 0.20, txnCostPer: 1.2, indirectCost: 0.35,
      pd: 0.8, lgd: 45, ccf: 20, riskWeight: 100, riskMult: 100, cofBps: 0, fulfilPct: 100, attritionPct: 0,
      depCommit: 35, txnCommit: 25000, tfCommit: 150,
    },
  };

  const NAMES = ['Orion Pharma Labs', 'Sahyadri Forgings', 'Kaveri Textiles Mills', 'Bluegrid Infotech', 'Vardhan Precision Tools', 'Meridian Castings', 'Nilgiri Spinning Co.', 'Aarav Biosciences', 'Deccan Gears & Shafts', 'Coromandel Weaves', 'Pinnacle Software Systems', 'Trident Engineering Works', 'Suryoday Pharmaceuticals', 'Indus Denim Ltd.', 'Konark Auto Stampings', 'Helix Data Services', 'Godavari Pumps', 'Ashoka Fabrics', 'Vistara Generics', 'Rathore Machine Tools', 'Saptagiri Polymers', 'Nexora Cloud Labs', 'Brahmaputra Cotton', 'Sindhu Drive Systems', 'Cypress Life Sciences', 'Malabar Hosiery', 'Ganges Heavy Engineering', 'Quantix Analytics', 'Chola Brake Linings', 'Aravalli Formulations', 'Tapti Garments', 'Satpura Valves', 'Kestrel IT Solutions', 'Narmada Auto Electricals', 'Vindhya Healthcare', 'Kutch Silk Works', 'Everest Hydraulics', 'Lotus Digital Services', 'Shivalik Radiators', 'Amrit Remedies', 'Mahanadi Yarns', 'Sterling Fabrication', 'Arcadia Systems', 'Hooghly Bearings', 'Sanjeevani Pharma', 'Palk Apparel Exports', 'Western Ghats Turbines', 'Nimbus Tech Park Services', 'Cauvery Clutch Co.'];
  const RMS = ['Ananya Mehta', 'Karan Malhotra', 'Sneha Pillai', 'Arjun Bhatt', 'Farah Qureshi', 'Devika Rao'];
  const CITIES = { North: ['Gurugram', 'Ludhiana', 'Noida'], South: ['Chennai', 'Bengaluru', 'Coimbatore'], East: ['Kolkata', 'Jamshedpur', 'Bhubaneswar'], West: ['Pune', 'Ahmedabad', 'Mumbai'] };

  function buildCustomers() {
    const rnd = E.prng(184);
    const pick = arr => arr[Math.floor(rnd() * arr.length)];
    const between = (a, b) => a + (b - a) * rnd();
    const r2 = x => Math.round(x * 100) / 100;
    const list = [ZENITH];
    const guessSector = n => /Pharma|Bio|Life|Generic|Remed|Formul|Health|Sanjeev/i.test(n) ? 'Pharmaceuticals'
      : /Textile|Spinning|Weave|Denim|Fabric|Cotton|Hosiery|Garment|Silk|Yarn|Apparel/i.test(n) ? 'Textiles'
      : /Infotech|Software|Data|Cloud|Analytics|IT |Tech|Digital|Systems|Quantix|Arcadia/i.test(n) ? 'Information Technology'
      : /Auto|Gear|Brake|Clutch|Radiator|Stamping|Drive|Castings|Forging/i.test(n) ? 'Auto Components' : 'Engineering';
    NAMES.forEach((name, i) => {
      const sector = guessSector(name);
      const segment = i % 5 === 0 ? 'Large Corporate' : i % 5 < 3 ? 'SME' : 'Mid Corporate';
      const region = REGIONS[(i * 7 + 3) % 4];
      const ratingPool = sector === 'Textiles' ? ['BBB', 'BBB-', 'BB+', 'BB', 'BBB-'] : sector === 'Information Technology' ? ['A', 'A-', 'A+', 'BBB+'] : ['A-', 'BBB+', 'BBB', 'BBB+', 'BBB-'];
      const rating = pick(ratingPool);
      const scale = segment === 'Large Corporate' ? between(150, 420) : segment === 'Mid Corporate' ? between(40, 150) : between(4, 28);
      const wcBal = r2(scale);
      const segPrem = segment === 'SME' ? 1.25 : segment === 'Mid Corporate' ? 0.45 : 0;
      const wcRate = r2(8.3 + RATING_SPREAD[rating] + segPrem + between(-0.1, 0.1));
      const tlBal = r2(wcBal * between(0.15, 0.6));
      const depMult = sector === 'Information Technology' ? between(0.35, 0.8) : between(0.1, 0.32);
      const depBal = r2((wcBal + tlBal) * depMult);
      const txnVol = Math.round(segment === 'Large Corporate' ? between(30000, 80000) : segment === 'Mid Corporate' ? between(8000, 28000) : between(900, 6500));
      const txnVal = Math.round((segment === 'Large Corporate' ? between(150000, 380000) : segment === 'Mid Corporate' ? between(50000, 120000) : between(18000, 60000)) / 1000) * 1000;
      const txnFee = segment === 'Large Corporate' ? 4 : segment === 'Mid Corporate' ? 6 : 8;
      const tfMult = sector === 'Textiles' || sector === 'Auto Components' ? between(0.6, 1.5) : sector === 'Information Technology' ? between(0, 0.15) : between(0.2, 0.8);
      const loans = wcBal + tlBal;
      const a = {
        wcBal, wcLimit: r2(wcBal * between(1.18, 1.45)), wcRate, wcFtp: 6.70, tlBal, tlRate: r2(wcRate + 0.25), tlFtp: 7.00, invBal: 0, invYield: 8.1,
        depBal, depRate: segment === 'SME' ? 1.2 : 0.4, depFtp: 5.50, txnVol, txnVal, txnFee, feeDiscPct: 0, condFeeOn: false, condFee: 3, condDep: 40, condVol: 25000,
        tfVol: r2(loans * tfMult), tfComm: r2(between(0.35, 0.6)), otherInc: r2(loans * 0.0012),
        directCost: r2(0.08 + loans * 0.0016), servicingCost: r2(0.04 + loans * 0.0011), txnCostPer: 1.2, indirectCost: r2(0.05 + loans * 0.0026),
        pd: RATING_PD[rating], lgd: sector === 'Textiles' ? 50 : 45, ccf: 20, riskWeight: RATING_RW[rating], riskMult: 100, cofBps: 0, fulfilPct: 100, attritionPct: 0,
      };
      a.depCommit = r2(a.depBal * between(1.05, 1.35)); a.txnCommit = Math.round(a.txnVol * between(1.05, 1.3) / 100) * 100; a.tfCommit = r2(a.tfVol * between(1.05, 1.3));
      const num = String(185 + i * 3).padStart(6, '0');
      list.push({ id: 'CORP' + num, name, segment, sector, region, rm: region === 'West' && i % 2 ? 'Ananya Mehta' : pick(RMS), since: 2010 + Math.floor(rnd() * 15), rating,
        groupId: i < 3 ? GROUPS[i + 1].id : i >= 12 && i < 16 ? 'G04' : i % 11 === 0 ? 'G05' : null,
        city: pick(CITIES[region]), peakDep: r2(depBal * between(1.05, 1.3)), peakTxn: Math.round(txnVol * between(1.02, 1.15)), a,
        missing: i === 22 ? ['pd'] : [] });
    });
    // Every customer gets a 12-month trend (Sep-25 … Aug-26)
    list.forEach((c, ci) => {
      const r = E.prng(1000 + ci);
      const growth = c.id === ZENITH.id ? 0.012 : (r() - 0.35) * 0.02;
      c.trend = Array.from({ length: 12 }, (_, m) => {
        const f = Math.pow(1 + growth, m - 11) * (1 + (r() - 0.5) * 0.05);
        return { m, dep: c.a.depBal * f * (c.id === ZENITH.id ? (m === 7 ? 1.28 : 1) : 1), txn: c.a.txnVol * f, rev: 0 };
      });
    });
    return list;
  }
  const MONTHS = ['Sep 25', 'Oct 25', 'Nov 25', 'Dec 25', 'Jan 26', 'Feb 26', 'Mar 26', 'Apr 26', 'May 26', 'Jun 26', 'Jul 26', 'Aug 26'];

  /* Pricing rule library (Cash Management tariffs) */
  const RULES = [
    { id: 'R-CM-STD', name: 'Current tariff: ₹6 per transaction', type: 'fixed', rate: 6, appliedTo: 'volume', basedOn: 'volume', tiers: [], conditions: { op: 'AND', items: [] }, status: 'Live', owner: 'Priya Kapoor' },
    { id: 'R-CM-5', name: 'Flat ₹5 per transaction', type: 'fixed', rate: 5, appliedTo: 'volume', basedOn: 'volume', tiers: [], conditions: { op: 'AND', items: [] }, status: 'Draft', owner: 'Priya Kapoor' },
    { id: 'R-CM-450', name: '₹4.50 if volume ≥ 20,000/month, else ₹6', type: 'fixed', rate: 4.5, elseRate: 6, appliedTo: 'volume', basedOn: 'volume', tiers: [], conditions: { op: 'AND', items: [{ metric: 'volume', cmp: '>=', value: 20000 }] }, status: 'Draft', owner: 'Priya Kapoor' },
    { id: 'R-CM-SLAB', name: 'Slab by volume: ₹8 / ₹6 / ₹4', type: 'slab', basedOn: 'volume', appliedTo: 'volume', tiers: [{ from: 0, to: 1000, rate: 8 }, { from: 1000, to: 5000, rate: 6 }, { from: 5000, to: null, rate: 4 }], conditions: { op: 'AND', items: [] }, status: 'Draft', owner: 'Priya Kapoor' },
    { id: 'R-CM-PROG', name: 'Progressive: ₹8 / ₹6 / ₹4 by band', type: 'progressive', basedOn: 'volume', appliedTo: 'volume', tiers: [{ from: 0, to: 1000, rate: 8 }, { from: 1000, to: 5000, rate: 6 }, { from: 5000, to: null, rate: 4 }], conditions: { op: 'AND', items: [] }, status: 'Draft', owner: 'Priya Kapoor' },
    { id: 'R-CM-VALVOL', name: 'Based on value, applied to volume: > ₹20 Cr/month → ₹4', type: 'slab', basedOn: 'value', appliedTo: 'volume', tiers: [{ from: 0, to: 20, rate: 6 }, { from: 20, to: null, rate: 4 }], conditions: { op: 'AND', items: [] }, status: 'Draft', owner: 'Priya Kapoor' },
    { id: 'R-CM-PCT', name: '0.25% of value, min ₹500, max ₹5,000', type: 'percent', pct: 0.25, min: 500, max: 5000, appliedTo: 'value', basedOn: 'value', tiers: [], conditions: { op: 'AND', items: [] }, status: 'Draft', owner: 'Rohan Shah' },
    { id: 'R-CM-BUNDLE', name: 'Relationship bundle: deposit ≥ ₹40 Cr AND volume ≥ 25,000 → ₹3', type: 'fixed', rate: 3, elseRate: 6, appliedTo: 'volume', basedOn: 'volume', tiers: [], conditions: { op: 'AND', items: [{ metric: 'deposit', cmp: '>=', value: 40 }, { metric: 'volume', cmp: '>=', value: 25000 }] }, status: 'Draft', owner: 'Rohan Shah' },
  ];

  const TEMPLATES = [
    ['Customer price review', 'Test a pricing concession against total relationship economics.', 'RM, Pricing Manager', 'Lending rate, fees, balances', 'Relationship'],
    ['Relationship renewal', 'Three renewal structures trading price for balances and commitments.', 'RM, Relationship Head', 'Rate, deposits, transactions, trade finance, commitments', 'Relationship'],
    ['New prospect', 'Build an opening commercial structure for a prospect.', 'RM', 'Balances, product mix, pricing, risk rating', 'Prospect'],
    ['Deposit rate change', 'Change the customer deposit rate and FTP credit.', 'RM, Treasury', 'Deposit rate, balance response', 'Relationship'],
    ['Lending rate change', 'Reprice a facility with utilisation response.', 'RM, Pricing Manager', 'Lending rate, utilisation', 'Relationship'],
    ['Fee revision', 'Revise a transaction tariff across customers.', 'Product Manager', 'Fee, tiers, elasticity', 'Product'],
    ['Commitment shortfall', 'Model a customer missing its committed balances.', 'RM, Risk', 'Fulfilment probability, commitments', 'Relationship'],
    ['Cross-sell', 'Add trade finance and cash management to a lending relationship.', 'RM', 'Trade finance volume, transactions', 'Relationship'],
    ['Product bundle', 'Conditional pricing tied to deposit and volume thresholds.', 'RM, Product Manager', 'Conditional fee rule', 'Relationship'],
    ['Campaign', 'Estimate incremental balances and ROI of a campaign.', 'Campaign Manager', 'Response, uplift, promo rate, cost', 'Campaign'],
    ['Portfolio rebalancing', 'Shift sector mix and exit low-RAROC clients.', 'Portfolio Manager', 'Growth, mix, pricing, exits', 'Portfolio'],
    ['Interest rate shock', 'Parallel benchmark move with pass-through assumptions.', 'CFO, Treasury', 'Rate shock', 'Enterprise'],
    ['Cost of funds increase', 'Funding cost shock on loan book.', 'CFO, Treasury', 'COF shift', 'Enterprise'],
    ['Risk cost increase', 'Credit stress on expected loss.', 'CRO, Risk', 'Risk cost multiplier', 'Enterprise'],
    ['Regulatory change', 'Higher capital ratio or risk weights.', 'CFO, Risk', 'Capital ratio, risk weights', 'Enterprise'],
  ].map((t, i) => ({ id: 'TPL-' + String(i + 1).padStart(2, '0'), name: t[0], purpose: t[1], personas: t[2], variables: t[3], kind: t[4],
    owner: ['Ananya Mehta', 'Rohan Shah', 'Priya Kapoor', 'Amit Deshmukh', 'Vikram Sinha'][i % 5],
    modified: ['12-Sep-2026', '04-Sep-2026', '28-Aug-2026', '19-Aug-2026', '02-Aug-2026'][i % 5], status: i === 14 ? 'Draft' : 'Published' }));

  /* Renewal template: the brief's Scenario A/B/C */
  function renewalScenarios(b) {
    return [
      { name: 'Scenario A · Price only', a: { ...b, wcRate: 9.00 }, changed: ['wcRate'], note: 'Match the requested concession partially, no new commitments.' },
      { name: 'Scenario B · Price for deposits', a: { ...b, wcRate: 8.90, depBal: 40, depCommit: 40, txnVol: Math.round(b.txnVol * 1.2), txnCommit: Math.round(b.txnVol * 1.2) }, changed: ['wcRate', 'depBal', 'depCommit', 'txnVol', 'txnCommit'], note: 'Concession conditional on ₹40 Cr deposits and +20% transactions.' },
      { name: 'Scenario C · Full relationship', a: { ...b, wcRate: 8.85, depBal: 50, depCommit: 50, txnVol: Math.round(b.txnVol * 1.3), txnCommit: Math.round(b.txnVol * 1.3), tfVol: b.tfVol * 1.25, tfCommit: b.tfCommit * 1.25 }, changed: ['wcRate', 'depBal', 'depCommit', 'txnVol', 'txnCommit', 'tfVol', 'tfCommit'], note: 'Full 40 bps concession for ₹50 Cr deposits, +30% transactions, +25% trade finance.' },
    ];
  }

  return { AS_OF, CONFIG, ROLES, USERS, SECTORS, REGIONS, SEGMENTS, GROUPS, PRODUCT_GROUPS, SOURCES, FIELDS, RATING_PD, RATING_RW, buildCustomers, MONTHS, RULES, TEMPLATES, renewalScenarios };
})();
