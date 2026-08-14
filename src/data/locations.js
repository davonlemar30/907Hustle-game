// Districts, the territory layer over them, and the Spenard block sub-layer.
// HOME_DISTRICT_ID is the district the player starts in and the only one that
// currently has a block layer (see districtHasBlockLayer).

const HOME_DISTRICT_ID = "north_star_lot";

const NEIGHBORHOODS = [
  {
    id: "north_star_lot", name: "Spenard", role: "Home", travelAction: "TRAVEL", risk: 1, police: 1, rival: 0,
    accent: "#d7d7d7", blurb: "North Star Garage, the Night Owl Mini-Mart, and familiar blocks that offer the week's safest footing.",
    bias: { weed: 0.78, shrooms: 0.88, cocaine: 1.02, meth: 0.95 },
    availability: { weed: 1, shrooms: 0.88, pills: 0.82, lean: 0.7, coke: 0.62, molly: 0.68, cocaine: 0.55, meth: 0.48 },
  },
  {
    id: "downtown", name: "Downtown", role: "Commercial", travelAction: "BUS_TRAVEL", risk: 2, police: 3, rival: 1,
    accent: "#e14332", blurb: "Nightlife money moves fast under cameras and through Curtis's buyers.",
    bias: { weed: 1.08, shrooms: 1.32, cocaine: 1.46, meth: 1.08 },
    availability: { weed: 0.9, shrooms: 0.9, pills: 0.82, lean: 0.78, coke: 0.8, molly: 0.86, cocaine: 0.78, meth: 0.58 },
  },
  {
    id: "airport_industrial", name: "Industrial Service Roads", role: "Outer", travelAction: "TRAVEL", risk: 4, police: 2, rival: 3,
    accent: "#9a1d18", blurb: "Loading yards, warehouses, service roads, rare supply, and expensive mistakes.",
    bias: { weed: 1.12, shrooms: 1.18, cocaine: 1.32, meth: 1.62 },
    availability: { weed: 0.72, shrooms: 0.7, pills: 0.7, lean: 0.74, coke: 0.78, molly: 0.72, cocaine: 0.7, meth: 0.86 },
  },
];

const TERRITORIES = [
  { areaId: "north_star_lot", power: 12, attackCost: 100, dailyIncome: 45, special: "Recruitment costs 10% less." },
  { areaId: "downtown", power: 18, attackCost: 150, dailyIncome: 75, special: "Cocaine access opens." },
  { areaId: "airport_industrial", power: 24, attackCost: 200, dailyIncome: 110, special: "Meth access opens." },
];

const SPENARD_BLOCKS = [
  { id: "wash_and_go_lot", name: "Wash & Go Lot", earningPotential: 55, heatExposure: 1, curtisVisibility: 1, patrolFrequency: 1, claimCost: 220 },
  { id: "fourth_ave_strip", name: "Fourth Avenue Strip", earningPotential: 80, heatExposure: 2, curtisVisibility: 2, patrolFrequency: 2, claimCost: 320 },
  { id: "minnesota_offramp", name: "Minnesota Off-Ramp", earningPotential: 65, heatExposure: 2, curtisVisibility: 1, patrolFrequency: 1, claimCost: 260 },
  { id: "spenard_rec_lot", name: "Spenard Rec Center Lot", earningPotential: 45, heatExposure: 1, curtisVisibility: 0, patrolFrequency: 1, claimCost: 180 },
  { id: "northern_lights_motels", name: "Northern Lights Motel Row", earningPotential: 100, heatExposure: 3, curtisVisibility: 3, patrolFrequency: 2, claimCost: 400 },
  { id: "service_road_chokepoint", name: "Service Road Chokepoint", earningPotential: 70, heatExposure: 2, curtisVisibility: 2, patrolFrequency: 3, claimCost: 300 },
];

const SPENARD_BLOCK_BY_ID = Object.fromEntries(SPENARD_BLOCKS.map((item) => [item.id, item]));

const AREA_BY_ID = Object.fromEntries(NEIGHBORHOODS.map((item) => [item.id, item]));

module.exports = {
  HOME_DISTRICT_ID,
  NEIGHBORHOODS,
  TERRITORIES,
  SPENARD_BLOCKS,
  SPENARD_BLOCK_BY_ID,
  AREA_BY_ID,
};
