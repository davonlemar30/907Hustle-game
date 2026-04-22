// 907 Hustle — Lightweight Combat Modal
// Depends on globals from script.js: GAME, DRUGS, rng, addFeed, render, openModal, closeModal, resetGame

const ENEMIES = {
  street_kid:   { name: "Scrappy Kid",       hp: 18, atk: [2, 6],   speed: 9, fleeEase: 0.80, bribe: 30 },
  tweaker:      { name: "Desperate Tweaker", hp: 25, atk: [3, 10],  speed: 7, fleeEase: 0.70, bribe: 40 },
  mugger:       { name: "Mugger",            hp: 30, atk: [4, 11],  speed: 7, fleeEase: 0.55, bribe: 120 },
  street_thug:  { name: "Street Thug",       hp: 40, atk: [5, 12],  speed: 6, fleeEase: 0.60, bribe: 160 },
  rival_dealer: { name: "Rival Dealer",      hp: 55, atk: [7, 14],  speed: 6, fleeEase: 0.50, bribe: 220, lootDrug: "crack", lootQty: [3, 8] },
  undercover:   { name: "Undercover",        hp: 60, atk: [5, 13],  speed: 7, fleeEase: 0.45, bribe: 300, seizes: true },
  patrol:       { name: "APD Patrol",        hp: 75, atk: [6, 15],  speed: 8, fleeEase: 0.35, bribe: 400, seizes: true, heatOnFlee: 4 },
  rook_goon:    { name: "Rook's Goon",       hp: 85, atk: [10, 18], speed: 5, fleeEase: 0.40, bribe: 350, rookHit: -3 },
  rival_crew:   { name: "Rival Crew",        hp: 95, atk: [9, 17],  speed: 5, fleeEase: 0.35, bribe: 500 },
  dre_enforcer: { name: "Dre's Enforcer",    hp: 100,atk: [12, 22], speed: 6, fleeEase: 0.25, bribe: 800, dreSpecial: true },
};

let COMBAT = null;

function playerAttackBonus() {
  let bonus = 0;
  if (GAME.assets.includes("burner_pack")) bonus += 6;
  if (GAME.assets.includes("muscle_1")) bonus += 4;
  return bonus;
}

function startCombat(enemyId, opener) {
  const proto = ENEMIES[enemyId];
  if (!proto) { addFeed(`Unknown enemy: ${enemyId}`, "bad"); return null; }
  COMBAT = {
    id: enemyId,
    enemy: { ...proto, hp: proto.hp, hpMax: proto.hp },
    turn: 1,
    log: opener ? [opener] : [],
  };
  renderCombatModal();
  return null;
}

function combatAction(action) {
  if (!COMBAT) return;
  const e = COMBAT.enemy;

  if (action === "fight") {
    const youDmg = rng(4, 11) + playerAttackBonus();
    e.hp -= youDmg;
    COMBAT.log.push(`You swing. ${youDmg} damage.`);
    if (e.hp <= 0) return endCombat("win");
    const their = rng(e.atk[0], e.atk[1]);
    GAME.health -= their;
    COMBAT.log.push(`${e.name} hits you for ${their}.`);
    if (GAME.health <= 0) return endCombat("dead");

  } else if (action === "flee") {
    if (Math.random() < (e.fleeEase || 0.5)) {
      const cashLoss = Math.min(GAME.cash, Math.floor(GAME.cash * 0.15) + rng(10, 40));
      GAME.cash -= cashLoss;
      if (e.heatOnFlee) GAME.heat += e.heatOnFlee;
      COMBAT.log.push(`You break and run. Dropped $${cashLoss}.`);
      return endCombat("flee", { cashLoss });
    }
    const their = rng(e.atk[0], e.atk[1]) + 2;
    GAME.health -= their;
    COMBAT.log.push(`Flee failed. Caught ${their} on the way.`);
    if (GAME.health <= 0) return endCombat("dead");

  } else if (action === "bribe") {
    const cost = e.bribe || 200;
    if (GAME.cash < cost) { COMBAT.log.push(`Short $${cost - GAME.cash}. Can't pay.`); renderCombatModal(); return; }
    GAME.cash -= cost;
    COMBAT.log.push(`Paid $${cost}. ${e.name} fades back.`);
    return endCombat("bribe", { cost });

  } else if (action === "draw") {
    if (!GAME.assets.includes("burner_pack")) { COMBAT.log.push(`No burner to draw.`); renderCombatModal(); return; }
    const youDmg = rng(14, 28);
    e.hp -= youDmg;
    GAME.heat += 2;
    COMBAT.log.push(`Burner out. ${youDmg} damage. Heat +2.`);
    if (e.hp <= 0) return endCombat("win");
    const their = Math.max(1, rng(e.atk[0], e.atk[1]) - 3);
    GAME.health -= their;
    COMBAT.log.push(`${e.name} returns fire: ${their}.`);
    if (GAME.health <= 0) return endCombat("dead");
  }

  COMBAT.turn += 1;
  GAME.health = Math.max(0, GAME.health);
  renderCombatModal();
}

function endCombat(result, extra = {}) {
  const e = COMBAT.enemy;
  const id = COMBAT.id;

  if (result === "win") {
    const loot = rng(40, 120) + Math.floor(e.hpMax * 0.6);
    GAME.cash += loot;
    GAME.rep += 2;
    let msg = `${e.name} down. +$${loot}.`;

    if (e.lootDrug && hasRoomFor(e.lootDrug, 1)) {
      const qty = rng(e.lootQty[0], e.lootQty[1]);
      const actual = Math.min(qty, GAME.maxCarry - cargoCount());
      GAME.inventory[e.lootDrug] = (GAME.inventory[e.lootDrug] || 0) + actual;
      msg += ` Took ${actual} ${nameOf(e.lootDrug)} off them.`;
    }
    if (e.rookHit) GAME.rook.attention = Math.max(0, GAME.rook.attention + e.rookHit);
    if (id === "dre_enforcer") {
      GAME.dre.loanOutstanding = 0;
      GAME.dre.deadlineDay = null;
      GAME.dre.trust -= 5;
      msg += ` Dre knows.`;
    }
    addFeed(msg, "good");

  } else if (result === "flee") {
    addFeed(`You got out. Cost $${extra.cashLoss || 0}.`);

  } else if (result === "bribe") {
    addFeed(`Bribed out for $${extra.cost}.`);

  } else if (result === "dead") {
    addFeed(`You got folded. Run over.`, "bad");
    COMBAT = null;
    closeModal();
    resetGame();
    return;
  }

  if (e.seizes && result !== "win" && result !== "flee") {
    // nothing on bribe
  }
  if (e.seizes && (result === "flee" || result === "bribe")) {
    const invOptions = DRUGS.filter((d) => GAME.inventory[d.id] > 0);
    if (invOptions.length && Math.random() < 0.5) {
      const pick = invOptions[rng(0, invOptions.length - 1)];
      const seized = Math.min(GAME.inventory[pick.id], rng(2, 6));
      GAME.inventory[pick.id] -= seized;
      addFeed(`${seized} ${pick.displayName} seized in the scuffle.`, "bad");
    }
  }

  COMBAT = null;
  closeModal();
  render();
}

function hasRoomFor(drugId, qty) {
  return GAME.maxCarry - cargoCount() >= qty;
}

function renderCombatModal() {
  if (!COMBAT) return;
  const e = COMBAT.enemy;
  const logHtml = COMBAT.log.slice(-5).map((l) => `<div class="combat-log-line">${l}</div>`).join("");
  const bribeLabel = GAME.cash >= e.bribe ? `Bribe $${e.bribe}` : `Bribe $${e.bribe} (short)`;
  const canDraw = GAME.assets.includes("burner_pack");
  const html = `
    <div class="combat-stats">
      <div><span class="eyebrow">You</span><strong>${GAME.health}/100 HP</strong><small class="muted">$${GAME.cash}</small></div>
      <div><span class="eyebrow">${e.name}</span><strong>${Math.max(0, e.hp)}/${e.hpMax} HP</strong></div>
    </div>
    <div class="combat-log">${logHtml}</div>
    <div class="combat-actions">
      <button class="btn danger" data-combat="fight" type="button">Fight</button>
      <button class="btn secondary" data-combat="flee" type="button">Flee <small class="muted">~${Math.round((e.fleeEase || 0.5) * 100)}%</small></button>
      <button class="btn secondary" data-combat="bribe" type="button" ${GAME.cash >= e.bribe ? "" : "disabled"}>${bribeLabel}</button>
      <button class="btn primary" data-combat="draw" type="button" ${canDraw ? "" : "disabled"}>Draw Burner <small class="muted">+heat</small></button>
    </div>
  `;
  openModal(`Combat — Turn ${COMBAT.turn}`, html);
}
