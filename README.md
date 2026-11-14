# Groundwork

A path from wherever you are to a place of your own in the country. Six stages, a gate at each one, what to do this month, and every figure from a public source or marked estimate. Free, no login, nothing stored anywhere but the link.

Grows out of the [Brotherhood Homestead Cost Calculator](https://github.com/wcwilkins2025/homestead-cost-calculator), whose tables and arithmetic are the engine here.

## Pages

| Page | What it does |
|---|---|
| `index.html` | Why this exists and how it works. |
| `start.html` | Where you are: nine plain questions. |
| `path.html` | Your path: the stage you are in, the gate, this month's steps, and the figures for each stage on your numbers. Printable. |
| `numbers.html` | Your numbers: the cost calculator and Make it pay, prefilled from your answers. |
| `steady.html` | Get steady: the budget sheet, what you owe and the payoff order (smallest first, payments roll on), health insurance at your income with the Medicaid and marketplace rules, and the jobs that pay while you learn. Printable. |
| `resources.html` | Courses, the people to call, land-link programs, loans, job boards and the subsidy calculator, by state. |

The plan rides in the link. Every page carries the answers in the query string, so a bookmark or a pasted link is the saved plan. Accounts come in a later milestone.

## The profile

`cash`, `debt`, `debtm` (payments a month), `inc` (money in a month, after tax), `from` (none, job, own, pension, other), `spend` (a month, not counting rent, health or debt; 0 means the BLS average for the family size), `adults`, `kids`, `exp` (none, some, two, own), `place` (rent, house, own), `move` (yes, no), `state`, `county`, `hours` (a week), `health` (none, work, marketplace, other), `debts` (name:balance:payment:rate, joined with |).

Example: `path.html?cash=3000&debt=12000&debtm=350&inc=2400&from=job&adults=2&kids=2&exp=none&state=TX&county=Fannin&hours=10&health=none`

## The six stages

| Stage | Gate | What sets the figures |
|---|---|---|
| 1. Get steady | Money in covers money out, and three months of it in hand | Household spending (BLS), rent for his county (HUD Fair Market Rent), health insurance (KFF, capped by the marketplace sliding scale where the data has it), his debt; ranch wages (BLS) |
| 2. Prove yourself | Two years working cattle for someone else | FSA beginning-farmer rules; courses by state |
| 3. First cattle without capital | Running cattle on leased grass while the job continues | Custom care and cows on shares per head (Nebraska and NCFMEC), handling setup, USDA pasture rent, FSA microloan |
| 4. Grow | Cattle and what he keeps from work cover the family | The calculator's Make it pay solver and herd growth |
| 5. Land | Three years of experience, the down payment, the place found | FSA ownership and down-payment programs; the calculator's setup cost for a modest place in his county |
| 6. Live off it | Needs covered | The calculator |

## Files

```
engine/calc.js        the cost and Make it pay arithmetic (from the calculator)
engine/path.js        the stage rules: needs, where he stands, figures and months per stage
site.css, site.js     shared look, theme, the plan in the link
data/costs.json       cost items with low / typical / high and sources
data/land_values.json, property_tax.json, counties.json   USDA, Tax Foundation, county tables
data/rent.json        HUD FY2026 Fair Market Rents by county (2 and 3 bedroom)
data/stage.json       wages, poverty line and subsidy scale, household by family size, FSA terms, courses, jobs
data/bundle.js        all of the above in one script so the pages work from a plain file open
scripts/              make_costs.py, make_stage.py, build_counties.py, bundle_data.py, make_sources.py
tests/run_tests.js    checks the bundle, the path rules and the engine (Node)
```

After editing any JSON or script:

```
python scripts/make_stage.py
python scripts/bundle_data.py
node tests/run_tests.js
```

Serve the folder with any static server, or open the pages from the file:

```
python -m http.server 8789
```

## Honest limits

These are planning figures, not quotes and not advice from a licensed anyone. Rents, wages, premiums and loan rates all carry a date; check the source before acting on a number. The path assumes a man saves every spare dollar, which no one does every month.
