// Equipment and energy: what each meal needs, and the gas vs electricity picture.
// Pure: returns HTML strings. Helpers (esc, fmt, whole, num, text) come from the app.
import {calculate, sum} from './model.mjs';
import {donut} from './charts.mjs';

const unitsLabel = e => `${e.units} × ${e.name}`;

export function energySummary(state, c, h) {
  const {esc, fmt, whole} = h, t = c.energyTotals, used = c.energy.filter(e => e.units > 0);
  if (!c.energy.length) return '';
  return `<section class="card energy-card"><div class="section-heading"><div><h3>Equipment & energy</h3><p>No ovens: everything is grilled, fried or on the hob. Estimate from typical power ratings.</p></div><button class="small" data-action="navigate" data-target="equipment">Edit equipment</button></div>
<div class="energy-grid"><div>${donut([{label: `Gas (${whole(t.gasKwh)} kWh)`, value: t.gasCost}, {label: `Electricity (${whole(t.elecKwh)} kWh)`, value: t.elecCost}], h, {centerTop: fmt(t.cost), centerBottom: 'energy'})}</div>
<div class="energy-side"><h4>Kit to bring</h4><ul class="hire">${used.map(e => `<li><b>${esc(unitsLabel(e))}</b><span class="tag ${e.fuel}">${e.fuel === 'gas' ? 'Gas' : 'Electric'}</span></li>`).join('') || '<li>Nothing needed</li>'}</ul>
<p class="note">${c.kit.energy ? `Gas & electric <b>${fmt(c.energyCharge)}</b> is added to your cost.` : 'Gas & electric is not charged on this quote.'} If everything ran on gas: <b>${fmt(t.allGas)}</b>. All electric: <b>${fmt(t.allElectric)}</b>.</p></div></div></section>`;
}

export function renderEquipment(state, c, h) {
  const {esc, fmt, whole, num, text} = h;
  const eq = state.equipment, t = c.energyTotals;
  const mealRows = type => state.recipes.map((r, i) => (r.type !== type ? '' : `<tr class="${c.servings[i] > 0 ? '' : 'idle'}"><td>${esc(r.name)}<small>${whole(c.servings[i])} portions</small></td>${eq.map(e => `<td class="tick"><input type="checkbox" data-equip="${i}:${esc(e.key)}" ${r.equipment.includes(e.key) ? 'checked' : ''} aria-label="${esc(r.name)} uses ${esc(e.name)}"></td>`).join('')}<td class="numeric">${c.recipeEnergy[i].gasKwh + c.recipeEnergy[i].elecKwh > 0 ? `${fmt(c.recipeEnergy[i].cost)}<small>${whole(c.recipeEnergy[i].gasKwh)} gas · ${whole(c.recipeEnergy[i].elecKwh)} elec kWh</small>` : '<small>cold</small>'}</td></tr>`)).join('');
  const group = (title, type) => `<tr class="group-row"><th colspan="${eq.length + 2}">${title}</th></tr>${mealRows(type)}`;
  const field = (key, label, step, help) => `<div class="field"><label for="setting-${key}">${label}</label>${num('settings.' + key, state.settings[key], label, step, 0, 1000).replace('<input', '<input id="setting-' + key + '"')}<small>${help}</small></div>`;
  return `<div class="section-heading"><div><h2>Equipment & energy</h2><p>Tick the kit each meal needs. Anything fried needs a fryer; bacon baps need a grill.</p></div></div>
<div class="kpis energy-kpis"><div class="kpi"><span>Gas</span><strong>${fmt(t.gasCost)}</strong><small>${whole(t.gasKwh)} kWh</small></div><div class="kpi"><span>Electricity</span><strong>${fmt(t.elecCost)}</strong><small>${whole(t.elecKwh)} kWh</small></div><div class="kpi"><span>Total energy</span><strong>${fmt(t.cost)}</strong><small>${whole(t.kwh)} kWh for the event</small></div><div class="kpi"><span>All gas vs all electric</span><strong>${fmt(t.allGas)} / ${fmt(t.allElectric)}</strong><small>Same cooking, one fuel</small></div></div>
${kitControls(state, c, h)}
<p class="note">${c.kit.energy ? `Gas & electric is added to your cost, so it carries your margin. The daily allowance of ${fmt(c.daily)} in Costs & margin now covers cleaning and other costs.` : `Gas & electric is not charged. Make sure the daily allowance of ${fmt(c.daily)} in Costs & margin covers it.`} Energy is an estimate from the kit numbers below.</p>
<h3 class="eq-h">What each meal needs</h3>
<div class="table-wrap"><table class="eq-table"><thead><tr><th>Meal</th>${eq.map(e => `<th class="tick">${esc(e.name)}</th>`).join('')}<th class="numeric">Energy for event</th></tr></thead><tbody>${group('Breakfast', 'Breakfast')}${group('Lunch & dinner', 'Main')}${group('Extras', 'Extra')}</tbody></table></div>
<h3 class="eq-h">Your kit</h3>
<div class="table-wrap"><table class="eq-table"><thead><tr><th>Equipment</th><th>Fuel</th><th>kW</th><th>Portions / hour</th><th>Hours on per service</th><th class="numeric">To bring</th><th class="numeric">Hours on</th><th class="numeric">kWh</th><th class="numeric">Cost</th></tr></thead><tbody>${eq.map((e, i) => `<tr><td>${text(`equipment.${i}.name`, e.name, 'Equipment name', 'name')}</td><td><select data-path="equipment.${i}.fuel" aria-label="${esc(e.name)} fuel"><option value="gas" ${e.fuel === 'gas' ? 'selected' : ''}>Gas</option><option value="electric" ${e.fuel === 'electric' ? 'selected' : ''}>Electric</option></select></td><td>${num(`equipment.${i}.kw`, e.kw, e.name + ' power in kW', 0.5, 0, 1000)}</td><td>${num(`equipment.${i}.perHour`, e.perHour, e.name + ' portions per hour', 5, 0, 100000)}</td><td>${num(`equipment.${i}.hours`, e.hours, e.name + ' hours on per service', 0.5, 0, 24)}</td><td class="numeric">${c.energy[i].units ? `<b>${c.energy[i].units}</b>` : '-'}</td><td class="numeric">${whole(c.energy[i].hours)}</td><td class="numeric">${whole(c.energy[i].kwh)}</td><td class="numeric">${fmt(c.energy[i].cost)}</td></tr>`).join('')}</tbody></table></div>
<p class="note">To bring = how many of each you need on site to serve the busiest meal in the service window. A service is breakfast, lunch or dinner. The urn counts as one all-day service. Change a fuel to gas or electric and the totals update.</p>
<div class="fields">${field('gas', 'Gas £ per kWh', 0.01, 'Bottled LPG estimate. Check your supplier.')}${field('electric', 'Electricity £ per kWh', 0.01, 'Hook-up or generator estimate.')}${field('serviceHours', 'Service window (hours)', 0.25, 'How long you have to serve a meal.')}${field('load', 'Average burner load', 0.05, '0.6 means kit is at 60% of full power while on.')}</div>`;
}

// How a client is charged for the kit we own: our gas & electric in the cost, and/or a separate equipment fee.
export function kitControls(state, c, h) {
  const {fmt, num} = h, k = state.kit;
  const cards = [
    ['energy', 'Charge gas & electric', 'We pay for it, so it goes into your cost and carries your margin.'],
    ['fee', 'Equipment fee', 'A fee for using your kit, shown as its own line on the quote.']
  ];
  const body = cards.map(([key, label, help]) => {
    const on = k[key], other = calculate({...state, kit: {...k, [key]: !on}}), diff = Math.abs(c.price - other.price), price = Number.isFinite(diff) ? fmt(diff) : 'n/a';
    return `<label class="opt ${on ? 'on' : ''}"><input type="checkbox" data-path="kit.${key}" ${on ? 'checked' : ''}><span class="opt-text"><b>${label}</b><small>${help}</small></span><span class="opt-price">${on ? `<b>+${price}</b> in quote` : `would add <b>${price}</b>`}</span></label>`;
  }).join('');
  const fee = k.fee ? `<div class="kit-fee"><label>Fee £ ${num('kit.feeAmount', k.feeAmount, 'Equipment fee amount', 5, 0, 1000000)}</label><label>per <select data-path="kit.feeBasis" aria-label="Fee basis"><option value="day" ${k.feeBasis === 'day' ? 'selected' : ''}>day on site</option><option value="event" ${k.feeBasis === 'event' ? 'selected' : ''}>whole event</option></select></label><span class="subtle">= ${fmt(c.kitFee)} for this event, added after your margin</span></div>` : '';
  return `<div class="opt-grid two">${body}</div>${fee}`;
}
