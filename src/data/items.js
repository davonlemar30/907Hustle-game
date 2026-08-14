// Purchasable gear and the base upgrade tracks.
//
// The 907List resale catalogue moved to ./market.js in v1.9b, where the tier,
// category, and true-value fields it grew belong next to the constants that
// price them. It is re-exported here so the game-core barrel and every existing
// caller keep the name they already use.

const { LISTING_ITEMS, LISTING_ITEM_BY_ID } = require("./market.js");

const GEAR = [
  { id: "utility_knife", name: "Utility Knife", cost: 90, slot: "weapon", type: "close", accuracy: 0.04, damage: [8, 14], heat: 0, description: "Concealable close-range protection." },
  { id: "cheap_handgun", name: "Cheap Handgun", cost: 230, slot: "weapon", type: "firearm", accuracy: -0.06, damage: [14, 24], heat: 2, description: "Affordable stopping power with unreliable aim." },
  { id: "reliable_handgun", name: "Reliable Handgun", cost: 430, slot: "weapon", type: "firearm", accuracy: 0.08, damage: [18, 30], heat: 2, description: "Accurate, costly, and difficult to explain." },
  { id: "protective_vest", name: "Protective Vest", cost: 300, slot: "armor", armor: 4, description: "Cuts incoming damage but marks you as prepared for trouble." },
  { id: "running_shoes", name: "Running Shoes", cost: 160, slot: "utility", escape: 0.10, description: "A real advantage when the bag is not overloaded." },
  { id: "medical_kit", name: "Medical Kit", cost: 95, slot: "consumable", heal: 24, description: "One use during an encounter or at the garage." },
  { id: "larger_bag", name: "Larger Bag", cost: 260, slot: "gear", cargo: 5, description: "Five more carried units, with more weight to escape with." },
  { id: "burner_phone", name: "Burner Phone", cost: 180, slot: "tool", call: true, description: "Unlocks selected warnings, calls, and remote coordination." },
];

const BASE_UPGRADES = [
  { track: "security", level: 1, id: "better_locks", name: "Better Locks", cost: 140, description: "Protects stored goods from the first intrusion." },
  { track: "security", level: 2, id: "camera_door", name: "Camera + Reinforced Door", cost: 360, description: "Reveals surveillance and changes raid choices." },
  { track: "storage", level: 1, id: "hidden_compartment", name: "Hidden Compartment", cost: 120, description: "Adds protected product space and a small cash stash." },
  { track: "storage", level: 2, id: "secure_lockbox", name: "Secure Lockbox", cost: 300, description: "Expands protected inventory and off-street cash." },
  { track: "operations", level: 1, id: "burner_station", name: "Burner Station", cost: 180, description: "Improves coordination and unlocks crew assignments." },
  { track: "operations", level: 2, id: "market_table", name: "Market Board + Packaging Table", cost: 420, description: "Improves rumors and opens harder supply lanes." },
  { track: "recovery", level: 1, id: "first_aid_setup", name: "First-Aid Setup", cost: 150, description: "Makes garage recovery cheaper and safer." },
  { track: "recovery", level: 2, id: "safe_room", name: "Safe Room + Medical Contact", cost: 380, description: "Protects one person and can prevent a fatal ending." },
];

const GEAR_BY_ID = Object.fromEntries(GEAR.map((item) => [item.id, item]));

module.exports = {
  GEAR,
  BASE_UPGRADES,
  GEAR_BY_ID,
  LISTING_ITEMS,
  LISTING_ITEM_BY_ID,
};
