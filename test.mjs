import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DEFAULT} from './dist/data.mjs';import {validate,migrate} from './dist/plan.mjs';import {foodGroups} from './dist/charts.mjs';import{calculate,sum}from'./dist/model.mjs';
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
const m=migrate(old);validate(m);assert.equal(m.version,6);assert.equal(m.name,'Old plan');assert.equal(m.phases[0].staff[0].rate,17);assert.ok(m.phases[0].groups.every(g=>g.extras));assert.equal(m.recipes.length,22);
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
const m2=migrate(old2);validate(m2);assert.equal(m2.version,6);assert.equal(m2.name,'Kept name');assert.equal(m2.recipes[0].weight,77);assert.equal(m2.recipes[10].name,'Fried chicken and fries');assert.ok(m2.equipment.length===4);
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
assert.ok(Math.abs(c0.price-26392.73)<0.01,'default price');
// upgrade from version 3 (drinks was an allowance, 1 = 5 drinks; cups was per allowance)
const v3=structuredClone(st);v3.version=3;v3.settings.drinks=1;v3.settings.cups=0.25;v3.recipes[18]={...v3.recipes[18],name:'Hot drinks allowance',lines:[{ingredient:32,qty:0.006},{ingredient:33,qty:2},{ingredient:19,qty:0.15},{ingredient:20,qty:0.05},{ingredient:22,qty:0.02}]};v3.equipment.find(e=>e.key==='urn').perHour=40;
const m=migrate(v3);validate(m);assert.equal(m.version,6);assert.equal(m.settings.drinks,5);assert.ok(Math.abs(m.settings.cups-0.05)<1e-12);assert.equal(m.recipes[18].name,'Hot drinks');
assert.ok(Math.abs(calculate(m).price-c0.price)<0.01,'upgrading does not change the price');
const v3b=structuredClone(v3);v3b.settings.drinks=2;const mb=migrate(v3b);assert.equal(mb.settings.drinks,10,'an edited allowance is converted');
// older versions are converted too
const v2=structuredClone(v3);v2.version=2;delete v2.equipment;['gas','electric','serviceHours','load'].forEach(k=>delete v2.settings[k]);v2.recipes.forEach(r=>delete r.equipment);const m2=migrate(v2);validate(m2);assert.equal(m2.settings.drinks,5);
}
console.log('hot drinks tests passed');
// Salads: a salad menu, two on every lunch and dinner
{const st=structuredClone(DEFAULT),c0=calculate(st),S=[16,20,21],sv=c=>sum(S.map(i=>c.servings[i])),cost=i=>c0.recipeCosts[i];
assert.deepEqual(S.map(i=>st.recipes[i].name),['Leaf salad','Everything salad','Coleslaw']);assert.ok(S.every(i=>st.recipes[i].type==='Salad'));assert.equal(st.settings.salads,2,'two salads on every meal');
const mains=sum(c0.groups.map(g=>g.mains));assert.ok(Math.abs(sv(c0)-mains*2)<1e-6,'two salads per lunch and dinner cover');
assert.ok(Math.abs(c0.servings[16]/sv(c0)-0.40)<1e-9,'leaf salad is 40% of the mix');assert.ok(Math.abs(c0.servings[21]/sv(c0)-0.30)<1e-9);
assert.ok(cost(16)<cost(21)&&cost(21)<cost(20),'leaf < coleslaw < everything salad');for(const i of S)assert.ok(cost(i)>0.03&&cost(i)<0.5,st.recipes[i].name+' is an affordable salad');
const avg=sum(S.map(i=>c0.servings[i]*cost(i)))/sv(c0);assert.ok(avg>0.1&&avg<0.3,'about 18p a salad');
assert.ok(c0.shopping.find(i=>i.id===54).packs>0,'coleslaw buys mayonnaise');assert.ok(st.ingredients.find(i=>i.id===54).status.startsWith('Estimate'));
const one=structuredClone(st);one.settings.salads=1;assert.ok(Math.abs(sv(calculate(one))-mains)<1e-6,'one salad per meal');
const off=structuredClone(st);off.options.salads=false;assert.equal(sv(calculate(off)),0);assert.ok(calculate(off).price<c0.price);
const noLive=structuredClone(st);noLive.optionStages.salads[1]=false;const nl=calculate(noLive);const liveMains=sum(c0.groups.filter(g=>g.pi===1).map(g=>g.mains));assert.ok(Math.abs(sv(nl)-(mains-liveMains)*2)<1e-6,'no salads in Live');
const slawOnly=structuredClone(st);[16,20].forEach(i=>slawOnly.recipes[i].weight=0);const so=calculate(slawOnly);assert.ok(Math.abs(so.servings[21]-mains*2)<1e-6&&so.servings[16]===0,'only coleslaw');assert.ok(so.price!==c0.price);
const buildSlaw=structuredClone(st);buildSlaw.recipes[21].phases=[true,false,false];const bs=calculate(buildSlaw);assert.ok(bs.servings[21]>0&&bs.servings[21]<c0.servings[21],'coleslaw only in Build');assert.ok(Math.abs(sv(bs)-mains*2)<1e-6,'other salads fill in');
const none=structuredClone(st);S.forEach(i=>none.recipes[i].weight=0);const nn=calculate(none);assert.ok(nn.errors.some(e=>e.startsWith('Salads in Build')));assert.ok(Number.isNaN(nn.price));const nn2=structuredClone(none);nn2.options.salads=false;assert.equal(calculate(nn2).errors.length,0,'no menu is fine when salads are off');
const fg=foodGroups(st,c0);assert.ok(fg.some(g=>g.label==='Salads'&&g.value>0));assert.ok(Math.abs(sum(fg.map(g=>g.value))-c0.food)<1e-6,'food by meal adds up');
const html=renderClientQuote(st,c0,calculate(st,'two'),calculate(st,'three'),{esc:x=>String(x),fmt:n=>'£'+n.toFixed(2),whole:n=>String(Math.round(n)),today:'2026-11-05'});assert.ok(html.includes('Two salads with every lunch and dinner (leaf salad, everything salad, coleslaw)'));
// upgrade from version 4 (one Big salads recipe)
const v4=structuredClone(st);v4.version=4;v4.ingredients=v4.ingredients.filter(i=>i.id!==54);v4.recipes=v4.recipes.slice(0,20);v4.recipes[16]={id:16,type:'Extra',key:'salad',name:'Big salads',note:'old',weight:0,phases:[true,true,true],equipment:[],lines:[{ingredient:28,qty:0.05}]};v4.settings.salads=1;
const m=migrate(v4);validate(m);assert.equal(m.version,6);assert.equal(m.recipes.length,22);assert.equal(m.recipes[16].name,'Leaf salad');assert.equal(m.recipes[20].name,'Everything salad');assert.equal(m.recipes[21].name,'Coleslaw');assert.equal(m.settings.salads,2,'one big salad becomes two salads');assert.ok(m.ingredients.some(i=>i.id===54&&i.name==='Mayonnaise'));
assert.ok(Math.abs(calculate(m).price-c0.price)<0.01,'a migrated default plan prices the same as a new one');
const v4b=structuredClone(v4);v4b.settings.salads=3;assert.equal(migrate(v4b).settings.salads,3,'a changed amount is kept');
const v4c=structuredClone(v4);v4c.ingredients.push({...v4c.ingredients[0],id:54,name:'My custom item'});v4c.recipes[2].lines.push({ingredient:54,qty:0.1});const mc=migrate(v4c);validate(mc);const custom=mc.ingredients.find(i=>i.name==='My custom item');assert.ok(custom.id!==54,'custom item moved to a free id');assert.ok(mc.recipes[2].lines.some(l=>l.ingredient===custom.id),'its recipe line still points at it');assert.equal(mc.ingredients.find(i=>i.id===54).name,'Mayonnaise');
const v5=structuredClone(st);v5.version=5;v5.recipes[20]={...v5.recipes[20],key:'tomato-cucumber-salad',name:'Tomato and cucumber salad'};v5.recipes[16].weight=35;v5.recipes[21].weight=25;v5.recipes.push({id:22,type:'Salad',key:'carrot-salad',name:'Shredded carrot salad',note:'',weight:15,phases:[true,true,true],equipment:[],lines:[{ingredient:7,qty:0.08}]});
const m5=migrate(v5);validate(m5);assert.equal(m5.version,6);assert.equal(m5.recipes.length,22);assert.deepEqual([16,20,21].map(i=>m5.recipes[i].name),['Leaf salad','Everything salad','Coleslaw']);assert.equal(m5.recipes[16].weight,40,'untouched default weights follow the new menu');assert.ok(Math.abs(calculate(m5).price-c0.price)<0.01,'a migrated default plan prices the same as a new one');
const v5b=structuredClone(v5);v5b.recipes[16].weight=70;v5b.recipes[21].weight=10;const m5b=migrate(v5b);assert.equal(m5b.recipes[16].weight,70,'changed weights are kept');assert.equal(m5b.recipes[21].weight,10);
const again=migrate(migrate(v4));assert.equal(again.ingredients.filter(i=>i.id===54).length,1,'migrating twice does not duplicate');
// older versions upgrade through every step
const v3=structuredClone(v4);v3.version=3;v3.settings.drinks=1;v3.settings.cups=0.25;const m3=migrate(v3);validate(m3);assert.equal(m3.version,6);assert.equal(m3.recipes.length,22);
}
console.log('salad tests passed');
// Ingredient crossover
import('./dist/crossover.mjs').then(X=>{
const st=structuredClone(DEFAULT),c=calculate(st),x=X.crossover(st,c);
assert.equal(x.recipes.length,st.recipes.filter((_,i)=>c.servings[i]>0).length,'every served meal is ranked');assert.deepEqual(x.recipes.map(r=>r.rank),x.recipes.map((_,i)=>i+1));
for(let i=1;i<x.recipes.length;i++)assert.ok(x.recipes[i-1].sharedPct>=x.recipes[i].sharedPct-1e-9,'best first');
const by=n=>x.recipes.find(r=>r.name===n),ing=n=>x.ingredients.find(i=>i.name===n);
assert.equal(by('Leaf salad').sharedPct,100,'leaf salad only uses shared ingredients');assert.ok(by('Coleslaw').sharedPct<by('Everything salad').sharedPct,'coleslaw is the least efficient salad');
assert.deepEqual(by('Coleslaw').solo.sort(),['Cabbage','Mayonnaise'],'cabbage and mayonnaise are only in coleslaw');assert.deepEqual(by('Everything salad').solo,['Salad tomatoes']);
assert.ok(ing('Lettuce').recipeCount>=3&&ing('Lettuce').recipes.includes('Leaf salad')&&ing('Lettuce').recipes.includes('Beef burger and fries'),'lettuce is used by salads and burgers');
assert.equal(ing('Bacon rashers').recipeCount,2,'bacon is shared by the bacon bap and the carbonara');assert.equal(by('Bacon bap').sharedPct,100);
for(let i=1;i<x.ingredients.length;i++)assert.ok(x.ingredients[i-1].recipeCount>=x.ingredients[i].recipeCount,'most shared ingredients first');
assert.ok(x.sharedPct>0&&x.sharedPct<100);assert.ok(Math.abs(x.spend-sum(c.shopping.map(i=>i.spend)))<1e-6,'spend matches the shopping list');assert.ok(x.leftover>0);
assert.ok(x.wins.length<=3&&x.wins.every(w=>w.leftover>=X.WIN_MIN_LEFTOVER),'tips are worth having');assert.ok(x.wins.every(w=>!['Instant coffee','Tea bags','Apples','Cereal variety'].includes(w.name)),'no tips about drinks, fruit or cereal, which are bought in bulk anyway');assert.ok(x.wins.some(w=>w.name==='Beef burgers'),'but a burger-only ingredient is a real tip');
// using tomatoes in the burgers makes them shared, and the tip and the solo list update
const tom=structuredClone(st);const tid=st.ingredients.find(i=>i.name==='Salad tomatoes').id;tom.recipes[14].lines.push({ingredient:tid,qty:0.03});const xt=X.crossover(tom,calculate(tom));
assert.equal(xt.recipes.find(r=>r.name==='Everything salad').solo.length,0,'tomatoes now shared');assert.ok(xt.recipes.find(r=>r.name==='Everything salad').sharedPct>by('Everything salad').sharedPct);assert.equal(xt.ingredients.find(i=>i.name==='Salad tomatoes').recipeCount,2);
// meals that are not served are not counted
const noBurger=structuredClone(st);noBurger.recipes[14].phases=[false,false,false];noBurger.recipes[15].phases=[false,false,false];const xb=X.crossover(noBurger,calculate(noBurger));assert.ok(!xb.recipes.some(r=>r.name.includes('burger')));assert.equal(xb.ingredients.find(i=>i.name==='Lettuce').recipes.includes('Beef burger and fries'),false);
const h={esc:s=>String(s),fmt:n=>'£'+n.toFixed(2),whole:n=>String(Math.round(n))};const html=X.renderCrossover(st,c,h);assert.ok(html.includes('Meal ranking')&&html.includes('Coleslaw')&&html.includes('Easy wins')&&html.includes('Show the other'));
const bad=structuredClone(st);bad.recipes.slice(0,4).forEach(r=>r.weight=0);assert.ok(X.renderCrossover(bad,calculate(bad),h).includes('Fix the menu'));
console.log('crossover tests passed');
});
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
// Rota maker
import('./dist/rota.mjs').then(R=>{
const st=structuredClone(DEFAULT);st.rota=R.defaultRota(st);const c=calculate(st);
assert.deepEqual(st.rota.people.map(p=>p.name),['Lead cook','Cook 1','Cook 2','Kitchen assistant 1','Kitchen assistant 2']);
assert.deepEqual(st.rota.people[2].stages,[false,true,false],'second cook is only on site for Live');
assert.deepEqual(st.rota.days.map(d=>d.length),[10,3,4],'one rota day per stage day');
R.checkRota(st.rota);
for(const d of st.rota.days)for(const day of d)for(const sh of Object.values(day))assert.ok(sh.every(x=>x===0||x===4||x===6),'only 4 or 6 hour shifts');
const sm=R.rotaSummary(st);
assert.equal(sm.hours,c.team.paidHours,'default rota hours match the costed hours');assert.ok(Math.abs(sm.pay-c.team.gross)<1e-9,'default rota pay matches the quote');
assert.equal(sm.people[0].stages[0].hours,100,'lead cook: 10 hours a day for 10 days');
// every service has cover on a normal day
for(let si=0;si<3;si++)assert.ok(st.rota.people.some(p=>p.stages[1]&&R.dayEntry(st.rota,1,0)[p.id][si]>0),'service '+si+' is covered in Live');
// shift times
assert.equal(R.shiftTimes(0,4),'6am to 10am');assert.equal(R.shiftTimes(0,6),'6am to 12pm');assert.equal(R.shiftTimes(1,4),'10am to 2pm');assert.equal(R.shiftTimes(1,6),'10am to 4pm');assert.equal(R.shiftTimes(2,4),'4pm to 8pm');assert.equal(R.shiftTimes(2,6),'4pm to 10pm');assert.equal(R.shiftTimes(0,0),'');
// flags
assert.equal(R.dayFlags([6,4,0]).overlap,true,'6 hour breakfast runs into lunch');assert.equal(R.dayFlags([4,6,0]).overlap,false);assert.equal(R.dayFlags([0,6,4]).overlap,false);assert.equal(R.dayFlags([6,0,6]).long,true);assert.equal(R.dayFlags([4,6,0]).long,false);
// editing
const e=structuredClone(st);const lead=e.rota.people[0].id;
R.setShift(e,0,2,lead,0,6);assert.deepEqual(R.dayEntry(e.rota,0,2)[lead],[6,6,0]);assert.deepEqual(R.dayEntry(e.rota,0,3)[lead],[4,6,0],'other days unchanged');
R.setShift(e,0,2,lead,0,5);assert.deepEqual(R.dayEntry(e.rota,0,2)[lead],[6,6,0],'a 5 hour shift is refused');
R.copyDayToAll(e,0,2);assert.ok(e.rota.days[0].every(d=>d[lead][0]===6),'copied to every day');
R.clearDay(e,0,1);assert.deepEqual(e.rota.days[0][1],{});R.copyDayTo(e,0,0,1);assert.deepEqual(e.rota.days[0][1][lead],[6,6,0]);
const longer=structuredClone(st);longer.phases[0].days=12;assert.deepEqual(R.dayEntry(longer.rota,0,11),R.dayEntry(longer.rota,0,9),'extra days use the last saved day');
R.setShift(longer,0,11,lead,2,4);assert.equal(longer.rota.days[0].length,12);assert.equal(R.dayEntry(longer.rota,0,10)[lead][2],0);
// people
const p=structuredClone(st);R.addPerson(p);assert.equal(p.rota.people.length,6);assert.equal(new Set(p.rota.people.map(x=>x.id)).size,6);validate(p);
R.removePerson(p,0);assert.equal(p.rota.people.length,5);assert.ok(p.rota.days.every(l=>l.every(d=>!(lead in d))),'removed person leaves the rota');validate(p);
const unknown=structuredClone(st);unknown.rota.people[0].role='Pastry chef';const us=R.rotaSummary(unknown);assert.deepEqual(us.noRate,['Lead cook']);assert.equal(us.people[0].pay,0);
// apply to costs
const a=structuredClone(st);R.copyDayToAll(a,0,0);R.setShift(a,0,0,lead,1,0);R.setShift(a,0,0,lead,2,0);R.setShift(a,0,0,lead,0,6);R.copyDayToAll(a,0,0);
const ap=R.applyRotaToCosts(a);assert.ok(ap.changed>0);
const ca=calculate(a),sa=R.rotaSummary(a);assert.ok(Math.abs(ca.team.gross-sa.pay)<1e-6,'after applying, the quote pay equals the rota pay');assert.ok(Math.abs(ca.team.paidHours-sa.hours)<1e-6);
assert.equal(a.phases[0].staff.find(r=>r.name==='Lead cook').hours,6,'lead cook now 6 hours a day in Build');
assert.ok(ca.price<c.price,'fewer paid hours lowers the price');
const idle=structuredClone(st);idle.rota.people.forEach(x=>{x.stages[2]=false});const before=structuredClone(idle.phases[2].staff);R.applyRotaToCosts(idle);assert.deepEqual(idle.phases[2].staff,before,'a stage with no rota people is left alone');
const miss=structuredClone(unknown),costBefore=structuredClone(miss.phases);const am=R.applyRotaToCosts(miss);assert.deepEqual(am.skipped,['Pastry chef'],'a role with no costing line is skipped and reported');assert.ok(am.message.includes('Pastry chef'));assert.equal(miss.phases[0].staff.length,costBefore[0].staff.length,'no costing lines are invented');
// validation and old plans
const old=structuredClone(DEFAULT);delete old.rota;validate(old);assert.equal(old.rota.people.length,5,'plans without a rota get one from the costed team');
for(const mut of [x=>{x.rota.days[0][0][x.rota.people[0].id]=[5,0,0]},x=>{x.rota.people[1].id=x.rota.people[0].id},x=>{x.rota.days=[[],[]]},x=>{x.rota.people[0].stages=[true]},x=>{x.rota.days[0][0].nobody=[0,0,0]}]){const b=structuredClone(st);mut(b);assert.throws(()=>validate(b));}
// rendering
const html=R.renderRota(st,c,{phase:1,day:0,tabs:'<div class="phase-tabs"></div>'},{esc:x=>String(x),fmt:n=>'£'+n.toFixed(2),whole:n=>String(Math.round(n))});
assert.equal((html.match(/data-rota=/g)||[]).length,5*3,'5 people on site in Live, 3 services each');
assert.ok(html.includes('Day 1')&&html.includes('Breakfast')&&html.includes('6am to 10am')&&html.includes('Use this rota in the quote'));
const none=structuredClone(st);none.phases[1].days=0;assert.ok(R.renderRota(none,calculate(none),{phase:1,day:0,tabs:''},{esc:x=>String(x),fmt:n=>'£'+n.toFixed(2),whole:n=>String(Math.round(n))}).includes('has no days'));
console.log('rota tests passed');
});
// Branding, saved quotes and the PDF
Promise.all([import('./dist/brand.mjs'),import('./dist/quotes.mjs'),import('./dist/pdf.mjs'),import('./dist/vendor/jspdf.umd.min.js')]).then(([B,Q,P])=>{
const {jsPDF}=globalThis.jspdf;
// brand
assert.deepEqual(B.cleanBrand(null),B.BRAND_DEFAULT);assert.equal(B.cleanBrand({colour:'red'}).colour,B.BRAND_DEFAULT.colour);assert.equal(B.cleanBrand({colour:'#ABCDEF'}).colour,'#abcdef');
assert.equal(B.cleanBrand({company:'   '}).company,'Crew Table');assert.equal(B.cleanBrand({company:'x'.repeat(200)}).company.length,80);
const png='data:image/png;base64,iVBORw0KGgo=';assert.equal(B.cleanBrand({logo:png,logoRatio:3}).logo,png);assert.equal(B.cleanBrand({logo:'data:text/html;base64,AAAA',logoRatio:3}).logo,'','only images');assert.equal(B.cleanBrand({logo:'javascript:alert(1)',logoRatio:3}).logo,'');assert.equal(B.cleanBrand({logo:png}).logo,'','a logo needs its shape');assert.equal(B.cleanBrand({logo:'data:image/png;base64,'+'A'.repeat(B.LOGO_MAX_CHARS),logoRatio:3}).logo,'','too big');
assert.equal(B.tint('#000000',0.5),'#808080');assert.equal(B.tint('#245946',1),'#ffffff');assert.equal(B.contrastText('#245946'),'#ffffff');assert.equal(B.contrastText('#f2c14e'),'#1f2a2d');
// saved quotes
const st=structuredClone(DEFAULT);st.client={...CLIENT_DEFAULT,clientName:'Wildfield'};const t0=Date.parse('2026-11-05T10:00:00Z');
let lib=Q.emptyLibrary();const r1=Q.saveQuote(lib,st,{id:null,now:t0,rand:0.5});assert.equal(r1.lib.quotes.length,1);assert.equal(r1.entry.client,'Wildfield');assert.equal(r1.entry.event,st.name);
st.name='Changed after saving';assert.equal(r1.entry.plan.name,'Festival crew catering','a saved quote is a copy');
const r2=Q.saveQuote(r1.lib,st,{id:r1.entry.id,now:t0+60000,rand:0.1});assert.equal(r2.lib.quotes.length,1,'saving again updates');assert.equal(r2.entry.id,r1.entry.id);assert.equal(r2.lib.quotes[0].plan.name,'Changed after saving');
const r3=Q.saveQuote(r2.lib,st,{id:'gone',now:t0+120000,rand:0.9});assert.equal(r3.lib.quotes.length,2,'an unknown id adds a new quote');assert.notEqual(r3.entry.id,'gone');
const d=Q.duplicateQuote(r3.lib,r1.entry.id,{now:t0+180000,rand:0.3});assert.equal(d.lib.quotes.length,3);assert.ok(d.entry.event.endsWith('(copy)'));assert.equal(d.entry.plan.client.reference,'');assert.notEqual(d.entry.id,r1.entry.id);assert.equal(Q.duplicateQuote(d.lib,'nope',{now:t0,rand:0}).entry,null);
assert.equal(Q.deleteQuote(d.lib,d.entry.id).quotes.length,2);
assert.equal(Q.newestFirst(d.lib)[0].id,d.entry.id,'newest first');assert.equal(Q.searchQuotes(d.lib,'WILD').length,3);assert.equal(Q.searchQuotes(d.lib,'copy').length,1);assert.equal(Q.searchQuotes(d.lib,'zzz').length,0);
const inc={quotes:[{...r1.entry,savedAt:'2030-01-01T00:00:00.000Z',event:'Newer'},{...d.entry,id:'q-brand-new'}]};const mg=Q.mergeLibrary(r1.lib,inc);assert.equal(mg.added,1);assert.equal(mg.updated,1);assert.equal(mg.lib.quotes.length,2);assert.equal(Q.mergeLibrary(mg.lib,{quotes:[{...r1.entry,savedAt:'2000-01-01T00:00:00.000Z'}]}).updated,0,'older saves do not overwrite');
assert.equal(Q.cleanLibrary({quotes:[{id:'ok',plan:{}},{id:'ok',plan:{}},{id:'bad id!',plan:{}},{id:'noplan'},null,'x']}).quotes.length,1,'bad entries are dropped');assert.equal(Q.cleanLibrary('junk').quotes.length,0);
assert.equal(Q.backupFile(lib,B.BRAND_DEFAULT).type,'crew-table-quotes');assert.equal(Q.displayName({client:'',event:'E'}),'E');assert.equal(Q.displayName({client:'',event:''}),'Untitled quote');
assert.equal(Q.agoText('2026-11-05T10:00:00Z',t0+20000),'just now');assert.equal(Q.agoText('2026-11-05T10:00:00Z',t0+5*60000),'5 min ago');assert.equal(Q.agoText('2026-11-05T10:00:00Z',t0+3*3600000),'3 hrs ago');assert.equal(Q.agoText('2026-11-05T10:00:00Z',t0+86400000),'1 day ago');
// PDF
class Raw extends jsPDF{constructor(o){super({...o,compress:false});}}
const pdf=(mut,brand={})=>{const s=structuredClone(DEFAULT);s.client={...CLIENT_DEFAULT,clientName:'Wildfield Festival Ltd',reference:'Q-9'};validate(s);if(mut)mut(s);const c=calculate(s);const doc=P.buildQuotePdf(Raw,s,c,calculate(s,'two'),calculate(s,'three'),brand,'2026-11-05');return {doc,raw:Buffer.from(doc.output('arraybuffer')).toString('latin1'),c,s};};
let a=pdf();assert.ok(a.doc.getNumberOfPages()>=1&&a.doc.getNumberOfPages()<=2,'one or two pages');assert.ok(a.raw.startsWith('%PDF-'));
for(const t of ['Wildfield Festival Ltd','Q-9','Total to pay',(()=>{const net=Math.round(a.c.price*100)/100,vat=Math.round(net*0.2*100)/100;return (Math.round((net+vat)*100)/100).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});})(),'Bacon bap','Beef burger and fries \\(Build only\\)','APPROVAL','SIGNATURE','Page 1 of '+a.doc.getNumberOfPages()])assert.ok(a.raw.includes(t),'pdf has '+t);
assert.ok(!a.raw.includes('Kitchen equipment fee'),'no fee line unless charged');assert.ok(!/gas|electric|profit|margin|contingency|labour/i.test(a.raw.replace(/\/[A-Za-z]+/g,'')),'client PDF shows no costs, energy or profit');
const fee=pdf(s=>{s.kit.fee=true;s.kit.feeAmount=100});assert.ok(fee.raw.includes('Kitchen equipment fee'));
const nv=pdf(s=>{s.client.vat=0});assert.ok(nv.raw.includes('TOTAL PRICE')&&!nv.raw.includes('VAT at'));
const noap=pdf(s=>{s.client.showApproval=false});assert.ok(!noap.raw.includes('SIGNATURE'));
const nomenu=pdf(s=>{s.client.showMenu=false});assert.ok(!nomenu.raw.includes('EXAMPLE MENU'));
const opts=pdf(s=>{s.client.showOptions=true});assert.ok(opts.raw.includes('Everyone on 2 meals'));
const long=pdf(s=>{s.client.notes='Please note the access arrangements. '.repeat(120);s.client.showOptions=true});assert.ok(long.doc.getNumberOfPages()>=2&&long.doc.getNumberOfPages()<=4,'long notes flow onto more pages');
const real='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';const lg=pdf(null,{company:'Wild Co',colour:'#b4472a',logo:real,logoRatio:3,tagline:'Fed and ready',contact:'a@b.example',footer:'Reg 123'});assert.ok(lg.raw.includes('/Subtype /Image'),'logo embedded');assert.ok(lg.raw.includes('Fed and ready')&&lg.raw.includes('Reg 123')&&lg.raw.includes('a@b.example'));
const broken=pdf(null,{company:'Broken Logo Co',logo:png,logoRatio:3});assert.ok(broken.raw.includes('Broken Logo Co')&&!broken.raw.includes('/Subtype /Image'),'an unreadable logo falls back to the company name');
const light=pdf(null,{colour:'#f2c14e'});assert.ok(light.doc.getNumberOfPages()>=1);
const wierd=pdf(s=>{s.name='Caf\u00e9 \u201CFest\u201D \u2013 \u4e2d\u6587';s.client.clientName='O\u2019Neil & Sons'});assert.ok(wierd.raw.includes("O'Neil & Sons"));assert.ok(wierd.raw.includes('Fest'));
assert.equal(P.clean('a\u2019b \u201Cc\u201D \u2013 \u2026 \u4e2d'),"a'b \"c\" - ... ?");
assert.equal(P.pdfFileName({client:{clientName:'Wild/field: Ltd'},name:'x'}),'Wild field Ltd - Catering quote.pdf');assert.equal(P.pdfFileName({client:{clientName:''},name:'My event'}),'My event - Catering quote.pdf');assert.ok(P.pdfFileName({client:{clientName:'x'.repeat(200)},name:'y'}).length<90);
assert.ok(P.money(1234.5)==='£1,234.50');
// the app loads the PDF tool from a file the service worker caches
const appSrc=fs.readFileSync('dist/app.mjs','utf8'),swSrc=fs.readFileSync('dist/sw.js','utf8');assert.ok(appSrc.includes("vendor/jspdf.umd.min.js")&&swSrc.includes("vendor/jspdf.umd.min.js")&&fs.existsSync('dist/vendor/jspdf.LICENSE'));
console.log('branding, quotes and pdf tests passed');
});
