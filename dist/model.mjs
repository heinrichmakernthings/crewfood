export const sum=a=>a.reduce((s,v)=>s+v,0);
export function calculate(s,mode='mixed'){
 const t=s.settings, kit={energy:true,fee:false,feeAmount:0,feeBasis:'day',...(s.kit||{})}, opt={fruit:true,drinks:true,cereal:true,salads:true,...(s.options||{})}, stg={...(s.optionStages||{})}, onIn=(r,pi)=>!r.phases||r.phases[pi]!==false, waste=1+t.waste/100, ing=new Map(s.ingredients.map(i=>[i.id,i]));
 const unit=i=>i.price/(i.pack*i.yield);
 const recipeCosts=s.recipes.map(r=>sum(r.lines.map(l=>l.qty*unit(ing.get(l.ingredient))))*waste);
 const breakfast=s.recipes.filter(r=>r.type==='Breakfast'), mains=s.recipes.filter(r=>r.type==='Main');
 const errors=[];
 let groups=[],phaseCosts=[],servings=s.recipes.map(()=>0),phaseServ=s.phases.map(()=>s.recipes.map(()=>0)),pd=0,meals=0,food=0,labour=0,consumables=0;
 for(let pi=0;pi<s.phases.length;pi++){
  const on=k=>!!opt[k]&&(!stg[k]||stg[k][pi]!==false), p=s.phases[pi], bw=sum(breakfast.filter(r=>onIn(r,pi)).map(r=>r.weight)),mw=sum(mains.filter(r=>onIn(r,pi)).map(r=>r.weight)), phasePD=sum(p.groups.map(g=>g.people*p.days));
  const staff=sum(p.staff.map(r=>r.people*r.hours*r.rate))*p.days*(1+t.oncost/100);
  labour+=staff;
  for(let gi=0;gi<p.groups.length;gi++){
   const g=p.groups[gi], flags=mode==='two'?[false,true,true]:mode==='three'?[true,true,true]:g.meals;
   const days=g.people*p.days, b=flags[0]?days:0, m=(+flags[1]+ +flags[2])*days;
   const share=(r,total,n)=>total&&onIn(r,pi)?n*r.weight/total:0;
   let portions=s.recipes.map(r=>r.type==='Breakfast'?share(r,bw,b):r.type==='Main'?share(r,mw,m):r.key==='salad'?(on('salads')?m*t.salads:0):r.key==='fruit'?(g.extras&&on('fruit')?days*t.fruit:0):r.key==='drinks'?(g.extras&&on('drinks')?days*t.drinks:0):r.key==='cereal'?(on('cereal')?b*t.cereal:0):0);
   if(b>0&&!bw&&!errors.some(e=>e.startsWith('Breakfast covers in '+p.name)))errors.push('Breakfast covers in '+p.name+' have no menu. Tick a breakfast for '+p.name+' and give it a positive weight.');
   if(m>0&&!mw&&!errors.some(e=>e.startsWith('Lunch / dinner covers in '+p.name)))errors.push('Lunch / dinner covers in '+p.name+' have no menu. Tick a main for '+p.name+' and give it a positive weight.');
   portions.forEach((v,i)=>{servings[i]+=v;phaseServ[pi][i]+=v;});
   const f=sum(portions.map((v,i)=>v*recipeCosts[i]));
   const c=(b+m)*t.disposables+(g.extras&&on('drinks')?days*t.drinks*t.cups:0);
   groups.push({portions,pi,gi,name:g.name,pd:days,meals:b+m,breakfast:b,mains:m,food:f,consumables:c,labour:phasePD?staff*days/phasePD:0,daily:phasePD?p.days*t.daily*days/phasePD:0});
   pd+=days;meals+=b+m;food+=f;consumables+=c;
  }
  phaseCosts.push({name:p.name,days:p.days,people:sum(p.groups.map(g=>g.people)),pd:phasePD,labour:staff});
 }
 const quantities=new Map(s.ingredients.map(i=>[i.id,0]));
 s.recipes.forEach((r,ri)=>r.lines.forEach(l=>quantities.set(l.ingredient,quantities.get(l.ingredient)+l.qty*servings[ri]*waste)));
 const shopping=s.ingredients.map(i=>{const needed=quantities.get(i.id),packs=Math.ceil(Math.max(0,needed/(i.pack*i.yield)-1e-10));return {...i,needed,packs,spend:packs*i.price,spare:packs*i.pack*i.yield-needed};});
 const energy=(s.equipment||[]).map(e=>{const users=s.recipes.map((r,i)=>(r.equipment||[]).includes(e.key)?i:-1).filter(i=>i>=0),portions=sum(users.map(i=>servings[i]));
  let hours=0,units=0;
  s.phases.forEach((p,pi)=>{if(!(p.days>0))return;const tot=type=>sum(users.filter(i=>s.recipes[i].type===type).map(i=>phaseServ[pi][i])),b=tot('Breakfast'),m=tot('Main'),x=tot('Extra'),services=(b>0?1:0)+(m>0?2:0)+(x>0?1:0);if(!services)return;
   const u=Math.max(1,e.perHour>0&&t.serviceHours>0?Math.ceil(Math.max(b/p.days,m/p.days/2)/(e.perHour*t.serviceHours)-1e-9):1);units=Math.max(units,u);hours+=p.days*u*e.hours*services;});
  const kwh=hours*e.kw*t.load,cost=kwh*(e.fuel==='gas'?t.gas:t.electric);
  return {...e,users,portions,hours,kwh,cost,units};});
 const recipeEnergy=s.recipes.map(()=>({gasKwh:0,elecKwh:0,cost:0}));
 energy.forEach(e=>e.users.forEach(i=>{const share=e.portions?servings[i]/e.portions:0;recipeEnergy[i][e.fuel==='gas'?'gasKwh':'elecKwh']+=e.kwh*share;recipeEnergy[i].cost+=e.cost*share;}));
 const energyTotals={kwh:sum(energy.map(e=>e.kwh)),cost:sum(energy.map(e=>e.cost)),gasKwh:sum(energy.filter(e=>e.fuel==='gas').map(e=>e.kwh)),gasCost:sum(energy.filter(e=>e.fuel==='gas').map(e=>e.cost)),elecKwh:sum(energy.filter(e=>e.fuel!=='gas').map(e=>e.kwh)),elecCost:sum(energy.filter(e=>e.fuel!=='gas').map(e=>e.cost))};
 energyTotals.allGas=energyTotals.kwh*t.gas;energyTotals.allElectric=energyTotals.kwh*t.electric;
 const purchased=sum(shopping.map(i=>i.spend)),uplift=purchased-food,fixed=sum(s.overheads.map(o=>o.cost)),daily=sum(s.phases.map(p=>p.days))*t.daily;
 const totalDays=sum(s.phases.map(p=>p.days)),energyCharge=kit.energy?energyTotals.cost:0,kitFee=kit.fee?(kit.feeBasis==='event'?kit.feeAmount:kit.feeAmount*totalDays):0;
 const base=purchased+labour+consumables+fixed+daily+energyCharge,contingency=base*t.contingency/100,cost=base+contingency,price=cost/(1-t.margin/100)+kitFee,profit=price-cost;
 groups=groups.map(g=>{const energyShare=kit.energy?sum(g.portions.map((v,i)=>servings[i]>0?v*recipeEnergy[i].cost/servings[i]:0)):0,allocated=g.food+g.consumables+g.labour+g.daily+energyShare+(pd?fixed*g.pd/pd:0)+(food?uplift*g.food/food:0);const cost=allocated*(1+t.contingency/100);return {...g,cost,price:cost/(1-t.margin/100)};});
 phaseCosts=phaseCosts.map((p,pi)=>({...p,cost:sum(groups.filter(g=>g.pi===pi).map(g=>g.cost)),price:sum(groups.filter(g=>g.pi===pi).map(g=>g.price))}));
 const unallocated=price-kitFee-sum(groups.map(g=>g.price));
 s.recipes.forEach((r,i)=>{if(servings[i]>0&&!r.lines.some(l=>l.qty>0))errors.push(r.name+' has portions but no ingredients. Add ingredient quantities or set its menu weight / daily allowance to zero.');});
 if(errors.length)return {energyCharge:NaN,kitFee,kit,energy,energyTotals,recipeEnergy,recipeCosts,servings,groups:groups.map(g=>({...g,cost:NaN,price:NaN})),phaseCosts:phaseCosts.map(p=>({...p,cost:NaN,price:NaN})),pd,meals,food:NaN,purchased:NaN,uplift:NaN,labour,consumables,fixed,daily,base:NaN,contingency:NaN,cost:NaN,price:NaN,profit:NaN,shopping,unallocated:NaN,errors};
 return {energyCharge,kitFee,kit,energy,energyTotals,recipeEnergy,recipeCosts,servings,groups,phaseCosts,pd,meals,food,purchased,uplift,labour,consumables,fixed,daily,base,contingency,cost,price,profit,shopping,unallocated,errors};
}
