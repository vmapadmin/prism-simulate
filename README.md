# ValueMap Prism™ Simulate — POC

Self-contained proof of concept. Demonstration data — not actual bank data.

## Files
- `docs/index.html` — built, ready-to-open app (no server needed); served by GitHub Pages
- `src/engine.js` — calculation engine (pricing, profitability, RAROC, sensitivity, drivers, stress, portfolio, campaign, product). Pure, no DOM.
- `src/data.js` — synthetic seed data, configuration, field catalogue, pricing rules, templates
- `src/core.js` — state/repository, authorization, audit, scenario, workflow, outcome and AI services, charts, shell, router
- `src/views1.js` — Decision centre, customers, Customer 360, workspace
- `src/views2.js` — workspace tabs: compare, sensitivity, drivers, stress, AI, decision & approval, audit
- `src/views3a.js` — prospects, product simulation, pricing rule builder, portfolio
- `src/views3b.js` — campaign, enterprise stress, library, approvals, decision package, outcomes, audit, admin
- `src/events.js` — UI event handling and boot
- `src/styles.css` — styles (light/dark, responsive, print)
- `tools/build.py` — concatenates `src/` into `dist/prism-simulate.html` and `docs/index.html`
- `tools/e2e_test.py` — Playwright walk-through of the demo story

## Build
    python tools/build.py         # → dist/prism-simulate.html + docs/index.html
    pip install playwright && playwright install chromium
    python tools/e2e_test.py      # runs the demo story headlessly

Engine self-tests run live under Administration in the app.
Load order matters: engine → data → core → views1 → views2 → views3a → views3b → events.

## Hosting
GitHub Pages serves `docs/` from the `main` branch. After editing `src/`, run the build and commit `docs/index.html`.
