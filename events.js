// 907 Hustle — Event Deck & Popup System
// Depends on globals from script.js: GAME, DRUGS, AREAS, rng, addFeed, render,
// openModal, closeModal, cargoCount, sellPriceFor, nameOf, SLOTS
// Depends on combat.js: startCombat

let CURRENT_EVENT = null;

// Persistent price modifiers — consumed by generatePrices in script.js
// Shape: { drugId: "cocaine" | "*", mult: number, expiresDay: number, label: string }

function pushModifier(drugId, mult, days, label) {
  GAME.modifiers = GAME.modifiers || [];
  GAME.modifiers.push({
    drugId,
    mult,
    expiresDay: GAME.day + days,
    label,
  });
}

function applyModifiers(drugId, base) {
  let m = 1;
  for (const mod of GAME.modifiers || []) {
    if (mod.drugId === drugId || mod.drugId === "*") m *= mod.mult;
  }
  return base * m;
}

function expireModifiers() {
  GAME.modifiers = (GAME.modifiers || []).filter((m) => m.expiresDay > GAME.day);
}

// Helpers specific to event cards
function midPriceOf(drugId) {
  const d = DRUGS.find((x) => x.id === drugId);
  if (!d) return 100;
  return Math.round((d.minPrice + d.maxPrice) / 2);
}

function hasRoom(qty) {
  return GAME.maxCarry - cargoCount() >= qty;
}

function takeCash(amount) {
  const actual = Math.min(GAME.cash, amount);
  GAME.cash -= actual;
  return actual;
}

// ============================================================================
// THE EVENT DECK
// ============================================================================
const EVENTS = [

  // ---------- Street encounters ----------
  {
    id: "hungry_kid",
    title: "Hungry Kid at the Corner",
    body: `A skinny kid tugs your sleeve. "Yo — fifty bucks and I'll show you a stash nobody's watching."`,
    weight: 3,
    triggers: ["travel", "laylow"],
    condition: (g) => g.cash >= 50,
    choices: [
      { label: "Pay $50", run: (g) => {
        g.cash -= 50;
        if (Math.random() < 0.7) {
          const found = rng(80, 260);
          g.cash += found;
          return `Kid delivered. Stash had $${found} cash in it.`;
        }
        return `Kid pointed at a garbage pile and vanished. $50 gone.`;
      }},
      { label: "Brush him off", run: () => `You keep walking. He moves on.` },
      { label: "Shake him down", run: () => startCombat("street_kid", "Kid pulls a pocketknife.") },
    ],
  },

  {
    id: "clean_hoodie",
    title: "Clean Hoodie",
    body: `Jumpy dude in a brand-new hoodie wants 10 rocks. His sneakers are a little too white.`,
    weight: 2,
    triggers: ["laylow"],
    slots: ["Evening", "Night"],
    condition: (g) => (g.inventory.crack || 0) >= 10,
    choices: [
      { label: "Sell 10 crack", run: (g) => {
        if (Math.random() < 0.4) {
          g.inventory.crack -= 10;
          g.heat += 4;
          return `Undercover. Lost 10 rocks and caught heat.`;
        }
        const price = sellPriceFor("crack") * 10;
        g.inventory.crack -= 10;
        g.cash += price;
        return `He was real. +$${price}.`;
      }},
      { label: "Walk away", run: (g) => { g.heat = Math.max(0, g.heat - 1); return `You walk. Heat cools a notch.`; }},
      { label: "Rob him", run: () => startCombat("undercover", "Your instinct was right — he was a trap.") },
    ],
  },

  {
    id: "dre_front",
    title: "Dre's Calling",
    body: `Phone buzzes. "You good? I got 30 of the white at half. Pay me back in 5 days — don't be late."`,
    weight: 1,
    triggers: ["laylow"],
    condition: (g) => g.dre.loanOutstanding === 0 && g.day >= 2 && g.day <= 22,
    choices: [
      { label: "Take the front", run: (g) => {
        const qty = 30;
        const unit = Math.round(midPriceOf("cocaine") * 0.5);
        const owed = Math.round(qty * unit * 1.2);
        const actual = Math.min(qty, g.maxCarry - cargoCount());
        if (actual <= 0) return "Bag full. You pass.";
        g.inventory.cocaine += actual;
        g.dre.loanOutstanding = owed;
        g.dre.deadlineDay = g.day + 5;
        return `${actual} coke in your bag. Owe Dre $${owed} by Day ${g.dre.deadlineDay}.`;
      }},
      { label: "Pass", run: (g) => { g.dre.trust -= 1; return `Dre hangs up. He'll remember.`; }},
    ],
  },

  {
    id: "stalled_truck",
    title: "Stalled Truck",
    body: `Rusted pickup, hazards flashing. Back door hanging half-open. Nobody around.`,
    weight: 2,
    triggers: ["travel"],
    choices: [
      { label: "Loot the back", run: (g) => {
        const pick = DRUGS[rng(0, DRUGS.length - 1)];
        const qty = rng(2, 8);
        const room = g.maxCarry - cargoCount();
        const got = Math.min(qty, room);
        if (got <= 0) return `You find ${qty} ${pick.displayName} — but your bag is full. Walk away empty.`;
        g.inventory[pick.id] = (g.inventory[pick.id] || 0) + got;
        g.heat += 2;
        return `Scored ${got} ${pick.displayName} from the truck. Heat +2.`;
      }},
      { label: "Leave it", run: () => `Not worth the setup. You keep driving.` },
      { label: "Call it in (anon)", run: (g) => { g.heat = Math.max(0, g.heat - 2); return `Tip line. Heat -2.`; }},
    ],
  },

  {
    id: "checkpoint",
    title: "APD Checkpoint",
    body: `Red and blues ahead. Roadblock. You're holding.`,
    weight: 2,
    triggers: ["travel"],
    condition: (g) => cargoCount() > 0 && g.heat >= 2,
    choices: [
      { label: "Bribe the trooper ($300)", run: (g) => {
        if (g.cash < 300) return `Not enough cash. Officer waves you through anyway — lucky.`;
        g.cash -= 300;
        g.heat = Math.max(0, g.heat - 2);
        return `Slipped $300 into his ticket book. Heat -2.`;
      }},
      { label: "Turn around (skip slot)", run: (g) => { stepTick("Backtracked to avoid the roadblock."); return null; }},
      { label: "Push through", run: () => startCombat("patrol", "You gun it past the cone line.") },
    ],
  },

  {
    id: "ambush_alley",
    title: "Ambush in the Alley",
    body: `Two silhouettes step out at the mouth of the alley. You recognize Rook's colors.`,
    weight: 2,
    triggers: ["travel"],
    condition: (g) => currentArea().rivalPressure >= 2 || g.rook.attention >= 8,
    choices: [
      { label: "Fight them off", run: () => startCombat("rival_crew", "Two of Rook's goons step up.") },
      { label: "Drop some cash and bolt", run: (g) => {
        const tax = Math.min(g.cash, rng(120, 280));
        g.cash -= tax;
        return `Dropped $${tax}. They let you pass.`;
      }},
    ],
  },

  {
    id: "overdose_alley",
    title: "OD in the Alley",
    body: `Dude is slumped against a dumpster. Blue lips. He'll die if you don't move.`,
    weight: 2,
    triggers: ["travel", "laylow"],
    slots: ["Evening", "Night"],
    choices: [
      { label: "Call 911 (skip slot)", run: (g) => {
        g.rep += 3;
        stepTick("Waited with him till medics arrived.");
        return null;
      }},
      { label: "Check his pockets", run: (g) => {
        const cash = rng(20, 160);
        g.cash += cash;
        g.rep = Math.max(0, g.rep - 2);
        return `Pulled $${cash} off him. Rep -2.`;
      }},
      { label: "Walk past", run: (g) => `You keep moving.` },
    ],
  },

  {
    id: "bad_batch_peddler",
    title: "Cut-Rate Peddler",
    body: `Sketchy dude offers you 15 pills at 40% below market. Swears they're clean.`,
    weight: 2,
    triggers: ["laylow"],
    condition: (g) => g.cash >= 500 && hasRoom(15),
    choices: [
      { label: "Buy 15 pills", run: (g) => {
        const unit = Math.round(midPriceOf("rx_mix") * 0.6);
        const cost = unit * 15;
        if (g.cash < cost) return `Can't afford it.`;
        g.cash -= cost;
        g.inventory.rx_mix = (g.inventory.rx_mix || 0) + 15;
        if (Math.random() < 0.4) {
          pushModifier("rx_mix", 0.5, 2, "Bad batch rumor");
          return `Bought 15. Word's already spreading they're cut — resale price halved for 2 days.`;
        }
        return `Bought 15 pills for $${cost}. Clean stock.`;
      }},
      { label: "Pass", run: () => `Nothing good comes from a rush deal.` },
      { label: "Rob him", run: () => startCombat("rival_dealer", "He reaches for something. You act first.") },
    ],
  },

  {
    id: "mina_tip",
    title: "Mina's Tip",
    body: () => `Mina slides up. "Heard something — ${pickRandomDrugDisplay()} is moving in ${pickRandomAreaDisplay()}. Real talk, $80."`,
    weight: 2,
    triggers: ["laylow"],
    condition: (g) => g.cash >= 80,
    choices: [
      { label: "Pay $80", run: (g) => {
        g.cash -= 80;
        const drug = DRUGS[rng(0, DRUGS.length - 1)];
        if (Math.random() < 0.75) {
          pushModifier(drug.id, 1.6, 2, `Mina tip: ${drug.displayName}`);
          g.mina.trust += 2;
          return `Tip is real. ${drug.displayName} up 60% for 2 days.`;
        }
        g.mina.trust -= 1;
        return `Bad intel this time. $80 burnt.`;
      }},
      { label: "Pass", run: () => `You pass.` },
    ],
  },

  {
    id: "feds_in_town",
    title: "Feds in Town",
    body: `News breaks on the radio. Federal task force is in Anchorage. Every block runs hot for a few days.`,
    weight: 1,
    triggers: ["laylow"],
    condition: (g) => g.day >= 5,
    choices: [
      { label: "Ride it out", run: (g) => { g.heat += 3; return `Heat +3. Be careful.`; }},
      { label: "Pay a lawyer retainer ($400)", run: (g) => {
        if (g.cash < 400) return `Can't afford the retainer.`;
        g.cash -= 400;
        g.heat = Math.max(0, g.heat - 2);
        pushModifier("*", 1, 3, "Lawyer on retainer");
        return `Retainer paid. Heat -2 and a buffer for 3 days.`;
      }},
    ],
  },

  {
    id: "snow_storm",
    title: "White-Out",
    body: `Storm blows in off Cook Inlet. Roads shut, blocks quiet. Pills hit the streets — people can't get to clinics.`,
    weight: 1,
    triggers: ["laylow"],
    slots: ["Morning", "Night"],
    choices: [
      { label: "Lay low", run: (g) => {
        pushModifier("rx_mix", 1.4, 2, "Storm");
        pushModifier("vicodin", 1.4, 2, "Storm");
        pushModifier("percocet", 1.4, 2, "Storm");
        return `Storm locks down 2 days. Prescription pills spiking citywide.`;
      }},
    ],
  },

  {
    id: "drunk_friend",
    title: "Old Friend Shows Up",
    body: `Old buddy from high school. Says he needs $200 and swears he'll pay back double in a week.`,
    weight: 2,
    triggers: ["laylow"],
    condition: (g) => g.cash >= 200,
    choices: [
      { label: "Loan him $200", run: (g) => {
        g.cash -= 200;
        if (Math.random() < 0.55) {
          pushModifier("*", 1, 7, "Friend will pay back");
          g.friendRepayDay = g.day + 7;
          return `He takes the roll. Swore on his grandma.`;
        }
        return `He takes the roll. You'll never see him again.`;
      }},
      { label: "Offer him work instead", run: (g) => {
        g.rep += 1;
        g.mina.dealChanceBonus += 1;
        return `He takes a lookout role. Deal chances a touch better.`;
      }},
      { label: "Kick rocks", run: () => `You wave him off.` },
    ],
  },

  {
    id: "cop_shakedown",
    title: "Flashing Lights",
    body: `Cruiser pulls alongside. Window rolls down. "Long time no see. You know how this works."`,
    weight: 2,
    triggers: ["travel"],
    slots: ["Evening", "Night"],
    condition: (g) => g.heat >= 3,
    choices: [
      { label: "Pay him off ($500)", run: (g) => {
        if (g.cash < 500) return `Can't cover. He writes you up for $500 anyway.` + (function(){ g.cash = Math.max(0, g.cash - 500); g.heat += 1; return ""; })();
        g.cash -= 500;
        g.heat = Math.max(0, g.heat - 3);
        return `$500 changes hands. Heat -3.`;
      }},
      { label: "Play dumb", run: (g) => {
        if (Math.random() < 0.3) {
          const lost = Math.min(g.cash, 300);
          g.cash -= lost;
          const invOptions = DRUGS.filter((d) => g.inventory[d.id] > 0);
          if (invOptions.length) {
            const pick = invOptions[rng(0, invOptions.length - 1)];
            const seized = Math.min(g.inventory[pick.id], rng(3, 10));
            g.inventory[pick.id] -= seized;
            return `Bust. Lost $${lost} and ${seized} ${pick.displayName}.`;
          }
          return `Bust. Lost $${lost}.`;
        }
        return `He rolls off. Close one.`;
      }},
      { label: "Floor it", run: () => startCombat("patrol", "Engine screams. He hits lights.") },
    ],
  },

  {
    id: "tweaker_attacks",
    title: "Tweaker Attacks",
    body: `Guy with bleeding gums jumps out of the shadows, screaming.`,
    weight: 2,
    triggers: ["travel", "laylow"],
    slots: ["Night"],
    choices: [
      { label: "Defend yourself", run: () => startCombat("tweaker", "He swings wild.") },
      { label: "Throw him a twenty", run: (g) => {
        if (g.cash < 20) return `You have nothing. He runs at you.` + (function(){ return startCombat("tweaker"); })();
        g.cash -= 20;
        return `He grabs the bill and runs.`;
      }},
    ],
  },

  {
    id: "block_party",
    title: "Block Party",
    body: `Music thumping. Thirty people on the block. Easy sales — but every neighbor is a witness.`,
    weight: 2,
    triggers: ["laylow"],
    slots: ["Evening", "Night"],
    condition: (g) => cargoCount() >= 5,
    choices: [
      { label: "Work the crowd", run: (g) => {
        const invOptions = DRUGS.filter((d) => g.inventory[d.id] > 0);
        if (!invOptions.length) return `Nothing to sell.`;
        const pick = invOptions[rng(0, invOptions.length - 1)];
        const qty = Math.min(g.inventory[pick.id], rng(3, 7));
        const price = Math.round(sellPriceFor(pick.id) * 1.25) * qty;
        g.inventory[pick.id] -= qty;
        g.cash += price;
        g.heat += 2;
        g.rep += 2;
        return `Moved ${qty} ${pick.displayName} for $${price} at premium. Heat +2.`;
      }},
      { label: "Keep it quiet", run: () => `You slip through the crowd.` },
    ],
  },

  {
    id: "rook_collector",
    title: "Rook's Tax Man",
    body: `Squat guy in a Carhartt steps in front of you. "Rook says it's collection day. Two bills."`,
    weight: 2,
    triggers: ["travel", "laylow"],
    condition: (g) => g.rook.attention >= 4,
    choices: [
      { label: "Pay $200", run: (g) => {
        if (g.cash < 200) return `You can't cover. He backhands you and walks.` + (function(){ g.health -= 8; return ""; })();
        g.cash -= 200;
        g.rook.attention = Math.max(0, g.rook.attention - 3);
        return `Paid. He nods and walks off. Rook pressure eases.`;
      }},
      { label: "Hide in the crowd", run: (g) => {
        if (Math.random() < 0.5) { g.rook.attention += 2; return `He spots you anyway. Pressure up.`; }
        return `You slip into the next block.`;
      }},
      { label: "Fight him", run: () => startCombat("rook_goon", "You swing first.") },
    ],
  },

  {
    id: "dead_battery",
    title: "Dead Battery",
    body: `Your beater won't turn over. It's cold. You're late.`,
    weight: 1,
    triggers: ["travel"],
    condition: (g) => g.assets.includes("beater"),
    choices: [
      { label: "Pay mechanic $80", run: (g) => {
        if (g.cash < 80) return `Can't afford the tow. Push it yourself.` + (function(){ stepTick("Pushing the car."); return ""; })();
        g.cash -= 80;
        return `Shop gets you rolling in 20 minutes.`;
      }},
      { label: "Wait for a jump", run: () => { stepTick("Waiting for a jump."); return null; }},
    ],
  },

  {
    id: "overnight_raid",
    title: "Someone's in Your Stash",
    body: `You hear the back window break. Someone's in the stash right now.`,
    weight: 1,
    triggers: ["laylow"],
    slots: ["Night"],
    condition: (g) => cargoCount() >= 5,
    choices: [
      { label: "Confront them", run: () => startCombat("street_thug", "You round the corner ready to fight.") },
      { label: "Call Mina for backup", run: (g) => {
        if (g.mina.trust < 3) return `Mina doesn't pick up. You lose stash.` + (function(){
          const invOptions = DRUGS.filter((d) => g.inventory[d.id] > 0);
          if (invOptions.length) {
            const pick = invOptions[rng(0, invOptions.length - 1)];
            const lost = Math.min(g.inventory[pick.id], rng(5, 10));
            g.inventory[pick.id] -= lost;
            return ` Lost ${lost} ${pick.displayName}.`;
          }
          return "";
        })();
        g.mina.trust -= 1;
        return `Mina's guys show up. Stash safe, but she's calling in a favor later.`;
      }},
      { label: "Hide and wait", run: (g) => {
        const invOptions = DRUGS.filter((d) => g.inventory[d.id] > 0);
        if (!invOptions.length) return `They find nothing.`;
        const pick = invOptions[rng(0, invOptions.length - 1)];
        const lost = Math.min(g.inventory[pick.id], rng(2, 6));
        g.inventory[pick.id] -= lost;
        return `They take ${lost} ${pick.displayName} and split.`;
      }},
    ],
  },

  {
    id: "dre_enforcer",
    title: "Dre's Enforcer",
    body: `Black truck pulls up. Two men get out. Dre says hi.`,
    weight: 5,
    triggers: ["travel", "laylow"],
    condition: (g) => g.dre.loanOutstanding > 0 && g.day > g.dre.deadlineDay,
    choices: [
      { label: "Pay what you owe", run: (g) => {
        if (g.cash < g.dre.loanOutstanding) return `You can't cover. Enforcer moves on you.` + (function(){ return startCombat("dre_enforcer"); })();
        g.cash -= g.dre.loanOutstanding;
        addFeed(`Cleared Dre's debt.`, "good");
        g.dre.loanOutstanding = 0;
        g.dre.deadlineDay = null;
        return `Debt cleared. Dre says respect.`;
      }},
      { label: "Stand and fight", run: () => startCombat("dre_enforcer", "Enforcer cracks his knuckles.") },
    ],
  },

  {
    id: "mugger",
    title: "Mugged",
    body: `Knife at your back. "Wallet."`,
    weight: 2,
    triggers: ["travel"],
    slots: ["Evening", "Night"],
    choices: [
      { label: "Hand over cash", run: (g) => {
        const lost = Math.min(g.cash, rng(80, 260));
        g.cash -= lost;
        return `Lost $${lost}. He walks.`;
      }},
      { label: "Fight back", run: () => startCombat("mugger", "You twist away from the blade.") },
    ],
  },

  {
    id: "crew_recruit",
    title: "Runner Wants In",
    body: `Kid comes up, maybe 19. Says he'll move small stacks for a cut. 15%.`,
    weight: 1,
    triggers: ["laylow"],
    condition: (g) => g.rep >= 15 && !g.flags.runnerHired,
    choices: [
      { label: "Put him on ($200)", run: (g) => {
        if (g.cash < 200) return `Can't cover the setup.`;
        g.cash -= 200;
        g.flags.runnerHired = true;
        pushModifier("*", 1, 6, "Runner working your stash");
        g.mina.dealChanceBonus += 2;
        return `Runner hired. He'll auto-push small volume for 6 days.`;
      }},
      { label: "Not yet", run: () => `Maybe later.` },
    ],
  },

  {
    id: "rare_score",
    title: "Wholesale Connect",
    body: `Connect offers 25 units of a random drug at 60% off market. One-time.`,
    weight: 1,
    triggers: ["laylow"],
    condition: (g) => g.rep >= 10 && g.cash >= 800,
    choices: [
      { label: "Buy in", run: (g) => {
        const drug = DRUGS[rng(0, DRUGS.length - 1)];
        const unit = Math.round(midPriceOf(drug.id) * 0.4);
        const qty = Math.min(25, g.maxCarry - cargoCount());
        if (qty <= 0) return `No room to take the load.`;
        const cost = unit * qty;
        if (g.cash < cost) return `Can't cover $${cost}.`;
        g.cash -= cost;
        g.inventory[drug.id] = (g.inventory[drug.id] || 0) + qty;
        g.heat += 2;
        return `${qty} ${drug.displayName} secured for $${cost}. Heat +2.`;
      }},
      { label: "Pass", run: () => `You pass on it.` },
    ],
  },

  {
    id: "port_closed",
    title: "Port Closed",
    body: `Coast Guard shut the port. Opiates drying up on the airport side.`,
    weight: 1,
    triggers: ["laylow"],
    choices: [
      { label: "Got it", run: (g) => {
        pushModifier("heroin", 1.5, 3, "Port closed");
        pushModifier("fentanyl", 1.6, 3, "Port closed");
        return `Heroin/fentanyl spiking citywide for 3 days.`;
      }},
    ],
  },

  {
    id: "club_opening",
    title: "Club Grand Opening",
    body: `New spot downtown, lines around the block. Party crowd hungry.`,
    weight: 1,
    triggers: ["laylow"],
    slots: ["Afternoon", "Evening"],
    choices: [
      { label: "Noted", run: (g) => {
        pushModifier("mdma", 1.6, 2, "Club opening");
        pushModifier("cocaine", 1.25, 2, "Club opening");
        pushModifier("ecstasy", 1.5, 2, "Club opening");
        return `MDMA/ecstasy/coke demand up for 2 days.`;
      }},
    ],
  },

  {
    id: "pill_mill_bust",
    title: "Pill Mill Busted",
    body: `Valley clinic raided. Script supply dries up across town.`,
    weight: 1,
    triggers: ["laylow"],
    choices: [
      { label: "Understood", run: (g) => {
        ["adderall", "xanax", "oxy", "percocet", "vicodin", "ritalin", "vyvanse", "hydros", "rx_mix"].forEach((id) => {
          pushModifier(id, 1.4, 3, "Pill mill bust");
        });
        return `All pill prices up 40% for 3 days.`;
      }},
    ],
  },

  {
    id: "rival_dealer_fight",
    title: "Rival Dealer Working Your Block",
    body: `Guy on your corner. Says it's his corner now.`,
    weight: 2,
    triggers: ["laylow"],
    slots: ["Afternoon", "Evening"],
    condition: (g) => currentArea().rivalPressure >= 1,
    choices: [
      { label: "Run him off", run: () => startCombat("rival_dealer", "He squares up.") },
      { label: "Split the block", run: (g) => { g.rep = Math.max(0, g.rep - 1); return `Uneasy truce. Rep -1.`; }},
      { label: "Call Rook to mediate", run: (g) => { g.rook.attention += 3; return `Rook hears about it. Attention +3.`; }},
    ],
  },

  {
    id: "bail_ask",
    title: "Bail Call",
    body: `Mina calls. "Dre's nephew got locked up. Bail's $500. He's good for it."`,
    weight: 1,
    triggers: ["laylow"],
    condition: (g) => g.day >= 6 && g.cash >= 500,
    choices: [
      { label: "Cover the bail", run: (g) => {
        g.cash -= 500;
        g.dre.trust += 3;
        g.mina.trust += 2;
        g.rep += 3;
        return `Bail posted. Trust up across the board.`;
      }},
      { label: "Can't right now", run: (g) => { g.dre.trust -= 1; return `Dre hears about it.`; }},
    ],
  },

  {
    id: "shooting_block",
    title: "Shots Fired",
    body: `Cracks of gunfire a block over. Everyone goes inside.`,
    weight: 2,
    triggers: ["travel", "laylow"],
    slots: ["Evening", "Night"],
    choices: [
      { label: "Bunker down", run: (g) => { stepTick("Waited out the block closure."); g.heat += 2; return null; }},
      { label: "Cut through anyway", run: (g) => {
        if (Math.random() < 0.45) {
          const dmg = rng(10, 22);
          g.health -= dmg;
          return `Caught shrapnel. -${dmg} HP.`;
        }
        return `Made it clear.`;
      }},
    ],
  },

  {
    id: "lottery_scratcher",
    title: "Lottery Scratcher",
    body: `Two-dollar scratcher in your jacket. Match three salmon, win a pot.`,
    weight: 1,
    triggers: ["laylow"],
    choices: [
      { label: "Scratch it", run: (g) => {
        const roll = Math.random();
        if (roll < 0.55) return `Loser.`;
        if (roll < 0.90) { g.cash += 50; return `+$50.`; }
        if (roll < 0.98) { g.cash += 300; return `Nice — +$300.`; }
        g.cash += 2000;
        return `JACKPOT. +$2,000.`;
      }},
    ],
  },

  {
    id: "concert",
    title: "Concert Tonight",
    body: `Big show at the Sullivan. Thousands filtering in. Party drugs in demand.`,
    weight: 1,
    triggers: ["laylow"],
    choices: [
      { label: "Good to know", run: (g) => {
        pushModifier("mdma", 1.5, 1, "Concert");
        pushModifier("lsd", 1.5, 1, "Concert");
        pushModifier("ecstasy", 1.5, 1, "Concert");
        pushModifier("ketamine", 1.4, 1, "Concert");
        return `Party drugs spiking for 1 day.`;
      }},
    ],
  },

  {
    id: "gossip_exchange",
    title: "Gossip Runner",
    body: `Regular at the counter says there's real news for a hundred bucks.`,
    weight: 2,
    triggers: ["laylow"],
    condition: (g) => g.cash >= 100,
    choices: [
      { label: "Pay $100", run: (g) => {
        g.cash -= 100;
        const drug = DRUGS[rng(0, DRUGS.length - 1)];
        const direction = Math.random() < 0.5 ? 1.5 : 0.6;
        pushModifier(drug.id, direction, 2, `Gossip: ${drug.displayName}`);
        return direction > 1
          ? `${drug.displayName} going UP citywide for 2 days.`
          : `${drug.displayName} crashing for 2 days. Sell now or buy cheap.`;
      }},
      { label: "Keep your cash", run: () => `You pass.` },
    ],
  },

  {
    id: "street_doctor",
    title: "Street Doctor",
    body: `Ex-nurse runs a clinic out of her garage. Cash only. Half hospital rates.`,
    weight: 2,
    triggers: ["laylow"],
    condition: (g) => g.health <= 70,
    choices: [
      { label: "Get patched up", run: (g) => {
        const missing = 100 - g.health;
        const cost = missing * 2;
        if (g.cash < cost) return `Can't cover $${cost}.`;
        g.cash -= cost;
        g.health = 100;
        return `Stitched up for $${cost}.`;
      }},
      { label: "Skip it", run: () => `You'll walk it off.` },
    ],
  },

  {
    id: "dirty_cop",
    title: "Dirty Cop",
    body: `Officer in plain clothes. "$300 a month, I route patrols away from you. Think about it."`,
    weight: 1,
    triggers: ["laylow"],
    condition: (g) => g.heat >= 4 && g.cash >= 300,
    choices: [
      { label: "Pay him", run: (g) => {
        g.cash -= 300;
        g.heat = Math.max(0, g.heat - 4);
        pushModifier("*", 1, 4, "Cop on payroll");
        return `Paid. Heat -4. Buffer for 4 days.`;
      }},
      { label: "Decline", run: () => `"Suit yourself."` },
    ],
  },

  {
    id: "stolen_goods",
    title: "Hot Shipment",
    body: `Fence offers a crate of mystery product for a flat $600.`,
    weight: 1,
    triggers: ["laylow"],
    condition: (g) => g.cash >= 600 && g.maxCarry - cargoCount() >= 6,
    choices: [
      { label: "Buy the crate", run: (g) => {
        g.cash -= 600;
        const drug = DRUGS[rng(0, DRUGS.length - 1)];
        const qty = rng(6, 14);
        const actual = Math.min(qty, g.maxCarry - cargoCount());
        g.inventory[drug.id] = (g.inventory[drug.id] || 0) + actual;
        g.heat += 2;
        return `Opened the crate — ${actual} ${drug.displayName}. Heat +2.`;
      }},
      { label: "Pass", run: () => `Gut says no.` },
    ],
  },

  {
    id: "teen_lookout",
    title: "Teen Lookout",
    body: `Kid, 16 maybe, offers to run lookout during sales. Free today, tips tomorrow.`,
    weight: 2,
    triggers: ["laylow"],
    choices: [
      { label: "Put him on", run: (g) => {
        g.heat = Math.max(0, g.heat - 1);
        g.rep += 1;
        return `Extra eyes. Heat -1.`;
      }},
      { label: "Send him home", run: () => `You wave him off.` },
      { label: "Scare him straight", run: (g) => { g.rep = Math.max(0, g.rep - 2); return `He runs crying. Rep -2.`; }},
    ],
  },

  {
    id: "mina_in_trouble",
    title: "Mina's in Trouble",
    body: `Mina texts. All caps. "Rook's people at my door. Need $800 now."`,
    weight: 1,
    triggers: ["laylow"],
    condition: (g) => g.mina.trust >= 3 && g.cash >= 800,
    choices: [
      { label: "Send the $800", run: (g) => {
        g.cash -= 800;
        g.mina.trust += 5;
        g.mina.dealChanceBonus += 3;
        return `Sent it. Mina lives. Her tips are about to get a lot better.`;
      }},
      { label: "Can't right now", run: (g) => { g.mina.trust -= 3; return `Mina ghost you for a while.`; }},
    ],
  },

  {
    id: "rare_concert_vip",
    title: "VIP List",
    body: `Promoter offers a VIP in if you supply the greenroom. High-margin, one-shot.`,
    weight: 1,
    triggers: ["laylow"],
    condition: (g) => (g.inventory.cocaine || 0) >= 5 && g.rep >= 8,
    choices: [
      { label: "Supply the greenroom", run: (g) => {
        g.inventory.cocaine -= 5;
        g.cash += 2200;
        g.rep += 4;
        g.heat += 1;
        return `Moved 5 coke to VIP for $2,200. Rep +4.`;
      }},
      { label: "Too risky", run: () => `You pass.` },
    ],
  },

  {
    id: "kingpin_invite",
    title: "Kingpin's Invitation",
    body: `Black SUV pulls up. Window rolls down. "He wants to meet."`,
    weight: 1,
    triggers: ["laylow"],
    condition: (g) => g.rep >= 35,
    choices: [
      { label: "Get in the truck", run: (g) => {
        g.rep += 8;
        g.rook.attention = Math.max(0, g.rook.attention - 5);
        pushModifier("*", 1, 5, "Kingpin meeting aftermath");
        g.maxCarry += 10;
        return `You sit with him. Walk out with +10 bag, -5 Rook pressure, +8 rep.`;
      }},
      { label: "Walk away", run: (g) => { g.rep = Math.max(0, g.rep - 3); return `Rep -3. Word travels.`; }},
    ],
  },

  {
    id: "drunk_stumble",
    title: "Drunk on a Bender",
    body: `Fisherman spilling hundreds out of his pocket. Just got his check.`,
    weight: 2,
    triggers: ["laylow"],
    slots: ["Night"],
    condition: (g) => (g.inventory.cocaine || 0) >= 2 || (g.inventory.mdma || 0) >= 2,
    choices: [
      { label: "Sell him 2 coke (2x)", disabled: (g) => (g.inventory.cocaine || 0) < 2, run: (g) => {
        g.inventory.cocaine -= 2;
        const price = sellPriceFor("cocaine") * 2 * 2;
        g.cash += price;
        g.heat += 1;
        return `He doesn't haggle. +$${price}.`;
      }},
      { label: "Sell him 2 MDMA (2x)", disabled: (g) => (g.inventory.mdma || 0) < 2, run: (g) => {
        g.inventory.mdma -= 2;
        const price = sellPriceFor("mdma") * 2 * 2;
        g.cash += price;
        g.heat += 1;
        return `He doesn't haggle. +$${price}.`;
      }},
      { label: "Rob him", run: () => startCombat("street_thug", "He's drunk but strong.") },
      { label: "Let him be", run: (g) => { g.rep += 1; return `Karma. Rep +1.`; }},
    ],
  },

  {
    id: "news_crackdown",
    title: "Neighborhood Watch",
    body: () => `Flyers on every pole. Neighborhood watch organizing in ${currentArea().displayName}.`,
    weight: 1,
    triggers: ["laylow"],
    condition: (g) => currentArea().riskLevel <= 2,
    choices: [
      { label: "Acknowledged", run: (g) => {
        g.heat += 2;
        pushModifier("weed", 0.8, 3, "Neighborhood watch");
        pushModifier("shrooms", 0.8, 3, "Neighborhood watch");
        return `Heat +2 here. Casual drugs dropping — people scared to buy.`;
      }},
    ],
  },

  {
    id: "friend_repay",
    title: "Old Friend Pays Back",
    body: `Your buddy actually came through. Hands you a fat envelope.`,
    weight: 99,
    triggers: ["laylow"],
    condition: (g) => g.friendRepayDay && g.day >= g.friendRepayDay,
    choices: [
      { label: "Count it", run: (g) => {
        g.friendRepayDay = null;
        g.cash += 400;
        g.rep += 2;
        return `+$400. Never count on it, but nice when it happens.`;
      }},
    ],
  },

  {
    id: "silent_beat",
    title: "Quiet Afternoon",
    body: `Block's dead. Nothing moves.`,
    weight: 1,
    triggers: ["laylow"],
    choices: [
      { label: "Enjoy the quiet", run: (g) => { g.heat = Math.max(0, g.heat - 1); return `Heat -1.`; }},
    ],
  },
];

// ============================================================================
// EVENT MODAL SYSTEM
// ============================================================================

function pickRandomDrugDisplay() {
  return DRUGS[rng(0, DRUGS.length - 1)].displayName;
}
function pickRandomAreaDisplay() {
  return AREAS[rng(0, AREAS.length - 1)].displayName;
}

function showEventCard(card) {
  const body = (typeof card.body === "function") ? card.body(GAME) : card.body;
  const choicesHtml = card.choices.map((c, i) => {
    const disabled = (c.disabled && c.disabled(GAME));
    const hint = c.hint ? `<small class="muted"> ${c.hint(GAME)}</small>` : "";
    const cls = i === 0 ? "btn primary" : "btn secondary";
    return `<button class="${cls}" data-event-choice="${i}" ${disabled ? "disabled" : ""} type="button">${c.label}${hint}</button>`;
  }).join("");
  const html = `
    <p class="event-body">${body}</p>
    <div class="event-choices">${choicesHtml}</div>
  `;
  CURRENT_EVENT = card;
  openModal(card.title, html);
}

function resolveEventChoice(idx) {
  if (!CURRENT_EVENT) return;
  const card = CURRENT_EVENT;
  CURRENT_EVENT = null;
  const choice = card.choices[idx];
  if (!choice) { closeModal(); return; }
  const outcome = choice.run(GAME);
  if (outcome) addFeed(outcome);
  if (!COMBAT) closeModal();
  render();
}

function tryPopupEvent(trigger) {
  if (COMBAT || CURRENT_EVENT) return false;
  const slot = SLOTS[GAME.tick - 1];
  const pool = EVENTS.filter((e) => {
    if (!e.triggers.includes(trigger)) return false;
    if (e.slots && !e.slots.includes(slot)) return false;
    if (e.condition && !e.condition(GAME)) return false;
    return true;
  });
  if (!pool.length) return false;

  // Forced events (e.g. friend_repay) always fire if eligible
  const forced = pool.find((e) => (e.weight || 1) >= 99);
  if (forced) { showEventCard(forced); return true; }

  const chance = trigger === "travel" ? 0.40 : 0.25;
  if (Math.random() > chance) return false;

  const total = pool.reduce((s, e) => s + (e.weight || 1), 0);
  let r = Math.random() * total;
  let picked = pool[0];
  for (const e of pool) {
    r -= (e.weight || 1);
    if (r <= 0) { picked = e; break; }
  }
  showEventCard(picked);
  return true;
}
