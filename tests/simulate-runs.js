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
    minaChainDepth:state.npc.mina.chainStage||0,chainStall:stall>=8?1:0};
}
// v1.9a: what each NPC actually concluded about the player by the end of the
// run. This is the calibration instrument for the Exposure System, and the only
// way to tell "the lens is tuned" from "the content is unreachable".
function exposureMetrics(state){
  // v1.18: Tone's recruitment is the first gate that reads a ledger AND Curtis's
  // ambient attention, so both halves are tracked. Without curtisAwareness here
  // there is no way to tell "nobody earned it" from "nobody could".
  const out={taxActive:state.npc.curtis.taxActive?1:0,curtisBetrayed:state.npc.curtis.betrayed?1:0,
    curtisAwareness:state.curtisAwareness?.level||0,
    toneProven:C.selectors.crewRecruitmentEligible(state,'tone')?1:0,
    toneRecruited:state.people.crew.tone.recruited?1:0,
    // v1.19: the same two numbers for Pherris. Proven is the ledger clearing her
    // floor; recruited is whether the card then actually fired and was taken.
    pherrisProven:C.selectors.crewRecruitmentEligible(state,'pherris')?1:0,
    pherrisRecruited:state.people.crew.pherris.recruited?1:0};
  for(const id of C.EXPOSURE_NPC_IDS){
    out[id+'Score']=C.selectors.disposition(state,id);
    out[id+'Band']=C.selectors.dispositionBand(state,id);
    out[id+'Rows']=(state.npc[id].ledger||[]).length;
  }
  return out;
}
// v1.20: what the territory layer actually did, so Tone's defense modifier is
// measurable in a real run rather than only in a unit test. blocksLost is the
// number that moves: a block with capturedDay set and a Curtis owner is one the
// player claimed and then had taken back.
function territoryMetrics(state){
  const blocks=Object.values(state.world.territoryBlocks||{});
  const claimed=blocks.filter(b=>b.capturedDay!=null);
  return {blocksClaimed:claimed.length,blocksHeld:blocks.filter(b=>b.owner==='player').length,
    blocksLost:claimed.filter(b=>b.owner!=='player').length,
    blockRaids:blocks.reduce((n,b)=>n+(b.raidCount||0),0),
    blockIncome:blocks.reduce((n,b)=>n+(b.incomeCollected||0),0)};
}
// v1.9b: what the 907List broker track actually earned, and at which tier. The
// per-tier daily income is the only way to tell "the tier ladder is tuned" from
// "Broker is unreachable content", so it is sampled once per day rather than
// read off the end state.
function marketMetrics(state,samples){
  const list=state.nineZeroSevenList;
  const perTier={1:{days:0,profit:0},2:{days:0,profit:0},3:{days:0,profit:0}};
  for(let i=1;i<samples.length;i++){
    const prev=samples[i-1],days=samples[i].day-prev.day;
    if(days<=0||!perTier[prev.tier])continue;
    perTier[prev.tier].days+=days;perTier[prev.tier].profit+=samples[i].profit-prev.profit;
  }
  return {marketTier:C.selectors.marketTier(state),marketFlips:list.flipCount,marketDisputes:list.disputes,
    marketProfit:list.profit,marketRobberies:list.robberies,marketFilled:list.filledRequests,
    marketSpecialist:list.specialist?1:0,marketPerTier:perTier};
}

// One 907List turn, shared by both broker strategies. Returns the next state, or
// null when there was nothing worth doing — the caller then falls through to the
// rest of its day.
function marketTurn(s,p){
  if(!s.knowledge.knows907List)return null;
  const list=s.nineZeroSevenList,cfg=C.selectors.marketTierConfig(s);
  // The whole risk mechanic is a decision, so the strategies make it: a meetup
  // only happens when the readout the UI shows is under the profile's ceiling.
  // In practice that means moving in the Morning and Afternoon and sitting on a
  // full bag after dark, which is exactly the behaviour the design rewards.
  const meetup=C.selectors.marketMeetupAvailability(s).available
    &&C.selectors.marketRobberyPreview(s).risk<=p.marketRiskCap;
  // The laptop is the whole Tier 2 gate, so it comes before any flip.
  if(!s.inventory.laptop&&s.player.cash>=250+p.marketFloat)return C.reduceGame(s,{type:'BUY_LAPTOP'});
  // Money already agreed beats money still being negotiated.
  const ready=list.pendingSells.find(e=>e.status==='ready');
  if(ready&&meetup)return C.reduceGame(s,{type:'DELIVER_907LIST',pendingId:ready.id});
  // A named buyer pays a premium and never ghosts, so fill before selling open.
  if(cfg.requests&&meetup){
    for(const request of C.selectors.marketRequests(s)){
      const held=C.selectors.requestFillCandidates(s,request.id)[0];
      if(held)return C.reduceGame(s,{type:'FILL_BUYER_REQUEST',requestId:request.id,inventoryId:held.id});
    }
  }
  // Listing is free, so anything unspoken-for goes on the board every turn.
  const unlisted=list.inventory.find(e=>!e.listed);
  if(unlisted&&!(p.marketQuick&&cfg.quickSell))return C.reduceGame(s,{type:'SELL_907LIST',inventoryId:unlisted.id,surface:'phone'});
  if(unlisted&&meetup)return C.reduceGame(s,{type:'QUICK_SELL_907LIST',inventoryId:unlisted.id});
  if(!meetup)return null;
  const capacity=C.selectors.marketCapacity(s);
  // A distressed lot is worth the capital lock when there is room for all of it.
  const bulk=C.selectors.marketBulkDeal(s);
  if(bulk&&!bulk.taken&&list.inventory.length+bulk.itemIds.length<=capacity&&s.player.cash>=bulk.price+p.marketFloat){
    return C.reduceGame(s,{type:'BUY_BULK_907LIST',dealId:bulk.id});
  }
  if(list.inventory.length>=capacity)return null;
  // Appraisal, expressed as arithmetic: take the widest spread on the board and
  // never take one that is not there. That is what makes the junk listings cost
  // something rather than decorate the page.
  const best=C.selectors.listingSlate(s,'phone')
    .filter(x=>x.estimate-x.buy>=p.marketMargin&&x.buy+p.marketFloat<=s.player.cash)
    .sort((a,b)=>(b.estimate-b.buy)-(a.estimate-a.buy))[0];
  if(best)return C.reduceGame(s,{type:'BUY_907LIST',itemId:best.id,surface:'phone'});
  return null;
}

const strategies={
  cautious:{caught:['surrender','run','fight'],products:['weed','shrooms'],areas:['north_star_lot','downtown'],profit:1.10,heatCap:4,plan:'escape',track:'storage',gear:'running_shoes',crew:'eli',encounter:['intimidate','talk','run','pay','surrender'],mode:'trader'},
  balanced:{caught:['run','fight','surrender'],products:['weed','shrooms','cocaine'],areas:['north_star_lot','downtown'],profit:1.15,heatCap:7,plan:'defend',track:'security',gear:'utility_knife',crew:'pherris',encounter:['talk','run','fight','pay','surrender'],mode:'mixed',property:true},
  aggressive:{caught:['fight','run','surrender'],products:['shrooms','weed'],areas:['north_star_lot','downtown'],profit:1.18,heatCap:11,plan:'last_score',track:'operations',gear:'cheap_handgun',crew:'tone',encounter:['draw','fight','pay','run','surrender'],mode:'thief',property:true},
  // Alpha v0.7.1: works Goodie's corner rather than the market. Stays in Spenard,
  // buys off him to build standing, and takes the corner when it is available.
  stickup:{caught:['fight','run','surrender'],products:['weed','shrooms'],areas:['north_star_lot'],profit:1.12,heatCap:12,plan:'defend',track:'security',gear:'utility_knife',crew:'tone',encounter:['fight','draw','intimidate','pay','run','surrender'],dealer:'goodie',mode:'stickup',property:true},
  legal_worker:{caught:['surrender','run','fight'],products:[],areas:['north_star_lot'],profit:2,heatCap:2,plan:'escape',track:'storage',gear:'running_shoes',crew:'eli',encounter:['talk','run','pay','surrender'],mode:'legal'},
  trader:{caught:['run','surrender','fight'],products:['weed','shrooms'],areas:['north_star_lot','downtown'],profit:1.10,heatCap:5,plan:'escape',track:'storage',gear:'running_shoes',crew:'eli',encounter:['talk','run','pay','surrender'],mode:'trader'},
  thief:{caught:['fight','run','surrender'],products:[],areas:['north_star_lot'],profit:2,heatCap:8,plan:'last_score',track:'security',gear:'utility_knife',crew:'tone',encounter:['run','talk','fight','surrender'],mode:'thief'},
  gambler:{caught:['surrender','run','fight'],products:[],areas:['north_star_lot'],profit:2,heatCap:3,plan:'escape',track:'storage',gear:'running_shoes',crew:'eli',encounter:['talk','run','pay','surrender'],mode:'gambler'},
  trainer:{caught:['fight','run','surrender'],products:[],areas:['north_star_lot'],profit:2,heatCap:3,plan:'defend',track:'recovery',gear:'running_shoes',crew:'eli',encounter:['run','talk','fight','surrender'],mode:'trainer'},
  mixed_freedom:{caught:['run','fight','surrender'],products:['weed','shrooms'],areas:['north_star_lot','downtown'],profit:1.12,heatCap:6,plan:'defend',track:'security',gear:'utility_knife',crew:'eli',encounter:['talk','run','fight','pay','surrender'],mode:'mixed',property:true},
  // v1.0: recruits soldiers and claims Spenard blocks aggressively once Eli is
  // an active lieutenant, to soak-test the new passive-income/raid systems.
  operator:{caught:['run','fight','surrender'],products:['weed','shrooms'],areas:['north_star_lot','downtown'],profit:1.12,heatCap:8,plan:'defend',track:'operations',gear:'utility_knife',crew:'eli',encounter:['talk','run','fight','pay','surrender'],mode:'mixed',property:true,operator:true},
  // v1.9b. Both work the legal board rather than the drug loop, which is what
  // makes their averageCash the tier-income measurement rather than a blend.
  // flipper posts and waits for the better margin; broker chases named buyers,
  // takes bulk lots, and rides Downtown for the +30%.
  // marketQuick is the throughput decision, and it is the interesting one: a
  // quick sell gives back 20% of the margin and returns the capital inside the
  // same day, which on a bankroll this thin is worth more than the 20%. flipper
  // takes that trade; broker posts and waits for the full price and rides
  // Downtown for the +30%, which is slower and needs a float to survive.
  flipper:{caught:['surrender','run','fight'],products:[],areas:['north_star_lot'],profit:2,heatCap:3,plan:'escape',track:'storage',gear:'running_shoes',crew:'eli',encounter:['talk','run','pay','surrender'],mode:'legal',market:true,marketMargin:12,marketFloat:0,marketQuick:true,marketRiskCap:0.14},
  broker:{caught:['surrender','run','fight'],products:[],areas:['north_star_lot','downtown'],profit:2,heatCap:4,plan:'escape',track:'storage',gear:'running_shoes',crew:'eli',encounter:['talk','run','pay','surrender'],mode:'legal',market:true,marketMargin:15,marketFloat:0,marketQuick:true,marketRiskCap:0.18},
};
function settle(state,profile,beats){let s=state,guard=0;const note=(id)=>{if(beats&&(!beats.length||beats[beats.length-1].id!==id))beats.push({id,slot:(s.run.day-1)*4+s.run.slot})};while(guard++<20){if(s.run.openingPending){s=C.reduceGame(s,{type:'DISMISS_OPENING'});continue}if(s.run.daySummary){s=C.reduceGame(s,{type:'DISMISS_DAY_SUMMARY'});continue}if(s.run.pendingOperationResult){s=C.reduceGame(s,{type:'ACKNOWLEDGE_OPERATION_RESULT'});continue}if(s.run.pendingEncounter){note(s.run.pendingEncounter.id);const available=C.selectors.encounterChoices(s).map(c=>c.id);const posture=s.run.pendingEncounter.type==='boost_caught'?(profile.caught||[]):profile.encounter;const choice=posture.find(id=>available.includes(id))||profile.encounter.find(id=>available.includes(id))||available[0];s=C.reduceGame(s,{type:'RESOLVE_ENCOUNTER',choiceId:choice});continue}if(s.run.pendingEvent){note(s.run.pendingEvent.id);const choices=s.run.pendingEvent.choices;let index=s.run.pendingEvent.id==='dre_terms'?choices.length-1:choices.findIndex(c=>(c.effect?.cash||0)>=0);if(index<0)index=choices.findIndex(c=>Math.abs(c.effect?.cash||0)<=s.player.cash);s=C.reduceGame(s,{type:'RESOLVE_EVENT',choiceIndex:index<0?choices.length-1:index});continue}if(s.run.dayEndPending){s=C.reduceGame(s,{type:'CONFIRM_END_DAY'});continue}break}return s}
function play(seed,name){const p=strategies[name];let s=C.reduceGame(C.createRun({seed}),{type:'START_RUN',streetName:`Sim ${seed}`}),guard=0;const beats=[];const marketSamples=[];while(s.run.status==='playing'&&guard++<500){s=settle(s,p,beats);if(s.run.status!=='playing')break;
    // Sampled before the day's actions so a tier's income is credited to the
    // tier that was actually active while it was being earned.
    if(p.market&&s.knowledge.knows907List&&(!marketSamples.length||marketSamples[marketSamples.length-1].day!==s.run.day)){
      marketSamples.push({day:s.run.day,tier:C.selectors.marketTier(s),profit:s.nineZeroSevenList.profit});
    }
    if(p.market){const next=marketTurn(s,p);if(next&&next!==s){s=next;continue}}
    if(s.run.phase==='week_zero'){
      if(s.run.slot>=2&&!s.nightOwl.boardViewedDays.includes(s.run.day)){s=C.reduceGame(s,{type:'VIEW_NIGHT_OWL_BOARD'});continue}
      if(s.run.slot>=2&&!s.npc.mina.met){s=C.reduceGame(s,{type:'VISIT_NIGHT_OWL'});continue}
      const regular=C.selectors.nightOwlRegularFor(s),regularState=s.nightOwl.regulars[regular.id];
      if(s.run.slot>=2&&regularState.lastTalkDay!==s.run.day){s=C.reduceGame(s,{type:'TALK_NIGHT_OWL_REGULAR',regularId:regular.id});continue}
      const job=C.selectors.discoveredJobs(s).find(entry=>C.selectors.jobAvailability(s,entry.id).available);
      if(job){s=C.reduceGame(s,{type:'WORK_JOB',jobId:job.id,approach:p.mode==='legal'?'work_hard':'socialize'});continue}
      s=C.reduceGame(s,{type:'WANDER_SPENARD'});continue;
    }
    if((p.mode==='trader'||p.mode==='mixed'||p.mode==='stickup')&&!s.world.productAccess.weed){s=C.reduceGame(s,{type:'EXPLORE_SPENARD'});continue}
    if(p.mode==='gambler'&&!s.world.locations.gamblingKnown){s=C.reduceGame(s,{type:'EXPLORE_SPENARD'});continue}
    if(p.mode==='legal'){const job=C.selectors.discoveredJobs(s).find(job=>C.selectors.jobAvailability(s,job.id).available);if(job){s=C.reduceGame(s,{type:'WORK_JOB',jobId:job.id,approach:'work_hard'});continue}}
    if(p.mode==='thief'&&C.selectors.activityAvailability(s).shoplifting.available){s=C.reduceGame(s,{type:'SHOPLIFT'});continue}
    // v1.11: the gambler plays the real tables at The Nile. Rewired rather than
    // added as a twelfth strategy so the strategy count and averageGamblingNet
    // both stay comparable across builds. Cee-lo when Biniam allows it, Tonk
    // otherwise; a hand in progress is always finished before anything else.
    if(p.mode==='gambler'){const n=C.selectors.nileAvailability(s);
      if(s.gambling.round){s=C.reduceGame(s,{type:'NILE_CELO_ROLL'});continue}
      if(s.gambling.table){const v=C.selectors.tonkView(s);if(v.value<=10){s=C.reduceGame(s,{type:'NILE_TONK_DROP'});continue}
        const worst=v.hand.filter(c=>!v.spreads.flat().includes(c.id)&&!v.runs.flat().includes(c.id)).sort((a,b)=>b.value-a.value)[0]||v.hand[0];
        s=C.reduceGame(s,{type:'NILE_TONK_TURN',draw:'stock',discardId:worst.id});continue}
      // Alternate floors by day so the profile exercises both growth sources
      // rather than settling on whichever table is checked first.
      const preferCelo=s.run.day%2===1;
      if(preferCelo&&n.celo.available&&s.player.cash>=20){s=C.reduceGame(s,{type:'NILE_CELO_SIT',buyIn:s.player.cash>=100?50:20});continue}
      if(n.tonk.available&&s.player.cash>=10){s=C.reduceGame(s,{type:'NILE_TONK_SIT',buyIn:s.player.cash>=50?25:10});continue}
      if(n.celo.available&&s.player.cash>=20){s=C.reduceGame(s,{type:'NILE_CELO_SIT',buyIn:s.player.cash>=100?50:20});continue}
      if(n.wellness.available&&s.player.health<70){s=C.reduceGame(s,{type:'NILE_WELLNESS'});continue}
      if(n.coffee.available){s=C.reduceGame(s,{type:'NILE_COFFEE'});continue}}
    if(p.mode==='trainer'&&C.selectors.activityAvailability(s).gym.available&&s.player.cash>=100){s=C.reduceGame(s,{type:'TRAIN_ATTRIBUTE',activity:C.selectors.activityAvailability(s).gym.activities.find(a=>a.id==='sparring'&&a.unlocked)?'sparring':'bag_work'});continue}
    if(p.mode==='mixed'&&s.run.slot===0){const job=C.selectors.discoveredJobs(s).find(job=>C.selectors.jobAvailability(s,job.id).available);if(job){s=C.reduceGame(s,{type:'WORK_JOB',jobId:job.id,approach:'socialize'});continue}}
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
    if(p.dealer){
      const actions=C.selectors.dealerActions(s,p.dealer);
      if(actions.rob.available){s=C.reduceGame(s,{type:'ROB_DEALER',dealerId:p.dealer});continue}
      if(actions.buy.available&&s.player.cash>=200){s=C.reduceGame(s,{type:'BUY_FROM_DEALER',dealerId:p.dealer});continue}
      if(actions.ask.available){s=C.reduceGame(s,{type:'ASK_DEALER',dealerId:p.dealer});continue}
    }
    if(['thief','stickup'].includes(p.mode)&&C.selectors.robAvailability(s).available){s=C.reduceGame(s,{type:'ROB'});continue}
    if(s.run.day>=s.run.checkpointDay-1&&!s.run.finalPlanPrepared){s=C.reduceGame(s,{type:'PREPARE_FINAL_PLAN',planId:p.plan});continue}
    if(s.run.day===s.run.checkpointDay&&s.run.finalPlan&&!s.run.pendingEncounter&&s.run.slot>=2){s=C.reduceGame(s,{type:'EXECUTE_FINAL_PLAN'});continue}
    if(s.lender.balance&&s.player.cash>=s.lender.balance+100&&s.run.day>=2){s=C.reduceGame(s,{type:'PAY_DEBT',amount:s.lender.balance});continue}
    if(s.player.heat>p.heatCap){s=C.reduceGame(s,{type:'LAY_LOW'});continue}
    const next=p.areas[(Math.max(0,p.areas.indexOf(area))+1)%p.areas.length],busCovered=s.world.transport.weekPass||s.world.transport.dayPassDay===s.run.day;s=next===area?C.reduceGame(s,{type:'END_MARKET'}):next==='north_star_lot'&&s.player.cash<5&&!busCovered?C.reduceGame(s,{type:'WALK_HOME'}):['downtown','north_star_lot'].includes(next)&&s.player.cash<5&&!busCovered?C.reduceGame(s,{type:'END_MARKET'}):['downtown','north_star_lot'].includes(next)?C.reduceGame(s,{type:'BUS_TRAVEL',neighborhoodId:next}):C.reduceGame(s,{type:'TRAVEL',neighborhoodId:next});
  }s=settle(s,p,beats);const summary=C.selectRunSummary(s);summary.completed=s.run.status==='ended';summary.finalState={day:s.run.day,slot:s.run.slot,energy:s.player.energy,phase:s.run.phase,pending:s.run.pendingEncounter?.id||s.run.pendingEvent?.id||null,dayEnd:s.run.dayEndPending,overtime:s.run.overtimeArmed,baseVisiting:s.base.visiting};summary.decisions=s.stats.decisions;summary.encounters=s.run.encounterCount;summary.baseValue=C.selectors.baseValue(s);summary.crew=C.selectors.recruitedCrew(s).length;summary.dealer={...(s.people.dealers?.goodie||{})};summary.meaningfulActions=s.player.behavior.meaningfulActions;summary.gymStreak=s.player.gymStreak||0;summary.derivedRatings=Object.values(C.selectors.derivedRatings(s)).join('/');summary.garageDay=s.base.acquiredDay||0;summary.evicted=s.people.household.evicted?1:0;summary.discoveries=s.world.locations.discoveries.length;summary.attributeGains=Object.values(s.player.attributes).reduce((n,v)=>n+Math.max(0,v-1),0);summary.combat=s.player.attributes.combat;summary.charisma=s.player.attributes.charisma;summary.intelligence=s.player.attributes.intelligence;summary.streetReadTier=s.streetRead.tier;summary.streetReadScore=s.streetRead.score;summary.streetReadEntries=s.streetRead.totalLifetimeEntries;summary.employerStanding=s.world.locations.employer.standing;summary.gamblingNet=s.world.locations.gambling.net;summary.arrests=s.record?.arrests||0;summary.crewJailed=Object.values(s.people.crew).filter(c=>c.status==='arrested').length;Object.assign(summary,storyMetrics(s,beats));Object.assign(summary,exposureMetrics(s));Object.assign(summary,territoryMetrics(s));if(p.market){marketSamples.push({day:s.run.day,tier:C.selectors.marketTier(s),profit:s.nineZeroSevenList.profit});Object.assign(summary,marketMetrics(s,marketSamples))}return summary}
function summarize(name,count){const runs=Array.from({length:count},(_,i)=>play(1000+i,name)),endings={};for(const r of runs)endings[r.endingLabel]=(endings[r.endingLabel]||0)+1;const avg=k=>Math.round(runs.reduce((n,r)=>n+(r[k]||0),0)/count);const robbery=k=>runs.reduce((n,r)=>n+(r.robbery?.[k]||0),0);return{strategy:name,runs:count,completed:runs.filter(r=>r.completed).length,averageCash:avg('cash'),averageNetWorth:avg('netWorth'),averageOperationScore:avg('operationScore'),averageDebt:avg('debt'),averageHighestHeat:avg('highestHeat'),averageDecisions:avg('decisions'),averageEncounters:avg('encounters'),averageBaseValue:avg('baseValue'),averageCrew:avg('crew'),robAttempts:robbery('attempts'),robSuccesses:robbery('successes'),robFailures:robbery('failures'),robPayout:robbery('totalPayout'),territoryAttempts:runs.reduce((n,r)=>n+(r.takeovers?.attempts||0),0),arrests:runs.reduce((n,r)=>n+(r.arrests||0),0),crewJailedAtEnd:runs.reduce((n,r)=>n+(r.crewJailed||0),0),deadEnds:runs.filter(r=>!r.completed).length,
  averageStoryBeats:Number((runs.reduce((n,r)=>n+r.storyBeats,0)/count).toFixed(1)),
  averageAmbientBeats:Number((runs.reduce((n,r)=>n+r.ambientBeats,0)/count).toFixed(1)),
  averageAmbientVariety:Number((runs.reduce((n,r)=>n+r.ambientVariety,0)/count).toFixed(1)),
  minaReachedStage4:Number((100*runs.filter(r=>r.minaChainDepth>=4).length/count).toFixed(0)),
  minaReachedStage6:Number((100*runs.filter(r=>r.minaChainDepth>=6).length/count).toFixed(0)),
  chainStallRuns:runs.reduce((n,r)=>n+r.chainStall,0),
  taxActiveRuns:runs.reduce((n,r)=>n+r.taxActive,0),
  curtisBetrayedRuns:runs.reduce((n,r)=>n+r.curtisBetrayed,0),
  // v1.18: the three numbers Tone's gate is made of. watchingPhaseRuns is the
  // awareness half, toneProvenRuns the ledger half, toneRecruitedRuns the hire.
  averageCurtisAwareness:Number((runs.reduce((n,r)=>n+r.curtisAwareness,0)/count).toFixed(2)),
  ambientPhaseRuns:runs.filter(r=>r.curtisAwareness>=3).length,
  watchingPhaseRuns:runs.filter(r=>r.curtisAwareness>=7).length,
  bothHalvesRuns:runs.filter(r=>r.curtisAwareness>=3&&r.toneProven).length,
  toneProvenRuns:runs.reduce((n,r)=>n+r.toneProven,0),
  toneRecruitedRuns:runs.reduce((n,r)=>n+r.toneRecruited,0),
  pherrisProvenRuns:runs.reduce((n,r)=>n+r.pherrisProven,0),
  pherrisRecruitedRuns:runs.reduce((n,r)=>n+r.pherrisRecruited,0),
  ...Object.fromEntries(C.EXPOSURE_NPC_IDS.flatMap(id=>[
    ['average'+id[0].toUpperCase()+id.slice(1)+'Score',Number((runs.reduce((n,r)=>n+r[id+'Score'],0)/count).toFixed(2))],
    ['average'+id[0].toUpperCase()+id.slice(1)+'Rows',Number((runs.reduce((n,r)=>n+r[id+'Rows'],0)/count).toFixed(1))],
  ])),
  // v1.20 territory retention. blockLossRate is the acceptance number for
  // Tone's defense modifier: claimed corners that ended the run in Curtis's
  // hands, over corners claimed at all.
  territory:(()=>{const claimed=runs.reduce((n,r)=>n+(r.blocksClaimed||0),0),lost=runs.reduce((n,r)=>n+(r.blocksLost||0),0);
    return {claimed,held:runs.reduce((n,r)=>n+(r.blocksHeld||0),0),lost,
      raids:runs.reduce((n,r)=>n+(r.blockRaids||0),0),income:runs.reduce((n,r)=>n+(r.blockIncome||0),0),
      lossRate:claimed?Number((lost/claimed).toFixed(3)):0};})(),
  dealerRobberies:runs.reduce((n,r)=>n+(r.dealer?.robbedCount||0),0),
  dealerGone:runs.filter(r=>r.dealer?.gone).length,
  averageDealerStanding:Number((runs.reduce((n,r)=>n+(r.dealer?.standing||0),0)/count).toFixed(1)),
  identityAssignments:runs.reduce((out,r)=>{out[r.streetIdentity||'New Face']=(out[r.streetIdentity||'New Face']||0)+1;return out},{}),
  runsRemainingNewFace:runs.filter(r=>!r.streetIdentity||r.streetIdentity==='New Face').length,
  averageMeaningfulActions:Number((runs.reduce((n,r)=>n+(r.meaningfulActions||0),0)/count).toFixed(1)),
  averageGarageDay:Number((runs.reduce((n,r)=>n+(r.garageDay||0),0)/Math.max(1,runs.filter(r=>r.garageDay).length)).toFixed(1)),
  garageAcquisitions:runs.filter(r=>r.garageDay).length,evictions:runs.reduce((n,r)=>n+r.evicted,0),averageDiscoveries:avg('discoveries'),averageAttributeGains:avg('attributeGains'),averageCombat:avg('combat'),averageCharisma:avg('charisma'),averageIntelligence:avg('intelligence'),averageStreetReadTier:avg('streetReadTier'),averageStreetReadScore:avg('streetReadScore'),averageStreetReadEntries:avg('streetReadEntries'),averageEmployerStanding:avg('employerStanding'),averageGamblingNet:avg('gamblingNet'),averageGymStreak:avg('gymStreak'),
  derivedRatingDistribution:runs.reduce((out,r)=>{const key=r.derivedRatings||'1/1/1';out[key]=(out[key]||0)+1;return out},{}),
  ...(strategies[name].market?{market:{
    averageFlips:Number((runs.reduce((n,r)=>n+(r.marketFlips||0),0)/count).toFixed(1)),
    averageDisputes:Number((runs.reduce((n,r)=>n+(r.marketDisputes||0),0)/count).toFixed(2)),
    averageProfit:avg('marketProfit'),
    robberies:runs.reduce((n,r)=>n+(r.marketRobberies||0),0),
    requestsFilled:runs.reduce((n,r)=>n+(r.marketFilled||0),0),
    specialistRuns:runs.filter(r=>r.marketSpecialist).length,
    tierReach:{1:runs.filter(r=>r.marketTier>=1).length,2:runs.filter(r=>r.marketTier>=2).length,3:runs.filter(r=>r.marketTier>=3).length},
    // The Task 1/2/3 acceptance numbers. Each is total profit earned while the
    // tier was active, over total days spent at it, across every run.
    dailyIncomeByTier:Object.fromEntries([1,2,3].map(tier=>{
      const days=runs.reduce((n,r)=>n+(r.marketPerTier?.[tier]?.days||0),0);
      const profit=runs.reduce((n,r)=>n+(r.marketPerTier?.[tier]?.profit||0),0);
      return [tier,{days,profit,perDay:days?Number((profit/days).toFixed(1)):0,target:C.MARKET.TIER_INCOME_TARGETS[tier]}];
    })),
  }}:{}),
  legacySaveSmoke:C.selectors.derivedRatings(C.hydrateRun({...C.reduceGame(C.createRun({seed:99}),{type:'START_RUN',streetName:'Legacy'}),player:{...C.reduceGame(C.createRun({seed:99}),{type:'START_RUN',streetName:'Legacy'}).player,background:'shooter',attributes:undefined}})),
  endings}}
if(require.main===module){
  const names=Object.keys(strategies),totalMode=process.argv[2]==='--total';
  const requested=Math.max(1,Number(process.argv[totalMode?3:2]||200));
  const results=totalMode
    ? names.map((name,index)=>summarize(name,Math.floor(requested/names.length)+(index<requested%names.length?1:0)))
    : names.map(name=>summarize(name,requested));
  console.log(JSON.stringify(results,null,2));
}
module.exports={play,summarize,strategies};
