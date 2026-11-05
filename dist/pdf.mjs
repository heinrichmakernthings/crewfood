// Builds the client quote as a branded A4 PDF (one or two pages) with jsPDF. Pure: the jsPDF class is passed in.
import {clientQuote, longDate, addDays} from './reports.mjs';
import {BRAND_DEFAULT, hexToRgb, tint, contrastText} from './brand.mjs';

const W = 210, H = 297, M = 14, CW = W - 2 * M, FOOT = 20;
const GREY = '#596769', INK = '#252f32';

// jsPDF's built-in fonts only cover Latin-1, so swap common symbols and drop anything else.
export const clean = s => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
export const money = n => '£' + new Intl.NumberFormat('en-GB', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(n);
const whole = n => new Intl.NumberFormat('en-GB', {maximumFractionDigits: 0}).format(n);

export function pdfFileName(state) {
  const base = (state.client && state.client.clientName) || state.name || 'Catering quote';
  const safe = clean(base).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Catering quote';
  return `${safe} - Catering quote.pdf`;
}

export function buildQuotePdf(JsPDF, state, c, two, three, brandIn, today) {
  const brand = {...BRAND_DEFAULT, ...(brandIn || {})};
  const q = clientQuote(state, c, two, three), cl = q.cl, date = cl.date || today;
  const col = brand.colour, band = contrastText(col), accent = band === '#ffffff' ? col : '#1f2a2d';
  const doc = new JsPDF({unit: 'mm', format: 'a4', compress: true});
  doc.setProperties({title: clean(`${cl.clientName || state.name} - Catering quote`), subject: 'Catering quote', author: clean(brand.company), creator: 'Crew Table'});
  const rgb = hex => hexToRgb(hex);
  let y = 0;

  const text = (str, x, yy, {size = 9, bold = false, color = INK, align = 'left'} = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...rgb(color));
    doc.text(clean(str), x, yy, {align});
  };
  const wrap = (str, width, size, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    return doc.splitTextToSize(clean(str), width);
  };
  const rule = (yy, hex = tint(col, 0.6), w = 0.3) => { doc.setDrawColor(...rgb(hex)); doc.setLineWidth(w); doc.line(M, yy, W - M, yy); };
  const runningHead = () => {
    text(brand.company, M, 10, {size: 8, bold: true, color: accent});
    text(`${cl.clientName || state.name}${cl.reference ? ' · Ref ' + cl.reference : ''}`, W - M, 10, {size: 8, color: GREY, align: 'right'});
    rule(13);
    y = 22;
  };
  const ensure = h => { if (y + h > H - FOOT) { doc.addPage(); runningHead(); } };
  const section = title => {
    ensure(16);
    text(title.toUpperCase(), M, y, {size: 8, bold: true, color: accent});
    rule(y + 2);
    y += 7;
  };
  const bullet = (str, x, yy, width, size = 8.5) => {
    doc.setFillColor(...rgb(accent));
    doc.circle(x + 0.9, yy - 1, 0.55, 'F');
    const lines = wrap(str, width - 4, size);
    lines.forEach((ln, i) => text(ln, x + 3.5, yy + i * 4.1, {size}));
    return lines.length * 4.1;
  };

  // Header band with logo or company name
  doc.setFillColor(...rgb(col));
  doc.rect(0, 0, W, 38, 'F');
  let tagY = 26;
  let logoOk = false;
  if (brand.logo) {
    try { doc.getImageProperties(brand.logo); logoOk = true; } catch { logoOk = false; }
  }
  if (logoOk) {
    const lh = Math.min(15, 46 / brand.logoRatio), lw = lh * brand.logoRatio;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(M - 2, 7, lw + 4, lh + 4, 1.5, 1.5, 'F');
    doc.addImage(brand.logo, brand.logo.startsWith('data:image/jpeg') ? 'JPEG' : brand.logo.startsWith('data:image/webp') ? 'WEBP' : 'PNG', M, 9, lw, lh);
    tagY = 9 + lh + 8;
  } else {
    text(brand.company, M, 19, {size: 20, bold: true, color: band});
  }
  if (brand.tagline) text(brand.tagline, M, tagY, {size: 9, color: band});
  text('QUOTE', W - M, 18, {size: 24, bold: true, color: band, align: 'right'});
  const meta = [cl.reference ? `Ref ${cl.reference}` : '', longDate(date), `Valid until ${longDate(addDays(date, cl.validDays))}`].filter(Boolean);
  meta.forEach((m, i) => text(m, W - M, 25 + i * 4.6, {size: 8.5, color: band, align: 'right'}));

  // Prepared for / event
  y = 49;
  const half = CW / 2;
  text('PREPARED FOR', M, y, {size: 7, bold: true, color: GREY});
  text('EVENT', M + half + 4, y, {size: 7, bold: true, color: GREY});
  text(cl.clientName || 'Client name', M, y + 6, {size: 12, bold: true});
  if (cl.contact) text(cl.contact, M, y + 11, {size: 9, color: GREY});
  const evLines = wrap(state.name, half - 6, 12, true).slice(0, 2);
  evLines.forEach((ln, i) => text(ln, M + half + 4, y + 6 + i * 5.2, {size: 12, bold: true}));
  text(`${whole(q.days)} days of catering · ${whole(q.meals)} meals`, M + half + 4, y + 6 + evLines.length * 5.2 + 0.5, {size: 9, color: GREY});
  y += 22;

  // Total
  doc.setFillColor(...rgb(tint(col, 0.88)));
  doc.roundedRect(M, y, CW, 27, 2, 2, 'F');
  text(q.vatRate ? 'TOTAL INCLUDING VAT' : 'TOTAL PRICE', M + 6, y + 8, {size: 7.5, bold: true, color: GREY});
  text(money(q.vatRate ? q.total : q.net), M + 6, y + 20, {size: 25, bold: true, color: accent});
  if (cl.showPerPerson && q.personDays) {
    text(`${money(q.perPersonDay)} per person per day`, W - M - 6, y + 12, {size: 9.5, bold: true, align: 'right'});
    text(`${money(q.perMeal)} average per meal (before VAT)`, W - M - 6, y + 18, {size: 8.5, color: GREY, align: 'right'});
  }
  y += 36;

  // Price by stage
  section('Price by stage');
  const cx = {days: M + 98, people: M + 124, meals: M + 148, price: W - M};
  text('STAGE', M, y, {size: 7, bold: true, color: GREY});
  text('DAYS', cx.days, y, {size: 7, bold: true, color: GREY, align: 'right'});
  text('PEOPLE / DAY', cx.people, y, {size: 7, bold: true, color: GREY, align: 'right'});
  text('MEALS', cx.meals, y, {size: 7, bold: true, color: GREY, align: 'right'});
  text('PRICE', cx.price, y, {size: 7, bold: true, color: GREY, align: 'right'});
  y += 2.5;
  rule(y, '#d9dfd9', 0.2);
  y += 5.2;
  q.phases.forEach(p => {
    text(p.name, M, y, {size: 9.5});
    text(whole(p.days), cx.days, y, {size: 9.5, align: 'right'});
    text(whole(p.people), cx.people, y, {size: 9.5, align: 'right'});
    text(whole(p.meals), cx.meals, y, {size: 9.5, align: 'right'});
    text(money(p.price), cx.price, y, {size: 9.5, bold: true, align: 'right'});
    y += 2;
    rule(y, '#e8ece6', 0.15);
    y += 4.8;
  });
  if (q.fee) {
    text('Kitchen equipment fee', M, y, {size: 9.5});
    text(money(q.fee), cx.price, y, {size: 9.5, bold: true, align: 'right'});
    y += 2;
    rule(y, '#e8ece6', 0.15);
    y += 4.8;
  }
  const sx = W - M - 74;
  y += 1;
  text('Total before VAT', sx, y, {size: 9.5});
  text(money(q.net), W - M, y, {size: 9.5, bold: true, align: 'right'});
  if (q.vatRate) {
    y += 5.5;
    text(`VAT at ${q.vatRate}%`, sx, y, {size: 9.5});
    text(money(q.vat), W - M, y, {size: 9.5, bold: true, align: 'right'});
    y += 3;
    rule(y, INK, 0.5);
    doc.setDrawColor(...rgb(INK));
    y += 5.5;
    text('Total to pay', sx, y, {size: 11, bold: true});
    text(money(q.total), W - M, y, {size: 11, bold: true, align: 'right'});
  }
  y += 10;

  // What's included
  const stages = new Map();
  q.groups.forEach(g => {
    const key = `${g.phase}|${g.meals}`;
    if (!stages.has(key)) stages.set(key, {phase: g.phase, meals: g.meals, names: []});
    stages.get(key).names.push(`${g.name} (${whole(g.people)})`);
  });
  const crewLines = [...stages.values()].map(s => `${s.phase}: ${s.names.join(', ')}. ${s.meals}.`);
  const items = ['Experienced catering team to prepare, cook and serve', 'All ingredients, plates, cutlery and napkins', ...q.menu.everyDay, q.fee ? 'Kitchen equipment supplied (equipment fee shown above)' : 'Kitchen equipment, fuel and cleaning'];
  const wrappedCrew = crewLines.map(l => wrap(l, CW - 4, 8.5));
  const bulletHeight = Math.ceil(items.length / 2) * 4.6;
  ensure(16 + wrappedCrew.reduce((a, l) => a + l.length * 4.1 + 1, 0) + bulletHeight + 4);
  section("What's included");
  wrappedCrew.forEach(lines => { lines.forEach((ln, i) => text(ln, M, y + i * 4.1, {size: 8.5})); y += lines.length * 4.1 + 1; });
  y += 2;
  const colW = CW / 2 - 3;
  const half1 = Math.ceil(items.length / 2);
  let yl = y, yr = y;
  items.forEach((it, i) => {
    if (i < half1) yl += bullet(it, M, yl, colW) + 0.5;
    else yr += bullet(it, M + CW / 2 + 3, yr, colW) + 0.5;
  });
  y = Math.max(yl, yr) + 6;

  // Menu
  const names = a => a.map(clean);
  if (cl.showMenu && (q.menu.breakfast.length || q.menu.mains.length)) {
    const b = names(q.menu.breakfast), m = names(q.menu.mains), mh = Math.ceil(m.length / 2);
    const rows = Math.max(b.length, mh);
    ensure(18 + rows * 4.6 + 8);
    section('Example menu');
    const bx = M, mx = M + CW * 0.34, mw = (CW * 0.66) / 2 - 2;
    if (b.length) { text('Breakfast', bx, y, {size: 9, bold: true}); }
    if (m.length) { text('Lunch & dinner', mx, y, {size: 9, bold: true}); }
    y += 5;
    b.forEach((it, i) => bullet(it, bx, y + i * 4.6, CW * 0.34 - 4));
    m.forEach((it, i) => bullet(it, i < mh ? mx : mx + mw + 4, y + (i < mh ? i : i - mh) * 4.6, mw));
    y += rows * 4.6 + 1;
    text('Vegetarian options are included at every meal. The menu rotates across the event.', M, y, {size: 7.5, color: GREY});
    y += 8;
  }

  // Options
  if (cl.showOptions) {
    ensure(16 + q.options.length * 6.5);
    section('Options');
    text('PACKAGE', M, y, {size: 7, bold: true, color: GREY});
    text('PER PERSON / DAY', W - M - 40, y, {size: 7, bold: true, color: GREY, align: 'right'});
    text('TOTAL BEFORE VAT', W - M, y, {size: 7, bold: true, color: GREY, align: 'right'});
    y += 5;
    q.options.forEach(o => {
      text(o.label, M, y, {size: 9});
      text(money(o.perPersonDay), W - M - 40, y, {size: 9, align: 'right'});
      text(money(o.price), W - M, y, {size: 9, bold: true, align: 'right'});
      y += 6;
    });
    y += 3;
  }

  // Notes
  if (cl.notes && cl.notes.trim()) {
    const lines = wrap(cl.notes, CW, 9);
    ensure(14 + lines.length * 4.3);
    section('Notes');
    lines.forEach((ln, i) => text(ln, M, y + i * 4.3, {size: 9}));
    y += lines.length * 4.3 + 6;
  }

  // Terms
  const terms = wrap(cl.terms, CW, 7.5);
  const validity = `${q.vatRate ? '' : 'Prices exclude VAT. '}This quote is valid for ${whole(cl.validDays)} days, until ${longDate(addDays(date, cl.validDays))}.`;
  ensure(16 + terms.length * 3.4 + 6);
  section('Terms');
  terms.forEach((ln, i) => text(ln, M, y + i * 3.4, {size: 7.5, color: GREY}));
  y += terms.length * 3.4 + 2;
  text(validity, M, y, {size: 7.5, bold: true, color: GREY});
  y += 9;

  // Approval
  if (cl.showApproval) {
    ensure(50);
    section('Approval');
    const sentence = wrap(`Approved on behalf of ${cl.clientName || 'the client'} to go ahead at the price above (${money(q.vatRate ? q.total : q.net)}).`, CW, 9);
    sentence.forEach((ln, i) => text(ln, M, y + i * 4.4, {size: 9}));
    y += sentence.length * 4.4 + 9;
    const fw = (CW - 14) / 2;
    [['Name', M, y], ['Position', M + fw + 14, y], ['Signature', M, y + 15], ['Date', M + fw + 14, y + 15]].forEach(([label, x, yy]) => {
      doc.setDrawColor(...rgb(INK));
      doc.setLineWidth(0.25);
      doc.line(x, yy, x + fw, yy);
      text(label.toUpperCase(), x, yy + 3.6, {size: 6.5, color: GREY});
    });
    y += 24;
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    rule(H - 15);
    const left = [brand.company, brand.contact].filter(Boolean).join(' · ');
    text(left, M, H - 10.5, {size: 7.5, color: GREY});
    if (brand.footer) text(brand.footer, M, H - 6.5, {size: 7, color: GREY});
    text(`Page ${i} of ${pages}`, W - M, H - 10.5, {size: 7.5, color: GREY, align: 'right'});
  }
  return doc;
}
