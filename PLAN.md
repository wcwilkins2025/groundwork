# Groundwork: build plan

A homestead planner. It takes a man from wherever he is today, with no money, no income and no experience if that is where he is, to living off a place of his own, in stages with a gate at each one, and it coaches him to the next step.

Grows out of the Homestead Cost Calculator (wcwilkins2025/homestead-cost-calculator). The calculator's sourced tables and arithmetic become the engine inside Groundwork.

Decisions already made (2026-11-14): name Groundwork; intro page first; accounts with permanent saved plans, printable, on a phone; email-link sign-in; check-ins by email and text, text opt-in with a cost warning; the coach says once that it is automated; stage 1 for the struggling man belongs, said short; every figure sourced or marked estimate; plain words; no member names or group data; personal accounts only, never the QIG account.

## 1. What a man sees

| Page | What it does |
|---|---|
| **Home** | Why this exists, who it is for, what the planner does, in Wiley's voice. One button: Start your plan. No sign-in needed to read it. |
| **Where you are** | The profile, eight plain questions. Works without an account; the plan lives in the link until he signs in. |
| **Your path** | His stages from where he is to living off a place. The stage he is in, its gate, what to do this month, the dollar and time figure for each stage. |
| **Your numbers** | The cost calculator and Make it pay, prefilled from his profile. Every line sourced. |
| **Check in** | Once a week or once a month: three questions with buttons. Moves him through the gates. |
| **Ask** | A box where he can type a question about his plan. Answered from his plan and the source tables. Says once that it is automated. |
| **Resources** | By state: FSA office, beginning-rancher courses, marketplace health insurance, ranch job boards, custom-rate surveys, cow-lease worksheets. Dated links. |
| **Print** | His whole plan on one or two clean sheets. |
| **Account** | Email, text opt-in, delete my account. |

## 2. The profile

Eight questions. Every one has a plain default so a man can skip it.

1. Cash you could put in today.
2. What you owe, and the monthly payments on it.
3. Money coming in now, per month, and from where (job, none, pension, disability, other).
4. Who is coming with you (just me, wife, kids: count).
5. Have you worked cattle: never, some, ran my own.
6. Can you move, or do you need to stay where you are (state and county if you know).
7. Hours a week you can give it alongside what you do now.
8. Health insurance today: through work, marketplace, none.

From these the engine sets his starting stage and his needs figure (household spending for his family size from BLS, health from KFF, rent from HUD for his county).

## 3. The stages and gates

Each stage has: a plain name, why it comes first, the gate to the next stage, what to do this month, the money figure and the time figure, and the sources. A man can be placed in any stage by his profile.

| Stage | Gate to pass | What this month looks like | Sources |
|---|---|---|---|
| **1. Get steady** | Money coming in covers what goes out, and a runway target is set | Income first: ranch hand, fence crew, custom haying, sale barn, feedlot (BLS wages for those jobs). A one-page budget: what comes in, what goes out, the gap. Debts listed smallest to largest with a payoff order. Marketplace health insurance at that income, which is subsidized. | BLS OES farm and ranch wages; KFF subsidy calculator; extension family-finance budget sheets; HUD rent |
| **2. Prove yourself** | Two years working cattle for someone else, or the equivalent the FSA counts | Work for a rancher. Take the state beginning-rancher course. Keep the budget. Build the runway. This is where the lease and the cows on shares come from; nobody leases grass or cows to a stranger. | FSA beginning-farmer rules; extension courses by state; Texas A&M and others |
| **3. First cattle without capital** | Caring for pairs or cows on shares on leased grass, while the job continues | Find the lease (custom-rate and rental surveys for what to pay). Panels and a chute. Write the lease on the NCFMEC form. FSA microloan if he wants his first 15 cows. | NCFMEC-03 and 06; Nebraska and Kansas custom rates; FSA chart and rates |
| **4. Grow** | The herd and the lease clear a set share of his needs | Keep heifers (about 30% growth a year). Add leased acres. Own more of the herd. Decide on selling direct with the real math. | The calculator's Make it pay engine |
| **5. Land** | Three years of experience for the FSA ownership programs, and the place found | FSA farm ownership loan (40 years at 6.25%) or the down-payment program (2.25% with 5% down). Buy a place with the house, well and septic already on it. The cost calculator does this stage. | FSA chart; the calculator's cost tables |
| **6. Live off it** | Needs covered by the place, the cattle and what he keeps | What the calculator's Living off it card shows today. | Make it pay engine |

A man with nothing starts at stage 1 and sees eight to ten years. That is honest, and it is a path.

Stage 1 is said short: one budget sheet, one debt list, one health insurance step, one job list. It does not become a personal finance course.

## 4. The coach

Two parts, kept apart on purpose.

**The brain is rules.** His stage, his gate and his next steps come from his profile, his check-ins and the sourced tables. It is arithmetic. It never invents a figure, it costs nothing to run, and it is testable. The rules live in one file with tests, like calc.js does now.

**The voice is automated and kept small.** Check-ins, nudges and "here is your next step" are templates filled with his numbers. When he types a question, an automated answer comes from his plan and the source tables and nothing else, with a daily cap per man. The box says once, plainly: "This is automated. It answers from your plan and the published figures. It is not a brother on the other end."

Cost at scale: well under a cent a question. A thousand men asking twenty questions a month is about $12 a month.

Check-ins go out by email (free at this size) and by text for men who opt in, with the warning that texts cost money and standard rates apply. Each check-in has three questions with buttons so he can answer from his phone in a minute.

## 5. Data and privacy

One row per man: his profile, his plan state, his check-ins, his coach messages. Nothing else. No name required, no address, no account numbers, no documents.

- Supabase under a personal account: Postgres, email-link sign-in, row-level security so only he reads his row, edge functions for the coach and the mailer so the keys never reach the browser.
- Delete my account removes the row, for real, that day.
- No aggregate reporting, no sharing, no one else can see his plan. If Groundwork ever shuts down, every man gets his plan as a file first.
- A short privacy page says all of this in plain words.

## 6. How it is built

- Front end stays plain HTML, CSS and JavaScript modules, no build step, hosted on GitHub Pages or Cloudflare Pages from the public repo wcwilkins2025/groundwork. The calculator's calc.js and data move in as the engine.
- Supabase project under a personal email (never the QIG account). Resend for email. Twilio for text, opt-in only.
- Secrets live in Supabase, never in the repo.
- Tests: the rules engine and the arithmetic get a test script like the calculator's. Every stage has a worked example man.

## 7. What it costs to run

| Item | Cost |
|---|---|
| Hosting the pages | $0 |
| Supabase | $0 on the free tier; $25 a month if it outgrows it |
| Email (Resend) | $0 up to a few thousand a month |
| Text (Twilio) | about $1 a month for the number plus about a penny a text, opt-in only |
| The automated answers | about $12 a month at a thousand active men |
| A domain, if wanted | about $12 a year |

## 8. Order of shipping

Each milestone is usable on its own and ends with a working page.

1. **Path without accounts.** Home page, the profile, Your path with the six stages and gates, Your numbers from the calculator engine. The plan lives in the link. Printable. This is the heart, and it ships first.
2. **Stage 1 depth and resources.** The budget sheet, debt list, health step and job list for the struggling man. The resources table by state, dated.
3. **Accounts.** Sign in by email link, plan saved, delete my account, privacy page.
4. **Check-ins.** Weekly or monthly by email, three buttons, moves the gates.
5. **Ask.** The coach box, capped per man, with the automated notice.
6. **Text check-ins.** Opt-in, with the cost warning.

Milestone 1 needs research for the stage 1 sources (BLS wages, KFF, extension budget sheets, FSA experience rules, beginning-rancher courses by state) and a new public repo. Nothing is created until Wiley says so.

## 9. Open questions for Wiley

1. Which personal email owns the Supabase, Resend and Twilio accounts.
2. Domain: groundworkpath.org, bought 2026-11-16 (groundwork.org is taken). The old github.io address redirects to it.
3. Does the privacy page name Wiley as the man running it, or no one.
4. Check-in cadence default: weekly or monthly.
5. Whether the intro page carries Wiley's own words or a draft to edit.
