// Donut charts for the dashboard. Pure: returns an SVG + legend as an HTML string.
import {sum} from './model.mjs';

export const PALETTE = ['#245946', '#d98b2b', '#b4472a', '#3f6f8f', '#8aa68f', '#6b5b7b'];

export function donut(items, h, {centerTop = '', centerBottom = ''} = {}) {
  const {esc, fmt} = h;
  const vals = items.map(i => (Number.isFinite(i.value) && i.value > 0 ? i.value : 0));
  const total = sum(vals);
  if (!total) return '<p class="chart-empty">Fix the menu warning above to see this chart.</p>';
  const R = 15.9155;
  let offset = 0;
  const arcs = items.map((_, i) => {
    const p = vals[i] / total * 100;
    if (!p) return '';
    const arc = `<circle cx="21" cy="21" r="${R}" fill="none" stroke="${PALETTE[i % PALETTE.length]}" stroke-width="6" stroke-dasharray="${p.toFixed(3)} ${(100 - p).toFixed(3)}" stroke-dashoffset="${(-offset).toFixed(3)}" transform="rotate(-90 21 21)"/>`;
    offset += p;
    return arc;
  }).join('');
  const legend = items.map((it, i) => `<li><span class="dot" style="background:${PALETTE[i % PALETTE.length]}"></span><span class="lg-name">${esc(it.label)}</span><b>${fmt(vals[i])}</b><span class="lg-pct">${Math.round(vals[i] / total * 100)}%</span></li>`).join('');
  return `<div class="donut"><svg viewBox="0 0 42 42" role="img" aria-label="${esc(items.map((it, i) => `${it.label} ${Math.round(vals[i] / total * 100)}%`).join(', '))}"><circle cx="21" cy="21" r="${R}" fill="none" stroke="#e8ece6" stroke-width="6"/>${arcs}<text x="21" y="${centerBottom ? 20.2 : 22}" text-anchor="middle" font-size="3.6" font-weight="700" fill="#252f32">${esc(centerTop)}</text>${centerBottom ? `<text x="21" y="24.6" text-anchor="middle" font-size="2.3" fill="#596769">${esc(centerBottom)}</text>` : ''}</svg><ul class="legend">${legend}</ul></div>`;
}

// Food cost as planned, split by what it feeds.
export function foodGroups(state, c) {
  const part = pick => sum(state.recipes.map((r, i) => (pick(r) ? c.servings[i] * c.recipeCosts[i] : 0)));
  return [
    {label: 'Breakfast baps', value: part(r => r.type === 'Breakfast')},
    {label: 'Lunch & dinner mains', value: part(r => r.type === 'Main')},
    {label: 'Big salads', value: part(r => r.key === 'salad')},
    {label: 'Cereal, fruit & hot drinks', value: part(r => r.type === 'Extra' && r.key !== 'salad')}
  ];
}
