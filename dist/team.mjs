// Team earnings: what the catering staff make from the event. Pure: returns HTML.
import {donut} from './charts.mjs';

export function renderTeam(state, c, h) {
  const {esc, fmt, whole} = h, t = c.team, oncost = state.settings.oncost;
  const share = Number.isFinite(c.price) && c.price > 0 ? Math.round(c.labour / c.price * 100) + '%' : 'n/a';
  const rate = r => (r.rateMin === r.rateMax ? `${fmt(r.rateMin)}/h` : `${fmt(r.rateMin)} to ${fmt(r.rateMax)}/h`);
  const roles = t.roles.map(r => `<tr><td>${esc(r.name)}</td><td class="numeric"><b>${fmt(r.perPerson)}</b></td><td class="numeric">${fmt(r.total)}</td><td class="numeric">${whole(r.people)}</td><td class="numeric">${whole(r.days)}</td><td class="numeric">${rate(r)}</td><td class="numeric">${whole(r.hours)}</td></tr>`).join('');
  const stages = t.stages.map(s => `<tr><td>${esc(s.name)}</td><td class="numeric">${whole(s.days)}</td><td class="numeric">${whole(s.people)}</td><td class="numeric">${fmt(s.gross)}</td><td class="numeric">${fmt(s.oncost)}</td><td class="numeric"><b>${fmt(s.total)}</b></td></tr>`).join('');
  const kpi = (label, value, sub, cls = '') => `<div class="kpi ${cls}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`;
  const chart = t.gross > 0 ? donut(t.roles.map(r => ({label: r.name, value: r.total})), h, {centerTop: fmt(t.gross), centerBottom: 'team pay'}) : '<p class="chart-empty">Add staff with hours and a rate to see this.</p>';
  return `<div class="kpis team-kpis">${kpi('Team pay (before on-costs)', fmt(t.gross), `${whole(t.paidHours)} paid hours`, 'main')}${kpi(`Employer on-costs (${oncost}%)`, fmt(t.oncost), 'On top of the pay')}${kpi('Total team cost', fmt(t.total), 'This is what the quote carries')}${kpi('Share of the quote', share, c.meals ? `${fmt(c.labour / c.meals)} per meal` : 'n/a')}</div>
<section class="card"><h3>What each role makes</h3><p class="note">Pay each is for one person working every day their role is on site, before on-costs.</p><div class="table-wrap"><table><thead><tr><th>Role</th><th class="numeric">Pay each</th><th class="numeric">Role total</th><th class="numeric">People</th><th class="numeric">Days</th><th class="numeric">Rate</th><th class="numeric">Hours each</th></tr></thead><tbody>${roles || '<tr><td colspan="7" class="empty">No staff set up yet.</td></tr>'}</tbody></table></div></section>
<div class="team-grid"><section class="card chart-card"><h3>Team pay by role</h3><p class="note">Share of the pay before on-costs.</p>${chart}</section>
<section class="card"><h3>By stage</h3><div class="table-wrap"><table><thead><tr><th>Stage</th><th class="numeric">Days</th><th class="numeric">Team</th><th class="numeric">Pay</th><th class="numeric">On-costs</th><th class="numeric">Total</th></tr></thead><tbody>${stages}</tbody></table></div></section></div>
<p class="note">Change people, hours and hourly rates in Costs & margin, under Catering team. Include yourself as a role if you take pay from the event. On-costs and wages are estimates.</p><button class="small" data-action="navigate" data-target="costs">Edit team & wages</button>`;
}
