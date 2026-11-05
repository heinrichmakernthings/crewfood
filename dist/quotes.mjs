// Saved quotes: a named library of plans. Pure: storage and time are passed in by the app.
export const LIBRARY_VERSION = 1;

export const emptyLibrary = () => ({version: LIBRARY_VERSION, quotes: []});

export function cleanLibrary(input) {
  const lib = emptyLibrary();
  if (!input || typeof input !== 'object' || !Array.isArray(input.quotes)) return lib;
  const seen = new Set();
  for (const q of input.quotes) {
    if (!q || typeof q.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(q.id) || seen.has(q.id) || !q.plan || typeof q.plan !== 'object') continue;
    seen.add(q.id);
    lib.quotes.push({
      id: q.id,
      client: typeof q.client === 'string' ? q.client.slice(0, 200) : '',
      event: typeof q.event === 'string' ? q.event.slice(0, 200) : '',
      savedAt: typeof q.savedAt === 'string' ? q.savedAt : '',
      plan: q.plan
    });
  }
  return lib;
}

export const newId = (now, rand) => 'q' + now.toString(36) + Math.floor(rand * 1e6).toString(36);

export const displayName = q => q.client || q.event || 'Untitled quote';

// Save the current plan. With an id that exists in the library it updates that quote; otherwise it adds one.
export function saveQuote(lib, plan, {id, now, rand}) {
  const entry = {id: id && lib.quotes.some(q => q.id === id) ? id : newId(now, rand), client: (plan.client && plan.client.clientName) || '', event: plan.name || '', savedAt: new Date(now).toISOString(), plan: structuredClone(plan)};
  const quotes = lib.quotes.some(q => q.id === entry.id) ? lib.quotes.map(q => (q.id === entry.id ? entry : q)) : [...lib.quotes, entry];
  return {lib: {...lib, quotes}, entry};
}

export function duplicateQuote(lib, id, {now, rand}) {
  const src = lib.quotes.find(q => q.id === id);
  if (!src) return {lib, entry: null};
  const plan = structuredClone(src.plan);
  plan.client = {...(plan.client || {}), reference: ''};
  plan.name = (plan.name || 'Quote') + ' (copy)';
  const entry = {id: newId(now, rand), client: src.client, event: plan.name, savedAt: new Date(now).toISOString(), plan};
  return {lib: {...lib, quotes: [...lib.quotes, entry]}, entry};
}

export const deleteQuote = (lib, id) => ({...lib, quotes: lib.quotes.filter(q => q.id !== id)});

export const newestFirst = lib => [...lib.quotes].sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));

export function searchQuotes(lib, text) {
  const t = text.trim().toLowerCase();
  return newestFirst(lib).filter(q => !t || `${q.client} ${q.event}`.toLowerCase().includes(t));
}

// Merge a backup into the library. Same id: the newer save wins. Returns the new library and counts.
export function mergeLibrary(lib, incoming) {
  const clean = cleanLibrary(incoming);
  const byId = new Map(lib.quotes.map(q => [q.id, q]));
  let added = 0, updated = 0;
  for (const q of clean.quotes) {
    const have = byId.get(q.id);
    if (!have) { byId.set(q.id, q); added++; }
    else if ((q.savedAt || '') > (have.savedAt || '')) { byId.set(q.id, q); updated++; }
  }
  return {lib: {...lib, quotes: [...byId.values()]}, added, updated};
}

export function backupFile(lib, brand) {
  return {type: 'crew-table-quotes', version: LIBRARY_VERSION, brand, quotes: lib.quotes};
}

export const agoText = (iso, now) => {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins)) return '';
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};
