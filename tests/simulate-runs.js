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
  cautious:{products:['weed','shrooms'],areas:['north_star_lot','downtown'],profit:1.10,heatCap:4,plan:'escape',track:'storage',gear:'running_shoes',crew:'eli',encounter:['intimidate','talk','run','pay','surrender'],mode:'trader'},
  balanced:{products:['weed','shrooms','cocaine'],areas:['north_star_lot','downtown'],profit:1.15,heatCap:7,plan:'defend',track:'security',gear:'utility_knife',crew:'miri',encounter:['talk','run','fight','pay','surrender'],mode:'mixed',property:true},
  aggressive:{products:['shrooms','weed'],areas:['north_star_lot','downtown'],profit:1.18,heatCap:11,plan:'last_score',track:'operations',gear:'cheap_handgun',crew:'tone',encounter:['draw','fight','pay','run','surrender'],mode:'thief',property:true},
  // Alpha v0.7.1: works Kip's corner rather than the market. Stays in Spenard,
  // buys off him to build standing, and takes the corner when it is available.
  stickup:{products:['weed','shrooms'],areas:['north_star_lot'],profit:1.12,heatCap:12,plan:'defend',track:'security',gear:'utility_knife',crew:'tone',encounter:['fight','draw','intimidate','pay','run','surrender'],dealer:'kip',mode:'stickup',property:true},
  legal_worker:{products:[],areas:['north_star_lot'],profit:2,heatCap:2,plan:'escape',track:'storage',gear:'running_shoes',crew:'eli',encounter:['talk','run','pay','surrender'],mode:'legal'},
  trader:{products:['weed','shrooms'],areas:['north_star_lot','downtown'],profit:1.10,heatCap:5,plan:'escape',track:'storage',gear:'running_shoes',crew:'eli',encounter:['talk','run','pay','surrender'],mode:'trader'},
  thief:{products:[],areas:['north_star_lot'],profit:2,heatCap:8,plan:'last_score',track:'security',gear:'utility_knife',crew:'tone',encounter:['run','talk','fight','surrender'],mode:'thief'},
  gambler:{products:[],areas:['north_star_lot'],profit:2,heatCap:3,plan:'escape',track:'storage',gear:'running_shoes',crew:'eli',encounter:['talk','run','pay','surrender'],mode:'gambler'},
  trainer:{products:[],areas:['north_star_lot'],profit:2,heatCap:3,plan:'defend',track:'recovery',gear:'running_shoes',crew:'eli',encounter:['run','talk','fight','surrender'],mode:'trainer'},
  mixed_freedom:{products:['weed','shrooms'],areas:['north_star_lot','downtown'],profit:1.12,heatCap:6,plan:'defend',track:'security',gear:'utility_knife',crew:'eli',encounter:['talk','run','fight','pay','surrender'],mode:'mixed',property:true},
  // v1.0: recruits soldiers and claims Spenard blocks aggressively once Eli is
  // an active lieutenant, to soak-test the new passive-income/raid systems.
  operator:{products:['weed','shrooms'],areas:['north_star_lot','downtown'],profit:1.12,heatCap:8,plan:'defend',track:'operations',gear:'utility_knife',crew:'eli',encounter:['talk','run','fight','pay','surrender'],mode:'mixed',property:true,operator:true},
};
function settle(state,profile,beats){let s=state,guard=0;const note=(id)=>{if(beats&&(!beats.length||beats[beats.length-1].id!==id))beats.push({id,slot:(s.run.day-1)*4+s.run.slot})};while(guard++<12){if(s.run.daySummary){s=C.reduceGame(s,{type:'DISMISS_DAY_SUMMARY'});continue}if(s.run.pendingOperationResult){s=C.reduceGame(s,{type:'ACKNOWLEDGE_OPERATION_RESULT'});continue}if(s.run.pendingEvent){note(s.run.pendingEvent.id);const choices=s.run.pendingEvent.choices;let index=choices.findIndex(c=>(c.effect?.cash||0)>=0);if(index<0)index=choices.findIndex(c=>Math.abs(c.effect?.cash||0)<=s.player.cash);s=C.reduceGame(s,{type:'RESOLVE_EVENT',choiceIndex:index<0?choices.length-1:index});continue}if(s.run.pendingEncounter){note(s.run.pendingEncounter.id);const available=C.selectors.encounterChoices(s).map(c=>c.id);const choice=profile.encounter.find(id=>available.includes(id))||available[0];s=C.reduceGame(s,{type:'RESOLVE_ENCOUNTER',choiceId:choice});continue}break}return s}
function play(seed,name){const p=strategies[name];let s=C.reduceGame(C.createRun({seed}),{type:'START_RUN'}),guard=0;const beats=[];while(s.run.status==='playing'&&guard++<400){s=settle(s,p,beats);if(s.run.status!=='playing')break;
    if((p.mode==='trader'||p.mode==='mixed'||p.mode==='stickup')&&!s.world.productAccess.weed){s=C.reduceGame(s,{type:'EXPLORE_SPENARD'});continue}
    if(p.mode==='gambler'&&!s.world.locations.gamblingKnown){s=C.reduceGame(s,{type:'EXPLORE_SPENARD'});continue}
    if(p.mode==='legal'&&C.selectors.activityAvailability(s).work.available){s=C.reduceGame(s,{type:'WORK_SHIFT'});continue}
    if(p.mode==='thief'&&C.selectors.activityAvailability(s).shoplifting.available){s=C.reduceGame(s,{type:'SHOPLIFT'});continue}
    if(p.mode==='gambler'&&C.selectors.activityAvailability(s).gambling.available&&s.player.cash>=20){s=C.reduceGame(s,{type:'GAMBLE',stake:s.player.cash>=100?50:20,approach:'read'});continue}
    if(p.mode==='trainer'&&C.selectors.activityAvailability(s).gym.available&&s.player.cash>=100){s=C.reduceGame(s,{type:'TRAIN_ATTRIBUTE',attribute:['strength','endurance','reflexes'][s.stats.decisions%3]});continue}
    if(p.mode==='mixed'&&s.run.slot===0&&C.selectors.activityAvailability(s).work.available){s=C.reduceGame(s,{type:'WORK_SHIFT'});continue}
    if(p.property&&!s.base.controlled&&s.run.day>=3&&s.player.cash>=850){s=C.reduceGame(s,{type:'LEASE_GARAGE'});continue}
    const area=s.world.currentNeighborhoodId,market=s.world.markets[area];for(const id of p.products){if(!s.world.productAccess[id])continue;const item=s.player.inventory[id],sell=C.selectors.tradeUnitPrices(s,id).sell;if(item.qty&&sell>=item.avgCost*p.profit)s=C.reduceGame(s,{type:'SELL',productId:id,qty:item.qty})}const room=C.selectors.cargoCapacity(s)-C.selectors.cargoUsed(s);if(room>0){const candidates=p.products.filter(id=>s.world.productAccess[id]).map(id=>({id,price:C.selectors.tradeUnitPrices(s,id).buy,available:market.availability[id]})).filter(x=>x.available&&x.price<=s.player.cash).sort((a,b)=>a.price-b.price);if(candidates.length){const x=candidates[0],qty=Math.min(room,x.available,Math.floor(s.player.cash*.58/x.price));if(qty)s=C.reduceGame(s,{type:'BUY',productId:x.id,qty})}}
    const firstUpgrade=C.BASE_UPGRADES.find(u=>u.track===p.track&&u.level===1),gear=C.GEAR.find(g=>g.id===p.gear),crew=C.CREW.find(c=>c.id===p.crew),crewState=s.people.crew[p.crew];
    const operationAction=()=>s.base.visiting?s:C.reduceGame(s,{type:'VISIT_BASE'});
    const eliTest=p.crew==='eli'?C.selectors.eliTestRouteAvailability(s):null;
    if(eliTest?.available){s=C.reduceGame(s,{type:'ELI_TEST_ROUTE'});continue}
    if(s.base.controlled&&s.run.day<=3&&!s.base.tracks[p.track]&&s.player.cash>=firstUpgrade.cost){s=operationAction();s=settle(s,p,beats);if(s.base.visiting)s=C.reduceGame(s,{type:'UPGRADE_BASE',track:p.track});continue}
    if(s.base.controlled&&s.run.day<=4&&!s.player.gear.owned.includes(p.gear)&&s.player.cash>=gear.cost){s=operationAction();s=settle(s,p,beats);if(s.base.visiting)s=C.reduceGame(s,{type:'BUY_GEAR',gearId:p.gear});continue}
    if(s.base.controlled&&s.run.day<=5&&crewState.introduced&&!crewState.recruited&&(p.crew!=='eli'||crewState.contactStage==='recruitable')&&s.player.cash>=C.selectors.recruitmentCost(s,p.crew)){s=operationAction();s=settle(s,p,beats);if(s.base.visiting)s=C.reduceGame(s,{type:'RECRUIT_CREW',crewId:p.crew});continue}
    if(p.operator&&s.people.crew.eli.recruited&&C.selectors.eliPromotionAvailability(s).available){s=C.reduceGame(s,{type:'PROMOTE_LIEUTENANT',crewId:'eli'});continue}
    if(p.operator&&C.selectors.soldierRecruitAvailability(s).available){s=C.reduceGame(s,{type:'RECRUIT_SOLDIER'});continue}
    if(p.operator&&C.selectors.eliLieutenantActive(s)){
      const claimable=C.SPENARD_BLOCKS.find(b=>C.selectors.blockClaimAvailability(s,b.id).available);
      if(claimable){s=C.reduceGame(s,{type:'CLAIM_BLOCK',blockId:claimable.id});continue}
      const unassigned=Object.values(s.world.soldiers).find(sol=>sol.status==='active'&&!sol.blockId);
      const ownedBlock=C.SPENARD_BLOCKS.find(b=>s.world.territoryBlocks[b.id].owner==='player'&&C.selectors.soldierAssignAvailability(s,unassigned?.id,b.id).available);
      if(unassigned&&ownedBlock){s=C.reduceGame(s,{type:'ASSIGN_SOLDIER',soldierId:unassigned.id,blockId:ownedBlock.id});continue}
    }
    if(p.operator&&C.selectors.kipLieutenantAvailability(s).available){
      s.run.pendingEvent=C.buildEventForTest('kip_lieutenant_intro',s);
      const idx=s.run.pendingEvent.choices.findIndex(c=>c.label.toLowerCase().includes('bring kip'));
      s=C.reduceGame(s,{type:'RESOLVE_EVENT',choiceIndex:idx<0?0:idx});continue;
    }
    if(p.operator&&s.people.crew.kip.recruited&&s.player.dirtyCash>=100){
      const avail=C.selectors.launderAvailability(s,Math.min(200,s.player.dirtyCash));
      if(avail.available){s=C.reduceGame(s,{type:'LAUNDER_CASH',amount:Math.min(200,s.player.dirtyCash)});continue}
    }
    if(p.dealer){
      const actions=C.selectors.dealerActions(s,p.dealer);
      if(actions.rob.available){s=C.reduceGame(s,{type:'ROB_DEALER',dealerId:p.dealer});continue}
      if(actions.buy.available&&s.player.cash>=200){s=C.reduceGame(s,{type:'BUY_FROM_DEALER',dealerId:p.dealer});continue}
      if(actions.ask.available){s=C.reduceGame(s,{type:'ASK_DEALER',dealerId:p.dealer});continue}
    }
    if(['thief','stickup'].includes(p.mode)&&C.selectors.robberyAvailability(s).available){s=C.reduceGame(s,{type:'ROBBERY'});continue}
    if(s.run.day>=6&&!s.run.finalPlanPrepared){s=C.reduceGame(s,{type:'PREPARE_FINAL_PLAN',planId:p.plan});continue}
    if(s.run.day===7&&s.run.finalPlan&&!s.run.pendingEncounter&&s.run.slot>=2){s=C.reduceGame(s,{type:'EXECUTE_FINAL_PLAN'});continue}
    if(s.lender.balance&&s.player.cash>=s.lender.balance+100&&s.run.day>=2){s=C.reduceGame(s,{type:'PAY_DEBT',amount:s.lender.balance});continue}
    if(s.player.heat>p.heatCap){s=C.reduceGame(s,{type:'LAY_LOW'});continue}
    const next=p.areas[(Math.max(0,p.areas.indexOf(area))+1)%p.areas.length],busCovered=s.world.transport.weekPass||s.world.transport.dayPassDay===s.run.day;s=next===area?C.reduceGame(s,{type:'END_MARKET'}):next==='north_star_lot'&&s.player.cash<5&&!busCovered?C.reduceGame(s,{type:'WALK_HOME'}):['downtown','north_star_lot'].includes(next)&&s.player.cash<5&&!busCovered?C.reduceGame(s,{type:'END_MARKET'}):['downtown','north_star_lot'].includes(next)?C.reduceGame(s,{type:'BUS_TRAVEL',neighborhoodId:next}):C.reduceGame(s,{type:'TRAVEL',neighborhoodId:next});
  }s=settle(s,p,beats);const summary=C.selectRunSummary(s);summary.completed=s.run.status==='ended';summary.decisions=s.stats.decisions;summary.encounters=s.run.encounterCount;summary.baseValue=C.selectors.baseValue(s);summary.crew=C.selectors.recruitedCrew(s).length;summary.dealer={...(s.people.dealers?.kip||{})};summary.identityAssignedDay=s.player.identityAssignedDay;summary.identityHistoryLength=s.player.identityHistory.length;summary.meaningfulActions=s.player.behavior.meaningfulActions;summary.derivedRatings=Object.values(C.selectors.derivedRatings(s)).join('/');summary.garageDay=s.base.acquiredDay||0;summary.evicted=s.people.household.evicted?1:0;summary.discoveries=s.world.locations.discoveries.length;summary.attributeGains=Object.values(s.player.attributes).reduce((n,v)=>n+Math.max(0,v-2),0);summary.streetReadTier=s.streetRead.tier;summary.streetReadScore=s.streetRead.score;summary.streetReadEntries=s.streetRead.totalLifetimeEntries;summary.employerStanding=s.world.locations.employer.standing;summary.gamblingNet=s.world.locations.gambling.net;Object.assign(summary,storyMetrics(s,beats));return summary}
function summarize(name,count){const runs=Array.from({length:count},(_,i)=>play(1000+i,name)),endings={};for(const r of runs)endings[r.endingLabel]=(endings[r.endingLabel]||0)+1;const avg=k=>Math.round(runs.reduce((n,r)=>n+(r[k]||0),0)/count);const robbery=k=>runs.reduce((n,r)=>n+(r.robbery?.[k]||0),0);return{strategy:name,runs:count,completed:runs.filter(r=>r.completed).length,averageCash:avg('cash'),averageNetWorth:avg('netWorth'),averageOperationScore:avg('operationScore'),averageDebt:avg('debt'),averageHighestHeat:avg('highestHeat'),averageDecisions:avg('decisions'),averageEncounters:avg('encounters'),averageBaseValue:avg('baseValue'),averageCrew:avg('crew'),quickScoreAttempts:robbery('attempts'),quickScoreSuccesses:robbery('successes'),quickScoreFailures:robbery('failures'),quickScorePayout:robbery('totalPayout'),territoryAttempts:runs.reduce((n,r)=>n+(r.takeovers?.attempts||0),0),deadEnds:runs.filter(r=>!r.completed).length,
  averageStoryBeats:Number((runs.reduce((n,r)=>n+r.storyBeats,0)/count).toFixed(1)),
  averageAmbientBeats:Number((runs.reduce((n,r)=>n+r.ambientBeats,0)/count).toFixed(1)),
  averageAmbientVariety:Number((runs.reduce((n,r)=>n+r.ambientVariety,0)/count).toFixed(1)),
  maraReachedStage4:Number((100*runs.filter(r=>r.maraChainDepth>=4).length/count).toFixed(0)),
  maraReachedStage6:Number((100*runs.filter(r=>r.maraChainDepth>=6).length/count).toFixed(0)),
  chainStallRuns:runs.reduce((n,r)=>n+r.chainStall,0),
  dealerRobberies:runs.reduce((n,r)=>n+(r.dealer?.robbedCount||0),0),
  dealerGone:runs.filter(r=>r.dealer?.gone).length,
  averageDealerStanding:Number((runs.reduce((n,r)=>n+(r.dealer?.standing||0),0)/count).toFixed(1)),
  identityAssignments:runs.reduce((out,r)=>{out[r.streetIdentity||'unproven']=(out[r.streetIdentity||'unproven']||0)+1;return out},{}),
  meanFirstAssignmentDay:Number((runs.reduce((n,r)=>n+(r.identityAssignedDay||0),0)/Math.max(1,runs.filter(r=>r.identityAssignedDay).length)).toFixed(1)),
  identityChanges:runs.reduce((n,r)=>n+Math.max(0,(r.identityHistoryLength||0)-1),0),
  runsRemainingUnproven:runs.filter(r=>!r.streetIdentity||r.streetIdentity==='unproven').length,
  averageMeaningfulActions:Number((runs.reduce((n,r)=>n+(r.meaningfulActions||0),0)/count).toFixed(1)),
  averageGarageDay:Number((runs.reduce((n,r)=>n+(r.garageDay||0),0)/Math.max(1,runs.filter(r=>r.garageDay).length)).toFixed(1)),
  garageAcquisitions:runs.filter(r=>r.garageDay).length,evictions:runs.reduce((n,r)=>n+r.evicted,0),averageDiscoveries:avg('discoveries'),averageAttributeGains:avg('attributeGains'),averageStreetReadTier:avg('streetReadTier'),averageStreetReadScore:avg('streetReadScore'),averageStreetReadEntries:avg('streetReadEntries'),averageEmployerStanding:avg('employerStanding'),averageGamblingNet:avg('gamblingNet'),
  derivedRatingDistribution:runs.reduce((out,r)=>{const key=r.derivedRatings||'2/2/2';out[key]=(out[key]||0)+1;return out},{}),
  legacySaveSmoke:C.selectors.derivedRatings(C.hydrateRun({...C.reduceGame(C.createRun({seed:99}),{type:'START_RUN'}),player:{...C.reduceGame(C.createRun({seed:99}),{type:'START_RUN'}).player,background:'shooter',attributes:undefined}})),
  endings}}
const count=Number(process.argv[2]||200);console.log(JSON.stringify(Object.keys(strategies).map(name=>summarize(name,count)),null,2));
