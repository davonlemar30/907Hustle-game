(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.EncounterSystem = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const AUTHORED_ENCOUNTERS = {
    mini_mart_parking_lot: {
      id: "mini_mart_parking_lot", type: "authored", enabled: true,
      title: "Three Shapes in the Night Owl Lot",
      setup: "Three people angle across the Mini-Mart parking lot after dark. One wears red work gloves, and all three are watching the bag. They want product or cash.",
      trigger: { earliestDay: 2, latestDay: 2, weightedFromSlot: 2, guaranteedBySlot: 3 },
      threat: 3, demand: 80, maxDecisions: 3,
    },
    mid_run_confrontation_stub: {
      id: "mid_run_confrontation_stub", type: "authored", enabled: false,
      trigger: { earliestDay: 3, latestDay: 5, shapedByFlags: true }, choices: [], outcomes: [],
    },
    late_confrontation_stub: {
      id: "late_confrontation_stub", type: "authored", enabled: false,
      trigger: { earliestDay: 6, latestDay: 7, requiresFinalPlan: true }, choices: [], outcomes: [],
    },
  };

  const RANDOM_NPC_TEMPLATES = [
    {
      id: "stick_up_kid", label: "stick-up kid", threat: 1, aggression: 0.18, weight: 8,
      wants: "cash", demand: [35, 70], attack: [5, 10],
      loot: { cash: [20, 60], product: [0, 1], nothingChance: 0, gearChance: 0 },
      setup: "A kid steps out from behind a parked car with one hand buried in a jacket pocket. The voice is steadier than the stance: cash on the pavement, now.",
    },
    {
      id: "fiend_tweaker", label: "tweaker", threat: 1, aggression: 0.34, weight: 7,
      wants: "product", demand: [20, 45], attack: [3, 12],
      loot: { cash: [0, 30], product: [0, 1], nothingChance: 0.52, gearChance: 0 },
      setup: "A stranger cuts across your path too quickly, talking to you and somebody who is not there. A small knife keeps appearing and disappearing beside one sleeve.",
    },
    {
      id: "corner_boy", label: "corner boy", threat: 2, aggression: 0.28, weight: 6,
      wants: "product", demand: [60, 100], attack: [7, 14],
      loot: { cash: [50, 120], product: [1, 2], nothingChance: 0.05, gearChance: 0 },
      setup: "Somebody from the next corner blocks the clean way out and asks who cleared you to carry a bag through here. Two more shapes stay close enough to count.",
    },
    {
      id: "armed_opportunist", label: "armed opportunist", threat: 4, aggression: 0.40, weight: 3,
      wants: "cash", demand: [120, 200], attack: [11, 20],
      loot: { cash: [100, 200], product: [1, 3], nothingChance: 0, gearChance: 0.12 },
      setup: "A figure waits beside the only open route and lets you see the handgun before saying anything. The demand is calm because the danger does not need explaining.",
    },
  ];

  const WEAPONS = {
    utility_knife: { id: "utility_knife", name: "Utility Knife", type: "close", accuracy: 0.04, damage: [8, 14], heat: 0 },
    cheap_handgun: { id: "cheap_handgun", name: "Cheap Handgun", type: "firearm", accuracy: -0.06, damage: [14, 24], heat: 2 },
    reliable_handgun: { id: "reliable_handgun", name: "Reliable Handgun", type: "firearm", accuracy: 0.08, damage: [18, 30], heat: 2 },
  };
  const GEAR_LOOT = [
    { id: "utility_knife", name: "Utility Knife", slot: "weapon" },
    { id: "protective_vest", name: "Protective Vest", slot: "armor" },
  ];

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function cloneState(state) { return typeof structuredClone === "function" ? structuredClone(state) : JSON.parse(JSON.stringify(state)); }
  function next(rng) { return rng.next(); }
  function int(rng, min, max) { return typeof rng.int === "function" ? rng.int(min, max) : Math.floor(next(rng) * (max - min + 1)) + min; }
  function pick(rng, items) { return items[Math.floor(next(rng) * items.length)]; }
  function areaRisk(state, areaId) {
    const risks = { north_star_lot: 1, downtown: 2, airport_industrial: 4 };
    return risks[areaId] || 1;
  }
  function cargoUsed(state) { return Object.values(state.player.inventory || {}).reduce((sum, item) => sum + (item.qty || 0), 0); }
  function cargoCapacity(state) { return (state.player.cargoCapacity || 10) + (state.player.gear?.owned?.includes("larger_bag") ? 5 : 0); }
  function cargoRatio(state) { return clamp(cargoUsed(state) / Math.max(1, cargoCapacity(state)), 0, 1); }
  function inventoryValue(state) {
    const market = state.world.markets?.[state.world.currentNeighborhoodId];
    return Object.entries(state.player.inventory || {}).reduce((sum, [id, item]) => sum + (item.qty || 0) * (market?.prices?.[id] || item.avgCost || 25), 0);
  }
  function equippedWeapon(state) { return WEAPONS[state.player.gear?.equipped?.weapon] || null; }
  function armorValue(state) { return state.player.gear?.equipped?.armor === "protective_vest" ? 4 : 0; }
  function attributes(state) { return state.player.attributes || {}; }
  function combat(state) { return state.player.stats?.combat || 2; }
  function influence(state, areaId) { return state.world.influence?.[areaId] || 0; }
  function addHeat(state, amount) { state.player.heat = clamp((state.player.heat || 0) + amount, 0, 15); }
  function addDirtyCash(state, amount) {
    state.player.cash += amount;
    if (typeof state.player.dirtyCash === "number") state.player.dirtyCash += amount;
  }
  function spendCash(state, amount) {
    const spent = Math.min(state.player.cash, Math.max(0, Math.round(amount)));
    state.player.cash -= spent;
    if (typeof state.player.dirtyCash === "number") {
      const dirty = Math.min(state.player.dirtyCash, spent);
      state.player.dirtyCash -= dirty;
      if (typeof state.player.cleanCash === "number") state.player.cleanCash = Math.max(0, state.player.cleanCash - (spent - dirty));
    }
    return spent;
  }
  function hasNearbyCrew(state, areaId) {
    const crew = state.people?.crew || {};
    const assignments = {
      north_star_lot: ["guard_base", "intimidate_buyer", "north_run"],
      downtown: ["intimidate_buyer", "source_cocaine"],
      airport_industrial: ["outer_run", "source_meth"],
    };
    return Object.entries(crew).some(([id, record]) => record?.recruited && record.status === "active" && (assignments[areaId] || []).includes(record.assignment) && id !== "goodie");
  }
  function toneNearby(state, areaId) {
    const tone = state.people?.crew?.tone;
    return !!tone?.recruited && tone.status === "active" && (areaId === "north_star_lot" ? ["guard_base", "intimidate_buyer"].includes(tone.assignment) : tone.assignment === "intimidate_buyer");
  }
  function heldProducts(state) { return Object.entries(state.player.inventory || {}).filter(([, item]) => item.qty > 0).map(([id, item]) => ({ id, qty: item.qty })); }
  function productName(id) { return id ? id.charAt(0).toUpperCase() + id.slice(1) : "product"; }
  function loseProduct(state, requestedId, qty) {
    const held = heldProducts(state);
    if (!held.length) return null;
    const id = held.some((item) => item.id === requestedId) ? requestedId : held.sort((a, b) => b.qty - a.qty)[0].id;
    const item = state.player.inventory[id];
    const lost = Math.min(item.qty, Math.max(1, qty));
    item.qty -= lost;
    if (!item.qty) item.avgCost = 0;
    return { productId: id, qty: lost, label: `${lost} ${productName(id)}` };
  }
  function reduceInfluence(state, areaId) { if (state.world.influence?.[areaId] > 0) state.world.influence[areaId] -= 1; }
  function removeBurner(state) {
    if (state.player.gear?.equipped?.tool === "burner_phone") state.player.gear.equipped.tool = null;
    state.player.gear.owned = (state.player.gear?.owned || []).filter((id) => id !== "burner_phone");
  }
  function randomProductId(state, rng) {
    const ids = Object.keys(state.player.inventory || {}).filter((id) => state.world.productAccess?.[id]);
    return ids.length ? pick(rng, ids) : (state.player.inventory?.weed ? "weed" : Object.keys(state.player.inventory || {})[0]);
  }
  function awardLoot(state, npc, rng) {
    const table = npc.loot;
    if (next(rng) < table.nothingChance) return { cash: 0, products: [], gear: null, label: "Nothing worth taking" };
    const cash = int(rng, table.cash[0], table.cash[1]);
    if (cash) addDirtyCash(state, cash);
    const products = [];
    const qty = int(rng, table.product[0], table.product[1]);
    if (qty > 0) {
      const productId = randomProductId(state, rng);
      if (productId) {
        const item = state.player.inventory[productId];
        const before = item.qty || 0;
        item.qty = before + qty;
        item.avgCost = before ? (item.avgCost * before) / item.qty : 0;
        products.push({ productId, qty });
      }
    }
    let gear = null;
    if (table.gearChance && next(rng) < table.gearChance) {
      const candidates = GEAR_LOOT.filter((item) => !state.player.gear.owned.includes(item.id));
      if (candidates.length) {
        gear = pick(rng, candidates);
        state.player.gear.owned.push(gear.id);
        if (!state.player.gear.equipped[gear.slot]) state.player.gear.equipped[gear.slot] = gear.id;
      }
    }
    const bits = [];
    if (cash) bits.push(`$${cash}`);
    for (const product of products) bits.push(`${product.qty} ${productName(product.productId)}`);
    if (gear) bits.push(gear.name);
    return { cash, products, gear: gear?.id || null, label: bits.length ? bits.join(" · ") : "Nothing worth taking" };
  }

  function weightedTemplate(activity, areaId, state, rng) {
    const danger = areaRisk(state, areaId);
    const heat = state.player.heat || 0;
    const candidates = RANDOM_NPC_TEMPLATES.filter((npc) => npc.id !== "armed_opportunist" || danger >= 3 || heat >= 7);
    const weights = candidates.map((npc) => {
      let weight = npc.weight;
      if (npc.id === "armed_opportunist") weight += danger * 1.5 + heat * 0.45;
      if (npc.id === "corner_boy") weight += danger + Math.max(0, 3 - influence(state, areaId));
      if (npc.id === "fiend_tweaker" && activity === "late_activity") weight += 4;
      if (npc.id === "stick_up_kid" && activity === "cash_exposure") weight += 4;
      return weight;
    });
    let roll = next(rng) * weights.reduce((sum, value) => sum + value, 0);
    for (let i = 0; i < candidates.length; i += 1) { roll -= weights[i]; if (roll <= 0) return candidates[i]; }
    return candidates[candidates.length - 1];
  }

  function rollRandomEncounter(activity, areaId, state, rng, context) {
    const ctx = context || {};
    if (activity === "robbery") return buildRandomEncounter(weightedTemplate(activity, areaId, state, rng), areaId, activity, rng);
    const base = { selling: 0.06, movement: 0.04, late_activity: 0.05, cash_exposure: 0.04 }[activity] || 0;
    if (!base) return null;
    const danger = areaRisk(state, areaId);
    const heat = state.player.heat || 0;
    const cargoValue = ctx.cargoValue == null ? inventoryValue(state) : ctx.cargoValue;
    const visibleCash = ctx.visibleCash == null ? state.player.cash : ctx.visibleCash;
    let chance = base + Math.max(0, danger - 1) * 0.04 + heat * 0.015;
    chance += Math.min(0.12, Math.max(0, cargoValue - 150) / 1000);
    chance += cargoRatio(state) * 0.10 + Math.max(0, 4 - influence(state, areaId)) * 0.025;
    if ((ctx.slot ?? state.run.slot) >= 2) chance += 0.05;
    if (visibleCash >= 300) chance += Math.min(0.12, (visibleCash - 300) / 2000);
    chance = clamp(chance, 0, 0.45);
    if (next(rng) >= chance) return null;
    return buildRandomEncounter(weightedTemplate(activity, areaId, state, rng), areaId, activity, rng);
  }

  function buildRandomEncounter(template, areaId, activity, rng) {
    const demand = int(rng, template.demand[0], template.demand[1]);
    return {
      active: true, id: template.id, type: "random", engine: "consequence", phase: 0, choices: [], resolved: false,
      title: `Street Friction: ${template.label}`, description: template.setup, feedback: template.setup,
      choicesMade: [], result: null, loot: null, finishAfter: false, areaId, activity,
      npc: { template: template.id, threat: template.threat, hp: 8 + template.threat * 7, demand, aggression: template.aggression, attack: [...template.attack], loot: { ...template.loot } },
    };
  }
  function buildAuthoredEncounter(id, state) {
    const config = AUTHORED_ENCOUNTERS[id];
    if (!config?.enabled) return null;
    return {
      active: true, id, type: "authored", engine: "consequence", phase: 0, choices: [], npc: null, resolved: false,
      title: config.title, description: config.setup, feedback: config.setup,
      choicesMade: [], result: null, loot: null, finishAfter: false,
      areaId: state.world.currentNeighborhoodId, threat: config.threat, pay: config.demand,
    };
  }

  function hasResolved(state, id) {
    return !!state.encounterLog?.resolved?.some((entry) => entry.id === id) || !!state.encounterLog?.activeFlags?.[`${id}Resolved`];
  }
  function checkEncounterTrigger(state, day, slot, action) {
    if (!state || state.run.pendingEncounter || state.run.status !== "playing") return null;
    const rng = action?.rng;
    if (!rng) return null;
    if (day === 2 && !hasResolved(state, "mini_mart_parking_lot")) {
      const weighted = slot >= 2 && next(rng) < (slot === 2 ? 0.38 : 1);
      if (weighted || slot >= 3) {
        const encounter = buildAuthoredEncounter("mini_mart_parking_lot", state);
        encounter.triggerDay = day; encounter.triggerSlot = slot;
        return encounter;
      }
    }
    if (!action?.activity) return null;
    const encounter = rollRandomEncounter(action.activity, action.areaId || state.world.currentNeighborhoodId, state, rng, action);
    if (encounter) { encounter.triggerDay = day; encounter.triggerSlot = slot; }
    return encounter;
  }

  function choice(id, label, hint) { return { id, label, description: hint }; }
  function getEligibleChoices(encounter, state) {
    if (!encounter || encounter.resolved) return [];
    const areaId = encounter.areaId || state.world.currentNeighborhoodId;
    const weapon = equippedWeapon(state);
    const held = heldProducts(state);
    const a = attributes(state);
    const choices = [];
    if (encounter.phase === 0) {
      if (encounter.type === "authored" || (a.presence || 0) >= 4) choices.push(choice("talk", "Talk", "Read the pressure and try to lower it without showing odds."));
      choices.push(choice("run", "Run", "You will survive the attempt, but the street always collects something."));
      const demand = encounter.type === "random" ? encounter.npc.demand : encounter.pay;
      if (state.player.cash >= demand) choices.push(choice("pay", `Pay $${demand}`, "Lose cash and leave without violence."));
      for (const product of held) choices.push(choice(`surrender:${product.id}`, `Surrender ${productName(product.id)}`, "Give up selected product and protect your health."));
      if (weapon || (a.strength || 0) >= 4 || toneNearby(state, areaId)) choices.push(choice("fight", "Fight", "Combat, health, protection, and nearby backup shape the result."));
      if (weapon) choices.push(choice("draw", `Draw ${weapon.name}`, "Escalate first, then commit or find another exit."));
      if (hasNearbyCrew(state, areaId)) choices.push(choice("call_crew", "Call Crew", "Nearby crew can end this, but the response will be visible."));
      if (encounter.type === "authored" && (state.flags?.curtisArrangement || state.npc.curtis?.respect >= 3)) choices.push(choice("use_relationship", "Invoke Curtis's Arrangement", "Spend relationship leverage instead of blood or money."));
      if (state.player.gear?.consumables?.medical_kit > 0 && state.player.health < 100) choices.push(choice("medical_kit", "Use Medical Kit", "Recover now, but the confrontation keeps moving."));
      if (state.player.gear?.equipped?.tool === "burner_phone") choices.push(choice("burner_phone", "Burn the Phone", "Create a fast distraction; the phone will be gone afterward."));
    } else {
      if (weapon || (a.strength || 0) >= 4 || toneNearby(state, areaId)) choices.push(choice("fight", "Commit to the Fight", "The escalation is already visible."));
      choices.push(choice("run", "Take the Opening", "Leave something behind and get clear."));
      for (const product of held) choices.push(choice(`surrender:${product.id}`, `Drop ${productName(product.id)}`, "Trade selected product for a clean exit."));
      if (hasNearbyCrew(state, areaId)) choices.push(choice("call_crew", "Call Crew", "Bring nearby backup into the confrontation."));
    }
    return choices;
  }

  function ensureLog(state) {
    if (!state.encounterLog) state.encounterLog = { resolved: [], activeFlags: {}, randomKills: 0, randomFights: 0 };
  }
  function setFlag(state, id, value) {
    ensureLog(state);
    state.encounterLog.activeFlags[id] = value;
    state.flags[id] = value;
  }
  function finish(state, encounter, outcome, prose, loot) {
    ensureLog(state);
    state.run.encounterCount = (state.run.encounterCount || 0) + 1;
    encounter.resolved = true;
    encounter.active = true;
    encounter.result = { outcome, prose };
    encounter.feedback = prose;
    encounter.loot = loot || null;
    if (encounter.type === "authored") setFlag(state, `${encounter.id}Resolved`, true);
    state.encounterLog.resolved.push({
      id: encounter.id, type: encounter.type, day: encounter.triggerDay ?? state.run.day, slot: encounter.triggerSlot ?? state.run.slot,
      choicesMade: [...encounter.choicesMade], outcome, loot: loot || null,
    });
    if (state.encounterLog.resolved.length > 80) state.encounterLog.resolved = state.encounterLog.resolved.slice(-80);
    state.stats.majorDecisions?.push(`${encounter.title}: ${outcome}`);
  }
  function applyDamage(state, amount, preserveLife) {
    const damage = Math.max(1, amount - armorValue(state) - Math.floor(combat(state) / 2));
    state.player.health = Math.max(preserveLife ? 1 : 0, state.player.health - damage);
    return damage;
  }
  function escapeCost(state, encounter, rng, severe) {
    const lost = loseProduct(state, null, severe ? 2 : 1);
    if (lost) return lost.label;
    const cash = spendCash(state, Math.min(state.player.cash, severe ? 50 : 25));
    if (cash) return `$${cash}`;
    reduceInfluence(state, encounter.areaId);
    return "neighborhood influence";
  }
  function resolveFight(state, encounter, rng) {
    const weapon = equippedWeapon(state);
    const firearm = weapon?.type === "firearm";
    const tone = toneNearby(state, encounter.areaId) ? 0.10 : 0;
    const threat = encounter.type === "random" ? encounter.npc.threat : encounter.threat;
    const chance = clamp(0.28 + combat(state) * 0.10 + (weapon?.accuracy || 0) + tone - threat * 0.045, 0.12, 0.88);
    if (encounter.type === "random") state.encounterLog.randomFights += 1;
    if (firearm) {
      addHeat(state, weapon.heat || 0);
      if (encounter.type === "authored" && encounter.areaId === "downtown") state.flags.firedWeaponDowntown = true;
    }
    if (next(rng) < chance) {
      const lethalChance = firearm ? 0.35 : weapon?.type === "close" ? 0.08 : 0.02;
      const killed = next(rng) < lethalChance;
      if (encounter.type === "random") {
        addHeat(state, killed ? 5 : 2);
        if (killed) state.encounterLog.randomKills += 1;
        const loot = awardLoot(state, encounter.npc, rng);
        finish(state, encounter, killed ? "killed" : "won", killed ? `The fight ends permanently. Sirens will hear about it before the block forgets, but ${loot.label.toLowerCase()} is yours.` : `You stay standing and the ${encounter.npc.template.replaceAll("_", " ")} does not. You take ${loot.label.toLowerCase()} and move.`, loot);
      } else {
        addHeat(state, killed ? 5 : 2);
        if (killed) {
          setFlag(state, "seriousViolence", true);
          state.npc.mina.trust -= 1;
        }
        state.npc.curtis.respect += 1;
        finish(state, encounter, killed ? "serious_violence" : "won", killed ? "The weapon makes the ending final. The lot empties, Heat climbs, and Mina will hear which boundary you crossed." : "You stay upright after the three of them decide the lot is no longer worth taking.");
      }
    } else {
      const attack = encounter.type === "random" ? encounter.npc.attack : [10, 19];
      const damage = applyDamage(state, int(rng, attack[0], attack[1]), false);
      const loss = escapeCost(state, encounter, rng, true);
      finish(state, encounter, "lost", `The answer comes back harder. You lose ${damage} health and ${loss} before the street gives you room to leave.`);
    }
  }
  function resolveRun(state, encounter, rng) {
    const a = attributes(state);
    const shoes = state.player.gear?.equipped?.utility === "running_shoes" ? 0.10 : 0;
    const threat = encounter.type === "random" ? encounter.npc.threat : encounter.threat;
    const chance = clamp(0.35 + (a.reflexes || 0) * 0.09 + (a.endurance || 0) * 0.05 + shoes - cargoRatio(state) * 0.25 - threat * 0.035, 0.18, 0.90);
    const success = next(rng) < chance;
    const cost = escapeCost(state, encounter, rng, !success);
    let damage = 0;
    if (!success) {
      const attack = encounter.type === "random" ? encounter.npc.attack : [9, 17];
      damage = applyDamage(state, int(rng, attack[0], attack[1]), true);
    }
    if (encounter.type === "authored") setFlag(state, "returningCurtisThreat", true);
    finish(state, encounter, success ? "escaped" : "escaped_hurt", success ? `You find the open lane first. ${cost} stays behind, but you do not.` : `They catch you once before you clear the lot. You lose ${damage} health and ${cost}, but the escape does not take your life.`);
  }
  function resolveTalk(state, encounter, rng) {
    const a = attributes(state);
    const arrangement = state.flags.curtisArrangement ? 0.12 : 0;
    const aggression = encounter.type === "random" ? encounter.npc.aggression : 0.20;
    const chance = clamp(0.28 + (a.presence || 0) * 0.08 + (a.insight || 0) * 0.05 + arrangement + influence(state, encounter.areaId) * 0.025 - aggression, 0.12, 0.90);
    if (next(rng) < chance) {
      if (encounter.type === "authored") { setFlag(state, "negotiatedCurtisPassage", true); state.npc.curtis.respect += 1; }
      finish(state, encounter, "talked", "You name the people, the cameras, and the cost of making this messy. The red gloves disappear into a pocket and the lane opens.");
    } else {
      const loss = escapeCost(state, encounter, rng, false);
      const damage = applyDamage(state, int(rng, 5, 10), true);
      if (encounter.type === "authored") setFlag(state, "industrialCrewEncountered", true);
      finish(state, encounter, "talk_failed", `They hear uncertainty instead of leverage. The lesson costs ${loss} and ${damage} health before they let the moment end.`);
    }
  }
  function resolveEncounterChoice(encounterInput, choiceId, inputState, rng) {
    const state = cloneState(inputState);
    const encounter = state.run.pendingEncounter || cloneState(encounterInput);
    if (!encounter || encounter.resolved || !getEligibleChoices(encounter, state).some((item) => item.id === choiceId)) return inputState;
    ensureLog(state);
    encounter.choicesMade = encounter.choicesMade || [];
    encounter.choicesMade.push(choiceId);
    state.run.pendingEncounter = encounter;
    if (choiceId === "draw") {
      encounter.phase += 1;
      encounter.feedback = "The weapon changes every posture in the lot. Nobody has committed yet, but the next answer will end it.";
    } else if (choiceId === "medical_kit") {
      state.player.gear.consumables.medical_kit -= 1;
      state.player.health = clamp(state.player.health + 24, 0, 100);
      encounter.phase += 1;
      encounter.feedback = "You seal the worst of it and steady your hands. The threat is still waiting for an answer.";
    } else if (choiceId === "burner_phone") {
      removeBurner(state);
      addHeat(state, 1);
      finish(state, encounter, "escaped", "The burner sends three conflicting warnings down the block. Everybody looks toward the wrong headlights while you leave through the gap.");
    } else if (choiceId === "pay") {
      const demand = encounter.type === "random" ? encounter.npc.demand : encounter.pay;
      spendCash(state, demand);
      if (encounter.type === "authored") setFlag(state, "paidCurtisPassage", true);
      finish(state, encounter, "paid", `You put $${demand} where everybody can see it. The lane opens without blood, and the price is remembered.`);
    } else if (choiceId.startsWith("surrender:")) {
      const productId = choiceId.split(":")[1];
      const lost = loseProduct(state, productId, encounter.type === "authored" ? 2 : 1);
      if (encounter.type === "authored") setFlag(state, "industrialCrewEncountered", true);
      finish(state, encounter, "surrendered", `You set down ${lost?.label || "an empty bag"}. They take it and let you keep your pulse.`);
    } else if (choiceId === "run") resolveRun(state, encounter, rng);
    else if (choiceId === "talk") resolveTalk(state, encounter, rng);
    else if (choiceId === "use_relationship") {
      state.npc.curtis.respect = Math.max(0, state.npc.curtis.respect - 1);
      setFlag(state, "curtisArrangementUsed", true);
      finish(state, encounter, "relationship", "You repeat the arrangement exactly as Curtis gave it. The red gloves stop moving, and the three of them decide this collection belongs to somebody else.");
    } else if (choiceId === "call_crew") {
      const tone = state.people.crew?.tone;
      if (tone?.recruited && tone.loyalty > -2) tone.loyalty -= 1;
      addHeat(state, encounter.type === "random" ? 2 : 1);
      let loot = null;
      if (encounter.type === "random") loot = awardLoot(state, encounter.npc, rng);
      finish(state, encounter, "crew_win", encounter.type === "random" ? `Backup arrives before the threat can settle. The other side folds, leaving ${loot.label.toLowerCase()} behind.` : "Tone arrives without raising his voice. Three people leave the lot while nearby blinds close one by one.", loot);
    } else if (choiceId === "fight") resolveFight(state, encounter, rng);
    if (!encounter.resolved && encounter.choicesMade.length >= 3) {
      const cost = escapeCost(state, encounter, rng, true);
      finish(state, encounter, "forced_exit", `The moment runs out of room. You leave ${cost} behind and take the only exit still open.`);
    }
    encounter.choices = getEligibleChoices(encounter, state).map((item) => item.id);
    return state;
  }

  return {
    AUTHORED_ENCOUNTERS, RANDOM_NPC_TEMPLATES,
    checkEncounterTrigger, getEligibleChoices, resolveEncounterChoice, rollRandomEncounter,
    buildAuthoredEncounter,
  };
});
