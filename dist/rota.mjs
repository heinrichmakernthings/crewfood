// Quick rota maker. Pure: no DOM, no clock.
// Each person works up to three services a day. A service is Off, 4 hours or 6 hours:
//   Breakfast 6am to 10am or 12pm, Lunch 10am to 2pm or 4pm, Dinner 4pm to 8pm or 10pm.
import {sum} from './model.mjs';

export const SERVICES = [
  {key: 'breakfast', name: 'Breakfast', start: 6},
  {key: 'lunch', name: 'Lunch', start: 10},
  {key: 'dinner', name: 'Dinner', start: 16}
];
export const LENGTHS = [4, 6];
export const LONG_DAY = 10;

export const clock = h => `${h % 12 === 0 ? 12 : h % 12}${h % 24 < 12 ? 'am' : 'pm'}`;
export const shiftTimes = (si, hours) => (hours ? `${clock(SERVICES[si].start)} to ${clock(SERVICES[si].start + hours)}` : '');
export const dayCount = phase => Math.max(0, Math.ceil(phase.days));

// Roles come from the staff lines in Costs & margin.
export function roleNames(state) {
  const names = [];
  state.phases.forEach(p => p.staff.forEach(r => { if (!names.includes(r.name)) names.push(r.name); }));
  return names;
}

const COMBOS = {
  10: [[4, 6, 0], [0, 4, 6], [4, 0, 6]],
  8: [[4, 4, 0], [0, 4, 4], [4, 0, 4]],
  6: [[6, 0, 0], [0, 6, 0], [0, 0, 6]],
  4: [[4, 0, 0], [0, 4, 0], [0, 0, 4]]
};
const bucket = h => (h >= 9 ? 10 : h >= 7 ? 8 : h >= 5 ? 6 : 4);

// A starting rota that follows the costed team: one person per costed head, hours rounded to 4 or 6 hour shifts,
// spread across breakfast, lunch and dinner so every service has cover.
export function defaultRota(state) {
  const roles = roleNames(state), most = new Map(), hoursOf = new Map();
  state.phases.forEach(p => p.staff.forEach(r => {
    most.set(r.name, Math.max(most.get(r.name) || 0, Math.round(r.people)));
    if (!hoursOf.has(r.name) && r.people > 0) hoursOf.set(r.name, r.hours);
  }));
  const people = [];
  roles.forEach(role => {
    const n = most.get(role) || 0;
    for (let k = 0; k < n; k++) {
      people.push({
        id: 'p' + (people.length + 1),
        name: n > 1 ? `${role} ${k + 1}` : role,
        role,
        stages: state.phases.map(p => { const r = p.staff.find(x => x.name === role); return !!r && k < Math.round(r.people); }),
        pattern: COMBOS[bucket(hoursOf.get(role) || 8)][people.length % 3]
      });
    }
  });
  const days = state.phases.map((ph, pi) => Array.from({length: dayCount(ph)}, () => Object.fromEntries(people.filter(p => p.stages[pi]).map(p => [p.id, [...p.pattern]]))));
  return {people: people.map(({id, name, role, stages}) => ({id, name, role, stages})), days};
}

export function checkRota(rota) {
  const fail = () => { throw Error('Check the rota.'); };
  if (!rota || !Array.isArray(rota.people) || !Array.isArray(rota.days) || rota.days.length !== 3 || rota.people.length > 40) fail();
  const ids = new Set();
  for (const p of rota.people) {
    if (!p || typeof p.id !== 'string' || !/^[A-Za-z0-9_-]{1,20}$/.test(p.id) || ids.has(p.id)) fail();
    ids.add(p.id);
    if (typeof p.name !== 'string' || p.name.length > 100 || typeof p.role !== 'string' || p.role.length > 100) fail();
    if (!Array.isArray(p.stages) || p.stages.length !== 3 || p.stages.some(x => typeof x !== 'boolean')) fail();
  }
  for (const list of rota.days) {
    if (!Array.isArray(list) || list.length > 366) fail();
    for (const day of list) {
      if (!day || typeof day !== 'object' || Array.isArray(day)) fail();
      for (const [id, shifts] of Object.entries(day)) {
        if (!ids.has(id) || !Array.isArray(shifts) || shifts.length !== 3 || shifts.some(x => x !== 0 && !LENGTHS.includes(x))) fail();
      }
    }
  }
}

// A day past the end of the saved list uses the last saved day.
export function dayEntry(rota, pi, di) {
  const list = rota.days[pi] || [];
  return list[di] || list[list.length - 1] || {};
}

function ensureDay(state, pi, di) {
  const list = state.rota.days[pi];
  while (list.length <= di) list.push(structuredClone(list[list.length - 1] || {}));
  return list[di];
}

export function setShift(state, pi, di, id, si, hours) {
  if (hours !== 0 && !LENGTHS.includes(hours)) return;
  const day = ensureDay(state, pi, di);
  const cur = day[id] || [0, 0, 0];
  cur[si] = hours;
  day[id] = cur;
}

export function copyDayTo(state, pi, from, to) {
  const src = structuredClone(dayEntry(state.rota, pi, from));
  ensureDay(state, pi, to);
  state.rota.days[pi][to] = src;
}

export function copyDayToAll(state, pi, from) {
  const src = dayEntry(state.rota, pi, from), n = dayCount(state.phases[pi]);
  state.rota.days[pi] = Array.from({length: n}, () => structuredClone(src));
}

export function clearDay(state, pi, di) {
  ensureDay(state, pi, di);
  state.rota.days[pi][di] = {};
}

export function addPerson(state) {
  const nums = state.rota.people.map(p => Number(p.id.replace(/\D/g, '')) || 0);
  const id = 'p' + (Math.max(0, ...nums) + 1);
  state.rota.people.push({id, name: 'New person', role: roleNames(state)[0] || '', stages: [true, true, true]});
}

export function removePerson(state, index) {
  const [gone] = state.rota.people.splice(index, 1);
  if (gone) state.rota.days.forEach(list => list.forEach(day => { delete day[gone.id]; }));
}

export const dayFlags = shifts => ({
  overlap: shifts[0] === 6 && (shifts[1] > 0),
  long: sum(shifts) > LONG_DAY
});

const rateFor = (state, pi, role) => {
  const row = state.phases[pi].staff.find(r => r.name === role);
  return row ? row.rate : null;
};

// Hours and pay for the whole rota, by person and by stage.
export function rotaSummary(state) {
  const rota = state.rota;
  const people = rota.people.map(p => {
    const stages = state.phases.map((ph, pi) => {
      if (!p.stages[pi] || !(ph.days > 0)) return {hours: 0, pay: 0, worked: 0, rate: rateFor(state, pi, p.role)};
      const rate = rateFor(state, pi, p.role);
      let hours = 0, worked = 0;
      for (let di = 0; di < dayCount(ph); di++) {
        const shifts = dayEntry(rota, pi, di)[p.id];
        const h = shifts ? sum(shifts) : 0;
        hours += h;
        if (h > 0) worked++;
      }
      return {hours, pay: hours * (rate || 0), worked, rate};
    });
    return {
      id: p.id, name: p.name, role: p.role, stages,
      hours: sum(stages.map(s => s.hours)), pay: sum(stages.map(s => s.pay)),
      noRate: stages.some(s => s.hours > 0 && s.rate === null)
    };
  });
  const stageTotals = state.phases.map((_, pi) => ({hours: sum(people.map(p => p.stages[pi].hours)), pay: sum(people.map(p => p.stages[pi].pay))}));
  return {people, stageTotals, hours: sum(people.map(p => p.hours)), pay: sum(people.map(p => p.pay)), noRate: people.filter(p => p.noRate).map(p => p.name)};
}

// Write the rota into the staff lines (people and hours per day), so the quote matches the rota.
// Roles with no rota hours in a stage are left alone.
export function applyRotaToCosts(state) {
  const sum0 = summaryByRole(state);
  let changed = 0;
  const skipped = [];
  state.phases.forEach((ph, pi) => {
    if (!(ph.days > 0)) return;
    for (const [role, v] of Object.entries(sum0[pi] || {})) {
      const row = ph.staff.find(r => r.name === role);
      if (!row) { if (!skipped.includes(role)) skipped.push(role); continue; }
      row.people = v.people;
      row.hours = Math.round(v.hours / (v.people * ph.days) * 10000) / 10000;
      changed++;
    }
  });
  const note = skipped.length ? ` Not changed (no costing line): ${skipped.join(', ')}.` : '';
  return {changed, skipped, message: changed ? `Quote updated from the rota (${changed} role lines).${note}` : 'Nothing to update. Add shifts to the rota first.' + note};
}

function summaryByRole(state) {
  const s = rotaSummary(state), out = state.phases.map(() => ({}));
  s.people.forEach(p => p.stages.forEach((st, pi) => {
    if (!(st.hours > 0)) return;
    const e = out[pi][p.role] || (out[pi][p.role] = {people: 0, hours: 0});
    e.people++;
    e.hours += st.hours;
  }));
  return out;
}

const signed = (fmt, n) => (n > 0.004 ? '+' : n < -0.004 ? '-' : '') + fmt(Math.abs(n));

export function renderRota(state, c, ui, h) {
  const {esc, fmt, whole} = h, rota = state.rota, s = rotaSummary(state), roles = roleNames(state);
  const pi = ui.phase, ph = state.phases[pi], n = dayCount(ph), di = Math.min(Math.max(0, ui.day), Math.max(0, n - 1));
  const kpi = (label, value, sub, cls = '') => `<div class="kpi ${cls}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`;
  const diff = s.pay - c.team.gross;
  const kpis = `<div class="kpis team-kpis">${kpi('Rota hours', whole(s.hours), `The quote assumes ${whole(c.team.paidHours)}`)}${kpi('Rota pay', fmt(s.pay), 'Before on-costs', 'main')}${kpi('Pay in the quote', fmt(c.team.gross), 'Costed team pay')}${kpi('Rota vs quote', signed(fmt, diff), Math.abs(diff) < 0.005 ? 'They match' : diff > 0 ? 'The rota costs more than the quote carries' : 'The rota costs less than the quote carries')}</div>`;
  const apply = `<div class="rota-apply"><button class="primary" data-action="rota-apply">Use this rota in the quote</button><span class="subtle">Sets people and hours per day for each role in Costs & margin. You can still change them there.</span></div>`;
  if (!(ph.days > 0)) {
    return `${kpis}${ui.tabs}<p class="note">${esc(ph.name)} has no days. Set its days on the Dashboard to make a rota for it.</p>`;
  }
  const present = rota.people.filter(p => p.stages[pi]);
  const entry = dayEntry(rota, pi, di);
  const chips = Array.from({length: n}, (_, i) => `<button class="day-chip" data-action="rota-day" data-id="${i}" aria-pressed="${i === di}">Day ${i + 1}</button>`).join('');
  const counts = SERVICES.map((svc, si) => `${svc.name} <b>${present.filter(p => (entry[p.id] || [0, 0, 0])[si] > 0).length}</b>`).join(' · ');
  const rows = present.map(p => {
    const sh = entry[p.id] || [0, 0, 0], f = dayFlags(sh), total = sum(sh);
    const selects = SERVICES.map((svc, si) => `<label class="shift"><span>${svc.name}</span><select data-rota="${pi}:${di}:${esc(p.id)}:${si}" aria-label="${esc(p.name)} ${svc.name}"><option value="0">Off</option>${LENGTHS.map(l => `<option value="${l}" ${sh[si] === l ? 'selected' : ''}>${l}h</option>`).join('')}</select><em>${shiftTimes(si, sh[si]) || '&nbsp;'}</em></label>`).join('');
    const warn = f.overlap ? '<small class="warn">Breakfast 6 hours runs into lunch</small>' : f.long ? `<small class="warn">Over ${LONG_DAY} hours</small>` : '';
    return `<div class="rota-row ${f.overlap || f.long ? 'flag' : ''}"><div class="rota-who"><b>${esc(p.name)}</b><small>${esc(p.role)}</small></div>${selects}<div class="rota-hours"><b>${total}h</b>${warn}</div></div>`;
  }).join('') || '<p class="note">Nobody is on site in this stage. Tick a stage for someone below.</p>';
  const dayEditor = `<section class="card rota-day"><div class="rota-head"><h3>${esc(ph.name)}, day ${di + 1} of ${n}</h3><span class="subtle">${counts}</span></div>
<div class="day-chips" role="group" aria-label="Day">${chips}</div>
<p class="note">${SERVICES.map(v => `${v.name} ${clock(v.start)}: 4 hours to ${clock(v.start + 4)} or 6 hours to ${clock(v.start + 6)}`).join('. ')}.</p>
<div class="rota-rows">${rows}</div>
<div class="rota-actions"><button class="small primary" data-action="rota-copy-all">Copy this day to every day of ${esc(ph.name)}</button><button class="small" data-action="rota-copy-next" ${di >= n - 1 ? 'disabled' : ''}>Copy to next day</button><button class="small" data-action="rota-clear">Clear this day</button></div></section>`;
  const head = Array.from({length: n}, (_, i) => `<th class="${i === di ? 'sel' : ''}"><button class="grid-day" data-action="rota-day" data-id="${i}" aria-label="Day ${i + 1}">${i + 1}</button></th>`).join('');
  const body = present.map(p => `<tr><td>${esc(p.name)}</td>${Array.from({length: n}, (_, i) => { const t = sum(dayEntry(rota, pi, i)[p.id] || [0, 0, 0]); return `<td class="${i === di ? 'sel' : ''} ${t > LONG_DAY ? 'warn' : ''}">${t || ''}</td>`; }).join('')}<td class="numeric"><b>${whole(s.people.find(x => x.id === p.id).stages[pi].hours)}</b></td></tr>`).join('');
  const overview = present.length ? `<section class="card"><h3>${esc(ph.name)} at a glance</h3><p class="note">Hours per person each day. Tap a day number to edit it.</p><div class="table-wrap"><table class="rota-grid"><thead><tr><th>Person</th>${head}<th class="numeric">Hours</th></tr></thead><tbody>${body}</tbody></table></div></section>` : '';
  const people = `<section class="card"><h3>Who is on the rota</h3><p class="note">Name people, pick a role (it sets their hourly rate from Costs & margin) and tick the stages they work.</p><div class="table-wrap"><table class="rota-people"><thead><tr><th>Name</th><th>Role</th><th>Stages</th><th class="numeric">Hours</th><th class="numeric">Pay</th><th></th></tr></thead><tbody>${rota.people.map((p, i) => {
    const sp = s.people[i], opts = (roles.includes(p.role) || !p.role ? roles : [...roles, p.role]).map(r => `<option value="${esc(r)}" ${r === p.role ? 'selected' : ''}>${esc(r)}</option>`).join('');
    return `<tr><td><input class="name" data-path="rota.people.${i}.name" value="${esc(p.name)}" aria-label="Name" maxlength="100"></td><td><select data-path="rota.people.${i}.role" aria-label="${esc(p.name)} role">${opts}</select>${sp.noRate ? '<small class="warn">No hourly rate for this role in some stages</small>' : ''}</td><td><div class="chips">${state.phases.map((st, k) => `<label class="chip"><input type="checkbox" data-path="rota.people.${i}.stages.${k}" ${p.stages[k] ? 'checked' : ''} aria-label="${esc(p.name)} works ${esc(st.name)}"><span>${esc(st.name)}</span></label>`).join('')}</div></td><td class="numeric">${whole(sp.hours)}</td><td class="numeric">${fmt(sp.pay)}</td><td><button class="delete" data-action="rota-remove" data-id="${i}" aria-label="Remove ${esc(p.name)}">×</button></td></tr>`;
  }).join('')}<tr class="rp-strong"><td colspan="3">Total</td><td class="numeric">${whole(s.hours)}</td><td class="numeric">${fmt(s.pay)}</td><td></td></tr></tbody></table></div><div class="group-tools"><button class="small" data-action="rota-add">+ Add person</button><span class="subtle">Pay is hours times the role's hourly rate, before on-costs.</span></div></section>`;
  const warnRate = s.noRate.length ? `<p class="warning">${esc(s.noRate.join(', '))}: no hourly rate for the chosen role, so their hours are not costed. Pick a role from Costs & margin.</p>` : '';
  return `${kpis}${apply}${warnRate}${ui.tabs}${dayEditor}${overview}${people}`;
}
