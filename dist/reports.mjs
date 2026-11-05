// Client quote and internal costing reports.
// Pure functions: numbers and HTML strings only. No DOM, no clock (the caller passes today's date).
import {sum} from './model.mjs';
import {BRAND_DEFAULT, tint} from './brand.mjs';

export const CLIENT_DEFAULT = {
  company: 'Crew Table',
  clientName: '',
  contact: '',
  reference: '',
  date: '',            // ISO yyyy-mm-dd; blank = today
  validDays: 30,
  vat: 20,             // 0 hides the VAT lines
  showPerPerson: true,
  showMenu: true,
  showOptions: false,
  showApproval: true,
  notes: '',
  terms: 'Prices are for the event as described and are based on the headcounts and days above. Final numbers to be confirmed 7 days before arrival; changes after that may alter the price. Please tell us about allergies and dietary needs in advance. 50% deposit to confirm the booking, balance due after the event.'
};

const MEAL_NAMES = ['Breakfast', 'Lunch', 'Dinner'];

export function mealsLabel(meals) {
  const picked = MEAL_NAMES.filter((_, i) => meals[i]);
  if (picked.length === 3) return 'Breakfast, lunch & dinner';
  if (!picked.length) return 'No meals';
  return picked.join(' & ').replace(/^(\w)/, m => m).replace(/ & (\w)/g, (m, ch) => ' & ' + ch.toLowerCase());
}

export function addDays(iso, days) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}

export function longDate(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'});
}

const pence = n => Math.round(n * 100) / 100;

// Everything the client sheet shows, as plain data. Never includes cost, margin or profit.
export function clientQuote(state, c, two, three) {
  const cl = {...CLIENT_DEFAULT, ...(state.client || {})};
  const vatRate = Math.max(0, cl.vat);
  const net = pence(c.price);
  // Show each phase to the penny, with any rounding difference placed in the largest row so the rows add up exactly.
  const phases = state.phases.map((p, i) => ({
    name: p.name,
    days: p.days,
    people: sum(p.groups.map(g => g.people)),
    meals: sum(c.groups.filter(g => g.pi === i).map(g => g.meals)),
    price: pence(c.phaseCosts[i].price)
  }));
  const fee = pence(c.kitFee || 0), diff = pence(net - fee - sum(phases.map(p => p.price)));
  if (phases.length && diff) {
    const biggest = phases.reduce((a, b) => (b.price > a.price ? b : a));
    biggest.price = pence(biggest.price + diff);
  }
  const active = phases.filter(p => p.days > 0 && p.people > 0);
  const vat = pence(net * vatRate / 100);
  const groups = [];
  state.phases.forEach(p => {
    if (!(p.days > 0)) return;
    p.groups.forEach(g => {
      if (g.people > 0) groups.push({phase: p.name, name: g.name, people: g.people, meals: mealsLabel(g.meals), extras: g.extras});
    });
  });
  const opt = {fruit: true, drinks: true, cereal: true, salads: true, ...(state.options || {})};
  const t = state.settings;
  const live = state.phases.map(p => p.days > 0 && sum(p.groups.map(g => g.people)) > 0);
  const liveNames = state.phases.filter((_, i) => live[i]).map(p => p.name);
  const names = type => state.recipes.filter(r => r.type === type && r.weight > 0).flatMap(r => {
    const where = state.phases.filter((p, i) => live[i] && (!r.phases || r.phases[i] !== false)).map(p => p.name);
    if (!where.length) return [];
    return [where.length === liveNames.length ? r.name : `${r.name} (${where.join(' & ')} only)`];
  });
  const everyDay = [];
  const stg = state.optionStages || {};
  const where = k => {
    if (!opt[k] || !(t[k] > 0)) return null;
    const names = state.phases.filter((p, i) => live[i] && (!stg[k] || stg[k][i] !== false)).map(p => p.name);
    if (!names.length) return null;
    return names.length === liveNames.length ? '' : ` (${names.join(' & ')} only)`;
  };
  [['salads', 'Big salads with lunch and dinner'], ['cereal', 'Cereal station at breakfast'], ['fruit', 'Fresh fruit'], ['drinks', 'Tea, coffee, milk and sugar']].forEach(([k, text]) => {
    const w = where(k);
    if (w !== null) everyDay.push(text + w);
  });
  return {
    cl, vatRate, net, vat, fee, total: pence(net + vat), phases: active, groups,
    days: sum(active.map(p => p.days)), meals: c.meals, personDays: c.pd,
    perPersonDay: c.pd ? pence(net / c.pd) : 0, perMeal: c.meals ? pence(net / c.meals) : 0,
    menu: {breakfast: names('Breakfast'), mains: names('Main'), everyDay},
    options: [['Everyone on 2 meals a day (lunch + dinner)', two], ['Everyone on 3 meals a day', three]]
      .map(([label, x]) => ({label, price: pence(x.price), perPersonDay: x.pd ? pence(x.price / x.pd) : 0}))
  };
}

export function renderClientQuote(state, c, two, three, h) {
  const {esc, fmt, whole, today} = h;
  const brand = {...BRAND_DEFAULT, ...(h.brand || {})};
  const q = clientQuote(state, c, two, three), cl = q.cl;
  const date = cl.date || today;
  const row = (a, b, cls = '') => `<div class="rp-line ${cls}"><span>${a}</span><b>${b}</b></div>`;
  const list = a => a.map(x => `<li>${esc(x)}</li>`).join('');
  return `<article class="report-sheet" id="report-sheet" aria-label="Client quote" style="--green:${esc(brand.colour)};--light:${tint(brand.colour, 0.88)}">
<header class="rp-head"><div>${brand.logo ? `<img class="rp-logo" src="${esc(brand.logo)}" alt="${esc(brand.company)}">` : `<div class="rp-company">${esc(brand.company)}</div>`}${brand.tagline ? `<div class="rp-sub">${esc(brand.tagline)}</div>` : ''}</div><div class="rp-meta"><div class="rp-kind">Quote</div>${cl.reference ? `<div>Ref ${esc(cl.reference)}</div>` : ''}<div>${esc(longDate(date))}</div></div></header>
<section class="rp-for"><div><span>Prepared for</span><b>${esc(cl.clientName || 'Client name')}</b>${cl.contact ? `<small>${esc(cl.contact)}</small>` : ''}</div><div><span>Event</span><b>${esc(state.name)}</b><small>${whole(q.days)} days of catering · ${whole(q.meals)} meals</small></div></section>
<section class="rp-total"><div><span>${q.vatRate ? 'Total including VAT' : 'Total price'}</span><strong>${fmt(q.vatRate ? q.total : q.net)}</strong></div>${cl.showPerPerson && q.personDays ? `<div class="rp-per"><b>${fmt(q.perPersonDay)}</b> per person per day<br><b>${fmt(q.perMeal)}</b> average per meal <small>(before VAT)</small></div>` : ''}</section>
<section><h3>Price by stage</h3><table><thead><tr><th>Stage</th><th class="numeric">Days</th><th class="numeric">People / day</th><th class="numeric">Meals</th><th class="numeric">Price</th></tr></thead><tbody>${q.phases.map(p => `<tr><td>${esc(p.name)}</td><td class="numeric">${whole(p.days)}</td><td class="numeric">${whole(p.people)}</td><td class="numeric">${whole(p.meals)}</td><td class="numeric">${fmt(p.price)}</td></tr>`).join('')}${q.fee ? `<tr><td colspan="4">Kitchen equipment fee</td><td class="numeric">${fmt(q.fee)}</td></tr>` : ''}</tbody></table>
<div class="rp-sums">${row('Total before VAT', fmt(q.net))}${q.vatRate ? row(`VAT at ${q.vatRate}%`, fmt(q.vat)) + row('Total to pay', fmt(q.total), 'rp-strong') : ''}</div></section>
<section><h3>What's included</h3><table><thead><tr><th>Stage</th><th>Group</th><th class="numeric">People</th><th>Meals each day</th></tr></thead><tbody>${q.groups.map(g => `<tr><td>${esc(g.phase)}</td><td>${esc(g.name)}</td><td class="numeric">${whole(g.people)}</td><td>${mealsLabel2(g)}</td></tr>`).join('')}</tbody></table>
<ul class="rp-bullets"><li>Experienced catering team to prepare, cook and serve</li><li>All ingredients, plates, cutlery and napkins</li>${q.menu.everyDay.map(x => `<li>${esc(x)}</li>`).join('')}<li>${q.fee ? 'Kitchen equipment supplied (equipment fee shown above)' : 'Kitchen equipment, fuel and cleaning'}</li></ul></section>
${cl.showMenu && (q.menu.breakfast.length || q.menu.mains.length) ? `<section class="rp-menu"><h3>Example menu</h3><div class="rp-cols">${q.menu.breakfast.length ? `<div><h4>Breakfast</h4><ul>${list(q.menu.breakfast)}</ul></div>` : ''}${q.menu.mains.length ? `<div><h4>Lunch & dinner</h4><ul>${list(q.menu.mains)}</ul></div>` : ''}</div><p class="rp-small">Vegetarian options are included at every meal. The menu rotates across the event.</p></section>` : ''}
${cl.showOptions ? `<section><h3>Options</h3><table><thead><tr><th>Package</th><th class="numeric">Per person / day</th><th class="numeric">Total before VAT</th></tr></thead><tbody>${q.options.map(o => `<tr><td>${esc(o.label)}</td><td class="numeric">${fmt(o.perPersonDay)}</td><td class="numeric">${fmt(o.price)}</td></tr>`).join('')}</tbody></table></section>` : ''}
${cl.notes.trim() ? `<section><h3>Notes</h3><p class="rp-text">${esc(cl.notes)}</p></section>` : ''}
<section class="rp-terms"><h3>Terms</h3><p class="rp-text">${esc(cl.terms)}</p><p class="rp-small">${q.vatRate ? '' : 'Prices exclude VAT. '}This quote is valid for ${whole(cl.validDays)} days, until ${esc(longDate(addDays(date, cl.validDays)))}.</p></section>
${cl.showApproval ? `<section class="rp-approve"><h3>Approval</h3><p class="rp-text">Approved on behalf of ${esc(cl.clientName || 'the client')} to go ahead at the price above (${fmt(q.vatRate ? q.total : q.net)}).</p><div class="rp-sign"><div><span>Name</span></div><div><span>Position</span></div><div><span>Signature</span></div><div><span>Date</span></div></div></section>` : ''}
${brand.contact || brand.footer ? `<footer class="rp-foot">${[brand.company, brand.contact, brand.footer].filter(Boolean).map(esc).join(' · ')}</footer>` : ''}
</article>`;
}

function mealsLabel2(g) {
  return g.meals;
}

export function renderInternal(state, c, h) {
  const {esc, fmt, whole, today} = h;
  const t = state.settings, tot = c.cost;
  const pct = v => (tot && Number.isFinite(v) ? Math.round(v / tot * 100) + '%' : 'n/a');
  const costs = [['Ingredients (whole packs)', c.purchased], ['Catering team (incl. on-costs)', c.labour], ['Consumables', c.consumables], ['Overheads', c.fixed], ['Daily cleaning & other', c.daily], ['Gas & electric (our kit)', c.energyCharge], [`Contingency (${t.contingency}%)`, c.contingency]];
  const top = c.shopping.filter(i => i.packs > 0).sort((a, b) => b.spend - a.spend).slice(0, 8);
  return `<article class="report-sheet" id="report-sheet" aria-label="Internal costing">
<header class="rp-head"><div><div class="rp-company">Internal costing</div><div class="rp-sub">${esc(state.name)} · not for clients</div></div><div class="rp-meta"><div>${esc(longDate(today))}</div></div></header>
${c.errors.map(e => `<p class="warning">${esc(e)}</p>`).join('')}
<section class="rp-total"><div><span>Selling price before VAT</span><strong>${fmt(c.price)}</strong></div><div class="rp-per"><b>${fmt(c.cost)}</b> total cost<br><b>${fmt(c.profit)}</b> profit (${t.margin}% margin)</div></section>
<section><h3>Where the money goes</h3><table><thead><tr><th>Cost</th><th class="numeric">Amount</th><th class="numeric">% of cost</th></tr></thead><tbody>${costs.map(([a, b]) => `<tr><td>${a}</td><td class="numeric">${fmt(b)}</td><td class="numeric">${pct(b)}</td></tr>`).join('')}<tr class="rp-strong"><td>Total cost</td><td class="numeric">${fmt(c.cost)}</td><td class="numeric">100%</td></tr><tr><td>Profit${c.kitFee > 0 ? ' (includes equipment fee)' : ''}</td><td class="numeric">${fmt(c.profit)}</td><td></td></tr>${c.kitFee > 0 ? `<tr><td>of which equipment fee</td><td class="numeric">${fmt(c.kitFee)}</td><td></td></tr>` : ''}<tr class="rp-strong"><td>Selling price</td><td class="numeric">${fmt(c.price)}</td><td></td></tr></tbody></table></section>
<section><h3>By stage</h3><table><thead><tr><th>Stage</th><th class="numeric">Days</th><th class="numeric">Person-days</th><th class="numeric">Labour</th><th class="numeric">Cost</th><th class="numeric">Price</th><th class="numeric">Profit</th></tr></thead><tbody>${c.phaseCosts.map(p => `<tr><td>${esc(p.name)}</td><td class="numeric">${whole(p.days)}</td><td class="numeric">${whole(p.pd)}</td><td class="numeric">${fmt(p.labour)}</td><td class="numeric">${fmt(p.cost)}</td><td class="numeric">${fmt(p.price)}</td><td class="numeric">${fmt(p.price - p.cost)}</td></tr>`).join('')}</tbody></table></section>
<section><h3>Biggest shopping lines</h3><table><thead><tr><th>Ingredient</th><th class="numeric">Packs</th><th class="numeric">Spend</th></tr></thead><tbody>${top.map(i => `<tr><td>${esc(i.name)}</td><td class="numeric">${whole(i.packs)}</td><td class="numeric">${fmt(i.spend)}</td></tr>`).join('')}</tbody></table></section>
<section><h3>Equipment & energy</h3><table><thead><tr><th>Equipment</th><th>Fuel</th><th class="numeric">To bring</th><th class="numeric">kWh</th><th class="numeric">Cost</th></tr></thead><tbody>${c.energy.filter(e => e.units > 0).map(e => `<tr><td>${esc(e.name)}</td><td>${e.fuel === 'gas' ? 'Gas' : 'Electric'}</td><td class="numeric">${e.units}</td><td class="numeric">${whole(e.kwh)}</td><td class="numeric">${fmt(e.cost)}</td></tr>`).join('')}<tr class="rp-strong"><td>Total estimate</td><td></td><td></td><td class="numeric">${whole(c.energyTotals.kwh)}</td><td class="numeric">${fmt(c.energyTotals.cost)}</td></tr></tbody></table><p class="rp-small">${c.kit.energy ? `Gas & electric is added to the cost. Daily cleaning and other costs are ${fmt(c.daily)}.` : `Gas & electric is not charged. The daily allowance is ${fmt(c.daily)}.`}</p></section>
<section class="rp-terms"><p class="rp-small">Food costs use Booker public prices checked 4 November 2026 with ${t.waste}% food buffer. Staffing, portions and yields are estimates. Whole-pack top-up of ${fmt(c.uplift)} is included. Margin is profit ÷ selling price.</p></section>
</article>`;
}
