# Crew Table: Claude handover

Festival catering calculator, including the latest dashboard redesign.

## Run locally
No dependencies or build step. Requires Python 3 to serve and Node.js 18+ to run tests.

```sh
python3 -m http.server 8000 --directory dist
```
Open http://localhost:8000 (do not open index.html directly because it uses JavaScript modules).

```sh
node test.mjs
node --check dist/app.mjs
```

## Source map
- dist/index.html: app shell (sidebar on desktop, bottom tab bar on phones)
- dist/sw.js, dist/manifest.webmanifest, dist/icons/: installable app and offline support. Bump CACHE in sw.js on each release.
- dist/style.css: complete styles, including dashboard and responsive rules
- dist/app.mjs: UI rendering, input handling, local saving, JSON backup/import, CSV exports, printing
- dist/model.mjs: pure calculation engine
- dist/plan.mjs: plan validation and upgrade of version 1 plans (old menu) to version 2
- dist/reports.mjs: client quote and internal costing sheets
- dist/charts.mjs: dashboard donut charts
- dist/equipment.mjs: Equipment tab and the dashboard energy card
- dist/data.mjs: default plan, recipes, ingredient pack prices and source URLs
- test.mjs: calculation regression checks
- PRODUCT.md and DESIGN.md: product and design context

The dist folder is the editable source, not generated/minified output. Deploy its contents to any static host. No backend, secrets, package install or ChatGPT integration is needed to run this copy. Hosting authentication is not part of these files; configure privacy on the new host if required.

## User brief
Make a readable, easy-to-navigate catering price calculator for festival crew. Include ingredient costs, staffing, consumables and company profit margin. Default: build 50 people for 10 days; live 150 for 3; break 50 for 4. Each phase has editable worker subgroups and meal entitlements (two meals, three meals or custom). Breakfast is bacon, sausage and veggie baps. Lunch and dinner are twelve mains; burgers are ticked for Build only. Tick boxes on the dashboard switch hot drinks, fruit, the cereal station and big salads on or off, and show what each adds to the quote.

Latest change: dashboard opens with quote/cost/profit, all three phases with editable days and direct crew editor buttons, cost composition and menu/shopping shortcuts. Detailed inputs retain the live quote sidebar. Preserve calculation behavior while improving UI.

## Calculation rules and baseline
- Default: 1,150 person-days and 3,450 meals.
- Default total cost: £19,848.60; selling price: £26,464.80; profit: £6,616.20 (chef wage £17/h, all four extras ticked, gas and electric charged into the cost, no equipment fee).
- Margin is profit / selling price: price = cost / (1 - margin / 100), not markup.
- Ingredients use raw net quantities with usable-yield adjustment and food buffer once.
- Purchase packs round up over the whole event; excess stock is charged to this event.
- Staffing depends on phase days, people, paid hours, rates and on-costs.
- Fixed costs, daily costs and contingency are included before profit.
- Two vs three meal comparison holds staffing constant.
- Invalid active menus block a valid quote/export.

## Data and limitations
Booker example prices are a 4 November 2026 snapshot with source URLs in data.mjs; no automatic updates. Portions, yields, staffing and overheads are editable estimates. Quotes exclude VAT. Check prices and production portions before committing quotes.

Plans save in localStorage under crew-table-plan-v1. A new browser/host starts with defaults. Existing user-entered browser data is NOT included in this source ZIP. To transfer a specific plan, use Plan files > Download backup in the running app, then import that JSON on the new app.

## Handover checks
Calculation tests passed on the packaged source. Dashboard navigation and a day-count change were checked in browser. Responsive CSS exists, but a separate phone viewport QA pass was not completed. Git history, deployment credentials and platform-specific hosting metadata are omitted from this portable export.


## Menu v2 notes
- Plan version is now 3. Version 1 and 2 plans open and upgrade: event, crew, prices and overheads are kept; the menu is replaced; Lead cook £22 and Cook £18 move to the new £17 default.
- Recipes carry `phases` (which stages serve them) and Extras carry a `key` (fruit, drinks, cereal). Options live in `options` (four booleans).
- Prices marked "Estimate: check price" (bacon, sausages, baps, burgers, cereal, cream, cheese, mushrooms, salad tomatoes, mayonnaise) are not from Booker. Replace them with real prices before quoting.

## Equipment and energy (version 3)
- No ovens. The menu uses a fryer, a grill, hobs and a urn: wedges became fries, the traybake became fried chicken and fries, the cottage pie became a lentil stew with mash.
- Every recipe has an `equipment` list of keys from the plan's `equipment` list (fryer, grill, hob, urn). Each piece of kit has a fuel (gas or electric), kW, portions per hour and hours on per service.
- Energy per kit = days x units x hours per service x services x kW x burner load. Services per day: breakfast 1, lunch and dinner 2, extras 1 (all day). Units to hire = busiest service / (portions per hour x service window).
- The kit is owned, so the Equipment tab is a kit list (what to bring), not a hire list.
- Per client, two tick boxes (state.kit): **Charge gas & electric** adds the estimated energy to our cost, so it carries contingency and margin; **Equipment fee** adds a separate client charge (per day on site or whole event) after margin, shown as its own line on the client quote. The fee counts as profit, not cost. Gas and electric costs never appear on the client quote.
- The daily allowance in Costs & margin is now "Cleaning & other" (default £15/day for supplies). Fuel comes from the Equipment tab.
- Gas £0.10 and electricity £0.30 per kWh, and the kW and throughput figures, are estimates. Replace them with your supplier and hire company numbers.

## Installable app
The app installs from the browser and works offline (service worker caches every file listed in sw.js). Inputs keep focus after a value is saved, so Tab moves through fields without losing your place. `node test-pwa.mjs` checks the manifest, icons and cached file list.

## Granular client options
Each option (hot drinks, fruit, cereal station, salads) has a master tick (state.options), a tick per stage (state.optionStages, Build/Live/Break) and its own amount (settings.drinks, fruit, cereal, salads), all set on the dashboard card. An option with no stages ticked is the same as off. The client quote lists each option and adds "(Live only)" style wording when it does not cover every stage.

## Hot drinks (plan version 4)
Hot drinks are a simple count: `settings.drinks` is drinks per person per day (default 5) and `settings.cups` is the disposable cup cost per drink. The Hot drinks recipe is costed per cup (instant coffee, tea bags, milk, oat drink, sugar; about 60% coffee). Version 3 plans upgrade automatically (the old allowance of 1 becomes 5 drinks), so prices do not change.

## Team earnings
The Pay & rota tab has two views, Team earnings and Rota. This is the Team earnings view. It shows what the catering staff make from the event: pay per person and role total (before on-costs), employer on-costs, total team cost (equal to the labour in the quote), share of the quote, a split by role and a table by stage. Roles with the same name are merged across stages. Pay each is for one person present every day their role is on site. It is calculated in `model.mjs` (`team`) and shown by `team.mjs`.

## Rota maker
The Pay & rota tab has a second view, Rota. Crew & meals is its own main tab. Each person works up to three services a day, each Off, 4 hours or 6 hours: Breakfast 6am to 10am or 12pm, Lunch 10am to 2pm or 4pm, Dinner 4pm to 8pm or 10pm. Pick a stage and a day, set the shifts, then copy that day to every day of the stage. A 6 hour breakfast runs into lunch and is flagged; days over 10 hours are flagged too. The default rota is built from the costed team and matches the quote's hours and pay exactly. People have a role (which sets their hourly rate from Costs & margin) and the stages they work. "Use this rota in the quote" writes people and hours per day into the staff lines in Costs & margin, so rota hours, Team earnings and the quote agree. Roles with no rota people in a stage, and roles with no costing line, are left alone. State: `rota` (people and days), logic in `rota.mjs`.

## Saved quotes, branding and PDF
- **Save quote** (top bar) names a quote after the client. Saved quotes live in this browser (`crew-table-quotes-v1`); the top bar shows Draft, Saved or Unsaved changes. The **Quotes** list opens, duplicates, deletes (tap twice) and makes a PDF for any saved quote. Opening a quote with unsaved changes to another saved quote saves that one first; a draft that was never saved asks you to tap again to discard it. Plan files has **Download all quotes** and **Open a quotes backup** (merges by id, newer save wins). Logic in `quotes.mjs`.
- **Branding** (Reports > Your branding): company name, tagline, brand colour, contact line, footer note and logo, saved once per device (`crew-table-brand-v1`) and used on every quote sheet and PDF. Logos are shrunk to a small PNG. Logic in `brand.mjs`.
- **Download PDF** (Reports > Client quote, or PDF on a saved quote) builds a branded A4 quote of one or two pages with jsPDF (`vendor/jspdf.umd.min.js`, MIT, loaded only when needed and cached for offline): header with logo, client and event, total, price by stage (and equipment fee), what is included, example menu, optional 2 vs 3 meal options, notes, terms and validity, an approval and signature box for the organiser, footer with contact details and page numbers. It never shows costs, profit, margin or gas and electricity. Logic in `pdf.mjs`. jsPDF's built-in fonts cover Latin-1 only, so other characters print as ?.
- Quotes and branding are per device. Download a backup now and then.

## Salads (plan version 5)
Salads are their own recipe type, not one big recipe: leaf salad, tomato and cucumber, coleslaw and shredded carrot, each costed per serving (about 50 to 120g) from real ingredients (lettuce, cucumber, tomato, cabbage, carrot, onion, mayonnaise, oil and vinegar). Every lunch and dinner cover gets `settings.salads` salads (default 2), split across the salad menu by each recipe's mix weight, and each salad can be ticked on or off per stage like a main. Menu & recipes shows the average cost per salad, per meal and for the event. If no salad is on the menu for a stage that serves lunch or dinner, the quote shows a menu warning unless salads are switched off. Version 4 plans upgrade automatically (the old Big salads recipe becomes the salad menu, and a setting of 1 becomes 2).

## Ingredient crossover (Menu & recipes > Ingredient crossover)
Ranks the meals being served by how efficient they are to buy for. A meal's score is the share of its ingredient cost that comes from ingredients at least one other served meal also uses; shared ingredients are bought in bigger batches and leave less unused stock. It also lists the ingredients used by the most meals, the share of food spend that is on shared ingredients, the value left unused in the last packs (already counted in costs), and up to three "easy wins": ingredients only one meal uses with a lot left over (drinks, fruit and cereal are skipped because they are bought in bulk anyway). Logic in `crossover.mjs`.

## Layout notes
- The live quote is a pill in the top bar on every editing screen; tap it for the breakdown, Client quote and Export CSV. This replaced the side panel so tables get the full width. The Dashboard, Reports and Quotes screens show the price themselves, so the pill is hidden there.
- Tables and lists are kept to one line per row (Shopping list, Menu & recipes). The Dashboard has one "What does the client want?" section that includes the kitchen kit.

## Burgers and suggestions (plan version 7)
- The beef burger is made from the same beef mince as the bolognese and chilli, and both burgers use the same bap rolls as the bacon baps (no ready-made patties or burger buns). Version 6 plans get the new burger recipes unless the burger was edited. Ready-made patties and burger buns stay in the ingredient list but are unused, so the Shopping list hides them until you tick Show unused.
- Ingredient crossover now makes suggestions: ingredients you already buy that fit a meal (tomato in the burger, peppers in the bolognese, mushrooms in the lentil bolognese). `PAIRINGS` in `crossover.mjs` lists which ingredients usually go with which meals. Each candidate is tried for real by recalculating the whole plan, then shown with the real change in shopping bill, unused stock and quote, and which meal gets more efficient. Free ones (no extra shopping, less waste) come first, then ones that turn a one-meal ingredient into a shared one. Tap Add to put it in the recipe. To teach it a new pairing, add a line to `PAIRINGS`.
