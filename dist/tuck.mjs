// Tuck shop: extra items sold to crew. Separate from the client quote. Pure: returns numbers and an HTML string.
import {sum} from './model.mjs';

export const ceil5p = n => Math.ceil(n * 20 - 1e-9) / 20;

export function checkTuck(t) {
  const fail = () => { throw Error('Check the tuck shop.'); };
  const num = (n, min = 0, max = 1e6) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  if (!t || typeof t !== 'object' || !t.settings || !Array.isArray(t.items) || t.items.length > 60) fail();
  const s = t.settings;
  if (!num(s.buffer, 0, 200) || !num(s.vat, 0, 100) || typeof s.priceIncVat !== 'boolean' || !num(s.targetMargin, 0, 95)) fail();
  if (!Array.isArray(s.stages) || s.stages.length !== 3 || s.stages.some(x => typeof x !== 'boolean')) fail();
  const ids = new Set();
  for (const i of t.items) {
    if (!i || typeof i.id !== 'string' || !/^[A-Za-z0-9_-]{1,20}$/.test(i.id) || ids.has(i.id)) fail();
    ids.add(i.id);
    if (typeof i.name !== 'string' || i.name.length > 100 || typeof i.on !== 'boolean') fail();
    if (!num(i.packSize, 1, 100000) || !num(i.packPrice) || !num(i.sell) || !num(i.rate, 0, 100)) fail();
  }
}

// Numbers for the whole tuck shop. c is the calculate() result, used for the crew people-days in each stage.
export function tuckSummary(state, c) {
  const t = state.tuck, s = t.settings;
  const stageDays = state.phases.map((_, pi) => sum(c.groups.filter(g => g.pi === pi).map(g => g.pd)));
  const personDays = sum(stageDays.map((v, i) => (s.stages[i] ? v : 0)));
  const vatDiv = s.priceIncVat ? 1 + s.vat / 100 : 1;
  const rows = t.items.map(it => {
    const expected = it.on ? it.rate * personDays : 0;
    const packs = expected > 0 ? Math.ceil(expected * (1 + s.buffer / 100) / it.packSize - 1e-9) : 0;
    const cost = packs * it.packPrice, stock = packs * it.packSize;
    const unitCost = it.packPrice / it.packSize, gross = expected * it.sell, revenue = gross / vatDiv, profit = revenue - cost;
    const effCost = expected > 0 ? cost / expected : unitCost;
    const suggestedNet = effCost / (1 - s.targetMargin / 100), suggested = ceil5p(suggestedNet * vatDiv);
    return {id: it.id, name: it.name, on: it.on, expected, packs, stock, unsold: Math.max(0, stock - expected), unsoldValue: Math.max(0, stock - expected) * unitCost, cost, unitCost, effCost, gross, revenue, profit,
      margin: revenue > 0 ? profit / revenue * 100 : 0, sell: it.sell, suggested};
  });
  const revenue = sum(rows.map(r => r.revenue)), cost = sum(rows.map(r => r.cost));
  return {rows, personDays, stageDays, revenue, cost, profit: revenue - cost, margin: revenue > 0 ? (revenue - cost) / revenue * 100 : 0, gross: sum(rows.map(r => r.gross)), unsoldValue: sum(rows.map(r => r.unsoldValue)), vatDiv};
}

export function addTuckItem(state) {
  const nums = state.tuck.items.map(i => Number(i.id.replace(/\D/g, '')) || 0);
  state.tuck.items.push({id: 't' + (Math.max(0, ...nums) + 1), name: 'New item', packSize: 24, packPrice: 10, sell: 1, rate: 0.2, on: true});
}

export function useSuggestedPrice(state, c, index) {
  const sm = tuckSummary(state, c), r = sm.rows[index];
  if (!r) return false;
  state.tuck.items[index].sell = r.suggested;
  return true;
}

export function renderTuck(state, c, h) {
  const {esc, fmt, whole, num, text} = h;
  const t = state.tuck, s = t.settings, sm = tuckSummary(state, c);
  const kpi = (label, value, sub, cls = '') => `<div class="kpi ${cls}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`;
  const chips = state.phases.map((p, k) => `<label class="chip"><input type="checkbox" data-path="tuck.settings.stages.${k}" ${s.stages[k] ? 'checked' : ''} aria-label="Tuck shop open in ${esc(p.name)}"><span>${esc(p.name)}</span></label>`).join('');
  const rows = t.items.map((it, i) => {
    const r = sm.rows[i], low = r.on && r.expected > 0 && r.margin < s.targetMargin - 0.5;
    return `<tr class="${it.on ? '' : 'idle'}"><td class="tick"><input type="checkbox" data-path="tuck.items.${i}.on" ${it.on ? 'checked' : ''} aria-label="Sell ${esc(it.name)}"></td><td>${text(`tuck.items.${i}.name`, it.name, 'Item name', 'name')}</td><td>${num(`tuck.items.${i}.packSize`, it.packSize, it.name + ' pack size', 1, 1, 100000)}</td><td>${num(`tuck.items.${i}.packPrice`, it.packPrice, it.name + ' pack price', 0.01)}</td><td>${num(`tuck.items.${i}.sell`, it.sell, it.name + ' sell price', 0.05)}</td><td>${num(`tuck.items.${i}.rate`, it.rate, it.name + ' sold per person per day', 0.05, 0, 100)}</td><td class="numeric ${low ? 'warn' : ''}">${r.on && r.expected > 0 ? Math.round(r.margin) + '%' : '<small>off</small>'}</td><td class="numeric">${r.on ? whole(r.expected) : ''}</td><td class="numeric">${r.on ? whole(r.packs) : ''}</td><td class="numeric">${r.on ? fmt(r.profit) : ''}</td><td class="numeric">${r.on ? `${fmt(r.suggested)} ${Math.abs(r.suggested - it.sell) > 0.004 ? `<button class="small" data-action="tuck-use" data-id="${i}" aria-label="Use ${fmt(r.suggested)} for ${esc(it.name)}">Use</button>` : '<small>ok</small>'}` : ''}</td><td><button class="delete" data-action="tuck-remove" data-id="${i}" aria-label="Remove ${esc(it.name)}">×</button></td></tr>`;
  }).join('');
  const order = sm.rows.filter(r => r.packs > 0).map(r => `<li><b>${whole(r.packs)} ×</b> ${esc(r.name)} <span class="subtle">(${whole(r.stock)} units, ${fmt(r.cost)})</span></li>`).join('');
  return `<div class="kpis tuck-kpis">${kpi('Sales (before VAT)', fmt(sm.revenue), `${fmt(sm.gross)} at the till${s.priceIncVat ? ' including VAT' : ''}`, 'main')}${kpi('Stock to buy', fmt(sm.cost), `${fmt(sm.unsoldValue)} unsold at the end`)}${kpi('Profit', fmt(sm.profit), `${Math.round(sm.margin)}% margin`)}${kpi('Crew selling to', whole(sm.personDays), 'person-days')}</div>
<section class="card tuck-set"><div class="tuck-controls"><div class="tc"><span>Open in</span><div class="chips">${chips}</div></div><label class="tc">Stock buffer %${num('tuck.settings.buffer', s.buffer, 'Stock buffer percent', 1, 0, 200)}</label><label class="tc">Target margin %${num('tuck.settings.targetMargin', s.targetMargin, 'Target margin percent', 1, 0, 95)}</label><label class="tc">VAT %${num('tuck.settings.vat', s.vat, 'VAT percent', 1, 0, 100)}</label><label class="tc check"><input type="checkbox" data-path="tuck.settings.priceIncVat" ${s.priceIncVat ? 'checked' : ''}> Till prices include VAT</label></div></section>
<div class="table-wrap"><table class="eq-table tuck-table"><thead><tr><th class="tick">On</th><th>Item</th><th>Pack size</th><th>Pack £</th><th>Sell £</th><th>Per person / day</th><th class="numeric">Margin</th><th class="numeric">Expect to sell</th><th class="numeric">Packs</th><th class="numeric">Profit</th><th class="numeric">Suggested price</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
<div class="group-tools"><button class="small" data-action="tuck-add">+ Add item</button><button class="small" data-action="tuck-use-all">Use all suggested prices</button><span class="subtle">Suggested price gives the target margin after unsold stock, rounded up to 5p.</span></div>
${order ? `<details class="disclosure" data-panel="tuck-order"><summary>Stock order list</summary><ul class="order-list">${order}</ul></details>` : ''}
<p class="note">Tuck shop sales are separate from the client quote. Pack prices are estimates, so replace them with your supplier's. Crisps, chocolate and soft drinks are usually standard rated for VAT, so check the rate for each item. Selling alcohol needs a licence.</p>`;
}
