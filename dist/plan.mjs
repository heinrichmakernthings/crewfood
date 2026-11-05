// Plan checking and upgrading. Pure: no DOM, so tests can use it.
import {DEFAULT} from './data.mjs';
import {CLIENT_DEFAULT} from './reports.mjs';

export function validate(s){
 if(!s||s.version!==3||!Array.isArray(s.phases)||s.phases.length!==3||!Array.isArray(s.ingredients)||!Array.isArray(s.recipes)||s.recipes.length!==DEFAULT.recipes.length||!Array.isArray(s.overheads)||!s.settings)throw Error('This is not a Crew Table plan.');
 const finite=(n,min=0,max=1e7)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
 const short=v=>typeof v==='string'&&v.length<=500;
 if(!short(s.name)||s.ingredients.length<1||s.ingredients.length>300||s.overheads.length>100)throw Error('Check the event name and plan size.');
 s.client={...CLIENT_DEFAULT,...(s.client&&typeof s.client==='object'?s.client:{})};
 for(const[k,v]of Object.entries(CLIENT_DEFAULT)){const x=s.client[k];if(typeof x!==typeof v||(typeof v==='string'&&x.length>2000)||(typeof v==='number'&&!finite(x,0,3650)))throw Error('Check the client quote details.');}
 s.options={...DEFAULT.options,...(s.options&&typeof s.options==='object'?s.options:{})};
 for(const k of Object.keys(DEFAULT.options))if(typeof s.options[k]!=='boolean')throw Error('Check the client options.');
 s.optionStages={...DEFAULT.optionStages,...(s.optionStages&&typeof s.optionStages==='object'?s.optionStages:{})};
 for(const k of Object.keys(DEFAULT.optionStages)){const a=s.optionStages[k];if(!Array.isArray(a)||a.length!==3||a.some(x=>typeof x!=='boolean'))throw Error('Check which stages each option applies to.');}
 s.kit={...DEFAULT.kit,...(s.kit&&typeof s.kit==='object'?s.kit:{})};
 if(typeof s.kit.energy!=='boolean'||typeof s.kit.fee!=='boolean'||!finite(s.kit.feeAmount,0,1e6)||!['day','event'].includes(s.kit.feeBasis))throw Error('Check the kit charges.');
 for(const r of s.recipes){if(r.phases===undefined)r.phases=[true,true,true];if(!Array.isArray(r.phases)||r.phases.length!==3||r.phases.some(x=>typeof x!=='boolean'))throw Error('Check which stages each recipe is served in.');if(r.type==='Extra'&&r.key!==DEFAULT.recipes[r.id].key)throw Error('Invalid recipe details.');}
 for(const k of ['gas','electric','serviceHours','load'])if(s.settings[k]===undefined)s.settings[k]=DEFAULT.settings[k];
 if(s.equipment===undefined)s.equipment=structuredClone(DEFAULT.equipment);
 if(!Array.isArray(s.equipment)||s.equipment.length>30)throw Error('Check the equipment list.');
 for(const e of s.equipment)if(!e||typeof e.key!=='string'||!short(e.name)||!['gas','electric'].includes(e.fuel)||!finite(e.kw)||!finite(e.perHour)||!finite(e.hours,0,24))throw Error('Check the equipment list.');
 const equipKeys=new Set(s.equipment.map(e=>e.key));if(equipKeys.size!==s.equipment.length)throw Error('Equipment names must be different.');
 for(const r of s.recipes){if(r.equipment===undefined){const d=DEFAULT.recipes[r.id];r.equipment=d&&d.name===r.name?[...d.equipment]:[];}if(!Array.isArray(r.equipment)||r.equipment.some(k=>!equipKeys.has(k)))throw Error('Check the equipment for each meal.');}
 for(const key of Object.keys(DEFAULT.settings))if(!finite(s.settings[key]))throw Error('Missing or invalid setting: '+key);
 for(const i of s.ingredients)if(!Number.isInteger(i.id)||!short(i.name)||!['kg','litre','each'].includes(i.unit)||!short(i.url)||!short(i.packLabel)||!short(i.sku)||!short(i.checked)||!short(i.status))throw Error('Invalid ingredient details.');
 s.recipes.forEach((r,i)=>{if(r.id!==i||r.type!==DEFAULT.recipes[i].type||!short(r.name)||!short(r.note)||!Array.isArray(r.lines)||r.lines.length>150)throw Error('Invalid recipe details.');});
 for(const p of s.phases){if(!short(p.name)||!Array.isArray(p.groups)||p.groups.length>100||!Array.isArray(p.staff)||p.staff.length>100)throw Error('Invalid phase details.');for(const g of p.groups)if(!short(g.name))throw Error('Invalid worker group.');for(const r of p.staff)if(!short(r.name))throw Error('Invalid staff role.');}
 for(const o of s.overheads)if(!short(o.name))throw Error('Invalid overhead name.');
 const ids=new Set(s.ingredients.map(i=>i.id));if(ids.size!==s.ingredients.length)throw Error('Duplicate ingredient IDs.');
 for(const i of s.ingredients){if(!finite(i.pack,.00001)||!finite(i.price)||!finite(i.yield,.001,1)||typeof i.name!=='string')throw Error('Check ingredient pack sizes, prices and yields.');}
 for(const r of s.recipes){if(!finite(r.weight)||!Array.isArray(r.lines)||r.lines.some(l=>!ids.has(l.ingredient)||!finite(l.qty)))throw Error('Check recipe ingredients and quantities.');}
 for(const p of s.phases){if(!finite(p.days,0,365)||!Array.isArray(p.groups)||!Array.isArray(p.staff))throw Error('Check the phase days and groups.');for(const g of p.groups)if(!finite(g.people,0,100000)||!Number.isInteger(g.people)||!Array.isArray(g.meals)||g.meals.length!==3||g.meals.some(x=>typeof x!=='boolean')||typeof g.extras!=='boolean')throw Error('Check group headcounts and meal choices.');for(const r of p.staff)if(!finite(r.people)||!finite(r.hours,0,24)||!finite(r.rate))throw Error('Check staffing values.');}
 for(const [k,v]of Object.entries(s.settings))if(!finite(v))throw Error('Check cost settings.');if(s.settings.margin>=100)throw Error('Profit margin must be below 100%.');for(const o of s.overheads)if(!finite(o.cost))throw Error('Check overhead costs.');
}

// Older plans (version 1 and 2) have a different menu. Keep the user's event, crew, prices and overheads; use the current menu.
export function migrate(s) {
  if (!s || (s.version !== 1 && s.version !== 2)) return s;
  const v1 = s.version === 1, keep = v1 ? 36 : 51;
  const n = structuredClone(DEFAULT);
  if (typeof s.name === 'string') n.name = s.name;
  const mine = Array.isArray(s.ingredients) ? s.ingredients : [];
  n.ingredients = n.ingredients.map(d => mine.find(i => i && i.id === d.id && d.id <= keep) || d);
  let next = Math.max(...n.ingredients.map(i => i.id)) + 1;
  mine.filter(i => i && i.id > keep).forEach(i => n.ingredients.push({...i, id: next++}));
  if (Array.isArray(s.phases) && s.phases.length === 3) {
    n.phases = s.phases.map(p => ({
      ...p,
      groups: (p.groups || []).map(g => (v1 ? {...g, extras: true} : g)),
      staff: (p.staff || []).map(r => (v1 && ((r.name === 'Lead cook' && r.rate === 22) || (r.name === 'Cook' && r.rate === 18)) ? {...r, rate: 17} : r))
    }));
  }
  if (!v1 && Array.isArray(s.recipes)) {
    n.recipes.forEach(r => {
      const o = s.recipes[r.id];
      if (o && o.name === r.name && Number.isFinite(o.weight)) {
        r.weight = o.weight;
        if (Array.isArray(o.phases)) r.phases = o.phases;
      }
    });
  }
  n.settings = {...n.settings, ...(s.settings || {})};
  if (!v1 && s.options) n.options = s.options;
  if (Array.isArray(s.overheads)) n.overheads = s.overheads;
  if (s.client) n.client = s.client;
  return n;
}
