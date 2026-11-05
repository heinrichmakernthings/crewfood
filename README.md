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
- Default total cost: £20,437.11; selling price: £27,249.47; profit: £6,812.37 (chef wage £17/h, all four extras ticked, gas and electric charged into the cost, no equipment fee).
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
- Recipes carry `phases` (which stages serve them) and Extras carry a `key` (salad, fruit, drinks, cereal). Options live in `options` (four booleans).
- Prices marked "Estimate: check price" (bacon, sausages, baps, burgers, cereal, cream, cheese, mushrooms, salad tomatoes) are not from Booker. Replace them with real prices before quoting.

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
