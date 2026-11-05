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
const m=migrate(old);validate(m);assert.equal(m.version,4);assert.equal(m.name,'Old plan');assert.equal(m.phases[0].staff[0].rate,17);assert.ok(m.phases[0].groups.every(g=>g.extras));assert.equal(m.recipes.length,20);
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
const old2=structuredClone(st);old2.version=2;delete old2.equipment;['gas','electric','serviceHours','load'].forEach(k=>delete old2.settings[k]);old2.recipes.forEach(r=>delete r.equipment);old2.recipes[10].name='Chicken and potato traybake';old2.recipes[0].weight=77;old2.name='Kept name';
const m2=migrate(old2);validate(m2);assert.equal(m2.version,4);assert.equal(m2.name,'Kept name');assert.equal(m2.recipes[0].weight,77);assert.equal(m2.recipes[10].name,'Fried chicken and fries');assert.ok(m2.equipment.length===4);
const v3old=structuredClone(st);delete v3old.equipment;['gas','electric','serviceHours','load'].forEach(k=>delete v3old.settings[k]);v3old.recipes.forEach(r=>delete r.equipment);validate(v3old);assert.ok(v3old.recipes[0].equipment.includes('grill'));
const bad=structuredClone(st);bad.recipes[0].equipment=['oven'];assert.throws(()=>validate(bad));
}
console.log('equipment tests passed');
// Kit we own: charge gas & electric into the cost, and/or an equipment fee
{const st=structuredClone(DEFAULT),c0=calculate(st),cont=1+st.settings.contingency/100,mar=1-st.settings.margin/100;
assert.equal(st.kit.energy,true);assert.equal(st.kit.fee,false);
assert.ok(Math.abs(c0.energyCharge-c0.energyTotals.cost)<1e-9,'energy is charged by default');
const off=structuredClone(st);off.kit.energy=false;const co=calculate(off);
assert.equal(co.energyCharge,0);assert.ok(Math.abs((c0.price-co.price)-c0.energyCharge*cont/mar)<1e-6,'energy carries contingency and margin');
assert.ok(Math.abs((c0.cost-co.cost)-c0.energyCharge*cont)<1e-6);
assert.ok(Math.abs(sum(c0.groups.map(g=>g.price))-c0.price)<1e-6,'group prices add up with energy in');
const days=sum(st.phases.map(p=>p.days));
const fee=structuredClone(st);fee.kit.fee=true;fee.kit.feeAmount=120;const cf=calculate(fee);
assert.equal(cf.kitFee,120*days);assert.ok(Math.abs(cf.price-(c0.price+120*days))<1e-6,'fee is added after margin');assert.ok(Math.abs(cf.profit-(c0.profit+120*days))<1e-6);assert.equal(cf.cost,c0.cost,'fee is not a cost');
assert.ok(Math.abs(sum(cf.groups.map(g=>g.price))+cf.kitFee-cf.price)<1e-6);assert.ok(Math.abs(cf.unallocated)<1e-6);
const ev=structuredClone(fee);ev.kit.feeBasis='event';ev.kit.feeAmount=900;assert.equal(calculate(ev).kitFee,900);
const bothOff=structuredClone(st);bothOff.kit.energy=false;assert.equal(calculate(bothOff).kitFee,0);
const z=structuredClone(fee);z.phases.forEach(p=>p.days=0);assert.equal(calculate(z).kitFee,0,'no days, no per-day fee');
// energy follows the food: burgers and fried chicken sit in stages that serve them
const build=calculate(st).groups.filter(g=>g.pi===0),live=calculate(st).groups.filter(g=>g.pi===1);
assert.ok(build.length&&live.length);
// client quote: fee is its own row and rows add up to the total
const t2=calculate(fee,'two'),t3=calculate(fee,'three'),q=clientQuote(fee,cf,t2,t3);
assert.equal(q.fee,120*days);assert.ok(Math.abs(sum(q.phases.map(p=>p.price))+q.fee-q.net)<1e-9,'stages + fee = total');
const html=renderClientQuote(fee,cf,t2,t3,{esc:x=>String(x),fmt:n=>'£'+n.toFixed(2),whole:n=>String(Math.round(n)),today:'2026-11-05'});
assert.ok(html.includes('Kitchen equipment fee')&&!html.toLowerCase().includes('gas'),'client sees the fee line, never our gas costs');
assert.ok(!renderClientQuote(st,c0,calculate(st,'two'),calculate(st,'three'),{esc:x=>String(x),fmt:n=>'£'+n.toFixed(2),whole:n=>String(Math.round(n)),today:'2026-11-05'}).includes('Kitchen equipment fee'));
// plans without kit settings get defaults; bad values are refused
const old=structuredClone(st);delete old.kit;validate(old);assert.deepEqual(old.kit,DEFAULT.kit);
const bad=structuredClone(st);bad.kit.feeBasis='week';assert.throws(()=>validate(bad));
const bad2=structuredClone(st);bad2.kit.feeAmount=-5;assert.throws(()=>validate(bad2));
}
console.log('kit charge tests passed');
// Granular options: each option can apply to some stages only, with its own amount
{const st=structuredClone(DEFAULT),all=calculate(st),F=17,C=19,D=18;
assert.deepEqual(st.optionStages.fruit,[true,true,true]);
const noLive=structuredClone(st);noLive.optionStages.fruit[1]=false;const nl=calculate(noLive);
const liveDays=structuredClone(st);liveDays.phases[1].days=0;
assert.ok(Math.abs(nl.servings[F]-calculate(liveDays).servings[F])<1e-9,'fruit off in Live = fruit only in Build and Break');
assert.ok(nl.servings[F]<all.servings[F]&&nl.servings[F]>0);assert.equal(nl.servings[18],all.servings[18],'other options unchanged');
assert.ok(nl.price<all.price);
const none=structuredClone(st);none.optionStages.fruit=[false,false,false];const off=structuredClone(st);off.options.fruit=false;
assert.equal(calculate(none).price,calculate(off).price,'no stages ticked = option off');
const cerBuild=structuredClone(st);cerBuild.optionStages.cereal=[true,false,false];const cb=calculate(cerBuild);
const buildBreakfasts=sum(all.groups.filter(g=>g.pi===0).map(g=>g.breakfast));assert.ok(Math.abs(cb.servings[C]-buildBreakfasts*st.settings.cereal)<1e-9,'cereal in Build only');
const qty=structuredClone(st);qty.settings.fruit=1;assert.ok(Math.abs(calculate(qty).servings[F]-all.servings[F]/2)<1e-9,'amount scales the servings');
const noDrinks=structuredClone(st);noDrinks.optionStages.drinks=[false,false,false];assert.equal(calculate(noDrinks).energy.find(e=>e.key==='urn').units,0,'no drinks, no urn');
assert.ok(calculate(noDrinks).consumables<all.consumables,'cups follow the drinks stages');
// client quote says which stages
const t2=calculate(noLive,'two'),t3=calculate(noLive,'three'),h={esc:x=>String(x),fmt:n=>'£'+n.toFixed(2),whole:n=>String(Math.round(n)),today:'2026-11-05'};
assert.ok(renderClientQuote(noLive,nl,t2,t3,h).includes('Fresh fruit (Build &amp; Break only)')||renderClientQuote(noLive,nl,t2,t3,h).includes('Fresh fruit (Build & Break only)'));
assert.ok(renderClientQuote(st,all,calculate(st,'two'),calculate(st,'three'),h).includes('Fresh fruit<'),'all stages: no suffix');
// old plans and bad values
const old=structuredClone(st);delete old.optionStages;validate(old);assert.deepEqual(old.optionStages,DEFAULT.optionStages);
const bad=structuredClone(st);bad.optionStages.fruit=[true,true];assert.throws(()=>validate(bad));
const bad2=structuredClone(st);bad2.optionStages.salads=[1,1,1];assert.throws(()=>validate(bad2));
}
console.log('granular option tests passed');
// Hot drinks: a simple number of drinks per person per day
{const st=structuredClone(DEFAULT),c0=calculate(st);
assert.equal(st.settings.drinks,5);assert.equal(st.recipes[18].name,'Hot drinks');
assert.equal(Math.round(c0.servings[18]),Math.round(c0.pd*5),'one serving per drink');
const six=structuredClone(st);six.settings.drinks=6;assert.ok(Math.abs(calculate(six).servings[18]-c0.servings[18]*1.2)<1e-6,'scales with the number of drinks');
const zero=structuredClone(st);zero.settings.drinks=0;assert.equal(calculate(zero).servings[18],0);
assert.ok(c0.recipeCosts[18]>0.05&&c0.recipeCosts[18]<0.12,'about 7p a cup');
const cups=structuredClone(st);cups.settings.cups=0.1;assert.ok(calculate(cups).consumables>c0.consumables,'cup cost per drink');
assert.ok(Math.abs(c0.price-27249.474)<0.01,'same price as the old allowance model');
// upgrade from version 3 (drinks was an allowance, 1 = 5 drinks; cups was per allowance)
const v3=structuredClone(st);v3.version=3;v3.settings.drinks=1;v3.settings.cups=0.25;v3.recipes[18]={...v3.recipes[18],name:'Hot drinks allowance',lines:[{ingredient:32,qty:0.006},{ingredient:33,qty:2},{ingredient:19,qty:0.15},{ingredient:20,qty:0.05},{ingredient:22,qty:0.02}]};v3.equipment.find(e=>e.key==='urn').perHour=40;
const m=migrate(v3);validate(m);assert.equal(m.version,4);assert.equal(m.settings.drinks,5);assert.ok(Math.abs(m.settings.cups-0.05)<1e-12);assert.equal(m.recipes[18].name,'Hot drinks');
assert.ok(Math.abs(calculate(m).price-c0.price)<0.01,'upgrading does not change the price');
const v3b=structuredClone(v3);v3b.settings.drinks=2;const mb=migrate(v3b);assert.equal(mb.settings.drinks,10,'an edited allowance is converted');
// older versions are converted too
const v2=structuredClone(v3);v2.version=2;delete v2.equipment;['gas','electric','serviceHours','load'].forEach(k=>delete v2.settings[k]);v2.recipes.forEach(r=>delete r.equipment);const m2=migrate(v2);validate(m2);assert.equal(m2.settings.drinks,5);
}
console.log('hot drinks tests passed');
// Team earnings
{const st=structuredClone(DEFAULT),c=calculate(st),t=c.team,role=n=>t.roles.find(r=>r.name===n);
assert.ok(Math.abs(t.total-c.labour)<1e-9,'team cost equals the labour in the quote');
assert.ok(Math.abs(t.gross*(1+st.settings.oncost/100)-t.total)<1e-9);assert.ok(Math.abs(t.oncost-(t.total-t.gross))<1e-9);
assert.equal(t.gross,7850);assert.equal(role('Lead cook').perPerson,10*17*17,'lead cook: 10h x 17 x 17 days');
assert.equal(role('Cook').perPerson,8*17*17);assert.equal(role('Cook').total,17*8*20,'cooks: 1 in build, 2 in live, 1 in break');assert.equal(role('Cook').people,2);
assert.equal(role('Kitchen assistant').perPerson,8*14*17,'assistant is on 14 an hour');
assert.ok(Math.abs(t.roles.reduce((a,r)=>a+r.total,0)-t.gross)<1e-9,'roles add up to the total');
assert.ok(Math.abs(t.stages.reduce((a,x)=>a+x.total,0)-t.total)<1e-9,'stages add up to the total');
assert.equal(t.paidHours,sum(st.phases.map(p=>sum(p.staff.map(r=>r.people*r.hours))*p.days)));
const rise=structuredClone(st);rise.phases.forEach(p=>p.staff.forEach(r=>{if(r.name==='Cook')r.rate=20}));assert.ok(calculate(rise).team.gross>t.gross);assert.equal(calculate(rise).team.roles.find(r=>r.name==='Cook').perPerson,8*20*17);
const mixed=structuredClone(st);mixed.phases[1].staff.find(r=>r.name==='Cook').rate=19;const mr=calculate(mixed).team.roles.find(r=>r.name==='Cook');assert.equal(mr.rateMin,17);assert.equal(mr.rateMax,19,'rate range when it differs by stage');
const none=structuredClone(st);none.phases.forEach(p=>p.days=0);assert.equal(calculate(none).team.gross,0);assert.equal(calculate(none).team.roles.length,0);
const bad=structuredClone(st);bad.recipes.slice(0,4).forEach(r=>r.weight=0);assert.equal(calculate(bad).team.gross,7850,'team pay still shows when the menu has a warning');
import('./dist/team.mjs').then(({renderTeam})=>{const h={esc:x=>String(x),fmt:n=>'£'+n.toFixed(2),whole:n=>String(Math.round(n))};const html=renderTeam(st,c,h);assert.ok(html.includes('Lead cook')&&html.includes('£2890.00')&&html.includes('Total team cost'));assert.ok(renderTeam(none,calculate(none),h).includes('No staff set up yet'));console.log('team view tests passed');});
}
console.log('team tests passed');
