// How the extras (hot drinks, fruit, cereal station, salads) are costed, step by step, with the numbers editable.
// Pure: extrasBreakdown returns data, renderExtras returns an HTML string.
import {calculate, sum} from './model.mjs';

export const EXTRA_DEFS = [
  {key: 'drinks', label: 'Hot drinks', word: 'drink', words: 'drinks', amountText: 'drinks per person per day', basis: 'person-days', step: 1},
  {key: 'fruit', label: 'Fruit', word: 'serving', words: 'servings', amountText: 'servings per person per day', basis: 'person-days', step: 0.5},
  {key: 'cereal', label: 'Cereal station', word: 'bowl', words: 'bowls', amountText: 'bowls per breakfast', basis: 'breakfasts', step: 0.1},
  {key: 'salads', label: 'Salads', word: 'salad', words: 'salads', amountText: 'salads per lunch or dinner', basis: 'lunches and dinners', step: 1}
];

const RECIPE_KEY = {drinks: 'drinks', fruit: 'fruit', cereal: 'cereal'};
export const recipeIndexes = (state, key) => state.recipes.map((r, i) => (key === 'salads' ? r.type === 'Salad' : r.key === RECIPE_KEY[key]) ? i : -1).filter(i => i >= 0);

export function extrasBreakdown(state, c) {
  const waste = state.settings.waste;
  return EXTRA_DEFS.map(def => {
    const on = !!state.options[def.key];
    // Work from a version with the extra switched on, so it can be costed even when it is off in this quote.
    const withOn = on ? state : (() => { const s = structuredClone(state); s.options[def.key] = true; s.optionStages[def.key] = [true, true, true]; return s; })();
    const withOff = (() => { const s = structuredClone(state); s.options[def.key] = false; return s; })();
    const c1 = on ? c : calculate(withOn), c0 = on ? calculate(withOff) : c;
    const amount = state.settings[def.key];
    const stages = state.phases.map((p, pi) => {
      const groups = c1.groups.filter(g => g.pi === pi);
      const count = def.key === 'cereal' ? sum(groups.map(g => g.breakfast)) : def.key === 'salads' ? sum(groups.map(g => g.mains)) : sum(groups.map(g => g.pd));
      const ticked = withOn.optionStages[def.key][pi] !== false && p.days > 0;
      return {name: p.name, days: p.days, count, ticked, servings: ticked ? count * amount : 0};
    });
    const idx = recipeIndexes(state, def.key);
    const recipes = idx.map(ri => {
      const r = state.recipes[ri];
      const lines = r.lines.map((l, li) => {
        const ii = state.ingredients.findIndex(x => x.id === l.ingredient), ing = state.ingredients[ii];
        const unitCost = ing.price / (ing.pack * ing.yield);
        return {lineIndex: li, ingredientIndex: ii, name: ing.name, unit: ing.unit, qty: l.qty, pack: ing.pack, price: ing.price, yield: ing.yield, unitCost, cost: l.qty * unitCost, status: ing.status};
      });
      const subtotal = sum(lines.map(l => l.cost));
      return {index: ri, name: r.name, note: r.note, weight: r.weight, lines, subtotal, withBuffer: subtotal * (1 + waste / 100), perServing: c1.recipeCosts[ri], servings: c1.servings[ri]};
    });
    const totalServings = sum(recipes.map(r => r.servings));
    const eventFood = sum(recipes.map(r => r.servings * r.perServing));
    const cupEach = def.key === 'drinks' ? state.settings.cups : 0;
    const eventCups = cupEach * totalServings;
    const avgPerServing = totalServings ? eventFood / totalServings : sum(recipes.map(r => r.perServing)) / Math.max(1, recipes.length);
    const dPurchased = c1.purchased - c0.purchased, dConsumables = c1.consumables - c0.consumables, dEnergy = c1.energyCharge - c0.energyCharge;
    const dBase = c1.base - c0.base, dCost = c1.cost - c0.cost, dPrice = c1.price - c0.price;
    return {
      ...def, on, amount, stages, recipes, totalServings, eventFood, cupEach, eventCups, avgPerServing,
      perServingAllIn: avgPerServing + cupEach,
      dPurchased, dConsumables, dEnergy, dBase, dContingency: dCost - dBase, dCost, dPrice,
      stockRounding: dPurchased - eventFood, contingencyPct: state.settings.contingency, marginPct: state.settings.margin, buffer: waste
    };
  });
}

export function renderExtras(state, c, h) {
  const {esc, fmt, whole, num} = h;
  if (c.errors && c.errors.length) return `<p class="warning">${esc(c.errors[0])} Fix the menu to see the costing.</p>`;
  const money4 = n => '£' + n.toFixed(3);
  const signed = n => (n > 0.004 ? '+' : n < -0.004 ? '-' : '') + fmt(Math.abs(n));
  const dec = n => new Intl.NumberFormat('en-GB', {maximumFractionDigits: 3}).format(n);
  const cards = extrasBreakdown(state, c).map(x => {
    const chips = state.phases.map((p, pi) => `<label class="chip"><input type="checkbox" data-path="optionStages.${x.key}.${pi}" ${state.optionStages[x.key][pi] ? 'checked' : ''} aria-label="${esc(x.label)} in ${esc(p.name)}"><span>${esc(p.name)}</span></label>`).join('');
    const stageRows = x.stages.map(s => `<tr class="${s.ticked ? '' : 'idle'}"><td>${esc(s.name)}</td><td class="numeric">${whole(s.count)}</td><td class="numeric">${s.ticked ? whole(s.servings) : '<small>not included</small>'}</td></tr>`).join('');
    const recipeBlocks = x.recipes.map(r => {
      const rows = r.lines.map(l => `<tr><td>${esc(l.name)}</td><td>${num(`recipes.${r.index}.lines.${l.lineIndex}.qty`, l.qty, l.name + ' amount per ' + x.word, 0.001, 0, 100000)}<small>${esc(l.unit)}</small></td><td>${num(`ingredients.${l.ingredientIndex}.price`, l.price, l.name + ' pack price', 0.01)}<small>for ${dec(l.pack)} ${esc(l.unit)}, ${Math.round(l.yield * 100)}% usable</small></td><td class="numeric">${money4(l.unitCost)}<small>per ${esc(l.unit)}</small></td><td class="numeric">${money4(l.cost)}</td></tr>`).join('');
      const body = `<div class="table-wrap"><table class="eq-table ex-table"><thead><tr><th>Ingredient</th><th>Amount per ${esc(x.word)}</th><th>Pack price</th><th class="numeric">Cost per unit</th><th class="numeric">Cost per ${esc(x.word)}</th></tr></thead><tbody>${rows}<tr class="rp-strong"><td colspan="4">Ingredients per ${esc(x.word)}</td><td class="numeric">${money4(r.subtotal)}</td></tr><tr><td colspan="4">Plus ${x.buffer}% food buffer</td><td class="numeric">${money4(r.withBuffer)}</td></tr></tbody></table></div>`;
      return x.recipes.length > 1 ? `<details class="disclosure" data-panel="ex-${x.key}-${r.index}"><summary>${esc(r.name)} <span>${money4(r.perServing)} a serving, ${whole(r.servings)} served</span></summary>${body}</details>` : body;
    }).join('');
    const multi = x.recipes.length > 1 ? `<div class="table-wrap"><table class="eq-table ex-table"><thead><tr><th>Salad</th><th class="numeric">Share of the mix</th><th class="numeric">Cost per serving</th><th class="numeric">Served</th></tr></thead><tbody>${x.recipes.map(r => `<tr><td>${esc(r.name)}</td><td class="numeric">${x.totalServings ? Math.round(r.servings / x.totalServings * 100) : 0}%</td><td class="numeric">${money4(r.perServing)}</td><td class="numeric">${whole(r.servings)}</td></tr>`).join('')}<tr class="rp-strong"><td colspan="2">Average per ${esc(x.word)}</td><td class="numeric">${money4(x.avgPerServing)}</td><td class="numeric">${whole(x.totalServings)}</td></tr></tbody></table></div>` : '';
    const allIn = x.cupEach > 0 ? `<p class="ex-line">Cup and stirrer ${num('settings.cups', state.settings.cups, 'Cup cost per drink', 0.01)} each, so <b>${money4(x.perServingAllIn)}</b> all in per ${esc(x.word)}.</p>` : '';
    const total = `<p class="ex-line"><b>${whole(x.totalServings)}</b> ${esc(x.words)} × <b>${money4(x.perServingAllIn)}</b> = <b>${fmt(x.eventFood + x.eventCups)}</b>${x.cupEach > 0 ? ` (food ${fmt(x.eventFood)} + cups ${fmt(x.eventCups)})` : ''}</p>`;
    const chain = `<ol class="ex-chain"><li><span>Shopping list bill</span><b>${signed(x.dPurchased)}</b><small>The food is worth ${fmt(x.eventFood)}. ${x.stockRounding >= 0 ? `The other ${fmt(x.stockRounding)} is whole packs and stock left in them` : `${fmt(-x.stockRounding)} less is bought because it uses stock you already buy`}.</small></li>${x.dConsumables ? `<li><span>Consumables</span><b>${signed(x.dConsumables)}</b><small>Cups for each drink.</small></li>` : ''}${Math.abs(x.dEnergy) > 0.004 ? `<li><span>Gas and electric</span><b>${signed(x.dEnergy)}</b><small>The urn runs for the drinks.</small></li>` : ''}<li><span>Contingency (${x.contingencyPct}%)</span><b>${signed(x.dContingency)}</b></li><li class="sum"><span>Added to your cost</span><b>${signed(x.dCost)}</b></li><li class="sum"><span>Added to the quote (÷ ${100 - x.marginPct}% for a ${x.marginPct}% margin)</span><b>${signed(x.dPrice)}</b></li></ol>`;
    return `<section class="card ex-card"><div class="ex-head"><label class="ex-title"><input type="checkbox" data-path="options.${x.key}" ${x.on ? 'checked' : ''} aria-label="Include ${esc(x.label)}"><b>${esc(x.label)}</b></label><span class="xtag ${x.on ? 'good' : 'ok'}">${x.on ? `In the quote ${signed(x.dPrice)}` : `Off. Would add ${signed(x.dPrice)}`}</span></div>
<h4>1. How many</h4><p class="ex-line">${num('settings.' + x.key, x.amount, x.label + ' amount', x.step, 0, 1000)} ${esc(x.amountText)}, in <span class="chips">${chips}</span></p><div class="table-wrap"><table class="eq-table ex-table"><thead><tr><th>Stage</th><th class="numeric">${esc(x.basis)}</th><th class="numeric">${esc(x.words)}</th></tr></thead><tbody>${stageRows}<tr class="rp-strong"><td>Total</td><td></td><td class="numeric">${whole(x.totalServings)}</td></tr></tbody></table></div>
<h4>2. What goes in each ${esc(x.word)}</h4>${multi}${recipeBlocks}${allIn}
<h4>3. For the event</h4>${total}
<h4>4. Into the quote</h4>${chain}</section>`;
  }).join('');
  return `<p class="note">Each extra, worked through from the ingredients to the price. Change an amount, a pack price or how many, and everything updates. To add or remove ingredients, edit the recipe in Menu & recipes. Prices marked Estimate in the Shopping list are not from Booker.</p>${cards}`;
}
