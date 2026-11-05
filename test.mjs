import assert from 'node:assert/strict';
import {DEFAULT} from './dist/data.mjs';import {validate,migrate} from './dist/plan.mjs';import{calculate,sum}from'./dist/model.mjs';
let s=structuredClone(DEFAULT),c=calculate(s);assert.equal(c.pd,1150);assert.equal(c.meals,3450);assert.ok(Math.abs(sum(c.groups.map(g=>g.price))-c.price)<1e-7);assert.ok(Math.abs(c.profit/c.price-.25)<1e-9);assert.equal(c.errors.length,0);
const two=calculate(s,'two');assert.equal(two.meals,2300);assert.equal(two.labour,c.labour);assert.equal(two.fixed,c.fixed);assert.ok(two.price<c.price);
s.phases[0].groups[0].meals=[false,true,true];let mixed=calculate(s);assert.equal(mixed.meals,3250);assert.equal(mixed.pd,1150);assert.ok(mixed.price<c.price);
s.settings.margin=0;assert.equal(calculate(s).price,calculate(s).cost);s.settings.margin=25;
s.phases.forEach(p=>p.days=0);let z=calculate(s);assert.equal(z.meals,0);assert.equal(z.labour,0);assert.equal(z.cost,sum(s.overheads.map(o=>o.cost))*1.05);assert.ok(Number.isFinite(z.price));
s=structuredClone(DEFAULT);s.ingredients[0].price*=2;assert.ok(calculate(s).recipeCosts[4]>c.recipeCosts[4]);
s=structuredClone(DEFAULT);s.recipes.slice(0,4).forEach(r=>r.weight=0);assert.ok(calculate(s).errors.length>=1&&calculate(s).errors[0].includes('Breakfast'));assert.ok(Number.isNaN(calculate(s).price));assert.equal(calculate(s,'two').errors.length,0);
s=structuredClone(DEFAULT);s.recipes[2].lines=[];assert.ok(calculate(s).errors.some(e=>e.includes('no ingredients')));assert.ok(Number.isNaN(calculate(s).price));
console.log(JSON.stringify({personDays:c.pd,meals:c.meals,cost:c.cost,price:c.price,profit:c.profit,perDay:c.price/c.pd,bolognese:c.recipeCosts[4],salad:c.recipeCosts[16],twoMealPrice:two.price,tests:'passed'}));
// Reports
import {clientQuote,renderClientQuote,CLIENT_DEFAULT,mealsLabel} from './dist/reports.mjs';
{const st=structuredClone(DEFAULT);st.client={...CLIENT_DEFAULT,clientName:'Acme <Fest>',showOptions:true};const c0=calculate(st),t2=calculate(st,'two'),t3=calculate(st,'three');
const q=clientQuote(st,c0,t2,t3);assert.equal(q.phases.length,3);assert.ok(Math.abs(sum(q.phases.map(p=>p.price))-q.net)<1e-9);assert.ok(Math.abs(q.total-(q.net+q.vat))<0.011);assert.equal(q.vatRate,20);
const fmt=n=>'£'+n.toFixed(2),h={esc:s=>String(s).replace(/</g,'&lt;'),fmt,whole:n=>String(Math.round(n)),today:'2026-11-04'};
const html=renderClientQuote(st,c0,t2,t3,h);assert.ok(html.includes('Acme &lt;Fest>'));assert.ok(html.includes(fmt(q.total)));
for(const secret of [fmt(c0.cost),fmt(c0.profit),'profit','margin','contingency','labour'])assert.ok(!html.toLowerCase().includes(secret.toLowerCase()),'client quote leaks '+secret);
assert.equal(mealsLabel([false,true,true]),'Lunch & dinner');
st.client.vat=0;assert.equal(clientQuote(st,c0,t2,t3).total,clientQuote(st,c0,t2,t3).net);}
console.log('reports tests passed');

// Menu v2: options, per-stage menus, wages, migration
{const st=structuredClone(DEFAULT),c0=calculate(st);
for(const p of st.phases)for(const r of p.staff)if(r.name!=='Kitchen assistant')assert.equal(r.rate,17);
assert.ok(c0.servings[14]>0&&c0.servings[15]>0,'burgers served in Build');
const live=structuredClone(st);live.phases[0].days=0;assert.equal(calculate(live).servings[14],0,'no burgers without Build');
const bacon=st.ingredients.find(i=>i.name==='Bacon rashers').id;assert.ok(st.recipes[0].lines.some(l=>l.ingredient===bacon)&&st.recipes[12].lines.some(l=>l.ingredient===bacon),'baps and carbonara share bacon');
for(const k of ['drinks','fruit','cereal','salads']){const off=structuredClone(st);off.options[k]=false;assert.ok(calculate(off).price<c0.price,k+' off lowers the price');}
const noCereal=structuredClone(st);noCereal.options.cereal=false;assert.equal(calculate(noCereal).servings[19],0);
const two=calculate(st,'two');assert.equal(two.servings[19],0,'no cereal when breakfast is not served');
const old={version:1,name:'Old plan',ingredients:st.ingredients.filter(i=>i.id<=36),recipes:Array(13).fill({}),phases:st.phases.map(p=>({...p,groups:p.groups.map(g=>({...g,extras:false})),staff:p.staff.map(r=>r.name==='Lead cook'?{...r,rate:22}:r.name==='Cook'?{...r,rate:18}:r)})),settings:(({cereal,...x})=>x)(st.settings),overheads:st.overheads};
const m=migrate(old);validate(m);assert.equal(m.version,3);assert.equal(m.name,'Old plan');assert.equal(m.phases[0].staff[0].rate,17);assert.ok(m.phases[0].groups.every(g=>g.extras));assert.equal(m.recipes.length,20);
const v2=structuredClone(st);delete v2.options;v2.recipes.forEach(r=>delete r.phases);validate(v2);assert.equal(v2.options.cereal,true);assert.deepEqual(v2.recipes[0].phases,[true,true,true]);
}
console.log('menu v2 tests passed');
// Equipment and energy (no ovens)
{const st=structuredClone(DEFAULT),c0=calculate(st),by=k=>c0.energy.find(e=>e.key===k);
assert.ok(!st.equipment.some(e=>/oven/i.test(e.key+e.name)),'no ovens in the kit list');
assert.ok(st.recipes[0].equipment.includes('grill'),'bacon baps use the grill');
assert.ok(st.recipes[10].equipment.includes('fryer')&&st.recipes[14].equipment.includes('fryer'),'fried food uses the fryer');
assert.deepEqual(st.recipes[16].equipment,[],'salads are cold');
assert.ok(Math.abs(c0.energyTotals.gasCost+c0.energyTotals.elecCost-c0.energyTotals.cost)<1e-9);
assert.ok(Math.abs(c0.recipeEnergy.reduce((a,r)=>a+r.cost,0)-c0.energyTotals.cost)<1e-6,'meal energy adds up to the total');
assert.ok(c0.energy.every(e=>e.units>=1),'every kit item is used by default');
const noBuild=structuredClone(st);noBuild.phases[0].days=0;assert.ok(calculate(noBuild).energy.find(e=>e.key==='fryer').kwh<by('fryer').kwh);
const allElec=structuredClone(st);allElec.equipment.forEach(e=>e.fuel='electric');const ae=calculate(allElec);assert.equal(ae.energyTotals.gasKwh,0);assert.ok(Math.abs(ae.energyTotals.cost-c0.energyTotals.allElectric)<1e-6);
const none=structuredClone(st);none.recipes.forEach(r=>{r.equipment=r.equipment.filter(k=>k!=='fryer')});const nf=calculate(none).energy.find(e=>e.key==='fryer');assert.equal(nf.units,0);assert.equal(nf.kwh,0);
assert.equal(calculate(st).price,c0.price,'energy is not added to the quote');
const old2=structuredClone(st);old2.version=2;delete old2.equipment;['gas','electric','serviceHours','load'].forEach(k=>delete old2.settings[k]);old2.recipes.forEach(r=>delete r.equipment);old2.recipes[10].name='Chicken and potato traybake';old2.recipes[0].weight=77;old2.name='Kept name';
const m2=migrate(old2);validate(m2);assert.equal(m2.version,3);assert.equal(m2.name,'Kept name');assert.equal(m2.recipes[0].weight,77);assert.equal(m2.recipes[10].name,'Fried chicken and fries');assert.ok(m2.equipment.length===4);
const v3old=structuredClone(st);delete v3old.equipment;['gas','electric','serviceHours','load'].forEach(k=>delete v3old.settings[k]);v3old.recipes.forEach(r=>delete r.equipment);validate(v3old);assert.ok(v3old.recipes[0].equipment.includes('grill'));
const bad=structuredClone(st);bad.recipes[0].equipment=['oven'];assert.throws(()=>validate(bad));
}
console.log('equipment tests passed');
