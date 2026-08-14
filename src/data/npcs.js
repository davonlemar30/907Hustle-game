// People the player can build a relationship with: recruitable crew, street
// dealers, product plugs, the household, and the Night Owl regulars.
// Relationship STATE lives in the save (createNpcState); these are the static
// definitions those records point at.
const CREW = [
  { id: "eli", name: "Eli ‘Shortcut’ Ward", role: "Runner", power: 3, recruitCost: 120, wage: 45, description: "Moves small bundles and knows service-road exits.",
    canFieldAssign: true, canRunTerritory: true, lieutenantRole: "operations" },
  { id: "pherris", name: "Pherris Dickens", role: "Connector / Territory Manager", power: 2, recruitCost: 180, wage: 60, description: "Turns a living Downtown contact list into buyers, rumors, and social control.",
    canFieldAssign: true, canRunTerritory: true, lieutenantRole: null },
  { id: "tone", name: "Anton ‘Tone’ Bell", role: "Enforcer / Lookout", power: 5, recruitCost: 250, wage: 85, description: "Protects the garage and changes confrontation choices.",
    canFieldAssign: true, canRunTerritory: true, lieutenantRole: null },
  { id: "deshawn", name: "Deshawn", role: "Fixer / Recruiter", power: 1, recruitCost: 100, wage: 50, description: "De-escalates conflicts, recruits through trust, and keeps Spenard talking.",
    canFieldAssign: true, canRunTerritory: true, lieutenantRole: null },
];

const CREW_BY_ID = Object.fromEntries(CREW.map((item) => [item.id, item]));

const NIGHT_OWL_REGULARS = [
  { id: "cal", name: "Cal Brooks", role: "The loud regular", hint: "Cal talks like every room is already listening." },
  { id: "nia", name: "Nia Park", role: "The quiet courier", hint: "Nia keeps route notes folded inside a paperback." },
];

const HOUSEHOLD_NPCS = [
  { id: "yalonda", name: "Yalonda Hernandez", role: "Landlord", location: "home", startsKnown: true, hint: "She rents the spare room weekly and keeps the house steady." },
  { id: "juan", name: "Juan Hernandez", role: "Yalonda's son", location: "home", startsKnown: true, hint: "He works a warehouse loading dock and knows who is hiring." },
];

const DEALERS = [
  { id: "goodie", name: "Goodie", where: "the Wash & Go lot on Spenard Road", areaId: "north_star_lot", products: ["weed", "shrooms"] },
];

const DEALER_BY_ID = Object.fromEntries(DEALERS.map((item) => [item.id, item]));

const PLUGS = [
  { id: "goodie", name: "Goodie", products: [{ id: "weed", standing: 0 }, { id: "shrooms", standing: 2 }], priceModifier: 1, maxUnits: 3, introducesNext: "tasha" },
  { id: "tasha", name: "Tasha", products: [{ id: "pills", standing: 0 }, { id: "lean", standing: 0 }], priceModifier: 0.90, maxUnits: 5, introducesNext: "malik" },
  { id: "malik", name: "Malik", products: [{ id: "coke", standing: 0 }, { id: "molly", standing: 0 }], priceModifier: 0.82, maxUnits: 8, introducesNext: null, bulkStanding: 3 },
];

const PLUG_BY_ID = Object.fromEntries(PLUGS.map((plug) => [plug.id, plug]));

module.exports = {
  CREW,
  CREW_BY_ID,
  DEALERS,
  DEALER_BY_ID,
  PLUGS,
  PLUG_BY_ID,
  HOUSEHOLD_NPCS,
  NIGHT_OWL_REGULARS,
};
