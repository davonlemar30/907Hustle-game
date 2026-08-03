const C=require('../game-core.js');
const REG=Object.fromEntries(C.STORY_REGISTRY.map(i=>[i.id,i]));
// Alpha v0.7 pacing metrics. storyBeats/ambientVariety check the Task 7A mix
// target; chainStall flags runs where the story went quiet for 6+ parts of day.
function storyMetrics(state,beats){
  const ambient=new Set();let story=0;
  for(const b of beats){const d=REG[b.id];if(!d)continue;if(d.chain)story++;else ambient.add(b.id);}
  // A run "goes quiet" when nothing at all happens, story or street, for two
  // full in-game days.
  let stall=0,prev=0;
  for(const b of beats){stall=Math.max(stall,b.slot-prev);prev=b.slot;}
  stall=Math.max(stall,C.RUN_DAYS*4-prev);
  return {storyBeats:story,ambientBeats:beats.length-story,ambientVariety:ambient.size,
    maraChainDepth:state.people.mara.chainStage||0,chainStall:stall>=8?1:0};
}
const strategies={
  cautious:{background:'strategist',products:['weed','shrooms'],areas:['north_star_lot','downtown'],profit:1.10,heatCap:4,plan:'escape',track:'storage',gear:'running_shoes',crew:'eli',encounter:['intimidate','talk','run','pay','surrender']},
  balanced:{background:'hustler',products:['weed','shrooms','cocaine'],areas:['north_star_lot','downtown','airport_industrial'],profit:1.15,heatCap:7,plan:'defend',track:'security',gear:'utility_knife',crew:'miri',encounter:['talk','run','fight','pay','surrender']},
  aggressive:{background:'shooter',products:['meth','cocaine','shrooms'],areas:['airport_industrial','downtown'],profit:1.18,heatCap:11,plan:'last_score',track:'operations',gear:'cheap_handgun',crew:'tone',encounter:['draw','fight','pay','run','surrender']},
};
function settle(state,profile,beats){let s=state,guard=0;const note=(id)=>{if(beats&&(!beats.length||beats[beats.length-1].id!==id))beats.push({id,slot:(s.run.day-1)*4+s.run.slot})};while(guard++<12){if(s.run.daySummary){s=C.reduceGame(s,{type:'DISMISS_DAY_SUMMARY'});continue}if(s.run.pendingOperationResult){s=C.reduceGame(s,{type:'ACKNOWLEDGE_OPERATION_RESULT'});continue}if(s.run.pendingEvent){note(s.run.pendingEvent.id);const choices=s.run.pendingEvent.choices;let index=choices.findIndex(c=>(c.effect?.cash||0)>=0);if(index<0)index=choices.findIndex(c=>Math.abs(c.effect?.cash||0)<=s.player.cash);s=C.reduceGame(s,{type:'RESOLVE_EVENT',choiceIndex:index<0?choices.length-1:index});continue}if(s.run.pendingEncounter){note(s.run.pendingEncounter.id);const available=C.selectors.encounterChoices(s).map(c=>c.id);const choice=profile.encounter.find(id=>available.includes(id))||available[0];s=C.reduceGame(s,{type:'RESOLVE_ENCOUNTER',choiceId:choice});continue}break}return s}
function play(seed,name){const p=strategies[name];let s=C.reduceGame(C.createRun({seed}),{type:'CHOOSE_BACKGROUND',backgroundId:p.background}),guard=0;const beats=[];while(s.run.status==='playing'&&guard++<120){s=settle(s,p,beats);if(s.run.status!=='playing')break;const area=s.world.currentNeighborhoodId,market=s.world.markets[area];for(const id of p.products){if(!s.world.productAccess[id])continue;const item=s.player.inventory[id],sell=C.selectors.tradeUnitPrices(s,id).sell;if(item.qty&&sell>=item.avgCost*p.profit)s=C.reduceGame(s,{type:'SELL',productId:id,qty:item.qty})}const room=C.selectors.cargoCapacity(s)-C.selectors.cargoUsed(s);if(room>0){const candidates=p.products.filter(id=>s.world.productAccess[id]).map(id=>({id,price:C.selectors.tradeUnitPrices(s,id).buy,available:market.availability[id]})).filter(x=>x.available&&x.price<=s.player.cash).sort((a,b)=>a.price-b.price);if(candidates.length){const x=candidates[0],qty=Math.min(room,x.available,Math.floor(s.player.cash*.58/x.price));if(qty)s=C.reduceGame(s,{type:'BUY',productId:x.id,qty})}}
    const firstUpgrade=C.BASE_UPGRADES.find(u=>u.track===p.track&&u.level===1),gear=C.GEAR.find(g=>g.id===p.gear),crew=C.CREW.find(c=>c.id===p.crew),crewState=s.people.crew[p.crew];
    const operationAction=()=>s.base.visiting?s:C.reduceGame(s,{type:'VISIT_BASE'});
    if(p.crew==='eli'&&crewState.introduced&&!crewState.recruited&&['test_available','followup_required'].includes(crewState.contactStage)&&s.player.cash>=35){s=C.reduceGame(s,{type:'ELI_TEST_ROUTE'});continue}
    if(s.run.day<=3&&!s.base.tracks[p.track]&&s.player.cash>=firstUpgrade.cost){s=operationAction();s=settle(s,p,beats);if(s.base.visiting)s=C.reduceGame(s,{type:'UPGRADE_BASE',track:p.track});continue}
    if(s.run.day<=4&&!s.player.gear.owned.includes(p.gear)&&s.player.cash>=gear.cost){s=operationAction();s=settle(s,p,beats);if(s.base.visiting)s=C.reduceGame(s,{type:'BUY_GEAR',gearId:p.gear});continue}
    if(s.run.day<=5&&crewState.introduced&&!crewState.recruited&&s.player.cash>=C.selectors.recruitmentCost(s,p.crew)){s=operationAction();s=settle(s,p,beats);if(s.base.visiting)s=C.reduceGame(s,{type:'RECRUIT_CREW',crewId:p.crew});continue}
    if(C.selectors.robberyAvailability(s).available){s=C.reduceGame(s,{type:'ROBBERY'});continue}
    if(s.run.day>=6&&!s.run.finalPlanPrepared){s=C.reduceGame(s,{type:'PREPARE_FINAL_PLAN',planId:p.plan});continue}
    if(s.run.day===7&&s.run.finalPlan&&!s.run.pendingEncounter&&s.run.slot>=2){s=C.reduceGame(s,{type:'EXECUTE_FINAL_PLAN'});continue}
    if(s.lender.balance&&s.player.cash>=s.lender.balance+100&&s.run.day>=2){s=C.reduceGame(s,{type:'PAY_DEBT',amount:s.lender.balance});continue}
    if(s.player.heat>p.heatCap){s=C.reduceGame(s,{type:'LAY_LOW'});continue}
    const next=p.areas[(Math.max(0,p.areas.indexOf(area))+1)%p.areas.length];s=next===area?C.reduceGame(s,{type:'END_MARKET'}):C.reduceGame(s,{type:'TRAVEL',neighborhoodId:next});
  }s=settle(s,p,beats);const summary=C.selectRunSummary(s);summary.completed=s.run.status==='ended';summary.decisions=s.stats.decisions;summary.encounters=s.run.encounterCount;summary.baseValue=C.selectors.baseValue(s);summary.crew=C.selectors.recruitedCrew(s).length;Object.assign(summary,storyMetrics(s,beats));return summary}
function summarize(name,count){const runs=Array.from({length:count},(_,i)=>play(1000+i,name)),endings={};for(const r of runs)endings[r.endingLabel]=(endings[r.endingLabel]||0)+1;const avg=k=>Math.round(runs.reduce((n,r)=>n+(r[k]||0),0)/count);const robbery=k=>runs.reduce((n,r)=>n+(r.robbery?.[k]||0),0);return{strategy:name,runs:count,completed:runs.filter(r=>r.completed).length,averageCash:avg('cash'),averageNetWorth:avg('netWorth'),averageOperationScore:avg('operationScore'),averageDebt:avg('debt'),averageHighestHeat:avg('highestHeat'),averageDecisions:avg('decisions'),averageEncounters:avg('encounters'),averageBaseValue:avg('baseValue'),averageCrew:avg('crew'),quickScoreAttempts:robbery('attempts'),quickScoreSuccesses:robbery('successes'),quickScoreFailures:robbery('failures'),quickScorePayout:robbery('totalPayout'),territoryAttempts:runs.reduce((n,r)=>n+(r.takeovers?.attempts||0),0),deadEnds:runs.filter(r=>!r.completed).length,
  averageStoryBeats:Number((runs.reduce((n,r)=>n+r.storyBeats,0)/count).toFixed(1)),
  averageAmbientBeats:Number((runs.reduce((n,r)=>n+r.ambientBeats,0)/count).toFixed(1)),
  averageAmbientVariety:Number((runs.reduce((n,r)=>n+r.ambientVariety,0)/count).toFixed(1)),
  maraReachedStage4:Number((100*runs.filter(r=>r.maraChainDepth>=4).length/count).toFixed(0)),
  maraReachedStage6:Number((100*runs.filter(r=>r.maraChainDepth>=6).length/count).toFixed(0)),
  chainStallRuns:runs.reduce((n,r)=>n+r.chainStall,0),
  endings}}
const count=Number(process.argv[2]||200);console.log(JSON.stringify(Object.keys(strategies).map(name=>summarize(name,count)),null,2));
