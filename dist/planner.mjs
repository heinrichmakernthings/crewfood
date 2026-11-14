// Price planner: the client has an ideal price per meal. Find combinations of changes that get there, or, when there is
// room, ways to fill it. Every candidate is tried for real (the whole plan is recalculated), so the numbers are exact.
// Pure: no DOM. Levers are plain descriptors so a plan can be replayed and trimmed.
import {calculate, sum} from './model.mjs';

export const KEYS = ['drinks', 'fruit', 'cereal', 'salads'];
export const OPT_NAME = {drinks: 'hot drinks', fruit: 'fruit', cereal: 'the cereal station', salads: 'salads'};
const UNIT = {drinks: ' a day', fruit: ' servings a day', cereal: ' bowls per breakfast', salads: ' per meal'};
// How much a client would miss each extra, 0 to 5. Dropping everywhere costs this much; cutting the amount costs 40% of it.
export const APPEAL = {drinks: 5, salads: 4, fruit: 3, cereal: 2};
const DOWN = {drinks: [5, 4, 3, 2], fruit: [2, 1], salads: [2, 1], cereal: [0.5, 0.3]};
const UP = {drinks: [2, 3, 4, 5, 6], fruit: [1, 2, 3], salads: [1, 2, 3], cereal: [0.3, 0.5, 0.8]};
const SWAPS = [
  [/^bacon bap$/i, /^veggie bacon bap$/i], [/^sausage bap$/i, /^veggie sausage bap$/i],
  [/beef bolognese/i, /lentil bolognese/i], [/beef chilli/i, /bean chilli/i], [/chicken curry/i, /chickpea curry/i],
  [/bacon carbonara/i, /mushroom/i], [/fried chicken/i, /lentil stew/i], [/beef burger/i, /veggie burger/i],
  [/everything salad/i, /leaf salad/i], [/coleslaw/i, /leaf salad/i]
];
export const GROUPS = {
  extras: 'Trim the extras', menu: 'Change the menu', fee: 'Waive the equipment fee',
  contingency: 'Trim contingency', team: 'Trim team hours', margin: 'Take it out of your margin'
};

export const perMeal = c => (c.meals ? c.price / c.meals : NaN);
const snap = c => ({price: c.price, perMeal: perMeal(c), profit: c.profit, cost: c.cost, marginPct: c.price ? c.profit / c.price * 100 : 0});
const nextBelow = (k, v) => { const ladder = DOWN[k].filter(x => x < v - 1e-9); return ladder.length ? ladder[0] : null; };
const nextAbove = (k, v) => { const ladder = UP[k].filter(x => x > v + 1e-9); return ladder.length ? ladder[0] : null; };

export function applyLever(s, lv) {
  switch (lv.type) {
    case 'dropOpt':
      if (!s.options[lv.k] || s.optionStages[lv.k][lv.pi] === false) return false;
      s.optionStages[lv.k][lv.pi] = false;
      return true;
    case 'addOpt':
      if (s.options[lv.k]) return false;
      s.options[lv.k] = true;
      s.optionStages[lv.k] = [true, true, true];
      return true;
    case 'addStage':
      if (!s.options[lv.k] || s.optionStages[lv.k][lv.pi]) return false;
      s.optionStages[lv.k][lv.pi] = true;
      return true;
    case 'setAmount':
      if (s.settings[lv.k] === lv.to) return false;
      s.settings[lv.k] = lv.to;
      return true;
    case 'swap': {
      const a = s.recipes[lv.a], b = s.recipes[lv.b], d = Math.min(10, a.weight);
      if (!(d > 0) || !b.phases.some(Boolean)) return false;
      a.weight -= d;
      b.weight += d;
      return true;
    }
    case 'dropBurgers': {
      let changed = false;
      lv.idx.forEach(i => { if (s.recipes[i].phases.some(Boolean)) { s.recipes[i].phases = [false, false, false]; changed = true; } });
      return changed;
    }
    case 'waiveFee':
      if (!s.kit.fee) return false;
      s.kit.fee = false;
      return true;
    case 'contingency':
      if (s.settings.contingency <= 2) return false;
      s.settings.contingency = Math.max(2, s.settings.contingency - 1);
      return true;
    case 'team': {
      let changed = false;
      s.phases.forEach(p => p.staff.forEach(r => { if (r.hours > 0) { r.hours = Math.round(r.hours * 0.95 * 100) / 100; changed = true; } }));
      return changed;
    }
    case 'margin':
      if (s.settings.margin <= 10) return false;
      s.settings.margin -= 1;
      return true;
    default:
      return false;
  }
}

// Reductions available right now (descriptors with a pain score and a group).
export function reductionLevers(state, c) {
  const out = [], meals = c.meals || 1;
  const share = pi => sum(c.groups.filter(g => g.pi === pi).map(g => g.meals)) / meals;
  KEYS.filter(k => state.options[k]).forEach(k => {
    state.phases.forEach((p, pi) => {
      if (p.days > 0 && state.optionStages[k][pi]) out.push({type: 'dropOpt', group: 'extras', k, pi, pain: APPEAL[k] * share(pi), label: `Drop ${OPT_NAME[k]} in ${p.name}`});
    });
    const to = nextBelow(k, state.settings[k]);
    if (to !== null) out.push({type: 'setAmount', group: 'extras', k, to, pain: APPEAL[k] * 0.4, label: `Cut ${OPT_NAME[k]} from ${state.settings[k]} to ${to}${UNIT[k]}`});
  });
  SWAPS.forEach(([ra, rb]) => {
    const a = state.recipes.findIndex(r => ra.test(r.name)), b = state.recipes.findIndex(r => rb.test(r.name));
    if (a < 0 || b < 0 || a === b || !(c.servings[a] > 0) || !(state.recipes[a].weight > 0) || !state.recipes[b].phases.some(Boolean)) return;
    const d = Math.min(10, state.recipes[a].weight), salad = state.recipes[a].type === 'Salad';
    out.push({type: 'swap', group: 'menu', a, b, d, pain: salad ? 0.4 : 0.8, label: `Move ${d} points of the mix from ${state.recipes[a].name} to ${state.recipes[b].name}`});
  });
  const burgers = state.recipes.map((r, i) => (/burger/i.test(r.name) && r.phases.some(Boolean) && c.servings[i] > 0 ? i : -1)).filter(i => i >= 0);
  if (burgers.length) out.push({type: 'dropBurgers', group: 'menu', idx: burgers, pain: 2.5, label: 'Take the burgers off the menu'});
  if (state.kit.fee) out.push({type: 'waiveFee', group: 'fee', pain: 1.5, label: 'Waive the equipment fee'});
  if (state.settings.contingency > 2) out.push({type: 'contingency', group: 'contingency', pain: 2, label: `Trim contingency from ${state.settings.contingency}% to ${Math.max(2, state.settings.contingency - 1)}%`});
  if (sum(state.phases.map(p => sum(p.staff.map(r => r.hours)))) > 0) out.push({type: 'team', group: 'team', pain: 4, label: 'Trim team hours by 5%'});
  if (state.settings.margin > 10) out.push({type: 'margin', group: 'margin', pain: 5, label: `Take margin from ${state.settings.margin}% to ${state.settings.margin - 1}%`});
  return out;
}

// Additions available right now, for when there is room under the target.
export function additionLevers(state, c) {
  const out = [], meals = c.meals || 1;
  const share = pi => sum(c.groups.filter(g => g.pi === pi).map(g => g.meals)) / meals;
  KEYS.forEach(k => {
    if (!state.options[k]) out.push({type: 'addOpt', k, appeal: APPEAL[k], label: `Add ${OPT_NAME[k]}`});
    else {
      state.phases.forEach((p, pi) => { if (p.days > 0 && !state.optionStages[k][pi]) out.push({type: 'addStage', k, pi, appeal: APPEAL[k] * share(pi), label: `Add ${OPT_NAME[k]} in ${p.name}`}); });
      const to = nextAbove(k, state.settings[k]);
      if (to !== null) out.push({type: 'setAmount', k, to, appeal: APPEAL[k] * 0.4, label: `Raise ${OPT_NAME[k]} from ${state.settings[k]} to ${to}${UNIT[k]}`});
    }
  });
  return out;
}

function trial(state, lv) {
  const t = structuredClone(state);
  if (applyLever(t, lv) === false) return null;
  const c2 = calculate(t);
  return c2.errors.length ? null : {state: t, c: c2};
}

function replay(state, steps, skip = -1) {
  const t = structuredClone(state);
  steps.forEach((st, i) => { if (i !== skip) applyLever(t, st.lever); });
  const c = calculate(t);
  return {state: t, c};
}

function runReduction(state, target, groups, maxSteps = 30) {
  let cur = structuredClone(state), c = calculate(cur);
  const meals = c.meals, steps = [];
  while (perMeal(c) > target + 0.0049 && steps.length < maxSteps) {
    const gap = perMeal(c) - target, cands = [];
    for (const lv of reductionLevers(cur, c).filter(l => groups.includes(l.group))) {
      const r = trial(cur, lv);
      if (!r) continue;
      const save = perMeal(c) - perMeal(r.c);
      if (save > 0.0005) cands.push({lv, r, save});
    }
    if (!cands.length) break;
    const enough = cands.filter(x => x.save >= gap - 0.0049);
    const pick = enough.length ? enough.sort((a, b) => a.lv.pain - b.lv.pain || a.save - b.save)[0] : cands.sort((a, b) => b.save / (b.lv.pain || 0.1) - a.save / (a.lv.pain || 0.1))[0];
    steps.push({lever: pick.lv, label: pick.lv.label, saving: pick.save * meals, perMeal: pick.save, pain: pick.lv.pain});
    cur = pick.r.state;
    c = pick.r.c;
  }
  // Drop any step the plan does not actually need, most painful first.
  if (perMeal(c) <= target + 0.0049) {
    for (const i of steps.map((_, k) => k).sort((a, b) => steps[b].pain - steps[a].pain)) {
      if (steps.length < 2 || steps[i].removed) continue;
      const alt = steps.filter((_, k) => k !== i && !steps[k].removed);
      const r = replay(state, alt.map(s => ({lever: s.lever})));
      if (!r.c.errors.length && perMeal(r.c) <= target + 0.0049) steps[i].removed = true;
    }
  }
  const kept = steps.filter(s => !s.removed);
  const final = replay(state, kept);
  // Re-state each kept step's saving in order, now that the unneeded ones are gone.
  let acc = structuredClone(state), accC = calculate(acc);
  const out = kept.map(s => {
    applyLever(acc, s.lever);
    const c2 = calculate(acc), drop = perMeal(accC) - perMeal(c2);
    accC = c2;
    return {lever: s.lever, label: s.label, saving: drop * meals, perMeal: drop, pain: s.pain};
  });
  return {state: final.state, c: final.c, steps: mergeSteps(state, out)};
}

// Show repeated steps once: several swaps between the same two meals, or the same extra dropped in several stages.
function mergeSteps(state, steps) {
  const res = [];
  for (const s of steps) {
    const lv = s.lever;
    const host = lv.type === 'swap' ? res.find(x => x.lever.type === 'swap' && x.lever.a === lv.a && x.lever.b === lv.b)
      : lv.type === 'dropOpt' ? res.find(x => x.lever.type === 'dropOpt' && x.lever.k === lv.k) : null;
    if (host) { host.saving += s.saving; host.perMeal += s.perMeal; host.pain += s.pain; host.parts.push(lv); }
    else res.push({...s, parts: [lv]});
  }
  return res.map(x => {
    let label = x.label;
    if (x.lever.type === 'swap') label = `Move ${sum(x.parts.map(p => p.d))} points of the mix from ${state.recipes[x.lever.a].name} to ${state.recipes[x.lever.b].name}`;
    if (x.lever.type === 'dropOpt') {
      const live = state.phases.filter(p => p.days > 0 && state.optionStages[x.lever.k][state.phases.indexOf(p)]);
      label = x.parts.length >= live.length ? `Drop ${OPT_NAME[x.lever.k]} completely` : `Drop ${OPT_NAME[x.lever.k]} in ${x.parts.map(p => state.phases[p.pi].name).join(' and ')}`;
    }
    return {lever: x.lever, label, saving: x.saving, perMeal: x.perMeal, pain: x.pain};
  });
}

function runFill(state, target) {
  let cur = structuredClone(state), c = calculate(cur);
  const meals = c.meals, steps = [];
  for (let n = 0; n < 20; n++) {
    const cands = [];
    for (const lv of additionLevers(cur, c)) {
      const r = trial(cur, lv);
      if (!r) continue;
      const add = perMeal(r.c) - perMeal(c);
      if (add > 0.0005 && perMeal(r.c) <= target + 0.0049) cands.push({lv, r, add});
    }
    if (!cands.length) break;
    const pick = cands.sort((a, b) => b.lv.appeal / b.add - a.lv.appeal / a.add)[0];
    steps.push({lever: pick.lv, label: pick.lv.label, saving: -pick.add * meals, perMeal: -pick.add, pain: 0});
    cur = pick.r.state;
    c = pick.r.c;
  }
  return {state: cur, c, steps};
}

const SCENARIOS = [
  {key: 'extras', name: 'Keep the menu, trim the extras', blurb: 'The meals stay as they are. We trim or drop upsells, smallest loss first.', groups: ['extras', 'fee']},
  {key: 'menu', name: 'Keep the extras, change the menu', blurb: 'Every extra stays. We shift the mix towards cheaper meals.', groups: ['menu']},
  {key: 'balanced', name: 'A bit of both', blurb: 'The best saving for the least loss, whether it is a menu swap or a trimmed extra.', groups: ['extras', 'menu', 'fee']},
  {key: 'last', name: 'Last resort', blurb: 'Also trims contingency, team hours and your margin. Check what this does to your profit.', groups: ['extras', 'menu', 'fee', 'contingency', 'team', 'margin']}
];

function describe(c0, sc, target) {
  const f = snap(sc.c), base = snap(c0);
  return {
    steps: sc.steps, state: sc.state, price: f.price, perMeal: f.perMeal, profit: f.profit, marginPct: f.marginPct,
    profitChange: f.profit - base.profit, met: f.perMeal <= target + 0.0049, over: Math.max(0, f.perMeal - target),
    pain: sum(sc.steps.map(s => s.pain)), saving: base.price - f.price
  };
}

let memo = {key: '', val: null};
export function planPrice(state, target) {
  const key = JSON.stringify(state) + '|' + target;
  if (memo.key === key) return memo.val;
  const val = planPriceUncached(state, target);
  memo = {key, val};
  return val;
}

function planPriceUncached(state, target) {
  const c0 = calculate(state);
  if (c0.errors.length) return {status: 'error', message: c0.errors[0]};
  if (!(target > 0)) return {status: 'none', current: perMeal(c0), c: snap(c0)};
  const current = perMeal(c0);
  if (current <= target + 0.0049) {
    const fill = runFill(state, target);
    return {status: 'under', current, target, room: target - current, roomEvent: (target - current) * c0.meals, fill: fill.steps.length ? {key: 'fill', name: 'Fill the budget', blurb: 'Extras that fit under the target, best value first.', ...describe(c0, fill, target)} : null};
  }
  const seen = new Set(), scenarios = [];
  for (const def of SCENARIOS) {
    const sc = runReduction(state, target, def.groups);
    if (!sc.steps.length) continue;
    const sig = sc.steps.map(s => s.label).sort().join('|');
    if (seen.has(sig)) continue;
    seen.add(sig);
    scenarios.push({key: def.key, name: def.name, blurb: def.blurb, ...describe(c0, sc, target)});
  }
  return {status: 'over', current, target, gap: current - target, gapEvent: (current - target) * c0.meals, meals: c0.meals, scenarios};
}

// ---- screen ----
const signedGBP = (fmt, n) => (n > 0.004 ? '+' : n < -0.004 ? '-' : '') + fmt(Math.abs(n));

export function renderPlanner(state, c, h, ui = {}) {
  const {esc, fmt, whole, num} = h;
  const target = state.target.perMeal, pm = perMeal(c);
  const head = `<section class="card pp-head"><label class="pp-target"><span>Client's ideal price per meal</span><div class="pp-in">£ ${num('target.perMeal', target, 'Client ideal price per meal', 0.05, 0, 1000)}<small>before VAT</small></div></label><div class="pp-now"><span>Your quote now</span><b>${Number.isFinite(pm) ? fmt(pm) : 'n/a'}</b><small>a meal · ${c.pd ? fmt(c.price / c.pd) : 'n/a'} per person per day · ${whole(c.meals)} meals</small></div></section>`;
  const undo = ui.undo ? `<div class="source-note pp-undo">Plan applied. <button class="small" data-action="planner-undo">Undo it</button></div>` : '';
  if (c.errors.length) return `${undo}${head}<p class="warning">${esc(c.errors[0])} Fix the menu first.</p>`;
  if (!(target > 0)) return `${undo}${head}<p class="note">Type the price per meal the client has in mind. We will work out ways to get there: trimming extras, cheaper menu swaps, and, as a last resort, your margin. Nothing changes until you tap Use this plan, and you can undo it.</p>`;
  const r = planPrice(state, target);
  const card = (sc, fill) => {
    const steps = sc.steps.map(s => `<li><span>${esc(s.label)}</span><b>${fill ? '+' : '-'}${fmt(Math.abs(s.perMeal))}<small> a meal</small></b></li>`).join('');
    const tone = sc.met ? 'good' : 'low';
    return `<section class="card pp-card"><div class="pp-top"><div><h3>${esc(sc.name)}</h3><p class="note">${esc(sc.blurb)}</p></div><span class="xtag ${tone}">${sc.met ? 'Hits the target' : fmt(sc.over) + ' short'}</span></div><ol class="pp-steps">${steps}</ol><div class="pp-result"><div><span>Price per meal</span><b>${fmt(sc.perMeal)}</b></div><div><span>Quote</span><b>${fmt(sc.price)}</b></div><div><span>Your profit</span><b>${fmt(sc.profit)}</b><small>${signedGBP(fmt, sc.profitChange)} · ${Math.round(sc.marginPct)}% margin</small></div></div><button class="primary small" data-action="planner-apply" data-key="${sc.key}">Use this plan</button></section>`;
  };
  if (r.status === 'under') {
    return `${undo}${head}<div class="pp-banner good"><b>You are under the target by ${fmt(r.room)} a meal</b> (${fmt(r.roomEvent)} across the event).</div>${r.fill ? `<p class="note">There is room to add some extras and still hit the target:</p>${card(r.fill, true)}` : '<p class="note">No extra fits in that room. You could keep it as profit.</p>'}`;
  }
  const cards = r.scenarios.length ? r.scenarios.map(s => card(s, false)).join('') : '<p class="warning">None of the levers can bring the price down. Check the plan.</p>';
  return `${undo}${head}<div class="pp-banner low"><b>You are ${fmt(r.gap)} a meal over the target</b> (${fmt(r.gapEvent)} across the event). Here are ways to close the gap, each tried on your plan:</div>${cards}<p class="note">Every number comes from recalculating your whole plan, so it matches the dashboard. Steps are listed in the order they were chosen, and any step not needed was dropped. Extras and amounts are your own: change them on the Dashboard afterwards if you like.</p>`;
}
