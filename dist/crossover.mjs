// Ingredient crossover: which meals share ingredients, and how efficient each meal is to buy for.
// Pure: returns data (crossover) and an HTML string (renderCrossover).
import {sum} from './model.mjs';

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
  const wins = x.wins.length ? `<div class="xwins"><b>Easy wins</b>${x.wins.map(w => `<p>${esc(w.name)} is only used in ${esc(w.only)}, and about <b>${fmt(w.leftover)}</b> of it is left unused in the last pack. Using it in another meal would use that up.</p>`).join('')}</div>` : '';
  return `<div class="kpis xkpis"><div class="kpi main"><span>Spend on shared ingredients</span><strong>${Math.round(x.sharedPct)}%</strong><small>${fmt(x.sharedSpend)} of ${fmt(x.spend)} food spend</small></div><div class="kpi"><span>Unused in the last packs</span><strong>${fmt(x.leftover)}</strong><small>Already counted in your costs</small></div><div class="kpi"><span>Ingredients only one meal uses</span><strong>${whole(x.soloCount)}</strong><small>of ${whole(ing.length)} in use</small></div></div>
${wins}
<section class="card"><h3>Meal ranking</h3><p class="note">Best first. The score is the share of a meal's ingredient cost that comes from ingredients other meals also use. Shared ingredients are bought in bigger batches and leave less waste.</p><div class="table-wrap"><table class="xtable"><thead><tr><th class="numeric">#</th><th>Meal</th><th>Shared with other meals</th><th>Only this meal uses</th><th class="numeric">Unused</th></tr></thead><tbody>${rows}</tbody></table></div></section>
<section class="card"><h3>Ingredients used by the most meals</h3><div class="table-wrap"><table class="xtable">${ihead}<tbody>${top.map(irow).join('')}</tbody></table></div>${rest.length ? `<details class="disclosure" data-panel="cross-all"><summary>Show the other ${rest.length} ingredients</summary><div class="table-wrap"><table class="xtable">${ihead}<tbody>${rest.map(irow).join('')}</tbody></table></div></details>` : ''}</section>
<p class="note">Only meals that are actually served in this plan count. Unused is the value left in the last pack of an ingredient after the event; it is already included in your costs, so using it elsewhere saves money.</p>`;
}
