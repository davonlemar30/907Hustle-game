// The Spenard job board. Each job carries its pay band, the slots it can be
// worked in, its coworkers, and how it is discovered. STARTER_JOB_IDS are the
// ones eligible for the Week Zero discovery shuffle.

const { HOME_DISTRICT_ID } = require("./locations.js");

const JOB_RANK_THRESHOLDS = [4, 8, 14];

const JOB_APPROACHES = {
  work_hard: { id: "work_hard", label: "Work Hard", xp: 2, relationship: 0.5, payMultiplier: 1.10, health: -2, description: "+10% pay · 2 XP · −2 Health" },
  socialize: { id: "socialize", label: "Socialize", xp: 1, relationship: 1, payMultiplier: 1, health: 0, description: "+1 relationship · 1 XP" },
  take_it_easy: { id: "take_it_easy", label: "Take It Easy", xp: 0, relationship: 0.5, payMultiplier: 1, health: 1, description: "+1 Health · no XP" },
  learn_job: { id: "learn_job", label: "Learn the Job", xp: 1.5, relationship: 0.5, payMultiplier: 1, health: 0, description: "1.5 XP · learn one workplace detail" },
};

const SPENARD_JOBS = [
  {
    id: "wash_go", name: "Wash & Go Attendant", areaId: HOME_DISTRICT_ID, pay: [40, 60], slots: [0, 1, 2, 3], scheduled: true, risk: "None",
    starter: true,
    coworkers: [
      { id: "lena", name: "Lena Aguchak", introduction: "Lena Aguchak shows you the towel shelves, then points out which machines shake during the spin cycle." },
      { id: "andre", name: "Andre Price", introduction: "Andre Price slides you the spare key and shows you how to reset the change machine without calling the owner." },
    ],
    discovery: "You notice a 'Help Wanted' sign taped to the Wash & Go window.",
    details: ["Lena says the quiet hour starts after the school buses clear Spenard.", "The change machine jams when the temperature drops below zero."],
    shiftDialogue: ["The dryers thump through another load while the counter stays steady.", "A line forms at the change machine. You keep it moving.", "Salt dries white across the floor. The last basket leaves clean."],
  },
  {
    id: "spenard_chevron", name: "Spenard Chevron Clerk", areaId: HOME_DISTRICT_ID, pay: [48, 60], slots: [0, 1, 2, 3], scheduled: true, risk: "None", starter: true,
    coworkers: [
      { id: "tiana", name: "Tiana Cole", introduction: "Tiana Cole shows you the cigarette count and the camera angles behind the counter." },
      { id: "owen", name: "Owen Park", introduction: "Owen Park hands you a register code and points toward the rush that follows every airport shift." },
    ],
    discovery: "A handwritten card at Spenard Chevron says the counter needs another reliable clerk.",
    details: ["Tiana says the coffee rush lands before the pumps get busy.", "Owen keeps the snow shovel beside the freezer door."],
    shiftDialogue: ["Pump numbers blink while you count change under the counter light.", "A cab line fills the lot. Coffee and fuel move together.", "The doors hiss open all shift. You keep the register square."],
  },
  {
    id: "rebel_convenience", name: "Rebel Convenience Clerk", areaId: HOME_DISTRICT_ID, pay: [48, 60], slots: [0, 1, 2, 3], scheduled: true, risk: "None", starter: true,
    coworkers: [
      { id: "rochelle", name: "Rochelle King", introduction: "Rochelle King walks you through the cooler count and the stack of delivery slips." },
      { id: "jae", name: "Jae Park", introduction: "Jae Park gives you the register drawer and shows you which regulars pay in exact change." },
    ],
    discovery: "Rebel Convenience has a counter opening posted beside the lottery display.",
    details: ["Rochelle checks the cooler seals before every handoff.", "Jae says the late bus brings the cleanest rush."],
    shiftDialogue: ["The cooler doors knock shut while the register keeps ringing.", "A delivery blocks one aisle. You clear boxes between customers.", "Lottery slips curl beside the till. Your drawer stays even."],
  },
  {
    id: "northern_value", name: "Northern Value Floor Staff", areaId: HOME_DISTRICT_ID, pay: [48, 60], slots: [0, 1, 2], scheduled: true, risk: "None", starter: true,
    coworkers: [
      { id: "isaiah", name: "Isaiah Green", introduction: "Isaiah Green hands you a rolling rack and shows you how the floor gets reset before lunch." },
      { id: "ana", name: "Ana Sosa", introduction: "Ana Sosa marks the sorting bins and points out the donations worth moving first." },
    ],
    discovery: "Northern Value needs floor staff. The paper application sits beside a row of winter coats.",
    details: ["Isaiah saves the strongest hangers for heavy parkas.", "Ana says tool donations sell before they reach the back wall."],
    shiftDialogue: ["Coats move from the rack before you finish tagging the next row.", "Donation carts crowd the back door. You sort a path through them.", "The floor clears by closing. One last rack rolls into place."],
  },
  {
    id: "night_owl", name: "Night Owl counter shift", areaId: HOME_DISTRICT_ID, pay: [55, 75], slots: [2], scheduled: true, risk: "None",
    coworkers: [{ id: "mina", name: "Mina Vale", introduction: "Mina points out the closing list, the regulars, and which register sticks. Then she hands you an apron." }],
    discovery: "The Night Owl has a cardboard sign by the register: 'Counter help needed, evenings.'",
    details: ["Mina says the coffee rush ends ten minutes after the last airport shift bus.", "The owner counts cigarettes before cash and checks the back door twice."],
    shiftDialogue: ["The counter light catches every face that comes through after dusk.", "Coffee burns low while Mina counts the last cigarettes.", "The door keeps opening until the city finally settles."],
  },
  {
    id: "delivery", name: "Delivery run", areaId: HOME_DISTRICT_ID, pay: [60, 120], slots: [0, 1, 2, 3], scheduled: false, risk: "None",
    coworkers: [{ id: "minh", name: "Minh Tran", introduction: "Minh Tran keeps the courier route moving with two phones and a paper map." }],
    discovery: "Guy loading a van on Spenard Road asks if you drive. Says he needs runners.",
    details: ["Minh marks apartment entrances that stay clear when the snow berms narrow the road.", "The airport hotels accept deliveries fastest between housekeeping rounds."],
    shiftDialogue: ["The route folds across Spenard and back before the next call lands.", "Hotel doors open, packages change hands, and the van keeps moving.", "Snow narrows the curb. You finish every stop without losing the route."],
  },
  {
    id: "ship_creek", name: "Ship Creek Freight", areaId: HOME_DISTRICT_ID, pay: [110, 140], slots: [0], scheduled: true, risk: "None",
    coworkers: [{ id: "marcus", name: "Marcus Bell", introduction: "Marcus Bell checks your gloves, points at the freight line, and says payday is at the door." }],
    discovery: "Flyer stapled to a phone pole: 'FREIGHT HELP NEEDED. Same day pay. AM only.'",
    details: ["Marcus says the first truck after sunrise is the one that decides whether the dock falls behind.", "The yard office keeps a short list of workers who show up before the gate opens."],
    shiftDialogue: ["Pallets scrape concrete before the sun clears the yard.", "The first truck lands heavy. You keep the freight line moving.", "Cold metal bites through the gloves. The last load clears on time."],
  },
  {
    id: "juan_warehouse", name: "Spenard Warehouse Dock", areaId: HOME_DISTRICT_ID, pay: [70, 95], slots: [0, 1], scheduled: true, risk: "None",
    coworkers: [{ id: "juan", name: "Juan Hernandez", introduction: "Juan Hernandez meets you at the loading door and shows you which pallets move first." }],
    discovery: "Juan says his warehouse dock needs another loader.",
    details: ["Juan says the receiving truck is easiest before lunch.", "The dock supervisor keeps callbacks short and notices early arrivals."],
    shiftDialogue: ["Pallet wrap snaps while the loading door rattles open.", "Juan calls the order and you keep the dock moving.", "The last pallet lands square before the truck pulls away."],
  },
  {
    id: "day_labor", name: "Day Labor Pickup", areaId: HOME_DISTRICT_ID, pay: [40, 60], slots: [0, 1], scheduled: true, risk: "None", dayLabor: true,
    coworkers: [], discovery: "The day-labor pickup takes walk-ons every morning.", details: [],
    shiftDialogue: ["You shovel, haul, and take the cash when the truck returns.", "A short crew clears the job before the weather turns.", "The foreman counts bills into your palm at the curb."],
  },
];

const SPENARD_JOB_BY_ID = Object.fromEntries(SPENARD_JOBS.map((job) => [job.id, job]));

const STARTER_JOB_IDS = SPENARD_JOBS.filter((job) => job.starter).map((job) => job.id);

module.exports = {
  JOB_RANK_THRESHOLDS,
  JOB_APPROACHES,
  SPENARD_JOBS,
  SPENARD_JOB_BY_ID,
  STARTER_JOB_IDS,
};
