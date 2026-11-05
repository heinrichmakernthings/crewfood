// Ingredient crossover: which meals share ingredients, and how efficient each meal is to buy for.
// Pure: returns data (crossover) and an HTML string (renderCrossover).
import {sum, calculate} from './model.mjs';

export const SHARED_MIN = 2;      // an ingredient is shared when this many served meals use it
export const WIN_MIN_LEFTOVER = 3; // pounds left in the last pack before it is worth a tip

export function crossover(state, c) {
  const waste = 1 + state.settings.waste / 100;
  const ing = new Map(state.ingredients.map(i => [i.id, i]));
  const shop = new Map(c.shopping.map(i => [i.id, i]));
  const unit = i => i.price / (i.pack * i.yield);
  const served = state.recipes.map((_, i) => c.servings[i] > 0);

  // ingredient id -> served recipes that use it
  const users = new Map();
  state.recipes.forEach((r, ri) => {
    if (!served[ri]) return;
    r.lines.forEach(l => {
      if (!(l.qty > 0) || !ing.has(l.ingredient)) return;
      const list = users.get(l.ingredient) || [];
      if (!list.includes(ri)) list.push(ri);
      users.set(l.ingredient, list);
    });
  });

  const ingredients = [...users.entries()].map(([id, list]) => {
    const i = ing.get(id), s = shop.get(id);
    const leftover = Math.max(0, s.spare * unit(i));
    return {id, name: i.name, recipeCount: list.length, recipes: list.map(ri => state.recipes[ri].name), types: list.map(ri => state.recipes[ri].type), spend: s.spend, leftover, packs: s.packs, shared: list.length >= SHARED_MIN};
  }).sort((a, b) => b.recipeCount - a.recipeCount || b.spend - a.spend || a.name.localeCompare(b.name));

  const recipes = state.recipes.map((r, ri) => {
    if (!served[ri]) return null;
    let total = 0, shared = 0, soloLeft = 0, sharedCount = 0;
    const solo = [];
    r.lines.forEach(l => {
      if (!(l.qty > 0) || !ing.has(l.ingredient)) return;
      const i = ing.get(l.ingredient), cost = l.qty * c.servings[ri] * unit(i) * waste, list = users.get(l.ingredient) || [];
      total += cost;
      if (list.length >= SHARED_MIN) { shared += cost; sharedCount++; }
      else { solo.push(i.name); soloLeft += Math.max(0, shop.get(i.id).spare * unit(i)); }
    });
    return {index: ri, name: r.name, type: r.type, cost: total, sharedCost: shared, sharedPct: total ? shared / total * 100 : 0, sharedCount, solo, soloLeftover: soloLeft};
  }).filter(Boolean).sort((a, b) => b.sharedPct - a.sharedPct || a.soloLeftover - b.soloLeftover || a.name.localeCompare(b.name));
  recipes.forEach((r, i) => { r.rank = i + 1; });

  const spend = sum(ingredients.map(i => i.spend)), sharedSpend = sum(ingredients.filter(i => i.shared).map(i => i.spend));
  const wins = ingredients.filter(i => !i.shared && i.leftover >= WIN_MIN_LEFTOVER && !i.types.every(t => t === 'Extra')).sort((a, b) => b.leftover - a.leftover).slice(0, 3)
    .map(i => ({name: i.name, only: i.recipes[0], leftover: i.leftover}));
  return {
    ingredients, recipes, wins,
    spend, sharedSpend, sharedPct: spend ? sharedSpend / spend * 100 : 0,
    leftover: sum(ingredients.map(i => i.leftover)),
    soloCount: ingredients.filter(i => !i.shared).length
  };
}

// Common pairings: which ingredients usually go with which meals. The engine tries each one for real
// (it recalculates the whole plan) and only suggests the ones that make the buying more efficient.
export const PAIRINGS = [
  {recipe: /burger/i, add: [['Salad tomatoes', 0.03, 'a slice of tomato'], ['Onions', 0.01, 'a few raw onion rings'], ['Lettuce', 0.01, 'a leaf of lettuce']]},
  {recipe: /^bacon bap$/i, add: [['Salad tomatoes', 0.03, 'a slice of tomato, for a BLT'], ['Lettuce', 0.01, 'a leaf of lettuce']]},
  {recipe: /bolognese/i, add: [['Mushrooms', 0.03, 'chopped mushrooms'], ['Peppers', 0.02, 'diced pepper'], ['Hard Italian-style cheese', 0.008, 'grated to finish']]},
  {recipe: /curry|stew/i, add: [['Peppers', 0.03, 'diced pepper'], ['Mushrooms', 0.03, 'chopped mushrooms']]},
  {recipe: /^bacon carbonara$/i, add: [['Mushrooms', 0.04, 'sliced mushrooms'], ['Frozen mixed veg', 0.03, 'a few peas']]},
  {recipe: /everything salad/i, add: [['Peppers', 0.02, 'sliced pepper'], ['Cucumber', 0.03, 'sliced cucumber'], ['Onions', 0.01, 'thin onion']]},
  {recipe: /leaf salad/i, add: [['Cucumber', 0.02, 'a few slices of cucumber']]}
];

// Suggestions: add an ingredient you already buy to a meal where it fits. For each one we report the real change in the
// shopping bill, the unused stock and the quote, and which meal becomes more efficient.
export function suggestions(state, c, limit = 6) {
  if (!c || (c.errors && c.errors.length)) return [];
  const before = crossover(state, c), byName = new Map(state.ingredients.map(i => [i.name, i]));
  const out = [];
  state.recipes.forEach((r, ri) => {
    if (!(c.servings[ri] > 0)) return;
    PAIRINGS.filter(p => p.recipe.test(r.name)).forEach(p => p.add.forEach(([name, qty, how]) => {
      const ing = byName.get(name);
      if (!ing || r.lines.some(l => l.ingredient === ing.id)) return;
      const next = structuredClone(state);
      next.recipes[ri].lines.push({ingredient: ing.id, qty});
      const c2 = calculate(next);
      if (c2.errors.length) return;
      const after = crossover(next, c2);
      const was = before.ingredients.find(i => i.id === ing.id), now = after.ingredients.find(i => i.id === ing.id);
      const becomesShared = !!now && now.recipeCount >= SHARED_MIN && (!was || was.recipeCount < SHARED_MIN);
      const wasteSaved = before.leftover - after.leftover;
      const soloName = becomesShared && was ? was.recipes[0] : '';
      const meal = soloName ? before.recipes.find(x => x.name === soloName) : null, mealAfter = soloName ? after.recipes.find(x => x.name === soloName) : null;
      if (!becomesShared && wasteSaved < 1) return;
      out.push({
        recipeIndex: ri, recipeName: r.name, ingredientId: ing.id, ingredientName: name, unit: ing.unit, qty, how,
        extraSpend: c2.purchased - c.purchased, wasteSaved, priceChange: c2.price - c.price, becomesShared, free: c2.purchased - c.purchased < 0.5 && wasteSaved > 0,
        meal: meal ? {name: meal.name, from: meal.sharedPct, to: mealAfter ? mealAfter.sharedPct : meal.sharedPct} : null,
        sharedAfter: after.sharedPct
      });
    }));
  });
  // Best first: free ones (they only use stock you already pay for), then ones that turn a one-meal ingredient into a shared
  // one, then the most unused stock used up, then the cheapest.
  out.sort((a, b) => Number(b.free) - Number(a.free) || Number(b.becomesShared) - Number(a.becomesShared) || b.wasteSaved - a.wasteSaved || a.extraSpend - b.extraSpend);
  const seen = new Set();
  return out.filter(x => (seen.has(x.ingredientId) ? false : (seen.add(x.ingredientId), true))).slice(0, limit);
}

export function applySuggestion(state, sid) {
  const [ri, id, qty] = String(sid).split(':').map(Number);
  const r = state.recipes[ri];
  if (!r || !state.ingredients.some(i => i.id === id) || !(qty > 0) || r.lines.some(l => l.ingredient === id)) return null;
  r.lines.push({ingredient: id, qty});
  return {recipe: r.name, ingredient: state.ingredients.find(i => i.id === id).name};
}

const amount = (qty, unit) => (unit === 'kg' ? `${Math.round(qty * 1000)}g` : unit === 'litre' ? `${Math.round(qty * 1000)}ml` : `${qty}`);
const money = (fmt, n) => (n > 0.004 ? '+' : n < -0.004 ? '-' : '') + fmt(Math.abs(n));

const grade = pct => (pct >= 80 ? ['Great', 'good'] : pct >= 50 ? ['Good', 'ok'] : ['Low', 'low']);

export function renderCrossover(state, c, h) {
  const {esc, fmt, whole} = h;
  if (c.errors && c.errors.length) return `<p class="warning">${esc(c.errors[0])} Fix the menu to see the crossover.</p>`;
  const x = crossover(state, c);
  const names = list => (list.length <= 3 ? list : [...list.slice(0, 3), `+${list.length - 3} more`]).map(esc).join(', ');
  const rows = x.recipes.map(r => {
    const [label, tone] = grade(r.sharedPct);
    return `<tr><td class="numeric rank">${r.rank}</td><td>${esc(r.name)}<small>${esc(r.type === 'Main' ? 'Lunch & dinner' : r.type === 'Salad' ? 'Salad' : r.type === 'Extra' ? 'Extra' : 'Breakfast')}</small></td><td><div class="xbar"><span class="${tone}" style="width:${Math.round(r.sharedPct)}%"></span></div><b>${Math.round(r.sharedPct)}%</b> <span class="xtag ${tone}">${label}</span></td><td>${r.solo.length ? `${names(r.solo)}` : '<small>Nothing, all shared</small>'}</td><td class="numeric">${r.soloLeftover >= 0.5 ? fmt(r.soloLeftover) : '<small>none</small>'}</td></tr>`;
  }).join('');
  const ing = x.ingredients, top = ing.slice(0, 10), rest = ing.slice(10);
  const irow = i => `<tr><td>${esc(i.name)}</td><td class="numeric"><b>${i.recipeCount}</b></td><td>${names(i.recipes)}</td><td class="numeric">${fmt(i.spend)}</td><td class="numeric">${i.leftover >= 0.5 ? fmt(i.leftover) : '<small>none</small>'}</td></tr>`;
  const ihead = '<thead><tr><th>Ingredient</th><th class="numeric">Meals</th><th>Used in</th><th class="numeric">Spend</th><th class="numeric">Unused</th></tr></thead>';
  const sg = suggestions(state, c);
  const sgHtml = sg.length ? `<section class="card xsug"><h3>Suggestions</h3><p class="note">Ingredients you already buy that would fit these meals. Each one was tried on your plan, so the numbers are real. Tap Add to put it in the recipe, then change the amount in Menu if you like.</p>${sg.map(g => `<div class="sg"><div class="sg-main"><div class="sg-title"><b>Add ${esc(g.ingredientName.toLowerCase())} to ${esc(g.recipeName)}</b>${g.free ? '<em class="xtag good">Free</em>' : ''}</div><span>${esc(g.how)}, about ${esc(amount(g.qty, g.unit))} each</span><small>Shopping bill <b>${money(fmt, g.extraSpend)}</b> <i>·</i> unused stock <b>${money(fmt, -g.wasteSaved)}</b> <i>·</i> quote <b>${money(fmt, g.priceChange)}</b>${g.meal ? ` <i>·</i> ${esc(g.meal.name)} ${Math.round(g.meal.from)}% to ${Math.round(g.meal.to)}%` : ''}${g.becomesShared && !g.meal ? ' <i>·</i> now shared by two meals' : ''}</small></div><button class="small primary" data-action="suggest-apply" data-sid="${g.recipeIndex}:${g.ingredientId}:${g.qty}">Add</button></div>`).join('')}</section>` : '<p class="note">No suggestions right now. Your meals already share most of what they can.</p>';
  const wins = x.wins.length ? `<div class="xwins"><b>Unused stock</b>${x.wins.map(w => `<p>Only ${esc(w.only)} uses ${esc(w.name.toLowerCase())}, and about <b>${fmt(w.leftover)}</b> of it is left unused in the last pack. Using it in another meal would use that up.</p>`).join('')}</div>` : '';
  return `<div class="kpis xkpis"><div class="kpi main"><span>Spend on shared ingredients</span><strong>${Math.round(x.sharedPct)}%</strong><small>${fmt(x.sharedSpend)} of ${fmt(x.spend)} food spend</small></div><div class="kpi"><span>Unused in the last packs</span><strong>${fmt(x.leftover)}</strong><small>Already counted in your costs</small></div><div class="kpi"><span>Ingredients only one meal uses</span><strong>${whole(x.soloCount)}</strong><small>of ${whole(ing.length)} in use</small></div></div>
${sgHtml}
${wins}
<section class="card"><h3>Meal ranking</h3><p class="note">Best first. The score is the share of a meal's ingredient cost that comes from ingredients other meals also use. Shared ingredients are bought in bigger batches and leave less waste.</p><div class="table-wrap"><table class="xtable"><thead><tr><th class="numeric">#</th><th>Meal</th><th>Shared with other meals</th><th>Only this meal uses</th><th class="numeric">Unused</th></tr></thead><tbody>${rows}</tbody></table></div></section>
<section class="card"><h3>Ingredients used by the most meals</h3><div class="table-wrap"><table class="xtable">${ihead}<tbody>${top.map(irow).join('')}</tbody></table></div>${rest.length ? `<details class="disclosure" data-panel="cross-all"><summary>Show the other ${rest.length} ingredients</summary><div class="table-wrap"><table class="xtable">${ihead}<tbody>${rest.map(irow).join('')}</tbody></table></div></details>` : ''}</section>
<p class="note">Only meals that are actually served in this plan count. Unused is the value left in the last pack of an ingredient after the event; it is already included in your costs, so using it elsewhere saves money.</p>`;
}
