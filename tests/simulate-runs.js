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
// v1.25 adds the four rungs BELOW a claim. Reporting only `blocksClaimed` meant
// a flat zero for every strategy with no way to see which rung it fell off, and
// the v1.24 audit guessed wrong about which one it was. These are cheap reads and
// they turn "the sim never claims" into a diagnosis.
function territoryMetrics(state){
  const blocks=Object.values(state.world.territoryBlocks||{});
  const claimed=blocks.filter(b=>b.capturedDay!=null);
  const eli=state.people?.crew?.eli||{};
  const soldiers=Object.values(state.world.soldiers||{});
  return {blocksClaimed:claimed.length,blocksHeld:blocks.filter(b=>b.owner==='player').length,
    blocksLost:claimed.filter(b=>b.owner!=='player').length,
    blockRaids:blocks.reduce((n,b)=>n+(b.raidCount||0),0),
    blockIncome:blocks.reduce((n,b)=>n+(b.incomeCollected||0),0),
    eliIntroduced:eli.introduced?1:0,eliRecruitable:eli.contactStage==='recruitable'?1:0,
    eliRecruited:eli.recruited?1:0,eliLoyalty:eli.loyalty||0,
    eliLieutenant:eli.lieutenantStage==='operations_lieutenant'?1:0,
    soldiersEverHired:soldiers.length};
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

// v1.25. Cash the `territory` strategy refuses to spend on anything except the
// next rung of the territory ladder.
//
// The measurement that motivated this: no strategy had EVER held the garage and
// a crew member in the same run - `operator` leases in 1 of 200 runs and
// recruits in 76, but the intersection was 0, and `stickup` is the mirror image
// at 18 and 1. Territory needs garage, then Eli, then his promotion, then a
// soldier, and the trade loop below spends 58% of cash on inventory every single
// pass. The lease branch already sits above the trade block; it loses anyway
// because the previous iteration already spent the money. So the fix is to stop
// spending it, not to reorder anything.
//
// Every other strategy leaves `bankForTerritory` undefined, gets 0 here, and
// trades against its full balance exactly as it did before this existed.
// Measured, both ways round. Keeping a trading float so the strategy can still
// restock while banking sounds obviously right and is worse: with a $140 float
// the garage rate drops from 178/200 to 116/200 and the lieutenant from 81 to 9,
// because this profile's trade loop returns less than it ties up on a bankroll
// this thin. Banking outright wins, so the reserve is the whole target.
// v1.30. Employment telemetry, and the reason the strategy exists: until now
// nothing in the harness held a job, so applyAttendance had never once run in
// a simulated CONFIRM_END_DAY and the v1.29 ladder was verified only by unit
// tests. These keys are what a future build that breaks it would move.
// `wages` is passed in rather than read off state because nothing totals job
// income - addCleanCash moves a balance, it does not keep a running sum - so
// the loop accumulates it from the cash delta across each shift.
function employmentMetrics(s,wages){
  const records=Object.values(s.jobs.records||{});
  const active=s.jobs.activeJobId;
  return{
    jobHeld:active&&active!=='day_labor'?1:0,
    jobRank:active?(s.jobs.records[active]?.rank||0):0,
    shiftsWorked:records.reduce((n,r)=>n+(r.shifts||0),0),
    wagesEarned:wages,
    // Every one of these should stay flat at zero. The ladder counts
    // consecutive days that ended without a shift, so a strategy that works
    // whenever a shift is offered never reaches rung one - and if a future
    // change makes it reachable, this is the number that moves.
    missedShiftPeak:Math.max(0,...Object.values(s.jobs.missedShifts||{}),0),
    rentMissed:s.npc.yalonda?.rentMissed||0,
    phonePastDue:s.phone.daysPastDue||0,
    householdWarnings:s.people.household.warnings||0,
  };
}
// The employment turn. Free actions first: rent and the phone cost no slot, and
// a lapsed phone silently ends the whole thread, because APPLY_JOB and the
// callback that answers it both require a live line. Then the job ladder.
// Returns the next state, or null when there was nothing worth doing - same
// contract as marketTurn. Every branch compares before returning so a dispatch
// the reducer refuses can never spin the tick loop into the guard.
function workerTurn(s,p,shift,maxDays){
  const moved=(next)=>next!==s?next:null;
  // Rent first, and the order is the point. Both come due on day 7 and together
  // they are $225 against a starting $100, so on a thin week only one of them
  // gets paid. Rent is the one the lose condition is made of - two unpaid
  // periods raise a household warning and three warnings is an eviction - while
  // a lapsed phone is recoverable and costs nothing once the player is already
  // hired. Paying the cheaper bill first because it fits is how a simulated
  // responsible citizen ends up evicted.
  if(!s.people.household.evicted&&s.run.day>=s.obligations.rentDueDay&&s.player.cash>=C.WEEKLY_RENT){
    const next=moved(C.reduceGame(s,{type:'PAY_RENT'}));if(next)return next;
  }
  // The phone only comes after rent is settled, or is not yet due.
  if(s.player.cash>=C.PHONE_BILL&&(s.run.day>=s.phone.billDueDay||s.phone.daysPastDue>0||!s.phone.active)
     &&(s.people.household.evicted||s.run.day<s.obligations.rentDueDay||s.player.cash>=C.WEEKLY_RENT+C.PHONE_BILL)){
    const next=moved(C.reduceGame(s,{type:'PAY_PHONE_BILL',surface:'store'}));if(next)return next;
  }
  // v1.33. Sleep when hurt, which is the third thing a person does that the
  // harness had never done once. SLEEP_HOME heals 12 for one slot and the
  // simulator dispatched it ZERO times in its entire history - so v1.32
  // measured health as a one-way ratchet and concluded the engine had no way
  // back, when in fact the way back was a free action nobody was taking. Same
  // shape as rent (14 of 15 never paid) and Dre's note (15 of 15 never
  // borrowed): an engine mechanic that looked broken because the instrument
  // never exercised it.
  //
  // The threshold is a decision, not a constant: rest below half health, so a
  // scratch does not cost a slot but a real wound does.
  // Not at the horizon: past maxDays the run is trying to cash out, and a
  // strategy that keeps going to bed instead never reaches its own ending.
  // Left unguarded this overshot the horizon by eight days.
  if(!p.skipRest&&s.run.day<maxDays&&s.player.health<(p.restBelow??50)&&!s.people.household.evicted){
    const next=moved(C.reduceGame(s,{type:'SLEEP_HOME'}));if(next)return next;
  }
  // Bills above are for every profile; everything below is the job ladder and
  // belongs only to the employment strategy.
  if(!p.employment)return null;
  // The shift comes before anything discretionary, and this ordering is the
  // whole difference between a strategy that holds a job and one that owns a
  // job. Left after the 907List turn, a flip eats the slot the shift needed and
  // the day ends without one - which is a missed shift on the attendance
  // ladder, from a strategy whose entire premise is that it shows up.
  {
    const job=C.selectors.discoveredJobs(s).find(job=>C.selectors.jobAvailability(s,job.id).available);
    if(job){const before=s.player.cleanCash;const next=moved(C.reduceGame(s,{type:'WORK_JOB',jobId:job.id,approach:'work_hard'}));if(next){shift(before,next);return next}}
  }
  // A live offer is free to accept and ends the search.
  if(!s.jobs.activeJobId&&s.jobs.offers.length){
    const next=moved(C.reduceGame(s,{type:'ACCEPT_JOB',jobId:s.jobs.offers[0]}));if(next)return next;
  }
  // One application at a time, best ceiling first, ties broken by id so the
  // choice is deterministic rather than array-order luck. A failed interview
  // drops the application and the next tick re-applies, which makes the roll a
  // delay instead of a dead end.
  if(!s.jobs.activeJobId&&!s.jobs.applications.length&&s.phone.active){
    const target=C.selectors.discoveredJobs(s)
      .filter(job=>!job.dayLabor&&!s.jobs.offers.includes(job.id))
      .sort((a,b)=>(b.pay[1]-a.pay[1])||(a.id<b.id?-1:1))[0];
    if(target){const next=moved(C.reduceGame(s,{type:'APPLY_JOB',jobId:target.id}));if(next)return next;}
  }
  return null;
}
function territoryTarget(s,p){
  if(!s.base.controlled)return C.GARAGE_DEPOSIT;
  const crew=s.people.crew[p.crew];
  if(crew&&!crew.recruited)return C.selectors.recruitmentCost(s,p.crew)||0;
  if(!C.selectors.eliLieutenantActive(s))return 0;
  // A spare soldier is worth nothing standing in the garage, so once one is free
  // the cheapest corner is what the money is for. Without this the
  // soldier-recruit branch kept buying bodies and the claim never had $180.
  const spare=Object.values(s.world.soldiers||{}).some(x=>x.status==='active'&&!x.blockId);
  if(spare)return Math.min(...C.SPENARD_BLOCKS.map(b=>b.claimCost));
  return C.SOLDIER_RECRUIT_COST||0;
}
function territoryReserve(s,p){
  if(!p.bankForTerritory)return 0;
  return territoryTarget(s,p);
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
  // v1.32. The eviction-ladder instrument, and the one profile that deliberately
  // does not pay. Chosen for lifespan: it survives into the mid-30s, so it
  // actually reaches the ladder, where `stickup` is arrested around day 7 and
  // never gets there. Worth knowing when reading its number: trainer is both a
  // will-not-pay and a cannot-pay - measured WITH bills enabled it still evicted
  // in 75% of runs, because it spends its cash on the gym. Both readings are
  // real; this flag makes the first one deliberate instead of accidental.
  trainer:{caught:['fight','run','surrender'],products:[],areas:['north_star_lot'],profit:2,heatCap:3,plan:'defend',track:'recovery',gear:'running_shoes',crew:'eli',encounter:['run','talk','fight','surrender'],mode:'trainer',skipBills:true},
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
  // v1.25. The instrument for the block layer, which nothing else reaches.
  // `operator` was supposed to be this and is not: see territoryReserve above
  // for the measurement. Differences from `operator`, and they are the whole
  // strategy: it banks rather than restocking while the ladder is unfunded, it
  // leases at the reducer's real gate ($650) instead of the self-imposed $850,
  // and it leases as early as day 2. Spenard only - there are no blocks
  // anywhere else, so Downtown is a wasted slot for this one.
  territory:{caught:['run','fight','surrender'],products:['weed','shrooms'],areas:['north_star_lot'],profit:1.12,heatCap:8,plan:'defend',track:'operations',gear:'utility_knife',crew:'eli',encounter:['talk','run','fight','pay','surrender'],mode:'mixed',property:true,operator:true,bankForTerritory:true,leaseAt:C.GARAGE_DEPOSIT,leaseDay:2,recruitBy:99},
  // v1.30. The instrument for employment, which nothing else reaches. The
  // fourteen above dispatch WORK_JOB but never APPLY_JOB or ACCEPT_JOB, and
  // jobAvailability requires activeJobId===jobId for every employer that is
  // not day labor - so the only work any of them has ever done is the one job
  // the attendance ladder exempts. This one holds a real employer, which means
  // applyAttendance finally runs inside the sim's CONFIRM_END_DAY pass.
  //
  // The responsible citizen: no crime, no territory, no product. It works,
  // pays rent and the phone on the day they come due, and flips 907List on the
  // side for the supplemental income a single wage does not cover. `plan` is
  // not decoration - PREPARE_FINAL_PLAN/EXECUTE_FINAL_PLAN is how every run in
  // this harness terminates, and a profile without one would burn the 500
  // iteration guard and report as a dead end. heatCap 2 keeps the interview
  // roll near its ceiling, since the callback chance falls off above Heat 4.
  // marketFloat is the bill reserve, doing the same job territoryReserve does
  // for the territory profile: obligations stay in the pocket instead of
  // becoming inventory, so a flip can never be the reason the rent was late.
  // It is the one number that keeps "pays its obligations" true rather than
  // aspirational, and it was measured rather than guessed: at rent+phone the
  // strategy still missed rent in 2 runs of 40 and let the phone lapse in 3,
  // because a 907List buy on day 6 cleared the reserve and day 7 wants both
  // bills at once. At the rent due, the phone, and the rent after that, 100
  // runs come back clean on every obligation.
  // v1.33. The sixteenth strategy, and it exists because Dre's note had never
  // been exercised once. settle() answered `dre_terms` with the last choice -
  // "Leave it with him" - for every strategy on every seed since the harness
  // was written, so the loan, the 8%-of-balance daily fee, the collector tier
  // ladder, the dre_collector encounter and the `still_owing` ending were all
  // unreachable. The third coverage hole of this shape after rent and rest.
  //
  // It borrows the thousand and trades on it, which is what the note is for,
  // and repays through the PAY_DEBT branch the loop already had. Whether the
  // compounding is survivable is the thing being measured, so nothing here
  // tries to protect it from the fee schedule.
  debtor:{caught:['run','surrender','fight'],products:['weed','shrooms'],areas:['north_star_lot','downtown'],profit:1.12,heatCap:5,plan:'escape',track:'storage',gear:'running_shoes',crew:'eli',encounter:['talk','run','pay','surrender'],mode:'trader',takeLoan:true},
  worker:{caught:['surrender','run','fight'],products:[],areas:['north_star_lot'],profit:2,heatCap:2,plan:'escape',track:'storage',gear:'running_shoes',crew:'eli',encounter:['talk','run','pay','surrender'],mode:'legal',employment:true,payBills:true,market:true,marketMargin:12,marketFloat:C.WEEKLY_RENT*2+C.PHONE_BILL,marketQuick:true,marketRiskCap:0.14},
};
// v1.32. Health telemetry, and it exists because "killed" became the dominant
// end cause the moment runs got long enough to reach it - four purely legal,
// low-Heat strategies die in 8 of 8 runs around day 35. Before tuning a single
// health constant somebody has to know whether that is the engine or the
// instrument, and there is strong reason to think it is partly the instrument:
// the harness contains exactly ONE healing dispatch in its whole history
// (NILE_WELLNESS, in the gambler branch), the same 14-of-15 shape that hid the
// rent bug. `gambler` is the only strategy with zero killed deaths.
//
// This wraps dispatch to attribute every health delta to the action that caused
// it. Pure observation - it records and returns, changes no state and draws no
// RNG - so it cannot move a hash by itself.
// v1.33 generalises it. Health was the first of a cluster - Heat and Dre's note
// are the other two ratchets that were bounded only by the run ending, and all
// three need the same treatment: attribute every point to the action that moved
// it, so a balance pass tunes against a measurement instead of an intuition.
function pressureLedger(){
  const track=(key)=>({up:{},down:{},ups:0,downs:0});
  const meters={health:track(),heat:track()};
  return {
    meters,
    record(action,key,before,after){
      const m=meters[key]; if(!m)return;
      const delta=after-before;
      if(delta>0){m.up[action]=(m.up[action]||0)+delta;m.ups+=1}
      else if(delta<0){m.down[action]=(m.down[action]||0)-delta;m.downs+=1}
    },
    summary(){
      const total=(o)=>Object.values(o).reduce((n,v)=>n+v,0);
      const top=(o)=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>k+':'+v).join(' ');
      const h=meters.health,t=meters.heat;
      return {
        // Health: `up` is healing. v1.32 found it happens twice in ninety runs.
        healthLost:total(h.down),healthHealed:total(h.up),healDispatches:h.ups,
        healthLostBy:top(h.down),healthHealedBy:top(h.up),
        // Heat: `down` is relief, and all of it is elective - there is no
        // passive decay anywhere in the engine.
        heatGained:total(t.up),heatShed:total(t.down),heatReliefDispatches:t.downs,
        heatGainedBy:top(t.up),heatShedBy:top(t.down),
      };
    },
  };
}
function settle(state,profile,beats){let s=state,guard=0;const note=(id)=>{if(beats&&(!beats.length||beats[beats.length-1].id!==id))beats.push({id,slot:(s.run.day-1)*4+s.run.slot})};while(guard++<20){if(s.run.openingPending){s=C.reduceGame(s,{type:'DISMISS_OPENING'});continue}if(s.run.daySummary){s=C.reduceGame(s,{type:'DISMISS_DAY_SUMMARY'});continue}if(s.run.pendingOperationResult){s=C.reduceGame(s,{type:'ACKNOWLEDGE_OPERATION_RESULT'});continue}if(s.run.pendingEncounter){note(s.run.pendingEncounter.id);const available=C.selectors.encounterChoices(s).map(c=>c.id);const posture=s.run.pendingEncounter.type==='boost_caught'?(profile.caught||[]):profile.encounter;const choice=posture.find(id=>available.includes(id))||profile.encounter.find(id=>available.includes(id))||available[0];s=C.reduceGame(s,{type:'RESOLVE_ENCOUNTER',choiceId:choice});continue}if(s.run.pendingEvent){note(s.run.pendingEvent.id);const choices=s.run.pendingEvent.choices;let index=s.run.pendingEvent.id==='dre_terms'?(profile.takeLoan?0:choices.length-1):choices.findIndex(c=>(c.effect?.cash||0)>=0);if(index<0)index=choices.findIndex(c=>Math.abs(c.effect?.cash||0)<=s.player.cash);s=C.reduceGame(s,{type:'RESOLVE_EVENT',choiceIndex:index<0?choices.length-1:index});continue}if(s.run.dayEndPending){s=C.reduceGame(s,{type:'CONFIRM_END_DAY'});continue}break}return s}
function play(seed,name){const p=strategies[name];
  const health=pressureLedger();
  const rawReduce=C.reduceGame;
  // Swapped for the run and restored in the finally below. Every dispatch the
  // loop makes, including the ones inside settle(), is accounted.
  C.reduceGame=(st,ac)=>{const bh=st.player?.health,bt=st.player?.heat;const next=rawReduce(st,ac);
    if(typeof bh==='number'&&typeof next.player?.health==='number')health.record(ac.type,'health',bh,next.player.health);
    if(typeof bt==='number'&&typeof next.player?.heat==='number')health.record(ac.type,'heat',bt,next.player.heat);
    return next;};
  try{
  let s=C.reduceGame(C.createRun({seed}),{type:'START_RUN',streetName:`Sim ${seed}`}),guard=0;const beats=[];const marketSamples=[];let wages=0;
    // Nothing in game-core totals job income - addCleanCash moves a balance, it
    // does not keep a running sum - so the shift payout is read as the clean
    // cash a WORK_JOB dispatch adds. Positive deltas only, and it is a floor
    // rather than a receipt: a shift that ends up crossing a day nets whatever
    // that rollover spent against the wage. For this strategy that is nearly
    // nothing (it holds no crew, and rent and the phone are separate
    // dispatches), which is what makes the number worth reporting.
    const shift=(before,after)=>{wages+=Math.max(0,after.player.cleanCash-before)};
    // v1.31. The game no longer ends a run on a day count, so the instrument
    // has to own its own boundary - which is what it always should have been.
    // maxDays is generous on purpose: territory is mid-to-late-game content and
    // the old ten-day window could not fund it, so measuring against that
    // window measured the window rather than the game. A strategy that goes
    // broke, gets hurt, or gets arrested still exits early through the real
    // fail-state; this only catches the ones still standing.
    const maxDays=p.maxDays??40;
    const tickCap=maxDays*20;
    while(s.run.status==='playing'&&guard++<tickCap){s=settle(s,p,beats);if(s.run.status!=='playing')break;
    // Sampled before the day's actions so a tier's income is credited to the
    // tier that was actually active while it was being earned.
    if(p.market&&s.knowledge.knows907List&&(!marketSamples.length||marketSamples[marketSamples.length-1].day!==s.run.day)){
      marketSamples.push({day:s.run.day,tier:C.selectors.marketTier(s),profit:s.nineZeroSevenList.profit});
    }
    // v1.32. Every profile pays what it owes unless it is the deliberate
    // control. Until now exactly ONE strategy of fifteen had ever dispatched
    // PAY_RENT - `worker`, via the payBills flag added in v1.30 - which never
    // mattered while runs ended at day 10, before eviction could land. At 40
    // days it meant the whole table measured "what happens if nobody pays rent"
    // rather than "is rent affordable". This is pay-when-the-cash-is-there on
    // the due day, NOT a reserve: a profile whose money is in inventory or the
    // gym still misses, which is the honest reading.
    // The bot cashes out at its horizon, through the same voluntary ending a
    // player uses. No special terminator, and no day the game imposes.
    //
    // v1.33 moved this to the top of the tick. Below the market turn it was
    // advisory rather than binding: once v1.33's rest rule stopped the legal
    // strategies dying at ~day 35, flipper and broker simply kept trading and
    // ran to day 47 without ever reaching their own ending. A horizon that
    // other business can outrank is not a horizon.
    if(s.run.day>=maxDays&&!s.run.finalPlanPrepared){s=C.reduceGame(s,{type:'PREPARE_FINAL_PLAN',planId:p.plan});continue}
    if(s.run.day>=maxDays&&s.run.finalPlan&&!s.run.pendingEncounter){s=C.reduceGame(s,{type:'EXECUTE_FINAL_PLAN'});continue}
    if(!p.skipBills){const next=workerTurn(s,p,shift,maxDays);if(next&&next!==s){s=next;continue}}
    if(p.market){const next=marketTurn(s,p);if(next&&next!==s){s=next;continue}}
    if(s.run.phase==='week_zero'){
      if(s.run.slot>=2&&!s.nightOwl.boardViewedDays.includes(s.run.day)){s=C.reduceGame(s,{type:'VIEW_NIGHT_OWL_BOARD'});continue}
      if(s.run.slot>=2&&!s.npc.mina.met){s=C.reduceGame(s,{type:'VISIT_NIGHT_OWL'});continue}
      const regular=C.selectors.nightOwlRegularFor(s),regularState=s.nightOwl.regulars[regular.id];
      if(s.run.slot>=2&&regularState.lastTalkDay!==s.run.day){s=C.reduceGame(s,{type:'TALK_NIGHT_OWL_REGULAR',regularId:regular.id});continue}
      const job=C.selectors.discoveredJobs(s).find(entry=>C.selectors.jobAvailability(s,entry.id).available);
      if(job){const before=s.player.cleanCash;s=C.reduceGame(s,{type:'WORK_JOB',jobId:job.id,approach:p.mode==='legal'?'work_hard':'socialize'});shift(before,s);continue}
      s=C.reduceGame(s,{type:'WANDER_SPENARD'});continue;
    }
    if((p.mode==='trader'||p.mode==='mixed'||p.mode==='stickup')&&!s.world.productAccess.weed){s=C.reduceGame(s,{type:'EXPLORE_SPENARD'});continue}
    if(p.mode==='gambler'&&!s.world.locations.gamblingKnown){s=C.reduceGame(s,{type:'EXPLORE_SPENARD'});continue}
    if(p.mode==='legal'){const job=C.selectors.discoveredJobs(s).find(job=>C.selectors.jobAvailability(s,job.id).available);if(job){const before=s.player.cleanCash;s=C.reduceGame(s,{type:'WORK_JOB',jobId:job.id,approach:'work_hard'});shift(before,s);continue}}
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
    if(p.property&&!s.base.controlled&&s.run.day>=(p.leaseDay??3)&&s.player.cash>=(p.leaseAt??850)){s=C.reduceGame(s,{type:'LEASE_GARAGE'});continue}
    const area=s.world.currentNeighborhoodId,market=s.world.markets[area];for(const id of p.products){if(!s.world.productAccess[id])continue;const item=s.player.inventory[id],sell=C.selectors.tradeUnitPrices(s,id).sell;if(item.qty&&sell>=item.avgCost*p.profit)s=C.reduceGame(s,{type:'SELL',productId:id,qty:item.qty})}const room=C.selectors.cargoCapacity(s)-C.selectors.cargoUsed(s);if(room>0){
      // Read AFTER the sells above, which is where the old `s.player.cash` was
      // read too - snapshotting it any earlier changes the buy budget for every
      // strategy that carries product, and seven of the thirteen do.
      const spendable=Math.max(0,s.player.cash-territoryReserve(s,p));
      const candidates=p.products.filter(id=>s.world.productAccess[id]).map(id=>({id,price:C.selectors.tradeUnitPrices(s,id).buy,available:market.availability[id]})).filter(x=>x.available&&x.price<=spendable).sort((a,b)=>a.price-b.price);if(candidates.length){const x=candidates[0],qty=Math.min(room,x.available,Math.floor(spendable*.58/x.price));if(qty)s=C.reduceGame(s,{type:'BUY',productId:x.id,qty})}}
    const firstUpgrade=C.BASE_UPGRADES.find(u=>u.track===p.track&&u.level===1),gear=C.GEAR.find(g=>g.id===p.gear),crew=C.CREW.find(c=>c.id===p.crew),crewState=s.people.crew[p.crew];
    const operationAction=()=>s.base.visiting?s:C.reduceGame(s,{type:'VISIT_BASE'});
    const eliTest=p.crew==='eli'?C.selectors.eliTestRouteAvailability(s):null;
    if(eliTest?.available){s=C.reduceGame(s,{type:'ELI_TEST_ROUTE'});continue}
    if(s.base.controlled&&s.run.day<=3&&!s.base.tracks[p.track]&&s.player.cash>=firstUpgrade.cost){s=operationAction();s=settle(s,p,beats);if(s.base.visiting)s=C.reduceGame(s,{type:'UPGRADE_BASE',track:p.track});continue}
    if(s.base.controlled&&s.run.day<=4&&!s.player.gear.owned.includes(p.gear)&&s.player.cash>=gear.cost){s=operationAction();s=settle(s,p,beats);if(s.base.visiting)s=C.reduceGame(s,{type:'BUY_GEAR',gearId:p.gear});continue}
    // v1.25: `recruitBy` widens the window. The cap exists so most profiles do
    // not spend late-run cash on a body they will not use; the territory
    // strategy needs the opposite, because Eli's introduction is a story beat it
    // cannot force and the day-5 cap threw the run away whenever it landed late.
    if(s.base.controlled&&s.run.day<=(p.recruitBy??5)&&crewState.introduced&&!crewState.recruited&&(p.crew!=='eli'||crewState.contactStage==='recruitable')&&s.player.cash>=C.selectors.recruitmentCost(s,p.crew)){s=operationAction();s=settle(s,p,beats);if(s.base.visiting)s=C.reduceGame(s,{type:'RECRUIT_CREW',crewId:p.crew});continue}
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
    if(s.lender.balance&&s.player.cash>=s.lender.balance+100&&s.run.day>=2){s=C.reduceGame(s,{type:'PAY_DEBT',amount:s.lender.balance});continue}
    if(s.player.heat>p.heatCap){s=C.reduceGame(s,{type:'LAY_LOW'});continue}
    const next=p.areas[(Math.max(0,p.areas.indexOf(area))+1)%p.areas.length],busCovered=s.world.transport.weekPass||s.world.transport.dayPassDay===s.run.day;s=next===area?C.reduceGame(s,{type:'END_MARKET'}):next==='north_star_lot'&&s.player.cash<5&&!busCovered?C.reduceGame(s,{type:'WALK_HOME'}):['downtown','north_star_lot'].includes(next)&&s.player.cash<5&&!busCovered?C.reduceGame(s,{type:'END_MARKET'}):['downtown','north_star_lot'].includes(next)?C.reduceGame(s,{type:'BUS_TRAVEL',neighborhoodId:next}):C.reduceGame(s,{type:'TRAVEL',neighborhoodId:next});
  }s=settle(s,p,beats);const summary=C.selectRunSummary(s);summary.completed=s.run.status==='ended';summary.finalState={day:s.run.day,slot:s.run.slot,energy:s.player.energy,phase:s.run.phase,pending:s.run.pendingEncounter?.id||s.run.pendingEvent?.id||null,dayEnd:s.run.dayEndPending,overtime:s.run.overtimeArmed,baseVisiting:s.base.visiting};summary.decisions=s.stats.decisions;summary.encounters=s.run.encounterCount;summary.baseValue=C.selectors.baseValue(s);summary.crew=C.selectors.recruitedCrew(s).length;summary.dealer={...(s.people.dealers?.goodie||{})};summary.meaningfulActions=s.player.behavior.meaningfulActions;summary.gymStreak=s.player.gymStreak||0;summary.derivedRatings=Object.values(C.selectors.derivedRatings(s)).join('/');summary.garageDay=s.base.acquiredDay||0;summary.evicted=s.people.household.evicted?1:0;summary.discoveries=s.world.locations.discoveries.length;summary.attributeGains=Object.values(s.player.attributes).reduce((n,v)=>n+Math.max(0,v-1),0);summary.combat=s.player.attributes.combat;summary.charisma=s.player.attributes.charisma;summary.intelligence=s.player.attributes.intelligence;summary.streetReadTier=s.streetRead.tier;summary.streetReadScore=s.streetRead.score;summary.streetReadEntries=s.streetRead.totalLifetimeEntries;summary.employerStanding=s.world.locations.employer.standing;summary.gamblingNet=s.world.locations.gambling.net;summary.arrests=s.record?.arrests||0;summary.crewJailed=Object.values(s.people.crew).filter(c=>c.status==='arrested').length;Object.assign(summary,storyMetrics(s,beats));Object.assign(summary,exposureMetrics(s));Object.assign(summary,territoryMetrics(s));if(p.market){marketSamples.push({day:s.run.day,tier:C.selectors.marketTier(s),profit:s.nineZeroSevenList.profit});Object.assign(summary,marketMetrics(s,marketSamples))}if(p.employment){Object.assign(summary,employmentMetrics(s,wages))}
  Object.assign(summary,health.summary());
  // Eviction and death race each other - roughly day 29 against day 35 - and
  // neither number reads correctly without the other, so the end day travels
  // with them.
  summary.endDay=s.run.day;
  summary.endHealth=s.player.health;
  summary.endHeat=s.player.heat;
  // v1.33. The note is the third ratchet: an 8%-of-balance daily fee with a
  // collector multiplier on top and no ceiling, which fired about three times
  // inside a ten-day run and can fire thirty-odd now.
  summary.debt={balance:s.lender.balance,principal:s.lender.principal,fees:s.lender.feesAdded||0,
    missedDays:s.lender.missedDays||0,collectorTier:s.lender.collectorTier||0,status:s.lender.status};
  return summary}
  finally{C.reduceGame=rawReduce}}
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
  // v1.30. Gated the same way, and for the same reason: a metrics block that
  // ran for every profile would add keys to all fifteen summaries and make the
  // "the other fourteen are unchanged" proof a diff with exceptions instead of
  // an equality. `firedRuns` and `missedShiftRuns` are the two that matter -
  // both should read 0 forever, and a future employment change that breaks the
  // v1.29 ladder is exactly what would move them off it.
  ...(strategies[name].employment?{employment:{
    jobHeldRuns:runs.filter(r=>r.jobHeld).length,
    averageShifts:Number((runs.reduce((n,r)=>n+(r.shiftsWorked||0),0)/count).toFixed(1)),
    averageWages:avg('wagesEarned'),
    averageRank:Number((runs.reduce((n,r)=>n+(r.jobRank||0),0)/count).toFixed(1)),
    missedShiftRuns:runs.filter(r=>(r.missedShiftPeak||0)>0).length,
    firedRuns:runs.filter(r=>!r.jobHeld).length,
    rentMissedRuns:runs.filter(r=>(r.rentMissed||0)>0).length,
    phoneLapsedRuns:runs.filter(r=>(r.phonePastDue||0)>0).length,
    warnedRuns:runs.filter(r=>(r.householdWarnings||0)>0).length,
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
