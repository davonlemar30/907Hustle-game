// Tradeable product definitions and the id lookup derived from them.
// base/min/max are dollars; volatility feeds the daily market walk in
// evolveMarkets; access gates which supplier tier can sell the product.

const PRODUCTS = [
  { id: "weed", name: "Weed", role: "Dependable", base: 34, min: 18, max: 68, volatility: 0.12, heat: 0, access: "open" },
  { id: "shrooms", name: "Shrooms", role: "Volatile", base: 82, min: 35, max: 180, volatility: 0.25, heat: 0, access: "open" },
  { id: "pills", name: "Pills", role: "Steady margin", base: 105, min: 55, max: 220, volatility: 0.18, heat: 1, access: "plug" },
  { id: "lean", name: "Lean", role: "Premium", base: 155, min: 80, max: 330, volatility: 0.22, heat: 1, access: "plug" },
  { id: "coke", name: "Coke", role: "High margin", base: 290, min: 145, max: 690, volatility: 0.30, heat: 1, access: "plug" },
  { id: "molly", name: "Molly", role: "Club demand", base: 215, min: 105, max: 480, volatility: 0.28, heat: 1, access: "plug" },
  { id: "cocaine", name: "Cocaine", role: "Premium", base: 290, min: 145, max: 690, volatility: 0.30, heat: 1, access: "supplier" },
  { id: "meth", name: "Meth", role: "Extreme Risk", base: 185, min: 70, max: 560, volatility: 0.38, heat: 2, access: "industrial" },
];

const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map((item) => [item.id, item]));

module.exports = {
  PRODUCTS,
  PRODUCT_BY_ID,
};
